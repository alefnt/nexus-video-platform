// FILE: /video-platform/client-web/src/hooks/useStreamMeter.ts
/**
 * Stream Payment Meter Hook
 * 
 * 功能说明：
 * - 跟踪视频观看时间
 * - 每 N 秒向后端发送计量请求
 * - 实时显示已观看时间和已花费金额
 * - 处理余额不足情况
 */

import { useState, useRef, useCallback, useEffect } from "react";
import type { StreamSession } from "@video-platform/shared/types";
import { getApiClient } from "../lib/apiClient";

const client = getApiClient();

interface StreamMeterState {
    session: StreamSession | null;
    totalSeconds: number;
    totalPaid: number;
    isActive: boolean;
    error: string | null;
}

interface StreamMeterActions {
    startSession: () => Promise<void>;
    meterUsage: () => Promise<boolean>;
    stopSession: () => Promise<void>;
    pauseSession: () => void;
    resumeSession: () => void;
}

export function useStreamMeter(
    videoId: string,
    pricePerMinute: number,
    meterIntervalSeconds: number = 10
): StreamMeterState & StreamMeterActions {
    const [session, setSession] = useState<StreamSession | null>(null);
    const [totalSeconds, setTotalSeconds] = useState(0);
    const [totalPaid, setTotalPaid] = useState(0);
    const [isActive, setIsActive] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const intervalRef = useRef<number | null>(null);
    const lastMeterTimeRef = useRef<number>(0);
    const meterUsageRef = useRef<() => Promise<boolean>>(() => Promise.resolve(false));

    // 启动流支付会话
    const startSession = useCallback(async () => {
        try {
            setError(null);
            const jwt = sessionStorage.getItem("vp.jwt");
            if (jwt) client.setJWT(jwt);

            const res = await client.post<{ session: StreamSession }>("/payment/stream/start", {
                videoId
            });

            if (res.session) {
                setSession(res.session);
                setIsActive(true);
                lastMeterTimeRef.current = Date.now();

                // Start metering timer — uses ref to avoid stale closure
                intervalRef.current = window.setInterval(() => {
                    meterUsageRef.current();
                }, meterIntervalSeconds * 1000);
            }
        } catch (e: any) {
            setError(e?.message || "Failed to start stream session");
            console.error("Stream session start failed:", e);
        }
    }, [videoId, meterIntervalSeconds]);

    // 计量并扣费
    const meterUsage = useCallback(async (): Promise<boolean> => {
        if (!session || !isActive) return false;

        try {
            const jwt = sessionStorage.getItem("vp.jwt");
            if (jwt) client.setJWT(jwt);

            const elapsedSeconds = Math.round((Date.now() - lastMeterTimeRef.current) / 1000);
            lastMeterTimeRef.current = Date.now();

            const res = await client.post<{
                ok: boolean;
                charged?: number;
                reason?: string;
                totalSeconds?: number;
                totalPaid?: number;
            }>("/payment/stream/meter", {
                sessionId: session.sessionId,
                seconds: elapsedSeconds
            });

            if (res.ok) {
                setTotalSeconds(res.totalSeconds || totalSeconds + elapsedSeconds);
                setTotalPaid(res.totalPaid || totalPaid + (res.charged || 0));
                return true;
            } else {
                // 余额不足或其他错误
                setError(res.reason || "Payment failed");
                setIsActive(false);
                if (intervalRef.current) {
                    clearInterval(intervalRef.current);
                    intervalRef.current = null;
                }
                return false;
            }
        } catch (e: any) {
            setError(e?.message || "Meter request failed");
            return false;
        }
    }, [session, isActive, totalSeconds, totalPaid]);

    // Keep ref in sync so setInterval always calls the latest version
    meterUsageRef.current = meterUsage;

    // 停止会话
    const stopSession = useCallback(async () => {
        if (intervalRef.current) {
            clearInterval(intervalRef.current);
            intervalRef.current = null;
        }
        setIsActive(false);

        if (session) {
            try {
                const jwt = sessionStorage.getItem("vp.jwt");
                if (jwt) client.setJWT(jwt);

                await client.post("/payment/stream/stop", {
                    sessionId: session.sessionId
                });
            } catch (e) {
                console.warn("Failed to stop session on server:", e);
            }
        }

        setSession(null);
    }, [session]);

    // 暂停 (不扣费，但保留会话)
    const pauseSession = useCallback(() => {
        if (intervalRef.current) {
            clearInterval(intervalRef.current);
            intervalRef.current = null;
        }
        setIsActive(false);
    }, []);

    // 恢复
    const resumeSession = useCallback(() => {
        if (session && !isActive) {
            setIsActive(true);
            lastMeterTimeRef.current = Date.now();
            intervalRef.current = window.setInterval(() => {
                meterUsage();
            }, meterIntervalSeconds * 1000);
        }
    }, [session, isActive, meterIntervalSeconds, meterUsage]);

    // 清理
    useEffect(() => {
        return () => {
            if (intervalRef.current) {
                clearInterval(intervalRef.current);
            }
        };
    }, []);

    return {
        session,
        totalSeconds,
        totalPaid,
        isActive,
        error,
        startSession,
        meterUsage,
        stopSession,
        pauseSession,
        resumeSession
    };
}

// 格式化时间显示
export function formatWatchTime(seconds: number): string {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
}

// 格式化费用显示
export function formatCost(points: number): string {
    return points.toFixed(2);
}
