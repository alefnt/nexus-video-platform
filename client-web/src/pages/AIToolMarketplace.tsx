// FILE: /video-platform/client-web/src/pages/AIToolMarketplace.tsx
/**
 * AI Tool Marketplace — Decentralized marketplace for AI tools/plugins.
 * Creators publish tools, users browse/try/pay via Fiber Network + RGB++ + Spore NFT.
 * Supports ALL tool categories (not just media generation).
 */
import React, { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";

const CATEGORIES = [
    { id: "all", label: "🔥 All", color: "from-orange-500 to-red-500" },
    { id: "agents", label: "🤖 AI Agents", color: "from-purple-500 to-indigo-500" },
    { id: "writing", label: "📝 Writing", color: "from-blue-500 to-cyan-500" },
    { id: "audio", label: "🎵 Audio & Music", color: "from-pink-500 to-rose-500" },
    { id: "video", label: "🎬 Video", color: "from-red-500 to-orange-500" },
    { id: "image", label: "🖼️ Image & Design", color: "from-emerald-500 to-teal-500" },
    { id: "data", label: "📊 Data & Analytics", color: "from-yellow-500 to-amber-500" },
    { id: "dev", label: "🔧 Developer Tools", color: "from-gray-500 to-slate-500" },
    { id: "gaming", label: "🎮 Gaming", color: "from-violet-500 to-purple-500" },
    { id: "social", label: "📱 Social & Marketing", color: "from-cyan-500 to-blue-500" },
    { id: "other", label: "🧠 Other", color: "from-gray-400 to-gray-500" },
];

// Mock data — in production this comes from the backend
const MOCK_TOOLS = [
    {
        id: "1", name: "Smart Article Writer", creator: "nexus-labs.bit", creatorAvatar: "", category: "writing",
        description: "AI-powered article generator with SEO optimization, multi-language support, and tone control. Uses GPT-4 and DeepSeek under the hood.",
        rating: 4.8, reviews: 142, price: "free", priceLabel: "Free", uses: 12500,
        tags: ["GPT-4", "SEO", "Multi-lang"], featured: true,
        icon: "📝", gradient: "from-blue-500 to-cyan-500",
    },
    {
        id: "2", name: "Voice Clone Studio", creator: "ai-tools.bit", creatorAvatar: "", category: "audio",
        description: "Clone any voice with just 30 seconds of audio. Perfect for podcasts, dubbing, and voice-overs. Supports 50+ languages.",
        rating: 4.6, reviews: 89, price: "0.5", priceLabel: "0.5 CKB/use", uses: 3200,
        tags: ["Voice", "Clone", "TTS"], featured: true,
        icon: "🎤", gradient: "from-pink-500 to-rose-500",
    },
    {
        id: "3", name: "Code Review Agent", creator: "dev-master.bit", creatorAvatar: "", category: "dev",
        description: "Automated code review agent that catches bugs, suggests improvements, and ensures best practices. Supports 20+ languages.",
        rating: 4.9, reviews: 256, price: "1", priceLabel: "1 CKB/review", uses: 8900,
        tags: ["Code", "Review", "CI/CD"], featured: true,
        icon: "🔍", gradient: "from-emerald-500 to-teal-500",
    },
    {
        id: "4", name: "Product Photo Generator", creator: "studio-ai.bit", creatorAvatar: "", category: "image",
        description: "Generate stunning product photography from simple descriptions. Perfect for e-commerce, social media, and marketing.",
        rating: 4.7, reviews: 178, price: "0.2", priceLabel: "0.2 CKB/image", uses: 15600,
        tags: ["Product", "Photo", "E-commerce"], featured: false,
        icon: "📸", gradient: "from-amber-500 to-orange-500",
    },
    {
        id: "5", name: "Subtitle Auto-Translator", creator: "polyglot.bit", creatorAvatar: "", category: "video",
        description: "Auto-translate and sync subtitles in 100+ languages. Smart timing adjustment and cultural localization built-in.",
        rating: 4.5, reviews: 67, price: "0.3", priceLabel: "0.3 CKB/min", uses: 4500,
        tags: ["Subtitle", "Translation", "Video"], featured: false,
        icon: "🌍", gradient: "from-violet-500 to-purple-500",
    },
    {
        id: "6", name: "Social Media Scheduler", creator: "growth-hack.bit", creatorAvatar: "", category: "social",
        description: "AI-driven social media scheduling with optimal posting times, hashtag suggestions, and engagement prediction.",
        rating: 4.4, reviews: 93, price: "2", priceLabel: "2 CKB/month", uses: 2100,
        tags: ["Social", "Schedule", "Analytics"], featured: false,
        icon: "📅", gradient: "from-cyan-500 to-blue-500",
    },
    {
        id: "7", name: "Data Insight Bot", creator: "data-viz.bit", creatorAvatar: "", category: "data",
        description: "Upload any CSV/JSON and get instant visual insights, trend analysis, and actionable recommendations via natural language.",
        rating: 4.3, reviews: 45, price: "free", priceLabel: "Free", uses: 1800,
        tags: ["Data", "Visualization", "NLP"], featured: false,
        icon: "📊", gradient: "from-yellow-500 to-amber-500",
    },
    {
        id: "8", name: "NPC Dialogue Generator", creator: "game-dev.bit", creatorAvatar: "", category: "gaming",
        description: "Generate dynamic NPC dialogues with branching paths, personality traits, and quest integration. Unity/Unreal plugins available.",
        rating: 4.6, reviews: 34, price: "1", priceLabel: "1 CKB/session", uses: 900,
        tags: ["NPC", "Dialogue", "Game"], featured: false,
        icon: "🎮", gradient: "from-violet-500 to-fuchsia-500",
    },
    {
        id: "9", name: "Meeting Summarizer", creator: "productivity.bit", creatorAvatar: "", category: "agents",
        description: "Upload audio/video of any meeting and get structured summaries, action items, and follow-up emails in seconds.",
        rating: 4.7, reviews: 201, price: "0.5", priceLabel: "0.5 CKB/meeting", uses: 7800,
        tags: ["Meeting", "Summary", "Agent"], featured: true,
        icon: "🤖", gradient: "from-purple-500 to-indigo-500",
    },
];

export default function AIToolMarketplace() {
    const navigate = useNavigate();
    const [search, setSearch] = useState("");
    const [activeCategory, setActiveCategory] = useState("all");
    const [sortBy, setSortBy] = useState<"popular" | "rating" | "newest" | "price">("popular");
    const [selectedTool, setSelectedTool] = useState<typeof MOCK_TOOLS[0] | null>(null);

    const filtered = useMemo(() => {
        let list = MOCK_TOOLS;
        if (activeCategory !== "all") list = list.filter(t => t.category === activeCategory);
        if (search.trim()) {
            const q = search.toLowerCase();
            list = list.filter(t =>
                t.name.toLowerCase().includes(q) ||
                t.description.toLowerCase().includes(q) ||
                t.tags.some(tag => tag.toLowerCase().includes(q))
            );
        }
        switch (sortBy) {
            case "rating": return [...list].sort((a, b) => b.rating - a.rating);
            case "newest": return [...list].reverse();
            case "price": return [...list].sort((a, b) => {
                const pa = a.price === "free" ? 0 : parseFloat(a.price);
                const pb = b.price === "free" ? 0 : parseFloat(b.price);
                return pa - pb;
            });
            default: return [...list].sort((a, b) => b.uses - a.uses);
        }
    }, [search, activeCategory, sortBy]);

    const featuredTools = MOCK_TOOLS.filter(t => t.featured);

    return (
        <div className="min-h-screen bg-[#0a0a12] text-white p-6 md:p-10 font-sans">
            <div className="max-w-[1600px] mx-auto">

                {/* Hero Section */}
                <header className="mb-12">
                    <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-6">
                        <div>
                            <h1 className="text-4xl md:text-5xl font-black tracking-tight mb-2">
                                <span className="bg-gradient-to-r from-cyan-400 via-purple-400 to-pink-400 text-transparent bg-clip-text">
                                    AI Tool Marketplace
                                </span>
                            </h1>
                            <p className="text-gray-400 text-sm max-w-2xl">
                                🔥 Discover, try, and purchase AI-powered tools built by creators worldwide.
                                Ownership via <span className="text-purple-400 font-semibold">Spore NFT</span>, payments via{" "}
                                <span className="text-cyan-400 font-semibold">Fiber Network</span>, revenue splits via{" "}
                                <span className="text-pink-400 font-semibold">RGB++</span>.
                            </p>
                        </div>
                        <button
                            onClick={() => navigate("/ai-tools/submit")}
                            className="px-6 py-3 bg-gradient-to-r from-purple-600 to-pink-600 text-white font-bold text-sm rounded-xl hover:shadow-[0_0_25px_rgba(168,85,247,0.4)] transition-all flex items-center gap-2 shrink-0"
                        >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4"></path></svg>
                            Publish Tool
                        </button>
                    </div>

                    {/* Search */}
                    <div className="relative max-w-2xl">
                        <svg className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path>
                        </svg>
                        <input
                            type="text"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder="Search tools, agents, plugins..."
                            className="w-full pl-12 pr-4 py-3.5 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/30 transition-all"
                        />
                    </div>
                </header>

                {/* Featured Tools */}
                {!search && activeCategory === "all" && (
                    <section className="mb-12">
                        <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                            ⭐ Featured Tools
                        </h2>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                            {featuredTools.map(tool => (
                                <button
                                    key={tool.id}
                                    onClick={() => setSelectedTool(tool)}
                                    className="text-left p-5 rounded-2xl border border-white/10 bg-gradient-to-br from-white/5 to-transparent hover:border-cyan-500/30 hover:shadow-[0_0_20px_rgba(34,211,238,0.1)] transition-all group"
                                >
                                    <div className="flex items-center gap-3 mb-3">
                                        <span className={`text-3xl w-12 h-12 rounded-xl bg-gradient-to-r ${tool.gradient} flex items-center justify-center`}>
                                            {tool.icon}
                                        </span>
                                        <div className="flex-1 min-w-0">
                                            <h3 className="font-bold text-white text-sm truncate group-hover:text-cyan-400 transition-colors">{tool.name}</h3>
                                            <p className="text-gray-500 text-xs truncate">{tool.creator}</p>
                                        </div>
                                    </div>
                                    <p className="text-gray-400 text-xs line-clamp-2 mb-3">{tool.description}</p>
                                    <div className="flex items-center justify-between">
                                        <span className="flex items-center gap-1 text-yellow-400 text-xs font-bold">
                                            ★ {tool.rating} <span className="text-gray-500 font-normal">({tool.reviews})</span>
                                        </span>
                                        <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${tool.price === "free" ? "bg-green-500/20 text-green-400" : "bg-purple-500/20 text-purple-400"}`}>
                                            {tool.priceLabel}
                                        </span>
                                    </div>
                                </button>
                            ))}
                        </div>
                    </section>
                )}

                {/* Categories */}
                <div className="flex items-center gap-2 overflow-x-auto pb-4 mb-8 hide-scrollbar">
                    {CATEGORIES.map(cat => (
                        <button
                            key={cat.id}
                            onClick={() => setActiveCategory(cat.id)}
                            className={`flex-shrink-0 px-4 py-2 rounded-full text-xs font-bold transition-all ${activeCategory === cat.id
                                ? `bg-gradient-to-r ${cat.color} text-white shadow-lg`
                                : "bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white"
                                }`}
                        >
                            {cat.label}
                        </button>
                    ))}
                </div>

                {/* Sort + Count */}
                <div className="flex items-center justify-between mb-6">
                    <p className="text-gray-500 text-sm">
                        <span className="text-white font-bold">{filtered.length}</span> tools found
                    </p>
                    <div className="flex items-center gap-2">
                        {(["popular", "rating", "newest", "price"] as const).map(s => (
                            <button
                                key={s}
                                onClick={() => setSortBy(s)}
                                className={`px-3 py-1.5 rounded-lg text-xs font-bold capitalize transition-all ${sortBy === s ? "bg-cyan-500/20 text-cyan-400 border border-cyan-500/30" : "text-gray-500 hover:text-white"}`}
                            >
                                {s}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Tool Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                    {filtered.map(tool => (
                        <button
                            key={tool.id}
                            onClick={() => setSelectedTool(tool)}
                            className="text-left p-5 rounded-2xl border border-white/10 bg-white/[0.02] hover:bg-white/[0.06] hover:border-white/20 transition-all group"
                        >
                            <div className="flex items-center gap-3 mb-3">
                                <span className={`text-2xl w-10 h-10 rounded-lg bg-gradient-to-r ${tool.gradient} flex items-center justify-center`}>
                                    {tool.icon}
                                </span>
                                <div className="flex-1 min-w-0">
                                    <h3 className="font-bold text-white text-sm truncate group-hover:text-cyan-400 transition-colors">{tool.name}</h3>
                                    <p className="text-gray-600 text-xs truncate">{tool.creator}</p>
                                </div>
                            </div>
                            <p className="text-gray-400 text-xs line-clamp-2 mb-3 leading-relaxed">{tool.description}</p>
                            <div className="flex flex-wrap gap-1 mb-3">
                                {tool.tags.map(tag => (
                                    <span key={tag} className="px-2 py-0.5 bg-white/5 rounded text-[10px] text-gray-400 font-mono">{tag}</span>
                                ))}
                            </div>
                            <div className="flex items-center justify-between">
                                <span className="flex items-center gap-1 text-yellow-400 text-xs font-bold">
                                    ★ {tool.rating}
                                </span>
                                <span className="text-gray-500 text-[10px]">{tool.uses.toLocaleString()} uses</span>
                                <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${tool.price === "free" ? "bg-green-500/20 text-green-400" : "bg-purple-500/20 text-purple-400"}`}>
                                    {tool.priceLabel}
                                </span>
                            </div>
                        </button>
                    ))}
                </div>

                {filtered.length === 0 && (
                    <div className="text-center py-24">
                        <p className="text-gray-500 text-lg mb-2">No tools found</p>
                        <p className="text-gray-600 text-sm">Try a different search or category</p>
                    </div>
                )}
            </div>

            {/* Tool Detail Modal */}
            {selectedTool && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm" onClick={() => setSelectedTool(null)}>
                    <div className="bg-[#13131f] border border-white/10 rounded-3xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto shadow-2xl" onClick={e => e.stopPropagation()}>
                        {/* Modal Header */}
                        <div className={`p-8 bg-gradient-to-r ${selectedTool.gradient} bg-opacity-10 rounded-t-3xl relative`}>
                            <button onClick={() => setSelectedTool(null)} className="absolute top-4 right-4 text-white/50 hover:text-white text-xl">✕</button>
                            <div className="flex items-center gap-4">
                                <span className="text-5xl w-16 h-16 rounded-2xl bg-white/10 flex items-center justify-center backdrop-blur-sm">{selectedTool.icon}</span>
                                <div>
                                    <h2 className="text-2xl font-black text-white">{selectedTool.name}</h2>
                                    <p className="text-white/60 text-sm">by <span className="text-white/80 font-bold">{selectedTool.creator}</span></p>
                                </div>
                            </div>
                        </div>

                        <div className="p-8 space-y-6">
                            {/* Stats */}
                            <div className="grid grid-cols-4 gap-3">
                                {[
                                    { label: "Rating", value: `★ ${selectedTool.rating}`, sub: `${selectedTool.reviews} reviews` },
                                    { label: "Uses", value: selectedTool.uses.toLocaleString(), sub: "total" },
                                    { label: "Price", value: selectedTool.priceLabel, sub: selectedTool.price === "free" ? "forever free" : "per use" },
                                    { label: "Category", value: CATEGORIES.find(c => c.id === selectedTool.category)?.label?.split(" ")[0] || "🧠", sub: selectedTool.category },
                                ].map((stat, i) => (
                                    <div key={i} className="text-center p-3 bg-white/5 rounded-xl">
                                        <p className="text-white font-bold text-lg">{stat.value}</p>
                                        <p className="text-gray-500 text-[10px] uppercase tracking-wider">{stat.sub}</p>
                                    </div>
                                ))}
                            </div>

                            {/* Description */}
                            <div>
                                <h3 className="text-sm font-bold text-gray-300 mb-2 uppercase tracking-wider">Description</h3>
                                <p className="text-gray-400 text-sm leading-relaxed">{selectedTool.description}</p>
                            </div>

                            {/* Tags */}
                            <div className="flex flex-wrap gap-2">
                                {selectedTool.tags.map(tag => (
                                    <span key={tag} className="px-3 py-1 bg-white/5 border border-white/10 rounded-full text-xs text-gray-300 font-mono">{tag}</span>
                                ))}
                            </div>

                            {/* Web3 Info */}
                            <div className="bg-white/5 border border-white/10 rounded-xl p-4 space-y-2">
                                <h3 className="text-sm font-bold text-purple-400 mb-2">🔗 On-Chain Info</h3>
                                <div className="flex justify-between text-xs">
                                    <span className="text-gray-500">Ownership NFT</span>
                                    <span className="text-purple-400 font-mono">Spore Protocol</span>
                                </div>
                                <div className="flex justify-between text-xs">
                                    <span className="text-gray-500">Payment</span>
                                    <span className="text-cyan-400 font-mono">Fiber Network L2</span>
                                </div>
                                <div className="flex justify-between text-xs">
                                    <span className="text-gray-500">Revenue Split</span>
                                    <span className="text-pink-400 font-mono">70% Creator / 20% Platform / 10% Referrer (RGB++)</span>
                                </div>
                            </div>

                            {/* Actions */}
                            <div className="flex gap-3">
                                <button className="flex-1 py-3.5 bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-bold text-sm rounded-xl hover:shadow-[0_0_25px_rgba(34,211,238,0.3)] transition-all">
                                    🚀 Try Now
                                </button>
                                {selectedTool.price !== "free" && (
                                    <button className="flex-1 py-3.5 bg-gradient-to-r from-purple-600 to-pink-600 text-white font-bold text-sm rounded-xl hover:shadow-[0_0_25px_rgba(168,85,247,0.3)] transition-all">
                                        ⚡ Subscribe via Fiber
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
