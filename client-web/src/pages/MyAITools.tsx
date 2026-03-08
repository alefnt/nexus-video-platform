// @ts-nocheck
/**
 * My AI Tools — Personal dashboard for published/purchased AI tools & usage tracking.
 */

import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Cpu, Package, ShoppingCart, BarChart3, Star, ExternalLink, TrendingUp, Clock, Zap } from "lucide-react";

// ── Mock Data ─────────────────────────────────────────────────
const PUBLISHED_TOOLS = [
    { id: "1", name: "Smart Caption Generator", category: "Video", status: "active", users: 1842, rating: 4.8, revenue: 2450, icon: "🎬", lastUpdated: "2 days ago" },
    { id: "2", name: "Music Mood Analyzer", category: "Audio", status: "active", users: 967, rating: 4.5, revenue: 890, icon: "🎵", lastUpdated: "1 week ago" },
    { id: "3", name: "Article SEO Optimizer", category: "Text", status: "draft", users: 0, rating: 0, revenue: 0, icon: "📝", lastUpdated: "3 hours ago" },
];

const PURCHASED_TOOLS = [
    { id: "p1", name: "AI Thumbnail Creator", category: "Image", usageCount: 156, usageLimit: 500, expiresIn: "23 days", icon: "🖼️", rating: 4.9 },
    { id: "p2", name: "Voice Cloning Studio", category: "Audio", usageCount: 42, usageLimit: 100, expiresIn: "15 days", icon: "🎙️", rating: 4.7 },
    { id: "p3", name: "Auto Subtitle Pro", category: "Video", usageCount: 89, usageLimit: 200, expiresIn: "8 days", icon: "💬", rating: 4.6 },
    { id: "p4", name: "Content Repurposer", category: "Text", usageCount: 200, usageLimit: 200, expiresIn: "Expired", icon: "♻️", rating: 4.3 },
];

const USAGE_STATS = {
    totalApiCalls: 12487,
    activeSubscriptions: 3,
    totalSpent: 1240,
    toolsPublished: 3,
};

type Tab = "purchased" | "published";

