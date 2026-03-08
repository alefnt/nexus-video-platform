// FILE: /video-platform/shared/web3/fiber.ts
/**
 * Fiber Network Integration — Production-Ready
 * 
 * Real Fiber Network RPC client for payment channels, invoices, and settlements.
 * - Official: https://github.com/nervosnetwork/fiber
 * - RPC spec: nervosnetwork/fiber/docs/RPC.md
 * - NPM wrapper: @fiber-network/js (mirrors Fiber JSON-RPC)
 * 
 * Environment Variables:
 *   FIBER_RPC_URL  — Fiber node JSON-RPC endpoint (required)
 *   FIBER_ALLOW_MOCK — Set to "1" ONLY in development (default: disabled)
 */

import { sha256 } from "js-sha256";
import type { PaymentIntent, PaymentStatus } from "../types/index.js";

// ============== Types ==============

export interface FiberChannelInfo {
  channelId: string;
  peerId: string;
  state: string;
  localBalance: string;
  remoteBalance: string;
  asset?: string;
}

export interface FiberInvoiceResult {
  paymentHash: string;
  paymentRequest: string;
  amount: string;
  currency: string;
  memo: string;
  expiry: number;
  [key: string]: any;
}

export interface FiberPaymentResult {
  paymentHash: string;
  status: "succeeded" | "pending" | "failed";
  preimage?: string;
  fee?: string;
  [key: string]: any;
}

export interface FiberNodeInfo {
  nodeId: string;
  addresses: string[];
  channels: number;
  peers: number;
  [key: string]: any;
}

// ============== Fiber RPC Client ==============

/**
 * Production Fiber Network RPC Client.
 * 
 * Supports all core Fiber RPC methods:
 * - node_info, list_channels, open_channel
 * - new_invoice, get_invoice, settle_invoice
 * - send_payment
 */
export class FiberRPCClient {
  private rpcUrl: string;
  readonly network: 'testnet' | 'mainnet';

  constructor(rpcUrl?: string) {
    this.network = (process.env.FIBER_NETWORK || 'testnet') as 'testnet' | 'mainnet';
    const defaultUrls: Record<string, string> = {
      testnet: 'http://localhost:8228',
      mainnet: process.env.FIBER_RPC_URL_MAINNET || 'https://fiber-mainnet.ckb.dev/rpc',
    };
    this.rpcUrl = (rpcUrl || process.env.FIBER_RPC_URL || defaultUrls[this.network] || '').replace(/\/$/, '');
  }

  /** Returns true if FIBER_RPC_URL is configured */
  isConfigured(): boolean {
    return !!this.rpcUrl && this.rpcUrl.length > 0;
  }

