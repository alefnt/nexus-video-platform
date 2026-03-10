// FILE: /video-platform/client-web/src/hooks/usePayment.ts
/**
 * usePayment — 统一支付 Hook
 * 
 * 适配所有内容类型（video / music / article），封装：
 * 1. JWT / 登录检查
 * 2. 余额查询 + 流支付历史
 * 3. 一次性买断 (Buy Once)
 * 4. 流支付 (Stream Pay)
 * 5. 余额不足引导充值
 * 
 * 用法:
 *   const payment = usePayment({ contentId, contentType: 'video', ... });
 *   // 在 JSX 中: {payment.needPayment && payment.overlay}
 */

import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { getApiClient } from "../lib/apiClient";
import { StreamPaymentHandler } from "../lib/streamPaymentHandler";
import { showConfirm, showAlert } from "../components/ui/ConfirmModal";

const client = getApiClient();

// ─── Types ─────────────────────────────────────────────────────────

export type ContentType = 'video' | 'music' | 'article';
export type PriceMode = 'free' | 'buy_once' | 'stream' | 'both';

export interface UsePaymentOptions {
    /** 内容 ID */
    contentId: string;
    /** 内容类型 */
    contentType: ContentType;
    /** 买断价格 (积分) */
    buyOncePrice?: number;
    /** Stream payment price per second (points) */
    streamPricePerSecond?: number;
    /** @deprecated Use streamPricePerSecond */
    streamPricePerMinute?: number;
    /** 定价模式 */
    priceMode?: PriceMode;
    /** USDI 金额 (旧版兼容) */
    amountUSDI?: string;
    /** 内容时长(秒)，用于流支付计算分段 */
    durationSeconds?: number;
    /** 买断成功回调 — 返回解锁后的 streamUrl (视频) 或 true (其他) */
    onBuyOnceSuccess?: (result: BuyOnceResult) => void;
    /** 流支付启动成功回调 */
    onStreamStarted?: (handler: StreamPaymentHandler) => void;
    /** 自定义状态消息回调 */
    onStatusChange?: (msg: string) => void;
    /** 流支付暂停回调 (余额耗尽时) */
    onStreamPause?: () => void;
    /** 是否启用 (默认 true，free 内容可设为 false) */
    enabled?: boolean;
}

export interface BuyOnceResult {
    success: boolean;
    streamUrl?: string;
    intentId?: string;
}

export interface UsePaymentReturn {
    /** 是否需要付费 */
    needPayment: boolean;
    /** 手动设置付费状态 */
    setNeedPayment: (v: boolean) => void;
    /** 正在处理支付 */
    buying: boolean;
    /** 当前状态消息 */
    statusMessage: string;
    /** 执行买断支付 */
    handleBuyOnce: () => Promise<void>;
    /** 执行流支付 */
    handleStartStream: () => Promise<void>;
    /** 导航到充值页 */
    handleTopUp: () => void;
    /** 流支付处理器引用 */
    streamHandlerRef: React.MutableRefObject<StreamPaymentHandler | null>;
    /** PaymentOverlay 所需的 props (直接 spread) */
    overlayProps: PaymentOverlayProps;
}

export interface PaymentOverlayProps {
    videoId: string;
    buyOncePrice: number;
    streamPricePerSecond: number;
    priceMode: PriceMode;
    isProcessing: boolean;
    onBuyOnce: () => Promise<void>;
    onStartStream: () => Promise<void>;
    onTopUp: () => void;
    labels?: {
        streamTitle?: string;
        streamUnit?: string;
        streamDesc?: string;
        buyOnceTitle?: string;
    };
}

// ─── Retry Utility ─────────────────────────────────────────────────

function sleep(ms: number) { return new Promise(res => setTimeout(res, ms)); }

function shouldRetry(e: any, isPaymentRelated = false): boolean {
    const msg = String(e?.error || e?.message || "").toLowerCase();
    const code = String(e?.code || "").toLowerCase();
    const status = Number((e?.status ?? e?.httpStatus ?? 0) || 0);
    if (isPaymentRelated && (code.includes("http_403") || status === 403)) return true;
    if (msg.includes("method not found")) return true;
    if (code.includes("http_404") || status === 404) return true;
    if (code.includes("http_502") || status === 502) return true;
    if (code.includes("http_503") || status === 503) return true;
    if (code.includes("http_500") || status === 500) return true;
    if (msg.includes("failed") || msg.includes("network")) return true;
    return false;
}

