// FILE: /video-platform/client-web/src/components/TipButton.tsx
/**
 * 打赏按钮组件
 * 功能：快捷金额选择、发起打赏、显示弹幕动画
 */

import React, { useState } from "react";
import { getApiClient } from "../lib/apiClient";
import { usePointsStore } from "../stores";

interface TipButtonProps {
    videoId: string;
    creatorAddress: string;
    onTipSuccess?: (tipData: { amount: number; message?: string; tipId: string }) => void;
    onTipError?: (error: string) => void;
    className?: string;
}

const QUICK_AMOUNTS = [1, 5, 10, 50, 100];

const client = getApiClient();

export default function TipButton({
    videoId,
    creatorAddress,
    onTipSuccess,
    onTipError,
    className = "",
}: TipButtonProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [selectedAmount, setSelectedAmount] = useState<number>(10);
    const [customAmount, setCustomAmount] = useState<string>("");
    const [message, setMessage] = useState<string>("");
    const [showDanmaku, setShowDanmaku] = useState<boolean>(true);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // 获取JWT
    const jwt = typeof window !== "undefined" ? sessionStorage.getItem("vp.jwt") : null;
    if (jwt) client.setJWT(jwt);

    const getFinalAmount = (): number => {
        if (customAmount && !isNaN(Number(customAmount)) && Number(customAmount) > 0) {
            return Math.floor(Number(customAmount));
        }
        return selectedAmount;
    };

    const handleTip = async () => {
        const amount = getFinalAmount();
        if (amount <= 0) {
            setError("请输入有效的打赏金额");
            return;
        }

        setLoading(true);
        setError(null);

        try {
            const res = await client.post<{
                ok: boolean;
                tipId: string;
                amount: number;
                message?: string;
                showDanmaku: boolean;
                newBalance: number;
            }>("/payment/tip", {
                videoId,
                creatorAddress,
                amount,
                message: message.trim() || undefined,
                showDanmaku,
            });

            if (res.ok) {
                // Sync global balance
                if (typeof res.newBalance === 'number') {
                    usePointsStore.getState().setBalance(res.newBalance);
                }
                setIsOpen(false);
                setMessage("");
                setCustomAmount("");
                onTipSuccess?.({
                    amount: res.amount,
                    message: res.message,
                    tipId: res.tipId,
                });
            } else {
                throw new Error("打赏失败");
            }
        } catch (err: any) {
            const errorMsg = err?.error || err?.message || "打赏失败，请重试";
            setError(errorMsg);
            onTipError?.(errorMsg);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className={`tip-button-container ${className}`} style={{ position: "relative" }}>
            {/* 打赏按钮 */}
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="btn-neon"
                style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    padding: "8px 16px",
                    fontSize: 14,
                    borderRadius: 20,
                }}
            >
                <span style={{ fontSize: 18 }}>🎁</span>
                <span>打赏</span>
            </button>

            {/* 打赏弹窗 */}
            {isOpen && (
                <div
                    className="glass-card"
                    style={{
                        position: "absolute",
                        bottom: "100%",
                        right: 0,
                        marginBottom: 8,
                        width: 280,
                        padding: 16,
                        zIndex: 1000,
                        animation: "fadeIn 0.2s ease-out",
                    }}
                >
                    {/* 标题 */}
                    <div
                        style={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                            marginBottom: 16,
                        }}
                    >
                        <h4 style={{ margin: 0, fontSize: 16 }}>打赏创作者</h4>
                        <button
                            onClick={() => setIsOpen(false)}
                            style={{
                                background: "transparent",
                                border: "none",
                                color: "var(--text-muted)",
                                cursor: "pointer",
                                fontSize: 18,
                            }}
                        >
                            ×
                        </button>
                    </div>

                    {/* 快捷金额 */}
                    <div
                        style={{
                            display: "grid",
                            gridTemplateColumns: "repeat(5, 1fr)",
                            gap: 8,
                            marginBottom: 12,
                        }}
                    >
                        {QUICK_AMOUNTS.map((amt) => (
                            <button
                                key={amt}
                                onClick={() => {
                                    setSelectedAmount(amt);
                                    setCustomAmount("");
                                }}
                                style={{
                                    padding: "8px 0",
                                    borderRadius: 8,
                                    border:
                                        selectedAmount === amt && !customAmount
                                            ? "2px solid var(--accent-cyan)"
                                            : "1px solid rgba(255,255,255,0.2)",
                                    background:
                                        selectedAmount === amt && !customAmount
                                            ? "rgba(0, 255, 255, 0.1)"
                                            : "transparent",
                                    color: "white",
                                    fontSize: 13,
                                    cursor: "pointer",
                                    transition: "all 0.2s",
                                }}
                            >
                                {amt}
                            </button>
                        ))}
                    </div>

                    {/* 自定义金额 */}
                    <div style={{ marginBottom: 12 }}>
                        <input
                            type="number"
                            placeholder="自定义金额"
                            value={customAmount}
                            onChange={(e) => setCustomAmount(e.target.value)}
                            style={{
                                width: "100%",
                                padding: "8px 12px",
                                borderRadius: 8,
                                border: "1px solid rgba(255,255,255,0.2)",
                                background: "rgba(0,0,0,0.3)",
                                color: "white",
                                fontSize: 14,
                            }}
                        />
                    </div>

                    {/* 留言 */}
                    <div style={{ marginBottom: 12 }}>
                        <input
                            type="text"
                            placeholder="留言（可选）"
                            value={message}
                            onChange={(e) => setMessage(e.target.value)}
                            maxLength={200}
                            style={{
                                width: "100%",
                                padding: "8px 12px",
                                borderRadius: 8,
                                border: "1px solid rgba(255,255,255,0.2)",
                                background: "rgba(0,0,0,0.3)",
                                color: "white",
                                fontSize: 14,
                            }}
                        />
                    </div>

                    {/* 弹幕选项 */}
                    <label
                        style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 8,
                            marginBottom: 16,
                            fontSize: 13,
                            color: "var(--text-muted)",
                            cursor: "pointer",
                        }}
                    >
                        <input
                            type="checkbox"
                            checked={showDanmaku}
                            onChange={(e) => setShowDanmaku(e.target.checked)}
                        />
                        以弹幕形式展示
                    </label>

                    {/* 错误提示 */}
                    {error && (
                        <div
                            style={{
                                color: "#ff6b6b",
                                fontSize: 12,
                                marginBottom: 12,
                                padding: "8px",
                                background: "rgba(255,107,107,0.1)",
                                borderRadius: 4,
                            }}
                        >
                            {error}
                        </div>
                    )}

                    {/* 确认按钮 */}
                    <button
                        onClick={handleTip}
                        disabled={loading}
                        className="btn-neon"
                        style={{
                            width: "100%",
                            padding: "10px",
                            fontSize: 14,
                            opacity: loading ? 0.7 : 1,
                        }}
                    >
                        {loading ? "处理中..." : `打赏 ${getFinalAmount()} 积分`}
                    </button>
                </div>
            )}
        </div>
    );
}
