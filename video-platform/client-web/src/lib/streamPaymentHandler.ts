// FILE: /client-web/src/lib/streamPaymentHandler.ts
/**
 * 流支付处理逻辑 v3 — Per-Second Billing
 * 
 * 核心模型变更：
 * - 旧模型：分段付费 (buy segment 1, then segment 2...)
 * - 新模型：按秒计费 (每秒从余额扣费，分段只是展示用的进度刻度)
 * 
 * 用户体验：
 * 1. 开始播放 → 每秒自动扣费(后端处理)
 * 2. 进度条显示分段刻度(如12段×5分钟)，让用户直观了解花费
 * 3. 状态栏实时显示：已消费XX PTS, 剩余XX PTS, 可看约XX分钟
 * 4. 只在余额不足时才暂停并提示充值
 * 5. 已观看过的内容区间下次回看不再扣费(后端记录actualUsedSeconds)
 */

import { getApiClient } from './apiClient';
import {
    payFiberInvoice,
    calculatePreAuthAmount,
    showStreamPaymentDisclosure,
    showResumePrompt,
} from './fiberPayment';

export interface StreamPaymentSession {
    sessionId: string;
    videoId: string;
    segmentSeconds: number;        // Display segment duration (for UI markers)
    totalSegments: number;         // Display total segments
    currentSegment: number;        // Display current segment
    paidSegments: number[];        // Legacy — NOT used for billing, kept for compat
    pricePerSecond: number;
    tickIntervalId?: number;
    preAuthSegments: number;       // Legacy — not used in per-second model
    autoRenew: boolean;            // Legacy — always true
    consumedPoints: number;        // Total points consumed this session
    userBalance: number;           // Current user balance
}

export interface StreamMeterInfo {
    isActive: boolean;
    totalBalance: number;
    consumedPoints: number;
    pricePerSecond: number;
    currentSegment: number;
    totalSegments: number;
    paidSegments: number[];       // Legacy compat
    sessionId?: string;
    elapsedSeconds?: number;
    estimatedRemainingSeconds?: number;
}

type ApiClientLike = ReturnType<typeof getApiClient>;

export class StreamPaymentHandler {
    private client: ApiClientLike;
    private session: StreamPaymentSession | null = null;
    private tickIntervalId: number | null = null;
    private onStatusChange: (status: string) => void;
    private onPauseRequired: () => void;
    private onBalanceLow?: () => void;
    private onMeterUpdate?: (info: StreamMeterInfo) => void;
    private playerRef: any;
    private preAuthSegments: number = 1;

    constructor(
        client: ApiClientLike,
        onStatusChange: (status: string) => void,
        onPauseRequired: () => void,
        options?: {
            onBalanceLow?: () => void;
            onMeterUpdate?: (info: StreamMeterInfo) => void;
            preAuthSegments?: number;
        }
    ) {
        this.client = client;
        this.onStatusChange = onStatusChange;
        this.onPauseRequired = onPauseRequired;
        this.onBalanceLow = options?.onBalanceLow;
        this.onMeterUpdate = options?.onMeterUpdate;
        this.preAuthSegments = options?.preAuthSegments || 1;
    }

    setPreAuthSegments(count: number) {
        this.preAuthSegments = Math.max(1, Math.min(10, count));
    }

    getMeterInfo(): StreamMeterInfo {
        if (!this.session) {
            return {
                isActive: false, totalBalance: 0, consumedPoints: 0,
                pricePerSecond: 0, currentSegment: 0, totalSegments: 0, paidSegments: [],
            };
        }
        return {
            isActive: true,
            totalBalance: this.session.userBalance,
            consumedPoints: this.session.consumedPoints,
            pricePerSecond: this.session.pricePerSecond,
            currentSegment: this.session.currentSegment,
            totalSegments: this.session.totalSegments,
            paidSegments: this.session.paidSegments,
            sessionId: this.session.sessionId,
        };
    }

    private updateMeter() {
        if (this.onMeterUpdate) {
            this.onMeterUpdate(this.getMeterInfo());
        }
    }

    setPlayer(player: any) {
        this.playerRef = player;
        // No seek handler needed — per-second model doesn't block seeks
        // User can seek anywhere; if they seek to already-watched content, no charge
        // If they seek forward, new seconds will be billed as played
    }

