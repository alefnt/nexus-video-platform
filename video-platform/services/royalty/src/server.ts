// FILE: /video-platform/services/royalty/src/server.ts
/**
 * 功能说明：
 * - 分账服务：根据比例计算每个参与者的金额，并返回 RGB++ 交易记录。
 * - 暴露 /royalty/distribute 接口。
 *
 * 环境变量：
 * - process.env.JWT_SECRET
 * - process.env.ROYALTY_PORT (默认 8094)
 */

import Fastify from "fastify";
import jwt from "@fastify/jwt";
import { v4 as uuidv4 } from "uuid";
import type { RoyaltyDistributionRequest, RoyaltyDistributionResult, VideoMetaWithRoyalty } from "@video-platform/shared/types";
import { ApiClient } from "@video-platform/shared/api/client";
import { isUSDI } from "@video-platform/shared/types";
import { registerSecurityPlugins } from "@video-platform/shared/security/index";
import { register } from "@video-platform/shared/monitoring";
import { rgbppClient, type SplitParticipant } from "@video-platform/shared/web3/rgbpp";

const app = Fastify({ logger: true });
const JWT_SECRET = process.env.JWT_SECRET || "";
if (!JWT_SECRET || JWT_SECRET.length < 32) throw new Error("JWT_SECRET 未配置或长度不足");

// Security: Helmet, CORS, Rate Limiting, TraceId
await registerSecurityPlugins(app, { rateLimit: { max: 50, timeWindow: "1 minute" } });

app.register(jwt, { secret: JWT_SECRET });

app.addHook("onRequest", async (req, reply) => {
  if (req.url.startsWith("/health") || req.url.startsWith("/metrics")) return;
  try { await req.jwtVerify(); } catch { return reply.status(401).send({ error: "未授权", code: "unauthorized" }); }
});

app.get("/health", async () => ({ status: "ok" }));
app.get("/metrics", async (_req: any, reply: any) => {
  reply.header("Content-Type", register.contentType);
  return reply.send(await register.metrics());
});

app.post<{ Body: RoyaltyDistributionRequest }>("/royalty/distribute", async (req, reply) => {
  try {
    const body = req.body as any;
    const videoId = body?.videoId;
    // Support both totalUSDI (string) and totalAmount (number) for flexibility
    const totalUSDI = body?.totalUSDI;
    const totalAmount = body?.totalAmount;

    if (!videoId) return reply.status(400).send({ error: "缺少 videoId", code: "bad_request" });
    if (!totalUSDI && !totalAmount) {
      return reply.status(400).send({
        error: "缺少金额参数，需要 totalUSDI 或 totalAmount",
        code: "bad_request",
        expected: { videoId: "string", totalUSDI: "string (e.g. '100.00')", participants: [{ address: "string", ratio: "number (0-1)" }] }
      });
    }

    const total = totalUSDI ? parseFloat(totalUSDI) : Number(totalAmount);
    if (isNaN(total) || total <= 0) return reply.status(400).send({ error: "金额必须大于0", code: "bad_amount" });

    let participants = body?.participants;
    let rules: Array<{ address: string; share: number }> = [];

    if (participants?.length) {
      // Support both ratio (0-1) and percentage (0-100) formats
      rules = participants.map((p: any) => {
        const share = p.ratio !== undefined ? Number(p.ratio) :
          p.percentage !== undefined ? Number(p.percentage) / 100 :
            p.share !== undefined ? Number(p.share) : 0;
        return { address: p.address, share };
      });
    } else {
      const client = new ApiClient({ baseURL: process.env.METADATA_URL || "http://localhost:8093" });
      const meta = await client.get<VideoMetaWithRoyalty>(`/metadata/${videoId}`);
      const rr = meta.royaltyRules?.rules || [];
      if (!rr.length) return reply.status(400).send({ error: "未配置分账规则", code: "no_rules" });
      rules = rr;
    }

    const sum = rules.reduce((acc, r) => acc + r.share, 0);
    if (Math.abs(sum - 1) > 1e-6) {
      return reply.status(400).send({
        error: `比例之和必须等于 1 (当前: ${sum.toFixed(4)})`,
        code: "ratio_sum_invalid",
        tip: "Use ratio (0-1) or percentage (0-100). Example: [{address:'addr1', ratio:0.6}, {address:'addr2', ratio:0.4}]"
      });
    }

    const outputs = rules.map((r) => ({ address: r.address, amountUSDI: (total * r.share).toFixed(6) }));

    // Execute real RGB++ split distribution on CKB
    const splitParticipants: SplitParticipant[] = rules.map((r) => ({
      address: r.address,
      label: r.address.slice(0, 8),
      percentage: r.share * 100,
      role: 'collaborator' as const,
    }));

    let txId: string;
    try {
      const splitResult = await rgbppClient.executeSplit(videoId, total, splitParticipants);
      txId = splitResult.txHash || `rgbpp-${Date.now()}-${uuidv4().slice(0, 8)}`;
      app.log.info({ videoId, txId, splitResult: splitResult.success }, "RGB++ split executed");
    } catch (rgbErr: any) {
      // Non-fatal: record as pending if RGB++ fails
      txId = `rgbpp-pending-${Date.now()}-${uuidv4().slice(0, 8)}`;
      app.log.warn({ videoId, error: rgbErr?.message }, "RGB++ split failed, recording as pending");
    }

    const res: RoyaltyDistributionResult = { videoId, outputs, txId };
    app.log.info({ videoId, txId, recipientCount: outputs.length }, "Royalty distribution recorded");
    return reply.send(res);
  } catch (err: any) {
    return reply.status(500).send({ error: err?.message || "分账错误", code: "royalty_error" });
  }
});

