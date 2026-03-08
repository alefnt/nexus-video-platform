import React, { useState, useEffect } from "react";
import { Clock, Play, Bell } from "lucide-react";
import "../styles/fun.css";

interface PremiereLobbyProps {
    premiereTime: number;
    title: string;
    posterUrl?: string;
    onEnter: () => void; // Trigger when timer ends
}

export function PremiereLobby({ premiereTime, title, posterUrl, onEnter }: PremiereLobbyProps) {
    const [timeLeft, setTimeLeft] = useState<number>(0);

    useEffect(() => {
        const update = () => {
            const now = Date.now();
            const diff = premiereTime - now;
            if (diff <= 0) {
                setTimeLeft(0);
                onEnter();
            } else {
                setTimeLeft(diff);
            }
        };
        update();
        const timer = setInterval(update, 1000);
        return () => clearInterval(timer);
    }, [premiereTime, onEnter]);

    const formatTime = (ms: number) => {
        const totalSeconds = Math.floor(ms / 1000);
        const d = Math.floor(totalSeconds / 86400);
        const h = Math.floor((totalSeconds % 86400) / 3600);
        const m = Math.floor((totalSeconds % 3600) / 60);
        const s = totalSeconds % 60;

        // Smart Format
        if (d > 0) return `${d}d ${h}h ${m}m ${s}s`;
        return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    };

    return (
        <div className="premiere-lobby-container" style={{
            position: "relative",
            width: "100%",
            height: "100%",
            borderRadius: "var(--radius-lg)",
            overflow: "hidden",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            background: "#000",
            color: "#fff",
            boxShadow: "0 0 50px rgba(162,103,255,0.2)"
        }}>
            {/* Background (Blurred Poster) */}
            <div style={{
                position: "absolute", inset: 0,
                backgroundImage: posterUrl ? `url(${posterUrl})` : "linear-gradient(135deg, #1a1a2e, #0f0f1a)",
                backgroundSize: "cover",
                backgroundPosition: "center",
                filter: "blur(20px) brightness(0.4)",
                transform: "scale(1.1)",
                zIndex: 1
            }} />

            {/* Cyberpunk Grid Overlay */}
            <div style={{
                position: "absolute", inset: 0,
                background: "radial-gradient(circle at center, transparent 0%, #000 90%)",
                zIndex: 2
            }} />

            {/* Content */}
            <div style={{ position: "relative", zIndex: 10, textAlign: "center", width: "100%", maxWidth: 600, padding: 20 }}>

                <div style={{
                    marginBottom: 24,
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 8,
                    padding: "8px 16px",
                    borderRadius: 30,
                    background: "rgba(255, 46, 147, 0.2)",
                    border: "1px solid var(--accent-pink)",
                    color: "var(--accent-pink)",
                    fontWeight: 700,
                    fontSize: 14,
                    boxShadow: "0 0 20px rgba(255, 46, 147, 0.4)"
                }}>
                    <Play size={16} fill="currentColor" /> LIVE PREMIERE
                </div>

                <h2 style={{ fontSize: 28, fontWeight: 700, marginBottom: 40, textShadow: "0 2px 10px rgba(0,0,0,0.5)" }}>
                    Premiere Starts In...
                </h2>

                <div style={{
                    fontSize: 80,
                    fontWeight: 800,
                    fontFamily: "var(--font-mono)",
                    letterSpacing: 4,
                    marginBottom: 48,
                    background: "linear-gradient(to bottom, #fff, #aaa)",
                    WebkitBackgroundClip: "text",
                    WebkitTextFillColor: "transparent",
                    filter: "drop-shadow(0 0 20px rgba(162,103,255,0.6))"
                }}>
                    {formatTime(timeLeft)}
                </div>

                <div style={{ display: "flex", gap: 16, justifyContent: "center" }}>
                    <button className="btn-neon" style={{ minWidth: 180, gap: 8 }}>
                        <Bell size={18} /> Notify Me
                    </button>
                    <button className="btn-ghost" onClick={() => {
                        const url = window.location.href;
                        navigator.clipboard.writeText(url);
                        alert("Link copied!");
                    }}>
                        Share Invite
                    </button>
                </div>

                <div style={{ marginTop: 40, fontSize: 13, color: "var(--text-muted)" }}>
                    Join the chat on the right while you wait! 👉
                </div>
            </div>

            {/* Visualizer Animation (CSS only for now) */}
            <div className="audio-viz" style={{
                position: "absolute", bottom: 0, left: 0, right: 0, height: 100,
                background: "linear-gradient(to top, rgba(162,103,255,0.1), transparent)",
                zIndex: 5,
                pointerEvents: "none"
            }} />
        </div>
    );
}
