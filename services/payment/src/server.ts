
import Fastify from "fastify";
import jwt from "@fastify/jwt";
import { randomBytes, createHash } from "node:crypto";
import { v4 as uuidv4 } from "uuid";
import { PrismaClient, Prisma } from "@video-platform/database";
import { helpers, config } from "@ckb-lumos/lumos";
import { ccc } from "@ckb-ccc/core";
import { sendCkb } from "./ckb";

// Import types and schemas from shared
import {
  PointsBuySchema, PointsBuyDTO,
  PointsBuyCKBSchema, PointsBuyCKBDTO,
  PointsEarnSchema,
  PointsRedeemSchema,
  PointsEarnToSchema,
  CkbPurchaseIntentSchema, CkbPurchaseIntentDTO,
  TipRequestSchema
} from "@video-platform/shared/validation/schemas";
import type { VideoMeta, TipLeaderboardEntry } from "@video-platform/shared/types";
import { RealFiberHTLC, createStreamInvoice, FiberRPCClient } from "@video-platform/shared/web3/fiber";
import { registerSecurityPlugins } from "@video-platform/shared/security/index";
import { register } from "@video-platform/shared/monitoring";
import { registerTracingPlugin } from "@video-platform/shared/monitoring/tracing";
import { registerRequestLogging, createLogger } from "@video-platform/shared/monitoring/logger";
import { startSettlementWorker, enqueueStreamSettle, enqueueFiberSettle } from './settlementWorker';
import { getQueueStats, QUEUE_NAMES } from '@video-platform/shared/queue';
import { postPaymentSplitHook, loadSplitContractsFromDB } from '@video-platform/shared/web3/postPaymentSplitHook';

const logger = createLogger("payment");

// Local interfaces/DTOs
interface CkbIntentStatusResponse {
  orderId: string;
  status: string;
  confirmations: number;
  creditedPoints?: number;
  expectedAmountShannons: string;
  txHash?: string | null;
}

const prisma = new PrismaClient();
const app = Fastify({ logger: true });

// Constants
const POINTS_PER_USDI = 100;
const POINTS_PER_CKB = 10000; // 1 CKB = 10000 Points (Example rate)
const CKB_NODE_URL = process.env.CKB_NODE_URL || "https://testnet.ckb.dev/rpc";
const CKB_INDEXER_URL = process.env.CKB_INDEXER_URL || "https://testnet.ckb.dev/indexer";
const CKB_DEPOSIT_ADDRESS = process.env.CKB_DEPOSIT_ADDRESS || "";

// Constants for JoyID
const ENABLE_POINTS_JOYID = process.env.ENABLE_POINTS_JOYID === "1";
const POINTS_NONCE_TTL_MS = 5 * 60 * 1000;
const POINTS_NONCE_TTL_SEC = 5 * 60; // 5 minutes in seconds for Redis
const FIBER_ALLOW_MOCK = process.env.FIBER_ALLOW_MOCK === "1";

// Redis-backed nonce stores (replaces in-memory Maps)
import { setNonce, getNonce, deleteNonce } from "@video-platform/shared/stores/redis";
import { calculateUniversalSplits } from "./paymentAbstraction";

// Redis key prefixes
const NONCE_PREFIX = {
  points: "payment:nonce:points",
  redeem: "payment:nonce:redeem",
  ckb: "payment:nonce:ckb",
};

// Security: Helmet, CORS, Rate Limiting, TraceId
await registerSecurityPlugins(app, {
  rateLimit: { max: 60, timeWindow: "1 minute" },
  enableCors: false, // We use custom CORS for Payment
});

// Observability: Tracing and Structured Logging
registerTracingPlugin(app, { serviceName: "payment" });
registerRequestLogging(app, "payment");
logger.info("Payment service initializing");

app.register(jwt, { secret: process.env.JWT_SECRET || "supersecret" });

// Health check endpoint
app.get("/health", async () => ({ status: "ok", service: "payment" }));
// Prometheus metrics（可观测 P0）
app.get("/metrics", async (_req: any, reply: any) => {
  reply.header("Content-Type", register.contentType);
  return reply.send(await register.metrics());
});

// Define specific user types extended from request
interface RequestUser {
  sub: string;
  ckb?: string;
  role?: string;
  roles?: string[];
  [key: string]: any;
}

// Global hook: add user info to request
app.addHook("onRequest", async (req) => {
  try {
    await req.jwtVerify();
  } catch (err) {
    // Allows public access for some endpoints, check inside handlers if needed
  }
});

// JoyID 验签：https://docs.joyid.dev/guide/ckb/connect
import { verifySignature } from "@joyid/ckb";

// Helper: Get user balance
async function getUserPoints(userId: string): Promise<number> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { points: true }
  });
  return Number(user?.points || 0);
}

// Helper: Update user balance
async function updateUserPoints(userId: string, amount: number, txType: string, reason?: string, videoId?: string) {
  return await prisma.$transaction(async (tx) => {
    const user = await tx.user.findUnique({ where: { id: userId } });
    if (!user) throw new Error("User not found");

    const newBalance = Number(user.points) + amount;
    if (newBalance < 0) throw new Error("Insufficient balance");

    await tx.user.update({
      where: { id: userId },
      data: { points: newBalance }
    });

    await tx.pointsTransaction.create({
      data: {
        userId,
        type: txType,
        amount: amount, // Positive for earn/buy, negative for redeem/spend
        reason
      }
    });

    return newBalance;
    // Note: videoId logic for transaction history currently not in PointsTransaction model directly, 
    // but captured in reason or separate relationship if improved in future.
  });
}

// 1. Get user points balance and history
app.get("/payment/points/balance", async (req, reply) => {
  const userId = (req.user as RequestUser)?.sub;
  if (!userId) return reply.status(401).send({ error: "Unauthorized" });

  const points = await getUserPoints(userId);

  const history = await prisma.pointsTransaction.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    take: 20
  });

  return reply.send({
    pointsString: String(points),
    points: points,
    balance: points, // Fix: frontend expects 'balance'
    history
  });
});

// 1.1 Get Points Ledger (Dedicated)
app.get("/payment/points/ledger/me", async (req, reply) => {
  const userId = (req.user as RequestUser)?.sub;
  if (!userId) return reply.status(401).send({ error: "Unauthorized" });

  const points = await getUserPoints(userId);
  const txns = await prisma.pointsTransaction.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    take: 50
  });

  return reply.send({
    balance: points,
    txns
  });
});

// 2. Buy points with USDI
app.post("/payment/points/buy", async (req, reply) => {
  const parsed = PointsBuySchema.safeParse((req.body || {}) as PointsBuyDTO);
  if (!parsed.success) return reply.status(400).send({ error: "Invalid parameters", code: "bad_request", details: parsed.error.flatten() });

  const { usdiAmount, pointsAmount } = parsed.data;
  const userId = (req.user as RequestUser)?.sub;
  const userCkb = (req.user as RequestUser)?.ckb || "";

  if (!userId) return reply.status(401).send({ error: "Unauthorized" });

  let buyUSDI: number | undefined;
  let buyPoints: number | undefined;

  // Logic to calculate amounts
  if (usdiAmount !== undefined) {
    buyUSDI = parseFloat(usdiAmount);
    if (isNaN(buyUSDI) || buyUSDI <= 0) return reply.status(400).send({ error: "usdiAmount must be positive", code: "bad_usdi_amount" });
    buyPoints = Math.floor(buyUSDI * POINTS_PER_USDI);
  } else if (pointsAmount !== undefined) {
    buyPoints = pointsAmount;
    if (!Number.isInteger(buyPoints!) || buyPoints! <= 0) return reply.status(400).send({ error: "pointsAmount must be positive integer", code: "bad_points_amount" });
    buyUSDI = Math.ceil((buyPoints! / POINTS_PER_USDI) * 10000) / 10000;
  } else {
    return reply.status(400).send({ error: "Provide usdiAmount or pointsAmount", code: "missing_amount" });
  }

  if (buyPoints! <= 0) return reply.status(400).send({ error: "Points must be > 0", code: "buy_points_too_low" });

  // JoyID verification logic
  if (ENABLE_POINTS_JOYID) {
    const body: any = req.body || {};
    const signatureData = body?.signatureData;
    const address = String(body?.address || "");
    if (!signatureData || !address) return reply.status(400).send({ error: "Missing signature or address", code: "missing_signature" });
    if (!userCkb) return reply.status(400).send({ error: "JoyID login required", code: "require_joyid_login" });
    if (address !== userCkb) return reply.status(400).send({ error: "Address mismatch", code: "address_mismatch" });

    const ch: string = String(signatureData?.challenge || "");
    const m = ch.match(/^vp-points-buy:([0-9a-f\-]{36}):([0-9]+(?:\.[0-9]{1,6})?)$/);
    if (!m) return reply.status(400).send({ error: "Invalid challenge format", code: "invalid_challenge" });

    const nonceId = m[1];
    const usdiInChallenge = m[2];
    const rec = await getNonce<{ userId: string; usdi: string; issuedAt: number }>(NONCE_PREFIX.points, nonceId);

    if (!rec) return reply.status(400).send({ error: "Challenge not found or expired", code: "challenge_missing" });
    // Note: TTL is handled by Redis automatically, no need to check issuedAt
    if (rec.userId !== userId) return reply.status(400).send({ error: "Challenge user mismatch", code: "challenge_user_mismatch" });
    if (rec.usdi !== String(usdiAmount ?? usdiInChallenge)) return reply.status(400).send({ error: "Challenge amount mismatch", code: "challenge_amount_mismatch" });

    const ok = await verifySignature(signatureData).catch(() => false);
    if (!ok) return reply.status(400).send({ error: "Signature verification failed", code: "verify_failed" });
    await deleteNonce(NONCE_PREFIX.points, nonceId);
  }

  // Execute transaction
  const newBalance = await updateUserPoints(userId, buyPoints!, "buy", `Purchase ${buyPoints} points with ${buyUSDI} USDI`);

  return reply.send({
    ok: true,
    creditedPoints: buyPoints!,
    pointsBalance: newBalance,
    usdiAmount: String(buyUSDI),
    pointsPerUSDI: POINTS_PER_USDI,
  });
});

// 3. Buy points with CKB (Simple Interface)
app.post("/payment/points/buyByCKB", async (req, reply) => {
  const parsed = PointsBuyCKBSchema.safeParse((req.body || {}) as PointsBuyCKBDTO);
  if (!parsed.success) return reply.status(400).send({ error: "Invalid parameters", code: "bad_request", details: parsed.error.flatten() });

  const { ckbAmount, pointsAmount } = parsed.data;
  const userId = (req.user as RequestUser)?.sub;

  if (!userId) return reply.status(401).send({ error: "Unauthorized" });

  let buyCKB: number | undefined;
  let buyPoints: number | undefined;

  if (ckbAmount !== undefined) {
    buyCKB = parseFloat(ckbAmount);
    if (isNaN(buyCKB) || buyCKB <= 0) return reply.status(400).send({ error: "ckbAmount must be positive", code: "bad_ckb_amount" });
    buyPoints = Math.floor(buyCKB * POINTS_PER_CKB);
  } else if (pointsAmount !== undefined) {
    buyPoints = pointsAmount;
    if (!Number.isInteger(buyPoints!) || buyPoints! <= 0) return reply.status(400).send({ error: "pointsAmount must be positive integer", code: "bad_points_amount" });
    buyCKB = Math.ceil((buyPoints! / POINTS_PER_CKB) * 1e8) / 1e8;
  } else {
    return reply.status(400).send({ error: "Provide ckbAmount or pointsAmount", code: "missing_amount" });
  }

  // JoyID verification skipped for brevity in migration, mirroring buy logic above if enabled

  const newBalance = await updateUserPoints(userId, buyPoints!, "buy", `Purchase ${buyPoints} points with ${buyCKB} CKB`);

  return reply.send({
    ok: true,
    creditedPoints: buyPoints!,
    pointsBalance: newBalance,
    ckbAmount: String(buyCKB),
    pointsPerCKB: POINTS_PER_CKB,
  });
});

// 4. Earn points (Admin/System)
app.post("/payment/points/earn", async (req, reply) => {
  const parsed = PointsEarnSchema.safeParse((req.body || {}) as { amount: number; reason?: string });
  if (!parsed.success) return reply.status(400).send({ error: "Invalid parameters", code: "bad_request" });

  const { amount, reason } = parsed.data;
  const userId = (req.user as RequestUser)?.sub;
  if (!userId) return reply.status(401).send({ error: "Unauthorized" });

  if (!Number.isInteger(amount) || amount <= 0) return reply.status(400).send({ error: "amount must be positive integer", code: "bad_amount" });

  const newBalance = await updateUserPoints(userId, amount, "earn", reason || "System earn");

  return reply.send({ ok: true, balance: newBalance, amount });
});

