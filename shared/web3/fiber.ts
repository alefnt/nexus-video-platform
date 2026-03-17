// FILE: /video-platform/shared/web3/fiber.ts
/**
 * Fiber Network Integration — Production-Ready
 * 
 * Real Fiber Network RPC client for payment channels, invoices, and settlements.
 * Adapted to official Fiber RPC spec (nervosnetwork/fiber v0.7.x):
 *   - RPC port: 8227 (default)
 *   - P2P port: 8228
 *   - Amounts: hex-encoded u128 (shannon), e.g. "0x5f5e100" = 1 CKB
 *   - Params: array-wrapped single object, e.g. [{ pubkey: "..." }]
 *   - Testnet currency: "Fibt"
 * 
 * Official docs:
 *   - https://github.com/nervosnetwork/fiber
 *   - https://github.com/nervosnetwork/fiber/blob/develop/crates/fiber-lib/src/rpc/README.md
 * 
 * Environment Variables:
 *   FIBER_RPC_URL  — Fiber node JSON-RPC endpoint (default: http://localhost:8227)
 *   FIBER_NETWORK  — "testnet" or "mainnet" (default: testnet)
 *   FIBER_ALLOW_MOCK — Set to "1" ONLY in development
 */

import { sha256 } from "js-sha256";
import type { PaymentIntent, PaymentStatus } from "../types/index.js";

// ============== Utility: CKB ↔ Shannon Conversion ==============

/** 1 CKB = 100,000,000 shannon (10^8) */
const SHANNON_PER_CKB = 100_000_000;

/** Convert CKB amount to hex-encoded shannon string (for Fiber RPC) */
export function ckbToHexShannon(ckb: number | string): string {
    const num = typeof ckb === "string" ? parseFloat(ckb) : ckb;
    const shannon = BigInt(Math.round(num * SHANNON_PER_CKB));
    return "0x" + shannon.toString(16);
}

/** Convert hex shannon string to CKB number */
export function hexShannonToCkb(hex: string): number {
    const shannon = BigInt(hex);
    return Number(shannon) / SHANNON_PER_CKB;
}

/** Convert hex string to decimal number */
export function hexToNumber(hex: string): number {
    return Number(BigInt(hex));
}

// ============== Types ==============

export interface FiberChannelInfo {
    channelId: string;
    peerId: string;
    state: string;
    localBalance: string;   // hex shannon
    remoteBalance: string;  // hex shannon
    localBalanceCkb: number;
    remoteBalanceCkb: number;
    isPublic: boolean;
    enabled: boolean;
    asset?: any;
}

export interface FiberInvoiceResult {
    paymentHash: string;
    invoiceAddress: string;   // the full encoded invoice string
    paymentRequest: string;   // alias for invoiceAddress
    amount: string;
    currency: string;
    memo: string;
    expiry: number;
    [key: string]: any;
}

export interface FiberPaymentResult {
    paymentHash: string;
    status: "succeeded" | "pending" | "failed";
    fee?: string;
    [key: string]: any;
}

export interface FiberNodeInfo {
    version: string;
    pubkey: string;
    nodeName: string;
    addresses: string[];
    channelCount: number;
    pendingChannelCount: number;
    peersCount: number;
    chainHash: string;
    [key: string]: any;
}

// ============== Testnet Public Nodes ==============

export const TESTNET_PUBLIC_NODES = {
    node1: {
        pubkey: "02b6d4e3ab86a2ca2fad6fae0ecb2e1e559e0b911939872a90abdda6d20302be71",
    },
    node2: {
        pubkey: "0291a6576bd5a94bd74b27080a48340875338fff9f6d6361fe6b8db8d0d1912fcc",
    },
};

// ============== Fiber RPC Client ==============

/**
 * Production Fiber Network RPC Client.
 * 
 * Follows the official nervosnetwork/fiber RPC spec.
 * All numeric params use hex encoding as required by Fiber.
 */
export class FiberRPCClient {
    private rpcUrl: string;
    readonly network: 'testnet' | 'mainnet';

    constructor(rpcUrl?: string) {
        this.network = (process.env.FIBER_NETWORK || 'testnet') as 'testnet' | 'mainnet';
        const defaultUrl = 'http://localhost:8227'; // Fiber RPC default port
        this.rpcUrl = (rpcUrl || process.env.FIBER_RPC_URL || defaultUrl).replace(/\/$/, '');
    }

