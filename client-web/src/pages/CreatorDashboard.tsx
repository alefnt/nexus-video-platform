/**
 * 创作者数据面...Creator Studio Dashboard
 *
 * 功能:
 * - Welcome Banner with Total Balance & Live Earning Rate
 * - Fiber Routing Live Console (real-time transaction log)
 * - Top Performing Assets with Revenue Split bars
 * - Mint New Content CTA card
 * - Tab navigation: Dashboard / Content / Analytics / Contracts & Splits
 */

import React, { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { getApiClient } from "../lib/apiClient";
import { useAuthStore } from "../stores";
import { setPageSEO } from "../utils/seo";
import {
    Zap, TrendingUp, Plus, Music, Video, BookOpen, BarChart3,
    Settings, Eye, Heart, MessageCircle, ChevronRight, ArrowUpRight,
    HardDrive, Database, Shield, ExternalLink
} from "lucide-react";

interface OverviewData {
    totalViews: number;
    totalLikes: number;
    totalRevenue: number;
    totalFollowers: number;
    totalVideos: number;
    viewsChange: number;
    revenueChange: number;
    followersChange: number;
}

interface DailyMetric {
    date: string;
    views: number;
    likes: number;
    revenue: number;
    newFollowers: number;
}

interface VideoAnalytics {
    id: string;
    title: string;
    coverUrl: string | null;
    views: number;
    likes: number;
    commentCount: number;
    completionRate: number;
    avgWatchTime: number;
    revenue: number;
}

type Period = "7d" | "30d" | "90d";
type StudioTab = "dashboard" | "content" | "analytics" | "contracts";

function formatNumber(n: number): string {
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
    if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
    return String(n);
}

function formatCurrency(n: number): string {
    return n.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

function formatK(n: number): string {
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
    if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
    return String(n);
}

// Fiber transactions and top assets will be fetched from real APIs

const CreatorDashboard: React.FC = () => {
    const navigate = useNavigate();
    const user = useAuthStore((s) => s.user);
    const api = getApiClient();

    const [period, setPeriod] = useState<Period>("7d");
    const [activeTab, setActiveTab] = useState<StudioTab>("dashboard");
    const [overview, setOverview] = useState<OverviewData | null>(null);
    const [dailyMetrics, setDailyMetrics] = useState<DailyMetric[]>([]);
    const [topVideos, setTopVideos] = useState<VideoAnalytics[]>([]);
    const [nfts, setNfts] = useState<{ sporeId: string; txHash: string; contentId: string; contentType: string; createdAt: string }[]>([]);
    const [fiberTxs, setFiberTxs] = useState<{ type: string; user: string; amount: string; color: string }[]>([]);
    const [topAssets, setTopAssets] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeChart, setActiveChart] = useState<"views" | "revenue" | "followers">("views");
    const [storageStats, setStorageStats] = useState<{
        totalEntries: number; hotCount: number; warmCount: number; coldCount: number; totalSizeBytes: number;
    } | null>(null);

    useEffect(() => {
        setPageSEO({ title: "Creator Studio" });
    }, []);

    // Load data
    useEffect(() => {
        if (!user?.id) return;
        setLoading(true);

        Promise.all([
            api.get<{ overview: OverviewData }>(
                `/api/engagement/analytics/creator/${user.id}/overview?period=${period}`
            ),
            api.get<{ metrics: DailyMetric[] }>(
                `/api/engagement/analytics/creator/${user.id}/daily?period=${period}`
            ),
            api.get<{ videos: VideoAnalytics[] }>(
                `/api/engagement/analytics/creator/${user.id}/top-videos?period=${period}&limit=10`
            ),
        ])
            .then(([overviewRes, metricsRes, videosRes]) => {
                setOverview(overviewRes.overview);
                setDailyMetrics(metricsRes.metrics);
                setTopVideos(videosRes.videos);
            })
            .catch((err) => console.error("Dashboard load error:", err))
            .finally(() => setLoading(false));

        // Fetch NFTs separately (non-blocking)
        api.get<{ nfts: any[] }>('/nft/ownership/list')
            .then((res) => setNfts(res.nfts || []))
            .catch(() => { });

        // Fetch recent payment transactions for the Fiber console
        api.get<{ transactions?: any[]; history?: any[] }>('/payment/tx/history?limit=5')
            .then((res) => {
                const txs = res?.transactions || res?.history || [];
                setFiberTxs(txs.slice(0, 5).map((tx: any) => ({
                    type: tx.type || tx.action || 'Payment',
                    user: tx.fromUserId ? `USER_${tx.fromUserId.slice(0, 6)}...` : tx.description || 'Unknown',
                    amount: `${tx.amount > 0 ? '+' : ''}${tx.amount?.toFixed(3) || '0.000'}`,
                    color: tx.amount > 0 ? 'text-cyan-400' : 'text-red-400',
                })));
            })
            .catch(() => { });

        // Fetch storage engine stats (non-blocking)
        api.get<{ totalEntries: number; hotCount: number; warmCount: number; coldCount: number; totalSizeBytes: number }>('/content/storage/stats')
            .then((res) => setStorageStats(res))
            .catch(() => { });
    }, [user?.id, period]);

    // Derive top assets from topVideos analytics data
    useEffect(() => {
        if (topVideos.length > 0) {
            setTopAssets(topVideos.slice(0, 3).map((v: any) => ({
                id: v.id || v.videoId,
                type: 'Video',
                typeIcon: 'video',
                title: v.title || 'Untitled',
                subtitle: `${formatK(v.views || 0)} views`,
                price: v.priceUSDI ? `$${v.priceUSDI} / view` : 'Free',
                priceColor: 'nexusCyan',
                revenue: v.revenue || 0,
                splits: [{ label: 'Revenue', width: 100, color: 'bg-cyan-400' }],
                coverUrl: v.thumbnailUrl || v.posterUrl || '',
                actions: [
                    { label: 'Edit Metadata', secondary: true },
                    { label: 'View Analytics', secondary: false },
                ],
            })));
        }
    }, [topVideos]);

    // Chart data
    const chartData = useMemo(() => {
        if (!dailyMetrics.length) return [];
        const key = activeChart === "views" ? "views" : activeChart === "revenue" ? "revenue" : "newFollowers";
        const values = dailyMetrics.map((d) => (d as any)[key] as number);
        const max = Math.max(...values, 1);
        return dailyMetrics.map((d, i) => ({
            label: new Date(d.date).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
            value: values[i],
            heightPct: (values[i] / max) * 100,
        }));
    }, [dailyMetrics, activeChart]);

    const displayName = (user as any)?.displayName || user?.bitDomain || "Creator";
    const totalBalance = overview?.totalRevenue || 42069;
    const balanceChange = overview?.revenueChange || 12.5;

    return (
        <div className="relative min-h-screen pb-32 font-sans">
            {/* Ambient background glow */}
            <div className="absolute top-[10%] left-1/2 -translate-x-1/2 w-[60vw] h-[25vh] bg-purple-500/10 blur-[80px] pointer-events-none z-0 rounded-full" />

            <div className="relative z-10 w-full max-w-7xl mx-auto p-6 md:p-8 flex flex-col gap-8">

                {/* Welcome & Stats Row */}
                <div className="flex flex-col lg:flex-row gap-8 items-start">

                    {/* Left: Welcome + Balance Cards */}
                    <div className="flex-1">
                        <h1 className="text-3xl font-bold text-white mb-2">
                            Welcome back, {displayName}.
                        </h1>
                        <p className="text-gray-400 mb-8">
                            Your Fiber nodes successfully processed {formatNumber(overview?.totalViews || 12450)} micro-transactions today.
                        </p>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            {/* Total Balance Card */}
                            <div className="glass-panel rounded-2xl p-6 relative overflow-hidden group border border-white/5">
                                <div className="absolute inset-0 bg-cyan-500/5 opacity-0 group-hover:opacity-100 transition-opacity" />
                                <h3 className="text-gray-400 text-sm font-semibold uppercase tracking-wider mb-2">Total Balance</h3>
                                <div className="flex items-baseline gap-2 mb-1">
                                    <span className="text-4xl font-black text-white">${formatCurrency(totalBalance)}</span>
                                    <span className="text-cyan-400 font-mono text-sm">USDC</span>
                                </div>
                                <div className="flex items-center gap-2 text-sm">
                                    <span className={`font-bold flex items-center gap-1 ${balanceChange >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                                        <ArrowUpRight size={16} />
                                        {balanceChange >= 0 ? "+" : ""}{balanceChange.toFixed(1)}%
                                    </span>
                                    <span className="text-gray-500">vs last week</span>
                                </div>
                            </div>

                            {/* Live Earning Rate Card */}
                            <div className="glass-panel rounded-2xl p-6 relative overflow-hidden group border border-white/5">
                                <div className="absolute inset-0 bg-purple-500/5 opacity-0 group-hover:opacity-100 transition-opacity" />
                                <div className="absolute top-4 right-4">
                                    <span className="flex h-3 w-3 relative">
                                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-purple-500 opacity-75" />
                                        <span className="relative inline-flex rounded-full h-3 w-3 bg-purple-500" />
                                    </span>
                                </div>
                                <h3 className="text-gray-400 text-sm font-semibold uppercase tracking-wider mb-2">Live Earning Rate</h3>
                                <div className="flex items-baseline gap-2 mb-1">
                                    <span className="text-4xl font-black text-white">2.45</span>
                                    <span className="text-purple-400 font-mono text-sm">USDC / MIN</span>
                                </div>
                                <div className="flex items-center gap-2 text-sm text-gray-500 mt-2">
                                    From 3 active streams
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Right: Fiber Network Live Routing Console */}
                    <div className="w-full lg:w-96 glass-panel rounded-2xl h-[280px] p-6 flex flex-col relative overflow-hidden border border-cyan-500/30 shadow-[0_0_30px_rgba(34,211,238,0.05)]">
                        <div className="flex justify-between items-center mb-4 z-10">
                            <h3 className="text-white font-bold flex items-center gap-2">
                                <Zap size={20} className="text-cyan-400" />
                                Fiber Routing Live
                            </h3>
                            <div className="text-[10px] font-mono bg-cyan-500/20 text-cyan-400 px-2 py-0.5 rounded border border-cyan-500/50">
                                CKB MAINNET
                            </div>
                        </div>

                        {/* Fades */}
                        <div className="flex-1 relative overflow-hidden font-mono text-xs z-10">
                            <div className="absolute top-0 inset-x-0 h-8 bg-gradient-to-b from-[#0A0A14] to-transparent z-20" />
                            <div className="absolute bottom-0 inset-x-0 h-8 bg-gradient-to-t from-[#0A0A14] to-transparent z-20" />

                            <div className="flex flex-col gap-3 h-full justify-center">
                                {fiberTxs.map((tx, i) => (
                                    <div key={i} className={`flex justify-between items-center text-gray-400 ${tx.type === "Split" ? "opacity-50" : ""}`}>
                                        <span>{tx.type}: {tx.user}</span>
                                        <span className={`${tx.color} font-bold`}>{tx.amount}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Top Performing Assets */}
                <h2 className="text-2xl font-bold text-white mt-4 border-b border-white/5 pb-4">Top Performing Assets</h2>

                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                    {/* Real content from API */}
                    {topVideos.length > 0 ? (
                        topVideos.slice(0, 2).map((video, i) => (
                            <div
                                key={video.id}
                                className="glass-panel rounded-2xl overflow-hidden flex flex-col group hover:border-cyan-500/50 transition-colors border border-white/5 cursor-pointer"
                                onClick={() => navigate(`/player/${video.id}`)}
                            >
                                <div className="h-40 relative">
                                    <img
                                        src={video.coverUrl || "https://images.unsplash.com/photo-1536440136628-849c177e76a1?auto=format&fit=crop&q=80&w=600"}
                                        alt=""
                                        className="w-full h-full object-cover opacity-70 group-hover:opacity-100 transition-opacity"
                                    />
                                    <div className="absolute inset-0 bg-gradient-to-t from-[#0A0A14] to-transparent" />
                                    <div className="absolute top-3 left-3 bg-black/60 backdrop-blur-md px-2 py-1 rounded border border-white/20 text-xs font-bold">
                                        Video ...Streamed
                                    </div>
                                </div>

                                <div className="p-5 flex-1 flex flex-col justify-between z-10 bg-[#0A0A14] -mt-4 rounded-t-2xl relative">
                                    <div>
                                        <h3 className="text-lg font-bold text-white mb-1">{video.title}</h3>
                                        <div className="flex justify-between items-center mb-4">
                                            <span className="text-sm text-gray-400">{formatNumber(video.views)} views</span>
                                            <span className="bg-cyan-500/10 text-cyan-400 text-xs px-2 py-1 rounded font-mono border border-cyan-500/30">
                                                ${video.revenue > 0 ? video.revenue.toFixed(0) : "0"} earned
                                            </span>
                                        </div>
                                    </div>

                                    <div className="bg-black/50 rounded-xl p-3 border border-white/5 mb-4">
                                        <div className="flex justify-between text-xs text-gray-400 mb-2">
                                            <span>Revenue Split Active</span>
                                            <span className="font-mono text-white">Total: ${video.revenue > 0 ? formatCurrency(video.revenue) : "0"}</span>
                                        </div>
                                        <div className="w-full h-1.5 bg-gray-700 rounded-full overflow-hidden flex">
                                            <div className="h-full bg-cyan-400" style={{ width: "80%" }} />
                                            <div className="h-full bg-pink-500" style={{ width: "15%" }} />
                                            <div className="h-full bg-yellow-500" style={{ width: "5%" }} />
                                        </div>
                                    </div>

                                    <div className="flex justify-between">
                                        <button className="text-sm font-semibold text-gray-300 hover:text-white transition-colors">Edit Metadata</button>
                                        <button className="text-sm font-semibold text-cyan-400 hover:text-cyan-300 transition-colors">View Analytics →</button>
                                    </div>
                                </div>
                            </div>
                        ))
                    ) : (
                        /* Fallback mock assets */
                        topAssets.map((asset) => (
                            <div
                                key={asset.id}
                                className={`glass-panel rounded-2xl overflow-hidden flex flex-col group hover:border-${asset.priceColor === "nexusCyan" ? "cyan" : "purple"}-500/50 transition-colors border border-white/5`}
                            >
                                <div className="h-40 relative">
                                    <img
                                        src={asset.coverUrl}
                                        alt={asset.title}
                                        className="w-full h-full object-cover opacity-70 group-hover:opacity-100 transition-opacity"
                                    />
                                    <div className="absolute inset-0 bg-gradient-to-t from-[#0A0A14] to-transparent" />
                                    <div className={`absolute top-3 left-3 ${asset.typeIcon === "audio"
                                        ? "bg-purple-500/20 text-purple-400 border-purple-500/50"
                                        : "bg-black/60 text-white border-white/20"
                                        } backdrop-blur-md px-2 py-1 rounded border text-xs font-bold flex items-center gap-1`}>
                                        {asset.typeIcon === "audio" ? <Music size={12} /> : <Video size={12} />}
                                        {asset.type} {asset.typeIcon !== "audio" && "...Streamed"}
                                    </div>
                                </div>

                                <div className="p-5 flex-1 flex flex-col justify-between z-10 bg-[#0A0A14] -mt-4 rounded-t-2xl relative">
                                    <div>
                                        <h3 className="text-lg font-bold text-white mb-1">{asset.title}</h3>
                                        <div className="flex justify-between items-center mb-4">
                                            <span className="text-sm text-gray-400">{asset.subtitle}</span>
                                            <span className={`bg-${asset.priceColor === "nexusCyan" ? "cyan" : "purple"}-500/10 text-${asset.priceColor === "nexusCyan" ? "cyan" : "purple"}-400 text-xs px-2 py-1 rounded font-mono border border-${asset.priceColor === "nexusCyan" ? "cyan" : "purple"}-500/30`}>
                                                {asset.price}
                                            </span>
                                        </div>
                                    </div>

                                    <div className="bg-black/50 rounded-xl p-3 border border-white/5 mb-4">
                                        <div className="flex justify-between text-xs text-gray-400 mb-2">
                                            <span>Revenue Split Active</span>
                                            <span className="font-mono text-white">Total: ${formatCurrency(asset.revenue)}</span>
                                        </div>
                                        <div className="w-full h-1.5 bg-gray-700 rounded-full overflow-hidden flex">
                                            {asset.splits.map((split: any, j: number) => (
                                                <div key={j} className={`h-full ${split.color}`} style={{ width: `${split.width}%` }} title={split.label} />
                                            ))}
                                        </div>
                                    </div>

                                    <div className="flex justify-between">
                                        <button className="text-sm font-semibold text-gray-300 hover:text-white transition-colors">
                                            {asset.actions[0].label}
                                        </button>
                                        <button className={`text-sm font-semibold ${asset.priceColor === "nexusCyan" ? "text-cyan-400 hover:text-cyan-300" : "text-purple-400 hover:text-purple-300"} transition-colors`}>
                                            {asset.actions[1].label}
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))
                    )}

                    {/* Mint New Content Card */}
                    <div
                        className="glass-panel rounded-2xl flex flex-col items-center justify-center p-8 border-dashed border-2 bg-transparent border-white/20 hover:border-cyan-400 hover:bg-white/5 transition-all cursor-pointer group min-h-[350px]"
                        onClick={() => navigate("/creator/upload")}
                    >
                        <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center mb-4 group-hover:scale-110 group-hover:bg-cyan-500/20 group-hover:text-cyan-400 transition-all border border-white/10 group-hover:border-cyan-500/50 shadow-[0_0_15px_rgba(255,255,255,0.05)] text-gray-400">
                            <Plus size={32} />
                        </div>
                        <h3 className="text-xl font-bold text-white mb-2">Mint New Content</h3>
                        <p className="text-sm text-gray-400 text-center max-w-xs">
                            Upload Video, Audio, or Articles. Set your pricing and co-creator splits permanently on-chain.
                        </p>
                    </div>
                </div>

                {/* Analytics Chart Section */}
                {(chartData.length > 0 || overview) && (
                    <div className="mt-8">
                        <div className="flex items-center justify-between mb-6">
                            <h2 className="text-2xl font-bold text-white">Performance Overview</h2>
                            <div className="flex gap-2">
                                {(["7d", "30d", "90d"] as Period[]).map((p) => (
                                    <button
                                        key={p}
                                        onClick={() => setPeriod(p)}
                                        className={`px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider transition-all border ${period === p
                                            ? "bg-purple-500/20 text-purple-400 border-purple-500/50"
                                            : "bg-white/[0.03] text-gray-400 border-white/5 hover:bg-white/10 hover:text-white"
                                            }`}
                                    >
                                        {p === "7d" ? "7 Days" : p === "30d" ? "30 Days" : "90 Days"}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Stats Overview Cards */}
                        {overview && (
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                                <StatCard icon={<Eye size={20} />} label="Total Views" value={formatNumber(overview.totalViews)} change={overview.viewsChange} />
                                <StatCard icon={<BarChart3 size={20} />} label="Total Revenue" value={`${overview.totalRevenue.toFixed(0)} PTS`} change={overview.revenueChange} />
                                <StatCard icon={<Heart size={20} />} label="Followers" value={formatNumber(overview.totalFollowers)} change={overview.followersChange} />
                                <StatCard icon={<MessageCircle size={20} />} label="Total Likes" value={formatNumber(overview.totalLikes)} />
                            </div>
                        )}

                        {/* Bar Chart */}
                        {chartData.length > 0 && (
                            <div className="glass-panel rounded-2xl p-6 border border-white/5">
                                <div className="flex gap-3 mb-6">
                                    {(["views", "revenue", "followers"] as const).map((tab) => (
                                        <button
                                            key={tab}
                                            onClick={() => setActiveChart(tab)}
                                            className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${activeChart === tab
                                                ? "bg-purple-500/30 text-purple-300"
                                                : "bg-white/5 text-gray-400 hover:text-white"
                                                }`}
                                        >
                                            {tab === "views" ? "Views" : tab === "revenue" ? "Revenue" : "Followers"}
                                        </button>
                                    ))}
                                </div>
                                <div className="flex items-end gap-1 h-48 px-2">
                                    {chartData.map((d, i) => (
                                        <div key={i} className="flex-1 flex flex-col items-center gap-1">
                                            <div className="text-[10px] text-gray-500 min-h-[14px]">
                                                {d.value > 0 ? formatNumber(d.value) : ""}
                                            </div>
                                            <div
                                                className="w-[80%] max-w-[40px] rounded-t bg-gradient-to-t from-purple-600 to-purple-400 transition-all duration-300"
                                                style={{ height: `${Math.max(d.heightPct, 2)}%`, minHeight: 2 }}
                                            />
                                            <div className="text-[10px] text-gray-500 whitespace-nowrap">{d.label}</div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* Content Ranking */}
                {topVideos.length > 0 && (
                    <div className="mt-8">
                        <h2 className="text-2xl font-bold text-white mb-6">Content Ranking</h2>
                        <div className="flex flex-col gap-3">
                            {topVideos.map((video, i) => (
                                <div
                                    key={video.id}
                                    className="flex items-center gap-4 p-4 glass-panel rounded-xl border border-white/5 hover:border-cyan-500/30 transition-colors cursor-pointer group"
                                    onClick={() => navigate(`/player/${video.id}`)}
                                >
                                    <span className={`text-lg font-bold min-w-[32px] text-center ${i < 3 ? "text-cyan-400" : "text-gray-500"}`}>
                                        #{i + 1}
                                    </span>
                                    <img
                                        src={video.coverUrl || "/placeholder.jpg"}
                                        alt=""
                                        className="w-20 h-12 rounded-lg object-cover bg-gray-800 flex-shrink-0"
                                    />
                                    <div className="flex-1 min-w-0">
                                        <div className="text-sm font-bold text-white truncate group-hover:text-cyan-400 transition-colors">
                                            {video.title}
                                        </div>
                                        <div className="text-xs text-gray-500 mt-1 font-mono">
                                            <Eye size={10} className="inline mr-1" />{formatNumber(video.views)}
                                            <Heart size={10} className="inline ml-3 mr-1" />{formatNumber(video.likes)}
                                            <MessageCircle size={10} className="inline ml-3 mr-1" />{formatNumber(video.commentCount)}
                                        </div>
                                    </div>
                                    <div className="text-sm font-bold text-emerald-400 flex-shrink-0 font-mono">
                                        {video.revenue > 0 ? `$${video.revenue.toFixed(0)}` : "-"}
                                    </div>
                                    <ChevronRight size={16} className="text-gray-600 group-hover:text-cyan-400 transition-colors" />
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* My Ownership NFTs */}
                <div className="mt-8">
                    <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-2">
                        <span className="text-nexusPurple">💎</span> My Ownership NFTs
                    </h2>
                    {nfts.length === 0 ? (
                        <div className="glass-panel rounded-xl border border-white/5 p-8 text-center">
                            <p className="text-gray-500 text-sm">No ownership NFTs minted yet. Upload content with "Auto-Mint" enabled to create on-chain ownership records.</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {nfts.map((nft, i) => (
                                <div
                                    key={nft.sporeId || i}
                                    className="glass-panel rounded-xl border border-nexusPurple/20 p-4 hover:border-nexusPurple/50 transition-all cursor-pointer group"
                                    onClick={() => navigate(`/player/${nft.contentId}`)}
                                >
                                    <div className="flex items-center gap-2 mb-3">
                                        <span className="text-xs font-bold bg-nexusPurple/20 text-nexusPurple px-2 py-0.5 rounded uppercase">
                                            {nft.contentType || 'Content'}
                                        </span>
                                        <span className="text-[10px] text-green-400 font-mono">...On-Chain</span>
                                    </div>
                                    <div className="text-xs text-gray-400 font-mono mb-1 truncate" title={nft.sporeId}>
                                        Spore: {nft.sporeId?.slice(0, 12)}...{nft.sporeId?.slice(-8)}
                                    </div>
                                    <div className="text-xs text-gray-500 font-mono mb-2 truncate" title={nft.txHash}>
                                        Tx: {nft.txHash?.slice(0, 12)}...{nft.txHash?.slice(-8)}
                                    </div>
                                    <div className="text-[10px] text-gray-600">
                                        {nft.createdAt ? new Date(nft.createdAt).toLocaleDateString() : 'Unknown date'}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* ─── Storage Engine Overview ─── */}
                <div className="mt-8">
                    <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-2">
                        <HardDrive size={24} className="text-cyan-400" />
                        Storage Engine
                    </h2>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                        {/* Hot Storage */}
                        <div className="glass-panel rounded-xl p-5 border border-red-500/20 hover:border-red-500/50 transition-colors">
                            <div className="flex items-center gap-2 mb-3">
                                <div className="w-3 h-3 rounded-full bg-red-500 animate-pulse" />
                                <span className="text-xs font-bold text-red-400 uppercase tracking-wider">Hot (S3/MinIO)</span>
                            </div>
                            <div className="text-2xl font-black text-white">{storageStats?.hotCount || 0}</div>
                            <div className="text-xs text-gray-500 mt-1">Active files • CDN accelerated</div>
                        </div>

                        {/* Warm Storage */}
                        <div className="glass-panel rounded-xl p-5 border border-yellow-500/20 hover:border-yellow-500/50 transition-colors">
                            <div className="flex items-center gap-2 mb-3">
                                <div className="w-3 h-3 rounded-full bg-yellow-500" />
                                <span className="text-xs font-bold text-yellow-400 uppercase tracking-wider">Warm (Filecoin)</span>
                            </div>
                            <div className="text-2xl font-black text-white">{storageStats?.warmCount || 0}</div>
                            <div className="text-xs text-gray-500 mt-1">IPFS + Filecoin deals</div>
                        </div>

                        {/* Cold Storage */}
                        <div className="glass-panel rounded-xl p-5 border border-blue-500/20 hover:border-blue-500/50 transition-colors">
                            <div className="flex items-center gap-2 mb-3">
                                <div className="w-3 h-3 rounded-full bg-blue-500" />
                                <span className="text-xs font-bold text-blue-400 uppercase tracking-wider">Cold (Arweave)</span>
                            </div>
                            <div className="text-2xl font-black text-white">{storageStats?.coldCount || 0}</div>
                            <div className="text-xs text-gray-500 mt-1">Permanent archive • Metadata</div>
                        </div>

                        {/* Total */}
                        <div className="glass-panel rounded-xl p-5 border border-cyan-500/20 hover:border-cyan-500/50 transition-colors">
                            <div className="flex items-center gap-2 mb-3">
                                <Database size={14} className="text-cyan-400" />
                                <span className="text-xs font-bold text-cyan-400 uppercase tracking-wider">Total</span>
                            </div>
                            <div className="text-2xl font-black text-white">
                                {storageStats ? `${(storageStats.totalSizeBytes / (1024 * 1024)).toFixed(1)} MB` : '—'}
                            </div>
                            <div className="text-xs text-gray-500 mt-1">{storageStats?.totalEntries || 0} total entries</div>
                        </div>
                    </div>

                    {/* Storage Distribution Bar */}
                    {storageStats && storageStats.totalEntries > 0 && (
                        <div className="glass-panel rounded-xl p-5 border border-white/5">
                            <div className="flex justify-between text-xs text-gray-400 mb-3">
                                <span>Storage Distribution</span>
                                <span className="font-mono">{storageStats.totalEntries} entries</span>
                            </div>
                            <div className="w-full h-3 bg-gray-800 rounded-full overflow-hidden flex">
                                <div
                                    className="h-full bg-gradient-to-r from-red-500 to-orange-500 transition-all"
                                    style={{ width: `${(storageStats.hotCount / storageStats.totalEntries) * 100}%` }}
                                    title={`Hot: ${storageStats.hotCount}`}
                                />
                                <div
                                    className="h-full bg-gradient-to-r from-yellow-500 to-amber-500 transition-all"
                                    style={{ width: `${(storageStats.warmCount / storageStats.totalEntries) * 100}%` }}
                                    title={`Warm: ${storageStats.warmCount}`}
                                />
                                <div
                                    className="h-full bg-gradient-to-r from-blue-500 to-indigo-500 transition-all"
                                    style={{ width: `${(storageStats.coldCount / storageStats.totalEntries) * 100}%` }}
                                    title={`Cold: ${storageStats.coldCount}`}
                                />
                            </div>
                            <div className="flex gap-4 mt-3 text-xs">
                                <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-red-500" /><span className="text-gray-400">Hot {storageStats.hotCount}</span></div>
                                <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-yellow-500" /><span className="text-gray-400">Warm {storageStats.warmCount}</span></div>
                                <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-blue-500" /><span className="text-gray-400">Cold {storageStats.coldCount}</span></div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

// Stat Card sub-component
const StatCard: React.FC<{
    icon: React.ReactNode;
    label: string;
    value: string;
    change?: number;
}> = ({ icon, label, value, change }) => (
    <div className="glass-panel rounded-xl p-5 border border-white/5 group hover:border-purple-500/30 transition-colors">
        <div className="text-gray-400 mb-2">{icon}</div>
        <div className="text-xs text-gray-500 uppercase tracking-wider font-semibold mb-1">{label}</div>
        <div className="text-2xl font-black text-white">{value}</div>
        {change !== undefined && (
            <div className={`text-xs mt-1 font-bold ${change >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                {change >= 0 ? "↑" : "↓"} {Math.abs(change).toFixed(1)}%
            </div>
        )}
    </div>
);

export default CreatorDashboard;
