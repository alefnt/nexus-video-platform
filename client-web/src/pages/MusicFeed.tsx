import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { getApiClient } from "../lib/apiClient";
import type { VideoMeta } from "@video-platform/shared/types";
// TopNav removed - handled by AppLayout
import { Play, Pause, SkipBack, SkipForward, Disc, Music, Search, Mic2, X, Lock } from 'lucide-react';
import PaymentOverlay from '../components/PaymentOverlay';
import PaymentModeSelector from '../components/PaymentModeSelector';
import { usePayment } from '../hooks/usePayment';
import { useGlobalMusic } from '../contexts/GlobalMusicContext';
import type { GlobalTrack } from '../contexts/GlobalMusicContext';
import '../styles/fun.css';
import '../styles/music.css';

const client = getApiClient();

// Types
interface LrcLine {
    time: number;
    text: string;
}

// Helper to parse LRC format "[mm:ss.xx] Lyrics"
const parseLrc = (lrc: string): LrcLine[] => {
    const lines = lrc.split('\n');
    const result: LrcLine[] = [];
    const timeRegex = /\[(\d{2}):(\d{2})(\.\d{2,3})?\]/;

    for (const line of lines) {
        const match = line.match(timeRegex);
        if (match) {
            const min = parseInt(match[1]);
            const sec = parseInt(match[2]);
            const ms = match[3] ? parseFloat(match[3]) : 0;
            const time = min * 60 + sec + ms;
            const text = line.replace(timeRegex, '').trim();
            if (text) result.push({ time, text });
        }
    }
    return result;
};


// Lyrics will be fetched from content metadata (lyricsUrl or lyrics field)
// No more hardcoded mock lyrics data

