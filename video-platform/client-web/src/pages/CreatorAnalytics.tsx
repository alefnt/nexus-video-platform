/**
 * Creator Analytics — Studio Analytics Page
 *
 * Sections:
 * - Header with title + period selector
 * - 4 Metric cards (Views, Watch Time, Subscribers, Revenue)
 * - SVG chart area (Views over time)
 * - Two-column: Top Content list + Revenue Sources breakdown
 */
import React, { useState, useEffect, useMemo } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { getApiClient } from "../lib/apiClient";
import { useAuthStore } from "../stores";
import { setPageSEO } from "../utils/seo";

type Period = "7d" | "28d" | "90d" | "lifetime";

const api = getApiClient();

// Revenue source colors
const REVENUE_COLORS = ["bg-nexusCyan", "bg-nexusPurple", "bg-blue-500", "bg-yellow-500"];

// Shared Studio sub-nav
function StudioNav({ active }: { active: string }) {
    const navigate = useNavigate();
    const tabs = [
        { key: "dashboard", label: "Dashboard", path: "/creator/dashboard" },
        { key: "content", label: "Content", path: "/creator/content" },
        { key: "analytics", label: "Analytics", path: "/creator/analytics" },
        { key: "contracts", label: "Contracts & Splits", path: "/creator/contracts" },
    ];
    return (
        <nav className="flex items-center gap-6">
            {tabs.map(t => (
                <button key={t.key} onClick={() => navigate(t.path)}
                    className={`text-sm font-bold transition-colors ${active === t.key
                        ? "text-white border-b-2 border-nexusCyan pb-1 relative top-[2px]"
                        : "text-gray-500 hover:text-white"}`}>
                    {t.label}
                </button>
            ))}
        </nav>
    );
}

