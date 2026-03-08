// FILE: /client-web/src/components/WalletBindPrompt.tsx
/**
 * Wallet Bind Prompt — prompts Web2 users to bind their JoyID wallet
 * 
 * Shown when user logged in via Email/Phone/Twitter/Google but has no CKB address.
 * Binds JoyID wallet to their existing account for Fiber payments.
 */
import React, { useState } from "react";
import { connect } from "@joyid/ckb";
import { getApiClient } from "../lib/apiClient";
import { useAuthStore } from "../stores";
import { useTranslation } from "react-i18next";

const joyidURL = (import.meta as any)?.env?.VITE_JOYID_APP_URL || "https://testnet.joyid.dev";

interface WalletBindPromptProps {
    onClose?: () => void;
    onBound?: (address: string) => void;
}

export default function WalletBindPrompt({ onClose, onBound }: WalletBindPromptProps) {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const { t } = useTranslation();

    const handleBindWallet = async () => {
        setLoading(true);
        setError(null);
        try {
            // 1. Connect JoyID (triggers biometric auth)
            const authData = await connect();
            const ckbAddress = authData?.address;
            if (!ckbAddress) {
                setError("Failed to get CKB address from JoyID");
                return;
            }

            // 2. Send to backend to bind
            const jwt = sessionStorage.getItem("vp.jwt");
            if (!jwt) {
                setError("Not logged in");
                return;
            }

            const api = getApiClient();
            api.setJWT(jwt);
            const result = await api.post<{
                jwt: string;
                walletBound: boolean;
                ckbAddress: string;
                nostrPubkey?: string;
            }>("/auth/bind-wallet", {
                ckbAddress,
                nostrPubkey: (authData as any)?.nostrPubkey || undefined,
            });

            if (result?.jwt) {
                // Update session with new JWT containing CKB address
                sessionStorage.setItem("vp.jwt", result.jwt);
                const existingUser = sessionStorage.getItem("vp.user");
                if (existingUser) {
                    const user = JSON.parse(existingUser);
                    user.ckbAddress = ckbAddress;
                    sessionStorage.setItem("vp.user", JSON.stringify(user));
                }
                onBound?.(ckbAddress);
            }
        } catch (err: any) {
            setError(err?.message || "Wallet binding failed");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div style={{
            position: "fixed",
            bottom: 24,
            right: 24,
            background: "linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)",
            border: "1px solid rgba(100, 200, 255, 0.3)",
            borderRadius: 16,
            padding: "20px 24px",
            maxWidth: 380,
            boxShadow: "0 8px 32px rgba(0,0,0,0.4)",
            zIndex: 1000,
            color: "#fff",
        }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                <h3 style={{ margin: 0, fontSize: 16, color: "#64c8ff" }}>🔗 Bind Wallet</h3>
                {onClose && (
                    <button onClick={onClose} style={{ background: "none", border: "none", color: "#888", cursor: "pointer", fontSize: 18 }}>✕</button>
                )}
            </div>
            <p style={{ fontSize: 13, color: "#aaa", margin: "0 0 16px" }}>
                Bind your JoyID wallet to enable Fiber payments, CKB transactions, and creator payouts.
            </p>
            {error && <p style={{ color: "#ff6b6b", fontSize: 12, margin: "0 0 12px" }}>{error}</p>}
            <button
                onClick={handleBindWallet}
                disabled={loading}
                style={{
                    width: "100%",
                    padding: "12px",
                    background: loading ? "#333" : "linear-gradient(135deg, #667eea, #764ba2)",
                    border: "none",
                    borderRadius: 8,
                    color: "#fff",
                    fontSize: 14,
                    fontWeight: 600,
                    cursor: loading ? "not-allowed" : "pointer",
                    transition: "all 0.2s",
                }}
            >
                {loading ? "Connecting JoyID..." : "🔐 Bind with JoyID (Fingerprint)"}
            </button>
            <p style={{ fontSize: 11, color: "#666", marginTop: 8, textAlign: "center" }}>
                Uses your device biometrics — no passwords needed
            </p>
        </div>
    );
}
