// FILE: /video-platform/client-web/src/components/StreamMeter.tsx
/**
 * 流支付余额条组件
 * 功能：在播放器右上角显示实时消费/剩余积分，余额不足时变色提醒
 */

import React, { useEffect, useState } from "react";

interface StreamMeterProps {
    // 当前会话信息
    sessionId?: string;
    isActive: boolean;
    // 积分信息
    totalBalance: number;          // 用户总积分余额
    consumedPoints: number;        // 已消费积分
    pricePerSecond: number;        // price per second in points
    // 段落信息
    currentSegment: number;
    totalSegments: number;
    paidSegments: number[];
    // 回调
    onBalanceLow?: () => void;     // 余额不足回调
    className?: string;
}

export default function StreamMeter({
    sessionId,
    isActive,
    totalBalance,
    consumedPoints,
    pricePerSecond,
    currentSegment,
    totalSegments,
    paidSegments,
    onBalanceLow,
    className = "",
}: StreamMeterProps) {
    const [warningLevel, setWarningLevel] = useState<"normal" | "low" | "critical">("normal");
    const [isExpanded, setIsExpanded] = useState(false);

    const remainingBalance = totalBalance - consumedPoints;
    const estimatedSecondsLeft = pricePerSecond > 0 ? Math.floor(remainingBalance / pricePerSecond) : 99999;
    const estimatedMinutesLeft = Math.floor(estimatedSecondsLeft / 60);

    // 检测余额状态
    useEffect(() => {
        if (!isActive) {
            setWarningLevel("normal");
            return;
        }

        if (remainingBalance <= 0) {
            setWarningLevel("critical");
            onBalanceLow?.();
        } else if (estimatedSecondsLeft <= 120) {
            setWarningLevel("critical");
        } else if (estimatedSecondsLeft <= 300) {
            setWarningLevel("low");
        } else {
            setWarningLevel("normal");
        }
    }, [remainingBalance, estimatedSecondsLeft, isActive, onBalanceLow]);

    const getStatusColor = () => {
        switch (warningLevel) {
            case "critical":
                return "#ff4757";
            case "low":
                return "#ffa502";
            default:
                return "#2ed573";
        }
    };

    const getStatusIcon = () => {
        switch (warningLevel) {
            case "critical":
                return "⚠️";
            case "low":
                return "⏳";
            default:
                return "💎";
        }
    };

    if (!isActive) return null;

    return (
        <div
            className={`stream-meter ${className}`}
            style={{
                position: "absolute",
                top: 16,
                right: 16,
                zIndex: 100,
                fontFamily: "system-ui, sans-serif",
            }}
        >
            {/* 主显示区 */}
            <div
                onClick={() => setIsExpanded(!isExpanded)}
                style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    padding: "8px 14px",
                    borderRadius: 20,
                    background: "rgba(0, 0, 0, 0.7)",
                    backdropFilter: "blur(8px)",
                    border: `1px solid ${getStatusColor()}40`,
                    cursor: "pointer",
                    transition: "all 0.3s ease",
                    animation: warningLevel === "critical" ? "pulse 1s infinite" : "none",
                }}
            >
                {/* 状态图标 */}
                <span style={{ fontSize: 14 }}>{getStatusIcon()}</span>

                {/* 余额显示 */}
                <div style={{ display: "flex", alignItems: "baseline", gap: 4 }}>
                    <span
                        style={{
                            fontSize: 16,
                            fontWeight: 700,
                            color: getStatusColor(),
                        }}
                    >
                        {remainingBalance.toLocaleString()}
                    </span>
                    <span style={{ fontSize: 11, color: "rgba(255,255,255,0.6)" }}>PTS</span>
                </div>

                {/* 进度条 */}
                <div
                    style={{
                        width: 60,
                        height: 4,
                        borderRadius: 2,
                        background: "rgba(255,255,255,0.2)",
                        overflow: "hidden",
                    }}
                >
                    <div
                        style={{
                            width: `${Math.min(100, (currentSegment / totalSegments) * 100)}%`,
                            height: "100%",
                            background: getStatusColor(),
                            transition: "width 0.3s ease",
                        }}
                    />
                </div>

                {/* 段落进度 */}
                <span style={{ fontSize: 11, color: "rgba(255,255,255,0.6)" }}>
                    {currentSegment}/{totalSegments}
                </span>
            </div>

            {/* 展开详情 */}
            {isExpanded && (
                <div
                    style={{
                        marginTop: 8,
                        padding: 12,
                        borderRadius: 12,
                        background: "rgba(0, 0, 0, 0.85)",
                        backdropFilter: "blur(8px)",
                        border: "1px solid rgba(255,255,255,0.1)",
                        minWidth: 200,
                    }}
                >
                    <div style={{ marginBottom: 8 }}>
                        <div style={{ fontSize: 11, color: "rgba(255,255,255,0.5)", marginBottom: 4 }}>
                            消费明细
                        </div>
                        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
                            <span>已消费</span>
                            <span style={{ color: "#ff6b6b" }}>-{consumedPoints} 积分</span>
                        </div>
                        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
                            <span>剩余</span>
                            <span style={{ color: getStatusColor() }}>{remainingBalance} 积分</span>
                        </div>
                    </div>

                    <div style={{ borderTop: "1px solid rgba(255,255,255,0.1)", paddingTop: 8 }}>
                        <div style={{ fontSize: 11, color: "rgba(255,255,255,0.5)", marginBottom: 4 }}>
                            播放信息
                        </div>
                        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
                            <span>价格</span>
                            <span>{pricePerSecond.toFixed(2)} PTS/SEC</span>
                        </div>
                        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
                            <span>预估可看</span>
                            <span style={{ color: getStatusColor() }}>
                                {estimatedSecondsLeft > 60 ? `~${estimatedMinutesLeft} min` : `~${estimatedSecondsLeft}s`}
                            </span>
                        </div>
                    </div>

                    {/* 已付费段落 */}
                    <div style={{ borderTop: "1px solid rgba(255,255,255,0.1)", paddingTop: 8, marginTop: 8 }}>
                        <div style={{ fontSize: 11, color: "rgba(255,255,255,0.5)", marginBottom: 4 }}>
                            已付费段落
                        </div>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                            {Array.from({ length: totalSegments }, (_, i) => i + 1).map((seg) => (
                                <div
                                    key={seg}
                                    style={{
                                        width: 20,
                                        height: 20,
                                        borderRadius: 4,
                                        fontSize: 10,
                                        display: "flex",
                                        alignItems: "center",
                                        justifyContent: "center",
                                        background: paidSegments.includes(seg)
                                            ? "#2ed573"
                                            : seg === currentSegment
                                                ? "#ffa502"
                                                : "rgba(255,255,255,0.1)",
                                        color: paidSegments.includes(seg) || seg === currentSegment ? "#000" : "#fff",
                                    }}
                                >
                                    {seg}
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.7; }
        }
      `}</style>
        </div>
    );
}