export default function CreatorAnalytics() {
    const navigate = useNavigate();
    const user = useAuthStore((s) => s.user);
    const [period, setPeriod] = useState<Period>("28d");
    const [activeMetric, setActiveMetric] = useState<"views" | "watch" | "subs" | "revenue">("views");
    const [topContent, setTopContent] = useState<{ id: string; title: string; views: number; revenue: number; thumb: string; type: string }[]>([]);
    const [totalViews, setTotalViews] = useState(0);
    const [totalRevenue, setTotalRevenue] = useState(0);
    const [contentCount, setContentCount] = useState(0);
    const [loading, setLoading] = useState(true);

    useEffect(() => { setPageSEO?.({ title: "Studio Analytics | Nexus Video" }); }, []);

    // Fetch real content data and compute analytics
    useEffect(() => {
        if (!user?.id) { setLoading(false); return; }
        setLoading(true);
        const jwt = sessionStorage.getItem('vp.jwt');
        if (jwt) api.setJWT(jwt);

        Promise.all([
            api.get<any[]>(`/metadata/list?type=video&limit=100`).catch(() => []),
            api.get<any[]>(`/metadata/list?type=audio&limit=100`).catch(() => []),
            api.get<any[]>(`/metadata/list?type=article&limit=100`).catch(() => []),
        ]).then(([videos, audio, articles]) => {
            const all = [...(videos || []), ...(audio || []), ...(articles || [])];
            const mine = all.filter((item: any) =>
                item.creatorCkbAddress === user.ckbAddress ||
                item.creatorBitDomain === user.bitDomain ||
                item.creatorId === user.id
            );
            setContentCount(mine.length);
            const views = mine.reduce((sum: number, item: any) => sum + (item.views || 0), 0);
            const revenue = mine.reduce((sum: number, item: any) => sum + (item.revenue || 0), 0);
            setTotalViews(views);
            setTotalRevenue(revenue);

            // Top content sorted by views
            const sorted = [...mine].sort((a: any, b: any) => (b.views || 0) - (a.views || 0)).slice(0, 5);
            setTopContent(sorted.map((item: any) => ({
                id: item.id,
                title: item.title || 'Untitled',
                views: item.views || 0,
                revenue: item.revenue || 0,
                thumb: item.posterUrl || item.thumbnailUrl || '',
                type: item.contentType || 'video',
            })));
        }).finally(() => setLoading(false));
    }, [user?.id]);

    function formatNum(n: number): string {
        if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
        if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
        return String(n);
    }

    const metrics = [
        { key: "views" as const, label: "Views", value: formatNum(totalViews), change: 0, positive: true },
        { key: "watch" as const, label: "Content Items", value: String(contentCount), change: 0, positive: true },
        { key: "subs" as const, label: "Subscribers", value: "-", change: 0, positive: true },
        { key: "revenue" as const, label: "Est. Revenue", value: `${totalRevenue.toFixed(0)} pts`, change: 0, positive: true, isRevenue: true },
    ];

    // Compute revenue sources from content types
    const revenueSources = useMemo(() => {
        if (topContent.length === 0) return [];
        const byType: Record<string, number> = {};
        topContent.forEach(c => { byType[c.type] = (byType[c.type] || 0) + c.revenue; });
        const total = Object.values(byType).reduce((a, b) => a + b, 0) || 1;
        return Object.entries(byType).map(([type, amount], i) => ({
            label: type === 'video' ? 'Video Revenue' : type === 'audio' ? 'Music Revenue' : type === 'article' ? 'Article Revenue' : type,
            amount,
            pct: Math.round((amount / total) * 100),
            color: REVENUE_COLORS[i % REVENUE_COLORS.length],
        }));
    }, [topContent]);

    return (
        <div className="flex flex-col h-full overflow-hidden">
            {/* Studio Header */}
            <header className="h-20 flex-shrink-0 flex items-center justify-between px-10 border-b border-white/5 bg-[#050510]">
                <div className="flex items-center gap-8">
                    <div className="flex items-center gap-3 cursor-pointer" onClick={() => navigate("/home")}>
                        <svg className="w-8 h-8 text-nexusCyan drop-shadow-[0_0_8px_rgba(34,211,238,0.8)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
                        </svg>
                        <span className="text-xl font-black tracking-widest text-white">STUDIO</span>
                    </div>
                    <StudioNav active="analytics" />
                </div>
                <div className="flex items-center gap-4">
                    <select value={period} onChange={(e) => setPeriod(e.target.value as Period)}
                        className="bg-black/40 border border-white/10 rounded-xl px-4 py-2 text-sm text-white font-bold cursor-pointer hover:border-nexusCyan transition-colors">
                        <option value="7d">Last 7 Days</option>
                        <option value="28d">Last 28 Days</option>
                        <option value="90d">Last 90 Days</option>
                        <option value="lifetime">Lifetime</option>
                    </select>
                </div>
            </header>

            {/* Scrollable content */}
            <main className="flex-1 p-8 overflow-y-auto w-full max-w-7xl mx-auto space-y-8">
                {/* Title */}
                <div className="flex justify-between items-end">
                    <div>
                        <h1 className="text-3xl font-black text-white mb-1">Channel Analytics</h1>
                        <p className="text-gray-400 text-sm">Your channel has {totalViews.toLocaleString()} total views across {contentCount} content items.</p>
                    </div>
                    <button className="text-nexusCyan text-sm font-bold hover:underline">Advanced Mode</button>
                </div>

                {/* Metric Tabs */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    {metrics.map(m => (
                        <div key={m.key}
                            onClick={() => setActiveMetric(m.key)}
                            className={`glass-panel p-5 rounded-2xl relative overflow-hidden group cursor-pointer transition-colors
                                ${activeMetric === m.key
                                    ? "border-t-2 border-t-nexusCyan"
                                    : "border border-white/5 hover:border-white/20"}`}>
                            {activeMetric === m.key && (
                                <div className="absolute inset-0 bg-gradient-to-b from-nexusCyan/10 to-transparent" />
                            )}
                            {(m as any).isRevenue && (
                                <div className="absolute right-0 bottom-0 pointer-events-none opacity-20">
                                    <svg className="w-24 h-24 text-yellow-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                </div>
                            )}
                            <div className="relative z-10">
                                <p className={`text-xs font-bold uppercase tracking-widest mb-2 ${activeMetric === m.key ? "text-gray-400 group-hover:text-nexusCyan transition-colors" : "text-gray-500"}`}>
                                    {m.label}
                                </p>
                                <h3 className={`text-3xl font-black mb-1 ${(m as any).isRevenue ? "text-yellow-500" : activeMetric === m.key ? "text-white" : "text-gray-300"}`}>
                                    {m.value}
                                </h3>
                                <div className={`flex items-center gap-1 text-xs font-bold w-max px-2 py-0.5 rounded ${m.positive
                                    ? "text-green-400 bg-green-400/10"
                                    : "text-red-400 bg-red-400/10"}`}>
                                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"
                                            d={m.positive ? "M5 10l7-7m0 0l7 7m-7-7v18" : "M19 14l-7 7m0 0l-7-7m7 7V3"} />
                                    </svg>
                                    {m.change}%
                                </div>
                            </div>
                        </div>
                    ))}
                </div>

                {/* Chart Area */}
                <div className="glass-panel rounded-2xl p-6 relative overflow-hidden h-[400px] flex flex-col border border-white/10"
                    style={{ backgroundImage: "linear-gradient(to right, rgba(255,255,255,0.02) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.02) 1px, transparent 1px)", backgroundSize: "40px 40px" }}>
                    <div className="flex justify-between items-center mb-6">
                        <h3 className="font-bold text-white">Views over time</h3>
                        <div className="flex items-center gap-4 text-xs font-bold">
                            <div className="flex items-center gap-2 text-white">
                                <div className="w-3 h-3 rounded-full bg-nexusCyan shadow-[0_0_8px_rgba(34,211,238,0.8)]" />
                                Current Period
                            </div>
                            <div className="flex items-center gap-2 text-gray-500">
                                <div className="w-3 h-3 rounded-full bg-gray-600" />
                                Previous Period
                            </div>
                        </div>
                    </div>

                    <div className="flex-1 w-full relative pb-8">
                        {/* Y Axis */}
                        <div className="absolute left-0 top-0 h-full flex flex-col justify-between text-[10px] text-gray-600 font-mono pb-8 pr-2 pointer-events-none">
                            <span>2k</span><span>1.5k</span><span>1k</span><span>500</span><span>0</span>
                        </div>

                        {/* SVG Graph */}
                        <svg className="absolute inset-x-8 inset-y-0 w-[calc(100%-2rem)] h-[calc(100%-2rem)] overflow-visible"
                            preserveAspectRatio="none" viewBox="0 0 1000 300">
                            <defs>
                                <filter id="glow"><feGaussianBlur stdDeviation="4" result="coloredBlur" /><feMerge><feMergeNode in="coloredBlur" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
                                <linearGradient id="cyan-grad" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="0%" stopColor="#22d3ee" stopOpacity="1" />
                                    <stop offset="100%" stopColor="#22d3ee" stopOpacity="0" />
                                </linearGradient>
                            </defs>
                            <polyline points="0,250 100,220 200,240 300,180 400,200 500,150 600,170 700,200 800,220 900,190 1000,210"
                                fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="2" strokeDasharray="5,5" />
                            <path d="M0,280 Q50,250 100,200 T200,150 T300,160 T400,80 T500,100 T600,40 T700,60 T800,120 T900,90 T1000,50"
                                fill="none" stroke="#22d3ee" strokeWidth="4" filter="url(#glow)" />
                            <path d="M0,280 Q50,250 100,200 T200,150 T300,160 T400,80 T500,100 T600,40 T700,60 T800,120 T900,90 T1000,50 L1000,300 L0,300 Z"
                                fill="url(#cyan-grad)" opacity="0.1" />
                        </svg>

                        {/* X Axis */}
                        <div className="absolute bottom-0 left-8 right-0 flex justify-between text-[10px] text-gray-500 font-mono">
                            <span>Oct 1</span><span>Oct 7</span><span>Oct 14</span><span>Oct 21</span><span>Oct 28</span>
                        </div>
                    </div>
                </div>

                {/* Two column: Top Content + Revenue Sources */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    {/* Top Content */}
                    <div className="glass-panel p-6 rounded-2xl border border-white/10">
                        <h3 className="font-bold text-white mb-6">Top Content</h3>
                        <div className="space-y-4">
                            {topContent.map(item => (
                                <div key={item.id} className="flex items-center gap-4 hover:bg-white/5 p-2 rounded -mx-2 transition-colors cursor-pointer"
                                    onClick={() => navigate(`/player/${item.id}`)}>
                                    {item.type === "video" ? (
                                        <div className="w-16 h-10 rounded bg-gray-800 bg-cover" style={{ backgroundImage: `url(${item.thumb})` }} />
                                    ) : (
                                        <div className="w-16 h-10 bg-pink-500/20 border border-pink-500/30 rounded flex items-center justify-center text-pink-500">
                                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                                            </svg>
                                        </div>
                                    )}
                                    <div className="flex-1 min-w-0">
                                        <h4 className="font-bold text-sm text-white truncate">{item.title}</h4>
                                        <p className={`text-[10px] font-mono ${item.type === "live" ? "text-pink-500/80 uppercase font-bold tracking-widest" : "text-gray-500"}`}>
                                            {item.type === "live" ? "Live Stream" : `${item.views.toLocaleString()} views`}
                                        </p>
                                    </div>
                                    <div className="text-right">
                                        <div className="text-yellow-500 font-bold flex items-center gap-1 justify-end font-mono">
                                            <span className="text-[10px] text-gray-500">USDC</span> {item.revenue.toFixed(2)}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                        <button className="block text-center text-xs font-bold text-nexusCyan mt-6 hover:underline uppercase tracking-widest w-full">
                            See More
                        </button>
                    </div>

                    {/* Revenue Sources */}
                    <div className="glass-panel p-6 rounded-2xl border border-white/10">
                        <h3 className="font-bold text-white mb-6">Revenue Sources</h3>
                        <div className="space-y-6">
                            {revenueSources.map((src, i) => (
                                <div key={i}>
                                    <div className="flex justify-between items-end mb-2">
                                        <div className="flex items-center gap-2">
                                            <div className={`w-3 h-3 rounded ${src.color}`} />
                                            <span className="text-sm font-bold text-gray-300">{src.label}</span>
                                        </div>
                                        <span className="text-sm font-mono font-bold text-white">$ {src.amount.toFixed(2)}</span>
                                    </div>
                                    <div className="w-full bg-black/40 h-2 rounded-full overflow-hidden">
                                        <div className={`h-full ${src.color}`} style={{ width: `${src.pct}%` }} />
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
}
