/**
 * Live Channels Listing Page ..."Live Space"
 *
 * Features:
 * - Featured Live Event hero banner
 * - Category filters (All / Gaming / Music / IRL / Web3 Talk)
 * - Live stream cards grid with viewer counts, tags, VIP badges
 * - Links to actual live rooms via /live/:roomId
 */

import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { getApiClient } from "../lib/apiClient";
import { useAuthStore } from "../stores";
import { setPageSEO } from "../utils/seo";
import { Eye, Play, Users, Zap } from "lucide-react";

interface LiveRoom {
    roomId: string;
    title: string;
    description?: string;
    creatorId: string;
    creatorName?: string;
    creatorAvatar?: string;
    status: "live" | "ended" | "scheduled";
    category?: string;
    coverUrl?: string;
    viewerCount: number;
    totalTips: number;
    startedAt?: string;
    ticketPrice?: number;
}

type LiveCategory = "all" | "gaming" | "music" | "irl" | "web3";

function formatViewerCount(n: number): string {
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
    if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
    return String(n);
}

// Fallback live rooms (shown when API returns empty)
const FALLBACK_LIVE_ROOMS: LiveRoom[] = [
    {
        roomId: "room-1",
        title: "Tech Talk: Future of Fiber",
        creatorId: "cr1",
        creatorName: "Cosmic Studios",
        creatorAvatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&h=100&fit=crop",
        status: "live",
        category: "web3",
        coverUrl: "https://images.unsplash.com/photo-1542204165-65bf26472b9b?auto=format&fit=crop&q=80&w=800",
        viewerCount: 12500,
        totalTips: 0,
    },
    {
        roomId: "room-2",
        title: "Exclusive Set: Underground DJ",
        creatorId: "cr2",
        creatorName: "Neon Beats",
        creatorAvatar: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100&h=100&fit=crop",
        status: "live",
        category: "music",
        coverUrl: "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?auto=format&fit=crop&q=80&w=800",
        viewerCount: 3200,
        totalTips: 0,
        ticketPrice: 2.50,
    },
    {
        roomId: "room-3",
        title: "Pro League Finals",
        creatorId: "cr3",
        creatorName: "EsportsHub",
        creatorAvatar: "https://images.unsplash.com/photo-1531427186611-ecfd6d936c79?w=100&h=100&fit=crop",
        status: "live",
        category: "gaming",
        coverUrl: "https://images.unsplash.com/photo-1542751371-adc38448a05e?auto=format&fit=crop&q=80&w=800",
        viewerCount: 1100,
        totalTips: 0,
    },
    {
        roomId: "room-4",
        title: "Let's Build a DAO",
        creatorId: "cr4",
        creatorName: "Code & Crypto",
        creatorAvatar: "https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?w=100&h=100&fit=crop",
        status: "live",
        category: "web3",
        coverUrl: "https://images.unsplash.com/photo-1551818255-e6e10975bc17?auto=format&fit=crop&q=80&w=800",
        viewerCount: 856,
        totalTips: 0,
    },
];

const FALLBACK_FEATURED: LiveRoom = {
    roomId: "featured-1",
    title: "Global Developer Cyber-Summit",
    description: "Join the core team for the major mainnet unveiling. Connect your wallet to receive POAP Fragments.",
    creatorId: "nexus",
    creatorName: "NEXUS Core",
    status: "live",
    category: "web3",
    coverUrl: "https://images.unsplash.com/photo-1540039155733-d7696d4eb98e?auto=format&fit=crop&q=80&w=1600",
    viewerCount: 84200,
    totalTips: 0,
    ticketPrice: 5.00,
};

const CATEGORIES: { value: LiveCategory; label: string }[] = [
    { value: "all", label: "All" },
    { value: "gaming", label: "Gaming" },
    { value: "music", label: "Music" },
    { value: "irl", label: "IRL" },
    { value: "web3", label: "Web3 Talk" },
];

