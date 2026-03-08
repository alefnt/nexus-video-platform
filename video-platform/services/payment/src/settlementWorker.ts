/**
 * 结算工作流 Worker — BullMQ
 *
 * 处理三类结算任务：
 *   1. stream-settle  — Stream Pay 关闭时精确退款计算
 *   2. fiber-settle   — Fiber Invoice HTLC 结算 + 积分信用
 *   3. tip-settle     — 打赏分成 (创作者 80% / 平台 15% / 网络 5%)
 *
 * 所有任务失败自动重试 3 次，最终失败进入死信队列。
 * 未来升级路径：替换为 Temporal Activity（API 不变）。
 *
 * 依赖: shared/queue, @prisma/client
 */

import { createWorker, addJob, QUEUE_NAMES, type JobProcessor } from '@video-platform/shared/queue';
import { PrismaClient, Prisma } from '@prisma/client';
import { fiberPayout } from '@video-platform/shared/web3/fiber';
import { Job } from 'bullmq';

const prisma = new PrismaClient();

// ============== Job Data Types ==============

export interface StreamSettleData {
    sessionId: string;
    actualSeconds: number;
    userId: string;
    closedAt: string; // ISO timestamp
}

export interface FiberSettleData {
    invoiceId: string;
    preimage?: string;
    force?: boolean;
}

export interface TipSettleData {
    tipId: string;
    videoId: string;
    fromUserId: string;
    toCreatorId: string;
    amount: number;
    message?: string;
}

// ============== Settlement Constants ==============

const CREATOR_SHARE = 0.80;   // 80% to creator
const PLATFORM_SHARE = 0.15;  // 15% to platform
const NETWORK_SHARE = 0.05;   // 5% network fee
const POINTS_PER_CKB = 10000;

// ============== Stream Settle Processor ==============

async function processStreamSettle(job: Job<StreamSettleData>): Promise<{ refunded: number; settled: number }> {
    const { sessionId, actualSeconds, userId } = job.data;

    const session = await prisma.streamSession.findUnique({
        where: { sessionId },
        include: { invoices: true, video: { select: { creatorId: true } } },
    });

    if (!session) throw new Error(`Session ${sessionId} not found`);
    if (session.status === 'completed' && session.actualUsedSeconds > 0) {
        return { refunded: 0, settled: 0 }; // Already settled
    }

    const creatorId = session.video?.creatorId;

    // Calculate precise usage — per-second billing model
    const pricePerMinute = Number(session.pricePerMinute);
    const pricePerSecond = pricePerMinute / 60;

    // totalPaid is accumulated by the tick endpoint during playback
    const totalPaidAmount = Number(session.totalPaid) || 0;

    // Calculate actual used amount based on real watch time
    const actualAmount = Math.floor(actualSeconds * pricePerSecond);

    // Refund = paid - used (if positive)
    const refundAmount = Math.max(0, Math.floor(totalPaidAmount - actualAmount));

    console.log(`[Settlement] Stream ${sessionId}: paid=${totalPaidAmount}, used=${actualAmount.toFixed(2)}, refund=${refundAmount}`);

    // Atomic: close session + refund if needed
    await prisma.$transaction(async (tx) => {
        // 1. Mark session completed
        await tx.streamSession.update({
            where: { sessionId },
            data: {
                status: 'completed',
                actualUsedSeconds: actualSeconds,
            },
        });

        // 2. Refund unused amount
        if (refundAmount > 0) {
            await tx.user.update({
                where: { id: userId },
                data: { points: { increment: refundAmount } },
            });

            await tx.pointsTransaction.create({
                data: {
                    userId,
                    type: 'refund',
                    amount: refundAmount,
                    reason: `Stream refund: overcharged ${refundAmount} pts (session: ${sessionId.slice(0, 8)}...)`,
                },
            });

            console.log(`[Settlement] ✅ Refunded ${refundAmount} points to user ${userId.slice(0, 8)}`);
        }

        // 3. Credit creator with used amount (minus platform+network fee)
        const creatorAmount = Math.floor(actualAmount * CREATOR_SHARE);
        if (creatorAmount > 0 && creatorId) {
            await tx.user.update({
                where: { id: creatorId },
                data: { points: { increment: creatorAmount } },
            });

            await tx.pointsTransaction.create({
                data: {
                    userId: creatorId,
                    type: 'earn',
                    amount: creatorAmount,
                    reason: `Stream revenue: ${actualMinutes.toFixed(1)}min watched (video: ${session.videoId.slice(0, 8)}...)`,
                },
            });
        }
    });

    // 4. Async: push Fiber payout if creator has fiber address
    try {
        const creator = creatorId ? await prisma.user.findUnique({ where: { id: creatorId } }) : null;
        if (creator?.address) {
            const creatorAmount = Math.floor(actualAmount * CREATOR_SHARE);
            const ckbAmount = Math.floor(creatorAmount / POINTS_PER_CKB);
            if (ckbAmount > 0) {
                await addJob(QUEUE_NAMES.SETTLEMENT, 'fiber-payout', {
                    userId: creator.id,
                    address: creator.address,
                    amountCKB: ckbAmount,
                    reason: `Stream revenue for ${session.videoId}`,
                });
            }
        }
    } catch (err) {
        console.warn('[Settlement] Fiber payout job creation failed (non-fatal):', (err as Error).message);
    }

    return { refunded: refundAmount, settled: Math.floor(actualAmount) };
}

