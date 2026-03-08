// FILE: /video-platform/shared/payment/index.ts
/**
 * Payment Module — Unified export
 * 
 * Usage:
 *   import { getPaymentProvider, getPaymentConfig } from '@video-platform/shared/payment';
 *   
 *   const provider = await getPaymentProvider();
 *   // Automatically uses credits or fiber based on PAYMENT_MODE env var
 *   await provider.buyOnce({ userId, videoId, amount: 100, currency: 'credits' });
 */

export {
    getPaymentProvider,
    resetPaymentProvider,
    getPaymentConfig,
    type IPaymentProvider,
    type PaymentMode,
    type PaymentConfig,
    type BuyOnceParams,
    type BuyOnceResult,
    type StreamInitParams,
    type StreamSession,
    type StreamTickResult,
    type StreamEndResult,
} from './paymentProvider.js';