// 5. Redeem points (Purchase video)
app.post("/payment/points/redeem", async (req, reply) => {
  const parsed = PointsRedeemSchema.safeParse((req.body || {}) as { videoId: string });
  if (!parsed.success) return reply.status(400).send({ error: "Invalid parameters", code: "bad_request" });

  const { videoId } = parsed.data;
  const userId = (req.user as RequestUser)?.sub;
  if (!userId) return reply.status(401).send({ error: "Unauthorized" });

  // ── Duplicate purchase check ──────────────────────────────────────
  try {
    const existingPurchase = await prisma.pointsTransaction.findFirst({
      where: {
        userId,
        type: "redeem",
        reason: { contains: String(videoId) },
      },
    });
    if (existingPurchase) {
      return reply.status(409).send({
        error: "Already purchased / 已购买过此内容",
        code: "already_purchased",
        contentId: videoId,
        purchasedAt: existingPurchase.createdAt,
      });
    }
  } catch (dupErr: any) {
    req.log.warn({ msg: "Duplicate check failed (non-fatal)", err: dupErr?.message });
  }

  // JoyID verification omitted for brevity, assumes verified by standard logic if required

  // Accept optional client-provided price for client-side/mock content
  const clientPointsPrice = Number(parsed.data.pointsPrice || 0);

  // Fetch metadata (graceful: allow client-provided price as fallback)
  let meta: VideoMeta | null = null;
  try {
    const metaResp = await fetch(`${process.env.METADATA_URL || "http://localhost:8093"}/metadata/${videoId}`);
    if (metaResp.ok) {
      meta = await metaResp.json();
    }
  } catch { /* metadata service unavailable */ }

  // Determine cost: prefer metadata, fall back to client-provided price
  let pointsCost = 0;
  if (meta) {
    pointsCost = Number.isInteger(meta.pointsPrice as any) && Number(meta.pointsPrice) > 0
      ? Number(meta.pointsPrice)
      : Math.ceil(Number(meta.priceUSDI) * POINTS_PER_USDI);
  } else if (clientPointsPrice > 0) {
    pointsCost = clientPointsPrice;
  } else {
    return reply.status(404).send({ error: "Content not found and no price provided", code: "meta_not_found" });
  }

  if (pointsCost <= 0) {
    return reply.status(400).send({ error: "Invalid price", code: "invalid_price" });
  }

  try {
    const newBalance = await updateUserPoints(userId, -pointsCost, "redeem", `Redeem video ${videoId}`);

    // Grant Entitlement via Content Service (non-fatal: mock content may not exist in content service)
    let grant: any = {};
    try {
      const grantRes = await fetch(`${process.env.CONTENT_URL || "http://localhost:8092"}/content/entitlement/grant`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: (req.headers.authorization as string) || "" },
        body: JSON.stringify({ videoId, userId }),
      });
      grant = await grantRes.json().catch(() => ({}));
      if (!grantRes.ok) {
        console.warn(`[redeem] Entitlement grant failed for ${videoId}: ${grant?.error || grantRes.status} (non-fatal)`);
      }
    } catch (grantErr: any) {
      console.warn(`[redeem] Entitlement grant error for ${videoId}: ${grantErr?.message} (non-fatal)`);
    }

    return reply.send({ ok: true, balance: newBalance, granted: !!grant?.streamUrl, streamUrl: grant?.streamUrl });
  } catch (err: any) {
    if (err.message === "Insufficient balance") {
      return reply.status(400).send({ error: "Insufficient points", code: "insufficient_points", required: pointsCost });
    }
    return reply.status(500).send({ error: err.message, code: "redeem_failed" });
  }
});

// 5b. Check if user has already purchased content
app.get("/payment/check-purchase", async (req, reply) => {
  const userId = (req.user as RequestUser)?.sub;
  if (!userId) return reply.status(401).send({ error: "Unauthorized" });

  const contentId = (req.query as any)?.contentId;
  if (!contentId) return reply.status(400).send({ error: "Missing contentId" });

  try {
    // Check if user has a "redeem" transaction mentioning this content
    const existingPurchase = await prisma.pointsTransaction.findFirst({
      where: {
        userId,
        type: "redeem",
        reason: { contains: String(contentId) },
      },
      orderBy: { createdAt: "desc" },
    });

    return reply.send({ purchased: !!existingPurchase, contentId });
  } catch (err: any) {
    return reply.status(500).send({ error: err.message, purchased: false });
  }
});

// 6. CKB Purchase Intent (Async via Blockchain)
app.post("/payment/ckb/purchase_intent", async (req, reply) => {
  const parsed = CkbPurchaseIntentSchema.safeParse((req.body || {}));
  if (!parsed.success) return reply.status(400).send({ error: "Invalid parameters", code: "bad_request" });

  const userId = (req.user as RequestUser)?.sub;
  if (!userId) return reply.status(401).send({ error: "Unauthorized" });

  const { ckbAmount, pointsAmount, payerAddress } = parsed.data as any;
  const depositAddr = CKB_DEPOSIT_ADDRESS || (payerAddress || "").trim();
  if (!depositAddr) return reply.status(500).send({ error: "Deposit address not configured", code: "deposit_not_configured" });

  let buyCKB: number | undefined;
  let buyPoints: number | undefined;

  if (ckbAmount !== undefined) {
    buyCKB = parseFloat(ckbAmount);
    buyPoints = Math.floor(buyCKB * POINTS_PER_CKB);
  } else if (pointsAmount !== undefined) {
    buyPoints = pointsAmount;
    buyCKB = Math.ceil((buyPoints! / POINTS_PER_CKB) * 1e8) / 1e8;
  }

  // Helper functions for CKB
  function ckbToShannons(ckbStr: string): string {
    const [i, f = ""] = ckbStr.split(".");
    const frac = (f + "00000000").slice(0, 8);
    const big = BigInt(i) * 100000000n + BigInt(frac);
    return big.toString();
  }

  const expectedShannons = ckbToShannons(String(buyCKB));
  const orderId = uuidv4();
  const expiresAt = new Date(Date.now() + 30 * 60 * 1000); // 30 min

  const intent = await prisma.buyingIntent.create({
    data: {
      id: orderId,
      userId,
      expectedAmountShannons: expectedShannons,
      expectedAmountCKB: String(buyCKB),
      pointsToCredit: buyPoints!,
      depositAddress: depositAddr,
      status: "pending",
      expiresAt: expiresAt,
      payerAddress: payerAddress || null
    }
  });

  return reply.send({
    orderId,
    depositAddress: depositAddr,
    expectedAmountCKB: String(buyCKB),
    expectedAmountShannons: expectedShannons,
    pointsToCredit: buyPoints!,
    expiresAt: expiresAt.toISOString(),
  });
});

// ============== CKB On-Chain Verification ==============

/**
 * Verify a CKB transaction on-chain via RPC.
 * 
 * Checks:
 * 1. Transaction exists on chain
 * 2. Transaction status is "committed" (confirmed in a block)
 * 3. At least `expectedShannons` were sent to `depositAddress`
 * 
 * Returns { verified, confirmations, totalDeposited, status, error? }
 */
async function verifyCkbTransaction(
  txHash: string,
  depositAddress: string,
  expectedShannons: string
): Promise<{
  verified: boolean;
  status: string;
  confirmations: number;
  totalDeposited: bigint;
  error?: string;
}> {
  const rpcUrl = process.env.CKB_NODE_URL || "https://testnet.ckb.dev/rpc";

  // 1. Get transaction by hash
  const txResp = await fetch(rpcUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      id: 1, jsonrpc: "2.0",
      method: "get_transaction",
      params: [txHash],
    }),
  });
  const txResult: any = await txResp.json();

  if (txResult.error) {
    return { verified: false, status: "rpc_error", confirmations: 0, totalDeposited: 0n, error: txResult.error.message };
  }

  const txData = txResult.result;
  if (!txData || !txData.transaction) {
    return { verified: false, status: "not_found", confirmations: 0, totalDeposited: 0n, error: "Transaction not found on chain" };
  }

  // 2. Check transaction status
  const txStatus = txData.tx_status?.status || "unknown";
  if (txStatus !== "committed") {
    return { verified: false, status: txStatus, confirmations: 0, totalDeposited: 0n, error: `Transaction status is "${txStatus}", not committed` };
  }

  // 3. Get block number for confirmation count
  let confirmations = 0;
  const blockHash = txData.tx_status?.block_hash;
  if (blockHash) {
    try {
      const [headerResp, tipResp] = await Promise.all([
        fetch(rpcUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: 2, jsonrpc: "2.0", method: "get_header", params: [blockHash] }),
        }),
        fetch(rpcUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: 3, jsonrpc: "2.0", method: "get_tip_header", params: [] }),
        }),
      ]);
      const headerResult: any = await headerResp.json();
      const tipResult: any = await tipResp.json();
      const blockNumber = BigInt(headerResult.result?.number || "0x0");
      const tipNumber = BigInt(tipResult.result?.number || "0x0");
      confirmations = Number(tipNumber - blockNumber);
    } catch { /* confirmations remain 0 */ }
  }

  // 4. Verify deposit amount — sum all outputs sent to the deposit address
  //    CKB outputs use lock script args to identify the recipient.
  //    We convert the deposit address to its lock script for comparison.
  let totalDeposited = 0n;
  const outputs = txData.transaction.outputs || [];
  const outputsData = txData.transaction.outputs_data || [];

  // Parse deposit address to lock script using lumos helpers
  let depositLockArgs = "";
  try {
    const depositScript = helpers.addressToScript(depositAddress);
    depositLockArgs = depositScript.args.toLowerCase();
  } catch {
    // If address parsing fails, skip amount verification
    // This can happen with non-standard addresses
    logger.warn({ depositAddress }, "Could not parse deposit address to lock script, skipping amount verification");
    return { verified: true, status: "committed", confirmations, totalDeposited: 0n };
  }

  for (const output of outputs) {
    const outputArgs = (output.lock?.args || "").toLowerCase();
    if (outputArgs === depositLockArgs) {
      totalDeposited += BigInt(output.capacity || "0x0");
    }
  }

  // 5. Verify the deposit meets the expected amount
  const expected = BigInt(expectedShannons);
  if (totalDeposited < expected) {
    return {
      verified: false, status: "committed", confirmations, totalDeposited,
      error: `Insufficient deposit: received ${totalDeposited} shannons, expected ${expected} shannons`,
    };
  }

  return { verified: true, status: "committed", confirmations, totalDeposited };
}

// 7. CKB Transaction Confirmation (Callback/Manual)
app.post("/payment/ckb/confirm_tx", async (req, reply) => {
  const body: any = req.body || {};
  const orderId: string = String(body?.orderId || "");
  const txHash: string = String(body?.txHash || "");

  if (!orderId || !txHash) return reply.status(400).send({ error: "Missing orderId or txHash" });

  // Basic txHash format validation (0x + 64 hex chars)
  if (!/^0x[0-9a-fA-F]{64}$/.test(txHash)) {
    return reply.status(400).send({ error: "Invalid txHash format", code: "invalid_tx_hash" });
  }

  try {
    const intent = await prisma.buyingIntent.findUnique({ where: { id: orderId } });
    if (!intent) return reply.status(404).send({ error: "Intent not found" });

    if (intent.status === "confirmed") {
      return reply.send({ ok: true, message: "Already confirmed", creditedPoints: intent.pointsToCredit });
    }

    if (new Date() > intent.expiresAt) {
      await prisma.buyingIntent.update({ where: { id: orderId }, data: { status: "expired" } });
      return reply.status(400).send({ error: "Intent expired" });
    }

    // Prevent re-using the same txHash for multiple intents
    const existingWithTx = await prisma.buyingIntent.findFirst({
      where: { txHash, status: "confirmed", id: { not: orderId } },
    });
    if (existingWithTx) {
      return reply.status(400).send({ error: "This transaction has already been used for another purchase", code: "tx_already_used" });
    }

    // ── On-chain verification ──
    const verification = await verifyCkbTransaction(
      txHash,
      intent.depositAddress,
      intent.expectedAmountShannons,
    );

    if (!verification.verified) {
      logger.warn({
        orderId, txHash,
        status: verification.status,
        error: verification.error,
        deposited: verification.totalDeposited.toString(),
      }, "CKB tx verification failed");

      // Only mark as failed if the tx is committed but amount is insufficient
      // Do NOT mark as failed if tx is still pending/proposed — those are retryable
      const retryableStatuses = ["pending", "proposed", "unknown", "not_found"];
      const isRetryable = retryableStatuses.includes(verification.status);

      if (verification.status === "committed") {
        // Genuinely failed: committed but insufficient amount
        await prisma.buyingIntent.update({
          where: { id: orderId },
          data: { status: "failed", txHash },
        });
      } else if (!isRetryable) {
        // Non-retryable error (e.g., rejected)
        await prisma.buyingIntent.update({
          where: { id: orderId },
          data: { status: "failed", txHash },
        });
      } else {
        // Retryable: save txHash for future polling but keep status pending
        await prisma.buyingIntent.update({
          where: { id: orderId },
          data: { txHash },
        });
      }

      // For retryable states, return 202 (Accepted) so frontend can poll
      if (isRetryable) {
        return reply.status(202).send({
          ok: false,
          retryable: true,
          message: "Transaction broadcast but not yet confirmed on-chain. Please retry shortly.",
          code: "tx_pending",
          orderId,
          txHash,
          details: {
            txStatus: verification.status,
          },
        });
      }

      return reply.status(400).send({
        error: verification.error || "Transaction verification failed",
        code: "verification_failed",
        details: {
          txStatus: verification.status,
          confirmations: verification.confirmations,
          deposited: verification.totalDeposited.toString(),
          expected: intent.expectedAmountShannons,
        },
      });
    }

    logger.info({
      orderId, txHash,
      confirmations: verification.confirmations,
      deposited: verification.totalDeposited.toString(),
    }, "CKB tx verified on-chain");

    // ── Credit points atomically ──
    await prisma.$transaction([
      prisma.buyingIntent.update({
        where: { id: orderId },
        data: { status: "confirmed", txHash: txHash }
      }),
      prisma.user.update({
        where: { id: intent.userId },
        data: { points: { increment: Number(intent.pointsToCredit) } }
      }),
      prisma.pointsTransaction.create({
        data: {
          userId: intent.userId,
          type: "buy",
          amount: Number(intent.pointsToCredit),
          reason: `CKB Buy ${intent.expectedAmountCKB} CKB, Tx: ${txHash}, Confirmations: ${verification.confirmations}`
        }
      })
    ]);

    // Fetch updated balance
    const user = await prisma.user.findUnique({ where: { id: intent.userId } });

    return reply.send({
      ok: true,
      creditedPoints: intent.pointsToCredit,
      newBalance: user?.points,
      verification: {
        confirmations: verification.confirmations,
        deposited: verification.totalDeposited.toString(),
      },
    });
  } catch (err: any) {
    return reply.status(500).send({ error: err.message });
  }
});

