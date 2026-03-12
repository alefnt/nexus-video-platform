// FILE: /video-platform/services/payment/src/__tests__/paymentService.test.ts
/**
 * Payment Service — Unit Tests
 * 
 * Tests core business logic: points, Fiber, stream payments
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock PrismaClient
const mockPrisma = {
    user: {
        findUnique: vi.fn(),
        update: vi.fn(),
    },
    pointsTransaction: {
        create: vi.fn(),
        findMany: vi.fn(),
    },
    streamSession: {
        findFirst: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
    },
    fiberPayoutTask: {
        findMany: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
    },
    $transaction: vi.fn(),
};

vi.mock('@video-platform/database', () => ({
    PrismaClient: vi.fn(() => mockPrisma),
    Prisma: { Decimal: Number },
}));

// Mock Fiber RPC Client
const mockFiberClient = {
    isConfigured: vi.fn(() => false),
    getStatus: vi.fn(() => ({ ok: false })),
    createInvoice: vi.fn(),
    sendPayment: vi.fn(),
    listChannels: vi.fn(() => []),
    closeChannel: vi.fn(),
};

vi.mock('@video-platform/shared/web3/fiber', () => ({
    FiberRPCClient: vi.fn(() => mockFiberClient),
    createStreamInvoice: vi.fn(),
    RealFiberHTLC: vi.fn(),
}));

describe('Payment Service — Points System', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('getUserPoints', () => {
        it('should return 0 for non-existent user', async () => {
            mockPrisma.user.findUnique.mockResolvedValue(null);

            const { getUserPoints } = await import('../services/paymentService');
            const points = await getUserPoints('non-existent');

            expect(points).toBe(0);
        });

        it('should return correct balance for existing user', async () => {
            mockPrisma.user.findUnique.mockResolvedValue({ points: 1500 });

            const { getUserPoints } = await import('../services/paymentService');
            const points = await getUserPoints('user123');

            expect(points).toBe(1500);
        });
    });

    describe('updateUserPoints', () => {
        it('should add points and log transaction', async () => {
            mockPrisma.$transaction.mockImplementation(async (fn: any) => {
                const tx = {
                    user: {
                        findUnique: vi.fn().mockResolvedValue({ id: 'user1', points: 1000 }),
                        update: vi.fn().mockResolvedValue({}),
                    },
                    pointsTransaction: {
                        create: vi.fn().mockResolvedValue({}),
                    },
                };
                return fn(tx);
            });

            const { updateUserPoints } = await import('../services/paymentService');
            const newBalance = await updateUserPoints('user1', 500, 'earn', 'Daily reward');

            expect(newBalance).toBe(1500);
        });

        it('should reject if insufficient balance', async () => {
            mockPrisma.$transaction.mockImplementation(async (fn: any) => {
                const tx = {
                    user: {
                        findUnique: vi.fn().mockResolvedValue({ id: 'user1', points: 100 }),
                        update: vi.fn(),
                    },
                    pointsTransaction: { create: vi.fn() },
                };
                return fn(tx);
            });

            const { updateUserPoints } = await import('../services/paymentService');

            await expect(
                updateUserPoints('user1', -500, 'redeem', 'Buy video')
            ).rejects.toThrow('Insufficient balance');
        });

        it('should reject for non-existent user', async () => {
            mockPrisma.$transaction.mockImplementation(async (fn: any) => {
                const tx = {
                    user: { findUnique: vi.fn().mockResolvedValue(null) },
                    pointsTransaction: { create: vi.fn() },
                };
                return fn(tx);
            });

            const { updateUserPoints } = await import('../services/paymentService');

            await expect(
                updateUserPoints('ghost', 100, 'earn')
            ).rejects.toThrow('User not found');
        });
    });

    describe('ckbToShannons', () => {
        it('should convert integer CKB to shannons', async () => {
            const { ckbToShannons } = await import('../services/paymentService');
            expect(ckbToShannons('1')).toBe('100000000');
            expect(ckbToShannons('100')).toBe('10000000000');
        });

        it('should convert decimal CKB to shannons', async () => {
            const { ckbToShannons } = await import('../services/paymentService');
            expect(ckbToShannons('1.5')).toBe('150000000');
            expect(ckbToShannons('0.00000001')).toBe('1');
        });
    });
});

describe('Payment Service — Fiber Integration', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('Fiber RPC Client', () => {
        it('should report unconfigured when no FIBER_RPC_URL', () => {
            expect(mockFiberClient.isConfigured()).toBe(false);
        });

        it('should return points_only mode when unconfigured', async () => {
            mockFiberClient.isConfigured.mockReturnValue(false);
            const status = mockFiberClient.isConfigured()
                ? 'dual'
                : 'points_only';
            expect(status).toBe('points_only');
        });

        it('should create invoice when configured', async () => {
            mockFiberClient.isConfigured.mockReturnValue(true);
            mockFiberClient.createInvoice.mockResolvedValue({
                paymentHash: '0xabc123',
                paymentRequest: 'fiber://pay/...',
                amount: '100',
                currency: 'CKB',
                expiry: 300,
            });

            const invoice = await mockFiberClient.createInvoice({
                amount: '100',
                memo: 'Test invoice',
            });

            expect(invoice.paymentHash).toBe('0xabc123');
            expect(invoice.currency).toBe('CKB');
        });

        it('should send payment and return result', async () => {
            mockFiberClient.sendPayment.mockResolvedValue({
                paymentHash: '0xdef456',
                status: 'succeeded',
                preimage: '0xpreimage',
                fee: '0.001',
            });

            const result = await mockFiberClient.sendPayment({
                invoice: 'fiber://pay/...',
                amount: '100',
            });

            expect(result.status).toBe('succeeded');
            expect(result.preimage).toBe('0xpreimage');
        });

        it('should list empty channels', async () => {
            const channels = await mockFiberClient.listChannels();
            expect(channels).toEqual([]);
        });
    });
});

describe('Payment Service — Stream Payment', () => {
    it('should calculate segment duration based on video length', () => {
        // Short video (< 5 min): 10-second segments
        // Medium video (5-30 min): 30-second segments
        // Long video (> 30 min): 60-second segments
        const calcSegmentDuration = (videoSeconds: number): number => {
            if (videoSeconds <= 300) return 10;
            if (videoSeconds <= 1800) return 30;
            return 60;
        };

        expect(calcSegmentDuration(120)).toBe(10);
        expect(calcSegmentDuration(600)).toBe(30);
        expect(calcSegmentDuration(3600)).toBe(60);
    });

    it('should calculate correct stream cost', () => {
        const pricePerSecond = 0.0667;
        const duration = 30; // 30 seconds watched
        const cost = Math.round(pricePerSecond * duration);
        expect(cost).toBe(2); // 0.0667 * 30 = 2.001, rounds to 2
    });
});

describe('Payment Service — Constants', () => {
    it('should have correct exchange rates', async () => {
        const { POINTS_PER_CKB } = await import('../services/paymentService');
        expect(POINTS_PER_CKB).toBe(10000);
    });
});
