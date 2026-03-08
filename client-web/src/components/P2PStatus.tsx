// FILE: /video-platform/client-web/src/components/P2PStatus.tsx
/**
 * Nexus Video - P2P 状态指示器
 * 
 * 显示 WebTorrent P2P 网络状态：
 * - 连接的 Peer 数量
 * - 上传/下载速度
 * - 网络健康状态
 */

import React, { useEffect, useState } from "react";
import { getStats, isWebTorrentSupported } from "../lib/webtorrent";

interface P2PStatusProps {
    compact?: boolean;
    showSpeed?: boolean;
    refreshInterval?: number;
}

export function P2PStatus({
    compact = false,
    showSpeed = true,
    refreshInterval = 2000,
}: P2PStatusProps) {
    const [stats, setStats] = useState({
        totalPeers: 0,
        totalDownloadSpeed: 0,
        totalUploadSpeed: 0,
        activeTorrents: 0,
    });
    const [supported, setSupported] = useState(true);

    useEffect(() => {
        setSupported(isWebTorrentSupported());

        const interval = setInterval(() => {
            try {
                const newStats = getStats();
                setStats(newStats);
            } catch {
                // WebTorrent 未初始化
            }
        }, refreshInterval);

        return () => clearInterval(interval);
    }, [refreshInterval]);

    if (!supported) {
        return (
            <div className="p2p-status unsupported" title="P2P 不支持">
                <span className="mini-dot error" />
                <span className="meta">P2P 不可用</span>
            </div>
        );
    }

    const formatSpeed = (bytesPerSecond: number): string => {
        if (bytesPerSecond >= 1024 * 1024) {
            return `${(bytesPerSecond / (1024 * 1024)).toFixed(1)} MB/s`;
        }
        if (bytesPerSecond >= 1024) {
            return `${(bytesPerSecond / 1024).toFixed(1)} KB/s`;
        }
        return `${bytesPerSecond} B/s`;
    };

    const healthColor =
        stats.totalPeers === 0
            ? "var(--text-muted)"
            : stats.totalPeers < 3
                ? "var(--warning)"
                : "var(--accent-cyan)";

    if (compact) {
        return (
            <div
                className="p2p-status compact"
                title={`${stats.totalPeers} peers | ↓${formatSpeed(stats.totalDownloadSpeed)} ↑${formatSpeed(stats.totalUploadSpeed)}`}
                style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                    padding: "4px 10px",
                    background: "var(--bg-elevated)",
                    borderRadius: "var(--radius-sm)",
                    border: "1px solid var(--border-subtle)",
                    fontSize: 12,
                }}
            >
                <span
                    className="mini-dot"
                    style={{
                        background: healthColor,
                        boxShadow: `0 0 8px ${healthColor}`,
                    }}
                />
                <span style={{ color: "var(--text-secondary)" }}>
                    {stats.totalPeers} P
                </span>
            </div>
        );
    }

    return (
        <div
            className="p2p-status glass-card"
            style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: 12,
                gap: 16,
            }}
        >
            {/* Peer 状态 */}
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span
                    className="mini-dot"
                    style={{
                        background: healthColor,
                        boxShadow: `0 0 10px ${healthColor}`,
                    }}
                />
                <span className="meta">
                    <strong style={{ color: "var(--text-primary)" }}>
                        {stats.totalPeers}
                    </strong>{" "}
                    Peers
                </span>
            </div>

            {/* 速度统计 */}
            {showSpeed && (
                <div
                    style={{
                        display: "flex",
                        gap: 12,
                        fontSize: 12,
                        color: "var(--text-muted)",
                    }}
                >
                    <span title="下载速度">
                        <DownArrow /> {formatSpeed(stats.totalDownloadSpeed)}
                    </span>
                    <span title="上传速度">
                        <UpArrow /> {formatSpeed(stats.totalUploadSpeed)}
                    </span>
                </div>
            )}

            {/* 活跃种子 */}
            <div
                className="badge"
                style={{
                    background: "rgba(162, 103, 255, 0.15)",
                    color: "var(--accent-purple)",
                    borderColor: "rgba(162, 103, 255, 0.3)",
                }}
            >
                {stats.activeTorrents} 种子
            </div>
        </div>
    );
}

// 下载箭头图标
function DownArrow() {
    return (
        <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="var(--accent-cyan)"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{ marginRight: 4 }}
        >
            <path d="M12 5v14M5 12l7 7 7-7" />
        </svg>
    );
}

// 上传箭头图标
function UpArrow() {
    return (
        <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="var(--accent-purple)"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{ marginRight: 4 }}
        >
            <path d="M12 19V5M5 12l7-7 7 7" />
        </svg>
    );
}

export default P2PStatus;