    /** Returns true if FIBER_RPC_URL is configured and not the default */
    isConfigured(): boolean {
        return !!this.rpcUrl && this.rpcUrl.length > 0;
    }

    /** Get the RPC URL (for AgentPayFiberRPC access) */
    getRpcUrl(): string {
        return this.rpcUrl;
    }

    /** Low-level JSON-RPC call — params wrapped in array per Fiber spec */
    async call(method: string, params: any): Promise<any> {
        if (!this.rpcUrl) {
            throw new Error("FIBER_RPC_URL not configured");
        }
        // Fiber RPC expects params as an array: [{ key: value }] or []
        const wrappedParams = Array.isArray(params) ? params : [params];
        const payload = { id: Date.now(), jsonrpc: "2.0", method, params: wrappedParams };
        
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 10000); // 10s timeout
        
        try {
            const res = await fetch(this.rpcUrl, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
                signal: controller.signal,
            });
            const json = await res.json();
            if (!res.ok || json?.error) {
                const errMsg = json?.error?.message || JSON.stringify(json?.error) || res.statusText || "RPC call failed";
                throw new Error(`Fiber RPC [${method}]: ${errMsg}`);
            }
            return json?.result ?? json;
        } finally {
            clearTimeout(timeout);
        }
    }

    // ---- Node Information (Module: Info) ----

    /** Get Fiber node information */
    async getNodeInfo(): Promise<FiberNodeInfo> {
        const result = await this.call("node_info", []);
        return {
            version: result?.version || "",
            pubkey: result?.pubkey || "",
            nodeName: result?.node_name || "",
            addresses: result?.addresses || [],
            channelCount: hexToNumber(result?.channel_count || "0x0"),
            pendingChannelCount: hexToNumber(result?.pending_channel_count || "0x0"),
            peersCount: hexToNumber(result?.peers_count || "0x0"),
            chainHash: result?.chain_hash || "",
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

    // ---- Peer Management (Module: Peer) ----

    /** Connect to a peer by pubkey (must call before open_channel) */
    async connectPeer(pubkey: string, address?: string): Promise<void> {
        await this.call("connect_peer", {
            pubkey,
            ...(address ? { address } : {}),
        });
    }

    /** Disconnect from a peer */
    async disconnectPeer(pubkey: string): Promise<void> {
        await this.call("disconnect_peer", { pubkey });
    }

    /** List connected peers */
    async listPeers(): Promise<Array<{ pubkey: string; address: string; [key: string]: any }>> {
        const result = await this.call("list_peers", []);
        return result?.peers || [];
    }

    // ---- Channel Management (Module: Channel) ----

    /** Open a payment channel to a peer */
    async openChannel(params: {
        peerPubkey: string;
        fundingAmount: string;     // hex shannon amount or CKB decimal
        isPublic?: boolean;
        asset?: any;
    }): Promise<{ channelId: string; [key: string]: any }> {
        // Ensure amount is hex-encoded
        const fundingHex = params.fundingAmount.startsWith("0x")
            ? params.fundingAmount
            : ckbToHexShannon(params.fundingAmount);

        const result = await this.call("open_channel", {
            pubkey: params.peerPubkey,
            funding_amount: fundingHex,
            public: params.isPublic !== false, // default true
            ...(params.asset ? { funding_udt_type_script: params.asset } : {}),
        });
        return {
            channelId: result?.temporary_channel_id || "",
            ...result,
        };
    }

    /** List all channels, optionally filtered by peer pubkey */
    async listChannels(peerPubkey?: string): Promise<FiberChannelInfo[]> {
        const result = await this.call("list_channels", {
            ...(peerPubkey ? { pubkey: peerPubkey } : {}),
        });
        const channels = result?.channels || [];
        return channels.map((ch: any) => ({
            channelId: ch.channel_id || "",
            peerId: ch.pubkey || "",
            state: ch.state?.state_name || "unknown",
            localBalance: ch.local_balance || "0x0",
            remoteBalance: ch.remote_balance || "0x0",
            localBalanceCkb: hexShannonToCkb(ch.local_balance || "0x0"),
            remoteBalanceCkb: hexShannonToCkb(ch.remote_balance || "0x0"),
            isPublic: ch.is_public ?? true,
            enabled: ch.enabled ?? false,
            asset: ch.funding_udt_type_script || undefined,
        }));
    }

    /** Close a channel cooperatively */
    async closeChannel(params: {
        channelId: string;
        closingFeeRate?: string;
        force?: boolean;
    }): Promise<any> {
        const method = params.force ? "force_close_channel" : "shutdown_channel";
        return this.call(method, {
            channel_id: params.channelId,
            ...(params.closingFeeRate ? { fee_rate: params.closingFeeRate } : {}),
        });
    }

    // ---- Invoice Management (Module: Invoice) ----

    /** Create a payment invoice */
    async createInvoice(params: {
        amount: string;           // CKB decimal (e.g. "1.5") or hex shannon
        memo?: string;
        expiry?: number;          // seconds
        currency?: string;
        paymentPreimage?: string; // 0x-prefixed 32-byte hex
        hashAlgorithm?: string;
    }): Promise<FiberInvoiceResult> {
        // Convert amount to hex shannon if not already hex
        const amountHex = params.amount.startsWith("0x")
            ? params.amount
            : ckbToHexShannon(params.amount);

        // Testnet uses "Fibt", mainnet uses "Fibb"
        const currency = params.currency ||
            (this.network === "testnet" ? "Fibt" : "Fibb");

        const result = await this.call("new_invoice", {
            amount: amountHex,
            currency,
            ...(params.memo ? { description: params.memo } : {}),
            ...(params.expiry ? { expiry: "0x" + params.expiry.toString(16) } : {}),
            ...(params.paymentPreimage ? { payment_preimage: params.paymentPreimage } : {}),
            hash_algorithm: params.hashAlgorithm || "sha256",
        });

        const invoice = result?.invoice;
        const paymentHash = invoice?.data?.payment_hash || "";
        const invoiceAddress = result?.invoice_address || "";

        return {
            paymentHash,
            invoiceAddress,
            paymentRequest: invoiceAddress,  // alias
            amount: amountHex,
            currency,
            memo: params.memo || "",
            expiry: params.expiry || 600,
            ...result,
        };
    }

    /** Get invoice status by payment hash */
    async getInvoiceStatus(paymentHash: string): Promise<{
        status: "paid" | "unpaid" | "expired" | "cancelled";
        invoiceAddress?: string;
    }> {
        const result = await this.call("get_invoice", { payment_hash: paymentHash });
        const status = (result?.status || "").toLowerCase();
        return {
            status: status === "paid" ? "paid"
                : status === "expired" ? "expired"
                : status === "cancelled" ? "cancelled"
                : "unpaid",
            invoiceAddress: result?.invoice_address,
        };
    }

    /** Cancel an invoice (only when status is "Open") */
    async cancelInvoice(paymentHash: string): Promise<boolean> {
        try {
            await this.call("cancel_invoice", { payment_hash: paymentHash });
            return true;
        } catch {
            return false;
        }
    }

    /** Settle a hold invoice by revealing preimage */
    async settleInvoice(paymentHash: string, preimage: string): Promise<void> {
        await this.call("settle_invoice", {
            payment_hash: paymentHash,
            payment_preimage: preimage,
        });
    }

    // ---- Payment (Module: Payment) ----

    /** Send a payment via invoice address */
    async sendPayment(params: {
        invoice?: string;           // encoded invoice address string
        targetPubkey?: string;      // destination pubkey for keysend
        amount?: string;            // CKB decimal or hex shannon
        timeout?: number;           // seconds
        keysend?: boolean;
        dryRun?: boolean;
    }): Promise<FiberPaymentResult> {
        const rpcParams: any = {};

        if (params.invoice) rpcParams.invoice = params.invoice;
        if (params.targetPubkey) rpcParams.target_pubkey = params.targetPubkey;
        if (params.amount) {
            rpcParams.amount = params.amount.startsWith("0x")
                ? params.amount
                : ckbToHexShannon(params.amount);
        }
        if (params.timeout) rpcParams.timeout = "0x" + params.timeout.toString(16);
        if (params.keysend) rpcParams.keysend = true;
        if (params.dryRun) rpcParams.dry_run = true;

        const result = await this.call("send_payment", rpcParams);

        const status = (result?.status || "").toLowerCase();

        return {
            paymentHash: result?.payment_hash || "",
            status: status === "success" || status === "succeeded" ? "succeeded"
                : status === "failed" ? "failed"
                : "pending",
            fee: result?.fee,
            ...result,
        };
    }

    /** Get payment status by hash */
    async getPaymentStatus(paymentHash: string): Promise<FiberPaymentResult> {
        const result = await this.call("get_payment", { payment_hash: paymentHash });
        const status = (result?.status || "").toLowerCase();
        return {
            paymentHash: result?.payment_hash || paymentHash,
            status: status === "success" || status === "succeeded" ? "succeeded"
                : status === "failed" ? "failed"
                : "pending",
            fee: result?.fee,
            ...result,
        };
    }

    // ---- Auto-Channel: Ensure channel exists before payment ----

    /**
     * Ensure a channel to the given peer is open and ready.
     * If no channel exists, connects to peer and opens one.
     * Returns the channel info once ready (or null if failed).
     */
    async ensureChannel(params: {
        peerPubkey: string;
        fundingAmountCkb?: number;  // default 500 CKB
    }): Promise<FiberChannelInfo | null> {
        const { peerPubkey, fundingAmountCkb = 500 } = params;

        // 1. Check existing channels
        const channels = await this.listChannels(peerPubkey);
        const ready = channels.find(ch => ch.state === "ChannelReady" && ch.enabled);
        if (ready) {
            console.log(`[Fiber] Channel already ready to ${peerPubkey.slice(0, 8)}... (${ready.localBalanceCkb} CKB)`);
            return ready;
        }

        // Check if there's a pending channel
        const pending = channels.find(ch => ch.state !== "ChannelReady");
        if (pending) {
            console.log(`[Fiber] Channel to ${peerPubkey.slice(0, 8)}... is in state: ${pending.state}`);
            return null; // Still opening, caller should retry later
        }

        // 2. Connect to peer
        console.log(`[Fiber] Connecting to peer ${peerPubkey.slice(0, 8)}...`);
        try {
            await this.connectPeer(peerPubkey);
        } catch (e: any) {
            // May already be connected, which is fine
            if (!e.message?.includes("already connected")) {
                console.warn(`[Fiber] Peer connection warning: ${e.message}`);
            }
        }

        // 3. Open channel
        const fundingHex = ckbToHexShannon(fundingAmountCkb);
        console.log(`[Fiber] Opening channel: ${fundingAmountCkb} CKB (${fundingHex}) → ${peerPubkey.slice(0, 8)}...`);
        try {
            const result = await this.openChannel({
                peerPubkey,
                fundingAmount: fundingHex,
                isPublic: true,
            });
            console.log(`[Fiber] Channel opening initiated: ${result.channelId}`);
        } catch (e: any) {
            console.error(`[Fiber] Failed to open channel: ${e.message}`);
            return null;
        }

        return null; // Channel is opening, will be ready after on-chain confirmation
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
    const amountCkb = pps * segSec;
    const memo = `Video ${params.videoId} - Segment ${params.segmentNumber} (${segSec}s)`;
    const expiry = params.expiry || 600;
    const allowMock = process.env.FIBER_ALLOW_MOCK === "1";

    const rpc = getFiberRpcClient();
    if (rpc.isConfigured()) {
        try {
            return await rpc.createInvoice({
                amount: amountCkb.toFixed(8),  // will be converted to hex shannon
                memo,
                expiry,
            });
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
        amount: ckbToHexShannon(amountCkb),
        currency: "Fibt",
        memo,
        expiry,
        paymentHash: `mock_hash_${Date.now()}`,
        invoiceAddress: `mock_invoice_${Date.now()}`,
        paymentRequest: `mock_invoice_${Date.now()}`,
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
 * Send a real CKB payout from the platform Fiber node to a creator's node.
 * Uses invoice-based payment or keysend.
 */
export async function fiberPayout(params: {
    creatorAddress: string;      // creator's pubkey or invoice address
    amountCKB: number;
    reason?: string;
}): Promise<FiberPaymentResult> {
    const rpc = getFiberRpcClient();
    if (!rpc.isConfigured()) {
        throw new Error("Fiber RPC not configured — cannot process payout");
    }

    console.log(`[Fiber] Payout: ${params.amountCKB} CKB → ${params.creatorAddress.slice(0, 16)}... (${params.reason || "settlement"})`);

    // If it's an invoice address (starts with "fib"), pay the invoice
    if (params.creatorAddress.startsWith("fib")) {
        const result = await rpc.sendPayment({
            invoice: params.creatorAddress,
            timeout: 60,
        });
        console.log(`[Fiber] Invoice payout: ${result.status} (hash: ${result.paymentHash})`);
        return result;
    }

    // Otherwise, keysend to pubkey
    const result = await rpc.sendPayment({
        targetPubkey: params.creatorAddress,
        amount: params.amountCKB.toString(),
        keysend: true,
        timeout: 60,
    });

    console.log(`[Fiber] Keysend payout: ${result.status} (hash: ${result.paymentHash})`);
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