const LiveChannels: React.FC = () => {
    const navigate = useNavigate();
    const api = getApiClient();
    const [category, setCategory] = useState<LiveCategory>("all");

    const [rooms, setRooms] = useState<LiveRoom[]>([]);
    const [featured, setFeatured] = useState<LiveRoom | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        setPageSEO({ title: "Live Space ...NEXUS" });
    }, []);

    // Load live rooms from API
    useEffect(() => {
        setLoading(true);
        const jwt = sessionStorage.getItem('vp.jwt');
        if (jwt) api.setJWT(jwt);
        api.get<{ rooms: LiveRoom[]; featured?: LiveRoom }>(`/live/rooms?status=live`)
            .then((res) => {
                const apiRooms = res.rooms?.length ? res.rooms : [];
                setRooms(apiRooms);
                setFeatured(res.featured || apiRooms[0] || null);
            })
            .catch(() => {
                setRooms(FALLBACK_LIVE_ROOMS);
                setFeatured(FALLBACK_FEATURED);
            })
            .finally(() => setLoading(false));
    }, []);

    const filteredRooms = category === "all"
        ? rooms
        : rooms.filter((r) => r.category === category);

    return (
        <div className="relative min-h-screen font-sans pb-32">
            {/* Ambient Red Glow */}
            <div className="absolute top-[5%] left-1/2 -translate-x-1/2 w-[60vw] h-[40vh] bg-red-500/15 blur-[80px] pointer-events-none z-0 rounded-full" />

            <main className="relative z-10 flex-1 flex flex-col w-full max-w-[1600px] mx-auto pt-8 px-6 lg:px-8 pb-32">

                {/* Featured Live Event */}
                {featured && (
                    <div
                        className="w-full relative rounded-3xl overflow-hidden glass-panel border border-white/10 mb-12 group cursor-pointer aspect-[21/9] max-h-[500px]"
                        onClick={() => navigate(`/live/${featured.roomId}`)}
                    >
                        <img
                            src={featured.coverUrl || "https://images.unsplash.com/photo-1540039155733-d7696d4eb98e?auto=format&fit=crop&q=80&w=1600"}
                            alt="Live Event"
                            className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity duration-700 group-hover:scale-[1.02] transform"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent" />

                        <div className="absolute top-6 left-6 flex items-center gap-3">
                            <div className="bg-red-500 text-white px-4 py-1.5 rounded-md text-xs font-bold tracking-widest flex items-center gap-2 backdrop-blur-md shadow-[0_0_15px_rgba(239,68,68,0.6)]">
                                <span className="w-2 h-2 rounded-full bg-white animate-pulse" /> LIVE NOW
                            </div>
                            <div className="bg-black/60 backdrop-blur-md border border-white/20 text-white px-3 py-1.5 rounded-md text-xs font-bold font-mono">
                                {formatViewerCount(featured.viewerCount)} Watching
                            </div>
                        </div>

                        <div className="absolute bottom-0 inset-x-0 p-10 flex items-end justify-between">
                            <div>
                                <h2 className="text-3xl lg:text-5xl font-black text-white mb-2 drop-shadow-lg">{featured.title}</h2>
                                <p className="text-gray-300 text-lg max-w-2xl drop-shadow-md">{featured.description || ''}</p>
                            </div>

                            <div className="hidden lg:flex items-center gap-4">
                                {featured.ticketPrice && featured.ticketPrice > 0 && (
                                    <div className="text-right mr-4">
                                        <div className="text-[10px] text-yellow-400 font-bold tracking-widest uppercase mb-1">VIP Backstage Available</div>
                                        <div className="text-xl font-mono font-bold text-white">${featured.ticketPrice.toFixed(2)} <span className="text-sm text-gray-400">USDC</span></div>
                                    </div>
                                )}
                                <button className="bg-white text-black px-8 py-4 rounded-full font-bold flex items-center gap-2 hover:bg-gray-200 transition-colors hover:scale-105 transform shadow-[0_0_20px_rgba(255,255,255,0.3)]">
                                    <Play size={20} fill="currentColor" />
                                    Join Broadcast
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Filter / Tabs + Go Live */}
                <div className="flex items-center justify-between mb-8">
                    <div className="flex items-center gap-4">
                        <h3 className="text-2xl font-bold text-white flex items-center gap-2">
                            Live Channels
                        </h3>
                        <button
                            onClick={() => navigate("/room/create")}
                            className="bg-gradient-to-r from-red-500 to-pink-500 text-white px-5 py-2.5 rounded-full text-sm font-bold hover:shadow-lg hover:shadow-red-500/30 transition-all flex items-center gap-2 animate-pulse hover:animate-none"
                        >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                            </svg>
                            Go Live
                        </button>
                    </div>
                    <div className="flex items-center gap-2 bg-black/40 p-1 rounded-full border border-white/5">
                        {CATEGORIES.map((cat) => (
                            <button
                                key={cat.value}
                                onClick={() => setCategory(cat.value)}
                                className={`px-6 py-2 rounded-full text-sm font-bold transition-colors ${category === cat.value
                                    ? "bg-white/10 text-white shadow-sm"
                                    : "text-gray-400 hover:text-white"
                                    }`}
                            >
                                {cat.label}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Live Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                    {filteredRooms.map((room) => (
                        <div
                            key={room.roomId}
                            className={`live-card glass-panel rounded-2xl overflow-hidden flex flex-col group cursor-pointer border transition-all duration-300 hover:translate-y-[-4px] hover:shadow-[0_10px_30px_rgba(0,0,0,0.5),0_0_20px_rgba(239,68,68,0.05)] ${room.ticketPrice
                                ? "border-cyan-500/20 bg-cyan-500/5 hover:border-cyan-500/40"
                                : "border-white/5 hover:border-red-500/30"
                                }`}
                            onClick={() => navigate(`/live/${room.roomId}`)}
                        >
                            {/* Thumbnail */}
                            <div className={`aspect-video w-full relative overflow-hidden bg-gray-900 ${room.ticketPrice ? "border-b border-cyan-500/20" : "border-b border-white/10"}`}>
                                <img
                                    src={room.coverUrl || "https://images.unsplash.com/photo-1536440136628-849c177e76a1?auto=format&fit=crop&q=80&w=600"}
                                    alt={room.title}
                                    className="w-full h-full object-cover opacity-90 transition-transform duration-500 group-hover:scale-105"
                                />
                                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-60" />

                                {/* LIVE badge */}
                                <div className="absolute top-3 left-3 bg-red-500/20 backdrop-blur-md px-2 py-1 rounded border border-red-500/50 text-[10px] font-bold tracking-wider text-red-500 flex items-center gap-1.5">
                                    <span className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse" /> LIVE
                                </div>

                                {/* VIP price badge */}
                                {room.ticketPrice && (
                                    <div className="absolute top-3 right-3 bg-cyan-500/20 backdrop-blur-md px-2 py-1 rounded border border-cyan-500/50 text-[10px] font-bold font-mono tracking-wider text-cyan-400">
                                        VIP: ${room.ticketPrice.toFixed(2)}
                                    </div>
                                )}

                                {/* Viewer count */}
                                <div className="absolute bottom-3 left-3 bg-black/60 backdrop-blur-md px-2 py-1 rounded border border-white/20 text-xs font-bold text-white flex items-center gap-1.5">
                                    <Eye size={14} className="text-gray-400" />
                                    {formatViewerCount(room.viewerCount)}
                                </div>

                                {/* Watch Party badge */}
                                {!room.ticketPrice && (
                                    <div className="absolute bottom-3 right-3 bg-purple-500/20 backdrop-blur-md text-purple-400 border border-purple-500/50 px-2 py-1 rounded text-[10px] font-bold tracking-wider flex items-center gap-1">
                                        <Users size={12} />
                                        Watch Party
                                    </div>
                                )}
                            </div>

                            {/* Info */}
                            <div className={`p-4 flex gap-3 ${room.ticketPrice ? "" : "bg-[#0A0A14]"}`}>
                                <img
                                    src={room.creatorAvatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${room.creatorId}`}
                                    alt=""
                                    className={`w-10 h-10 rounded-full object-cover flex-shrink-0 mt-1 border ${room.ticketPrice ? "border-cyan-500/50" : "border-white/20"}`}
                                />
                                <div className="flex-1 min-w-0">
                                    <h3 className="text-white font-bold text-sm leading-tight mb-1 truncate group-hover:text-cyan-400 transition-colors">
                                        {room.title}
                                    </h3>
                                    <p className="text-xs text-gray-400 truncate">{room.creatorName || "Unknown"}</p>
                                    <div className="flex flex-wrap gap-1 mt-2">
                                        {room.category && (
                                            <span className={`text-[10px] px-2 py-0.5 rounded ${room.ticketPrice
                                                ? "bg-cyan-500/10 text-cyan-400 border border-cyan-500/20"
                                                : "bg-white/5 text-gray-400 hover:bg-white/10"
                                                }`}>
                                                {room.category === "web3" ? "Web3 Talk" : room.category.charAt(0).toUpperCase() + room.category.slice(1)}
                                            </span>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>

                {/* Empty state */}
                {!loading && filteredRooms.length === 0 && (
                    <div className="text-center py-20">
                        <div className="w-20 h-20 rounded-full bg-white/5 flex items-center justify-center mx-auto mb-4 text-gray-500">
                            <Zap size={32} />
                        </div>
                        <h3 className="text-xl font-bold text-white mb-2">No Live Channels</h3>
                        <p className="text-gray-400">No one is streaming in this category right now. Check back later!</p>
                    </div>
                )}
            </main>
        </div>
    );
};

export default LiveChannels;
