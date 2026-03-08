/**
 * NFT 掉落通知组件
 * 
 * 显示 NFT 掉落动画和领取按钮
 */

import React, { useState, useEffect } from "react";
import { getApiClient } from "../lib/apiClient";
import "../styles/fun.css";

const client = getApiClient();

interface NFTDrop {
    id: string;
    rarity: string;
    nftName: string;
    nftType: string;
    imageUrl: string;
    expiresAt: string;
}

interface NFTDropNotificationProps {
    userId: string;
    onClose?: () => void;
}

const RARITY_COLORS: Record<string, { bg: string; border: string; text: string; glow: string }> = {
    N: { bg: "rgba(100,100,100,0.2)", border: "#888", text: "#ccc", glow: "none" },
    R: { bg: "rgba(0,149,255,0.2)", border: "#0095ff", text: "#0095ff", glow: "0 0 20px rgba(0,149,255,0.5)" },
    SR: { bg: "rgba(162,103,255,0.2)", border: "#a267ff", text: "#a267ff", glow: "0 0 30px rgba(162,103,255,0.6)" },
    SSR: { bg: "rgba(255,215,0,0.2)", border: "#ffd700", text: "#ffd700", glow: "0 0 40px rgba(255,215,0,0.8)" },
};

const RARITY_NAMES: Record<string, string> = {
    N: "普通",
    R: "稀有",
    SR: "史诗",
    SSR: "传说",
};