export default function MusicFeed() {
    const navigate = useNavigate();
    const globalMusic = useGlobalMusic();
    const [tracks, setTracks] = useState<VideoMeta[]>([]);
    const [loading, setLoading] = useState(true);
    const [currentTrack, setCurrentTrack] = useState<VideoMeta | null>(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [currentTime, setCurrentTime] = useState(0);
    const [lrcLines, setLrcLines] = useState<LrcLine[]>([]);
    const audioRef = useRef<HTMLAudioElement>(null);

    // Payment State
    const [needPurchase, setNeedPurchase] = useState(false);
    const [payStatus, setPayStatus] = useState("");
    const [showPaymentOverlay, setShowPaymentOverlay] = useState(false);
    const streamHandlerRef = useRef<any>(null);

    // Filters & Search
    const [filterGenre, setFilterGenre] = useState("All");
    const [searchQ, setSearchQ] = useState("");

    // Pagination
    const PAGE_SIZE = 20;
    const [page, setPage] = useState(1);

    const GENRES = ["All", "Pop", "Rock", "Lo-Fi", "Jazz", "Electronic", "Classical", "Hip Hop", "R&B", "Podcast", "Audiobook", "AI Music"];

    // Push playlist to global context once tracks are loaded
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

    // Sync isPlaying and currentTime from global context
    useEffect(() => {
        setIsPlaying(globalMusic.isPlaying);
    }, [globalMusic.isPlaying]);

    useEffect(() => {
        setCurrentTime(globalMusic.currentTime);
    }, [globalMusic.currentTime]);

    // Initialize
    useEffect(() => {
        const jwt = typeof window !== "undefined" ? sessionStorage.getItem("vp.jwt") : null;
        if (jwt) client.setJWT(jwt);

        setLoading(true);
        const queryParams = new URLSearchParams();
        if (filterGenre !== "All") queryParams.append("tag", filterGenre);

        client.get<VideoMeta[]>(`/metadata/list?type=audio&${queryParams.toString()}`)
            .then(res => {
                // Client-side filtering
                let list: VideoMeta[] = [];
                if (Array.isArray(res)) {
                    list = res;
                }

                const final = list.length > 0 ? list : getFallbackMusic();
                const unique = Array.from(new Map(final.map(item => [item.id, item])).values());

                setTracks(unique);
                if (!currentTrack && unique.length > 0) {
                    // Don't auto load Lrc here to prevent early lock check
                    setCurrentTrack(unique[0]);
                    loadLrc(unique[0].id);
                }
            })
            .catch(console.warn)
            .finally(() => setLoading(false));

        return () => {
            if (streamHandlerRef.current) streamHandlerRef.current.cleanup();
        };
    }, [filterGenre]);

    // Reset page when filters change
    useEffect(() => {
        setPage(1);
    }, [filterGenre, searchQ]);

    // Update Lyrics when track changes
    useEffect(() => {
        if (currentTrack) {
            loadLrc(currentTrack.id);
        }
    }, [currentTrack]);

    const loadLrc = (trackId: string) => {
        // Lyrics would be loaded from track metadata (lyricsUrl field) in production
        // For now, show a no-lyrics message since we removed hardcoded mock lyrics
        setLrcLines([{ time: 0, text: "(Lyrics not available for this track)" }]);
    };

    // Fallback Data
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
                title: "Mojito",
                description: "Jay Chou",
                creatorBitDomain: "jaychou.bit",
                creatorCkbAddress: "0x0", priceUSDI: "10", durationSeconds: 185,
                cdnUrl: "https://www.joshwoodward.com/mp3/JoshWoodward-IWantToDestroySomethingBeautiful.mp3", // Mock URL
                posterUrl: "https://images.unsplash.com/photo-1535905557558-afc4877a26fc?w=400&q=80",
                createdAt: new Date().toISOString(),
                pointsPrice: 50,
                priceMode: 'both' as const,
                streamPricePerMinute: 10
            },
            {
                id: "cn-2",
                title: "夜空中最亮的...",
                description: "Escape Plan",
                creatorBitDomain: "escapeplan.bit",
                creatorCkbAddress: "0x0", priceUSDI: "0", durationSeconds: 250,
                cdnUrl: "https://incompetech.com/music/royalty-free/mp3-royaltyfree/Impact%20Moderato.mp3", // Mock URL
                posterUrl: "https://images.unsplash.com/photo-1506744038136-46273834b3fb?w=400&q=80",
                createdAt: new Date().toISOString()
            },
            {
                id: "cn-3",
                title: "情非得已",
                description: "Harlem Yu",
                creatorBitDomain: "harlem.bit",
                creatorCkbAddress: "0x0", priceUSDI: "5", durationSeconds: 215,
                cdnUrl: "https://files.freemusicarchive.org/storage-freemusicarchive-org/music/ccCommunity/Chad_Crouch/Arps/Chad_Crouch_-_Elisions.mp3", // Mock URL
                posterUrl: "https://images.unsplash.com/photo-1459749411177-0473ef716175?w=400&q=80",
                createdAt: new Date().toISOString(),
                pointsPrice: 20
            }
        ] as VideoMeta[];
    }

    // 统一支付 Hook
    const payment = usePayment({
        contentId: currentTrack?.id || '',
        contentType: 'music',
        buyOncePrice: (currentTrack as any)?.pointsPrice || 50,
        streamPricePerMinute: (currentTrack as any)?.streamPricePerMinute || 1,
        priceMode: (() => {
            const t = currentTrack as any;
            if (!t) return 'free' as const;
            if (t.priceMode) return t.priceMode;
            const hasPoints = (t.pointsPrice || 0) > 0;
            const hasStream = (t.streamPricePerMinute || 0) > 0;
            if (hasPoints && hasStream) return 'both' as const;
            if (hasStream) return 'stream' as const;
            if (hasPoints) return 'buy_once' as const;
            return 'free' as const;
        })(),
        durationSeconds: currentTrack?.durationSeconds || 180,
        onBuyOnceSuccess: () => {
            setNeedPurchase(false);
            setPayStatus('Payment Successful! Unlocking...');
            setTimeout(() => {
                setPayStatus('');
                enterPlayer(currentTrack!, true);
            }, 1000);
        },
        onStreamStarted: (handler) => {
            streamHandlerRef.current = handler;
            setNeedPurchase(false);
            // Audio adapter for StreamPaymentHandler
            const playerAdapter = {
                currentTime: (val?: number) => {
                    if (typeof val === 'number' && audioRef.current) {
                        audioRef.current.currentTime = val;
                        return;
                    }
                    return audioRef.current?.currentTime || 0;
                },
                duration: () => audioRef.current?.duration || 0,
                play: () => { setIsPlaying(true); audioRef.current?.play(); },
                pause: () => { setIsPlaying(false); audioRef.current?.pause(); },
                on: (event: string, cb: Function) => {
                    audioRef.current?.addEventListener(event, cb as any);
                },
                dispose: () => { }
            };
            handler.setPlayer(playerAdapter);
            enterPlayer(currentTrack!, true);
        },
        onStreamPause: () => {
            setIsPlaying(false);
            audioRef.current?.pause();
        },
        onStatusChange: (msg) => setPayStatus(msg),
        enabled: !!currentTrack,
    });


    // --- PAYMENT FLOW STATE ---
    const [pendingTrack, setPendingTrack] = useState<VideoMeta | null>(null);
    const [showPaymentChoice, setShowPaymentChoice] = useState(false);

    // --- VIEW STATE ---
    const [view, setView] = useState<'shelf' | 'player'>('shelf');

    // 1. CLICK HANDLER (Shelf -> Player/Payment)
    const handleVinylClick = (track: VideoMeta) => {
        // Updated logic: Check if paid content
        const isPointsPrice = track.pointsPrice && track.pointsPrice > 0;
        const priceMode = (track as any).priceMode || 'free'; // 'free', 'buy_once', 'stream', 'both'

        // Check if free or already unlocked (simplified check, real app would check API entitlement)
        // For demo: if priceMode is 'free' and no pointsPrice -> FREE
        const isFree = !isPointsPrice && priceMode === 'free';

        if (isFree) {
            enterPlayer(track);
        } else {
            // LOGIN GATE: check if user is logged in before showing payment
            const jwt = typeof window !== 'undefined' ? sessionStorage.getItem('vp.jwt') : null;
            if (!jwt) {
                alert('Please login first to access paid content.');
                navigate('/login');
                return;
            }
            // PAID CONTENT -> Intercept
            setPendingTrack(track);
            setShowPaymentChoice(true);
        }
    };

    // 2. ENTER PLAYER (No Auto-Play)
    const enterPlayer = async (track: VideoMeta, forceUnlock: boolean = false) => {
        const isNew = currentTrack?.id !== track.id;

        if (isNew) {
            setCurrentTrack(track);
            setIsPlaying(false); // MANUAL PLAY ONLY
            setNeedPurchase(false);
            setView('player');

            // Prepare track in global context (NO auto-play, NO mini-player yet)
            // Mini-player only shows after user explicitly presses Play
            const globalPlaylist: GlobalTrack[] = tracks.map(t => ({
                id: t.id,
                title: t.title,
                artist: t.description || t.creatorBitDomain || 'Unknown',
                coverUrl: t.posterUrl,
                audioUrl: t.cdnUrl,
            }));
            const globalTrack: GlobalTrack = {
                id: track.id,
                title: track.title,
                artist: track.description || track.creatorBitDomain || 'Unknown',
                coverUrl: track.posterUrl,
                audioUrl: track.cdnUrl,
            };
            globalMusic.loadTrack(globalTrack, globalPlaylist);
        } else if (view === 'shelf') {
            setView('player');
        }
    };

    // Existing "loadTrack" logic is now split or deprecated in favor of explicit flow
    // We keep a simplified internal loader for when the player MOUNTS/UPDATES
    useEffect(() => {
        if (!currentTrack) return;

        const fetchSrc = async () => {
            // ... existing src fetching logic ...
            let src = currentTrack.cdnUrl;
            // ... (simplified for brevity, main point is NO AUTO PLAY)
            if (audioRef.current) {
                audioRef.current.src = src;
                // audioRef.current.play(); // REMOVED AUTO-PLAY
            }
        };
        fetchSrc();
    }, [currentTrack]);

    // ... (Keep existing nextTrack/prevTrack but route them through enterPlayer) ...
    const nextTrack = () => {
        if (!currentTrack) return;
        const idx = tracks.findIndex(t => t.id === currentTrack.id);
        const next = tracks[(idx + 1) % tracks.length];
        enterPlayer(next); // Use new function
    };

    const prevTrack = () => {
        if (!currentTrack) return;
        const idx = tracks.findIndex(t => t.id === currentTrack.id);
        const prev = tracks[(idx - 1 + tracks.length) % tracks.length];
        enterPlayer(prev); // Use new function
    };

    // --- RESTORED HELPER VARIABLES ---
    // Filtered List
    const displayTracks = tracks.filter(t =>
        !searchQ || t.title.toLowerCase().includes(searchQ.toLowerCase()) || (t.creatorBitDomain || "").toLowerCase().includes(searchQ.toLowerCase()) || (t.genre || "").toLowerCase() === filterGenre.toLowerCase() || filterGenre === "All"
    );
    const visibleTracks = displayTracks.slice(0, page * PAGE_SIZE);
    const hasMore = displayTracks.length > page * PAGE_SIZE;

    // Scroll active line into view
    const activeLineIndex = lrcLines.findIndex((line, i) => {
        const nextLine = lrcLines[i + 1];
        // Look ahead by 1.5s to fix "lagging" feel
        const t = currentTime + 1.5;
        return t >= line.time && (!nextLine || t < nextLine.time);
    });

    const shelves: VideoMeta[][] = [];

    // --- PAYMENT CHOICE MODAL (Unified PaymentModeSelector) ---
    const renderPaymentChoiceModal = () => {
        if (!showPaymentChoice || !pendingTrack) return null;

        // Build a video-compatible object for PaymentModeSelector
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
                    if (mode === 'buy_once') {
                        processPayment('buy_once');
                    } else if (mode === 'stream') {
                        processPayment('stream');
                    } else {
                        setShowPaymentChoice(false);
                    }
                }}
                onClose={() => setShowPaymentChoice(false)}
            />
        );
    };

    const processPayment = async (type: 'buy_once' | 'stream') => {
        // Set track FIRST so usePayment hook has correct contentId
        if (pendingTrack) {
            setCurrentTrack(pendingTrack);
            // Wait for state to settle before calling payment
            await new Promise(r => setTimeout(r, 50));
        }
        setShowPaymentChoice(false);
        if (type === 'buy_once') {
            await payment.handleBuyOnce();
        } else {
            await payment.handleStartStream();
        }
    };

    // --- SHELF GRID HELPER ---
    // Re-inserting the loop correctly inside the component
    const ITEMS_PER_SHELF = 3;
    for (let i = 0; i < visibleTracks.length; i += ITEMS_PER_SHELF) {
        shelves.push(visibleTracks.slice(i, i + ITEMS_PER_SHELF));
    }

    return (
        <div className="relative min-h-screen pb-32">
            {/* Ambient Background */}
            <div className="fixed inset-0 pointer-events-none z-0">
                <div style={{
                    position: 'absolute', top: '10%', left: '50%', transform: 'translateX(-50%)',
                    width: '80vw', height: '40vh',
                    background: 'radial-gradient(ellipse, rgba(168,85,247,0.15) 0%, transparent 60%)',
                    filter: 'blur(80px)'
                }} />
            </div>

            <div className="relative z-10 p-6 md:p-10">

                {/* Hero: Featured Album */}
                {currentTrack && view === 'shelf' && (
                    <div
                        className="mb-12 relative w-full rounded-2xl overflow-hidden glass-panel border border-white/10 group cursor-pointer"
                        onClick={() => handleVinylClick(currentTrack)}
                    >
                        <div className="absolute inset-0 bg-gradient-to-r from-black via-black/90 to-transparent z-10" />
                        <img
                            src={currentTrack.posterUrl || `https://images.unsplash.com/photo-1614149162883-504ce4d13909?q=80&w=2000&auto=format&fit=crop`}
                            className="absolute inset-0 w-full h-full object-cover opacity-50 mix-blend-screen group-hover:scale-105 transition-transform duration-1000"
                            alt=""
                        />
                        <div className="relative z-20 p-8 md:p-12 flex flex-col md:flex-row items-center gap-10 min-h-[350px] w-full">
                            {/* Album Art */}
                            <div className="w-48 h-48 md:w-64 md:h-64 flex-shrink-0 relative group-hover:-translate-y-2 transition-transform duration-500">
                                <div className="absolute inset-0 bg-nexusPurple rounded-full opacity-20 blur-2xl group-hover:opacity-40 transition-opacity" />
                                <img
                                    src={currentTrack.posterUrl || 'https://images.unsplash.com/photo-1614149162883-504ce4d13909?q=80&w=600'}
                                    className="w-full h-full object-cover rounded-lg shadow-[0_20px_50px_rgba(0,0,0,0.8)] border border-white/10 relative z-10"
                                    alt={currentTrack.title}
                                />
                                {/* Vinyl stick out */}
                                <div
                                    className="absolute top-1/2 -translate-y-1/2 -right-8 w-full h-full rounded-full border-4 border-[#111] z-0 shadow-xl opacity-0 group-hover:opacity-100 -translate-x-5 group-hover:translate-x-0 transition-all duration-700"
                                    style={{ backgroundImage: 'repeating-radial-gradient(#111 0, #111 2px, #000 3px, #000 4px)' }}
                                />
                            </div>
                            <div className="flex-1">
                                <div className="flex items-center gap-2 mb-4">
                                    <span className="bg-nexusPurple/20 text-nexusPurple border border-nexusPurple/30 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-widest flex items-center gap-1">
                                        <Music size={12} /> Album of the Week
                                    </span>
                                </div>
                                <h1 className="text-4xl md:text-5xl font-black text-white mb-2 leading-tight drop-shadow-2xl" style={{ fontFamily: "'Inter', system-ui, sans-serif" }}>
                                    {currentTrack.title}
                                </h1>
                                <p className="text-nexusCyan font-mono text-sm mb-6">
                                    By <span className="text-white hover:underline cursor-pointer">{currentTrack.description || currentTrack.creatorBitDomain}</span>
                                </p>
                                <p className="text-gray-400 text-sm mb-8 line-clamp-2 max-w-xl">
                                    {currentTrack.description || 'Exclusive NFT stems included for pass holders.'}
                                </p>
                                <div className="flex items-center gap-4">
                                    <button
                                        className="bg-nexusPurple hover:bg-nexusPink text-white px-8 py-3 rounded-full text-sm font-bold transition-all flex items-center gap-2 shadow-[0_0_20px_rgba(168,85,247,0.4)] hover:shadow-[0_0_30px_rgba(236,72,153,0.6)]"
                                        onClick={(e) => { e.stopPropagation(); handleVinylClick(currentTrack); }}
                                    >
                                        <Play size={18} fill="currentColor" /> Play Album
                                    </button>
                                    <button className="bg-white/10 hover:bg-white/20 text-white backdrop-blur border border-white/20 px-6 py-3 rounded-full text-sm font-bold transition-colors">
                                        View Stems
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Player View */}
                {view === 'player' && currentTrack && (
                    <div className="mb-12">
                        <button
                            onClick={() => setView('shelf')}
                            className="flex items-center gap-2 text-gray-400 hover:text-white text-sm mb-6 transition-colors"
                        >
                            ...Back to Archive
                        </button>
                        <div className="glass-panel rounded-2xl border border-white/10 p-8 flex flex-col md:flex-row gap-10 items-center">
                            {/* Album Art & Vinyl */}
                            <div className="w-64 h-64 flex-shrink-0 relative">
                                <div className="absolute inset-0 bg-nexusPurple rounded-full opacity-20 blur-2xl" />
                                <img
                                    src={currentTrack.posterUrl || 'https://images.unsplash.com/photo-1614149162883-504ce4d13909?q=80&w=600'}
                                    className={`w-full h-full object-cover rounded-lg shadow-[0_20px_50px_rgba(0,0,0,0.8)] border border-white/10 relative z-10 ${isPlaying ? 'animate-pulse' : ''}`}
                                    alt={currentTrack.title}
                                />
                            </div>

                            {/* Player Controls */}
                            <div className="flex-1 min-w-0">
                                <h2 className="text-3xl font-black text-white mb-2">{currentTrack.title}</h2>
                                <p className="text-nexusPurple font-mono text-sm mb-4">{currentTrack.description || currentTrack.creatorBitDomain}</p>

                                {/* Creator Badge */}
                                <div className="flex items-center gap-3 mb-6 p-3 rounded-xl bg-white/5 border border-white/10 w-fit">
                                    <div
                                        className="w-10 h-10 rounded-full bg-cover cursor-pointer hover:ring-2 hover:ring-purple-500 transition-all"
                                        style={{ backgroundImage: `url(https://api.dicebear.com/7.x/avataaars/svg?seed=${currentTrack.creatorCkbAddress || currentTrack.creatorBitDomain || 'artist'})` }}
                                        onClick={() => currentTrack.creatorCkbAddress && navigate(`/profile/${currentTrack.creatorCkbAddress}`)}
                                    />
                                    <div className="flex-1 min-w-0">
                                        <div
                                            className="text-white font-bold text-sm flex items-center gap-1 cursor-pointer hover:text-purple-400 transition-colors"
                                            onClick={() => currentTrack.creatorCkbAddress && navigate(`/profile/${currentTrack.creatorCkbAddress}`)}
                                        >
                                            {currentTrack.creatorBitDomain || (currentTrack.creatorCkbAddress ? `${currentTrack.creatorCkbAddress.slice(0, 6)}...${currentTrack.creatorCkbAddress.slice(-4)}` : 'Unknown Artist')}
                                            <svg className="w-3.5 h-3.5 text-purple-400" fill="currentColor" viewBox="0 0 20 20">
                                                <path fillRule="evenodd" d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                            </svg>
                                        </div>
                                        <span className="text-[10px] text-gray-500 font-mono">Creator</span>
                                    </div>
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            const jwt = typeof window !== 'undefined' ? sessionStorage.getItem('vp.jwt') : null;
                                            if (!jwt) { alert('Please login first'); return; }
                                            const btn = e.currentTarget;
                                            btn.disabled = true;
                                            btn.textContent = '...';
                                            client.post('/metadata/follow', { targetAddress: currentTrack.creatorCkbAddress })
                                                .then(() => { btn.textContent = 'Following ✓'; btn.classList.replace('bg-white', 'bg-white/20'); btn.classList.replace('text-black', 'text-white'); })
                                                .catch((err: any) => { btn.textContent = '✗ Error'; btn.style.color = '#ff6b6b'; setTimeout(() => { btn.textContent = 'Follow'; btn.style.color = ''; btn.disabled = false; }, 2000); });
                                        }}
                                        className="bg-white text-black px-3 py-1 rounded-full text-xs font-bold hover:bg-gray-200 hover:scale-105 transition-all"
                                    >
                                        Follow
                                    </button>
                                </div>

                                {payStatus && (
                                    <div className="bg-nexusPurple/20 border border-nexusPurple/30 rounded-lg p-3 mb-4 text-purple-300 text-sm font-mono">
                                        {payStatus}
                                    </div>
                                )}

                                {/* Progress Bar */}
                                <div className="mb-6">
                                    <div className="h-1 bg-white/10 rounded-full overflow-hidden relative">
                                        <div
                                            className="h-full bg-gradient-to-r from-nexusPurple to-nexusPink rounded-full shadow-[0_0_15px_rgba(168,85,247,1)] transition-all"
                                            style={{ width: `${globalMusic.duration ? (currentTime / globalMusic.duration) * 100 : 0}%` }}
                                        />
                                    </div>
                                    <div className="flex justify-between mt-1 text-[10px] text-gray-500 font-mono">
                                        <span>{Math.floor(currentTime / 60)}:{String(Math.floor(currentTime % 60)).padStart(2, '0')}</span>
                                        <span>{globalMusic.duration ? `${Math.floor(globalMusic.duration / 60)}:${String(Math.floor(globalMusic.duration % 60)).padStart(2, '0')}` : '--:--'}</span>
                                    </div>
                                </div>

                                {/* Controls */}
                                <div className="flex items-center gap-6 justify-center">
                                    <button onClick={prevTrack} className="text-gray-400 hover:text-white transition-colors">
                                        <SkipBack size={24} />
                                    </button>
                                    <button
                                        onClick={() => {
                                            if (isPlaying) {
                                                globalMusic.togglePlay();
                                            } else {
                                                // If global player has no track, push current one
                                                if (!globalMusic.currentTrack && currentTrack) {
                                                    const globalTrack = {
                                                        id: currentTrack.id,
                                                        title: currentTrack.title,
                                                        artist: currentTrack.description || currentTrack.creatorBitDomain || 'Unknown',
                                                        coverUrl: currentTrack.posterUrl,
                                                        audioUrl: currentTrack.cdnUrl,
                                                    };
                                                    globalMusic.playTrack(globalTrack);
                                                } else {
                                                    globalMusic.togglePlay();
                                                }
                                            }
                                        }}
                                        className="w-14 h-14 bg-white text-black hover:bg-gray-200 rounded-full flex items-center justify-center transition-colors shadow-[0_0_15px_rgba(255,255,255,0.2)]"
                                    >
                                        {isPlaying ? <Pause size={22} /> : <Play size={22} className="ml-1" fill="currentColor" />}
                                    </button>
                                    <button onClick={nextTrack} className="text-gray-400 hover:text-white transition-colors">
                                        <SkipForward size={24} />
                                    </button>
                                </div>

                                {/* Lyrics */}
                                {lrcLines.length > 0 && (
                                    <div className="mt-8 max-h-48 overflow-y-auto hide-scrollbar space-y-2">
                                        {lrcLines.map((line, i) => (
                                            <p
                                                key={i}
                                                className={`text-sm transition-all duration-300 ${i === activeLineIndex ? 'text-white font-bold text-base scale-105' : 'text-gray-600'}`}
                                                style={{ textAlign: 'center' }}
                                            >
                                                {line.text}
                                            </p>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {/* Filter Console */}
                {view === 'shelf' && (
                    <div className="w-full flex flex-col md:flex-row justify-between items-center mb-16 gap-6 relative z-10 p-4 rounded-xl border border-white/5 glass-panel bg-black/40">
                        <h2 className="text-xl font-black text-white tracking-widest flex items-center gap-2" style={{ fontFamily: "'Inter', system-ui, sans-serif" }}>
                            <Disc size={20} className="text-nexusPurple" />
                            THE ARCHIVE
                        </h2>

                        <div className="flex flex-wrap gap-2 justify-center">
                            {GENRES.map((g) => (
                                <button
                                    key={g}
                                    className={`inline-flex items-center px-4 py-1.5 rounded text-xs font-semibold uppercase tracking-wider transition-all cursor-pointer border ${filterGenre === g
                                        ? 'bg-nexusPurple/10 text-nexusPurple border-nexusPurple shadow-[inset_0_0_10px_rgba(168,85,247,0.2)]'
                                        : 'bg-white/[0.03] text-gray-400 border-white/5 hover:bg-white/10 hover:text-white hover:border-white/20'
                                        }`}
                                    onClick={() => setFilterGenre(g)}
                                >
                                    {g}
                                </button>
                            ))}
                        </div>

                        {/* Search */}
                        <div className="relative w-64 group">
                            <Search size={14} className="text-nexusPurple absolute left-3 top-1/2 -translate-y-1/2" />
                            <input
                                type="text"
                                value={searchQ}
                                onChange={(e) => setSearchQ(e.target.value)}
                                placeholder="Dig for records, artists..."
                                className="w-full bg-black/40 border border-white/10 rounded-full py-1.5 pl-9 pr-4 text-xs text-white focus:outline-none focus:border-nexusPurple/50 focus:bg-black/80 transition-all font-mono"
                            />
                        </div>
                    </div>
                )}

                {/* Record Shelf Grid */}
                {view === 'shelf' && (
                    <div className="w-full mb-24">
                        <h3 className="text-white font-bold text-lg tracking-wider mb-6 pl-4 border-l-4 border-nexusPurple drop-shadow-[0_0_8px_rgba(168,85,247,0.5)]" style={{ fontFamily: "'Inter', system-ui, sans-serif" }}>
                            LATEST ARRIVALS
                        </h3>

                        {loading ? (
                            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-6 gap-x-8 gap-y-12 px-4">
                                {[...Array(6)].map((_, i) => (
                                    <div key={i} className="aspect-square rounded-md bg-white/5 animate-pulse border border-white/10" />
                                ))}
                            </div>
                        ) : (
                            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-6 gap-x-8 gap-y-12 px-4">
                                {visibleTracks.map((track) => {
                                    const price = (track as any).pointsPrice || 0;
                                    const isPaid = price > 0 || parseFloat(track.priceUSDI || '0') > 0;
                                    return (
                                        <div
                                            key={track.id}
                                            className="record-card relative rounded-lg cursor-pointer group aspect-square flex flex-col pt-0"
                                            onClick={() => handleVinylClick(track)}
                                        >
                                            <div className="w-full h-full rounded-md overflow-hidden bg-black shadow-[0_15px_30px_rgba(0,0,0,0.8)] relative z-10 border border-white/10">
                                                {track.posterUrl ? (
                                                    <img
                                                        src={track.posterUrl}
                                                        alt={track.title}
                                                        className="w-full h-full object-cover opacity-90 group-hover:opacity-100 group-hover:scale-110 transition-transform duration-700"
                                                        loading="lazy"
                                                    />
                                                ) : (
                                                    <div className="w-full h-full bg-gradient-to-br from-gray-900 via-[#110022] to-black flex flex-col items-center justify-center p-4">
                                                        <Disc size={40} className="text-white/20 mb-2" />
                                                        <span className="text-white/40 font-mono text-[10px] text-center border border-white/10 px-2 py-0.5 rounded uppercase tracking-widest">
                                                            Demo Tape
                                                        </span>
                                                    </div>
                                                )}

                                                {/* Type Badge */}
                                                <div className="absolute top-2 left-2 bg-black/80 backdrop-blur-md px-1.5 py-0.5 rounded text-[9px] text-white border border-white/20 flex items-center gap-1 uppercase font-bold tracking-wider">
                                                    <span className="w-1.5 h-1.5 bg-nexusPurple rounded-full" /> {isPaid ? 'PREMIUM' : 'EP'}
                                                </div>

                                                {/* Price Badge */}
                                                {isPaid ? (
                                                    <div className="absolute bottom-2 right-2 bg-yellow-500/20 text-yellow-500 border border-yellow-500/50 backdrop-blur-md px-1.5 py-0.5 rounded text-[10px] font-bold font-mono">
                                                        {price > 0 ? `${price} PTS` : `$${track.priceUSDI}`}
                                                    </div>
                                                ) : (
                                                    <div className="absolute bottom-2 right-2 bg-nexusCyan/20 text-nexusCyan border border-nexusCyan/50 backdrop-blur-md px-1.5 py-0.5 rounded text-[10px] font-bold font-mono">
                                                        FREE
                                                    </div>
                                                )}

                                                {/* Hover Play Button */}
                                                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                                                    <div className="w-12 h-12 bg-white/20 backdrop-blur rounded-full flex items-center justify-center border border-white/40 transform scale-50 group-hover:scale-100 transition-transform delay-100">
                                                        <Play size={20} className="text-white ml-1" fill="currentColor" />
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Hover tooltip */}
                                            <div className="absolute top-full left-0 w-full mt-3 text-center opacity-0 group-hover:opacity-100 transform translate-y-2 group-hover:translate-y-0 transition-all duration-300 pointer-events-none z-30">
                                                <div className="bg-black/90 backdrop-blur-md border border-white/10 p-2 rounded-lg shadow-xl">
                                                    <h4 className="text-white font-bold text-xs truncate">{track.title}</h4>
                                                    <p className="text-nexusPurple font-mono text-[9px] mt-0.5">{track.description || track.creatorBitDomain}</p>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}

                        {/* Load More */}
                        {hasMore && (
                            <div className="mt-12 text-center">
                                <button
                                    onClick={() => setPage(p => p + 1)}
                                    className="bg-black border border-nexusPurple text-nexusPurple hover:bg-nexusPurple hover:text-white font-bold uppercase tracking-widest px-8 py-3 rounded-full text-xs transition-all shadow-[0_0_15px_rgba(168,85,247,0.2)] hover:shadow-[0_0_25px_rgba(168,85,247,0.5)]"
                                >
                                    Load More
                                </button>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Hidden Audio Element — no longer needed, using global player */}

            {/* Global mini player bar is rendered in RootLayout, no need for local mini-player */}

            {/* Payment Choice Modal (Unified PaymentModeSelector) */}
            {renderPaymentChoiceModal()}

            {/* Payment Overlay (Unified PaymentModeSelector) */}
            {showPaymentOverlay && currentTrack && (
                <PaymentModeSelector
                    video={{
                        ...currentTrack,
                        buyOncePrice: (currentTrack as any).pointsPrice || 50,
                        streamPricePerMinute: (currentTrack as any).streamPricePerMinute || 1,
                        priceMode: (currentTrack as any).priceMode || 'buy_once',
                    }}
                    onSelect={(mode) => {
                        setShowPaymentOverlay(false);
                        if (mode === 'buy_once') {
                            payment.handleBuyOnce();
                        } else if (mode === 'stream') {
                            payment.handleStartStream();
                        }
                    }}
                    onClose={() => setShowPaymentOverlay(false)}
                />
            )}
        </div>
    );
}
