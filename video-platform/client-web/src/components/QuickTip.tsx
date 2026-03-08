/**
 * 快捷打赏按钮 — 积分 + CKB 双模式
 *
 * - 积分打赏: 零摩擦, 链下扣减 (默认模式)
 * - CKB 打赏: 显示 JoyID/CCC 签名弹窗 (可选模式)
 *
 * 悬浮在视频右侧, 一键打赏预设金额
 */

import React, { useState, useCallback } from "react";
import { getApiClient } from "../lib/apiClient";
import { useAuthStore, usePointsStore } from "../stores";
import { tipWithCkb } from "../lib/ckbSigner";

interface QuickTipProps {
    videoId: string;
    creatorAddress?: string;
    onTipSuccess?: (amount: number, currency: "points" | "ckb") => void;
}

// 积分打赏预设金额
const POINT_AMOUNTS = [1, 5, 10, 50, 100];
// CKB 打赏预设金额 (单位: CKB)
const CKB_AMOUNTS = [10, 50, 100, 500];

type PayMode = "points" | "ckb";

const QuickTip: React.FC<QuickTipProps> = ({ videoId, creatorAddress, onTipSuccess }) => {
    const [expanded, setExpanded] = useState(false);
    const [sending, setSending] = useState(false);
    const [lastTip, setLastTip] = useState<{ amount: number; currency: PayMode } | null>(null);
    const [payMode, setPayMode] = useState<PayMode>("points");
    const user = useAuthStore((s) => s.user);
    const api = getApiClient();

    const handlePointsTip = useCallback(
        async (amount: number) => {
            if (!user?.id || sending) return;
            setSending(true);
            try {
                await api.post("/payment/tip", {
                    fromUserId: user.id,
                    videoId,
                    toCreatorAddress: creatorAddress,
                    amount,
                    currency: "points",
                    showDanmaku: true,
                });
                setLastTip({ amount, currency: "points" });
                usePointsStore.getState().deduct(amount);
                onTipSuccess?.(amount, "points");
                setTimeout(() => setLastTip(null), 2000);
                setExpanded(false);
            } catch (err: any) {
                // 积分不足时提示切换到 CKB
                if (err?.code === "insufficient_points") {
                    setPayMode("ckb");
                } else {
                    console.error("Tip failed:", err);
                }
            } finally {
                setSending(false);
            }
        },
        [user?.id, videoId, creatorAddress, sending]
    );

    const handleCkbTip = useCallback(
        async (amount: number) => {
            if (!user?.id || sending) return;
            if (!creatorAddress) {
                console.warn("Creator has no CKB address");
                return;
            }
            setSending(true);
            try {
                const result = await tipWithCkb({
                    videoId,
                    creatorAddress,
                    amount,
                });

                if (result.success) {
                    setLastTip({ amount, currency: "ckb" });
                    onTipSuccess?.(amount, "ckb");
                    setTimeout(() => setLastTip(null), 2000);
                    setExpanded(false);
                } else {
                    console.error("CKB tip failed:", result.error);
                }
            } catch (err) {
                console.error("CKB tip error:", err);
            } finally {
                setSending(false);
            }
        },
        [user?.id, videoId, creatorAddress, sending]
    );

    const amounts = payMode === "points" ? POINT_AMOUNTS : CKB_AMOUNTS;
    const handleTip = payMode === "points" ? handlePointsTip : handleCkbTip;

    return (
        <div style={styles.container}>
            {/* 成功动画 */}
            {lastTip !== null && (
                <div style={styles.success}>
                    +{lastTip.amount} {lastTip.currency === "ckb" ? "CKB" : "✨"} 🎉
                </div>
            )}

            {/* 金额选择面板 */}
            {expanded && (
                <div style={styles.panel}>
                    {/* 模式切换 */}
                    <div style={styles.modeSwitch}>
                        <button
                            onClick={() => setPayMode("points")}
                            style={{
                                ...styles.modeBtn,
                                ...(payMode === "points" ? styles.modeBtnActive : {}),
                            }}
                        >
                            ✨ 积分
                        </button>
                        <button
                            onClick={() => setPayMode("ckb")}
                            style={{
                                ...styles.modeBtn,
                                ...(payMode === "ckb" ? styles.modeBtnActive : {}),
                            }}
                            disabled={!creatorAddress}
                            title={!creatorAddress ? "创作者未连接钱包" : "CKB 链上打赏"}
                        >
                            ⛓ CKB
                        </button>
                    </div>

                    {/* 金额按钮 */}
                    <div style={styles.amounts}>
                        {amounts.map((amt) => (
                            <button
                                key={amt}
                                onClick={() => handleTip(amt)}
                                disabled={sending}
                                style={styles.amountBtn}
                            >
                                {amt}
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {/* 主按钮 */}
            <button
                onClick={() => setExpanded(!expanded)}
                style={{
                    ...styles.mainBtn,
                    ...(expanded ? styles.mainBtnActive : {}),
                }}
                title="打赏"
            >
                🎁
            </button>
        </div>
    );
};

const styles: Record<string, React.CSSProperties> = {
    container: {
        position: "fixed" as const,
        right: 16,
        bottom: 120,
        display: "flex",
        flexDirection: "column" as const,
        alignItems: "center",
        gap: 8,
        zIndex: 100,
    },
    mainBtn: {
        width: 52,
        height: 52,
        borderRadius: "50%",
        border: "none",
        background: "linear-gradient(135deg, #f59e0b, #d97706)",
        fontSize: 24,
        cursor: "pointer",
        boxShadow: "0 4px 20px rgba(245, 158, 11, 0.4)",
        transition: "all 0.3s",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
    },
    mainBtnActive: {
        transform: "rotate(45deg)",
        background: "linear-gradient(135deg, #ef4444, #dc2626)",
    },
    panel: {
        display: "flex",
        flexDirection: "column" as const,
        gap: 8,
        animation: "quicktip-fadein 0.2s ease-out",
    },
    modeSwitch: {
        display: "flex",
        gap: 4,
        justifyContent: "center",
    },
    modeBtn: {
        padding: "3px 8px",
        fontSize: 10,
        fontWeight: 600,
        border: "1px solid rgba(255,255,255,0.15)",
        borderRadius: 12,
        background: "rgba(0,0,0,0.5)",
        color: "rgba(255,255,255,0.6)",
        cursor: "pointer",
        transition: "all 0.2s",
    },
    modeBtnActive: {
        background: "rgba(162, 103, 255, 0.3)",
        borderColor: "rgba(162, 103, 255, 0.6)",
        color: "#fff",
    },
    amounts: {
        display: "flex",
        flexDirection: "column" as const,
        gap: 6,
    },
    amountBtn: {
        width: 44,
        height: 44,
        borderRadius: "50%",
        border: "2px solid rgba(255,255,255,0.15)",
        background: "rgba(0,0,0,0.7)",
        backdropFilter: "blur(10px)",
        color: "#fff",
        fontSize: 13,
        fontWeight: 700,
        cursor: "pointer",
        transition: "all 0.2s",
    },
    success: {
        background: "linear-gradient(135deg, #22c55e, #16a34a)",
        color: "#fff",
        padding: "6px 14px",
        borderRadius: 20,
        fontSize: 14,
        fontWeight: 700,
        animation: "quicktip-float 2s ease-out forwards",
        whiteSpace: "nowrap" as const,
    },
};

// 注入动画
if (typeof document !== "undefined" && !document.getElementById("quicktip-styles")) {
    const style = document.createElement("style");
    style.id = "quicktip-styles";
    style.textContent = `
        @keyframes quicktip-fadein {
            from { opacity: 0; transform: translateY(8px); }
            to { opacity: 1; transform: translateY(0); }
        }
        @keyframes quicktip-float {
            0% { opacity: 1; transform: translateY(0); }
            100% { opacity: 0; transform: translateY(-60px); }
        }
    `;
    document.head.appendChild(style);
}

export default QuickTip;