async function withRetry<T>(
    fn: () => Promise<T>,
    onStatus?: (msg: string) => void,
    attempts = 8,
    baseDelayMs = 1500,
    isPaymentRelated = false
): Promise<T> {
    let lastErr: any;
    for (let i = 1; i <= attempts; i++) {
        try { return await fn(); } catch (e: any) {
            lastErr = e;
            if (!shouldRetry(e, isPaymentRelated) || i === attempts) throw e;
            const multiplier = isPaymentRelated ? 2.2 : 1.8;
            const delay = baseDelayMs * Math.pow(multiplier, i - 1);
            if (onStatus) {
                onStatus(isPaymentRelated
                    ? `订单处理中，请稍候... (${i}/${attempts})`
                    : `等待服务就绪，重试中 (${i}/${attempts})...`
                );
            }
            await sleep(delay);
        }
    }
    throw lastErr;
}

// ─── Content-type specific label presets ────────────────────────────

const LABEL_PRESETS: Record<ContentType, NonNullable<PaymentOverlayProps['labels']>> = {
    video: {
        streamTitle: "Pay-Per-Second (Fiber Stream)",
        streamUnit: "second",
        streamDesc: "Watch as much as you want, pay by the second",
        buyOnceTitle: "Buy Once — Own Forever",
    },
    music: {
        streamTitle: "Stream Per-Second",
        streamUnit: "second",
        streamDesc: "Listen as much as you want, pay by the second",
        buyOnceTitle: "Collect Forever",
    },
    article: {
        streamTitle: "Pay Per Chapter",
        streamUnit: "chapter",
        streamDesc: "First chapter free, unlock more as you read",
        buyOnceTitle: "Lifetime Library Access",
    },
};

// ─── Hook Implementation ───────────────────────────────────────────