// ============== Fiber Settle Processor ==============

async function processFiberSettle(job: Job<FiberSettleData>): Promise<{ credited: number }> {
    const { invoiceId, preimage, force } = job.data;

    const inv = await prisma.fiberInvoice.findUnique({ where: { id: invoiceId } });
    if (!inv) throw new Error(`Invoice ${invoiceId} not found`);
    if (inv.credited) return { credited: 0 }; // Already settled

    // Check expiry
    if (inv.expiresAt && new Date() > inv.expiresAt) {
        await prisma.fiberInvoice.update({ where: { id: invoiceId }, data: { status: 'expired' } });
        throw new Error(`Invoice ${invoiceId} expired`);
    }

    let verified = false;

    // Path 1: Preimage verification
    if (preimage && inv.paymentHash) {
        const { createHash } = await import('crypto');
        const preimageBuffer = Buffer.from(preimage.replace('0x', ''), 'hex');
        const computedHash = '0x' + createHash('sha256').update(preimageBuffer).digest('hex');
        if (computedHash === inv.paymentHash) {
            verified = true;
        } else {
            throw new Error('Preimage does not match payment hash');
        }
    }

    // Path 2: Force settle (dev/mock)
    if (!verified && force) {
        verified = true;
    }

    if (!verified) {
        throw new Error('Payment not verified');
    }

    // Atomic: mark paid + credit points
    const pointsAmount = Number(inv.pointsToCredit);
    await prisma.$transaction([
        prisma.fiberInvoice.update({
            where: { id: invoiceId },
            data: { status: 'paid', credited: true, paidAt: new Date() },
        }),
        prisma.user.update({
            where: { id: inv.userId },
            data: { points: { increment: pointsAmount } },
        }),
        prisma.pointsTransaction.create({
            data: {
                userId: inv.userId,
                type: 'buy',
                amount: pointsAmount,
                reason: `Fiber payment ${inv.amount} ${inv.asset} (Job: ${job.id})`,
            },
        }),
    ]);

    console.log(`[Settlement] ✅ Fiber invoice ${invoiceId} settled: +${pointsAmount} points`);
    return { credited: pointsAmount };
}

// ============== Tip Settle Processor ==============

async function processTipSettle(job: Job<TipSettleData>): Promise<{ creatorEarned: number }> {
    const { tipId, fromUserId, toCreatorId, amount } = job.data;

    const creatorAmount = Math.floor(amount * CREATOR_SHARE);
    const platformAmount = Math.floor(amount * PLATFORM_SHARE);

    // Atomic: deduct from sender + credit creator
    await prisma.$transaction(async (tx) => {
        // Check sender balance
        const sender = await tx.user.findUnique({ where: { id: fromUserId } });
        if (!sender || Number(sender.points) < amount) {
            throw new Error('Insufficient balance for tip');
        }

        // Deduct from sender
        await tx.user.update({
            where: { id: fromUserId },
            data: { points: { decrement: amount } },
        });

        // Credit creator (80%)
        await tx.user.update({
            where: { id: toCreatorId },
            data: { points: { increment: creatorAmount } },
        });

        // Record transactions
        await tx.pointsTransaction.createMany({
            data: [
                {
                    userId: fromUserId,
                    type: 'redeem',
                    amount: -amount,
                    reason: `Tip sent (${tipId.slice(0, 8)})`,
                },
                {
                    userId: toCreatorId,
                    type: 'earn',
                    amount: creatorAmount,
                    reason: `Tip received: ${amount} pts (80% split)`,
                },
            ],
        });
    });

    console.log(`[Settlement] ✅ Tip ${tipId}: ${amount} → creator ${creatorAmount} / platform ${platformAmount}`);
    return { creatorEarned: creatorAmount };
}

