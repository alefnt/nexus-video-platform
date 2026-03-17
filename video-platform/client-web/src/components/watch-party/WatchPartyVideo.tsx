// FILE: /video-platform/client-web/src/components/watch-party/WatchPartyVideo.tsx
/**
 * Watch Party 视频播放器组件
 *
 * 负责：
 * - 检查视频权限（useVideoEntitlement）
 * - 初始化 video.js 播放器
 * - 付费流程（积分/流支付/团购）
 * - 与 host 同步播放状态
 */

import React, { useRef, useState, useEffect, useCallback } from 'react';
import videojs from 'video.js';
import { useVideoEntitlement } from '../../hooks/useVideoEntitlement';
import { getApiClient } from '../../lib/apiClient';
import type { RoomState, Participant } from '../../hooks/useWatchPartySync';
import { Lock, CreditCard, Zap, Play, AlertCircle } from 'lucide-react';

const client = getApiClient();

// Group purchase discount calculation
function calculateGroupPurchasePrice(basePrice: number, groupSize: number) {
    const discount = Math.min(0.3, groupSize * 0.05); // 5% per person, max 30%
    const perPerson = Math.round(basePrice * (1 - discount));
    return {
        perPerson,
        originalTotal: basePrice * groupSize,
        finalTotal: perPerson * groupSize,
        discount: 1 - discount,
    };
}

// Known demo video CDN URLs — always available
const DEMO_URLS: Record<string, string> = {
    'sample-bbb-720p': 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
    'sintel-hls': 'https://bitdash-a.akamaihd.net/content/sintel/hls/playlist.m3u8',
    'elephants-dream': 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4',
};

interface WatchPartyVideoProps {
    roomState: RoomState | null;
    userId: string;
    isHost: boolean;
    participants: Participant[];
    onTimeUpdate?: (time: number) => void;
    onPlayStateChange?: (isPlaying: boolean, currentTime: number) => void;
    onPaymentRequired?: (videoId: string) => void;
}

