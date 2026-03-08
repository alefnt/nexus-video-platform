/// <reference types="node" />
// FILE: /video-platform/shared/payment/paymentProvider.ts
/**
 * Payment Abstraction Layer — Supports switching between Credits and Fiber modes.
 * 
 * Environment Variables:
 *   PAYMENT_MODE — "credits" (default, uses platform Credits) or "fiber" (real Fiber Network)
 *   FIBER_NETWORK — "testnet" (default) or "mainnet"
 * 
 * When PAYMENT_MODE=credits:
 *   - Buy Once: deduct Credits from user balance (database)
 *   - Stream Pay: deduct Credits per tick interval (database)
 *   - Creator Payout: Credits → CKB/USDI → Fiber → Creator wallet (async)
 * 
 * When PAYMENT_MODE=fiber (future, requires JoyID Fiber signing):
 *   - Buy Once: instant Fiber channel payment (user → hub → creator)
 *   - Stream Pay: real off-chain Fiber streaming (user → hub → creator, auto-signed)
 *   - Creator Payout: channel balance already credited, close channel to settle
 */

// ============== Types ==============

export type PaymentMode = 'credits' | 'fiber';

export interface BuyOnceParams {
    userId: string;
    videoId: string;
    amount: number;
    currency: 'credits' | 'CKB' | 'USDI';
    creatorAddress?: string;
}

export interface BuyOnceResult {
    success: boolean;
    txId?: string;
    paymentHash?: string;
    error?: string;
}

export interface StreamInitParams {
    userId: string;
    videoId: string;
    pricePerSecond: number;
    currency: 'credits' | 'CKB' | 'USDI';
    creatorAddress?: string;
}

export interface StreamSession {
    sessionId: string;
    userId: string;
    videoId: string;
    pricePerSecond: number;
    elapsedSeconds: number;
    totalCharged: number;
    status: 'active' | 'paused' | 'completed';
}

export interface StreamTickResult {
    success: boolean;
    charged: number;
    totalCharged: number;
    remainingBalance?: number;
    shouldPause: boolean;
    error?: string;
}

export interface StreamEndResult {
    success: boolean;
    totalCharged: number;
    totalSeconds: number;
    txId?: string;
}

// ============== Abstract Provider ==============

export interface IPaymentProvider {
    readonly mode: PaymentMode;

    /** One-time purchase (buy to unlock) */
    buyOnce(params: BuyOnceParams): Promise<BuyOnceResult>;

    /** Initialize a streaming payment session */
    streamInit(params: StreamInitParams): Promise<StreamSession>;

    /** Tick a streaming session (called periodically, e.g. every 5s) */
    streamTick(sessionId: string, elapsedSeconds: number): Promise<StreamTickResult>;

    /** End a streaming session (user stops watching) */
    streamEnd(sessionId: string): Promise<StreamEndResult>;

    /** Check user balance / channel capacity */
    getBalance(userId: string): Promise<{ balance: number; currency: string }>;
}

// ============== Config ==============

export interface PaymentConfig {
    mode: PaymentMode;
    fiberNetwork: 'testnet' | 'mainnet';
    fiberRpcUrl: string;
    platformFeePercent: number;
    defaultCreatorRoyaltyPercent: number;
}

export function getPaymentConfig(): PaymentConfig {
    const mode = (process.env.PAYMENT_MODE || 'credits') as PaymentMode;
    const fiberNetwork = (process.env.FIBER_NETWORK || 'testnet') as 'testnet' | 'mainnet';

    const fiberRpcUrls: Record<string, string> = {
        testnet: process.env.FIBER_RPC_URL || 'http://localhost:8228',
        mainnet: process.env.FIBER_RPC_URL_MAINNET || 'https://fiber-mainnet.ckb.dev/rpc',
    };

    return {
        mode,
        fiberNetwork,
        fiberRpcUrl: process.env.FIBER_RPC_URL || fiberRpcUrls[fiberNetwork],
        platformFeePercent: Number(process.env.PLATFORM_FEE_PERCENTAGE || 5),
        defaultCreatorRoyaltyPercent: Number(process.env.CREATOR_ROYALTY_PERCENTAGE || 5),
    };
}

// ============== Factory ==============

let _provider: IPaymentProvider | null = null;

/**
 * Get the active payment provider based on PAYMENT_MODE environment variable.
 * 
 * Usage:
 *   const provider = await getPaymentProvider();
 *   // Works identically regardless of credits or fiber mode
 *   await provider.buyOnce({ userId, videoId, amount, currency: 'credits' });
 */
export async function getPaymentProvider(): Promise<IPaymentProvider> {
    if (_provider) return _provider;

    const config = getPaymentConfig();

    if (config.mode === 'fiber') {
        // Dynamically import to avoid loading Fiber modules when in credits mode
        const { FiberDirectPaymentProvider } = await import('./fiberPaymentProvider');
        _provider = new FiberDirectPaymentProvider(config);
    } else {
        // Default: Credits mode (current production behavior)
        const { CreditsPaymentProvider } = await import('./creditsPaymentProvider');
        _provider = new CreditsPaymentProvider(config);
    }

    return _provider!;
}

/** Reset provider (for testing or env change) */
export function resetPaymentProvider(): void {
    _provider = null;
}
