// FILE: /video-platform/client-web/src/components/TipLeaderboard.tsx
/**
 * 打赏排行榜组件
 * 功能：显示视频打赏排行榜
 */

import React, { useEffect, useState } from "react";
import { getApiClient } from "../lib/apiClient";
import type { TipLeaderboardEntry } from "@video-platform/shared/types";

interface TipLeaderboardProps {
    videoId: string;
    limit?: number;
    className?: string;
}

const client = getApiClient();

export default function TipLeaderboard({
    videoId,
    limit = 10,
    className = "",
}: TipLeaderboardProps) {
    const [leaderboard, setLeaderboard] = useState<TipLeaderboardEntry[]>([]);
    const [totalTips, setTotalTips] = useState<number>(0);
    const [totalTippers, setTotalTippers] = useState<number>(0);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // 获取JWT
    const jwt = typeof window !== "undefined" ? sessionStorage.getItem("vp.jwt") : null;
    if (jwt) client.setJWT(jwt);

    useEffect(() => {
        loadLeaderboard();
    }, [videoId, limit]);

    const loadLeaderboard = async () => {
        setLoading(true);
        setError(null);
        try {
            const res = await client.get<{
                videoId: string;
                leaderboard: TipLeaderboardEntry[];
                totalTips: number;
                totalTippers: number;
            }>(`/payment/tip/leaderboard/${videoId}?limit=${limit}`);

            setLeaderboard(res.leaderboard || []);
            setTotalTips(res.totalTips || 0);
            setTotalTippers(res.totalTippers || 0);
        } catch (err: any) {
            setError(err?.message || "加载失败");
        } finally {
            setLoading(false);
        }
    };

    const getRankIcon = (rank: number) => {
        if (rank === 1) return "🥇";
        if (rank === 2) return "🥈";
        if (rank === 3) return "🥉";
        return `#${rank}`;
    };

    const getRankColor = (rank: number) => {
        if (rank === 1) return "#FFD700";
        if (rank === 2) return "#C0C0C0";
        if (rank === 3) return "#CD7F32";
        return "var(--text-muted)";
    };

    if (loading) {
        return (
            <div className={`tip-leaderboard ${className}`} style={{ padding: 16 }}>
                <p style={{ color: "var(--text-muted)", textAlign: "center" }}>加载中...</p>
            </div>
        );
    }

    if (error) {
        return (
            <div className={`tip-leaderboard ${className}`} style={{ padding: 16 }}>
                <p style={{ color: "#ff6b6b", textAlign: "center" }}>{error}</p>
            </div>
        );
    }

    if (leaderboard.length === 0) {
        return (
            <div className={`tip-leaderboard ${className}`} style={{ padding: 16 }}>
                <p style={{ color: "var(--text-muted)", textAlign: "center" }}>暂无打赏记录</p>
            </div>
        );
    }

    return (
        <div className={`tip-leaderboard glass-card ${className}`} style={{ padding: 16 }}>
            {/* 标题 */}
            <div
                style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginBottom: 16,
                }}
            >
                <h4 style={{ margin: 0, fontSize: 16, display: "flex", alignItems: "center", gap: 8 }}>
                    <span>🏆</span> 打赏榜
                </h4>
                <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
                    共 {totalTippers} 人打赏 {totalTips.toLocaleString()} 积分
                </div>
            </div>

            {/* 排行榜列表 */}
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {leaderboard.map((entry) => (
                    <div
                        key={entry.userId}
                        style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 12,
                            padding: "8px 12px",
                            borderRadius: 8,
                            background:
                                entry.rank <= 3
                                    ? `linear-gradient(90deg, ${getRankColor(entry.rank)}20, transparent)`
                                    : "rgba(255,255,255,0.05)",
                        }}
                    >
                        {/* 排名 */}
                        <div
                            style={{
                                width: 32,
                                textAlign: "center",
                                fontSize: entry.rank <= 3 ? 20 : 14,
                                color: getRankColor(entry.rank),
                                fontWeight: 600,
                            }}
                        >
                            {getRankIcon(entry.rank)}
                        </div>

                        {/* 用户信息 */}
                        <div style={{ flex: 1 }}>
                            <div style={{ fontSize: 14, fontWeight: 500 }}>
                                {entry.displayName || entry.userId.slice(0, 8) + "..."}
                            </div>
                            <div style={{ fontSize: 11, color: "var(--text-muted)" }}>
                                打赏 {entry.tipCount} 次
                            </div>
                        </div>

                        {/* 金额 */}
                        <div
                            style={{
                                fontSize: 14,
                                fontWeight: 700,
                                color: getRankColor(entry.rank),
                            }}
                        >
                            {entry.totalAmount.toLocaleString()}
                            <span style={{ fontSize: 11, fontWeight: 400, marginLeft: 4 }}>积分</span>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
