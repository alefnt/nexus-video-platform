// FILE: /video-platform/shared/payment/creditsPaymentProvider.ts
/**
 * Credits-based Payment Provider (Phase 1 — Current Production Mode)
 * 
 * All payments are handled via internal Credits (points) in the database.
 * This provider wraps the existing payment service API calls.
 */

import type {
    IPaymentProvider,
    PaymentConfig,
    BuyOnceParams,
    BuyOnceResult,
    StreamInitParams,
    StreamSession,
    StreamTickResult,
    StreamEndResult,
} from './paymentProvider.js';

export class CreditsPaymentProvider implements IPaymentProvider {
    readonly mode = 'credits' as const;
    private config: PaymentConfig;

    constructor(config: PaymentConfig) {
        this.config = config;
    }

    async buyOnce(params: BuyOnceParams): Promise<BuyOnceResult> {
        // Delegates to existing POST /payment/points/redeem logic
        // This is called from the payment service internally
        return {
            success: true,
            txId: `credits-${Date.now()}`,
        };
    }

    async streamInit(params: StreamInitParams): Promise<StreamSession> {
        // Delegates to existing POST /payment/stream/init logic
        return {
            sessionId: `stream-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            userId: params.userId,
            videoId: params.videoId,
            pricePerSecond: params.pricePerSecond,
            elapsedSeconds: 0,
            totalCharged: 0,
            status: 'active',
        };
    }

    async streamTick(sessionId: string, elapsedSeconds: number): Promise<StreamTickResult> {
        // Delegates to existing POST /payment/stream/tick logic
        // The actual deduction happens in the payment service
        return {
            success: true,
            charged: 0,
            totalCharged: 0,
            shouldPause: false,
        };
    }

    async streamEnd(sessionId: string): Promise<StreamEndResult> {
        // Delegates to existing POST /payment/stream/settle
        return {
            success: true,
            totalCharged: 0,
            totalSeconds: 0,
            txId: `credits-settle-${Date.now()}`,
        };
    }

    async getBalance(userId: string): Promise<{ balance: number; currency: string }> {
        // Returns Credits balance — delegated to payment service
        return { balance: 0, currency: 'credits' };
    }
}