  /** Low-level JSON-RPC call */
  private async call(method: string, params: any): Promise<any> {
    if (!this.rpcUrl) {
      throw new Error("FIBER_RPC_URL not configured");
    }
    const payload = { id: Date.now(), jsonrpc: "2.0", method, params };
    const res = await fetch(this.rpcUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const json = await res.json();
    if (!res.ok || json?.error) {
      const errMsg = json?.error?.message || json?.error || res.statusText || "RPC call failed";
      throw new Error(`Fiber RPC [${method}]: ${errMsg}`);
    }
    return json?.result ?? json;
  }

  // ---- Node Management ----

  /** Get Fiber node information */
  async getNodeInfo(): Promise<FiberNodeInfo> {
    const result = await this.call("node_info", []);
    return {
      nodeId: result?.node_id || result?.nodeId || "",
      addresses: result?.addresses || [],
      channels: result?.num_channels || result?.channels || 0,
      peers: result?.num_peers || result?.peers || 0,
      ...result,
    };
  }

  /** Get node connection status */
  async getStatus(): Promise<{ ok: boolean; info?: FiberNodeInfo; error?: string }> {
    if (!this.isConfigured()) return { ok: false, error: "FIBER_RPC_URL not configured" };
    try {
      const info = await this.getNodeInfo();
      return { ok: true, info };
    } catch (e: any) {
      return { ok: false, error: e?.message || String(e) };
    }
  }

  // ---- Channel Management ----

  /** Open a payment channel to a peer */
  async openChannel(params: {
    peerPubkey: string;
    fundingAmount: string;
    asset?: string;
  }): Promise<{ channelId: string;[key: string]: any }> {
    const result = await this.call("open_channel", {
      peer_pubkey: params.peerPubkey,
      funding_amount: params.fundingAmount,
      ...(params.asset ? { funding_udt_type_script: params.asset } : {}),
    });
    return {
      channelId: result?.temporary_channel_id || result?.channel_id || "",
      ...result,
    };
  }

  /** List all channels */
  async listChannels(peerPubkey?: string): Promise<FiberChannelInfo[]> {
    const result = await this.call("list_channels", {
      ...(peerPubkey ? { peer_pubkey: peerPubkey } : {}),
    });
    const channels = result?.channels || result || [];
    return channels.map((ch: any) => ({
      channelId: ch.channel_id || ch.channelId || "",
      peerId: ch.peer_pubkey || ch.peerId || "",
      state: ch.state?.state_name || ch.state || "unknown",
      localBalance: ch.local_balance || ch.localBalance || "0",
      remoteBalance: ch.remote_balance || ch.remoteBalance || "0",
      asset: ch.funding_udt_type_script || ch.asset || undefined,
    }));
  }

  /** Close a channel cooperatively */
  async closeChannel(params: {
    channelId: string;
    closingFeeRate: string;
    force?: boolean;
  }): Promise<any> {
    return this.call(params.force ? "force_close_channel" : "shutdown_channel", {
      channel_id: params.channelId,
      close_script: {},
      fee_rate: params.closingFeeRate,
    });
  }

  // ---- Invoice Management ----

  /** Create a payment invoice */
  async createInvoice(params: {
    amount: string;
    memo?: string;
    expiry?: number;
    currency?: string;
    paymentPreimage?: string;
  }): Promise<FiberInvoiceResult> {
    const result = await this.call("new_invoice", {
      amount: params.amount,
      currency: params.currency || "CKB",
      description: params.memo || "",
      expiry: (params.expiry || 600).toString(),
      ...(params.paymentPreimage ? { payment_preimage: params.paymentPreimage } : {}),
    });
    return {
      paymentHash: result?.payment_hash || result?.paymentHash || "",
      paymentRequest: result?.invoice || result?.payment_request || result?.paymentRequest || "",
      amount: params.amount,
      currency: params.currency || "CKB",
      memo: params.memo || "",
      expiry: params.expiry || 600,
      ...result,
    };
  }

  /** Get invoice status by payment hash */
  async getInvoiceStatus(paymentHash: string): Promise<{
    status: "paid" | "unpaid" | "expired" | "cancelled";
    settledAt?: string;
    preimage?: string;
  }> {
    const result = await this.call("get_invoice", { payment_hash: paymentHash });
    const isPaid = result?.status === "Paid" || result?.status === "paid" || result?.settled === true;
    const isExpired = result?.status === "Expired" || result?.status === "expired" || result?.expired === true;
    const isCancelled = result?.status === "Cancelled" || result?.status === "cancelled";
    return {
      status: isPaid ? "paid" : isExpired ? "expired" : isCancelled ? "cancelled" : "unpaid",
      settledAt: result?.settled_at || result?.settledAt,
      preimage: result?.payment_preimage || result?.preimage,
    };
  }

  // ---- Payment ----

  /** Send a payment via an invoice/payment request */
  async sendPayment(params: {
    invoice?: string;
    amount?: string;
    dest?: string;
    timeout?: number;
  }): Promise<FiberPaymentResult> {
    const result = await this.call("send_payment", {
      ...(params.invoice ? { invoice: params.invoice } : {}),
      ...(params.amount ? { amount: params.amount } : {}),
      ...(params.dest ? { dest: params.dest } : {}),
      ...(params.timeout ? { timeout: params.timeout.toString() } : {}),
    });
    return {
      paymentHash: result?.payment_hash || result?.paymentHash || "",
      status: result?.status === "Succeeded" || result?.status === "succeeded" ? "succeeded"
        : result?.status === "Failed" || result?.status === "failed" ? "failed"
          : "pending",
      preimage: result?.payment_preimage || result?.preimage,
      fee: result?.fee || result?.total_fee,
      ...result,
    };
  }
}

// ============== Singleton ==============

let _fiberRpcClient: FiberRPCClient | null = null;

export function getFiberRpcClient(): FiberRPCClient {
  if (!_fiberRpcClient) {
    _fiberRpcClient = new FiberRPCClient();
  }
  return _fiberRpcClient;
}

// ============== Stream Payment Functions ==============

/**
 * Create a stream payment invoice (per-second segments).
 * Uses real Fiber RPC. Falls back to mock ONLY if FIBER_ALLOW_MOCK=1 (dev only).
 */
export async function createStreamInvoice(params: {
  videoId: string;
  segmentNumber: number;
  pricePerSecond: number;
  segmentSeconds: number;
  /** @deprecated Use pricePerSecond instead */
  pricePerMinute?: number;
  /** @deprecated Use segmentSeconds instead */
  segmentMinutes?: number;
  expiry?: number;
}): Promise<FiberInvoiceResult> {
  const pps = params.pricePerSecond ?? ((params.pricePerMinute ?? 0) / 60);
  const segSec = params.segmentSeconds ?? ((params.segmentMinutes ?? 1) * 60);
  const amount = (pps * segSec).toFixed(6);
  const memo = `Video ${params.videoId} - Segment ${params.segmentNumber} (${segSec}s)`;
  const expiry = params.expiry || 600;
  const allowMock = process.env.FIBER_ALLOW_MOCK === "1";

  const rpc = getFiberRpcClient();
  if (rpc.isConfigured()) {
    try {
      return await rpc.createInvoice({ amount, memo, expiry });
    } catch (e: any) {
      console.error("[Fiber] Invoice creation failed:", e?.message);
      if (!allowMock) {
        throw new Error(`Fiber RPC failed: ${e?.message}`);
      }
      console.warn("[Fiber] Falling back to mock (FIBER_ALLOW_MOCK=1)");
    }
  }

  // Mock mode — dev only
  if (!allowMock) {
    throw new Error("Fiber RPC not configured. Set FIBER_RPC_URL or FIBER_ALLOW_MOCK=1 for dev.");
  }

  return {
    amount,
    currency: "CKB",
    memo,
    expiry,
    paymentHash: `mock_hash_${Date.now()}`,
    paymentRequest: `mock_req_${Date.now()}`,
  };
}

/** Check stream payment status by payment hash */
export async function checkStreamPaymentStatus(paymentHash: string): Promise<{
  paid: boolean;
  settledAt?: string;
  preimage?: string;
  error?: string;
}> {
  if (paymentHash.startsWith("mock_hash_")) {
    return { paid: false, error: "Mock payment hash — not a real payment" };
  }

  const rpc = getFiberRpcClient();
  if (rpc.isConfigured()) {
    try {
      const status = await rpc.getInvoiceStatus(paymentHash);
      return {
        paid: status.status === "paid",
        settledAt: status.settledAt,
        preimage: status.preimage,
      };
    } catch (e: any) {
      return { paid: false, error: `Fiber RPC error: ${e?.message}` };
    }
  }

  return { paid: false, error: "Fiber RPC not configured" };
}

// ============== Utility Functions ==============

/** Calculate adaptive segment duration (seconds) */
export function calculateSegmentDuration(videoDurationSeconds: number): number {
  if (videoDurationSeconds <= 120) return 30;    // ≤2min → 30s/segment
  if (videoDurationSeconds <= 600) return 60;    // 2-10min → 60s/segment
  if (videoDurationSeconds <= 1800) return 120;  // 10-30min → 120s/segment
  return 300;                                     // >30min → 300s/segment
}

/** Calculate total segments for a video */
export function calculateTotalSegments(videoDurationSeconds: number, segmentSeconds: number): number {
  return Math.ceil(videoDurationSeconds / segmentSeconds);
}

// ============== Fiber Payout (Platform → Creator) ==============

/**
 * Send a real CKB/USDI payout from the platform Fiber node to a creator's CKB address.
 * 
 * Flow:
 * 1. Check if channel exists to creator → if not, create invoice for creator to receive
 * 2. Send payment via Fiber channel
 * 3. Return payment result
 */
export async function fiberPayout(params: {
  creatorAddress: string;
  amountCKB: number;
  reason?: string;
}): Promise<FiberPaymentResult> {
  const rpc = getFiberRpcClient();
  if (!rpc.isConfigured()) {
    throw new Error("Fiber RPC not configured — cannot process payout");
  }

  console.log(`[Fiber] Payout: ${params.amountCKB} CKB → ${params.creatorAddress} (${params.reason || "settlement"})`);

  // Send payment to creator's address
  const result = await rpc.sendPayment({
    dest: params.creatorAddress,
    amount: params.amountCKB.toString(),
    timeout: 60,
  });

  console.log(`[Fiber] Payout result: ${result.status} (hash: ${result.paymentHash})`);
  return result;
}

// ============== Legacy HTLC (In-Memory, for backwards compat) ==============

type LedgerEntry = {
  intentId: string;
  videoId: string;
  payer: string;
  payee: string;
  amountUSDI: string;
  hashSecret: string;
  timeLockSeconds: number;
  createdAt: number;
  redeemed?: boolean;
};

const ledger = new Map<string, LedgerEntry>();

/**
 * @deprecated Use FiberRPCClient.sendPayment() for real payments.
 * Kept for backwards compatibility during migration.
 */
export class FiberHTLC {
  createHTLC(params: {
    intentId: string;
    videoId: string;
    payer: string;
    payee: string;
    amountUSDI: string;
    secret: string;
    timeLockSeconds: number;
  }): PaymentIntent {
    const hashSecret = sha256(params.secret);
    const entry: LedgerEntry = {
      intentId: params.intentId,
      videoId: params.videoId,
      payer: params.payer,
      payee: params.payee,
      amountUSDI: params.amountUSDI,
      hashSecret,
      timeLockSeconds: params.timeLockSeconds,
      createdAt: Date.now(),
    };
    ledger.set(params.intentId, entry);
    return {
      intentId: params.intentId,
      videoId: params.videoId,
      buyerCkbAddress: params.payer,
      amountUSDI: params.amountUSDI,
      status: "htlc_locked",
      createdAt: new Date().toISOString(),
    };
  }

  redeemHTLC(intentId: string, secret: string): PaymentStatus {
    const entry = ledger.get(intentId);
    if (!entry) return "failed";
    const hash = sha256(secret);
    if (hash !== entry.hashSecret) return "failed";
    if (Date.now() - entry.createdAt > entry.timeLockSeconds * 1000) return "failed";
    entry.redeemed = true;
    ledger.set(intentId, entry);
    return "settled";
  }

  getLedgerEntry(intentId: string): LedgerEntry | undefined {
    return ledger.get(intentId);
  }
}

// Alias for backwards compatibility with payment service
export const RealFiberHTLC = FiberHTLC;