export const WatchPartyVideo: React.FC<WatchPartyVideoProps> = ({
    roomState,
    userId,
    isHost,
    participants,
    onTimeUpdate,
    onPlayStateChange,
    onPaymentRequired
}) => {
    const videoRef = useRef<HTMLVideoElement>(null);
    const playerRef = useRef<any>(null);
    const [showPaymentModal, setShowPaymentModal] = useState(false);
    const [paymentType, setPaymentType] = useState<'stream' | 'points' | 'group'>('points');
    const [purchasing, setPurchasing] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [playerReady, setPlayerReady] = useState(false);
    const [initStatus, setInitStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
    const lastVideoIdRef = useRef<string | null>(null);

    // Get video entitlement status
    const videoId = roomState?.videoId || '';
    const entitlement = useVideoEntitlement(videoId, userId);
    const { isLoading, hasFullAccess, requiresPayment, streamPurchase, videoMeta } = entitlement;

    // Determine if payment is needed
    const isHostTreats = roomState?.paymentModel === 'host_treats';
    const needsPayment = requiresPayment && !hasFullAccess && !isHostTreats;

    // ─── Resolve video URL ───
    const resolveVideoUrl = useCallback(async (vid: string): Promise<string | null> => {
        const jwt = sessionStorage.getItem('vp.jwt') || localStorage.getItem('jwt');
        if (jwt) client.setJWT(jwt);

        // 1) Try content stream API
        try {
            const streamData = await client.get<{ url?: string; streamUrl?: string }>(`/content/stream/${vid}`);
            const u = streamData?.url || streamData?.streamUrl;
            if (u) return u;
        } catch { }

        // 2) Try direct HLS path
        try {
            const hlsUrl = `http://localhost:8092/content/hls/${vid}/index.m3u8`;
            const probe = await fetch(hlsUrl, { method: 'HEAD' });
            if (probe.ok) return hlsUrl;
        } catch { }

        // 3) Try samples.json
        try {
            const resp = await fetch('/videos/samples.json');
            if (resp.ok) {
                const arr = await resp.json();
                const hit = (Array.isArray(arr) ? arr : []).find((v: any) => String(v?.id) === String(vid));
                if (hit?.cdnUrl) return hit.cdnUrl;
                if (hit?.hlsUrl) return hit.hlsUrl;
            }
        } catch { }

        // 4) Fallback: known demo video CDN URLs
        if (DEMO_URLS[vid]) return DEMO_URLS[vid];

        return null;
    }, []);

    // ─── Initialize / re-init player when videoId changes ───
    useEffect(() => {
        if (!videoId || !videoRef.current || isLoading || needsPayment) return;
        // Already initialized for this videoId
        if (lastVideoIdRef.current === videoId && playerRef.current) return;

        // Dispose previous player if different video
        if (playerRef.current) {
            try { playerRef.current.dispose(); } catch { }
            playerRef.current = null;
            setPlayerReady(false);
        }
        lastVideoIdRef.current = videoId;
        setInitStatus('loading');
        setError(null);

        let cancelled = false;
        (async () => {
            const videoUrl = await resolveVideoUrl(videoId);
            if (cancelled) return;

            if (!videoUrl) {
                setError(`无法获取视频地址 (${videoId})`);
                setInitStatus('error');
                return;
            }

            if (!videoRef.current) {
                setError('视频元素未就绪');
                setInitStatus('error');
                return;
            }

            const isHLS = videoUrl.includes('.m3u8');
            const sourceType = isHLS ? 'application/x-mpegURL' : 'video/mp4';

            try {
                const player = videojs(videoRef.current, {
                    controls: true,
                    autoplay: false,
                    preload: 'auto',
                    fill: true, // fill parent container (NOT fluid which adds its own wrapper)
                    sources: [{ src: videoUrl, type: sourceType }],
                });

                playerRef.current = player;

                // Host: throttled time updates
                let lastReportTime = 0;
                player.on('timeupdate', () => {
                    if (isHost && onTimeUpdate) {
                        const now = Date.now();
                        if (now - lastReportTime > 3000) {
                            lastReportTime = now;
                            onTimeUpdate(player.currentTime() || 0);
                        }
                    }
                });

                // Host: play/pause events → WS broadcast
                if (isHost && onPlayStateChange) {
                    player.on('play', () => onPlayStateChange(true, player.currentTime() || 0));
                    player.on('pause', () => onPlayStateChange(false, player.currentTime() || 0));
                }

                // Wait for player to be ready
                player.ready(() => {
                    if (cancelled) return;
                    setPlayerReady(true);
                    setInitStatus('ready');

                    // Auto-play if room is already playing
                    if (roomState && roomState.status === 'playing') {
                        player.play().catch(() => { });
                        if ((roomState.currentTime || 0) > 0) {
                            player.currentTime(roomState.currentTime);
                        }
                    }
                });

                // Resume from stream purchase position
                if (streamPurchase && streamPurchase.paidUntilSeconds > 0) {
                    player.one('loadeddata', () => {
                        player.currentTime(streamPurchase.paidUntilSeconds);
                    });
                }
            } catch (err: any) {
                if (!cancelled) {
                    console.error('Watch Party video init failed:', err);
                    setError(err?.message || '视频加载失败');
                    setInitStatus('error');
                }
            }
        })();

        return () => {
            cancelled = true;
        };
    }, [videoId, isLoading, needsPayment, resolveVideoUrl, isHost, onTimeUpdate, onPlayStateChange, roomState?.status, streamPurchase]);

    // ─── Cleanup on unmount ───
    useEffect(() => {
        return () => {
            if (playerRef.current) {
                try { playerRef.current.dispose(); } catch { }
                playerRef.current = null;
            }
        };
    }, []);

    // ─── Viewer sync: follow host's play/pause/seek from GunDB ───
    useEffect(() => {
        if (isHost || !playerRef.current || !playerReady || !roomState) return;
        const player = playerRef.current;

        // Sync play/pause
        if (roomState.status === 'playing' || roomState.isPlaying) {
            if (player.paused()) {
                player.play().catch(() => { });
            }
        } else if (roomState.status === 'waiting' || (!roomState.isPlaying && roomState.status !== 'ended')) {
            if (!player.paused()) {
                player.pause();
            }
        }

        // Sync position (correct drift > 3s)
        if ((roomState.currentTime || 0) > 0) {
            const localTime = player.currentTime() || 0;
            const drift = Math.abs(localTime - roomState.currentTime);
            if (drift > 3) {
                player.currentTime(roomState.currentTime);
            }
        }
    }, [isHost, playerReady, roomState?.isPlaying, roomState?.currentTime, roomState?.updatedAt, roomState?.status]);

    // ─── When room transitions to 'playing', trigger play on the player ───
    useEffect(() => {
        if (!playerRef.current || !playerReady) return;
        if (roomState?.status === 'playing') {
            const player = playerRef.current;
            if (player.paused()) {
                player.play().catch(() => { });
            }
        }
    }, [roomState?.status, playerReady]);

    // Payment handler
    const handlePayment = async (type: 'stream' | 'points' | 'group') => {
        if (!videoId || !videoMeta) return;
        setPurchasing(true);
        setError(null);

        try {
            if (type === 'points' || type === 'group') {
                const finalTotal = type === 'group' && participants.length > 1
                    ? calculateGroupPurchasePrice(videoMeta.pointsPrice, participants.length).finalTotal
                    : videoMeta.pointsPrice;

                await client.post('/payment/points/redeem', {
                    videoId,
                    totalPoints: finalTotal
                });
            } else {
                onPaymentRequired?.(videoId);
            }

            setShowPaymentModal(false);
            entitlement.refresh();
        } catch (err: any) {
            setError(err?.error || '支付失败');
        } finally {
            setPurchasing(false);
        }
    };

    // === RENDER ===

    // No video selected yet (joiner waiting for roomState)
    if (!videoId) {
        return (
            <div className="w-full h-full flex items-center justify-center bg-black/50">
                <div className="text-center space-y-3 animate-pulse">
                    <div className="w-10 h-10 border-2 border-t-[#22d3ee] border-white/20 rounded-full animate-spin mx-auto" />
                    <span className="text-gray-400 text-sm">等待房主选择视频...</span>
                </div>
            </div>
        );
    }

    // Loading entitlement check
    if (isLoading) {
        return (
            <div className="w-full h-full flex items-center justify-center bg-black/50">
                <div className="text-center space-y-3 animate-pulse">
                    <div className="w-10 h-10 border-2 border-t-[#22d3ee] border-white/20 rounded-full animate-spin mx-auto" />
                    <span className="text-gray-400 text-sm">加载中...</span>
                </div>
            </div>
        );
    }

    // Payment required — show payment options (skip if host_treats)
    if (needsPayment) {
        const groupPrice = participants.length > 1 && videoMeta
            ? calculateGroupPurchasePrice(videoMeta.pointsPrice, participants.length)
            : null;

        return (
            <div className="w-full h-full flex items-center justify-center bg-black/80 backdrop-blur relative">
                <div className="text-center space-y-4 max-w-md p-8">
                    <Lock size={48} className="text-yellow-400 mx-auto" />
                    <h3 className="text-xl font-bold text-white">此视频需要付费观看</h3>
                    <p className="text-gray-400">{videoMeta?.title}</p>

                    {streamPurchase && (
                        <div className="flex items-center gap-2 text-sm text-blue-400 bg-blue-500/10 px-4 py-2 rounded-lg">
                            <AlertCircle size={16} />
                            <span>您已通过流支付购买了 {Math.floor(streamPurchase.paidUntilSeconds / 60)} 分钟</span>
                        </div>
                    )}

                    <div className="space-y-2">
                        {videoMeta && videoMeta.pointsPrice > 0 && (
                            <button className="w-full flex items-center gap-3 p-4 rounded-xl bg-white/5 border border-white/10 hover:border-[#22d3ee]/40 hover:bg-[#22d3ee]/5 transition-all text-left" onClick={() => { setPaymentType('points'); setShowPaymentModal(true); }}>
                                <CreditCard size={20} className="text-[#22d3ee]" />
                                <div className="flex-1">
                                    <div className="font-bold text-white">积分购买</div>
                                    <div className="text-xs text-gray-400">{videoMeta.pointsPrice} 积分</div>
                                </div>
                            </button>
                        )}

                        {videoMeta && videoMeta.streamPricePerMinute > 0 && (
                            <button className="w-full flex items-center gap-3 p-4 rounded-xl bg-white/5 border border-white/10 hover:border-[#a855f7]/40 hover:bg-[#a855f7]/5 transition-all text-left" onClick={() => { setPaymentType('stream'); handlePayment('stream'); }}>
                                <Zap size={20} className="text-[#a855f7]" />
                                <div className="flex-1">
                                    <div className="font-bold text-white">流支付</div>
                                    <div className="text-xs text-gray-400">{videoMeta.streamPricePerMinute} 积分/分钟</div>
                                </div>
                            </button>
                        )}

                        {isHost && groupPrice && videoMeta && participants.length > 1 && (
                            <button className="w-full flex items-center gap-3 p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 hover:bg-emerald-500/20 transition-all text-left" onClick={() => { setPaymentType('group'); setShowPaymentModal(true); }}>
                                <span className="text-lg">🎁</span>
                                <div className="flex-1">
                                    <div className="font-bold text-white">为全员购买 (团购)</div>
                                    <div className="text-xs text-gray-400">
                                        <span className="line-through">{groupPrice.originalTotal} 积分</span>
                                        {' → '}<span className="text-emerald-400 font-bold">{groupPrice.finalTotal} 积分</span>
                                        {' '}({Math.round((1 - groupPrice.discount) * 100)}% 折扣)
                                    </div>
                                </div>
                            </button>
                        )}
                    </div>

                    {error && <p className="text-red-400 text-sm">{error}</p>}
                </div>

                {showPaymentModal && (
                    <div className="absolute inset-0 bg-black/60 flex items-center justify-center z-50" onClick={() => setShowPaymentModal(false)}>
                        <div className="bg-[#1a1a2e] border border-white/10 rounded-2xl p-6 max-w-sm w-full space-y-4" onClick={e => e.stopPropagation()}>
                            <h3 className="text-lg font-bold text-white">确认{paymentType === 'group' ? '团购' : '购买'}</h3>
                            {paymentType === 'points' && videoMeta && (
                                <p className="text-gray-300">将花费 <strong className="text-[#22d3ee]">{videoMeta.pointsPrice} 积分</strong> 购买此视频</p>
                            )}
                            {paymentType === 'group' && groupPrice && (
                                <div className="space-y-1 text-sm text-gray-300">
                                    <p>为 {participants.length} 位观众购买</p>
                                    <p>原价: {groupPrice.originalTotal} 积分</p>
                                    <p className="text-emerald-400 font-bold">折扣价: {groupPrice.finalTotal} 积分</p>
                                </div>
                            )}
                            <div className="flex gap-3 pt-2">
                                <button className="flex-1 py-2 rounded-xl bg-white/10 text-gray-300 hover:bg-white/20 transition-all font-bold" onClick={() => setShowPaymentModal(false)}>取消</button>
                                <button className="flex-1 py-2 rounded-xl bg-gradient-to-r from-[#22d3ee] to-[#a855f7] text-white font-bold hover:brightness-110 transition-all disabled:opacity-50" onClick={() => handlePayment(paymentType)} disabled={purchasing}>
                                    {purchasing ? '处理中...' : '确认支付'}
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        );
    }

    // Main video player view — video element ALWAYS rendered
    return (
        <div className="w-full h-full relative bg-black">
            <div data-vjs-player style={{ width: '100%', height: '100%' }}>
                <video
                    ref={videoRef}
                    className="video-js vjs-big-play-centered"
                    playsInline
                    style={{ width: '100%', height: '100%' }}
                />
            </div>

            {/* Loading overlay */}
            {initStatus === 'loading' && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/60 z-10">
                    <div className="text-center space-y-3 animate-pulse">
                        <div className="w-10 h-10 border-2 border-t-[#22d3ee] border-white/20 rounded-full animate-spin mx-auto" />
                        <span className="text-gray-400 text-sm">加载视频...</span>
                    </div>
                </div>
            )}

            {/* Waiting overlay — only for viewers when room status is 'waiting' */}
            {!isHost && roomState?.status === 'waiting' && initStatus === 'ready' && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/60 z-10">
                    <div className="text-center space-y-3">
                        <Play size={48} className="text-[#22d3ee] mx-auto" />
                        <span className="text-white font-bold text-lg">等待房主开始播放...</span>
                    </div>
                </div>
            )}

            {/* Error overlay */}
            {initStatus === 'error' && error && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/60 z-10">
                    <div className="text-center space-y-3">
                        <AlertCircle size={32} className="text-red-400 mx-auto" />
                        <span className="text-red-400 text-sm">{error}</span>
                        <button
                            className="px-4 py-2 bg-white/10 text-white rounded-lg hover:bg-white/20 text-sm"
                            onClick={() => {
                                lastVideoIdRef.current = null; // allow retry
                                setInitStatus('idle');
                                setError(null);
                            }}
                        >
                            重试
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default WatchPartyVideo;