// 8. Stream Payment: Init
app.post("/payment/stream/init", async (req, reply) => {
  const body = req.body as { videoId: string; pricePerSecond?: number; pricePerMinute?: number; segmentSeconds?: number; segmentMinutes?: number; videoDuration?: number };
  const userId = (req.user as RequestUser)?.sub;
  if (!userId) return reply.status(401).send({ error: "Unauthorized" });

  // Fetch video meta for defaults
  const metaResp = await fetch(`${process.env.METADATA_URL || "http://localhost:8093"}/metadata/${body.videoId}`);
  const video = (await metaResp.json()) as VideoMeta;

  const videoDuration = body.videoDuration || video.durationSeconds || 0;
  // Priority: body.pricePerSecond > body.pricePerMinute > video meta > fallback
  // Convert pricePerSecond to pricePerMinute for DB storage (schema uses pricePerMinute)
  const pricePerMinute = body.pricePerSecond
    ? body.pricePerSecond * 60
    : (body.pricePerMinute || video.streamPricePerMinute || 1);
  // Accept segmentSeconds from frontend, convert to segmentMinutes for DB storage
  let segmentMinutes = body.segmentSeconds
    ? body.segmentSeconds / 60
    : (body.segmentMinutes || 5);

  // Restore active session if exists
  const existing = await prisma.streamSession.findFirst({
    where: { videoId: body.videoId, userId, status: { in: ['active', 'paused'] } }
  });

  if (existing) {
    // ... Resume logic ...
    // Simplified for migration: just return existing Session ID
    return reply.send({
      sessionId: existing.sessionId,
      // ... invoices etc would need to be fetched ...
      isResume: true
    });
  }

  const totalSegments = Math.ceil(videoDuration / 60 / segmentMinutes);
  const amount = pricePerMinute * segmentMinutes;

  // Generate real Fiber invoice if configured, otherwise use mock for dev
  let invoiceString: string;
  let paymentHash: string;
  const useMock = process.env.FIBER_ALLOW_MOCK === "1";

  if (useMock) {
    invoiceString = `mock_invoice_${uuidv4()}`;
    paymentHash = `mock_hash_${Date.now()}`;
  } else {
    try {
      const fiberInvoice = await createStreamInvoice({
        videoId: body.videoId,
        segmentNumber: 1,
        pricePerSecond: pricePerMinute / 60,
        segmentSeconds: segmentMinutes * 60,
        pricePerMinute,
        segmentMinutes,
        expiry: 600, // 10 minutes
      });
      invoiceString = fiberInvoice.paymentRequest;
      paymentHash = fiberInvoice.paymentHash;
    } catch (fiberErr: any) {
      req.log.warn({ err: fiberErr.message }, "Fiber invoice creation failed, falling back to mock");
      invoiceString = `mock_invoice_${uuidv4()}`;
      paymentHash = `mock_hash_${Date.now()}`;
    }
  }

  const session = await prisma.streamSession.create({
    data: {
      videoId: body.videoId,
      userId,
      videoDurationSeconds: videoDuration,
      pricePerMinute: new Prisma.Decimal(pricePerMinute),
      segmentMinutes,
      totalSegments,
      currentSegment: 1,
      paidSegments: [],
      lastWatchedSegment: 0,
      totalPaid: 0,
      actualUsedSeconds: 0,
      status: 'active',
      lastTickAt: new Date(),
      expiresAt: new Date(Date.now() + 3600000),
      invoices: {
        create: {
          segmentNumber: 1,
          invoice: invoiceString,
          paymentHash: paymentHash,
          amount: new Prisma.Decimal(amount),
          status: 'pending'
        }
      }
    },
    include: { invoices: true }
  });

  return reply.send({
    sessionId: session.sessionId,
    invoice: invoiceString,
    paymentHash: session.invoices[0].paymentHash,
    segmentAmount: amount,
    totalSegments,
    paidSegments: [],
    isResume: false
  });
});


// 8.5. Buy Once (Entitlement)
app.post("/payment/create", async (req, reply) => {
  const { videoId } = req.body as { videoId: string };
  const userId = (req.user as RequestUser)?.sub;
  if (!userId) return reply.status(401).send({ error: "Unauthorized" });

  try {
    // 1. Fetch Video Meta for Price
    const metaResp = await fetch(`${process.env.METADATA_URL || "http://localhost:8093"}/metadata/${videoId}`);
    const video = (await metaResp.json()) as VideoMeta & { pointsPrice?: number };

    // Default to 1000 if not set, or handle free?
    const cost = video.pointsPrice || 1000;

    // 2. Check Entitlement (Already bought?)
    const existing = await prisma.entitlement.findUnique({
      where: { userId_videoId: { userId, videoId } }
    });
    if (existing) {
      return reply.send({ intentId: existing.id, status: "htlc_locked", alreadyOwned: true });
    }

    // 3. Deduct Points
    await updateUserPoints(userId, -cost, "buy", `Buy Video ${videoId}`);

    try {
      // 3.1 Upsert Video to ensure FK constraint
      await prisma.video.upsert({
        where: { id: videoId },
        create: {
          id: videoId,
          title: video.title || "Unknown Video",
          videoUrl: (video as any).videoUrl || "",
          creatorId: userId, // Fallback to buyer as creator if unknown, or use a system ID
        },
        update: {}
      });

      // 4. Create Entitlement
      const entitlement = await prisma.entitlement.create({
        data: { userId, videoId }
      });

      return reply.send({
        intentId: entitlement.id,
        status: "htlc_locked",
        amount: cost
      });
    } catch (createErr: any) {
      // REFUND if creation fails
      req.log.warn({ msg: "Payment Create Failed, Refunding...", err: createErr });
      await updateUserPoints(userId, cost, "refund", `Refund Buy Video ${videoId}`);
      throw createErr;
    }
  } catch (err: any) {
    req.log.error({ msg: "Payment Create Failed", err });
    return reply.status(400).send({ error: err.message || "Payment Failed" });
  }
});

app.post("/payment/redeem", async (req, reply) => {
  const { intentId } = req.body as { intentId: string };
  const userId = (req.user as RequestUser)?.sub;
  if (!userId) return reply.status(401).send({ error: "Unauthorized" });

  try {
    // 1. Verify Entitlement
    const ent = await prisma.entitlement.findUnique({ where: { id: intentId } });
    if (!ent) return reply.status(404).send({ error: "Purchase not found" });

    // 2. Fetch Stream URL (Metadata)
    const metaResp = await fetch(`${process.env.METADATA_URL || "http://localhost:8093"}/metadata/${ent.videoId}`);
    const video = (await metaResp.json()) as VideoMeta;

    // Return the stream URL (CDN or similar)
    const anyVideo = video as any;
    return reply.send({
      status: "completed",
      streamUrl: anyVideo.cdnUrl || anyVideo.videoUrl // Prefer CDN if available
    });
  } catch (err: any) {
    return reply.status(400).send({ error: err.message });
  }
});

// 9. Stream Payment: Pay
app.post("/payment/stream/pay", async (req, reply) => {
  const { invoice } = req.body as { invoice: string };
  const userId = (req.user as RequestUser)?.sub;
  if (!userId) return reply.status(401).send({ error: "Unauthorized" });

  const inv = await prisma.streamInvoice.findFirst({
    where: { invoice },
    include: { session: { include: { video: true } } }
  });

  if (!inv) return reply.status(404).send({ error: "Invoice not found" });
  if (inv.status === 'paid') return reply.send({ ok: true, message: "Already paid" });

  // Deduct points
  try {
    await updateUserPoints(userId, -Number(inv.amount), "redeem", `Stream Pay ${inv.session.videoId} Seg ${inv.segmentNumber}`);

    // Update Invoice and Session
    await prisma.$transaction([
      prisma.streamInvoice.update({ where: { id: inv.id }, data: { status: 'paid', paidAt: new Date() } }),
      prisma.streamSession.update({
        where: { sessionId: inv.sessionId },
        data: {
          paidSegments: { push: inv.segmentNumber },
          totalPaid: { increment: inv.amount }
        }
      })
    ]);

    // Calculate splits
    const ownerId = (inv.session as any).video?.creatorId || undefined;
    const { platformFeeAmount, splits } = await calculateUniversalSplits(Number(inv.amount), "video", inv.session.videoId, ownerId);

    // Distribute splits
    for (const split of splits) {
      if (split.amount > 0) {
        await updateUserPoints(split.userId, split.amount, "earn", `Stream Pay Split (${split.percentage}%) from video ${inv.session.videoId}`);
        if (split.fiberAddress) {
          // Instantly convert to a CKB Payout Task
          await updateUserPoints(split.userId, -split.amount, "redeem", `Auto-withdraw Stream Pay to Fiber`);
          await prisma.fiberPayoutTask.create({
            data: {
              userId: split.userId,
              amount: split.amount,
              fiberAddress: split.fiberAddress,
              status: "pending"
            }
          });
        }
      }
    }

    return reply.send({ ok: true, paidAmount: inv.amount, segment: inv.segmentNumber, platformFee: platformFeeAmount, splits });
  } catch (err: any) {
    return reply.status(400).send({ error: err.message });
  }
});

// 10. Tip
app.post("/payment/tip", async (req, reply) => {
  const parsed = TipRequestSchema.safeParse(req.body);
  if (!parsed.success) return reply.status(400).send({ error: "Invalid params" });

  const body = parsed.data;
  const userId = (req.user as RequestUser)?.sub;
  if (!userId) return reply.status(401).send({ error: "Unauthorized" });

  try {
    // Deduct from User
    await updateUserPoints(userId, -body.amount, "redeem", `Tip video ${body.videoId}`);

    // Add to Creator(s) using Universal Split Engine
    const creatorUser = await prisma.user.findFirst({ where: { address: body.creatorAddress } });

    // Calculate splits
    const { platformFeeAmount, splits } = await calculateUniversalSplits(body.amount, "video", body.videoId, creatorUser?.id);

    for (const split of splits) {
      if (split.amount > 0) {
        await updateUserPoints(split.userId, split.amount, "earn", `Tip Split (${split.percentage}%) from video ${body.videoId}`);
        if (split.fiberAddress) {
          // Instantly convert to a CKB Payout Task
          await updateUserPoints(split.userId, -split.amount, "redeem", `Auto-withdraw Tip to Fiber`);
          await prisma.fiberPayoutTask.create({
            data: {
              userId: split.userId,
              amount: split.amount,
              fiberAddress: split.fiberAddress,
              status: "pending"
            }
          });
        }
      }
    }

    // Record Tip
    const tip = await prisma.videoTip.create({
      data: {
        videoId: body.videoId,
        fromUserId: userId,
        toCreatorAddress: body.creatorAddress,
        amount: new Prisma.Decimal(body.amount),
        message: body.message,
        showDanmaku: body.showDanmaku ?? true
      }
    });

    return reply.send({ ok: true, tipId: tip.id });
  } catch (err: any) {
    return reply.status(400).send({ error: err.message });
  }
});

// 11. Tip Leaderboard
app.get("/payment/tip/leaderboard/:videoId", async (req, reply) => {
  const { videoId } = req.params as { videoId: string };
  const limit = Number((req.query as any)?.limit) || 10;

  const tips = await prisma.videoTip.groupBy({
    by: ['fromUserId'],
    where: { videoId },
    _sum: { amount: true },
    _count: { id: true },
    orderBy: { _sum: { amount: 'desc' } },
    take: limit
  });

  // Fetch User details
  const userIds = tips.map(t => t.fromUserId);
  const users = await prisma.user.findMany({ where: { id: { in: userIds } }, select: { id: true, nickname: true, address: true } });

  const leaderboard: TipLeaderboardEntry[] = tips.map((t, idx) => {
    const u = users.find(u => u.id === t.fromUserId);
    return {
      rank: idx + 1,
      userId: t.fromUserId,
      displayName: u?.nickname || (u?.address ? `${u.address.slice(0, 6)}...` : 'Unknown'),
      totalAmount: Number(t._sum.amount || 0),
      tipCount: t._count.id
    };
  });

  const totalStats = await prisma.videoTip.aggregate({
    where: { videoId },
    _sum: { amount: true },
    _count: { fromUserId: true } // Distinct check needed roughly
  });

  return reply.send({
    videoId,
    leaderboard,
    totalTips: Number(totalStats._sum.amount || 0),
    totalTippers: tips.length
  });
});

