// FILE: /client-web/src/lib/fiberPayment.ts
/**
 * Fiber Network 流支付辅助函数
 * 用于处理发票支付、通道余额查询等；流支付当前通过后端积分系统结算。
 * 参考: https://github.com/nervosnetwork/fiber (Fiber Network Protocol)
 */

import { calculateSegmentDuration, calculateTotalSegments } from '@video-platform/shared/web3/fiber';
import { signRawTransaction } from '@joyid/ckb';
import { getApiClient } from './apiClient';

// Fiber payment flow:
// Client → Backend API (/payment/stream/pay) → settlementWorker → Fiber RPC → Creator
// The client does NOT interact with Fiber RPC directly.
// Channel balance is queried via the backend API.

/**
 * 支付 Fiber 发票（通过后端积分系统）
 * @param invoice - Fiber 发票字符串（包含 sessionId 和 segment 信息）
 * @param silent - 是否静默支付（自动续费场景）
 */
export async function payFiberInvoice(invoice: string, silent: boolean = false): Promise<{
    success: boolean;
    error?: string;
}> {
    try {
        console.log('[Fiber Payment] Paying invoice:', invoice, 'silent:', silent);

        const jwt = typeof window !== 'undefined' ? sessionStorage.getItem('vp.jwt') : null;
        if (!jwt) {
            return { success: false, error: 'Not logged in' };
        }

        const api = getApiClient();
        api.setJWT(jwt);
        const result = await api.post<{ error?: string }>('/payment/stream/pay', { invoice });

        if (result?.error) {
            console.error('[Fiber Payment] Payment failed:', result.error);
            return { success: false, error: result.error };
        }
        console.log('[Fiber Payment] Payment successful:', result);
        return { success: true };
    } catch (e: any) {
        console.error('[Fiber Payment] Payment error:', e);
        return {
            success: false,
            error: e?.message || String(e)
        };
    }
}

/**
 * 使用 JoyID 签名 Fiber 交易
 * @param txSkeleton - 交易骨架
 */
export async function signFiberTransactionWithJoyID(txSkeleton: any): Promise<{
    success: boolean;
    signedTx?: any;
    error?: string;
}> {
    try {
        const userRaw = typeof window !== 'undefined' ? sessionStorage.getItem('vp.user') : null;
        const user = userRaw ? JSON.parse(userRaw) : null;

        if (!user?.ckbAddress) {
            return {
                success: false,
                error: 'User not logged in with JoyID'
            };
        }

        const signedTx = await signRawTransaction(txSkeleton, user.ckbAddress);

        return {
            success: true,
            signedTx
        };
    } catch (e: any) {
        console.error('[JoyID] Signing error:', e);
        return {
            success: false,
            error: e?.message || String(e)
        };
    }
}

/**
 * Check Fiber channel balance via backend API
 * @param userPubkey - User public key or CKB address
 */
export async function checkChannelBalance(userPubkey: string): Promise<{
    available: boolean;
    balance?: number;
    error?: string;
}> {
    try {
        console.log('[Fiber] Checking channel balance for:', userPubkey);

        const jwt = typeof window !== 'undefined' ? sessionStorage.getItem('vp.jwt') : null;
        if (!jwt) {
            return { available: false, error: 'Not logged in' };
        }

        const api = getApiClient();
        api.setJWT(jwt);

        // Query backend for Fiber channel status
        const result = await api.get<{ balance?: number; channels?: number; error?: string }>(
            `/payment/fiber/balance?address=${encodeURIComponent(userPubkey)}`
        );

        if (result?.error) {
            return { available: false, error: result.error };
        }

        const balance = result?.balance ?? 0;
        return {
            available: balance > 0,
            balance,
        };
    } catch (e: any) {
        console.error('[Fiber] Balance check error:', e);
        return {
            available: false,
            error: e?.message || String(e)
        };
    }
}

/**
 * 引导用户开通 Fiber 通道
 */
