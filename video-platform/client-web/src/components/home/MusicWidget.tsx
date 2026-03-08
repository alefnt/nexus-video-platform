import React, { useRef, useState, useEffect } from "react";
import { Disc, Play, SkipForward, Music2, Pause, Loader2 } from "lucide-react";
import { Button } from "../ui";
import { useNavigate } from "react-router-dom";
import { useExploreData } from "../../hooks/useApi";
import { usePayment } from "../../hooks/usePayment";
import type { VideoMeta } from "@video-platform/shared/types";

export const MusicWidget = () => {
    const navigate = useNavigate();
    const audioRef = useRef<HTMLAudioElement>(null);
    const streamHandlerRef = useRef<any>(null);

    const [playing, setPlaying] = useState(false);
    const [currentTime, setCurrentTime] = useState(0);
    const [loadingSrc, setLoadingSrc] = useState(false);

    // Fetch Data
    const { videos, trending } = useExploreData();

    // Find a music track (prefer trending audio, fallback to any audio, fallback to dummy)
    const activeTrending = (trending as VideoMeta[]) || [];
    const activeVideos = (videos as VideoMeta[]) || [];
    const musicTrack =
        activeTrending.find(t => t.contentType === 'audio') ||
        activeVideos.find(v => v.contentType === 'audio') ||
        {
            id: "os-1",
            title: "Impact Moderato",
            description: "Kevin MacLeod - Open Source",
            creatorName: "Kevin MacLeod",
            posterUrl: "https://images.unsplash.com/photo-1493225255756-d9584f8606e9?w=400&q=80",
            cdnUrl: "https://incompetech.com/music/royalty-free/mp3-royaltyfree/Impact%20Moderato.mp3",
            priceMode: 'free'
        } as unknown as VideoMeta;

    // Payment Integration
    const [payStatus, setPayStatus] = useState("");
    const [isUnlocking, setIsUnlocking] = useState(false);

    const payment = usePayment({
        contentId: musicTrack.id,
        contentType: 'music',
        buyOncePrice: (musicTrack as any).pointsPrice || 50,
        streamPricePerMinute: (musicTrack as any).streamPricePerMinute || 1,
        priceMode: (() => {
            const t = musicTrack as any;
            if (t.priceMode) return t.priceMode;
            if ((t.pointsPrice || 0) > 0) return 'buy_once' as const;
            return 'free' as const;
        })(),
        durationSeconds: musicTrack.durationSeconds || 180,
        onBuyOnceSuccess: () => {
            setPayStatus('Unlocked!');
            setIsUnlocking(false);
            setTimeout(() => {
                setPayStatus('');
                playAudio();
            }, 1000);
        },
        onStreamStarted: (handler) => {
            streamHandlerRef.current = handler;
            setIsUnlocking(false);

            const playerAdapter = {
                currentTime: (val?: number) => {
                    if (typeof val === 'number' && audioRef.current) {
                        audioRef.current.currentTime = val; return;
                    }
                    return audioRef.current?.currentTime || 0;
                },
                duration: () => audioRef.current?.duration || 0,
                play: () => { setPlaying(true); audioRef.current?.play(); },
                pause: () => { setPlaying(false); audioRef.current?.pause(); },
                on: (event: string, cb: Function) => audioRef.current?.addEventListener(event, cb as any),
                dispose: () => { }
            };
            handler.setPlayer(playerAdapter);
            playAudio();
        },
        onStreamPause: () => {
            setPlaying(false);
            audioRef.current?.pause();
        },
        onStatusChange: (msg) => setPayStatus(msg),
        enabled: !!musicTrack,
    });

    // Playback Logic
    const togglePlay = async () => {
        if (playing) {
            audioRef.current?.pause();
            return;
        }

        // If it's free, just play it
        const priceMode = (musicTrack as any).priceMode || 'free';
        const isFree = priceMode === 'free' && !(musicTrack as any).pointsPrice;

        if (isFree) {
            playAudio();
            return;
        }

        // It's paid. Try to play via payment hook
        setIsUnlocking(true);
        if (priceMode === 'stream' || priceMode === 'both') {
            await payment.handleStartStream();
        } else {
            await payment.handleBuyOnce();
        }
    };

    const playAudio = () => {
        if (audioRef.current) {
            audioRef.current.play().catch(e => {
                console.warn("Audio play blocked:", e);
                setPlaying(false);
            });
        }
    };

    // Cleanup
    useEffect(() => {
        return () => {
            if (streamHandlerRef.current) streamHandlerRef.current.cleanup();
        };
    }, []);

    return (
        <div className="relative h-full w-full px-8 pt-14 pb-8 flex flex-col justify-between overflow-hidden group bg-black rounded-lg">
            {/* Background Image */}
            <div
                className={`absolute inset-0 bg-cover bg-center transition-all duration-700 opacity-60 group-hover:scale-105 ${playing ? 'scale-110' : 'grayscale-[30%]'}`}
                style={{ backgroundImage: `url(${musicTrack.posterUrl || musicTrack.thumbnailUrl || "https://picsum.photos/seed/music/400/400"})` }}
            />

            {/* Gradient Overlay for Text Readability */}
            <div className="absolute inset-0 bg-gradient-to-t from-black via-black/80 to-transparent" />

            {/* Audio Element */}
            <audio
                ref={audioRef}
                src={musicTrack.cdnUrl}
                onPlay={() => setPlaying(true)}
                onPause={() => setPlaying(false)}
                onTimeUpdate={(e) => setCurrentTime(e.currentTarget.currentTime)}
                onEnded={() => setPlaying(false)}
            />

            {/* Background Vinyl Animation */}
            <div className={`absolute -right-10 -top-10 w-40 h-40 rounded-full border-[10px] border-black opacity-20 transition-all duration-[2s] z-0 pointer-events-none ${playing ? 'animate-[spin_5s_linear_infinite]' : ''}`}>
                <div className="absolute inset-0 border-[2px] border-white/10 rounded-full m-2" />
                <div className="absolute inset-0 border-[2px] border-white/10 rounded-full m-6" />
            </div>

            <div className="flex justify-between items-start z-10">
                <div className="bg-nexus-pink/20 p-2 rounded-lg relative">
                    <Music2 className="w-5 h-5 text-nexus-pink" />
                    {!playing && (musicTrack as any)?.priceMode !== 'free' && (musicTrack as any)?.pointsPrice > 0 && (
                        <div className="absolute -top-1 -right-1 w-3 h-3 bg-yellow-500 rounded-full border border-black" title="Premium Audio" />
                    )}
                </div>
                <div className="flex gap-1 h-5 items-end">
                    {[1, 2, 3, 4].map(i => (
                        <div
                            key={i}
                            className={`w-1 bg-nexus-pink/50 rounded-full transition-all duration-300 ${playing ? 'animate-pulse bg-nexus-pink' : ''}`}
                            style={{
                                height: playing ? `${Math.random() * 100 + 40}%` : '20%',
                                animationDelay: `${i * 0.15}s`
                            }}
                        />
                    ))}
                </div>
            </div>

            <div className="z-10 mt-4">
                <div className="flex gap-3 items-center mb-4">
                    <div className="w-12 h-12 rounded bg-cover bg-center shadow-lg border border-white/10" style={{ backgroundImage: `url(${musicTrack.posterUrl || musicTrack.thumbnailUrl || "https://picsum.photos/seed/music/200/200"})` }} />
                    <div className="flex-1 min-w-0">
                        <div className="text-sm font-bold text-white leading-tight truncate">{musicTrack.title || "Neon Nights"}</div>
                        <div className="text-[10px] text-gray-400 truncate">{(musicTrack as any).creatorName || (musicTrack as any).description || "Synthwave Collective"}</div>
                        {isUnlocking && <div className="text-[9px] text-yellow-400 animate-pulse mt-0.5">{payStatus || 'Unlocking...'}</div>}
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <Button
                        variant={playing ? "ghost" : "primary"}
                        size="sm"
                        className={`flex-1 h-8 text-xs font-bold font-display tracking-wide shadow-none border border-white/20 hover:border-nexus-pink/50 ${playing ? 'bg-white/10 text-white' : ''}`}
                        onClick={togglePlay}
                        disabled={isUnlocking}
                    >
                        {isUnlocking ? (
                            <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                        ) : playing ? (
                            <Pause className="w-3 h-3 mr-1 fill-current" />
                        ) : (
                            <Play className="w-3 h-3 mr-1 fill-current" />
                        )}
                        {isUnlocking ? "Unlocking" : playing ? "Pause" : "Play"}
                    </Button>
                    <Button
                        variant="ghost"
                        size="sm"
                        className="w-8 h-8 p-0 rounded-full border border-white/10 hover:bg-white/10"
                        onClick={() => navigate('/music')}
                    >
                        <SkipForward className="w-3 h-3" />
                    </Button>
                </div>
            </div>
        </div>
    );
};