export function usePayment(options: UsePaymentOptions): UsePaymentReturn {
    const {
        contentId,
        contentType,
        buyOncePrice = 0,
        streamPricePerSecond: streamPricePerSecondOpt,
        streamPricePerMinute: streamPricePerMinuteOpt,
        priceMode = 'free',
        amountUSDI,
        durationSeconds = 600,
        onBuyOnceSuccess,
        onStreamStarted,
        onStatusChange,
        onStreamPause,
        enabled = true,
    } = options;

    const navigate = useNavigate();
    const [needPayment, setNeedPayment] = useState(false);
    const [buying, setBuying] = useState(false);
    const [statusMessage, setStatusMessage] = useState("");
    const streamHandlerRef = useRef<StreamPaymentHandler | null>(null);

    // Broadcast status
    const updateStatus = useCallback((msg: string) => {
        setStatusMessage(msg);
        onStatusChange?.(msg);
    }, [onStatusChange]);

    // ─── Auth helpers ──────────────────────────────────────────────

    const getAuth = useCallback(() => {
        const jwt = typeof window !== "undefined" ? sessionStorage.getItem("vp.jwt") : null;
        const userRaw = typeof window !== "undefined" ? sessionStorage.getItem("vp.user") : null;
        if (jwt) client.setJWT(jwt);
        return { jwt, userRaw, user: userRaw ? JSON.parse(userRaw) : null };
    }, []);

    const requireAuth = useCallback((): { jwt: string; user: any } | null => {
        const { jwt, user } = getAuth();
        if (!jwt || !user) {
            showAlert({ title: 'Login Required / 请先登录', message: 'Please login to continue. / 请先登录后再继续操作。' });
            navigate("/login");
            return null;
        }
        return { jwt, user };
    }, [getAuth, navigate]);

    // ─── Buy Once Handler ─────────────────────────────────────────

    const handleBuyOnce = useCallback(async () => {
        const auth = requireAuth();
        if (!auth) return;

        setBuying(true);
        updateStatus("处理支付中...");

        try {
            // Use points redeem endpoint — deducts points and grants entitlement in one step
            const result = await withRetry(
                () => client.post<{ ok: boolean; balance: number; granted?: boolean; streamUrl?: string }>("/payment/points/redeem", {
                    videoId: contentId,
                    pointsPrice: buyOncePrice > 0 ? buyOncePrice : undefined,
                }),
                updateStatus, 3, 1000, true
            );

            if (result.ok) {
                const buyResult: BuyOnceResult = {
                    success: true,
                    streamUrl: result.streamUrl,
                    intentId: contentId,
                };

                setNeedPayment(false);
                updateStatus("Payment successful! / 支付成功！");
                onBuyOnceSuccess?.(buyResult);
            }
        } catch (e: any) {
            const errMsg = e?.message || 'Unknown error / 未知错误';
            updateStatus("Payment failed / 支付失败: " + errMsg);
            showAlert({ title: 'Payment Failed / 支付失败', message: errMsg, variant: 'danger' });
        } finally {
            setBuying(false);
        }
    }, [contentId, buyOncePrice, requireAuth, updateStatus, onBuyOnceSuccess]);

    // ─── Stream Payment Handler ───────────────────────────────────

    const handleStartStream = useCallback(async () => {
        const auth = requireAuth();
        if (!auth) return;
        if (!auth.user?.ckbAddress) {
            showAlert({ title: 'JoyID Required', message: 'Stream payment requires a JoyID address. Please connect JoyID first.\n流支付需要 JoyID 地址，请先连接 JoyID。', variant: 'warning' });
            return;
        }

        setBuying(true);
        updateStatus("Initializing Fiber stream... / 初始化 Fiber 流支付通道...");

        try {
            // Check balance first
            const balanceRes = await client.get<{ balance: number }>("/payment/points/balance");
            const currentBalance = balanceRes?.balance ?? Number((balanceRes as any)?.points ?? 0);

            // Calculate per-second pricing (accept both new and legacy params)
            const streamPricePerSecond = streamPricePerSecondOpt ?? ((streamPricePerMinuteOpt ?? 1) / 60);

            // Use shared segment duration calculator
            const { calculateSegmentDuration } = await import('@video-platform/shared/web3/fiber');
            const segmentSeconds = calculateSegmentDuration(durationSeconds);
            const firstSegmentCost = Math.ceil(streamPricePerSecond * segmentSeconds);

            if (currentBalance < firstSegmentCost) {
                const goTopUp = await showConfirm({
                    title: 'Insufficient Balance / 积分不足',
                    message: `Current: ${currentBalance} PTS\nRequired: ${firstSegmentCost} PTS\n\nGo to top up? / 是否前往充值？`,
                    confirmText: 'Top Up / 前往充值',
                    cancelText: 'Cancel / 取消',
                    variant: 'warning',
                });
                if (goTopUp) navigate("/points");
                setBuying(false);
                return;
            }

            // Create stream handler
            const streamHandler = new StreamPaymentHandler(
                client,
                (msg) => updateStatus(msg),
                () => onStreamPause?.(),
            );
            streamHandlerRef.current = streamHandler;

            const success = await streamHandler.initStreamPayment({
                videoId: contentId,
                videoDuration: durationSeconds,
                pricePerSecond: streamPricePerSecond,
            });

            if (!success) {
                updateStatus("流支付初始化失败");
                setBuying(false);
                return;
            }

            setNeedPayment(false);
            updateStatus("流支付通道已建立");
            onStreamStarted?.(streamHandler);
        } catch (e: any) {
            console.error("Stream payment error:", e);
            updateStatus("流支付失败: " + (e?.message || ""));
        } finally {
            setBuying(false);
        }
    }, [contentId, durationSeconds, streamPricePerSecondOpt, streamPricePerMinuteOpt, requireAuth, updateStatus, onStreamStarted, onStreamPause, navigate]);

    // ─── Top Up ───────────────────────────────────────────────────

    const handleTopUp = useCallback(() => {
        navigate("/points");
    }, [navigate]);

    // ─── Cleanup ──────────────────────────────────────────────────

    useEffect(() => {
        return () => {
            if (streamHandlerRef.current) {
                streamHandlerRef.current.cleanup();
                streamHandlerRef.current = null;
            }
        };
    }, []);

    // ─── Overlay Props (spreads directly to PaymentOverlay) ───────

    const labels = LABEL_PRESETS[contentType];

    const overlayProps: PaymentOverlayProps = {
        videoId: contentId,
        buyOncePrice,
        streamPricePerSecond: streamPricePerSecondOpt ?? ((streamPricePerMinuteOpt ?? 1) / 60),
        priceMode,
        isProcessing: buying,
        onBuyOnce: handleBuyOnce,
        onStartStream: handleStartStream,
        onTopUp: handleTopUp,
        labels,
    };

    return {
        needPayment,
        setNeedPayment,
        buying,
        statusMessage,
        handleBuyOnce,
        handleStartStream,
        handleTopUp,
        streamHandlerRef,
        overlayProps,
    };
}

export default usePayment;