    /**
     * 初始化流支付会话
     */
    async initStreamPayment(params: {
        videoId: string;
        videoDuration: number;
        pricePerSecond: number;
        pricePerMinute?: number;
    }): Promise<boolean> {
        try {
            const { videoId, videoDuration } = params;
            const pricePerSecond = params.pricePerSecond ?? ((params.pricePerMinute ?? 0) / 60);

            const { segmentSeconds, segmentAmount, totalSegments, estimatedTotal } =
                calculatePreAuthAmount(videoDuration, pricePerSecond);

            this.onStatusChange('Initializing stream payment...');

            // Check balance — need at least 1 segment's worth to start
            try {
                const balResp = await this.client.get<{ balance: number }>('/payment/points/balance');
                const balance = balResp?.balance ?? 0;
                if (balance < segmentAmount) {
                    this.onStatusChange(`Insufficient balance: ${balance} PTS (need ≥${segmentAmount} PTS for 1 segment)`);
                    return false;
                }
            } catch { }

            const initResp = await this.client.post<{
                sessionId: string;
                invoice: string;
                paymentHash: string;
                paidSegments: number[];
                resumeFromSegment: number;
                isResume: boolean;
            }>('/payment/stream/init', {
                videoId,
                pricePerSecond,
                segmentSeconds,
                videoDuration,
                pricePerMinute: pricePerSecond * 60,
                segmentMinutes: segmentSeconds / 60
            });

            const {
                sessionId,
                invoice,
                paidSegments = [],
                resumeFromSegment,
                isResume
            } = initResp;

            // Resume flow
            if (isResume && resumeFromSegment > 0) {
                const shouldResume = await showResumePrompt({
                    paidSegments,
                    totalSegments,
                    resumeFromSegment,
                    segmentSeconds
                });

                if (!shouldResume) {
                    this.onStatusChange('Cancelled / 已取消');
                    return false;
                }

                const resumeTime = (resumeFromSegment - 1) * segmentSeconds;
                if (this.playerRef) {
                    this.playerRef.currentTime(resumeTime);
                }
                this.onStatusChange(`Resuming from ${Math.floor(resumeTime / 60)}:${String(resumeTime % 60).padStart(2, '0')}`);
            } else {
                // First watch — show disclosure
                const confirmed = await showStreamPaymentDisclosure({
                    videoDuration,
                    segmentSeconds,
                    segmentAmount,
                    totalSegments,
                    pricePerSecond
                });

                if (!confirmed) {
                    this.onStatusChange('Cancelled / 已取消');
                    return false;
                }

                // Pay first invoice (to initialize the Fiber channel)
                if (invoice) {
                    this.onStatusChange('Opening payment channel...');
                    const payResult = await payFiberInvoice(invoice);
                    if (!payResult.success) {
                        this.onStatusChange(`Channel open failed: ${payResult.error}`);
                        return false;
                    }
                }

                this.onStatusChange('▶ Streaming — per-second billing active');
            }

            // Save session
            this.session = {
                sessionId,
                videoId,
                segmentSeconds,
                totalSegments,
                currentSegment: 1,
                paidSegments,
                pricePerSecond,
                preAuthSegments: this.preAuthSegments,
                autoRenew: true,
                consumedPoints: 0,
                userBalance: 0,
            };

            // Fetch initial balance
            try {
                const balResp = await this.client.get<{ balance: number }>('/payment/points/balance');
                this.session.userBalance = balResp?.balance ?? 0;
            } catch { }

            // Start per-second tick monitoring
            this.startTickMonitoring();

            // Guard against page close without proper session cleanup
            this.setupBeforeUnloadGuard();

            return true;
        } catch (err: any) {
            this.onStatusChange(`Init failed: ${err?.message || String(err)}`);
            return false;
        }
    }