export default function NFTDropNotification({ userId, onClose }: NFTDropNotificationProps) {
    const [drops, setDrops] = useState<NFTDrop[]>([]);
    const [currentDrop, setCurrentDrop] = useState<NFTDrop | null>(null);
    const [claiming, setClaiming] = useState(false);
    const [claimed, setClaimed] = useState(false);
    const [message, setMessage] = useState("");

    const jwt = typeof window !== "undefined" ? sessionStorage.getItem("vp.jwt") : null;
    if (jwt) client.setJWT(jwt);

    useEffect(() => {
        loadPendingDrops();
    }, [userId]);

    const loadPendingDrops = async () => {
        try {
            const res = await client.get<{ drops: NFTDrop[] }>(`/engagement/drops/pending?userId=${userId}`);
            setDrops(res.drops || []);
            if (res.drops.length > 0) {
                setCurrentDrop(res.drops[0]);
            }
        } catch (err) {
            console.error("Load drops failed:", err);
        }
    };

    const handleClaim = async () => {
        if (!currentDrop || claiming) return;
        setClaiming(true);
        try {
            const res = await client.post<{ success: boolean; sporeId: string; message: string }>(
                "/engagement/drops/claim",
                { userId, dropId: currentDrop.id }
            );
            if (res.success) {
                setClaimed(true);
                setMessage(res.message);
                // 移除当前掉落，显示下一个
                setTimeout(() => {
                    const remaining = drops.filter(d => d.id !== currentDrop.id);
                    setDrops(remaining);
                    if (remaining.length > 0) {
                        setCurrentDrop(remaining[0]);
                        setClaimed(false);
                        setMessage("");
                    } else {
                        onClose?.();
                    }
                }, 2000);
            }
        } catch (err: any) {
            setMessage(err?.message || "领取失败");
        } finally {
            setClaiming(false);
        }
    };

    if (!currentDrop) return null;

    const colors = RARITY_COLORS[currentDrop.rarity] || RARITY_COLORS.N;

    return (
        <div
            style={{
                position: "fixed",
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                background: "rgba(0,0,0,0.85)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                zIndex: 9999,
                animation: "fadeIn 0.3s ease-out",
            }}
            onClick={onClose}
        >
            <div
                onClick={(e) => e.stopPropagation()}
                style={{
                    background: colors.bg,
                    border: `2px solid ${colors.border}`,
                    borderRadius: 16,
                    padding: 32,
                    textAlign: "center",
                    maxWidth: 400,
                    boxShadow: colors.glow,
                    animation: "scaleIn 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275)",
                }}
            >
                {/* 稀有度标签 */}
                <div
                    style={{
                        display: "inline-block",
                        padding: "4px 16px",
                        background: colors.border,
                        color: "#000",
                        borderRadius: 20,
                        fontWeight: 700,
                        fontSize: 14,
                        marginBottom: 16,
                        letterSpacing: 2,
                    }}
                >
                    {RARITY_NAMES[currentDrop.rarity] || currentDrop.rarity}
                </div>

                {/* NFT 图片 */}
                <div
                    style={{
                        width: 150,
                        height: 150,
                        margin: "0 auto 16px",
                        borderRadius: 12,
                        background: "rgba(255,255,255,0.1)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: 64,
                        animation: currentDrop.rarity === "SSR" ? "pulse 2s infinite" : undefined,
                    }}
                >
                    {currentDrop.rarity === "SSR" ? "🌟" : currentDrop.rarity === "SR" ? "💎" : currentDrop.rarity === "R" ? "✨" : "🎁"}
                </div>

                {/* NFT 名称 */}
                <h2 style={{ color: colors.text, fontSize: 24, fontWeight: 700, marginBottom: 8 }}>
                    {currentDrop.nftName}
                </h2>
                <p style={{ color: "var(--text-muted)", fontSize: 14, marginBottom: 24 }}>
                    {currentDrop.nftType}
                </p>

                {/* 领取按钮 */}
                {claimed ? (
                    <div style={{ color: "var(--accent-cyan)", fontSize: 16, fontWeight: 600 }}>
                        ✓ {message}
                    </div>
                ) : (
                    <button
                        className="btn-neon"
                        onClick={handleClaim}
                        disabled={claiming}
                        style={{ minWidth: 150, padding: "12px 32px" }}
                    >
                        {claiming ? "领取中..." : "🎉 领取 NFT"}
                    </button>
                )}

                {/* 过期时间 */}
                <p style={{ marginTop: 16, fontSize: 12, color: "var(--text-muted)" }}>
                    请在 24 小时内领取，否则将过期
                </p>

                {/* 剩余数量 */}
                {drops.length > 1 && (
                    <p style={{ marginTop: 8, fontSize: 12, color: colors.border }}>
                        还有 {drops.length - 1} 个 NFT 待领取
                    </p>
                )}

                {/* 关闭按钮 */}
                <button
                    onClick={onClose}
                    style={{
                        position: "absolute",
                        top: 16,
                        right: 16,
                        background: "transparent",
                        border: "none",
                        color: "var(--text-muted)",
                        fontSize: 24,
                        cursor: "pointer",
                    }}
                >
                    ×
                </button>
            </div>

            <style>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes scaleIn {
          from { transform: scale(0.5); opacity: 0; }
          to { transform: scale(1); opacity: 1; }
        }
        @keyframes pulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.1); }
        }
      `}</style>
        </div>
    );
}

/**
 * 用于检查并显示 NFT 掉落的 Hook
 */
export function useNFTDropCheck(userId: string) {
    const [hasPendingDrops, setHasPendingDrops] = useState(false);
    const [showNotification, setShowNotification] = useState(false);

    const jwt = typeof window !== "undefined" ? sessionStorage.getItem("vp.jwt") : null;
    if (jwt) client.setJWT(jwt);

    useEffect(() => {
        if (!userId) return;
        checkDrops();
        const interval = setInterval(checkDrops, 60000); // 每分钟检查
        return () => clearInterval(interval);
    }, [userId]);

    const checkDrops = async () => {
        try {
            const res = await client.get<{ drops: NFTDrop[] }>(`/engagement/drops/pending?userId=${userId}`);
            const pending = res.drops?.length > 0;
            setHasPendingDrops(pending);
            if (pending && !showNotification) {
                setShowNotification(true);
            }
        } catch {
            // ignore
        }
    };

    const triggerDrop = async (triggerType: string) => {
        try {
            const res = await client.post<{ dropped: boolean }>("/engagement/drops/trigger", { userId, triggerType });
            if (res.dropped) {
                setHasPendingDrops(true);
                setShowNotification(true);
            }
            return res.dropped;
        } catch {
            return false;
        }
    };

    return {
        hasPendingDrops,
        showNotification,
        setShowNotification,
        triggerDrop,
        checkDrops,
    };
}