export default function MyAITools() {
    const navigate = useNavigate();
    const [activeTab, setActiveTab] = useState<Tab>("purchased");

    return (
        <div className="min-h-screen bg-[#0a0a12] text-white p-6 md:p-8">
            {/* Header */}
            <div className="max-w-6xl mx-auto">
                <div className="flex items-center justify-between mb-8">
                    <div>
                        <h1 className="text-3xl font-black bg-gradient-to-r from-cyan-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
                            My AI Tools
                        </h1>
                        <p className="text-gray-400 text-sm mt-1">Manage your published tools and track purchased tool usage</p>
                    </div>
                    <button
                        onClick={() => navigate("/ai-tools")}
                        className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-cyan-500 to-purple-600 rounded-lg text-sm font-bold hover:opacity-90 transition"
                    >
                        <ShoppingCart size={16} />
                        Browse Marketplace
                    </button>
                </div>

                {/* Stats Cards */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                    {[
                        { label: "Active Subscriptions", value: USAGE_STATS.activeSubscriptions, icon: Zap, color: "text-cyan-400", bg: "bg-cyan-500/10" },
                        { label: "Total API Calls", value: USAGE_STATS.totalApiCalls.toLocaleString(), icon: BarChart3, color: "text-purple-400", bg: "bg-purple-500/10" },
                        { label: "Total Spent (PTS)", value: USAGE_STATS.totalSpent.toLocaleString(), icon: TrendingUp, color: "text-pink-400", bg: "bg-pink-500/10" },
                        { label: "Tools Published", value: USAGE_STATS.toolsPublished, icon: Package, color: "text-yellow-400", bg: "bg-yellow-500/10" },
                    ].map((stat, i) => (
                        <div key={i} className={`${stat.bg} border border-white/5 rounded-xl p-4`}>
                            <div className="flex items-center gap-2 mb-2">
                                <stat.icon size={16} className={stat.color} />
                                <span className="text-xs text-gray-400">{stat.label}</span>
                            </div>
                            <div className={`text-2xl font-black ${stat.color}`}>{stat.value}</div>
                        </div>
                    ))}
                </div>

                {/* Tabs */}
                <div className="flex gap-1 bg-white/5 rounded-xl p-1 mb-6 w-fit">
                    {([
                        { key: "purchased" as Tab, label: "Purchased Tools", icon: ShoppingCart },
                        { key: "published" as Tab, label: "Published Tools", icon: Package },
                    ]).map(({ key, label, icon: Icon }) => (
                        <button
                            key={key}
                            onClick={() => setActiveTab(key)}
                            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === key ? "bg-white/10 text-white" : "text-gray-500 hover:text-white"
                                }`}
                        >
                            <Icon size={14} />
                            {label}
                        </button>
                    ))}
                </div>

                {/* Purchased Tools Tab */}
                {activeTab === "purchased" && (
                    <div className="grid gap-4">
                        {PURCHASED_TOOLS.map((tool) => {
                            const usagePercent = Math.min(100, (tool.usageCount / tool.usageLimit) * 100);
                            const isExpired = tool.expiresIn === "Expired";
                            const isNearLimit = usagePercent >= 80;
                            return (
                                <div key={tool.id} className={`bg-white/[0.03] border rounded-xl p-5 transition-all hover:bg-white/[0.06] ${isExpired ? "border-red-500/30 opacity-60" : "border-white/5"
                                    }`}>
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-4">
                                            <div className="text-3xl">{tool.icon}</div>
                                            <div>
                                                <h3 className="font-bold text-lg">{tool.name}</h3>
                                                <div className="flex items-center gap-3 mt-1">
                                                    <span className="text-xs px-2 py-0.5 bg-white/10 rounded-full text-gray-400">{tool.category}</span>
                                                    <span className="flex items-center gap-1 text-xs text-yellow-400">
                                                        <Star size={10} fill="currentColor" /> {tool.rating}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-4">
                                            <div className="text-right">
                                                <div className={`flex items-center gap-1 text-xs ${isExpired ? "text-red-400" : "text-gray-400"}`}>
                                                    <Clock size={10} />
                                                    {isExpired ? "Expired" : `Expires in ${tool.expiresIn}`}
                                                </div>
                                            </div>
                                            <button
                                                className={`px-4 py-2 rounded-lg text-xs font-bold transition ${isExpired
                                                        ? "bg-red-500/20 text-red-400 hover:bg-red-500/30"
                                                        : "bg-cyan-500/20 text-cyan-400 hover:bg-cyan-500/30"
                                                    }`}
                                            >
                                                {isExpired ? "Renew" : "Use Tool"}
                                            </button>
                                        </div>
                                    </div>
                                    {/* Usage Bar */}
                                    <div className="mt-4">
                                        <div className="flex justify-between text-xs text-gray-400 mb-1">
                                            <span>Usage: {tool.usageCount} / {tool.usageLimit} calls</span>
                                            <span className={isNearLimit ? "text-yellow-400" : ""}>{usagePercent.toFixed(0)}%</span>
                                        </div>
                                        <div className="w-full h-2 bg-white/5 rounded-full overflow-hidden">
                                            <div
                                                className={`h-full rounded-full transition-all ${isExpired ? "bg-red-500" : isNearLimit ? "bg-yellow-500" : "bg-cyan-500"
                                                    }`}
                                                style={{ width: `${usagePercent}%` }}
                                            />
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}

                {/* Published Tools Tab */}
                {activeTab === "published" && (
                    <div className="grid gap-4">
                        {PUBLISHED_TOOLS.map((tool) => (
                            <div key={tool.id} className="bg-white/[0.03] border border-white/5 rounded-xl p-5 transition-all hover:bg-white/[0.06]">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-4">
                                        <div className="text-3xl">{tool.icon}</div>
                                        <div>
                                            <h3 className="font-bold text-lg">{tool.name}</h3>
                                            <div className="flex items-center gap-3 mt-1">
                                                <span className="text-xs px-2 py-0.5 bg-white/10 rounded-full text-gray-400">{tool.category}</span>
                                                <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${tool.status === "active" ? "bg-green-500/20 text-green-400" : "bg-yellow-500/20 text-yellow-400"
                                                    }`}>
                                                    {tool.status === "active" ? "● Active" : "◯ Draft"}
                                                </span>
                                                {tool.rating > 0 && (
                                                    <span className="flex items-center gap-1 text-xs text-yellow-400">
                                                        <Star size={10} fill="currentColor" /> {tool.rating}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-6">
                                        {tool.status === "active" && (
                                            <div className="grid grid-cols-2 gap-4 text-right">
                                                <div>
                                                    <div className="text-xs text-gray-500">Users</div>
                                                    <div className="text-sm font-bold text-white">{tool.users.toLocaleString()}</div>
                                                </div>
                                                <div>
                                                    <div className="text-xs text-gray-500">Revenue (PTS)</div>
                                                    <div className="text-sm font-bold text-green-400">+{tool.revenue.toLocaleString()}</div>
                                                </div>
                                            </div>
                                        )}
                                        <div className="flex items-center gap-2">
                                            <button className="px-3 py-2 bg-white/5 rounded-lg text-xs text-gray-400 hover:text-white hover:bg-white/10 transition">
                                                Edit
                                            </button>
                                            <button className="px-3 py-2 bg-purple-500/20 rounded-lg text-xs text-purple-400 hover:bg-purple-500/30 transition flex items-center gap-1">
                                                <ExternalLink size={12} /> View
                                            </button>
                                        </div>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2 mt-3 text-xs text-gray-500">
                                    <Clock size={10} />
                                    Last updated: {tool.lastUpdated}
                                </div>
                            </div>
                        ))}

                        {/* Publish New Tool button */}
                        <button
                            onClick={() => navigate("/ai-tools/submit")}
                            className="w-full border-2 border-dashed border-white/10 rounded-xl p-6 flex flex-col items-center justify-center gap-2 text-gray-500 hover:text-white hover:border-cyan-500/40 hover:bg-cyan-500/5 transition-all group"
                        >
                            <Cpu size={24} className="group-hover:text-cyan-400 transition-colors" />
                            <span className="font-bold text-sm">Publish a New AI Tool</span>
                            <span className="text-xs">Share your AI tool with the marketplace</span>
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}