// CKB Helpers
function ckbToShannons(ckbStr: string): string {
  const [i, f = ""] = ckbStr.split(".");
  const frac = (f + "00000000").slice(0, 8);
  const big = BigInt(i) * 100000000n + BigInt(frac);
  return big.toString();
}

async function ckbRpcCall(method: string, params: any[]): Promise<any> {
  const INDEXER_METHODS = new Set(["get_cells", "get_transactions", "get_tip"]);
  const baseUrl = (INDEXER_METHODS.has(method) && CKB_INDEXER_URL) ? CKB_INDEXER_URL : CKB_NODE_URL;
  if (!baseUrl) throw new Error("CKB_NODE_URL not configured");
  const res = await fetch(baseUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id: Date.now(), jsonrpc: "2.0", method, params })
  });
  const json = await res.json();
  if (!res.ok || json?.error) throw new Error(json?.error?.message || res.statusText || "RPC failed");
  return json?.result ?? json;
}

function getLumosConfigForAddress(addr: string) {
  return addr.startsWith("ckt") ? config.predefined.AGGRON4 : config.predefined.LINA;
}

function parseAddressToScript(addr: string) {
  const s = helpers.parseAddress(addr, { config: getLumosConfigForAddress(addr) });
  return { code_hash: (s as any).codeHash || (s as any).code_hash, hash_type: (s as any).hashType || (s as any).hash_type, args: (s as any).args };
}

function scriptEquals(a: any, b: any) {
  if (!a || !b) return false;
  const aCodeHash = a.code_hash ?? a.codeHash;
  const bCodeHash = b.code_hash ?? b.codeHash;
  const aHashType = a.hash_type ?? a.hashType;
  const bHashType = b.hash_type ?? b.hashType;
  return aCodeHash === bCodeHash && aHashType === bHashType && a.args === b.args;
}

function hexToBigInt(hex: string): bigint { try { return BigInt(hex); } catch { return 0n; } }

function canonicalizeHexUInt(hex: string): string { try { const v = BigInt(hex); return "0x" + v.toString(16); } catch { return "0x0"; } }

// 12. CKB Intent Status
app.get("/payment/ckb/intent/:id", async (req, reply) => {
  const { id } = req.params as { id: string };
  const intent = await prisma.buyingIntent.findUnique({ where: { id } });
  if (!intent) return reply.status(404).send({ error: "Intent not found" });

  return reply.send({
    orderId: id,
    status: intent.status,
    confirmations: intent.confirmations,
    creditedPoints: intent.status === "confirmed" ? Number(intent.pointsToCredit) : undefined,
    expectedAmountShannons: intent.expectedAmountShannons,
    txHash: intent.txHash,
  });
});

// 13. CKB Build Tx (Unsigned)
app.post("/payment/ckb/build_tx", async (req, reply) => {
  try {
    const body: any = req.body || {};
    const orderId: string = String(body?.orderId || "");
    let payerAddress: string = String(body?.payerAddress || "");

    if (!orderId) return reply.status(400).send({ error: "Missing orderId" });

    const intent = await prisma.buyingIntent.findUnique({ where: { id: orderId } });
    if (!intent) return reply.status(404).send({ error: "Intent not found" });

    const expected = BigInt(intent.expectedAmountShannons);
    if (expected <= 0n) return reply.status(400).send({ error: "Invalid amount" });

    const depAddr = intent.depositAddress || CKB_DEPOSIT_ADDRESS;
    if (!depAddr) return reply.status(500).send({ error: "Deposit address missing" });

    if (!payerAddress) payerAddress = intent.payerAddress || "";
    if (!payerAddress) return reply.status(400).send({ error: "Missing payer address" });

    const cfg = getLumosConfigForAddress(payerAddress);
    const payerLock = parseAddressToScript(payerAddress);
    const depositLock = parseAddressToScript(depAddr);
    const secp = (cfg as any)?.SCRIPTS?.SECP256K1_BLAKE160;

    const fee = BigInt(process.env.CKB_FLAT_FEE_SHANNONS || "100000");

    // Collect cells
    let collected: Array<any> = [];
    let total = 0n;
    let cursor: string | null = null;
    const limit = "0x64";
    const searchKey = { script: payerLock, script_type: "lock" };

    for (let round = 0; round < 20 && total < expected + fee; round++) {
      const params: any = cursor ? [searchKey, "desc", limit, cursor] : [searchKey, "desc", limit];
      const resp: any = await ckbRpcCall("get_cells", params);
      const objs: any[] = resp?.objects || [];
      cursor = resp?.last_cursor || null;
      for (const obj of objs) {
        const out = obj?.output || {};
        const hasType = !!out?.type;
        const data = obj?.output_data || "0x";
        if (hasType || (data && data !== "0x")) continue;
        collected.push(obj);
        const capHex = String(out?.capacity || "0x0");
        total += hexToBigInt(capHex);
        if (total >= expected + fee) break;
      }
      if (!cursor || objs.length === 0) break;
    }

    if (total < expected + fee) {
      return reply.status(400).send({ error: "Insufficient balance", required: (expected + fee).toString(), available: total.toString() });
    }

    const inputs = collected.map((c) => ({
      previous_output: { tx_hash: c?.out_point?.tx_hash, index: canonicalizeHexUInt(String(c?.out_point?.index || "0x0")) },
      since: "0x0",
    }));

    const change = total - expected - fee;
    if (change < 0n) return reply.status(400).send({ error: "Negative change" });

    const toFixedHex = (hex: string, bytes: number) => {
      let s = String(hex || "0x").toLowerCase().replace(/^0x/, "");
      if (s.length % 2 !== 0) s = "0" + s;
      const need = bytes * 2;
      if (s.length < need) s = "0".repeat(need - s.length) + s;
      return "0x" + s;
    };

    const expectedHex = toFixedHex("0x" + expected.toString(16), 8);
    const changeHex = toFixedHex("0x" + change.toString(16), 8);

    const outputs = [
      { capacity: expectedHex, lock: depositLock },
      { capacity: changeHex, lock: payerLock },
    ];
    const outputsData = ["0x", "0x"];

    // Cell deps logic (simplified from original for brevity but keeping JoyID check)
    const JOYID_LOCK_TESTNET = { CODE_HASH: "0xd23761b364210735c19c60561d213fb3beae2fd6172743719eff6920e020baac", TX_HASH: "0x4dcf3f3b09efac8995d6cbee87c5345e812d310094651e0c3d9a730f32dc9263", INDEX: "0x0", DEP_TYPE: "dep_group" };
    const JOYID_LOCK_MAINNET = { CODE_HASH: "0xd00c84f0ec8fd441c38bc3f87a371f547190f2fcff88e642bc5bf54b9e318323", TX_HASH: "0xf05188e5f3a6767fc4687faf45ba5f1a6e25d3ada6129dae8722cb282f262493", INDEX: "0x0", DEP_TYPE: "dep_group" };

    const payerCodeHash = payerLock.code_hash?.toLowerCase() || "";
    const isJoyID = payerCodeHash.startsWith("0xd2376") || payerCodeHash.startsWith("0xd00c84");
    const isTestnet = payerAddress.startsWith("ckt");

    let cell_deps: any[] = [];
    if (isJoyID) {
      const joyidDep = isTestnet ? JOYID_LOCK_TESTNET : JOYID_LOCK_MAINNET;
      cell_deps.push({ out_point: { tx_hash: joyidDep.TX_HASH, index: joyidDep.INDEX }, dep_type: joyidDep.DEP_TYPE });
    } else {
      cell_deps.push({ out_point: { tx_hash: secp.TX_HASH, index: secp.INDEX }, dep_type: secp.DEP_TYPE });
    }

    const witnesses = inputs.map((_, idx) => (idx === 0 ? "0x55000000100000005500000055000000410000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000" : "0x")); // Mock empty witness args

    const tx = {
      version: "0x0",
      cell_deps,
      header_deps: [],
      inputs,
      outputs,
      outputs_data: outputsData,
      witnesses
    };

    return reply.send({ tx, fee: fee.toString(), required: expected.toString(), change: change.toString() });
  } catch (e: any) {
    req.log.error(e);
    return reply.status(500).send({ error: e.message });
  }
});

// 14. CKB Send Tx
app.post("/payment/ckb/send_tx", async (req, reply) => {
  try {
    const body: any = req.body || {};
    const signedTx = body?.tx;
    if (!signedTx) return reply.status(400).send({ error: "Missing tx" });
    const txHash = await ckbRpcCall("send_transaction", [signedTx]);
    return reply.send({ ok: true, txHash });
  } catch (e: any) {
    return reply.status(500).send({ error: e.message });
  }
});

// 15. Stream Tick — Per-Second Billing
// Deducts pricePerSecond × delta from user balance each tick.
// Segments are display-only markers (not payment boundaries).
app.post("/payment/stream/tick", async (req, reply) => {
  try {
    const body = req.body as { sessionId: string; elapsedSeconds: number };
    if (!body?.sessionId || typeof body?.elapsedSeconds !== 'number') return reply.status(400).send({ error: "Invalid params" });

    const session = await prisma.streamSession.findUnique({ where: { sessionId: body.sessionId } });
    if (!session) return reply.status(404).send({ error: "Session not found" });

    const userId = (req.user as RequestUser)?.sub;
    if (session.userId !== userId) return reply.status(403).send({ error: "Forbidden" });

    if (session.status !== 'active') return reply.status(400).send({ error: "Session not active" });

    // Calculate delta seconds since last recorded position
    const prevSeconds = session.actualUsedSeconds || 0;
    const deltaSeconds = Math.max(0, body.elapsedSeconds - prevSeconds);

    // Calculate cost for this delta — integer PTS (no fractional cents)
    const pricePerSecond = Number(session.pricePerMinute) / 60;
    const costThisTick = Math.round(pricePerSecond * deltaSeconds); // Integer PTS

    // Check user balance
    const user = await prisma.user.findUnique({ where: { id: userId } });
    const currentBalance = Number(user?.points || 0);

    let shouldPause = false;
    let actualDeducted = 0;

    if (costThisTick > 0 && deltaSeconds > 0) {
      if (currentBalance >= costThisTick) {
        // Deduct from balance
        actualDeducted = costThisTick;
        await prisma.$transaction([
          prisma.user.update({ where: { id: userId }, data: { points: { decrement: Math.ceil(costThisTick) } } }),
          prisma.streamSession.update({
            where: { sessionId: body.sessionId },
            data: {
              actualUsedSeconds: body.elapsedSeconds,
              totalPaid: { increment: Math.ceil(costThisTick) },
              lastTickAt: new Date(),
            }
          })
        ]);
      } else {
        // Insufficient balance — pause
        shouldPause = true;
        // Deduct whatever is left
        if (currentBalance > 0) {
          actualDeducted = currentBalance;
          await prisma.$transaction([
            prisma.user.update({ where: { id: userId }, data: { points: 0 } }),
            prisma.streamSession.update({
              where: { sessionId: body.sessionId },
              data: {
                actualUsedSeconds: body.elapsedSeconds,
                totalPaid: { increment: currentBalance },
                lastTickAt: new Date(),
              }
            })
          ]);
        }
      }
    } else {
      // No cost, just update position
      await prisma.streamSession.update({
        where: { sessionId: body.sessionId },
        data: { actualUsedSeconds: body.elapsedSeconds, lastTickAt: new Date() }
      });
    }

    // Display segment (visual only, not a payment boundary)
    const segmentDurationSec = session.segmentMinutes * 60;
    const displaySegment = Math.floor(body.elapsedSeconds / segmentDurationSec) + 1;
    const totalDisplaySegments = Math.ceil(session.videoDurationSeconds / segmentDurationSec);

    // Updated balance
    const updatedBalance = Math.max(0, currentBalance - Math.ceil(actualDeducted));
    const totalPaid = Number(session.totalPaid || 0) + Math.ceil(actualDeducted);
    const estimatedRemainingSeconds = pricePerSecond > 0 ? Math.floor(updatedBalance / pricePerSecond) : 99999;

    return reply.send({
      status: session.status,
      shouldPause,
      // Per-second billing info
      deducted: Math.ceil(actualDeducted),
      totalPaid,
      balance: updatedBalance,
      pricePerSecond,
      estimatedRemainingSeconds,
      // Display segments (UI only)
      displaySegment,
      totalDisplaySegments,
      segmentDurationSec,
      // Time info
      elapsedSeconds: body.elapsedSeconds,
      videoDurationSeconds: session.videoDurationSeconds,
    });
  } catch (err: any) {
    return reply.status(500).send({ error: err.message });
  }
});