// ============== Fiber Payout Processor ==============

interface FiberPayoutData {
    userId: string;
    address: string;
    amountCKB: number;
    reason?: string;
}

async function processFiberPayout(job: Job<FiberPayoutData>): Promise<{ status: string; paymentHash?: string }> {
    const { userId, address, amountCKB, reason } = job.data;

    if (!address || amountCKB <= 0) {
        console.warn(`[Settlement] Fiber payout skipped: invalid params (address=${address}, amount=${amountCKB})`);
        return { status: 'skipped' };
    }

    try {
        const result = await fiberPayout({
            creatorAddress: address,
            amountCKB,
            reason: reason || `Settlement payout for ${userId}`,
        });

        if (result.status === 'succeeded') {
            // Record successful payout in DB
            await prisma.pointsTransaction.create({
                data: {
                    userId,
                    type: 'payout',
                    amount: -amountCKB,
                    reason: `Fiber payout: ${amountCKB} CKB → ${address.slice(0, 16)}... (hash: ${result.paymentHash?.slice(0, 16)}...)`,
                },
            });
            console.log(`[Settlement] ✅ Fiber payout succeeded: ${amountCKB} CKB → ${address.slice(0, 16)}...`);
            return { status: 'succeeded', paymentHash: result.paymentHash };
        } else {
            console.warn(`[Settlement] Fiber payout pending/failed: ${result.status}`);
            return { status: result.status, paymentHash: result.paymentHash };
        }
    } catch (err: any) {
        console.error(`[Settlement] Fiber payout error:`, err?.message);
        throw err; // BullMQ will retry
    }
}

// ============== Unified Router ==============

async function settlementRouter(job: Job): Promise<any> {
    console.log(`[Settlement] Processing job: ${job.name} (${job.id})`);

    switch (job.name) {
        case 'stream-settle':
            return processStreamSettle(job as Job<StreamSettleData>);
        case 'fiber-settle':
            return processFiberSettle(job as Job<FiberSettleData>);
        case 'tip-settle':
            return processTipSettle(job as Job<TipSettleData>);
        case 'fiber-payout':
            return processFiberPayout(job);
        default:
            console.warn(`[Settlement] Unknown job type: ${job.name}`);
            return { status: 'skipped' };
    }
}

// ============== Worker Init ==============

let workerStarted = false;

export function startSettlementWorker(): void {
    if (workerStarted) return;
    workerStarted = true;

    createWorker(
        QUEUE_NAMES.SETTLEMENT,
        settlementRouter as JobProcessor<any, any>,
        3 // concurrency
    );

    console.log('[Settlement] ⚡ Worker started (concurrency: 3)');
}

// ============== Helper: Enqueue Settlement Jobs ==============

export async function enqueueStreamSettle(data: StreamSettleData) {
    return addJob(QUEUE_NAMES.SETTLEMENT, 'stream-settle', data, {
        attempts: 3,
        backoff: { type: 'exponential', delay: 2000 },
    });
}

export async function enqueueFiberSettle(data: FiberSettleData) {
    return addJob(QUEUE_NAMES.SETTLEMENT, 'fiber-settle', data, {
        attempts: 3,
        backoff: { type: 'exponential', delay: 2000 },
    });
}

export async function enqueueTipSettle(data: TipSettleData) {
    return addJob(QUEUE_NAMES.SETTLEMENT, 'tip-settle', data, {
        attempts: 3,
        backoff: { type: 'exponential', delay: 1000 },
    });
}
