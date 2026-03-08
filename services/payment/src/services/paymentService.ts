// FILE: /video-platform/services/payment/src/services/paymentService.ts
/**
 * Payment Service — Core business logic
 * Extracted from monolithic server.ts for testability and maintainability.
 */

import { PrismaClient, Prisma } from "@video-platform/database";

const prisma = new PrismaClient();

// ============== Constants ==============
export const POINTS_PER_USDI = 100;
export const POINTS_PER_CKB = 10000; // 1 CKB = 10000 Points
export const CKB_NODE_URL = process.env.CKB_NODE_URL || "https://testnet.ckb.dev/rpc";
export const CKB_INDEXER_URL = process.env.CKB_INDEXER_URL || "https://testnet.ckb.dev/indexer";
export const CKB_DEPOSIT_ADDRESS = process.env.CKB_DEPOSIT_ADDRESS || "";
export const ENABLE_POINTS_JOYID = process.env.ENABLE_POINTS_JOYID === "1";
export const POINTS_NONCE_TTL_MS = 5 * 60 * 1000;
export const POINTS_NONCE_TTL_SEC = 5 * 60;
export const FIBER_ALLOW_MOCK = process.env.FIBER_ALLOW_MOCK === "1";

// Redis nonce key prefixes
export const NONCE_PREFIX = {
    points: "payment:nonce:points",
    redeem: "payment:nonce:redeem",
    ckb: "payment:nonce:ckb",
};

// ============== User Types ==============
export interface RequestUser {
    sub: string;
    ckb?: string;
    role?: string;
    roles?: string[];
    [key: string]: any;
}

export interface CkbIntentStatusResponse {
    orderId: string;
    status: string;
    confirmations: number;
    creditedPoints?: number;
    expectedAmountShannons: string;
    txHash?: string | null;
}

// ============== Core Business Logic ==============

/** Get user points balance */
export async function getUserPoints(userId: string): Promise<number> {
    const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { points: true },
    });
    return Number(user?.points || 0);
}

/** Update user points balance atomically with transaction logging */
export async function updateUserPoints(
    userId: string,
    amount: number,
    txType: string,
    reason?: string,
): Promise<number> {
    return await prisma.$transaction(async (tx) => {
        const user = await tx.user.findUnique({ where: { id: userId } });
        if (!user) throw new Error("User not found");
        const newBalance = Number(user.points) + amount;
        if (newBalance < 0) throw new Error("Insufficient balance");
        await tx.user.update({ where: { id: userId }, data: { points: newBalance } });
        await tx.pointsTransaction.create({
            data: { userId, type: txType, amount, reason },
        });
        return newBalance;
    });
}

/** Convert CKB amount string to Shannons */
export function ckbToShannons(ckbStr: string): string {
    const [i, f = ""] = ckbStr.split(".");
    const frac = (f + "00000000").slice(0, 8);
    const big = BigInt(i) * 100000000n + BigInt(frac);
    return big.toString();
}

export { prisma };