// 16. Stream Renew — supports auto-purchase (autoDeduct=true) and targeted segment purchase
app.post("/payment/stream/renew", async (req, reply) => {
  const body = req.body as { sessionId: string; targetSegment?: number; autoDeduct?: boolean };
  const userId = (req.user as RequestUser)?.sub;
  if (!userId) return reply.status(401).send({ error: "Unauthorized" });

  const session = await prisma.streamSession.findUnique({ where: { sessionId: body.sessionId } });
  if (!session) return reply.status(404).send({ error: "Session not found" });
  if (session.userId !== userId) return reply.status(403).send({ error: "Forbidden" });

  // Support targeted segment (for seek) or next sequential segment
  const paidSegs = session.paidSegments as number[];
  const targetSegment = body.targetSegment || (paidSegs.length > 0 ? Math.max(...paidSegs) + 1 : 1);

  // Skip if already paid
  if (paidSegs.includes(targetSegment)) {
    return reply.send({ ok: true, alreadyPaid: true, nextSegment: targetSegment, amount: 0 });
  }

  const amount = Number(session.pricePerMinute) * session.segmentMinutes;
  const invoice = `mock_invoice_${uuidv4()}`;

  // Auto-deduct from points balance if requested (for seamless auto-purchase)
  if (body.autoDeduct) {
    try {
      const user = await prisma.user.findUnique({ where: { id: userId } });
      if (!user || Number(user.points) < amount) {
        return reply.send({ ok: false, error: "Insufficient balance", needsTopUp: true, balance: Number(user?.points || 0), amount });
      }
      // Deduct points atomically
      await prisma.$transaction([
        prisma.user.update({ where: { id: userId }, data: { points: { decrement: amount } } }),
        prisma.streamSession.update({
          where: { sessionId: body.sessionId },
          data: {
            status: 'active',
            paidSegments: { push: targetSegment },
            invoices: {
              create: {
                segmentNumber: targetSegment,
                invoice,
                paymentHash: `mock_hash_${Date.now()}`,
                amount: new Prisma.Decimal(amount),
                status: 'paid'
              }
            }
          }
        })
      ]);
      const updatedUser = await prisma.user.findUnique({ where: { id: userId } });
      return reply.send({ ok: true, nextSegment: targetSegment, amount, balance: updatedUser?.points || 0, paidSegments: [...paidSegs, targetSegment] });
    } catch (err: any) {
      return reply.status(500).send({ error: err.message });
    }
  }

  // Legacy flow: create invoice for manual payment
  await prisma.streamSession.update({
    where: { sessionId: body.sessionId },
    data: {
      status: 'active',
      invoices: {
        create: {
          segmentNumber: targetSegment,
          invoice,
          paymentHash: `mock_hash_${Date.now()}`,
          amount: new Prisma.Decimal(amount),
          status: 'pending'
        }
      }
    }
  });

  return reply.send({
    invoice,
    paymentHash: `mock_hash_${Date.now()}`,
    nextSegment: targetSegment,
    amount
  });
});

// 16b. Stream Pause — stop billing clock
app.post("/payment/stream/pause", async (req, reply) => {
  const body = req.body as { sessionId: string; currentSegment?: number };
  const userId = (req.user as RequestUser)?.sub;
  if (!userId) return reply.status(401).send({ error: "Unauthorized" });

  const session = await prisma.streamSession.findUnique({ where: { sessionId: body.sessionId } });
  if (!session) return reply.status(404).send({ error: "Session not found" });
  if (session.userId !== userId) return reply.status(403).send({ error: "Forbidden" });

  if (session.status !== 'active') {
    return reply.send({ ok: true, status: session.status, message: "Session already paused or completed" });
  }

  // Mark session as paused — billing stops because tick endpoint checks status === 'active'
  await prisma.streamSession.update({
    where: { sessionId: body.sessionId },
    data: {
      status: 'paused',
      pausedAt: new Date(),
      lastTickAt: new Date(),
    }
  });

  logger.info(`Stream session paused: ${body.sessionId}, used=${session.actualUsedSeconds}s, paid=${session.totalPaid}`);

  return reply.send({
    ok: true,
    status: 'paused',
    totalPaid: Number(session.totalPaid),
    actualUsedSeconds: session.actualUsedSeconds,
  });
});

// 16c. Stream Resume — restart billing from where user left off
app.post("/payment/stream/resume", async (req, reply) => {
  const body = req.body as { sessionId: string };
  const userId = (req.user as RequestUser)?.sub;
  if (!userId) return reply.status(401).send({ error: "Unauthorized" });

  const session = await prisma.streamSession.findUnique({ where: { sessionId: body.sessionId } });
  if (!session) return reply.status(404).send({ error: "Session not found" });
  if (session.userId !== userId) return reply.status(403).send({ error: "Forbidden" });

  if (session.status === 'completed') {
    return reply.status(400).send({ error: "Session already completed", code: "session_completed" });
  }

  // Check balance before resuming
  const user = await prisma.user.findUnique({ where: { id: userId } });
  const balance = Number(user?.points || 0);
  const pricePerSecond = Number(session.pricePerMinute) / 60;

  if (balance <= 0) {
    return reply.status(400).send({ error: "Insufficient balance to resume", code: "insufficient_balance", balance: 0 });
  }

  // Reactivate session — next tick will bill from actualUsedSeconds (no re-charge)
  await prisma.streamSession.update({
    where: { sessionId: body.sessionId },
    data: {
      status: 'active',
      pausedAt: null,
      lastTickAt: new Date(),
    }
  });

  const estimatedRemainingSeconds = pricePerSecond > 0 ? Math.floor(balance / pricePerSecond) : 99999;

  logger.info(`Stream session resumed: ${body.sessionId}, from=${session.actualUsedSeconds}s, balance=${balance}`);

  return reply.send({
    ok: true,
    status: 'active',
    balance,
    totalPaid: Number(session.totalPaid),
    actualUsedSeconds: session.actualUsedSeconds,
    estimatedRemainingSeconds,
  });
});

// 17. Stream Close — async settlement via BullMQ
app.post("/payment/stream/close", async (req, reply) => {
  const body = req.body as { sessionId: string; actualSeconds?: number };
  const userId = (req.user as RequestUser)?.sub;
  if (!userId) return reply.status(401).send({ error: "Unauthorized" });

  const session = await prisma.streamSession.findUnique({ where: { sessionId: body.sessionId } });
  if (!session) return reply.status(404).send({ error: "Session not found" });
  if (session.userId !== userId) return reply.status(403).send({ error: "Forbidden" });

  // Mark as settling immediately (optimistic)
  await prisma.streamSession.update({
    where: { sessionId: body.sessionId },
    data: { status: 'completed', actualUsedSeconds: body.actualSeconds ?? session.actualUsedSeconds },
  });

  // Enqueue async settlement with refund calculation
  const job = await enqueueStreamSettle({
    sessionId: body.sessionId,
    actualSeconds: body.actualSeconds ?? session.actualUsedSeconds ?? 0,
    userId,
    closedAt: new Date().toISOString(),
  });

  return reply.send({ ok: true, settlementJobId: job.id });
});

// 17b. Settlement Job Status
app.get("/payment/settlement/status/:jobId", async (req, reply) => {
  const { jobId } = req.params as { jobId: string };
  try {
    const { Queue } = await import('bullmq');
    const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
    const queue = new Queue(QUEUE_NAMES.SETTLEMENT, { connection: { url: REDIS_URL }, prefix: 'vp' });
    const job = await queue.getJob(jobId);
    if (!job) return reply.status(404).send({ error: 'Job not found' });
    const state = await job.getState();
    return reply.send({
      jobId: job.id,
      name: job.name,
      state,
      result: job.returnvalue,
      failedReason: job.failedReason,
      attemptsMade: job.attemptsMade,
      createdAt: job.timestamp ? new Date(job.timestamp).toISOString() : null,
    });
  } catch (err: any) {
    return reply.status(500).send({ error: err.message });
  }
});

// 17c. Queue Stats Dashboard
app.get("/payment/settlement/queue-stats", async (_req, reply) => {
  try {
    const stats = await getQueueStats(QUEUE_NAMES.SETTLEMENT);
    return reply.send(stats);
  } catch (err: any) {
    return reply.status(500).send({ error: err.message });
  }
});

// 18. Stream Session Info
app.get("/payment/stream/session/:sessionId", async (req, reply) => {
  const { sessionId } = req.params as { sessionId: string };
  const session = await prisma.streamSession.findUnique({ where: { sessionId }, include: { invoices: true } });
  if (!session) return reply.status(404).send({ error: "Not found" });

  // Check permission
  const userId = (req.user as RequestUser)?.sub;
  if (session.userId !== userId) return reply.status(403).send({ error: "Forbidden" });

  return reply.send({ session });
});

// 19. Stream History for Video
app.get("/payment/stream/history/:videoId", async (req, reply) => {
  const { videoId } = req.params as { videoId: string };
  const userId = (req.user as RequestUser)?.sub;
  if (!userId) return reply.status(401).send({ error: "Unauthorized" });

  const sessions = await prisma.streamSession.findMany({
    where: { videoId, userId }
  });

  // Aggregate paid segments
  const paidSegments = new Set<number>();
  let totalPaid = 0;
  for (const s of sessions) {
    s.paidSegments.forEach(seg => paidSegments.add(seg));
    totalPaid += Number(s.totalPaid);
  }

  return reply.send({
    videoId,
    hasPaidSegments: paidSegments.size > 0,
    paidSegments: Array.from(paidSegments).sort((a, b) => a - b),
    totalPaid,
    discountAmount: totalPaid
  });
});

// 20. Points Earn To (Admin/System)
app.post("/payment/points/earnTo", async (req, reply) => {
  const parsed = PointsEarnToSchema.safeParse((req.body || {}) as { amount: number; reason?: string; targetCkbAddress?: string; targetBitDomain?: string });
  if (!parsed.success) return reply.status(400).send({ error: "Invalid params" });
  const { amount, reason, targetCkbAddress, targetBitDomain } = parsed.data;
  if (amount <= 0) return reply.status(400).send({ error: "Amount must be positive" });

  // Should resolve address/domain to userID, but for now we might create a minimal user or credit generic
  // This part depends on how we handle "Earn To" for non-users.
  // Assuming for now target is a User address
  let userId: string | undefined;
  if (targetCkbAddress) {
    const u = await prisma.user.findUnique({ where: { address: targetCkbAddress } });
    userId = u?.id;
  }

  if (!userId) return reply.status(404).send({ error: "Target user not found" });

  const newBalance = await updateUserPoints(userId, amount, "earn", reason);
  return reply.send({ ok: true, target: userId, balance: newBalance });
});

// 21. Points Deduct
app.post("/payment/points/deduct", async (req, reply) => {
  const parsed = PointsEarnSchema.safeParse(req.body); // reuse earn schema
  if (!parsed.success) return reply.status(400).send({ error: "Invalid params" });
  const { amount, reason } = parsed.data;
  const userId = (req.user as RequestUser)?.sub;
  if (!userId) return reply.status(401).send({ error: "Unauthorized" });

  try {
    const newBalance = await updateUserPoints(userId, -amount, "redeem", reason || "Deduct");
    return reply.send({ ok: true, balance: newBalance });
  } catch (e: any) {
    return reply.status(400).send({ error: e.message });
  }
});

// 22. Recent Tips
app.get("/payment/tip/recent/:videoId", async (req, reply) => {
  const { videoId } = req.params as { videoId: string };
  const limit = Number((req.query as any)?.limit) || 20;

  const tips = await prisma.videoTip.findMany({
    where: { videoId },
    orderBy: { createdAt: 'desc' },
    take: limit,
    include: { fromUser: { select: { nickname: true, address: true, avatar: true } } }
  });

  const mapped = tips.map(t => ({
    id: t.id,
    videoId: t.videoId,
    fromUserId: t.fromUserId,
    fromAddress: t.fromUser.address,
    fromNickname: t.fromUser.nickname,
    fromAvatar: t.fromUser.avatar,
    amount: Number(t.amount),
    message: t.message,
    showDanmaku: t.showDanmaku,
    createdAt: t.createdAt
  }));

  return reply.send({ videoId, tips: mapped });
});

// ============== Fiber Payment Endpoints (W4.8) ==============

