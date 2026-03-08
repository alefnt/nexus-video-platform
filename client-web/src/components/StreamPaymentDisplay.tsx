// FILE: /video-platform/client-web/src/components/StreamPaymentDisplay.tsx
/**
 * 流支付实时费用显示组件
 * 
 * 功能说明：
 * - 在视频播放器内显示已观看时间和已花费金额
 * - 余额不足时显示警告
 */

import React from "react";
import { formatWatchTime, formatCost } from "../hooks/useStreamMeter";

interface StreamPaymentDisplayProps {
    isActive: boolean;
    totalSeconds: number;
    totalPaid: number;
    pricePerMinute: number;
    error: string | null;
    balance?: number;
}

export default function StreamPaymentDisplay({
    isActive,
    totalSeconds,
    totalPaid,
    pricePerMinute,
    error,
    balance
}: StreamPaymentDisplayProps) {
    if (!isActive && totalSeconds === 0) return null;

    return (
        <div
            className="stream-payment-display glass-card"
            style={{
                position: "absolute",
                top: 16,
                left: 16,
                padding: "8px 16px",
                borderRadius: 12,
                background: "rgba(0, 0, 0, 0.7)",
                backdropFilter: "blur(10px)",
                border: error ? "1px solid #FF6B9D" : "1px solid rgba(0, 212, 255, 0.3)",
                zIndex: 50,
                pointerEvents: "none"
            }}
        >
            <div style={{ display: "flex", gap: 20, alignItems: "center" }}>
                {/* 观看时间 */}
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <span style={{ fontSize: 16 }}>⏱️</span>
                    <div>
                        <div style={{ fontSize: 11, color: "var(--text-muted)" }}>已观看</div>
                        <div style={{ fontSize: 16, fontWeight: 600 }}>{formatWatchTime(totalSeconds)}</div>
                    </div>
                </div>

                {/* 分隔线 */}
                <div style={{ width: 1, height: 32, background: "rgba(255,255,255,0.2)" }} />

                {/* 已花费 */}
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <span style={{ fontSize: 16 }}>💰</span>
                    <div>
                        <div style={{ fontSize: 11, color: "var(--text-muted)" }}>已花费</div>
                        <div style={{ fontSize: 16, fontWeight: 600, color: "var(--accent-cyan)" }}>
                            {formatCost(totalPaid)} PTS
                        </div>
                    </div>
                </div>

                {/* 费率 */}
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <div>
                        <div style={{ fontSize: 11, color: "var(--text-muted)" }}>费率</div>
                        <div style={{ fontSize: 14, color: "var(--text-muted)" }}>
                            {pricePerMinute} PTS/分钟
                        </div>
                    </div>
                </div>
            </div>

            {/* 状态指示 */}
            {isActive && (
                <div style={{
                    marginTop: 8,
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    fontSize: 12,
                    color: "#00FF88"
                }}>
                    <span style={{
                        width: 8,
                        height: 8,
                        borderRadius: "50%",
                        background: "#00FF88",
                        animation: "pulse 1.5s infinite"
                    }} />
                    计费中...
                </div>
            )}

            {/* 错误提示 */}
            {error && (
                <div style={{
                    marginTop: 8,
                    padding: "6px 10px",
                    background: "rgba(255, 107, 157, 0.2)",
                    borderRadius: 6,
                    fontSize: 12,
                    color: "#FF6B9D"
                }}>
                    ⚠️ {error}
                    {balance !== undefined && (
                        <span> (当前余额: {balance} PTS)</span>
                    )}
                </div>
            )}

            <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
      `}</style>
        </div>
    );
}