export function openChannelPrompt(): void {
    const message = `You don't have a Fiber payment channel yet.\n\nFiber Network is a Lightning Network built on CKB:\n• Low-cost micropayments\n• Instant transaction confirmation\n• Enhanced privacy protection\n\nPlease visit the Fiber Network app to open a payment channel.`;

    import('../components/ui/ConfirmModal').then(({ showAlert }) => {
        showAlert({ title: 'Open Fiber Channel / 开通 Fiber 通道', message });
    });
    // Fallback for environments where dynamic import fails
}

/**
 * Calculate smart pre-authorization amount (per-second billing)
 * @param durationSeconds - content duration in seconds
 * @param pricePerSecond - price per second in points
 */
export function calculatePreAuthAmount(durationSeconds: number, pricePerSecond: number): {
    segmentSeconds: number;
    segmentAmount: number;
    totalSegments: number;
    estimatedTotal: number;
    /** @deprecated Use segmentSeconds instead */
    segmentMinutes: number;
    /** @deprecated Use pricePerSecond instead */
    pricePerMinute: number;
} {
    const segmentSeconds = calculateSegmentDuration(durationSeconds);
    const totalSegments = calculateTotalSegments(durationSeconds, segmentSeconds);
    const segmentAmount = Math.ceil(pricePerSecond * segmentSeconds);
    const estimatedTotal = segmentAmount * totalSegments;

    return {
        segmentSeconds,
        segmentAmount,
        totalSegments,
        estimatedTotal,
        // Legacy compat
        segmentMinutes: segmentSeconds / 60,
        pricePerMinute: pricePerSecond * 60,
    };
}

/**
 * Show stream payment disclosure dialog (per-second billing)
 */
export async function showStreamPaymentDisclosure(params: {
    videoDuration: number;
    segmentSeconds: number;
    segmentAmount: number;
    totalSegments: number;
    pricePerSecond: number;
    /** @deprecated */ segmentMinutes?: number;
    /** @deprecated */ pricePerMinute?: number;
}): Promise<boolean> {
    const { showPaymentModal } = await import('../components/PaymentModal');
    return showPaymentModal({
        type: 'stream-start',
        title: 'Stream Pay — 按秒计费',
        videoDuration: params.videoDuration,
        pricePerSecond: params.pricePerSecond,
        segmentSeconds: params.segmentSeconds,
        totalSegments: params.totalSegments,
        estimatedTotal: params.segmentAmount * params.totalSegments,
    });
}

/**
 * Show resume prompt
 */
export async function showResumePrompt(params: {
    paidSegments: number[];
    totalSegments: number;
    resumeFromSegment: number;
    segmentSeconds: number;
    /** @deprecated */ segmentMinutes?: number;
}): Promise<boolean> {
    const segSec = params.segmentSeconds ?? ((params.segmentMinutes ?? 1) * 60);
    const { showPaymentModal } = await import('../components/PaymentModal');
    return showPaymentModal({
        type: 'resume',
        title: 'Resume Watching',
        paidSegments: params.paidSegments,
        totalSegments: params.totalSegments,
        resumeFromSegment: params.resumeFromSegment,
        segmentMinutes: segSec / 60
    });
}

/**
 * Show continuation prompt
 */
export async function showContinuationPrompt(params: {
    currentSegment: number;
    totalSegments: number;
    nextSegmentSeconds: number;
    nextSegmentAmount: number;
    /** @deprecated */ nextSegmentMinutes?: number;
}): Promise<boolean> {
    const segSec = params.nextSegmentSeconds ?? ((params.nextSegmentMinutes ?? 1) * 60);
    const { showPaymentModal } = await import('../components/PaymentModal');
    return showPaymentModal({
        type: 'segment',
        title: `Segment ${params.currentSegment} Complete`,
        resumeFromSegment: params.currentSegment + 1,
        segmentMinutes: segSec / 60,
        amount: params.nextSegmentAmount,
        message: `Continue to segment ${params.currentSegment + 1}? ${params.totalSegments - params.currentSegment} segments remaining.`
    });
}
