// FILE: /video-platform/client-web/src/pages/Profile.tsx
/**
 * Nexus Video - 个人主页
 * 
 * URL: #/profile/:address
 * 功能...
 * - 展示用户作品（视...音乐/文章/直播/NFT...
 * - 关注/取关按钮
 * - 点击头像区域跳转，Follow按钮单独响应
 * - Cyberpunk 风格
 */

import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { getApiClient } from "../lib/apiClient";
import type { VideoMeta } from "@video-platform/shared/types";
import { VideoCard } from "../components/VideoCard";
import { Settings, Film, Music2, BookOpen, Radio, Gem, Megaphone, Coins, Sparkles } from "lucide-react";

const client = getApiClient();

interface UserProfile {
    address: string;
    displayName?: string;
    bio?: string;
    avatar?: string;
    followers: number;
    following: number;
    totalViews: number;
    id?: string;
    totalEarnings?: string;
    createdAt?: string;
}

type TabType = "videos" | "music" | "articles" | "live" | "nfts" | "activity" | "earnings";

export default function Profile() {
    const { address } = useParams<{ address: string }>();
    const navigate = useNavigate();

    const jwt = typeof window !== 'undefined' ? sessionStorage.getItem('vp.jwt') : null;
    const currentUser = typeof window !== 'undefined' ? (() => { try { return JSON.parse(sessionStorage.getItem('vp.user') || '{}'); } catch { return {}; } })() : {};
    if (jwt) client.setJWT(jwt);

    const [profile, setProfile] = useState<UserProfile | null>(null);
    const [videos, setVideos] = useState<VideoMeta[]>([]);
    const [musicList, setMusicList] = useState<any[]>([]);
    const [articleList, setArticleList] = useState<any[]>([]);
    const [liveRooms, setLiveRooms] = useState<any[]>([]);
    const [nfts, setNfts] = useState<any[]>([]);
    const [activeTab, setActiveTab] = useState<TabType>("videos");
    const [isFollowing, setIsFollowing] = useState(false);
    const [loading, setLoading] = useState(true);
    const [isOwnProfile, setIsOwnProfile] = useState(false);

    useEffect(() => {
        if (address) {
            fetchProfile();
        }
    }, [address]);

    const fetchProfile = async () => {
        setLoading(true);
        try {
            setIsOwnProfile(currentUser?.ckbAddress === address);

            const profileRes = await client.get<UserProfile>(
                `/user/profile/${address}`
            ).catch(() => ({
                address: address!,
                followers: 0,
                following: 0,
                totalViews: 0,
            }));
            setProfile(profileRes);

            // Check follow status (only if logged in and not own profile)
            if (jwt && currentUser?.id && currentUser?.ckbAddress !== address) {
                client.get<{ isFollowing: boolean }>(`/metadata/bonds/${currentUser.id}?targetAddress=${address}`)
                    .then(res => setIsFollowing(!!res?.isFollowing))
                    .catch(() => { });
            }

            // Fetch videos
            const videosRes = await client.get<{ videos: VideoMeta[] }>(
                `/metadata/creator-videos?creator=${address}`
            ).catch(() => ({ videos: [] }));
            setVideos(videosRes.videos || []);

            // Fetch music (fire-and-forget)
            client.get<{ items: any[] }>(`/content/music?creator=${address}`)
                .then(r => setMusicList(r.items || []))
                .catch(() => setMusicList([]));

            // Fetch articles
            client.get<{ items: any[] }>(`/content/articles?creator=${address}`)
                .then(r => setArticleList(r.items || []))
                .catch(() => setArticleList([]));

            // Fetch live rooms
            client.get<{ rooms: any[] }>(`/api/live/rooms?creator=${address}`)
                .then(r => setLiveRooms(r.rooms || []))
                .catch(() => setLiveRooms([]));

            // Fetch NFTs
            client.get<{ collections: any[] }>(`/user/nfts/${address}`)
                .then(r => setNfts(r.collections || []))
                .catch(() => setNfts([]));

        } catch (e) {
            console.error("Failed to fetch profile:", e);
        } finally {
            setLoading(false);
        }
    };

    const handleFollow = async () => {
        if (!jwt) { navigate('/login'); return; }
        const prev = isFollowing;
        setIsFollowing(!prev);
        if (profile) {
            setProfile({
                ...profile,
                followers: profile.followers + (prev ? -1 : 1),
            });
        }
        try {
            if (prev) {
                await client.post(`/metadata/unfollow`, { targetId: (profile as any)?.id, targetAddress: address });
            } else {
                await client.post(`/metadata/follow`, { targetId: (profile as any)?.id, targetAddress: address });
            }
        } catch {
            // Rollback on error
            setIsFollowing(prev);
            if (profile) {
                setProfile({
                    ...profile,
                    followers: profile.followers,
                });
            }
        }
    };

    const formatNumber = (n: number): string => {
        if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
        if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
        return n.toString();
    };

    const formatAddress = (addr: string): string => {
        return `${addr.slice(0, 8)}...${addr.slice(-6)}`;
    };

    if (loading) {
        return (
            <div style={{ minHeight: "100vh" }}>
                <div style={{ textAlign: "center", paddingTop: 100 }}>
                    <div className="animate-spin w-8 h-8 border-2 border-cyan-400 border-t-transparent rounded-full mx-auto" />
                    <p className="text-gray-400 text-sm mt-4">加载.....</p>
                </div>
            </div>
        );
    }

    const TABS = [
        { id: 'videos' as TabType, label: `Videos (${videos.length})`, icon: Film },
        { id: 'music' as TabType, label: `Music (${musicList.length})`, icon: Music2 },
        { id: 'articles' as TabType, label: `Articles (${articleList.length})`, icon: BookOpen },
        { id: 'live' as TabType, label: `Live (${liveRooms.length})`, icon: Radio },
        { id: 'nfts' as TabType, label: `NFTs (${nfts.length})`, icon: Gem },
        { id: 'activity' as TabType, label: 'Activity', icon: Megaphone },
        ...(isOwnProfile ? [{ id: 'earnings' as TabType, label: 'Earnings', icon: Coins }] : []),
    ];

    return (
        <div className="min-h-full text-gray-200 relative flex flex-col font-sans antialiased pb-20">
            {/* Hero Glow */}
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[80vw] h-[30vh] bg-[radial-gradient(ellipse_at_top,rgba(168,85,247,0.15)_0%,transparent_70%)] blur-[60px] pointer-events-none z-0"></div>

            <div className="flex-1 max-w-6xl mx-auto w-full px-4 py-8 relative z-10 flex flex-col gap-8">

                {/* Profile Header */}
                <div className="bg-[#0A0A14]/60 backdrop-blur-xl border border-white/5 rounded-2xl p-8 flex flex-col md:flex-row items-center md:items-start gap-8 relative overflow-hidden group border-t-purple-500/30">
                    <div className="absolute inset-0 bg-gradient-to-r from-purple-500/10 to-transparent opacity-50 pointer-events-none"></div>

                    <div className="relative z-10 shrink-0">
                        <div className="absolute -inset-1.5 rounded-full bg-[conic-gradient(from_0deg,#22d3ee,#a855f7,#ec4899,#22d3ee)] animate-[spin_4s_linear_infinite] blur-[10px] opacity-50 z-[-1]"></div>
                        <div className="w-32 h-32 rounded-full border-2 border-purple-500/50 overflow-hidden bg-black/50 flex items-center justify-center text-4xl text-white font-bold">
                            {profile?.avatar ? (
                                <img src={profile.avatar} alt="avatar" className="w-full h-full object-cover" />
                            ) : (
                                <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-purple-500 to-cyan-400 text-4xl font-bold text-white">
                                    {address?.slice(2, 4).toUpperCase()}
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="flex-1 text-center md:text-left z-10">
                        <h1 className="text-4xl font-bold mb-2 text-white font-display tracking-wide flex items-center gap-3 justify-center md:justify-start">
                            {profile?.displayName || formatAddress(address || "")}
                            <span className="text-[10px] bg-cyan-400/20 text-cyan-400 border border-cyan-400/40 px-2 py-0.5 rounded uppercase tracking-widest font-sans">Verified</span>
                        </h1>
                        <p className="text-gray-400 text-sm md:text-base mb-4 font-light">
                            {profile?.bio || "Digital creator exploring the Nexus."}
                        </p>

                        <div className="flex items-center justify-center md:justify-start gap-4 text-sm text-gray-400 font-mono mb-4">
                            <span className="bg-white/5 px-3 py-1 rounded border border-white/10 flex items-center gap-2">
                                <span className="w-2 h-2 rounded-full bg-cyan-400"></span> {formatAddress(address || "")}
                            </span>
                            <span>Joined 2024</span>
                        </div>

                        <div className="flex gap-6 justify-center md:justify-start text-sm">
                            <div><span className="font-bold text-white text-lg">{formatNumber(profile?.followers || 0)}</span> <span className="text-gray-500 uppercase tracking-widest text-[10px]">Followers</span></div>
                            <div><span className="font-bold text-white text-lg">{formatNumber(profile?.following || 0)}</span> <span className="text-gray-500 uppercase tracking-widest text-[10px]">Following</span></div>
                            <div><span className="font-bold text-white text-lg">{formatNumber(profile?.totalViews || 0)}</span> <span className="text-gray-500 uppercase tracking-widest text-[10px]">Views</span></div>
                        </div>
                    </div>

                    <div className="flex flex-col gap-3 z-10 min-w-[150px] w-full md:w-auto mt-4 md:mt-0">
                        {isOwnProfile ? (
                            <button className="bg-white/10 hover:bg-white/20 border border-white/20 text-white flex items-center justify-center gap-2 px-6 py-3 rounded-xl font-bold transition-all uppercase tracking-widest text-xs" onClick={() => navigate("/user")} aria-label="Edit Profile">
                                <Settings size={16} /> <span>Edit Profile</span>
                            </button>
                        ) : (
                            <button
                                className={`flex items-center justify-center gap-2 px-8 py-3 rounded-xl font-bold transition-all uppercase tracking-widest text-xs ${isFollowing ? "bg-transparent border border-cyan-400 text-cyan-400 hover:bg-cyan-400/10" : "bg-cyan-400 text-black shadow-[0_0_20px_rgba(34,211,238,0.4)] hover:bg-cyan-300"}`}
                                onClick={handleFollow}
                            >
                                {isFollowing ? "...Following" : "+ Follow"}
                            </button>
                        )}
                        <button className="bg-white/5 hover:bg-white/10 border border-white/10 text-gray-400 hover:text-white p-3 rounded-xl transition-colors flex justify-center items-center">
                            <Megaphone size={18} />
                        </button>
                    </div>
                </div>

                {/* Tabs */}
                <div className="flex gap-2 mb-6 border-b border-white/10 pb-4 overflow-x-auto custom-scrollbar">
                    {TABS.map(tab => (
                        <button
                            key={tab.id}
                            className={`flex items-center gap-2 px-6 py-2.5 rounded-full text-sm font-bold uppercase tracking-widest transition-all duration-300 whitespace-nowrap ${activeTab === tab.id ? "bg-purple-500/20 text-purple-400 border border-purple-500/50 shadow-[0_0_15px_rgba(168,85,247,0.2)]" : "text-gray-500 hover:text-white hover:bg-white/5 border border-transparent"}`}
                            onClick={() => setActiveTab(tab.id)}
                        >
                            <tab.icon size={16} /> {tab.label}
                        </button>
                    ))}
                </div>

                {/* Tab Content */}
                <div className="w-full">
                    {activeTab === "videos" && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
                            {videos.length === 0 ? (
                                <div className="col-span-full py-16 text-center bg-[#0A0A14]/60 backdrop-blur-xl border border-white/5 rounded-2xl flex flex-col items-center">
                                    <div className="text-4xl mb-4 opacity-50">🎬</div>
                                    <p className="text-gray-500 text-sm mb-6">No videos yet.</p>
                                    {isOwnProfile && (
                                        <button className="bg-cyan-400 text-black hover:bg-cyan-300 px-6 py-3 rounded-xl font-bold uppercase tracking-widest text-xs flex items-center gap-2 transition-colors" onClick={() => navigate("/creator/upload")}>
                                            <Sparkles size={16} /> Upload Video
                                        </button>
                                    )}
                                </div>
                            ) : (
                                videos.map((video) => (
                                    <VideoCard key={video.id} video={video} onClick={() => navigate(`/player/${video.id}`)} />
                                ))
                            )}
                        </div>
                    )}

                    {activeTab === "music" && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
                            {musicList.length === 0 ? (
                                <div className="col-span-full py-16 text-center bg-[#0A0A14]/60 backdrop-blur-xl border border-white/5 rounded-2xl flex flex-col items-center">
                                    <div className="text-4xl mb-4 opacity-50">🎵</div>
                                    <p className="text-gray-500 text-sm">No music uploaded yet.</p>
                                </div>
                            ) : (
                                musicList.map((m: any) => (
                                    <div key={m.id} className="glass-panel rounded-2xl border border-white/5 overflow-hidden hover:border-purple-500/30 cursor-pointer transition-all group" onClick={() => navigate(`/music`)}>
                                        <div className="aspect-square bg-gradient-to-br from-purple-500/20 to-pink-500/20 flex items-center justify-center">
                                            <Music2 size={48} className="text-purple-400 opacity-50" />
                                        </div>
                                        <div className="p-4">
                                            <h4 className="text-white font-bold truncate">{m.title}</h4>
                                            <p className="text-xs text-gray-400">{m.artist || 'Unknown'}</p>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    )}

                    {activeTab === "articles" && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
                            {articleList.length === 0 ? (
                                <div className="col-span-full py-16 text-center bg-[#0A0A14]/60 backdrop-blur-xl border border-white/5 rounded-2xl flex flex-col items-center">
                                    <div className="text-4xl mb-4 opacity-50">📝</div>
                                    <p className="text-gray-500 text-sm">No articles published yet.</p>
                                </div>
                            ) : (
                                articleList.map((a: any) => (
                                    <div key={a.id} className="glass-panel rounded-2xl border border-white/5 overflow-hidden hover:border-cyan-500/30 cursor-pointer transition-all p-6" onClick={() => navigate(`/articles`)}>
                                        <h4 className="text-white font-bold mb-2">{a.title}</h4>
                                        <p className="text-sm text-gray-400 line-clamp-3">{a.summary || a.content?.slice(0, 150) || ''}</p>
                                        <div className="mt-3 text-xs text-gray-500">{a.views || 0} views</div>
                                    </div>
                                ))
                            )}
                        </div>
                    )}

                    {activeTab === "live" && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
                            {liveRooms.length === 0 ? (
                                <div className="col-span-full py-16 text-center bg-[#0A0A14]/60 backdrop-blur-xl border border-white/5 rounded-2xl flex flex-col items-center">
                                    <div className="text-4xl mb-4 opacity-50">📡</div>
                                    <p className="text-gray-500 text-sm">No live rooms yet.</p>
                                    {isOwnProfile && (
                                        <button className="mt-4 bg-red-500 text-white hover:bg-red-400 px-6 py-3 rounded-xl font-bold uppercase tracking-widest text-xs flex items-center gap-2 transition-colors" onClick={() => navigate("/room/create")}>
                                            <Radio size={16} /> Go Live
                                        </button>
                                    )}
                                </div>
                            ) : (
                                liveRooms.map((room: any) => (
                                    <div key={room.id || room.roomId} className="glass-panel rounded-2xl border border-white/5 overflow-hidden hover:border-red-500/30 cursor-pointer transition-all" onClick={() => navigate(`/live/${room.id || room.roomId}`)}>
                                        <div className="aspect-video bg-gradient-to-br from-red-500/10 to-orange-500/10 flex items-center justify-center relative">
                                            {room.coverUrl && <img src={room.coverUrl} className="w-full h-full object-cover absolute inset-0" />}
                                            {room.status === 'live' && <span className="absolute top-3 left-3 bg-red-500 text-white px-2 py-0.5 rounded text-[10px] font-bold">LIVE</span>}
                                            <Radio size={32} className="text-red-400 opacity-50 relative z-10" />
                                        </div>
                                        <div className="p-4">
                                            <h4 className="text-white font-bold truncate">{room.title}</h4>
                                            <p className="text-xs text-gray-400">{room.viewerCount || 0} viewers</p>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    )}

                    {activeTab === "nfts" && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
                            {nfts.length === 0 ? (
                                <div className="col-span-full py-16 text-center bg-[#0A0A14]/60 backdrop-blur-xl border border-white/5 rounded-2xl flex flex-col items-center">
                                    <div className="text-4xl mb-4 opacity-50">💎</div>
                                    <p className="text-gray-500 text-sm">No content NFTs yet.</p>
                                    {isOwnProfile && (
                                        <button className="mt-4 bg-purple-500 text-white hover:bg-purple-400 px-6 py-3 rounded-xl font-bold uppercase tracking-widest text-xs flex items-center gap-2 transition-colors" onClick={() => navigate("/creator/nft")}>
                                            <Gem size={16} /> Mint NFT
                                        </button>
                                    )}
                                </div>
                            ) : (
                                nfts.map((nft: any) => (
                                    <div key={nft.id} className="glass-panel rounded-2xl border border-purple-500/20 overflow-hidden hover:border-purple-500/50 cursor-pointer transition-all group"
                                        onClick={() => {
                                            if (nft.contentType === 'video') navigate(`/player/${nft.contentId}`);
                                            else if (nft.contentType === 'music') navigate(`/music`);
                                            else if (nft.contentType === 'article') navigate(`/articles`);
                                            else navigate(`/collection/${nft.id}`);
                                        }}>
                                        <div className="aspect-square bg-gradient-to-br from-purple-500/20 to-cyan-500/20 flex items-center justify-center relative">
                                            {nft.coverUrl && <img src={nft.coverUrl} className="w-full h-full object-cover absolute inset-0" />}
                                            <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                                            <Gem size={32} className="text-purple-400 opacity-50 relative z-10" />
                                            <span className="absolute top-2 right-2 bg-purple-500/80 text-white px-2 py-0.5 rounded text-[10px] font-bold uppercase z-10">SPORE NFT</span>
                                        </div>
                                        <div className="p-4">
                                            <h4 className="text-white font-bold truncate">{nft.name || nft.title || 'Untitled NFT'}</h4>
                                            <p className="text-xs text-gray-400 mt-1">
                                                {nft.contentType ? `${nft.contentType.charAt(0).toUpperCase() + nft.contentType.slice(1)} NFT` : 'Content NFT'}
                                                {nft.sporeId && <span className="ml-2 text-purple-400 font-mono">#{nft.sporeId.slice(0, 8)}</span>}
                                            </p>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    )}

                    {activeTab === "activity" && (
                        <div className="py-16 text-center bg-[#0A0A14]/60 backdrop-blur-xl border border-white/5 rounded-2xl">
                            <p className="text-gray-500 text-sm">No recent activity.</p>
                        </div>
                    )}

                    {activeTab === "earnings" && isOwnProfile && (
                        <div className="py-16 text-center bg-[#0A0A14]/60 backdrop-blur-xl border border-white/5 rounded-2xl flex flex-col items-center">
                            <div className="mb-2">
                                <span className="text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 to-yellow-600 drop-shadow-[0_0_15px_rgba(234,179,8,0.3)] font-mono">
                                    ${profile?.totalEarnings || "0.00"}
                                </span>
                            </div>
                            <span className="text-gray-500 uppercase tracking-widest text-xs font-bold mb-8">Total Earnings</span>
                            <button
                                className="bg-yellow-500 text-black hover:bg-yellow-400 px-6 py-3 rounded-xl font-bold uppercase tracking-widest text-xs flex items-center gap-2 transition-colors"
                                onClick={() => navigate("/points")}
                            >
                                <Gem size={16} /> Withdraw to Wallet
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