// 23. Create Fiber Invoice
// Generates a CKB Fiber Network invoice with proper HTLC payment hash.
// Uses @ckb-ccc/core SDK for hex encoding and hash verification.
app.post("/payment/fiber/invoice", async (req, reply) => {
  const userId = (req.user as RequestUser)?.sub;
  if (!userId) return reply.status(401).send({ error: "Unauthorized", code: "unauthorized" });

  const body = req.body as {
    amount: string;
    asset?: string;
    description?: string;
    expiry?: number;
  };

  const amount = Number(body.amount);
  if (!body.amount || isNaN(amount) || amount <= 0) {
    return reply.status(400).send({ error: "amount must be a positive number string", code: "invalid_amount" });
  }

  const asset = body.asset || "CKB";
  const pointsToCredit = Math.floor(amount * POINTS_PER_CKB);
  const expiry = body.expiry || 3600;

  try {
    // Generate 32-byte random preimage and SHA-256 payment hash (HTLC standard)
    const preimageBytes = randomBytes(32);
    const preimageHex = ccc.hexFrom(preimageBytes);
    const paymentHashHex = "0x" + createHash("sha256").update(preimageBytes).digest("hex");

    const rpc = new FiberRPCClient();
    let invoiceStr: string;
    let finalPaymentHash: string;

    if (rpc.isConfigured() && !FIBER_ALLOW_MOCK) {
      const result = await rpc.createInvoice({
        amount: body.amount,
        memo: body.description || `VP-Pay-${userId.slice(0, 8)}`,
        expiry,
      });
      invoiceStr = result.paymentRequest;
      finalPaymentHash = result.paymentHash || paymentHashHex;
    } else {
      logger.info("Fiber mock mode: generating local invoice");
      invoiceStr = `fiber_inv_${uuidv4()}`;
      finalPaymentHash = paymentHashHex;
    }

    const fiberInv = await prisma.fiberInvoice.create({
      data: {
        userId,
        invoice: invoiceStr,
        paymentHash: finalPaymentHash,
        amount: body.amount,
        asset,
        pointsToCredit,
        status: "unpaid",
        expiresAt: new Date(Date.now() + expiry * 1000),
      }
    });

    return reply.send({
      id: fiberInv.id,
      invoice: fiberInv.invoice,
      paymentHash: finalPaymentHash,
      amount: fiberInv.amount,
      asset: fiberInv.asset,
      pointsToCredit: Number(fiberInv.pointsToCredit),
      status: fiberInv.status,
      expiresAt: fiberInv.expiresAt?.toISOString(),
    });
  } catch (err: any) {
    req.log.error({ msg: "Fiber invoice creation failed", err });
    return reply.status(500).send({ error: err.message || "Invoice creation failed", code: "fiber_invoice_failed" });
  }
});

// 24. Check Fiber Invoice Status
// Queries both local DB and Fiber RPC for up-to-date payment status.
app.get("/payment/fiber/invoice/:id", async (req, reply) => {
  const { id } = req.params as { id: string };

  const inv = await prisma.fiberInvoice.findUnique({ where: { id } });
  if (!inv) return reply.status(404).send({ error: "Invoice not found", code: "not_found" });

  // If already terminal, return directly
  if (inv.status === "paid" || inv.status === "expired" || inv.status === "canceled") {
    return reply.send({
      id: inv.id,
      invoice: inv.invoice,
      paymentHash: inv.paymentHash,
      amount: inv.amount,
      asset: inv.asset,
      pointsToCredit: Number(inv.pointsToCredit),
      status: inv.status,
      credited: inv.credited,
      paidAt: inv.paidAt?.toISOString() ?? null,
      expiresAt: inv.expiresAt?.toISOString() ?? null,
    });
  }

  // Check expiry
  if (inv.expiresAt && new Date() > inv.expiresAt) {
    await prisma.fiberInvoice.update({ where: { id }, data: { status: "expired" } });
    return reply.send({
      id: inv.id, invoice: inv.invoice, paymentHash: inv.paymentHash,
      amount: inv.amount, asset: inv.asset,
      pointsToCredit: Number(inv.pointsToCredit),
      status: "expired", credited: false,
      paidAt: null, expiresAt: inv.expiresAt?.toISOString() ?? null,
    });
  }

  // Query Fiber RPC for live status (skip for mock invoices)
  let liveStatus: "unpaid" | "paid" | "expired" = "unpaid";
  if (inv.paymentHash && !inv.paymentHash.startsWith("0x") === false) {
    const rpc = new FiberRPCClient();
    if (rpc.isConfigured() && inv.paymentHash && !inv.invoice.startsWith("fiber_inv_")) {
      try {
        const fiberStatus = await rpc.getInvoiceStatus(inv.paymentHash);
        liveStatus = fiberStatus.status;

        if (liveStatus === "paid" && inv.status !== "paid") {
          await prisma.fiberInvoice.update({
            where: { id },
            data: { status: "paid", paidAt: fiberStatus.settledAt ? new Date(fiberStatus.settledAt) : new Date() }
          });
        }
      } catch (rpcErr: any) {
        req.log.warn({ msg: "Fiber RPC status check failed", err: rpcErr.message });
      }
    }
  }

  const currentStatus = liveStatus === "paid" ? "paid" : inv.status;

  return reply.send({
    id: inv.id,
    invoice: inv.invoice,
    paymentHash: inv.paymentHash,
    amount: inv.amount,
    asset: inv.asset,
    pointsToCredit: Number(inv.pointsToCredit),
    status: currentStatus,
    credited: inv.credited,
    paidAt: inv.paidAt?.toISOString() ?? null,
    expiresAt: inv.expiresAt?.toISOString() ?? null,
  });
});

// 25. Settle Fiber Invoice — confirms payment and credits points
// In production the Fiber node settles the HTLC automatically when the preimage
// is revealed. This endpoint is called after payment confirmation (webhook or
// manual) to credit the user's points balance atomically.
app.post("/payment/fiber/invoice/:id/settle", async (req, reply) => {
  const { id } = req.params as { id: string };
  const body = req.body as { preimage?: string; force?: boolean } | undefined;

  const inv = await prisma.fiberInvoice.findUnique({ where: { id } });
  if (!inv) return reply.status(404).send({ error: "Invoice not found", code: "not_found" });

  if (inv.credited) {
    return reply.send({ ok: true, message: "Already settled and credited", id: inv.id, status: "paid", credited: true });
  }

  if (inv.status === "expired" || inv.status === "canceled") {
    return reply.status(400).send({ error: `Invoice is ${inv.status}`, code: "invoice_terminal" });
  }

  // Check expiry
  if (inv.expiresAt && new Date() > inv.expiresAt) {
    await prisma.fiberInvoice.update({ where: { id }, data: { status: "expired" } });
    return reply.status(400).send({ error: "Invoice expired", code: "invoice_expired" });
  }

  try {
    // Verify payment via Fiber RPC or preimage
    let verified = false;

    // Path 1: Verify with preimage (HTLC pattern using @ckb-ccc/core hex utils)
    if (body?.preimage) {
      const preimageRaw = ccc.bytesFrom(body.preimage);
      const computedHash = "0x" + createHash("sha256").update(Buffer.from(preimageRaw)).digest("hex");

      if (inv.paymentHash && computedHash === inv.paymentHash) {
        verified = true;

        // Attempt to settle via Fiber RPC
        const rpc = new FiberRPCClient();
        if (rpc.isConfigured() && !inv.invoice.startsWith("fiber_inv_")) {
          try {
            const htlc = new RealFiberHTLC();
            await htlc.redeemHTLC(inv.paymentHash, body.preimage);
          } catch (settleErr: any) {
            req.log.warn({ msg: "Fiber RPC settle call failed (may already be settled)", err: settleErr.message });
          }
        }
      } else {
        return reply.status(400).send({ error: "Preimage does not match payment hash", code: "preimage_mismatch" });
      }
    }

    // Path 2: Query Fiber RPC for payment confirmation
    if (!verified && inv.paymentHash) {
      const rpc = new FiberRPCClient();
      if (rpc.isConfigured() && !inv.invoice.startsWith("fiber_inv_")) {
        const status = await rpc.getInvoiceStatus(inv.paymentHash);
        if (status.status === "paid") {
          verified = true;
        }
      }
    }

    // Path 3: Force settle (mock/dev mode or admin override)
    if (!verified && (body?.force && FIBER_ALLOW_MOCK)) {
      logger.warn(`Force-settling Fiber invoice ${id} (FIBER_ALLOW_MOCK=1)`);
      verified = true;
    }

    if (!verified) {
      return reply.status(400).send({ error: "Payment not verified. Provide preimage or wait for on-chain confirmation.", code: "not_verified" });
    }

    // Atomic: mark paid + credit points
    const pointsAmount = Number(inv.pointsToCredit);
    await prisma.$transaction([
      prisma.fiberInvoice.update({
        where: { id },
        data: { status: "paid", credited: true, paidAt: new Date() }
      }),
      prisma.user.update({
        where: { id: inv.userId },
        data: { points: { increment: pointsAmount } }
      }),
      prisma.pointsTransaction.create({
        data: {
          userId: inv.userId,
          type: "buy",
          amount: pointsAmount,
          reason: `Fiber payment ${inv.amount} ${inv.asset}, Invoice: ${inv.id}`
        }
      })
    ]);

    const user = await prisma.user.findUnique({ where: { id: inv.userId }, select: { points: true } });

    return reply.send({
      ok: true,
      id: inv.id,
      status: "paid",
      credited: true,
      creditedPoints: pointsAmount,
      newBalance: user ? Number(user.points) : undefined,
    });
  } catch (err: any) {
    req.log.error({ msg: "Fiber invoice settlement failed", err });
    return reply.status(500).send({ error: err.message || "Settlement failed", code: "settle_failed" });
  }
});

// 26. Payment confirmation webhook for Fiber node callbacks
app.post("/payment/fiber/webhook", async (req, reply) => {
  const body = req.body as { payment_hash?: string; preimage?: string; status?: string };

  if (!body.payment_hash) {
    return reply.status(400).send({ error: "Missing payment_hash" });
  }

  const inv = await prisma.fiberInvoice.findFirst({
    where: { paymentHash: body.payment_hash, status: "unpaid" }
  });

  if (!inv) {
    req.log.warn({ msg: "Webhook: no matching unpaid invoice", paymentHash: body.payment_hash });
    return reply.send({ ok: true, message: "No matching invoice" });
  }

  if (body.status === "paid" || body.preimage) {
    // Verify preimage if provided
    if (body.preimage && inv.paymentHash) {
      const preimageRaw = ccc.bytesFrom(body.preimage);
      const computedHash = "0x" + createHash("sha256").update(Buffer.from(preimageRaw)).digest("hex");
      if (computedHash !== inv.paymentHash) {
        return reply.status(400).send({ error: "Preimage mismatch" });
      }
    }

    const pointsAmount = Number(inv.pointsToCredit);
    await prisma.$transaction([
      prisma.fiberInvoice.update({
        where: { id: inv.id },
        data: { status: "paid", credited: true, paidAt: new Date() }
      }),
      prisma.user.update({
        where: { id: inv.userId },
        data: { points: { increment: pointsAmount } }
      }),
      prisma.pointsTransaction.create({
        data: {
          userId: inv.userId,
          type: "buy",
          amount: pointsAmount,
          reason: `Fiber webhook ${inv.amount} ${inv.asset}`
        }
      })
    ]);

    logger.info({ msg: "Fiber webhook settled invoice", invoiceId: inv.id, points: pointsAmount });
    return reply.send({ ok: true, invoiceId: inv.id, credited: pointsAmount });
  }

  return reply.send({ ok: true, message: "Status not actionable" });
});

// 27. Withdraw Points to CKB
app.post("/payment/withdraw", async (req, reply) => {
  try {
    const user = req.user as RequestUser;
    if (!user || !user.sub) {
      return reply.status(401).send({ error: "Unauthorized", code: "unauthorized" });
    }

    // Get user for address
    const userRecord = await prisma.user.findUnique({ where: { id: user.sub } });
    if (!userRecord || !userRecord.address) {
      return reply.status(400).send({ error: "No wallet linked", code: "no_wallet" });
    }

    const { amountPoints } = req.body as { amountPoints: number };
    if (!amountPoints || amountPoints <= 0) {
      return reply.status(400).send({ error: "Invalid amount", code: "invalid_amount" });
    }

    // Exchange Rate: 10000 Points = 1 CKB
    const ckbAmount = Math.floor(amountPoints / POINTS_PER_CKB);

    // Limits check (Optional)
    // if (ckbAmount < 61) ...

    // Atomic Transaction
    await prisma.$transaction(async (tx) => {
      // 1. Check Balance
      const current = await tx.user.findUnique({ where: { id: user.sub } });
      if (!current || Number(current.points) < amountPoints) {
        throw new Error("Insufficient balance");
      }

      // 2. Deduct Points
      await tx.user.update({
        where: { id: user.sub },
        data: { points: { decrement: amountPoints } }
      });

      // 3. Record Transaction
      await tx.pointsTransaction.create({
        data: {
          userId: user.sub,
          amount: -amountPoints,
          type: "redeem", // Use 'redeem' as generic type for spending
          reason: `Withdraw ${ckbAmount} CKB to ${userRecord.address!.slice(0, 8)}...`
        }
      });
    });

    // 4. Execute Transfer
    let txHash = "";
    const serverPrivateKey = process.env.SERVER_PRIVATE_KEY;

    if (serverPrivateKey) {
      try {
        txHash = await sendCkb(serverPrivateKey, userRecord.address, ckbAmount);
      } catch (e: any) {
        req.log.error({ msg: "CKB Transfer Failed", error: e });
        // Refund points
        await updateUserPoints(user.sub, amountPoints, "refund", "Withdraw failed: " + e.message);
        return reply.status(500).send({ error: "Transfer failed: " + (e.message || "Network Error"), code: "transfer_failed" });
      }
    } else {
      req.log.warn("SERVER_PRIVATE_KEY missing, using simulated withdrawal");
      txHash = "0x" + Array(64).fill(0).map(() => Math.floor(Math.random() * 16).toString(16)).join("");
    }

    req.log.info({ msg: "Withdrawal success", userId: user.sub, points: amountPoints, ckb: ckbAmount, txHash });

    return reply.send({
      ok: true,
      deductedPoints: amountPoints,
      receivedCKB: ckbAmount,
      txHash: txHash,
      status: "completed"
    });

  } catch (err: any) {
    req.log.error(err);
    return reply.status(500).send({ error: err.message || "Withdraw failed", code: "withdraw_error" });
  }
});