// ─── Royalty Distribution Scheduling ───

// In-memory pending distributions (would be Redis/DB in production)
const pendingDistributions: Array<{
  id: string;
  videoId: string;
  totalAmount: number;
  participants: SplitParticipant[];
  scheduledAt: Date;
  status: "pending" | "processing" | "done" | "failed";
  error?: string;
}> = [];

// Queue a distribution for scheduled processing
app.post("/royalty/schedule", async (req, reply) => {
  try {
    const body = req.body as { videoId: string; totalAmount: number; participants: any[]; executeAt?: string };
    if (!body.videoId || !body.totalAmount || !body.participants?.length) {
      return reply.status(400).send({ error: "缺少参数: videoId, totalAmount, participants" });
    }

    const dist = {
      id: uuidv4(),
      videoId: body.videoId,
      totalAmount: body.totalAmount,
      participants: body.participants.map((p: any) => ({
        address: p.address,
        label: p.address.slice(0, 8),
        percentage: p.percentage || (p.ratio ? p.ratio * 100 : 0),
        role: p.role || "collaborator" as const,
      })),
      scheduledAt: body.executeAt ? new Date(body.executeAt) : new Date(),
      status: "pending" as const,
    };

    pendingDistributions.push(dist);
    app.log.info({ id: dist.id, videoId: dist.videoId }, "Royalty distribution scheduled");

    return reply.send({ ok: true, distributionId: dist.id, scheduledAt: dist.scheduledAt });
  } catch (err: any) {
    return reply.status(500).send({ error: err?.message || "调度失败" });
  }
});

// View pending distributions
app.get("/royalty/pending", async (_req, reply) => {
  return reply.send({
    pending: pendingDistributions.filter(d => d.status === "pending"),
    processing: pendingDistributions.filter(d => d.status === "processing"),
    completed: pendingDistributions.filter(d => d.status === "done").slice(-20),
    failed: pendingDistributions.filter(d => d.status === "failed").slice(-10),
  });
});

// Cron: Process pending distributions every 60 seconds
async function processScheduledDistributions() {
  const now = new Date();
  const due = pendingDistributions.filter(d => d.status === "pending" && d.scheduledAt <= now);

  for (const dist of due) {
    dist.status = "processing";
    try {
      const splitResult = await rgbppClient.executeSplit(dist.videoId, dist.totalAmount, dist.participants);
      dist.status = "done";
      app.log.info({ id: dist.id, videoId: dist.videoId, txHash: splitResult.txHash }, "Scheduled royalty executed");
    } catch (err: any) {
      dist.status = "failed";
      dist.error = err?.message;
      app.log.warn({ id: dist.id, error: err?.message }, "Scheduled royalty failed");
    }
  }
}

// Start scheduler cron (every 60 seconds)
setInterval(processScheduledDistributions, 60_000);
app.log.info("Royalty distribution scheduler started (60s interval)");

// ============== Creator Earnings & Withdrawal ==============

import { PrismaClient } from "@video-platform/database";
const prisma = new PrismaClient();

