// FILE: /video-platform/client-web/src/components/PaymentModeSelector.tsx
/**
 * 支付模式选择器组件
 * 
 * 功能说明：
 * - 在视频播放前显示支付选项
 * - 一次性购买 (Points) vs 流支付 (按分钟)
 * - 显示价格和用户余额
 */

import React, { useState, useEffect } from "react";
import type { VideoMeta, PointsBalance } from "@video-platform/shared/types";
import { getApiClient } from "../lib/apiClient";

const client = getApiClient();

interface PaymentModeSelectorProps {
    video: VideoMeta;
    onSelect: (mode: 'buy_once' | 'stream' | 'skip') => void;
    onClose: () => void;
}

export default function PaymentModeSelector({ video, onSelect, onClose }: PaymentModeSelectorProps) {
    const [balance, setBalance] = useState<number>(0);
    const [loading, setLoading] = useState(true);
    const [purchasing, setPurchasing] = useState(false);

    useEffect(() => {
        const jwt = sessionStorage.getItem("vp.jwt");
        if (jwt) client.setJWT(jwt);

        client.get<PointsBalance>("/payment/points/balance")
            .then(res => {
                setBalance(res?.balance || 0);
                setLoading(false);
            })
            .catch(() => setLoading(false));
    }, []);

    const buyOncePrice = video.buyOncePrice || 0;
    const streamPriceRaw = video.streamPricePerSecond ?? ((video.streamPricePerMinute || 0) / 60);
    const streamPrice = Math.round(streamPriceRaw * 10000) / 10000; // Round to 4 decimal places
    const priceMode = video.priceMode || 'free';

    // 如果是免费视频，直接跳过
    if (priceMode === 'free' || (buyOncePrice === 0 && streamPrice === 0)) {
        return null;
    }

    const handleBuyOnce = async () => {
        if (balance < buyOncePrice) {
            alert("Insufficient balance. Please top up.");
            return;
        }

        setPurchasing(true);
        try {
            const jwt = sessionStorage.getItem("vp.jwt");
            if (jwt) client.setJWT(jwt);

            const res = await client.post<{ ok: boolean; error?: string; balance?: number; streamUrl?: string }>("/payment/points/redeem", {
                videoId: video.id,
                pointsPrice: buyOncePrice,
            });

            if (res.ok || res.streamUrl) {
                onSelect('buy_once');
            } else {
                alert(res.error || "Purchase failed. Please try again.");
            }
        } catch (err: any) {
            // Parse error response from server (ApiError shape: { error, code, status })
            const msg = err?.error || err?.message || "Purchase failed";
            alert(msg);
        } finally {
            setPurchasing(false);
        }
    };

    const handleStream = () => {
        onSelect('stream');
    };

    return (
        <div
            className="payment-mode-overlay"
            style={{
                position: "fixed",
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                background: "rgba(0,0,0,0.85)",
                zIndex: 1000,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                backdropFilter: "blur(10px)"
            }}
        >
            <div
                className="glass-card payment-mode-card"
                style={{
                    padding: 32,
                    maxWidth: 420,
                    width: "90%",
                    borderRadius: 20,
                    background: "rgba(20, 20, 30, 0.95)",
                    border: "1px solid rgba(162, 103, 255, 0.3)"
                }}
            >
                {/* Header */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
                    <h2 style={{ fontSize: 22, margin: 0 }}>Payment Options</h2>
                    <button
                        onClick={onClose}
                        style={{
                            background: "none",
                            border: "none",
                            color: "var(--text-muted)",
                            fontSize: 24,
                            cursor: "pointer"
                        }}
                    >
                        ✕
                    </button>
                </div>

                {/* Video Info */}
                <div style={{ marginBottom: 24, padding: 16, background: "rgba(0,0,0,0.3)", borderRadius: 12 }}>
                    <h3 style={{ fontSize: 16, marginBottom: 8 }}>{video.title}</h3>
                    <p style={{ fontSize: 13, color: "var(--text-muted)", margin: 0 }}>
                        {video.description?.slice(0, 80)}...
                    </p>
                </div>

                {/* Balance Display */}
                <div style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginBottom: 24,
                    padding: "12px 16px",
                    background: "rgba(255, 217, 61, 0.1)",
                    borderRadius: 8,
                    border: "1px solid rgba(255, 217, 61, 0.3)"
                }}>
                    <span style={{ color: "var(--text-muted)" }}>BALANCE</span>
                    <span style={{ fontSize: 20, fontWeight: 700, color: "var(--accent-yellow)" }}>
                        {loading ? "..." : `${balance} PTS`}
                    </span>
                </div>

                {/* Payment Options */}
                <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

                    {/* Buy Once Option */}
                    {(priceMode === 'buy_once' || priceMode === 'both') && buyOncePrice > 0 && (
                        <button
                            onClick={handleBuyOnce}
                            disabled={purchasing || balance < buyOncePrice}
                            style={{
                                padding: 20,
                                borderRadius: 12,
                                border: "2px solid var(--accent-purple)",
                                background: "linear-gradient(135deg, rgba(162, 103, 255, 0.2), rgba(0,0,0,0.3))",
                                cursor: purchasing || balance < buyOncePrice ? "not-allowed" : "pointer",
                                opacity: balance < buyOncePrice ? 0.5 : 1,
                                transition: "all 0.2s"
                            }}
                        >
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                <div style={{ textAlign: "left" }}>
                                    <div style={{ fontSize: 18, fontWeight: 600, marginBottom: 4 }}>
                                        💎 One-Time Buy
                                    </div>
                                    <div style={{ fontSize: 13, color: "var(--text-muted)" }}>
                                        Unlock forever, unlimited replays
                                    </div>
                                </div>
                                <div style={{ textAlign: "right" }}>
                                    <div style={{ fontSize: 24, fontWeight: 700, color: "var(--accent-purple)" }}>
                                        {buyOncePrice}
                                    </div>
                                    <div style={{ fontSize: 12, color: "var(--text-muted)" }}>PTS</div>
                                </div>
                            </div>
                            {balance < buyOncePrice && (
                                <div style={{ marginTop: 8, fontSize: 12, color: "#FF6B9D" }}>
                                    Insufficient Balance (Need {buyOncePrice - balance} PTS)
                                </div>
                            )}
                        </button>
                    )}

                    {/* Stream Option */}
                    {(priceMode === 'stream' || priceMode === 'both') && streamPrice > 0 && (
                        <button
                            onClick={handleStream}
                            style={{
                                padding: 20,
                                borderRadius: 12,
                                border: "2px solid var(--accent-cyan)",
                                background: "linear-gradient(135deg, rgba(0, 212, 255, 0.2), rgba(0,0,0,0.3))",
                                cursor: "pointer",
                                transition: "all 0.2s"
                            }}
                        >
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                <div style={{ textAlign: "left" }}>
                                    <div style={{ fontSize: 18, fontWeight: 600, marginBottom: 4 }}>
                                        ⚡ Stream Pay
                                    </div>
                                    <div style={{ fontSize: 13, color: "var(--text-muted)" }}>
                                        Pay as you watch — per second
                                    </div>
                                </div>
                                <div style={{ textAlign: "right" }}>
                                    <div style={{ fontSize: 24, fontWeight: 700, color: "var(--accent-cyan)" }}>
                                        {streamPrice < 1 ? streamPrice.toFixed(4) : streamPrice.toFixed(2)}
                                    </div>
                                    <div style={{ fontSize: 12, color: "var(--text-muted)" }}>PTS/SEC</div>
                                </div>
                            </div>
                        </button>
                    )}
                </div>

                {/* Footer */}
                <div style={{ marginTop: 24, textAlign: "center" }}>
                    <button
                        onClick={() => onSelect('skip')}
                        style={{
                            background: "none",
                            border: "none",
                            color: "var(--text-muted)",
                            fontSize: 14,
                            cursor: "pointer",
                            textDecoration: "underline"
                        }}
                    >
                        Cancel
                    </button>
                </div>
            </div>
        </div>
    );
}
