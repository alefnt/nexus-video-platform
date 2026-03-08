/**
 * Creator Content Management — Studio Content Page
 *
 * Sections:
 * - Studio nav header with Upload/Mint button
 * - Left sidebar with content type & visibility filters
 * - Content table with video rows, visibility, monetization, views, revenue
 * - Pagination
 */
import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { getApiClient } from "../lib/apiClient";
import { useAuthStore } from "../stores";
import { setPageSEO } from "../utils/seo";

type ContentType = "all" | "video" | "article" | "audio";
type VisibilityFilter = "all" | "published" | "draft" | "unlisted";

interface ContentItem {
    id: string;
    title: string;
    description?: string;
    thumb?: string;
    duration?: string;
    visibility: "published" | "draft" | "unlisted";
    date: string;
    price: string;
    views: number;
    revenue: number;
    contentType?: string;
}

const api = getApiClient();

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
                        ? "text-white border-b-2 border-nexusPurple pb-1 relative top-[2px]"
                        : "text-gray-500 hover:text-white"}`}>
                    {t.label}
                </button>
            ))}
        </nav>
    );
}

export default function CreatorContent() {
    const navigate = useNavigate();
    const user = useAuthStore((s) => s.user);
    const [searchQuery, setSearchQuery] = useState("");
    const [contentType, setContentType] = useState<ContentType>("all");
    const [visibility, setVisibility] = useState<VisibilityFilter>("all");
    const [content, setContent] = useState<ContentItem[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => { setPageSEO?.({ title: "Studio Content | Nexus Video" }); }, []);

    // Fetch creator's own content from API
    useEffect(() => {
        if (!user?.id) { setLoading(false); return; }
        setLoading(true);
        const jwt = sessionStorage.getItem('vp.jwt');
        if (jwt) api.setJWT(jwt);

        // Fetch all content types for this creator
        Promise.all([
            api.get<any[]>(`/metadata/list?type=video&limit=100`).catch(() => []),
            api.get<any[]>(`/metadata/list?type=audio&limit=100`).catch(() => []),
            api.get<any[]>(`/metadata/list?type=article&limit=100`).catch(() => []),
        ]).then(([videos, audio, articles]) => {
            const allContent = [...(videos || []), ...(audio || []), ...(articles || [])];
            // Filter to only this creator's content
            const myContent = allContent.filter((item: any) =>
                item.creatorCkbAddress === user.ckbAddress ||
                item.creatorBitDomain === user.bitDomain ||
                item.creatorId === user.id
            );
            const mapped: ContentItem[] = myContent.map((item: any) => ({
                id: item.id,
                title: item.title || 'Untitled',
                description: item.description || '',
                thumb: item.posterUrl || item.thumbnailUrl || '',
                duration: item.durationSeconds ? `${Math.floor(item.durationSeconds / 60)}:${String(item.durationSeconds % 60).padStart(2, '0')}` : undefined,
                visibility: "published" as const,
                date: item.createdAt ? new Date(item.createdAt).toLocaleDateString() : '',
                price: item.priceUSDI && Number(item.priceUSDI) > 0 ? `${item.priceUSDI} USDI` : 'Free',
                views: item.views || 0,
                revenue: item.revenue || 0,
                contentType: item.contentType || 'video',
            }));
            setContent(mapped);
        }).finally(() => setLoading(false));
    }, [user?.id]);

    // Dynamic counts
    const videosCount = content.filter(c => c.contentType === 'video').length;
    const articlesCount = content.filter(c => c.contentType === 'article').length;
    const audioCount = content.filter(c => c.contentType === 'audio').length;

    const filteredContent = content.filter(c => {
        if (contentType !== "all" && c.contentType !== contentType) return false;
        if (visibility !== "all" && c.visibility !== visibility) return false;
        if (searchQuery && !c.title.toLowerCase().includes(searchQuery.toLowerCase())) return false;
        return true;
    });

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
                    <StudioNav active="content" />
                </div>
                <div className="flex items-center gap-4">
                    <button onClick={() => navigate("/creator/upload")}
                        className="bg-gradient-to-r from-nexusPurple to-pink-500 text-white px-6 py-2 rounded-full text-sm font-bold shadow-[0_0_15px_rgba(168,85,247,0.4)] hover:scale-105 transition-transform flex items-center gap-2">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
                        </svg>
                        Upload / Mint
                    </button>
                </div>
            </header>

            {/* Main workspace */}
            <main className="flex-1 flex overflow-hidden">
                {/* Left Sidebar Filters */}
                <aside className="w-64 border-r border-white/5 bg-black/20 p-6 flex flex-col gap-8 flex-shrink-0 overflow-y-auto hidden lg:block">
                    <div>
                        <h3 className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-4">Content Type</h3>
                        <div className="space-y-2">
                            {[
                                { key: "all" as const, label: "All", count: content.length },
                                { key: "video" as const, label: "Videos", count: videosCount },
                                { key: "article" as const, label: "Articles", count: articlesCount },
                                { key: "audio" as const, label: "Music / Audio", count: audioCount },
                            ].map(f => (
                                <label key={f.key} className="flex items-center gap-3 cursor-pointer group" onClick={() => setContentType(f.key)}>
                                    <div className={`w-4 h-4 rounded border flex items-center justify-center ${contentType === f.key
                                        ? "border-nexusCyan bg-nexusCyan/20"
                                        : "border-white/20 group-hover:border-white/50"}`}>
                                        {contentType === f.key && (
                                            <svg className="w-3 h-3 text-nexusCyan" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                                            </svg>
                                        )}
                                    </div>
                                    <span className={`text-sm font-bold ${contentType === f.key ? "text-white" : "text-gray-400 group-hover:text-white"} transition-colors`}>
                                        {f.label} ({f.count})
                                    </span>
                                </label>
                            ))}
                        </div>
                    </div>

                    <div>
                        <h3 className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-4">Visibility Status</h3>
                        <div className="space-y-2">
                            {[
                                { key: "all" as const, label: "All" },
                                { key: "published" as const, label: "Published" },
                                { key: "draft" as const, label: "Drafts (2)" },
                                { key: "unlisted" as const, label: "Unlisted" },
                            ].map(f => (
                                <label key={f.key} className="flex items-center gap-3 cursor-pointer group" onClick={() => setVisibility(f.key)}>
                                    <div className={`w-4 h-4 rounded border flex items-center justify-center ${visibility === f.key
                                        ? "border-nexusPurple bg-nexusPurple/20"
                                        : "border-white/20 group-hover:border-white/50"}`}>
                                        {visibility === f.key && (
                                            <svg className="w-3 h-3 text-nexusPurple" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                                            </svg>
                                        )}
                                    </div>
                                    <span className={`text-sm font-bold ${visibility === f.key ? "text-white" : "text-gray-400"} transition-colors`}>
                                        {f.label}
                                    </span>
                                </label>
                            ))}
                        </div>
                    </div>
                </aside>

                {/* Content Table */}
                <div className="flex-1 p-8 overflow-y-auto relative">
                    {/* Toolbar */}
                    <div className="flex justify-between items-center mb-6">
                        <div className="relative w-96">
                            <svg className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                            </svg>
                            <input type="text" placeholder="Search your content..."
                                value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full bg-black/40 border border-white/10 rounded-full py-2.5 pl-11 pr-4 text-sm text-white focus:outline-none focus:border-nexusCyan transition-colors" />
                        </div>
                        <button className="bg-white/5 border border-white/10 hover:bg-white/10 text-white px-4 py-2 rounded-lg text-sm font-bold transition-all flex items-center gap-2">
                            <svg className="w-4 h-4 text-nexusCyan" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                            Export CSV
                        </button>
                    </div>

                    {/* Table */}
                    <div className="glass-panel rounded-xl border-white/10 overflow-hidden">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-black/60 border-b border-white/10 text-xs font-bold text-gray-400 uppercase tracking-widest">
                                    <th className="p-4 w-12"><div className="w-4 h-4 rounded border border-white/20" /></th>
                                    <th className="p-4">Video</th>
                                    <th className="p-4 w-32">Visibility</th>
                                    <th className="p-4 w-32">Monetization</th>
                                    <th className="p-4 w-24 text-right">Views</th>
                                    <th className="p-4 w-24 text-right">Revenue</th>
                                    <th className="p-4 w-32 text-center">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-white/5">
                                {filteredContent.map(item => (
                                    <tr key={item.id} className="hover:bg-white/[0.02] transition-colors group">
                                        <td className="p-4"><div className="w-4 h-4 rounded border border-white/20" /></td>
                                        <td className="p-4">
                                            <div className="flex gap-4 items-center">
                                                <div className="w-24 h-14 rounded bg-gray-800 bg-cover relative" style={{ backgroundImage: `url(${item.thumb})` }}>
                                                    <div className="absolute bottom-1 right-1 bg-black/80 text-[10px] font-mono px-1 rounded">{item.duration}</div>
                                                </div>
                                                <div>
                                                    <h4 className="font-bold text-sm text-white group-hover:text-nexusCyan transition-colors cursor-pointer truncate max-w-[300px]"
                                                        onClick={() => navigate(`/player/${item.id}`)}>
                                                        {item.title}
                                                    </h4>
                                                    <p className="text-[10px] text-gray-500 mt-1 line-clamp-1 max-w-[300px]">{item.description}</p>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="p-4">
                                            <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase flex items-center gap-1 w-max ${item.visibility === "published"
                                                ? "bg-green-500/10 text-green-500 border border-green-500/20"
                                                : "bg-gray-500/10 text-gray-400 border border-gray-500/20"}`}>
                                                {item.visibility === "published" && <div className="w-1.5 h-1.5 rounded-full bg-green-500" />}
                                                {item.visibility === "published" ? "Published" : "Draft"}
                                            </span>
                                            <div className="text-[10px] text-gray-500 mt-1 font-mono">{item.date}</div>
                                        </td>
                                        <td className="p-4">
                                            {item.price === "Free" ? (
                                                <span className="text-[10px] uppercase font-bold text-gray-500 bg-white/5 px-2 py-0.5 rounded">Free</span>
                                            ) : (
                                                <div className="flex items-center gap-1">
                                                    <svg className="w-3 h-3 text-yellow-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                                    </svg>
                                                    <span className="text-xs font-mono font-bold text-gray-300">{item.price}</span>
                                                </div>
                                            )}
                                        </td>
                                        <td className="p-4 text-right font-mono text-xs text-gray-300">
                                            {item.views > 0 ? item.views.toLocaleString() : "-"}
                                        </td>
                                        <td className="p-4 text-right font-mono text-xs font-bold text-nexusCyan">
                                            {item.revenue > 0 ? `$ ${item.revenue.toFixed(2)}` : "-"}
                                        </td>
                                        <td className="p-4 text-center">
                                            <div className="flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <button className="w-8 h-8 rounded-full hover:bg-white/10 flex items-center justify-center text-gray-400 hover:text-white" title="Edit">
                                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                                                    </svg>
                                                </button>
                                                <button className="w-8 h-8 rounded-full hover:bg-white/10 flex items-center justify-center text-gray-400 hover:text-white" title="Analytics"
                                                    onClick={() => navigate("/creator/analytics")}>
                                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                                                    </svg>
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    {/* Pagination */}
                    <div className="flex justify-between items-center mt-6">
                        <p className="text-xs text-gray-500">Showing 1 to {filteredContent.length} of {content.length} entries</p>
                        <div className="flex gap-1">
                            <button className="w-8 h-8 flex items-center justify-center bg-white/5 border border-white/10 rounded text-gray-500 cursor-not-allowed">‹</button>
                            <button className="w-8 h-8 flex items-center justify-center bg-nexusPurple text-white rounded font-bold">1</button>
                            <button className="w-8 h-8 flex items-center justify-center bg-white/5 border border-white/10 rounded hover:bg-white/10 text-gray-400">2</button>
                            <button className="w-8 h-8 flex items-center justify-center bg-white/5 border border-white/10 rounded hover:bg-white/10 text-gray-400">›</button>
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
}
