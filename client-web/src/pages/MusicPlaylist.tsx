import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { getApiClient } from "../lib/apiClient";
import type { VideoMeta } from "@video-platform/shared/types";
import { Play, Pause, Search, Heart, GripVertical, MoreHorizontal, Plus, Disc, Music } from 'lucide-react';
import PaymentModeSelector from '../components/PaymentModeSelector';
import { usePayment } from '../hooks/usePayment';
import { useGlobalMusic } from '../contexts/GlobalMusicContext';
import type { GlobalTrack } from '../contexts/GlobalMusicContext';
import '../styles/fun.css';

const client = getApiClient();

export default function MusicPlaylist() {
    const navigate = useNavigate();
    const globalMusic = useGlobalMusic();
    const [tracks, setTracks] = useState<VideoMeta[]>([]);
    const [loading, setLoading] = useState(true);
    const [currentTrack, setCurrentTrack] = useState<VideoMeta | null>(null);

    // Payment State
    const [needPurchase, setNeedPurchase] = useState(false);
    const [payStatus, setPayStatus] = useState("");
    const [showPaymentChoice, setShowPaymentChoice] = useState(false);
    const [pendingTrack, setPendingTrack] = useState<VideoMeta | null>(null);
    const streamHandlerRef = useRef<any>(null);

    // Context synchronization
    useEffect(() => {
        if (tracks.length > 0) {
            const globalPlaylist = tracks.map(t => ({
                id: t.id,
                title: t.title,
                artist: t.description || t.creatorBitDomain || 'Unknown',
                coverUrl: t.posterUrl,
                audioUrl: t.cdnUrl,
            }));
            globalMusic.setPlaylist(globalPlaylist);
        }
    }, [tracks]);

    useEffect(() => {
        // Sync current track from global context if playing
        if (globalMusic.currentTrack) {
            const match = tracks.find(t => t.id === globalMusic.currentTrack?.id);
            if (match) setCurrentTrack(match);
        }
    }, [globalMusic.currentTrack, tracks]);

    // Initialize & Fetch
    useEffect(() => {
        const jwt = typeof window !== "undefined" ? sessionStorage.getItem("vp.jwt") : null;
        if (jwt) client.setJWT(jwt);

        setLoading(true);
        client.get<VideoMeta[]>(`/metadata/list?type=audio`)
            .then(res => {
                let list: VideoMeta[] = [];
                if (Array.isArray(res)) list = res;
                const final = list.length > 0 ? list : getFallbackMusic();
                const unique = Array.from(new Map(final.map(item => [item.id, item])).values());
                setTracks(unique);
            })
            .catch(console.warn)
            .finally(() => setLoading(false));

        return () => {
            if (streamHandlerRef.current) streamHandlerRef.current.cleanup();
        };
    }, []);

    // Fallback Data duplicated carefully to preserve original mock behavior
    function getFallbackMusic() {
        return [
            {
                id: "jw-1",
                title: "I Want To Destroy Something Beautiful",
                description: "Josh Woodward",
                creatorBitDomain: "josh.bit",
                creatorCkbAddress: "0x0", priceUSDI: "0", durationSeconds: 200,
                cdnUrl: "https://www.joshwoodward.com/mp3/JoshWoodward-IWantToDestroySomethingBeautiful.mp3",
                posterUrl: "https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=400&q=80",
                createdAt: new Date().toISOString()
            },
            {
                id: "os-1",
                title: "Impact Moderato",
                description: "Kevin MacLeod - Open Source",
                creatorBitDomain: "kevin.bit",
                creatorCkbAddress: "0x0", priceUSDI: "0", durationSeconds: 180,
                cdnUrl: "https://incompetech.com/music/royalty-free/mp3-royaltyfree/Impact%20Moderato.mp3",
                posterUrl: "https://images.unsplash.com/photo-1493225255756-d9584f8606e9?w=400&q=80",
                createdAt: new Date().toISOString()
            },
            {
                id: "os-2",
                title: "Lofi Study Session",
                description: "Relaxing Beats",
                creatorBitDomain: "chill.bit",
                creatorCkbAddress: "0x0", priceUSDI: "0", durationSeconds: 240,
                cdnUrl: "https://files.freemusicarchive.org/storage-freemusicarchive-org/music/ccCommunity/Chad_Crouch/Arps/Chad_Crouch_-_Elisions.mp3",
                posterUrl: "https://images.unsplash.com/photo-1514525253440-b393452e8d2e?w=400&q=80",
                createdAt: new Date().toISOString()
            },
            {
                id: "cn-1",
                title: "Mojito (Demo Version)",
                description: "Jay Chou",
                creatorBitDomain: "jaychou.bit",
                creatorCkbAddress: "0x0", priceUSDI: "10", durationSeconds: 185,
                cdnUrl: "https://www.joshwoodward.com/mp3/JoshWoodward-IWantToDestroySomethingBeautiful.mp3",
                posterUrl: "https://images.unsplash.com/photo-1535905557558-afc4877a26fc?w=400&q=80",
                createdAt: new Date().toISOString(),
                pointsPrice: 50,
                priceMode: 'both' as const,
                streamPricePerMinute: 10
            },
            {
                id: "cn-2",
                title: "Neon Streets",
                description: "CyberSynth",
                creatorBitDomain: "cyber.bit",
                creatorCkbAddress: "0x0", priceUSDI: "0", durationSeconds: 250,
                cdnUrl: "https://incompetech.com/music/royalty-free/mp3-royaltyfree/Impact%20Moderato.mp3",
                posterUrl: "https://images.unsplash.com/photo-1506744038136-46273834b3fb?w=400&q=80",
                createdAt: new Date().toISOString()
            }
        ] as VideoMeta[];
    }

    // Payment Hook Integration
    const payment = usePayment({
        contentId: pendingTrack?.id || currentTrack?.id || '',
        contentType: 'music',
        buyOncePrice: (pendingTrack as any)?.pointsPrice || 50,
        streamPricePerMinute: (pendingTrack as any)?.streamPricePerMinute || 1,
        priceMode: (() => {
            const t = pendingTrack as any;
            if (!t) return 'free' as const;
            if (t.priceMode) return t.priceMode;
            const hasPoints = (t.pointsPrice || 0) > 0;
            const hasStream = (t.streamPricePerMinute || 0) > 0;
            if (hasPoints && hasStream) return 'both' as const;
            if (hasStream) return 'stream' as const;
            if (hasPoints) return 'buy_once' as const;
            return 'free' as const;
        })(),
        durationSeconds: pendingTrack?.durationSeconds || 180,
        onBuyOnceSuccess: () => {
            setNeedPurchase(false);
            setPayStatus('Payment Successful! Unlocking...');
            setTimeout(() => {
                setPayStatus('');
                if (pendingTrack) playTrack(pendingTrack);
            }, 1000);
        },
        onStreamStarted: (handler) => {
            streamHandlerRef.current = handler;
            setNeedPurchase(false);
            // Link global player adapter if needed, usually handled globally now,
            // but we signal the UI to proceed:
            if (pendingTrack) playTrack(pendingTrack);
        },
        onStreamPause: () => {
            if (globalMusic.isPlaying) globalMusic.togglePlay();
        },
        onStatusChange: (msg) => setPayStatus(msg),
        enabled: !!pendingTrack,
    });

    const handleTrackClick = (track: VideoMeta) => {
        const isPointsPrice = track.pointsPrice && track.pointsPrice > 0;
        const priceMode = (track as any).priceMode || 'free';
        const isFree = !isPointsPrice && priceMode === 'free';

        if (isFree) {
            playTrack(track);
        } else {
            const jwt = typeof window !== 'undefined' ? sessionStorage.getItem('vp.jwt') : null;
            if (!jwt) {
                alert('Please login first to access premium content.');
                navigate('/login');
                return;
            }
            setPendingTrack(track);
            setShowPaymentChoice(true);
        }
    };

    const playTrack = (track: VideoMeta) => {
        setCurrentTrack(track);
        // Dispatch to Global Player
        const globalTrack: GlobalTrack = {
            id: track.id,
            title: track.title,
            artist: track.description || track.creatorBitDomain || 'Unknown',
            coverUrl: track.posterUrl,
            audioUrl: track.cdnUrl,
        };
        const globalPlaylist = tracks.map(t => ({
            id: t.id,
            title: t.title,
            artist: t.description || t.creatorBitDomain || 'Unknown',
            coverUrl: t.posterUrl,
            audioUrl: t.cdnUrl,
        }));
        globalMusic.loadTrack(globalTrack, globalPlaylist);
        // Play automatically
        setTimeout(() => globalMusic.playTrack(), 100);
    };

    const processPayment = async (type: 'buy_once' | 'stream') => {
        setShowPaymentChoice(false);
        if (type === 'buy_once') {
            await payment.handleBuyOnce();
        } else {
            await payment.handleStartStream();
        }
    };

    const renderPaymentChoiceModal = () => {
        if (!showPaymentChoice || !pendingTrack) return null;
        const videoForSelector = {
            ...pendingTrack,
            buyOncePrice: pendingTrack.pointsPrice || (pendingTrack as any).buyOncePrice || 50,
            streamPricePerMinute: (pendingTrack as any).streamPricePerMinute || 1,
            priceMode: (pendingTrack as any).priceMode || 'buy_once',
        };

        return (
            <PaymentModeSelector
                video={videoForSelector}
                onSelect={(mode) => {
                    if (mode === 'buy_once') processPayment('buy_once');
                    else if (mode === 'stream') processPayment('stream');
                    else setShowPaymentChoice(false);
                }}
                onClose={() => setShowPaymentChoice(false)}
            />
        );
    };

    return (
        <div className="relative min-h-screen bg-[#0a0a12] text-[#e5e5e5] pb-32 pt-8 px-6 md:px-10 lg:px-16" style={{ fontFamily: "'Inter', sans-serif" }}>
            {/* Ambient Lighting */}
            <div className="fixed top-0 left-0 w-[500px] h-[500px] bg-nexusPurple/10 rounded-full blur-[120px] pointer-events-none z-0" />
            <div className="fixed bottom-0 right-0 w-[600px] h-[600px] bg-nexusCyan/5 rounded-full blur-[150px] pointer-events-none z-0" />

            {/* Header */}
            <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center mb-10 gap-4">
                <h1 className="text-4xl md:text-5xl font-black tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-nexusPurple via-white to-nexusCyan drop-shadow-[0_0_10px_rgba(168,85,247,0.4)]">
                    MY PLAYLISTS
                </h1>

                <div className="flex gap-4 items-center">
                    <div className="relative w-64 group hidden md:block">
                        <Search size={16} className="text-gray-400 absolute left-3 top-1/2 -translate-y-1/2 group-focus-within:text-nexusPurple transition-colors" />
                        <input
                            type="text"
                            placeholder="Dig for tracks..."
                            className="w-full bg-[rgba(255,255,255,0.05)] border border-white/10 rounded-full py-2 pl-10 pr-4 text-sm text-white focus:outline-none focus:border-nexusPurple/50 focus:bg-[rgba(255,255,255,0.1)] transition-all placeholder:text-gray-500"
                        />
                    </div>
                </div>
            </div>

            <div className="relative z-10 grid grid-cols-1 xl:grid-cols-3 gap-8">
                {/* Left Panel: Playlist (65%) */}
                <div className="xl:col-span-2">
                    <div className="bg-[rgba(255,255,255,0.02)] backdrop-blur-md rounded-2xl border border-[rgba(255,255,255,0.05)] shadow-[0_8px_32px_0_rgba(0,0,0,0.36)] overflow-hidden">

                        {/* Playlist Header */}
                        <div className="p-8 border-b border-[rgba(255,255,255,0.05)] flex items-end gap-6 bg-gradient-to-b from-nexusPurple/10 to-transparent">
                            <div className="w-32 h-32 rounded-lg shadow-2xl overflow-hidden border border-white/10 relative group bg-[#111] flex items-center justify-center">
                                {tracks.length > 0 && tracks[0].posterUrl ? (
                                    <img src={tracks[0].posterUrl} alt="Cover" className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                                ) : (
                                    <Music size={40} className="text-white/20" />
                                )}
                                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-all cursor-pointer" onClick={() => tracks.length > 0 && handleTrackClick(tracks[0])}>
                                    <div className="w-12 h-12 rounded-full bg-nexusPurple text-white flex items-center justify-center">
                                        <Play size={20} fill="currentColor" className="ml-1" />
                                    </div>
                                </div>
                            </div>
                            <div className="flex-1">
                                <span className="text-xs font-bold text-gray-400 tracking-widest uppercase mb-1 block">Public Playlist</span>
                                <h2 className="text-4xl font-black text-white mb-2">Synthwave Nights</h2>
                                <p className="text-sm text-gray-400">Curated by Nexus • {tracks.length} tracks • {Math.floor(tracks.reduce((acc, t) => acc + (t.durationSeconds || 180), 0) / 60)} minutes</p>
                            </div>
                        </div>

                        {/* List Headers */}
                        <div className="px-8 py-4 grid grid-cols-[40px_minmax(200px,1fr)_minmax(150px,2fr)_80px_80px] text-xs font-bold text-gray-500 uppercase tracking-widest border-b border-[rgba(255,255,255,0.05)] sticky top-0 bg-[#0a0a12]/90 backdrop-blur z-20">
                            <div className="text-center">#</div>
                            <div>TITLE</div>
                            <div className="hidden sm:block">ARTIST</div>
                            <div className="text-center">TIME</div>
                            <div className="text-center"></div>
                        </div>

                        {/* Track List */}
                        <div className="p-2">
                            {loading ? (
                                <div className="p-8 text-center text-nexusPurple animate-pulse font-mono">Loading tracks...</div>
                            ) : tracks.length === 0 ? (
                                <div className="p-12 text-center text-gray-500">No tracks found.</div>
                            ) : (
                                tracks.map((track, idx) => {
                                    const isCurrent = globalMusic.currentTrack?.id === track.id;
                                    const isPremium = (track as any).pointsPrice > 0 || parseFloat(track.priceUSDI || '0') > 0;

                                    return (
                                        <div
                                            key={track.id}
                                            className={`group grid grid-cols-[40px_minmax(200px,1fr)_minmax(150px,2fr)_80px_80px] items-center py-3 px-6 rounded-xl transition-all cursor-pointer ${isCurrent ? 'bg-nexusPurple/10 border border-nexusPurple/30' : 'hover:bg-white/5 border border-transparent'}`}
                                            onClick={() => handleTrackClick(track)}
                                        >
                                            {/* ID or Grip */}
                                            <div className="text-center text-gray-500 relative flex justify-center w-full">
                                                <span className={`${isCurrent ? 'text-nexusPurple' : 'group-hover:hidden'}`}>{isCurrent ? <Music size={14} className="animate-pulse" /> : idx + 1}</span>
                                                <div className="hidden group-hover:flex absolute inset-0 text-white items-center justify-center">
                                                    <Play size={14} fill="currentColor" />
                                                </div>
                                            </div>

                                            {/* Title & Cover */}
                                            <div className="flex items-center gap-4 flex-1 min-w-0 pr-4 pl-2">
                                                <img src={track.posterUrl || 'https://images.unsplash.com/photo-1614149162883-504ce4d13909?q=80&w=40'} className="w-10 h-10 rounded shadow-md object-cover" alt="Track Cover" />
                                                <div className="flex flex-col truncate">
                                                    <span className={`font-bold text-sm truncate ${isCurrent ? 'text-nexusCyan drop-shadow-[0_0_8px_rgba(34,211,238,0.5)]' : 'text-white group-hover:text-nexusPurple transition-colors'}`}>
                                                        {track.title}
                                                    </span>
                                                    {isPremium && <span className="text-[9px] text-yellow-500 font-mono mt-0.5 border border-yellow-500/30 px-1 rounded w-fit uppercase">Premium</span>}
                                                </div>
                                            </div>

                                            {/* Artist */}
                                            <div className="hidden sm:block text-sm text-gray-400 truncate pr-4 hover:text-white transition-colors">{track.description || track.creatorBitDomain}</div>

                                            {/* Duration */}
                                            <div className="text-sm text-gray-400 text-center font-mono">{Math.floor((track.durationSeconds || 180) / 60)}:{String((track.durationSeconds || 180) % 60).padStart(2, '0')}</div>

                                            {/* Actions */}
                                            <div className="flex items-center justify-center gap-4">
                                                <button onClick={(e) => { e.stopPropagation(); }} className="text-gray-500 hover:text-nexusPink transition-colors opacity-0 group-hover:opacity-100 flex items-center justify-center">
                                                    <Heart size={16} />
                                                </button>
                                                <button onClick={(e) => { e.stopPropagation(); }} className="text-gray-500 hover:text-white transition-colors opacity-0 group-hover:opacity-100 flex items-center justify-center">
                                                    <MoreHorizontal size={16} />
                                                </button>
                                            </div>
                                        </div>
                                    )
                                })
                            )}

                            <button className="w-full mt-4 py-4 rounded-xl border border-dashed border-white/20 text-gray-400 hover:text-nexusCyan hover:border-nexusCyan/50 hover:bg-nexusCyan/5 transition-all flex items-center justify-center gap-2 font-bold text-sm">
                                <Plus size={18} /> Add Track to Playlist
                            </button>
                        </div>
                    </div>
                </div>

                {/* Right Panel: Daily Mix Cards (35%) */}
                <div className="xl:col-span-1 space-y-6">
                    <h3 className="font-black text-xl mb-6 text-white tracking-widest border-l-4 border-nexusPurple pl-3 drop-shadow-[0_0_8px_rgba(168,85,247,0.5)]">
                        DAILY MIXES
                    </h3>

                    {[
                        { title: 'Cyberpunk Focus', count: 42, color: 'from-[#ff003c]/30 to-[#00f0ff]/30', border: 'border-[#ff003c]/40 hover:border-[#00f0ff]', img: 'https://images.unsplash.com/photo-1555680202-c86f0e12f086?q=80&w=400' },
                        { title: 'Lo-Fi Chill', count: 18, color: 'from-[#a855f7]/30 to-[#ec4899]/30', border: 'border-nexusPurple/40 hover:border-nexusPink', img: 'https://images.unsplash.com/photo-1514525253440-b393452e8d2e?q=80&w=400' },
                        { title: 'Electronic Vibes', count: 25, color: 'from-[#22d3ee]/30 to-[#a855f7]/30', border: 'border-nexusCyan/40 hover:border-nexusPurple', img: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?q=80&w=400' }
                    ].map((mix, i) => (
                        <div key={i} className={`relative h-40 rounded-2xl overflow-hidden glass-panel border ${mix.border} group cursor-pointer transition-all duration-500 shadow-lg hover:shadow-[0_0_30px_rgba(168,85,247,0.3)] hover:-translate-y-1`}>
                            <div className={`absolute inset-0 bg-gradient-to-br ${mix.color} z-10 mix-blend-overlay`} />
                            <img src={mix.img} className="absolute inset-0 w-full h-full object-cover opacity-60 group-hover:scale-110 transition-transform duration-700" alt="Mix Cover" />
                            <div className="absolute inset-x-0 bottom-0 top-1/2 bg-gradient-to-t from-black/90 to-transparent z-10" />

                            <div className="relative z-20 h-full p-5 flex flex-col justify-end">
                                <h4 className="text-xl font-black text-white group-hover:text-transparent group-hover:bg-clip-text group-hover:bg-gradient-to-r group-hover:from-white group-hover:to-cyan-400 transition-all">{mix.title}</h4>
                                <p className="text-xs text-gray-300 font-mono mt-1">{mix.count} tracks</p>
                            </div>

                            <div className="absolute top-4 right-4 z-20 w-10 h-10 bg-white text-black rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transform translate-y-4 group-hover:translate-y-0 transition-all duration-300 shadow-[0_0_15px_rgba(255,255,255,0.5)]">
                                <Play size={18} fill="currentColor" className="ml-0.5" />
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {renderPaymentChoiceModal()}
        </div>
    );
}