    /**
     * 启动 tick 监控 — Per-Second Billing
     * Backend deducts pricePerSecond × delta each tick.
     * Frontend just displays the results.
     */
    private startTickMonitoring() {
        if (this.tickIntervalId) {
            clearInterval(this.tickIntervalId);
        }

        this.tickIntervalId = window.setInterval(async () => {
            if (!this.session || !this.playerRef) return;

            // Don't tick while paused
            if (this.playerRef.paused && this.playerRef.paused()) return;

            try {
                const elapsed = Math.floor(this.playerRef.currentTime());

                const tickResp = await this.client.post<{
                    shouldPause: boolean;
                    deducted: number;
                    totalPaid: number;
                    balance: number;
                    pricePerSecond: number;
                    estimatedRemainingSeconds: number;
                    displaySegment: number;
                    totalDisplaySegments: number;
                    segmentDurationSec: number;
                    elapsedSeconds: number;
                    videoDurationSeconds: number;
                }>('/payment/stream/tick', {
                    sessionId: this.session.sessionId,
                    elapsedSeconds: elapsed
                });

                // Update session state from backend response
                this.session.currentSegment = tickResp.displaySegment;
                this.session.totalSegments = tickResp.totalDisplaySegments;
                this.session.consumedPoints = tickResp.totalPaid;
                this.session.userBalance = tickResp.balance;

                // Update status display
                const segInfo = `Seg ${tickResp.displaySegment}/${tickResp.totalDisplaySegments}`;
                const costInfo = `${tickResp.totalPaid} PTS spent`;
                const remainInfo = tickResp.estimatedRemainingSeconds > 3600
                    ? '∞'
                    : `~${Math.floor(tickResp.estimatedRemainingSeconds / 60)}min left`;

                if (tickResp.shouldPause) {
                    // Balance depleted — pause playback
                    this.playerRef.pause();
                    this.stopTickMonitoring();
                    this.onStatusChange(`⚠ Insufficient balance — ${costInfo}`);
                    this.onPauseRequired();
                    if (this.onBalanceLow) this.onBalanceLow();
                } else {
                    this.onStatusChange(`${segInfo} · ${costInfo} · ${remainInfo}`);
                }

                this.updateMeter();

            } catch (err: any) {
                console.error('Tick error:', err);
            }
        }, 1000); // Tick every 1 second for true per-second billing accuracy
    }

    async pauseSession() {
        if (!this.session) return;
        try {
            await this.client.post('/payment/stream/pause', {
                sessionId: this.session.sessionId,
                currentSegment: this.session.currentSegment
            });
            this.stopTickMonitoring();
        } catch (err: any) {
            console.error('Pause session error:', err);
        }
    }

    async closeSession() {
        if (!this.session) return;
        try {
            const actualSeconds = this.playerRef ? Math.floor(this.playerRef.currentTime()) : 0;
            await this.client.post('/payment/stream/close', {
                sessionId: this.session.sessionId,
                actualSeconds
            });
            this.stopTickMonitoring();
            this.session = null;
        } catch (err: any) {
            console.error('Close session error:', err);
        }
    }

    private stopTickMonitoring() {
        if (this.tickIntervalId) {
            clearInterval(this.tickIntervalId);
            this.tickIntervalId = null;
        }
    }

    private beforeUnloadHandler: (() => void) | null = null;

    private setupBeforeUnloadGuard() {
        this.beforeUnloadHandler = () => {
            // Use sendBeacon for reliable delivery on page close
            if (this.session) {
                const actualSeconds = this.playerRef ? Math.floor(this.playerRef.currentTime()) : 0;
                const jwt = typeof sessionStorage !== 'undefined' ? sessionStorage.getItem('vp.jwt') : null;
                const payload = JSON.stringify({
                    sessionId: this.session.sessionId,
                    actualSeconds,
                });
                // sendBeacon is fire-and-forget, works even during page unload
                try {
                    const gatewayUrl = (globalThis as any).__VP_API_URL__ || 'http://localhost:8080';
                    navigator.sendBeacon(
                        `${gatewayUrl}/payment/stream/close`,
                        new Blob([payload], { type: 'application/json' })
                    );
                } catch { }
            }
        };
        window.addEventListener('beforeunload', this.beforeUnloadHandler);
    }

    private removeBeforeUnloadGuard() {
        if (this.beforeUnloadHandler) {
            window.removeEventListener('beforeunload', this.beforeUnloadHandler);
            this.beforeUnloadHandler = null;
        }
    }

    cleanup() {
        this.stopTickMonitoring();
        this.removeBeforeUnloadGuard();
    }

    getSession(): StreamPaymentSession | null {
        return this.session;
    }
}
