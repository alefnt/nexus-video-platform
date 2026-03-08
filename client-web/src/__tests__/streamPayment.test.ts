// FILE: /client-web/src/__tests__/streamPayment.test.ts
/**
 * 流支付功能自动化测试
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { StreamPaymentHandler } from '../lib/streamPaymentHandler';
import { ApiClient } from '@video-platform/shared/api/client';

// Mock API Client
vi.mock('@video-platform/shared/api/client');

describe('StreamPaymentHandler', () => {
    let handler: StreamPaymentHandler;
    let mockClient: ApiClient;
    let mockSetStatus: ReturnType<typeof vi.fn>;
    let mockOnPause: ReturnType<typeof vi.fn>;

    beforeEach(() => {
        mockClient = new ApiClient() as any;
        mockSetStatus = vi.fn();
        mockOnPause = vi.fn();

        handler = new StreamPaymentHandler(
            mockClient as any,
            mockSetStatus,
            mockOnPause
        );
    });

    afterEach(() => {
        handler.cleanup();
        vi.clearAllMocks();
    });

    describe('initStreamPayment', () => {
        it('should initialize a new streaming session successfully', async () => {
            // Mock API responses
            (mockClient.post as any) = vi.fn().mockResolvedValueOnce({
                sessionId: 'test-session-123',
                invoice: 'mock-invoice-abc',
                paymentHash: 'mock-hash-xyz',
                segmentAmount: 50,
                totalSegments: 4,
                paidSegments: [],
                resumeFromSegment: 1,
                isResume: false
            });

            const success = await handler.initStreamPayment({
                videoId: 'video-123',
                videoDuration: 1200, // 20 minutes
                pricePerSecond: 10 / 60
            });

            expect(success).toBe(true);
            expect(mockClient.post).toHaveBeenCalledWith('/payment/stream/init', expect.objectContaining({
                videoId: 'video-123',
                pricePerSecond: 10 / 60
            }));
            expect(mockSetStatus).toHaveBeenCalled();
        });

        it('should handle resume from existing session', async () => {
            (mockClient.post as any) = vi.fn().mockResolvedValueOnce({
                sessionId: 'test-session-123',
                invoice: 'mock-invoice-next',
                paymentHash: 'mock-hash-next',
                segmentAmount: 50,
                totalSegments: 4,
                paidSegments: [1, 2],
                resumeFromSegment: 3,
                isResume: true
            });

            const success = await handler.initStreamPayment({
                videoId: 'video-123',
                videoDuration: 1200,
                pricePerSecond: 10 / 60
            });

            expect(success).toBe(true);
            const session = handler.getSession();
            expect(session?.paidSegments).toEqual([1, 2]);
            expect(session?.currentSegment).toBe(3);
        });

        it('should handle initialization failure', async () => {
            (mockClient.post as any) = vi.fn().mockRejectedValueOnce(new Error('Network error'));

            const success = await handler.initStreamPayment({
                videoId: 'video-123',
                videoDuration: 1200,
                pricePerSecond: 10 / 60
            });

            expect(success).toBe(false);
            expect(mockSetStatus).toHaveBeenCalledWith(expect.stringContaining('失败'));
        });
    });

    describe('pauseSession', () => {
        it('should pause an active session', async () => {
            // Initialize session first
            (mockClient.post as any) = vi.fn()
                .mockResolvedValueOnce({
                    sessionId: 'test-session-123',
                    invoice: 'mock-invoice',
                    paymentHash: 'mock-hash',
                    segmentAmount: 50,
                    totalSegments: 4,
                    paidSegments: [],
                    resumeFromSegment: 1,
                    isResume: false
                })
                .mockResolvedValueOnce({
                    status: 'paused',
                    paidSegments: [1],
                    lastWatchedSegment: 1
                });

            await handler.initStreamPayment({
                videoId: 'video-123',
                videoDuration: 1200,
                pricePerSecond: 10 / 60
            });

            await handler.pauseSession();

            expect(mockClient.post).toHaveBeenCalledWith('/payment/stream/pause', expect.objectContaining({
                sessionId: 'test-session-123'
            }));
        });
    });

    describe('closeSession', () => {
        it('should close session and calculate refund', async () => {
            // Initialize session first
            (mockClient.post as any) = vi.fn()
                .mockResolvedValueOnce({
                    sessionId: 'test-session-123',
                    invoice: 'mock-invoice',
                    paymentHash: 'mock-hash',
                    segmentAmount: 50,
                    totalSegments: 4,
                    paidSegments: [],
                    resumeFromSegment: 1,
                    isResume: false
                })
                .mockResolvedValueOnce({
                    ok: true,
                    finalAmount: 97,
                    refundAmount: 3,
                    totalPaid: 100,
                    actualSeconds: 580
                });

            await handler.initStreamPayment({
                videoId: 'video-123',
                videoDuration: 1200,
                pricePerSecond: 10 / 60
            });

            await handler.closeSession();

            expect(mockClient.post).toHaveBeenCalledWith('/payment/stream/close', expect.objectContaining({
                sessionId: 'test-session-123'
            }));
        });
    });
});

describe('Segment Calculation', () => {
    it('should calculate correct segments for short video (2 min)', () => {
        const { calculateSegmentDuration, calculateTotalSegments } = require('@video-platform/shared/web3/fiber');

        const duration = 120; // 2 minutes
        const segmentSeconds = calculateSegmentDuration(duration);
        const totalSegments = calculateTotalSegments(duration, segmentSeconds);

        expect(segmentSeconds).toBe(30); // 30s per segment for <=120s
        expect(totalSegments).toBe(4);
    });

    it('should calculate correct segments for medium video (20 min)', () => {
        const { calculateSegmentDuration, calculateTotalSegments } = require('@video-platform/shared/web3/fiber');

        const duration = 1200; // 20 minutes
        const segmentSeconds = calculateSegmentDuration(duration);
        const totalSegments = calculateTotalSegments(duration, segmentSeconds);

        expect(segmentSeconds).toBe(120); // 120s per segment for 10-30min
        expect(totalSegments).toBe(10);
    });

    it('should calculate correct segments for long video (90 min)', () => {
        const { calculateSegmentDuration, calculateTotalSegments } = require('@video-platform/shared/web3/fiber');

        const duration = 5400; // 90 minutes
        const segmentSeconds = calculateSegmentDuration(duration);
        const totalSegments = calculateTotalSegments(duration, segmentSeconds);

        expect(segmentSeconds).toBe(300); // 300s per segment for >30min
        expect(totalSegments).toBe(18);
    });
});

describe('Payment Flow Integration', () => {
    it('should handle complete payment flow for 2-segment video', async () => {
        const mockClient = new ApiClient() as any;
        const statusUpdates: string[] = [];

        const handler = new StreamPaymentHandler(
            mockClient,
            (status) => statusUpdates.push(status),
            vi.fn()
        );

        // Mock API responses for complete flow
        (mockClient.post as any) = vi.fn()
            // Init
            .mockResolvedValueOnce({
                sessionId: 'session-1',
                invoice: 'invoice-1',
                paymentHash: 'hash-1',
                segmentAmount: 50,
                totalSegments: 2,
                paidSegments: [],
                resumeFromSegment: 1,
                isResume: false
            })
            // Tick
            .mockResolvedValueOnce({
                status: 'active',
                currentSegment: 1,
                remainingSeconds: 10,
                shouldPause: false,
                totalSegments: 2,
                paidSegments: [1]
            })
            // Renew
            .mockResolvedValueOnce({
                invoice: 'invoice-2',
                paymentHash: 'hash-2',
                nextSegment: 2,
                amount: 50
            })
            // Close
            .mockResolvedValueOnce({
                ok: true,
                finalAmount: 100,
                refundAmount: 0,
                totalPaid: 100,
                actualSeconds: 600
            });

        // Initialize
        const success = await handler.initStreamPayment({
            videoId: 'video-1',
            videoDuration: 600,
            pricePerSecond: 10 / 60
        });

        expect(success).toBe(true);
        expect(statusUpdates).toContain(expect.stringContaining('Initializing'));

        // Close session
        await handler.closeSession();

        expect(mockClient.post).toHaveBeenCalledTimes(2); // init + close
        expect(statusUpdates.length).toBeGreaterThan(0);

        handler.cleanup();
    });
});
