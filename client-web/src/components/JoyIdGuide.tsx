/**
 * JoyID 连接引导弹窗
 *
 * 当 Web2 用户尝试使用链上功能但未连接 JoyID 时显示,
 * 引导用户通过 Passkey/生物识别 一键创建或连接 JoyID 钱包。
 *
 * 使用场景:
 * - CKB 打赏
 * - NFT 铸造
 * - 链上投票
 * - 内容上链
 */

import React, { useState } from "react";

interface JoyIdGuideProps {
    /** 是否显示弹窗 */
    visible: boolean;
    /** 关闭弹窗 */
    onClose: () => void;
    /** 连接成功的回调 (address) */
    onConnect?: (address: string) => void;
    /** 提示文案 — 告诉用户为什么需要连接 */
    reason?: string;
}

const JoyIdGuide: React.FC<JoyIdGuideProps> = ({
    visible,
    onClose,
    onConnect,
    reason = "此功能需要连接钱包",
}) => {
    const [connecting, setConnecting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    if (!visible) return null;

    const handleConnect = async () => {
        setConnecting(true);
        setError(null);
        try {
            // 动态导入 @joyid/ckb，避免所有页面都加载 JoyID SDK
            const { connect } = await import("@joyid/ckb");
            const res = await connect();
            if (res?.address) {
                onConnect?.(res.address);
                onClose();
            } else {
                setError("未获取到地址，请重试");
            }
        } catch (e: any) {
            if (e?.message?.includes("cancelled") || e?.message?.includes("abort")) {
                // 用户取消 — 不显示错误
                return;
            }
            setError(e?.message || "连接失败，请重试");
        } finally {
            setConnecting(false);
        }
    };

    return (
        <div style={styles.overlay} onClick={onClose}>
            <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
                {/* Header */}
                <div style={styles.header}>
                    <span style={{ fontSize: 32 }}>🔐</span>
                    <h2 style={styles.title}>连接 JoyID 钱包</h2>
                    <button onClick={onClose} style={styles.closeBtn}>✕</button>
                </div>

                {/* Reason */}
                <p style={styles.reason}>{reason}</p>

                {/* Benefits */}
                <div style={styles.benefits}>
                    <div style={styles.benefitItem}>
                        <span style={styles.benefitIcon}>🔑</span>
                        <div>
                            <strong>Passkey / 生物识别</strong>
                            <p style={styles.benefitDesc}>指纹或面容即可，无需记住密码或助记词</p>
                        </div>
                    </div>
                    <div style={styles.benefitItem}>
                        <span style={styles.benefitIcon}>⚡</span>
                        <div>
                            <strong>一键创建</strong>
                            <p style={styles.benefitDesc}>首次使用自动创建钱包，10 秒完成</p>
                        </div>
                    </div>
                    <div style={styles.benefitItem}>
                        <span style={styles.benefitIcon}>🛡️</span>
                        <div>
                            <strong>安全自主</strong>
                            <p style={styles.benefitDesc}>私钥存储在你的设备中，完全由你掌控</p>
                        </div>
                    </div>
                </div>

                {/* Connect Button */}
                <button
                    onClick={handleConnect}
                    disabled={connecting}
                    style={{
                        ...styles.connectBtn,
                        ...(connecting ? { opacity: 0.7 } : {}),
                    }}
                >
                    {connecting ? "连接中..." : "🚀 连接 JoyID"}
                </button>

                {/* Error */}
                {error && <p style={styles.error}>{error}</p>}

                {/* Skip */}
                <button onClick={onClose} style={styles.skipBtn}>
                    暂不连接，继续浏览
                </button>
            </div>
        </div>
    );
};

const styles: Record<string, React.CSSProperties> = {
    overlay: {
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.65)",
        backdropFilter: "blur(6px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 9999,
        animation: "joyid-fadein 0.2s ease-out",
    },
    modal: {
        background: "linear-gradient(145deg, #1e1e2e, #2a2a3e)",
        borderRadius: 20,
        padding: "32px 28px",
        maxWidth: 400,
        width: "90%",
        border: "1px solid rgba(162, 103, 255, 0.2)",
        boxShadow: "0 24px 48px rgba(0,0,0,0.4)",
    },
    header: {
        display: "flex",
        alignItems: "center",
        gap: 12,
        marginBottom: 16,
    },
    title: {
        flex: 1,
        fontSize: 20,
        fontWeight: 700,
        color: "#fff",
        margin: 0,
    },
    closeBtn: {
        background: "none",
        border: "none",
        color: "rgba(255,255,255,0.4)",
        fontSize: 18,
        cursor: "pointer",
        padding: 4,
    },
    reason: {
        fontSize: 14,
        color: "rgba(255,255,255,0.6)",
        marginBottom: 20,
        lineHeight: 1.5,
    },
    benefits: {
        display: "flex",
        flexDirection: "column" as const,
        gap: 14,
        marginBottom: 24,
    },
    benefitItem: {
        display: "flex",
        alignItems: "flex-start",
        gap: 12,
    },
    benefitIcon: {
        fontSize: 20,
        marginTop: 2,
    },
    benefitDesc: {
        fontSize: 12,
        color: "rgba(255,255,255,0.5)",
        margin: "2px 0 0",
    },
    connectBtn: {
        width: "100%",
        padding: "14px 0",
        borderRadius: 12,
        border: "none",
        background: "linear-gradient(135deg, #7c3aed, #a855f7)",
        color: "#fff",
        fontSize: 16,
        fontWeight: 700,
        cursor: "pointer",
        transition: "all 0.2s",
        marginBottom: 12,
    },
    error: {
        textAlign: "center" as const,
        color: "#fca5a5",
        fontSize: 13,
        margin: "8px 0",
    },
    skipBtn: {
        width: "100%",
        padding: "10px 0",
        borderRadius: 8,
        border: "none",
        background: "transparent",
        color: "rgba(255,255,255,0.4)",
        fontSize: 13,
        cursor: "pointer",
        transition: "color 0.2s",
    },
};

// 注入动画
if (typeof document !== "undefined" && !document.getElementById("joyid-guide-styles")) {
    const style = document.createElement("style");
    style.id = "joyid-guide-styles";
    style.textContent = `
        @keyframes joyid-fadein {
            from { opacity: 0; }
            to { opacity: 1; }
        }
    `;
    document.head.appendChild(style);
}

export default JoyIdGuide;