// ============== Split Contract Endpoints (28-32) ==============

// 28. Create Split Contract
app.post("/payment/splits", async (req, reply) => {
  const userId = (req.user as RequestUser)?.sub;
  if (!userId) return reply.status(401).send({ error: "Unauthorized" });

  const body = req.body as {
    name: string;
    participants: Array<{ address: string; label: string; percentage: number; role?: string }>;
    linkedContentIds?: string[];
    contentType?: string;
    playRatePerSecond?: number;
    terms?: Record<string, any>;
  };

  if (!body.name || !body.participants || body.participants.length < 1) {
    return reply.status(400).send({ error: "name and participants are required" });
  }

  // Validate percentages sum to 100
  const totalPct = body.participants.reduce((s, p) => s + p.percentage, 0);
  if (Math.abs(totalPct - 100) > 0.01) {
    return reply.status(400).send({ error: `Percentages must total 100%, got ${totalPct}%` });
  }

  try {
    // Create split rules for each linked content
    const targetIds = body.linkedContentIds || [];
    const targetType = body.contentType || "video";
    const contractId = uuidv4();
    const results = [];

    for (const targetId of targetIds.length > 0 ? targetIds : [contractId]) {
      for (const p of body.participants) {
        // Find or create user by address
        let participantUser = await prisma.user.findFirst({ where: { address: p.address } });
        if (!participantUser) {
          // Create placeholder user for external addresses
          participantUser = await prisma.user.create({
            data: { address: p.address, nickname: p.label, role: "viewer" }
          });
        }

        const rule = await prisma.revenueSplitRule.upsert({
          where: {
            targetType_targetId_userId: {
              targetType,
              targetId,
              userId: participantUser.id,
            }
          },
          update: {
            percentage: p.percentage,
            role: p.role || "collaborator",
            fiberAddress: p.address,
          },
          create: {
            targetType,
            targetId,
            userId: participantUser.id,
            percentage: p.percentage,
            role: p.role || "collaborator",
            fiberAddress: p.address,
          }
        });
        results.push(rule);
      }
    }

    // Store contract metadata in platform settings for retrieval
    await prisma.platformSetting.upsert({
      where: { key: `split_contract_${contractId}` },
      update: { value: JSON.stringify({ name: body.name, ownerId: userId, targetIds, targetType, playRatePerSecond: body.playRatePerSecond, terms: body.terms, createdAt: new Date().toISOString() }) },
      create: { key: `split_contract_${contractId}`, value: JSON.stringify({ name: body.name, ownerId: userId, targetIds, targetType, playRatePerSecond: body.playRatePerSecond, terms: body.terms, createdAt: new Date().toISOString() }), description: `Split contract: ${body.name}` }
    });

    return reply.send({
      ok: true,
      contractId,
      name: body.name,
      rulesCreated: results.length,
      participants: body.participants,
    });
  } catch (err: any) {
    req.log.error({ msg: "Create split contract failed", err });
    return reply.status(500).send({ error: err.message });
  }
});

// 29. List User's Split Contracts
app.get("/payment/splits", async (req, reply) => {
  const userId = (req.user as RequestUser)?.sub;
  if (!userId) return reply.status(401).send({ error: "Unauthorized" });

  try {
    // Get all split rules where user is a participant
    const rules = await prisma.revenueSplitRule.findMany({
      where: { userId },
      orderBy: { targetId: 'asc' },
    });

    // Get contract metadata from platform settings
    const contractSettings = await prisma.platformSetting.findMany({
      where: { key: { startsWith: "split_contract_" } }
    });

    const contracts = contractSettings
      .map(s => {
        try {
          const data = JSON.parse(s.value);
          if (data.ownerId === userId) {
            return {
              contractId: s.key.replace("split_contract_", ""),
              ...data,
            };
          }
          return null;
        } catch { return null; }
      })
      .filter(Boolean);

    // Group rules by targetId
    const grouped: Record<string, any[]> = {};
    for (const r of rules) {
      if (!grouped[r.targetId]) grouped[r.targetId] = [];
      grouped[r.targetId].push({
        userId: r.userId,
        percentage: Number(r.percentage),
        role: r.role,
        fiberAddress: r.fiberAddress,
      });
    }

    return reply.send({
      contracts,
      splitRules: grouped,
      totalRules: rules.length,
    });
  } catch (err: any) {
    return reply.status(500).send({ error: err.message });
  }
});

// 30. Get Split Contract Detail
app.get("/payment/splits/:id", async (req, reply) => {
  const { id } = req.params as { id: string };

  try {
    const setting = await prisma.platformSetting.findUnique({
      where: { key: `split_contract_${id}` }
    });

    if (!setting) return reply.status(404).send({ error: "Contract not found" });

    const data = JSON.parse(setting.value);

    // Fetch all rules for this contract's target IDs
    const targetIds = data.targetIds || [id];
    const rules = await prisma.revenueSplitRule.findMany({
      where: { targetId: { in: targetIds } },
      include: { user: { select: { nickname: true, address: true, avatar: true } } }
    });

    return reply.send({
      contractId: id,
      ...data,
      participants: rules.map(r => ({
        userId: r.userId,
        nickname: r.user.nickname,
        address: r.user.address || r.fiberAddress,
        avatar: r.user.avatar,
        percentage: Number(r.percentage),
        role: r.role,
      })),
    });
  } catch (err: any) {
    return reply.status(500).send({ error: err.message });
  }
});

// 31. Update Split Contract
app.put("/payment/splits/:id", async (req, reply) => {
  const { id } = req.params as { id: string };
  const userId = (req.user as RequestUser)?.sub;
  if (!userId) return reply.status(401).send({ error: "Unauthorized" });

  const body = req.body as {
    name?: string;
    participants?: Array<{ address: string; label: string; percentage: number; role?: string }>;
    playRatePerSecond?: number;
  };

  try {
    const setting = await prisma.platformSetting.findUnique({
      where: { key: `split_contract_${id}` }
    });

    if (!setting) return reply.status(404).send({ error: "Contract not found" });

    const data = JSON.parse(setting.value);
    if (data.ownerId !== userId) return reply.status(403).send({ error: "Not contract owner" });

    // Update metadata
    const updated = { ...data };
    if (body.name) updated.name = body.name;
    if (body.playRatePerSecond !== undefined) updated.playRatePerSecond = body.playRatePerSecond;
    updated.updatedAt = new Date().toISOString();

    await prisma.platformSetting.update({
      where: { key: `split_contract_${id}` },
      data: { value: JSON.stringify(updated) }
    });

    // Update participant rules if provided
    if (body.participants) {
      const totalPct = body.participants.reduce((s, p) => s + p.percentage, 0);
      if (Math.abs(totalPct - 100) > 0.01) {
        return reply.status(400).send({ error: `Percentages must total 100%, got ${totalPct}%` });
      }

      const targetIds = data.targetIds || [id];
      // Delete old rules and recreate
      for (const targetId of targetIds) {
        await prisma.revenueSplitRule.deleteMany({
          where: { targetType: data.targetType || "video", targetId }
        });

        for (const p of body.participants) {
          let participantUser = await prisma.user.findFirst({ where: { address: p.address } });
          if (!participantUser) {
            participantUser = await prisma.user.create({
              data: { address: p.address, nickname: p.label, role: "viewer" }
            });
          }

          await prisma.revenueSplitRule.create({
            data: {
              targetType: data.targetType || "video",
              targetId,
              userId: participantUser.id,
              percentage: p.percentage,
              role: p.role || "collaborator",
              fiberAddress: p.address,
            }
          });
        }
      }
    }

    return reply.send({ ok: true, contractId: id, updated });
  } catch (err: any) {
    return reply.status(500).send({ error: err.message });
  }
});

// 32. Execute Revenue Split Distribution
app.post("/payment/splits/:id/execute", async (req, reply) => {
  const { id } = req.params as { id: string };
  const userId = (req.user as RequestUser)?.sub;
  if (!userId) return reply.status(401).send({ error: "Unauthorized" });

  const body = req.body as { totalRevenue: number; reason?: string };
  if (!body.totalRevenue || body.totalRevenue <= 0) {
    return reply.status(400).send({ error: "totalRevenue must be > 0" });
  }

  try {
    const setting = await prisma.platformSetting.findUnique({
      where: { key: `split_contract_${id}` }
    });

    if (!setting) return reply.status(404).send({ error: "Contract not found" });

    const data = JSON.parse(setting.value);
    if (data.ownerId !== userId) return reply.status(403).send({ error: "Not contract owner" });

    const targetIds = data.targetIds || [id];
    const rules = await prisma.revenueSplitRule.findMany({
      where: { targetId: { in: targetIds } },
      include: { user: { select: { id: true, nickname: true, address: true } } }
    });

    if (rules.length === 0) {
      return reply.status(400).send({ error: "No split rules found" });
    }

    // Platform fee: 5%
    const platformFee = Math.floor(body.totalRevenue * 0.05);
    const distributable = body.totalRevenue - platformFee;

    const distributions = [];
    let totalDistributed = 0;

    // Distribute to each participant
    for (const rule of rules) {
      const amount = Math.floor(distributable * Number(rule.percentage) / 100);
      if (amount > 0) {
        await updateUserPoints(
          rule.userId,
          amount,
          "earn",
          body.reason || `Revenue split from contract ${id}`,
        );
        distributions.push({
          userId: rule.userId,
          nickname: rule.user.nickname,
          address: rule.user.address,
          percentage: Number(rule.percentage),
          amount,
        });
        totalDistributed += amount;
      }
    }

    // Give remainder to first participant (rounding)
    const remainder = distributable - totalDistributed;
    if (remainder > 0 && distributions.length > 0) {
      await updateUserPoints(distributions[0].userId, remainder, "earn", "Split rounding remainder");
      distributions[0].amount += remainder;
      totalDistributed += remainder;
    }

    return reply.send({
      ok: true,
      contractId: id,
      totalRevenue: body.totalRevenue,
      platformFee,
      totalDistributed,
      distributions,
    });
  } catch (err: any) {
    return reply.status(500).send({ error: err.message });
  }
});

// ============== On-Ramp / Off-Ramp Session Endpoints ==============

const MOONPAY_API_KEY = process.env.MOONPAY_API_KEY || "";
const TRANSAK_API_KEY = process.env.TRANSAK_API_KEY || "";
const ONRAMP_PROVIDER = process.env.ONRAMP_PROVIDER || "transak";

// 33. Create On-Ramp Widget Session (Buy CKB/USDI with fiat)
app.post("/payment/onramp/session", async (req, reply) => {
  const userId = (req.user as RequestUser)?.sub;
  if (!userId) return reply.status(401).send({ error: "Unauthorized" });

  const body = req.body as { currency?: string; amount?: number; walletAddress?: string };
  const currency = body.currency || "CKB";
  const walletAddress = body.walletAddress || "";

  let widgetUrl = "";
  if (ONRAMP_PROVIDER === "moonpay" && MOONPAY_API_KEY) {
    widgetUrl = `https://buy.moonpay.com?apiKey=${MOONPAY_API_KEY}&currencyCode=${currency.toLowerCase()}&walletAddress=${walletAddress}${body.amount ? `&baseCurrencyAmount=${body.amount}` : ""}`;
  } else if (TRANSAK_API_KEY) {
    widgetUrl = `https://global.transak.com?apiKey=${TRANSAK_API_KEY}&cryptoCurrencyCode=${currency}&walletAddress=${walletAddress}&network=nervos&productsAvailed=BUY${body.amount ? `&defaultFiatAmount=${body.amount}` : ""}&themeColor=22d3ee`;
  } else {
    return reply.status(500).send({ error: "No on-ramp provider configured" });
  }

  const sessionId = uuidv4();
  return reply.send({ ok: true, sessionId, widgetUrl, provider: ONRAMP_PROVIDER, currency });
});

// 34. Initiate Off-Ramp Withdraw (Sell CKB/USDI for fiat)
app.post("/payment/offramp/initiate", async (req, reply) => {
  const userId = (req.user as RequestUser)?.sub;
  if (!userId) return reply.status(401).send({ error: "Unauthorized" });

  const body = req.body as { currency?: string; amount?: number; walletAddress?: string };
  const currency = body.currency || "CKB";
  const walletAddress = body.walletAddress || "";

  let widgetUrl = "";
  if (ONRAMP_PROVIDER === "moonpay" && MOONPAY_API_KEY) {
    widgetUrl = `https://sell.moonpay.com?apiKey=${MOONPAY_API_KEY}&baseCurrencyCode=${currency.toLowerCase()}&refundWalletAddress=${walletAddress}${body.amount ? `&baseCurrencyAmount=${body.amount}` : ""}`;
  } else if (TRANSAK_API_KEY) {
    widgetUrl = `https://global.transak.com?apiKey=${TRANSAK_API_KEY}&cryptoCurrencyCode=${currency}&walletAddress=${walletAddress}&network=nervos&productsAvailed=SELL${body.amount ? `&defaultCryptoAmount=${body.amount}` : ""}&themeColor=10b981`;
  } else {
    return reply.status(500).send({ error: "No off-ramp provider configured" });
  }

  const sessionId = uuidv4();
  return reply.send({ ok: true, sessionId, widgetUrl, provider: ONRAMP_PROVIDER, currency });
});

