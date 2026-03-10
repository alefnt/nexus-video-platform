/**
 * WatchParty Sub-Components
 *
 * Extracted from WatchParty.tsx (49KB → split into reusable parts)
 * Import: import { PartyControls, ParticipantList, RemoteCursors } from '../components/party';
 */

import React, { useState } from "react";

// ═══ Party Collaborative Controls ═══

interface PartyControlsProps {
    isHost: boolean;
    isPlaying: boolean;
    currentTime: number;
    duration: number;
    hasControl: boolean;
    onPlayPause: () => void;
    onSeek: (time: number) => void;
    onRequestControl: () => void;
    onShareScreen: () => void;
    isScreenSharing: boolean;
}

export function PartyControls({
    isHost, isPlaying, currentTime, duration, hasControl,
    onPlayPause, onSeek, onRequestControl, onShareScreen, isScreenSharing,
}: PartyControlsProps) {
    const canControl = isHost || hasControl;
    const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

    return (
        <div style={{
            display: "flex", alignItems: "center", gap: "12px",
            padding: "12px 20px", background: "rgba(0,0,0,0.8)",
            borderRadius: "12px", backdropFilter: "blur(10px)",
            border: "1px solid rgba(108,92,231,0.3)",
        }}>
            <button onClick={onPlayPause} disabled={!canControl}
                style={{
                    background: "none", border: "none", color: canControl ? "#fff" : "#555",
                    fontSize: "22px", cursor: canControl ? "pointer" : "not-allowed",
                }}>
                {isPlaying ? "⏸" : "▶️"}
            </button>

            <div style={{ flex: 1, height: "4px", background: "#333", borderRadius: "2px", position: "relative" }}
                onClick={(e) => {
                    if (!canControl) return;
                    const rect = e.currentTarget.getBoundingClientRect();
                    onSeek(((e.clientX - rect.left) / rect.width) * duration);
                }}>
                <div style={{ width: `${progress}%`, height: "100%", background: "#6c5ce7", borderRadius: "2px" }} />
            </div>

            {isHost && (
                <button onClick={onShareScreen} style={{
                    padding: "6px 14px", borderRadius: "8px",
                    background: isScreenSharing ? "#e17055" : "rgba(108,92,231,0.3)",
                    border: "1px solid rgba(108,92,231,0.5)", color: "#fff",
                    cursor: "pointer", fontSize: "12px", fontWeight: 500,
                }}>
                    {isScreenSharing ? "⏹ 停止共享" : "🖥 共享屏幕"}
                </button>
            )}

            {!isHost && !hasControl && (
                <button onClick={onRequestControl} style={{
                    padding: "6px 14px", borderRadius: "8px",
                    background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)",
                    color: "#aaa", cursor: "pointer", fontSize: "12px",
                }}>
                    🙋 请求控制
                </button>
            )}

            {hasControl && !isHost && (
                <span style={{ color: "#00b894", fontSize: "12px" }}>✅ 你有控制权</span>
            )}
        </div>
    );
}

// ═══ Participant List ═══

interface Participant {
    id: string;
    name: string;
    avatar?: string;
    isHost: boolean;
    hasControl: boolean;
    reaction?: string;
}

interface ParticipantListProps {
    participants: Participant[];
    onGrantControl?: (userId: string) => void;
    isHost: boolean;
}

export function ParticipantList({ participants, onGrantControl, isHost }: ParticipantListProps) {
    return (
        <div style={{
            padding: "16px", background: "rgba(255,255,255,0.02)",
            borderRadius: "12px", border: "1px solid rgba(255,255,255,0.06)",
        }}>
            <h4 style={{ color: "#aaa", fontSize: "13px", margin: "0 0 12px", fontWeight: 500 }}>
                参与者 ({participants.length})
            </h4>
            {participants.map((p) => (
                <div key={p.id} style={{
                    display: "flex", alignItems: "center", gap: "10px",
                    padding: "6px 0",
                }}>
                    <div style={{
                        width: "28px", height: "28px", borderRadius: "50%",
                        background: p.avatar ? `url(${p.avatar}) center/cover` : `hsl(${p.name.charCodeAt(0) * 10}, 60%, 50%)`,
                        border: p.isHost ? "2px solid #6c5ce7" : p.hasControl ? "2px solid #00b894" : "none",
                    }} />
                    <span style={{ color: "#ddd", fontSize: "13px", flex: 1 }}>
                        {p.name} {p.isHost ? "👑" : ""} {p.reaction || ""}
                    </span>
                    {isHost && !p.isHost && onGrantControl && (
                        <button onClick={() => onGrantControl(p.id)} style={{
                            background: "none", border: "none", color: "#888",
                            cursor: "pointer", fontSize: "11px",
                        }}>
                            {p.hasControl ? "收回" : "授权"}
                        </button>
                    )}
                </div>
            ))}
        </div>
    );
}

// ═══ Remote Cursors Overlay ═══

interface RemoteCursor {
    userId: string;
    name: string;
    x: number;
    y: number;
    color: string;
}

interface RemoteCursorsProps {
    cursors: RemoteCursor[];
}

export function RemoteCursors({ cursors }: RemoteCursorsProps) {
    return (
        <>
            {cursors.map((c) => (
                <div key={c.userId} style={{
                    position: "absolute", left: `${c.x}%`, top: `${c.y}%`,
                    pointerEvents: "none", zIndex: 100,
                    transition: "left 0.1s, top 0.1s",
                }}>
                    <svg width="16" height="16" viewBox="0 0 16 16" fill={c.color}>
                        <path d="M0 0l16 6-6.5 2.5L7 16z" />
                    </svg>
                    <span style={{
                        position: "absolute", left: "18px", top: "-2px",
                        background: c.color, color: "#fff", padding: "1px 6px",
                        borderRadius: "4px", fontSize: "10px", whiteSpace: "nowrap",
                    }}>
                        {c.name}
                    </span>
                </div>
            ))}
        </>
    );
}
