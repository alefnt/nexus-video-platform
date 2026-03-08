// FILE: /client-web/src/components/OffRampWidget.tsx
/**
 * Fiat Off-Ramp Widget — MoonPay / Transak Integration (Creator Withdrawal)
 * 
 * Allows creators to sell CKB or USDI for fiat currency.
 * Embeds the off-ramp provider's widget in an iframe.
 * 
 * Flow: Creator clicks "Withdraw" → Widget opens → CKB/USDI → Fiat to bank account
 * 
 * Environment Variables (via VITE_):
 * - VITE_ONRAMP_PROVIDER: "moonpay" | "transak" (default: transak) — same provider for both
 * - VITE_MOONPAY_API_KEY / VITE_TRANSAK_API_KEY
 */
import React, { useState, useMemo } from "react";

interface OffRampWidgetProps {
    walletAddress: string;
    currency?: string;  // "CKB" or "USDI"
    amount?: number;
    onClose?: () => void;
    onSuccess?: (txHash: string) => void;
}

export default function OffRampWidget({
    walletAddress,
    currency = "CKB",
    amount,
    onClose,
    onSuccess,
}: OffRampWidgetProps) {
    const [loading, setLoading] = useState(true);

    const provider = (import.meta as any)?.env?.VITE_ONRAMP_PROVIDER || "transak";

    const widgetUrl = useMemo(() => {
        if (provider === "moonpay") {
            const apiKey = (import.meta as any)?.env?.VITE_MOONPAY_API_KEY || "";
            return `https://sell.moonpay.com?apiKey=${apiKey}&baseCurrencyCode=${currency.toLowerCase()}&refundWalletAddress=${walletAddress}${amount ? `&baseCurrencyAmount=${amount}` : ""}`;
        }

        // Default: Transak (sell mode)
        const apiKey = (import.meta as any)?.env?.VITE_TRANSAK_API_KEY || "";
        return `https://global.transak.com?apiKey=${apiKey}&cryptoCurrencyCode=${currency}&walletAddress=${walletAddress}&network=nervos&productsAvailed=SELL${amount ? `&defaultCryptoAmount=${amount}` : ""}&themeColor=10b981`;
    }, [provider, walletAddress, currency, amount]);

    return (
        <div style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.7)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 10000,
            backdropFilter: "blur(4px)",
        }}>
            <div style={{
                background: "#1a1a2e",
                borderRadius: 16,
                overflow: "hidden",
                width: "min(480px, 95vw)",
                height: "min(680px, 90vh)",
                boxShadow: "0 16px 64px rgba(0,0,0,0.5)",
                display: "flex",
                flexDirection: "column",
            }}>
                {/* Header */}
                <div style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    padding: "16px 20px",
                    borderBottom: "1px solid rgba(255,255,255,0.1)",
                }}>
                    <h3 style={{ margin: 0, color: "#fff", fontSize: 16 }}>
                        💰 Withdraw {currency} to Fiat
                    </h3>
                    <button
                        onClick={onClose}
                        style={{
                            background: "none",
                            border: "none",
                            color: "#888",
                            fontSize: 20,
                            cursor: "pointer",
                        }}
                    >✕</button>
                </div>

                {/* Widget iframe */}
                <div style={{ flex: 1, position: "relative" }}>
                    {loading && (
                        <div style={{
                            position: "absolute",
                            inset: 0,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            color: "#888",
                        }}>
                            Loading {provider === "moonpay" ? "MoonPay" : "Transak"} (Sell Mode)...
                        </div>
                    )}
                    <iframe
                        src={widgetUrl}
                        style={{
                            width: "100%",
                            height: "100%",
                            border: "none",
                        }}
                        onLoad={() => setLoading(false)}
                        allow="camera;microphone;fullscreen;payment"
                        title={`Sell ${currency} for fiat`}
                    />
                </div>

                {/* Footer */}
                <div style={{
                    padding: "12px 20px",
                    borderTop: "1px solid rgba(255,255,255,0.1)",
                    textAlign: "center",
                }}>
                    <p style={{ margin: 0, fontSize: 11, color: "#666" }}>
                        Powered by {provider === "moonpay" ? "MoonPay" : "Transak"} • {currency} will be converted to your local currency
                    </p>
                </div>
            </div>
        </div>
    );
}