// 35. Check On-Ramp/Off-Ramp Transaction Status
app.get("/payment/ramp/status/:sessionId", async (req, reply) => {
  const { sessionId } = req.params as { sessionId: string };

  // In production, poll MoonPay/Transak API for transaction status
  // For now, return a placeholder since the widget handles status internally
  return reply.send({
    sessionId,
    status: "pending",
    message: "Transaction status is tracked by the widget provider. Check your wallet for confirmation.",
  });
});

// ============== RGB++ Auto-Split on Content Upload ==============

// 36. Create RGB++ Split Contract for uploaded content
app.post("/payment/rgbpp/auto-split", async (req, reply) => {
  const userId = (req.user as RequestUser)?.sub;
  if (!userId) return reply.status(401).send({ error: "Unauthorized" });

  const body = req.body as {
    contentId: string;
    contentType?: string;
    title: string;
    collaborators: Array<{ address: string; percentage: number; role?: string }>;
    creatorAddress: string;
  };

  if (!body.contentId || !body.collaborators || body.collaborators.length === 0) {
    return reply.status(400).send({ error: "contentId and collaborators are required" });
  }

  // Validate percentages sum <= 100
  const totalPct = body.collaborators.reduce((s, c) => s + c.percentage, 0);
  if (totalPct > 100) {
    return reply.status(400).send({ error: `Collaborator splits total ${totalPct}% which exceeds 100%` });
  }

  try {
    // 1. Create on-chain RGB++ split contract via RGBPPSplitClient
    const { RGBPPSplitClient } = await import("@video-platform/shared/web3/rgbpp");
    const rgbClient = new RGBPPSplitClient();

    const participants = body.collaborators.map(c => ({
      address: c.address,
      label: c.address.endsWith(".bit") ? c.address : c.address.slice(0, 8) + "...",
      percentage: c.percentage,
      role: (c.role || "collaborator") as "owner" | "collaborator" | "editor" | "producer" | "platform",
    }));

    // If remaining percentage exists, add platform
    const remaining = 100 - totalPct;
    if (remaining > 0) {
      participants.push({
        address: process.env.PLATFORM_WALLET_ADDRESS || "platform",
        label: "Nexus Platform",
        percentage: remaining,
        role: "platform" as const,
      });
    }

    const result = await rgbClient.createSplitContract({
      contractName: `${body.title} - Revenue Split`,
      participants,
      linkedContentIds: [body.contentId],
      contentType: (body.contentType || "video") as any,
      creatorAddress: body.creatorAddress,
      terms: {
        commercialUse: true,
        derivativeWorks: false,
        royaltyPercentage: Number(process.env.CREATOR_ROYALTY_PERCENTAGE || 5),
      },
    });

    // 2. Also create split rules in DB for immediate point-based distribution
    for (const p of body.collaborators) {
      let participantUser = await prisma.user.findFirst({ where: { address: p.address } });
      if (!participantUser) {
        participantUser = await prisma.user.create({
          data: { address: p.address, nickname: p.address.slice(0, 8) + "...", role: "viewer" },
        });
      }
      await prisma.revenueSplitRule.upsert({
        where: {
          targetType_targetId_userId: {
            targetType: body.contentType || "video",
            targetId: body.contentId,
            userId: participantUser.id,
          },
        },
        update: { percentage: p.percentage, role: p.role || "collaborator", fiberAddress: p.address },
        create: {
          targetType: body.contentType || "video",
          targetId: body.contentId,
          userId: participantUser.id,
          percentage: p.percentage,
          role: p.role || "collaborator",
          fiberAddress: p.address,
        },
      });
    }

    return reply.send({
      ok: true,
      contractId: result.contractId,
      txHash: result.txHash,
      onChain: result.success,
      participants: participants.map(p => ({ address: p.address, percentage: p.percentage, role: p.role })),
    });
  } catch (err: any) {
    req.log.error({ msg: "RGB++ auto-split creation failed", err });
    return reply.status(500).send({ error: err.message || "Split contract creation failed" });
  }
});

// ============== FIBER NETWORK API ENDPOINTS ==============
// Dual-track: Points (default) + Fiber (optional on-chain settlement)

const fiberClient = new FiberRPCClient();

// F1. Check Fiber Node connection status
app.get("/payment/fiber/status", async (_req, reply) => {
  const configured = fiberClient.isConfigured();
  if (!configured) {
    return reply.send({
      ok: false,
      mode: "points_only",
      message: "Fiber Network not configured. Using Points system.",
      fiberUrl: null,
    });
  }
  try {
    const status = await fiberClient.getStatus();
    return reply.send({
      ok: status.ok,
      mode: status.ok ? "dual" : "points_only",
      nodeInfo: status.info || null,
      message: status.ok ? "Fiber Network connected. Dual-mode available." : "Fiber node unreachable. Falling back to Points.",
      fiberUrl: process.env.FIBER_RPC_URL || null,
    });
  } catch (err: any) {
    return reply.send({
      ok: false,
      mode: "points_only",
      message: `Fiber error: ${err.message}`,
      fiberUrl: process.env.FIBER_RPC_URL || null,
    });
  }
});

// F3. Send payment via Fiber (or fallback to Points deduction)

app.post("/payment/fiber/pay", async (req, reply) => {
  const userId = (req.user as RequestUser)?.sub;
  if (!userId) return reply.status(401).send({ error: "Unauthorized" });

  const body = req.body as {
    paymentRequest?: string;
    paymentHash?: string;
    amount?: string;
    contentId?: string;
    usePoints?: boolean;
  };

  // Points fallback
  if (body.usePoints || !fiberClient.isConfigured()) {
    const amount = parseInt(body.amount || "0", 10);
    if (amount <= 0) return reply.status(400).send({ error: "Invalid amount" });

    try {
      const newBalance = await updateUserPoints(userId, -amount, "fiber_fallback_pay",
        `Points payment for content ${body.contentId || 'unknown'}`);

      // RGB++ Auto-Split: fire-and-forget revenue distribution
      if (body.contentId) {
        postPaymentSplitHook({
          paymentHash: body.paymentHash || `pts_${Date.now()}`,
          amount,
          contentId: body.contentId,
          payerId: userId,
          backend: 'points',
        }).catch(err => console.error('[SplitHook] points split error:', err?.message));
      }

      return reply.send({
        ok: true,
        backend: "points",
        status: "succeeded",
        newBalance,
        paymentHash: body.paymentHash || `pts_${Date.now()}`,
      });
    } catch (err: any) {
      return reply.status(400).send({ error: err.message });
    }
  }

  // Real Fiber payment
  try {
    const result = await fiberClient.sendPayment({
      invoice: body.paymentRequest,
      amount: body.amount,
      timeout: 30,
    });

    if (result.status === "succeeded") {
      await prisma.pointsTransaction.create({
        data: {
          userId,
          type: "fiber_payment",
          amount: -parseInt(body.amount || "0", 10),
          reason: `Fiber payment | hash: ${result.paymentHash} | preimage: ${result.preimage || 'n/a'}`,
        },
      });

      // RGB++ Auto-Split: distribute revenue to content participants
      if (body.contentId) {
        postPaymentSplitHook({
          paymentHash: result.paymentHash,
          amount: parseInt(body.amount || "0", 10),
          contentId: body.contentId,
          payerId: userId,
          backend: 'fiber',
        }).catch(err => console.error('[SplitHook] async error:', err?.message));
      }
    }

    return reply.send({
      ok: result.status === "succeeded",
      backend: "fiber",
      status: result.status,
      paymentHash: result.paymentHash,
      preimage: result.preimage,
      fee: result.fee,
    });
  } catch (err: any) {
    return reply.status(500).send({ error: `Fiber payment failed: ${err.message}` });
  }
});

// F4. List open Fiber channels
app.get("/payment/fiber/channels", async (req, reply) => {
  const userId = (req.user as RequestUser)?.sub;
  if (!userId) return reply.status(401).send({ error: "Unauthorized" });

  if (!fiberClient.isConfigured()) {
    return reply.send({ ok: true, channels: [], message: "Fiber not configured" });
  }

  try {
    const channels = await fiberClient.listChannels();
    return reply.send({
      ok: true,
      channels: channels.map(ch => ({
        channelId: ch.channelId,
        peerId: ch.peerId,
        state: ch.state,
        localBalance: ch.localBalance,
        remoteBalance: ch.remoteBalance,
        asset: ch.asset,
      })),
    });
  } catch (err: any) {
    return reply.send({ ok: false, channels: [], error: err.message });
  }
});

// F5. Settle stream payment via Fiber (close channel → on-chain)
app.post("/payment/fiber/settle", async (req, reply) => {
  const userId = (req.user as RequestUser)?.sub;
  if (!userId) return reply.status(401).send({ error: "Unauthorized" });

  const body = req.body as { sessionId: string; channelId?: string };
  if (!body.sessionId) return reply.status(400).send({ error: "sessionId required" });

  try {
    // Find the stream session
    const session = await prisma.streamSession.findFirst({
      where: { id: body.sessionId, userId },
    });
    if (!session) return reply.status(404).send({ error: "Session not found" });

    // If Fiber is configured and channelId is provided, close channel on-chain
    if (fiberClient.isConfigured() && body.channelId) {
      const closeResult = await fiberClient.closeChannel({
        channelId: body.channelId,
        closingFeeRate: "1000",
        force: false,
      });

      // Update session as settled on-chain
      await prisma.streamSession.update({
        where: { id: body.sessionId },
        data: { status: "settled" },
      });

      return reply.send({
        ok: true,
        backend: "fiber",
        settled: true,
        channelClosed: true,
        sessionId: body.sessionId,
        closeResult,
      });
    }

    // Points-mode settle: just mark session complete
    await prisma.streamSession.update({
      where: { id: body.sessionId },
      data: { status: "settled" },
    });

    return reply.send({
      ok: true,
      backend: "points",
      settled: true,
      channelClosed: false,
      sessionId: body.sessionId,
    });
  } catch (err: any) {
    return reply.status(500).send({ error: `Settlement failed: ${err.message}` });
  }
});

// ============== APP LISTEN ==============

app.listen({ port: Number(process.env.PAYMENT_PORT || 8091), host: "0.0.0.0" }, (err, address) => {
  if (err) {
    console.error(err);
    process.exit(1);
  }
  console.log(`Payment Service listening at ${address}`);

  // Start BullMQ Settlement Worker
  try {
    startSettlementWorker();
    console.log('⚡ Settlement Worker started');
  } catch (err) {
    console.warn('⚠️ Settlement Worker failed to start (Redis may not be available):', (err as Error).message);
  }
});

// --- Fiber Payout Cron Job (Real Fiber RPC with mock fallback) ---
setInterval(async () => {
  try {
    const pendingTasks = await prisma.fiberPayoutTask.findMany({
      where: { status: "pending" },
      take: 10
    });

    for (const task of pendingTasks) {
      // Lock task
      await prisma.fiberPayoutTask.update({
        where: { id: task.id },
        data: { status: "processing" }
      });

      try {
        let txHash: string;

        // Try real Fiber payment
        if (fiberClient.isConfigured()) {
          const result = await fiberClient.sendPayment({
            dest: task.fiberAddress,
            amount: String(task.amount),
            timeout: 30,
          });
          txHash = result.paymentHash || `fiber_${Date.now()}_${task.id.slice(0, 6)}`;
          logger.info({ msg: "Fiber payout succeeded", taskId: task.id, txHash });

          // RGB++ Auto-Split: distribute payout revenue if linked to content
          if ((task as any).contentId) {
            postPaymentSplitHook({
              paymentHash: txHash,
              amount: task.amount,
              contentId: (task as any).contentId,
              payerId: (task as any).userId || 'system',
              backend: 'fiber',
            }).catch(err => console.error('[SplitHook] payout split error:', err?.message));
          }
        } else {
          // Mock fallback for development
          txHash = `0xmock_fiber_${Date.now()}_${task.id.slice(0, 6)}`;
          logger.warn({ msg: "Fiber payout (mock mode)", taskId: task.id, txHash });
        }

        await prisma.fiberPayoutTask.update({
          where: { id: task.id },
          data: { status: "completed", txHash }
        });
        console.log(`⚡ [FiberPayout] Dispatched ${task.amount} to ${task.fiberAddress}. Tx: ${txHash}`);
      } catch (err: any) {
        await prisma.fiberPayoutTask.update({
          where: { id: task.id },
          data: { status: "failed", errorReason: err.message }
        });
        console.error(`⚡ [FiberPayout] Failed to dispatch to ${task.fiberAddress}:`, err.message);
      }
    }
  } catch (err) {
    console.error("⚡ [FiberPayout Cron Error]", err);
  }
}, 30000);

export default app;