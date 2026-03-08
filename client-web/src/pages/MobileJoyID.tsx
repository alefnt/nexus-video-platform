// FILE: /video-platform/client-web/src/pages/MobileJoyID.tsx
/**
 * Mobile JoyID Callback Page
 *
 * Handles JoyID Passkey authentication from the React Native mobile app.
 * Flow: RN WebView opens this page -> user signs challenge -> result posted back to RN.
 */

import React, { useState } from "react";

interface RNWebView {
    postMessage: (msg: string) => void;
}

declare global {
    interface Window {
        ReactNativeWebView?: RNWebView;
    }
}

const JOYID_MOBILE_RESULT = "JOYID_MOBILE_RESULT";

export default function MobileJoyID() {
    const [status, setStatus] = useState("Ready / 准备就绪");
    const [error, setError] = useState<string | null>(null);

    const start = async () => {
        try {
            setStatus("Connecting to JoyID... / 正在连接 JoyID...");
            setError(null);

            const { signChallenge, connect } = await import("@joyid/ckb");

            // 1. Connect wallet
            const addr = await connect();
            if (!addr) {
                setError("No address returned / JoyID 未返回地址");
                return;
            }
            setStatus("Signing challenge... / 正在签名...");

            // 2. Sign challenge
            const nonce = crypto.randomUUID();
            const sig = await signChallenge(
                `Nexus Login: ${nonce}`,
                addr
            );

            const payload = {
                type: JOYID_MOBILE_RESULT,
                address: addr,
                signature: sig,
                nonce,
            };

            // 3. Send result back to React Native WebView
            if (window.ReactNativeWebView) {
                window.ReactNativeWebView.postMessage(JSON.stringify(payload));
                setStatus("Sent to mobile app / 已发送签名结果到移动端");
            } else {
                // Fallback for debugging
                setStatus("No RN WebView detected / 未检测到 RN WebView");
                console.log("JoyID result:", payload);
            }
        } catch (e: any) {
            setError(e?.message || "Operation failed / 操作失败");
            setStatus("Failed / 失败");
        }
    };

    return (
        <>
            <div style={{ maxWidth: 480, margin: "40px auto", padding: 24, textAlign: "center" }}>
                <h2 style={{ marginBottom: 16, color: "#22d3ee" }}>JoyID Mobile Login</h2>
                <p style={{ color: "#9ca3af", marginBottom: 24 }}>{status}</p>
                {error && <div style={{ color: "#ef4444", marginBottom: 16 }}>{error}</div>}
                <button
                    onClick={start}
                    style={{
                        marginTop: 16,
                        padding: "12px 32px",
                        borderRadius: 12,
                        border: "none",
                        background: "linear-gradient(135deg, #22d3ee, #a855f7)",
                        color: "#fff",
                        fontWeight: 700,
                        fontSize: 16,
                        cursor: "pointer",
                    }}
                >
                    Start Login
                </button>
            </div>
        </>
    );
}
