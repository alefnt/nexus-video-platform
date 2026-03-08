import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useLiveList } from "../hooks/useApi";
import {
    Radio, Satellite, Tv, Eye, Clock, Ticket, TrendingUp,
    Sparkles, Film, Music, BookOpen, Zap, Play, Heart, ChevronRight
} from "lucide-react";
import { SkeletonCard } from "../components/ui/SkeletonCard";
import { VideoCard } from "../components/VideoCard";
import { getApiClient } from "../lib/apiClient";
import type { VideoMeta } from "@video-platform/shared/types";

const client = getApiClient();

interface LiveRoom {
    roomId: string;
    title: string;
    description?: string;
    creatorId: string;
    creatorAddress: string;
    creatorName: string;
    creatorAvatar?: string;
    status: string;
    category?: string;
    coverUrl?: string;
    viewerCount: number;
    isPrivate?: boolean;
    paymentMode?: 'ticket' | 'stream';
    ticketPrice?: number;
    pricePerMinute?: number;
    creator?: { nickname?: string };
}

const CATEGORIES = [
    { id: 'tech', label: 'Tech', icon: Zap, color: '#00D9FF' },
    { id: 'music', label: 'Music', icon: Music, color: '#a267ff' },
    { id: 'art', label: 'Art', icon: Sparkles, color: '#FF6B6B' },
    { id: 'food', label: 'Food', icon: BookOpen, color: '#FFD93D' },
    { id: 'travel', label: 'Travel', icon: Film, color: '#6BCB77' },
    { id: 'health', label: 'Health', icon: Heart, color: '#FF8FAB' },
];

