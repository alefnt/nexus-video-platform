/// <reference types="node" />
// FILE: /video-platform/shared/agentpay/fiber-rpc.ts
/**
 * Enhanced Fiber RPC Client for AgentPay
 *
 * Extends the base FiberRPCClient with:
 *   - Fix #1:  settleInvoice() — provider-side settlement
 *   - Fix #6:  healthCheck(), multi-URL failover, connection state tracking
 *   - Fix #12: cancelInvoice() — release locked funds on timeout
 */

import { FiberRPCClient } from '../web3/fiber.js';
import type { ConnectionState, ConnectionStateEvent, Hash256 } from './types.js';

// ============== Event Emitter (minimal, no external deps) ==============

type StateListener = (event: ConnectionStateEvent) => void;

// ============== Enhanced Fiber RPC ==============

export class AgentPayFiberRPC {
  private clients: FiberRPCClient[] = [];
  private activeIndex = 0;
  private _state: ConnectionState = 'disconnected';
  private listeners: StateListener[] = [];
  private healthInterval: ReturnType<typeof setInterval> | null = null;

  constructor(rpcUrls?: string[]) {
    const urls: string[] = rpcUrls?.length
      ? rpcUrls
      : (process.env.FIBER_RPC_URLS || process.env.FIBER_RPC_URL || 'http://localhost:8228')
          .split(',')
          .map((u: string) => u.trim())
          .filter(Boolean);

    this.clients = urls.map((url: string) => new FiberRPCClient(url));

    if (this.clients.length > 0) {
      this._state = 'disconnected'; // will be updated on first health check
    }
  }

  // ---- Connection State (Fix #6) ----

  get state(): ConnectionState {
    return this._state;
  }

  /** Register a listener for connection state changes */
  onStateChange(listener: StateListener): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  private setState(newState: ConnectionState, url: string, error?: string): void {
    if (newState === this._state) return;
    this._state = newState;
    const event: ConnectionStateEvent = {
      state: newState,
      url,
      error,
      timestamp: Date.now(),
    };
    for (const listener of this.listeners) {
      try { listener(event); } catch { /* ignore listener errors */ }
    }
  }

  // ---- Health Check (Fix #6) ----

  /**
   * Perform a health check on all configured RPC endpoints.
   * Updates connection state and selects the best active endpoint.
   */
  async healthCheck(): Promise<{ ok: boolean; activeUrl: string; state: ConnectionState }> {
    let anyOk = false;

    for (let i = 0; i < this.clients.length; i++) {
      try {
        const status = await this.clients[i].getStatus();
        if (status.ok) {
          if (!anyOk) {
            this.activeIndex = i;
          }
          anyOk = true;
        }
      } catch {
        // This endpoint is down, try next
      }
    }

    const activeClient = this.clients[this.activeIndex];
    const activeUrl = activeClient.getRpcUrl() || 'unknown';

    if (anyOk && this.activeIndex === 0) {
      this.setState('connected', activeUrl);
    } else if (anyOk) {
      this.setState('degraded', activeUrl, 'Primary endpoint down, using failover');
    } else {
      this.setState('disconnected', activeUrl, 'All endpoints unreachable');
    }

    return { ok: anyOk, activeUrl, state: this._state };
  }

  /**
   * Start periodic health checks.
   * @param intervalMs Check interval in milliseconds (default: 30000)
   */
  startHealthCheck(intervalMs = 30_000): void {
    this.stopHealthCheck();
    // Immediate first check
    this.healthCheck().catch(() => {});
    this.healthInterval = setInterval(() => {
      this.healthCheck().catch(() => {});
    }, intervalMs);
  }

  /** Stop periodic health checks */
  stopHealthCheck(): void {
    if (this.healthInterval) {
      clearInterval(this.healthInterval);
      this.healthInterval = null;
    }
  }

  // ---- Active Client with Failover ----

  /** Get the current active Fiber RPC client, with automatic failover */
  private async getActiveClient(): Promise<FiberRPCClient> {
    const primary = this.clients[this.activeIndex];
    try {
      const status = await primary.getStatus();
      if (status.ok) return primary;
    } catch { /* primary failed */ }

    // Try failover
    for (let i = 0; i < this.clients.length; i++) {
      if (i === this.activeIndex) continue;
      try {
        const status = await this.clients[i].getStatus();
        if (status.ok) {
          this.activeIndex = i;
          const url = this.clients[i].getRpcUrl() || 'unknown';
          this.setState('degraded', url, 'Switched to failover endpoint');
          return this.clients[i];
        }
      } catch { /* this one failed too */ }
    }

    // All failed
    this.setState('disconnected', 'all', 'All endpoints unreachable');
    throw new Error('All Fiber RPC endpoints unreachable');
  }

  // ---- Invoice Operations ----

  /**
   * Create a Hold Invoice.
   * The Provider creates this invoice and holds the preimage.
   */
  async createHoldInvoice(params: {
    amount: string;
    memo: string;
    expiry?: number;
    preimage: string;
  }): Promise<{ paymentHash: Hash256; paymentRequest: string; expiry: number }> {
    const client = await this.getActiveClient();
    const result = await client.createInvoice({
      amount: params.amount,
      memo: params.memo,
      expiry: params.expiry ?? 300, // Fix #12: 300s default, not 3600s
      paymentPreimage: params.preimage,
    });
    return {
      paymentHash: result.paymentHash,
      paymentRequest: result.paymentRequest,
      expiry: params.expiry ?? 300,
    };
  }

  /**
   * Settle (claim) a Hold Invoice by revealing the preimage.
   *
   * SECURITY (Fix #1): This is called by the Provider DIRECTLY on Fiber.
   * The preimage is never sent over HTTP to the Caller.
   */
  async settleInvoice(paymentHash: Hash256, preimage: string): Promise<boolean> {
    const client = await this.getActiveClient();
    try {
      await client.settleInvoice(paymentHash, preimage);
      return true;
    } catch (e: any) {
      console.error(`[AgentPayFiber] settleInvoice failed: ${e?.message}`);
      return false;
    }
  }

  /**
   * Cancel a Hold Invoice, releasing locked funds immediately.
   *
   * Fix #12: Called when payAndCall() times out to prevent funds from
   * being locked until the full invoice expiry.
   */
  async cancelInvoice(paymentHash: Hash256): Promise<boolean> {
    const client = await this.getActiveClient();
    try {
      return await client.cancelInvoice(paymentHash);
    } catch (e: any) {
      console.error(`[AgentPayFiber] cancelInvoice failed: ${e?.message}`);
      return false;
    }
  }

  /**
   * Check payment/invoice status by payment hash.
   * Used by Caller to verify Provider-side settlement (Fix #1).
   */
  async getPaymentStatus(paymentHash: Hash256): Promise<{
    settled: boolean;
    status: 'paid' | 'unpaid' | 'expired' | 'cancelled';
  }> {
    const client = await this.getActiveClient();
    const result = await client.getInvoiceStatus(paymentHash);
    return {
      settled: result.status === 'paid',
      status: result.status,
    };
  }

  /**
   * Send a payment via invoice string.
   */
  async sendPayment(params: {
    invoice: string;
    timeout?: number;
  }): Promise<{ paymentHash: Hash256; status: string }> {
    const client = await this.getActiveClient();
    const result = await client.sendPayment({
      invoice: params.invoice,
      timeout: params.timeout,
    });
    return {
      paymentHash: result.paymentHash,
      status: result.status,
    };
  }

  /** Cleanup */
  destroy(): void {
    this.stopHealthCheck();
    this.listeners = [];
  }
}