// Get creator earnings summary
app.get("/royalty/earnings/:userId", async (req, reply) => {
  try {
    const { userId } = req.params as { userId: string };
    if (!userId) return reply.status(400).send({ error: "userId required" });

    // Get all royalty-related transactions for this creator
    const transactions = await prisma.pointsTransaction.findMany({
      where: {
        userId,
        type: { in: ["royalty", "stream_earn", "tip_received", "buy_earn", "fiber_payment"] }
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    });

    // Get all withdrawals
    const withdrawals = await prisma.fiberPayoutTask.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: 50,
    });

    const totalEarned = transactions.reduce((sum, t) => sum + Math.abs(Number(t.amount)), 0);
    const totalWithdrawn = withdrawals
      .filter(w => w.status === "completed")
      .reduce((sum, w) => sum + Number(w.amount), 0);
    const pendingWithdrawal = withdrawals
      .filter(w => w.status === "pending" || w.status === "processing")
      .reduce((sum, w) => sum + Number(w.amount), 0);

    return reply.send({
      userId,
      totalEarned,
      totalWithdrawn,
      pendingWithdrawal,
      availableBalance: totalEarned - totalWithdrawn - pendingWithdrawal,
      recentTransactions: transactions.slice(0, 20).map(t => ({
        id: t.id,
        type: t.type,
        amount: Number(t.amount),
        reason: t.reason,
        createdAt: t.createdAt,
      })),
      recentWithdrawals: withdrawals.slice(0, 10).map(w => ({
        id: w.id,
        amount: Number(w.amount),
        status: w.status,
        fiberAddress: w.fiberAddress,
        txHash: w.txHash,
        createdAt: w.createdAt,
      })),
    });
  } catch (err: any) {
    return reply.status(500).send({ error: err?.message || "Failed to fetch earnings" });
  }
});

// Creator withdrawal request
app.post("/royalty/withdraw", async (req, reply) => {
  try {
    const user = (req as any).user;
    const userId = user?.sub;
    if (!userId) return reply.status(401).send({ error: "Unauthorized" });

    const body = req.body as { amount: number; fiberAddress: string; method?: string };

    if (!body.amount || body.amount <= 0) {
      return reply.status(400).send({ error: "Amount must be greater than 0" });
    }
    if (!body.fiberAddress?.trim()) {
      return reply.status(400).send({ error: "Fiber/CKB address required" });
    }

    const MIN_WITHDRAWAL = 100; // minimum 100 points
    if (body.amount < MIN_WITHDRAWAL) {
      return reply.status(400).send({ error: `Minimum withdrawal: ${MIN_WITHDRAWAL} PTS` });
    }

    // Check available balance
    const earnings = await prisma.pointsTransaction.findMany({
      where: { userId, type: { in: ["royalty", "stream_earn", "tip_received", "buy_earn"] } },
    });
    const pendingPayouts = await prisma.fiberPayoutTask.findMany({
      where: { userId, status: { in: ["pending", "processing"] } },
    });

    const totalEarned = earnings.reduce((sum, t) => sum + Math.abs(Number(t.amount)), 0);
    const completedPayouts = await prisma.fiberPayoutTask.findMany({
      where: { userId, status: "completed" },
    });
    const totalWithdrawn = completedPayouts.reduce((sum, w) => sum + Number(w.amount), 0);
    const pendingAmount = pendingPayouts.reduce((sum, w) => sum + Number(w.amount), 0);
    const available = totalEarned - totalWithdrawn - pendingAmount;

    if (body.amount > available) {
      return reply.status(400).send({
        error: `Insufficient balance. Available: ${available} PTS`,
        available,
      });
    }

    // Create payout task (processed by Fiber payout cron in payment service)
    const task = await prisma.fiberPayoutTask.create({
      data: {
        userId,
        amount: body.amount,
        fiberAddress: body.fiberAddress.trim(),
        status: "pending",
      },
    });

    app.log.info({ userId, amount: body.amount, taskId: task.id }, "Withdrawal request created");

    return reply.send({
      ok: true,
      withdrawalId: task.id,
      amount: body.amount,
      fiberAddress: body.fiberAddress,
      status: "pending",
      message: "Withdrawal queued. Will be processed within 30 seconds.",
    });
  } catch (err: any) {
    return reply.status(500).send({ error: err?.message || "Withdrawal failed" });
  }
});

// List creator's withdrawal history
app.get("/royalty/withdrawals", async (req, reply) => {
  try {
    const user = (req as any).user;
    const userId = user?.sub;
    if (!userId) return reply.status(401).send({ error: "Unauthorized" });

    const withdrawals = await prisma.fiberPayoutTask.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: 50,
    });

    return reply.send({
      withdrawals: withdrawals.map(w => ({
        id: w.id,
        amount: Number(w.amount),
        status: w.status,
        fiberAddress: w.fiberAddress,
        txHash: w.txHash,
        errorReason: w.errorReason,
        createdAt: w.createdAt,
        updatedAt: w.updatedAt,
      })),
    });
  } catch (err: any) {
    return reply.status(500).send({ error: err?.message || "Failed to fetch withdrawals" });
  }
});

// ============== Start Server ==============

const port = Number(process.env.ROYALTY_PORT || 8094);
app.listen({ port }).then(() => app.log.info(`Royalty listening on http://localhost:${port}`));
export default app;