export default function Explore() {
    const navigate = useNavigate();
    const { t } = useTranslation();
    const { data: rooms = [], isLoading: liveLoading } = useLiveList();

    const [trendingVideos, setTrendingVideos] = useState<VideoMeta[]>([]);
    const [recommendedVideos, setRecommendedVideos] = useState<VideoMeta[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchContent = async () => {
            setLoading(true);
            try {
                const [trendingRes, recommendedRes] = await Promise.allSettled([
                    client.get<{ videos: VideoMeta[] }>('/metadata/trending').catch(() => ({ videos: [] })),
                    client.get<{ videos: VideoMeta[] }>('/metadata/recommendations').catch(() => ({ videos: [] })),
                ]);

                const trending = trendingRes.status === 'fulfilled' ? (trendingRes.value as any)?.videos || [] : [];
                const recommended = recommendedRes.status === 'fulfilled' ? (recommendedRes.value as any)?.videos || [] : [];

                setTrendingVideos(trending);
                setRecommendedVideos(recommended);
            } catch {
                // Silently handle
            } finally {
                setLoading(false);
            }
        };
        fetchContent();
    }, []);

    const allVideos = [...trendingVideos, ...recommendedVideos].filter(
        (v, i, arr) => arr.findIndex(x => x.id === v.id) === i
    );

    return (
        <div className="min-h-full px-5 py-5 text-gray-200">
            <div className="max-w-[1200px] mx-auto">

                {/* ── Categories ── */}
                <div className="grid grid-cols-3 sm:grid-cols-6 gap-3 mb-8">
                    {CATEGORIES.map(cat => (
                        <button
                            key={cat.id}
                            onClick={() => navigate(`/search?q=${cat.id}`)}
                            className="flex flex-col items-center gap-2 p-4 rounded-xl bg-white/[0.03] border border-white/5 hover:bg-white/[0.08] hover:border-white/10 transition-all cursor-pointer group"
                        >
                            <cat.icon size={24} color={cat.color} className="group-hover:scale-110 transition-transform" />
                            <span className="text-sm text-gray-400 group-hover:text-white transition-colors">{cat.label}</span>
                        </button>
                    ))}
                </div>

                {/* ── Live Now ── */}
                <section className="mb-10">
                    <div className="flex justify-between items-center mb-4">
                        <h2 className="text-xl font-bold text-white flex items-center gap-2">
                            <Radio size={20} color="#ff4444" /> {t('explore.liveNow')}
                        </h2>
                        <button
                            className="flex items-center gap-1 text-sm text-[#00D9FF] hover:underline"
                            onClick={() => navigate('/room/create')}
                        >
                            {t('explore.goLive')} <ChevronRight size={16} />
                        </button>
                    </div>

                    {liveLoading ? (
                        <div className="grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-4">
                            {[1, 2, 3].map(i => <SkeletonCard key={i} />)}
                        </div>
                    ) : rooms.length === 0 ? (
                        <div className="text-center p-8 bg-white/[0.03] rounded-2xl border border-white/5">
                            <Satellite size={36} className="mx-auto mb-3 text-gray-600" />
                            <p className="text-gray-500 text-sm">{t('explore.noStreams')}</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-4">
                            {rooms.slice(0, 6).map((room: LiveRoom) => (
                                <div
                                    key={room.roomId}
                                    onClick={() => {
                                        const username = (room as any).creatorUsername;
                                        navigate(username ? `/live/@${username}` : `/live/${room.roomId}`);
                                    }}
                                    className="bg-[#1a1a24] rounded-xl overflow-hidden cursor-pointer border border-white/5 transition-all hover:-translate-y-1 hover:border-[#00D9FF]/30 group"
                                >
                                    <div
                                        className="aspect-video bg-cover relative flex items-center justify-center"
                                        style={{ background: room.coverUrl ? `url(${room.coverUrl}) center/cover` : 'linear-gradient(45deg, #2a2a35, #1a1a24)' }}
                                    >
                                        {!room.coverUrl && <Tv size={28} className="text-gray-600" />}
                                        <div className="absolute top-3 left-3 flex gap-2">
                                            <span className="bg-red-500 text-white px-2 py-0.5 rounded text-[11px] font-bold animate-pulse">LIVE</span>
                                            {room.isPrivate && (
                                                <span className={`${room.paymentMode === 'stream' ? 'bg-[#00D9FF]' : 'bg-yellow-400'} text-black px-2 py-0.5 rounded text-[11px] font-bold flex items-center gap-1`}>
                                                    {room.paymentMode === 'stream' ? (
                                                        <><Clock size={12} /> {Number(room.pricePerMinute || 0)}/min</>
                                                    ) : (
                                                        <><Ticket size={12} /> {Number(room.ticketPrice || 0)}</>
                                                    )}
                                                </span>
                                            )}
                                        </div>
                                        <div className="absolute bottom-2 right-2 bg-black/60 text-white px-2 py-0.5 rounded text-[11px] flex items-center gap-1">
                                            <Eye size={12} /> {room.viewerCount}
                                        </div>
                                    </div>
                                    <div className="p-3">
                                        <h3 className="m-0 mb-1 text-sm font-semibold truncate text-white">{room.title}</h3>
                                        <span className="text-xs text-gray-500">{room.creator?.nickname || 'Creator'}</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </section>

                {/* ── Trending Videos ── */}
                <section className="mb-10">
                    <div className="flex justify-between items-center mb-4">
                        <h2 className="text-xl font-bold text-white flex items-center gap-2">
                            <TrendingUp size={20} color="#FF6B6B" /> Trending Now
                        </h2>
                        <button
                            className="flex items-center gap-1 text-sm text-gray-400 hover:text-white transition-colors"
                            onClick={() => navigate('/videos')}
                        >
                            See All <ChevronRight size={16} />
                        </button>
                    </div>

                    {loading ? (
                        <div className="grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-4">
                            {[1, 2, 3, 4].map(i => <SkeletonCard key={i} />)}
                        </div>
                    ) : trendingVideos.length > 0 ? (
                        <div className="grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-4">
                            {trendingVideos.slice(0, 8).map((video, i) => (
                                <VideoCard
                                    key={video.id}
                                    video={video}
                                    index={i}
                                    onClick={() => navigate(`/player/${video.id}`)}
                                />
                            ))}
                        </div>
                    ) : (
                        <div className="grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-4">
                            {allVideos.slice(0, 4).map((video, i) => (
                                <VideoCard
                                    key={video.id}
                                    video={video}
                                    index={i}
                                    onClick={() => navigate(`/player/${video.id}`)}
                                />
                            ))}
                            {allVideos.length === 0 && (
                                <div className="col-span-full text-center p-8 bg-white/[0.03] rounded-2xl border border-white/5">
                                    <Play size={36} className="mx-auto mb-3 text-gray-600" />
                                    <p className="text-gray-500 text-sm">No trending content yet</p>
                                </div>
                            )}
                        </div>
                    )}
                </section>

                {/* ── Recommended For You ── */}
                <section className="mb-10">
                    <div className="flex justify-between items-center mb-4">
                        <h2 className="text-xl font-bold text-white flex items-center gap-2">
                            <Sparkles size={20} color="#a267ff" /> Recommended For You
                        </h2>
                    </div>

                    {loading ? (
                        <div className="grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-4">
                            {[1, 2, 3, 4].map(i => <SkeletonCard key={i} />)}
                        </div>
                    ) : recommendedVideos.length > 0 ? (
                        <div className="grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-4">
                            {recommendedVideos.slice(0, 8).map((video, i) => (
                                <VideoCard
                                    key={video.id}
                                    video={video}
                                    index={i}
                                    onClick={() => navigate(`/player/${video.id}`)}
                                />
                            ))}
                        </div>
                    ) : (
                        <div className="grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-4">
                            {allVideos.slice(0, 8).map((video, i) => (
                                <VideoCard
                                    key={video.id}
                                    video={video}
                                    index={i}
                                    onClick={() => navigate(`/player/${video.id}`)}
                                />
                            ))}
                            {allVideos.length === 0 && (
                                <div className="col-span-full text-center p-8 bg-white/[0.03] rounded-2xl border border-white/5">
                                    <Sparkles size={36} className="mx-auto mb-3 text-gray-600" />
                                    <p className="text-gray-500 text-sm">Content recommendations will appear as you browse</p>
                                </div>
                            )}
                        </div>
                    )}
                </section>
            </div>
        </div>
    );
}
