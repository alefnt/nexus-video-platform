// FILE: /client-web/src/components/OnRampWidget.tsx
/**
 * Fiat On-Ramp Widget — MoonPay / Transak Integration
 * 
 * Allows overseas users to buy CKB or USDI with fiat currency.
 * Embeds the on-ramp provider's widget in an iframe.
 * 
 * Flow: User clicks "Buy CKB" → Widget opens → User pays with card → CKB arrives in JoyID wallet
 * 
 * Environment Variables (via VITE_):
 * - VITE_ONRAMP_PROVIDER: "moonpay" | "transak" (default: transak)
 * - VITE_MOONPAY_API_KEY: MoonPay API key
 * - VITE_TRANSAK_API_KEY: Transak API key
 */
import React, { useState, useMemo } from "react";

interface OnRampWidgetProps {
    walletAddress: string;
    currency?: string;  // "CKB" or "USDI"
    amount?: number;
    onClose?: () => void;
    onSuccess?: (txHash: string) => void;
}

export default function OnRampWidget({
    walletAddress,
    currency = "CKB",
    amount,
    onClose,
    onSuccess,
}: OnRampWidgetProps) {
    const [loading, setLoading] = useState(true);

    const provider = (import.meta as any)?.env?.VITE_ONRAMP_PROVIDER || "transak";

    const widgetUrl = useMemo(() => {
        if (provider === "moonpay") {
            const apiKey = (import.meta as any)?.env?.VITE_MOONPAY_API_KEY || "";
            return `https://buy.moonpay.com?apiKey=${apiKey}&currencyCode=${currency.toLowerCase()}&walletAddress=${walletAddress}${amount ? `&baseCurrencyAmount=${amount}` : ""}`;
        }

        // Default: Transak
        const apiKey = (import.meta as any)?.env?.VITE_TRANSAK_API_KEY || "";
        return `https://global.transak.com?apiKey=${apiKey}&cryptoCurrencyCode=${currency}&walletAddress=${walletAddress}&network=nervos${amount ? `&defaultFiatAmount=${amount}` : ""}&themeColor=6366f1`;
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
                        💳 Buy {currency}
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
                            Loading {provider === "moonpay" ? "MoonPay" : "Transak"}...
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
                        title={`Buy ${currency}`}
                    />
                </div>

                {/* Footer */}
                <div style={{
                    padding: "12px 20px",
                    borderTop: "1px solid rgba(255,255,255,0.1)",
                    textAlign: "center",
                }}>
                    <p style={{ margin: 0, fontSize: 11, color: "#666" }}>
                        Powered by {provider === "moonpay" ? "MoonPay" : "Transak"} • {currency} will be sent to your JoyID wallet
                    </p>
                </div>
            </div>
        </div>
    );
}
