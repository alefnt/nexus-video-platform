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
    const initAttemptRef = useRef(false);
    const [showPaymentModal, setShowPaymentModal] = useState(false);
    const [paymentType, setPaymentType] = useState<'stream' | 'points' | 'group'>('points');
    const [purchasing, setPurchasing] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [playerReady, setPlayerReady] = useState(false);

    // Get video entitlement status
    const entitlement = useVideoEntitlement(roomState?.videoId || '', userId);
    const { isLoading, hasFullAccess, requiresPayment, streamPurchase, videoMeta } = entitlement;

    // Determine if payment is needed
    const isHostTreats = roomState?.paymentModel === 'host_treats';
    const needsPayment = requiresPayment && !hasFullAccess && !isHostTreats;

    // Initialize video.js player — called after DOM is ready
    const initPlayer = useCallback(async () => {
        if (!videoRef.current || !roomState?.videoId || playerRef.current || initAttemptRef.current) return;
        initAttemptRef.current = true;

        try {
            const jwt = sessionStorage.getItem('vp.jwt') || localStorage.getItem('jwt');
            if (jwt) client.setJWT(jwt);

            // Try multiple sources to find a playable URL
            let videoUrl: string | undefined;

            // 1) Try content stream API
            try {
                const streamData = await client.get<{ url?: string; streamUrl?: string }>(`/content/stream/${roomState.videoId}`);
                videoUrl = streamData?.url || streamData?.streamUrl;
            } catch { }

            // 2) Try direct HLS path
            if (!videoUrl) {
                const hlsUrl = `http://localhost:8092/content/hls/${roomState.videoId}/index.m3u8`;
                try {
                    const probe = await fetch(hlsUrl, { method: 'HEAD' });
                    if (probe.ok) videoUrl = hlsUrl;
                } catch { }
            }

            // 3) Try samples.json for demo/local videos
            if (!videoUrl) {
                try {
                    const resp = await fetch('/videos/samples.json');
                    if (resp.ok) {
                        const arr = await resp.json();
                        const hit = (Array.isArray(arr) ? arr : []).find((v: any) => String(v?.id) === String(roomState.videoId));
                        if (hit?.cdnUrl) videoUrl = hit.cdnUrl;
                        if (hit?.hlsUrl) videoUrl = hit.hlsUrl;
                    }
                } catch { }
            }

            // 4) Fallback: known demo video CDN URLs
            if (!videoUrl) {
                const demoUrls: Record<string, string> = {
                    'sample-bbb-720p': 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
                    'sintel-hls': 'https://bitdash-a.akamaihd.net/content/sintel/hls/playlist.m3u8',
                    'elephants-dream': 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4',
                };
                videoUrl = demoUrls[roomState.videoId];
            }

            if (!videoUrl) {
                setError('无法获取视频地址');
                initAttemptRef.current = false;
                return;
            }

            // Determine source type
            const isHLS = videoUrl.includes('.m3u8') || videoUrl.includes('videodelivery.net');
            const sourceType = isHLS ? 'application/x-mpegURL' : 'video/mp4';

            // Initialize video.js — videoRef.current is guaranteed non-null here
            const player = videojs(videoRef.current!, {
                controls: true,
                autoplay: false,
                preload: 'auto',
                fluid: true,
                sources: [{ src: videoUrl, type: sourceType }]
            });

            playerRef.current = player;
            setPlayerReady(true);

            // Host: throttled time updates for GunDB sync
            let lastReportTime = 0;
            player.on('timeupdate', () => {
                if (isHost && onTimeUpdate) {
                    const now = Date.now();
                    if (now - lastReportTime > 3000) {
                        lastReportTime = now;
                        onTimeUpdate(player.currentTime());
                    }
                }
            });

            // Host: play/pause events → WS broadcast
            if (isHost && onPlayStateChange) {
                player.on('play', () => {
                    onPlayStateChange(true, player.currentTime());
                });
                player.on('pause', () => {
                    onPlayStateChange(false, player.currentTime());
                });
            }

            // Auto-play if room is already playing
            if (roomState.status === 'playing') {
                player.play().catch(() => {});
                if (roomState.currentTime > 0) {
                    player.currentTime(roomState.currentTime);
                }
            }

            // Resume from stream purchase position
            if (streamPurchase && streamPurchase.paidUntilSeconds > 0) {
                player.currentTime(streamPurchase.paidUntilSeconds);
            }

        } catch (err: any) {
            console.error('Watch Party video init failed:', err);
            setError(err?.message || '视频加载失败');
            initAttemptRef.current = false;
        }
    }, [roomState?.videoId, roomState?.status, roomState?.currentTime, isHost, onTimeUpdate, onPlayStateChange, streamPurchase]);

    // Try to initialize player when video ref becomes available (after render)
    useEffect(() => {
        if (!isLoading && !needsPayment && videoRef.current && !playerRef.current) {
            // Small delay to ensure DOM is fully mounted
            const timer = setTimeout(() => initPlayer(), 100);
            return () => clearTimeout(timer);
        }
    }, [isLoading, needsPayment, initPlayer]);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            if (playerRef.current) {
                playerRef.current.dispose();
                playerRef.current = null;
            }
            initAttemptRef.current = false;
        };
    }, []);

    // Reset init attempt when video changes
    useEffect(() => {
        initAttemptRef.current = false;
        if (playerRef.current) {
            playerRef.current.dispose();
            playerRef.current = null;
            setPlayerReady(false);
        }
    }, [roomState?.videoId]);

    // Payment handler
    const handlePayment = async (type: 'stream' | 'points' | 'group') => {
        if (!roomState?.videoId || !videoMeta) return;
        setPurchasing(true);
        setError(null);

        try {
            if (type === 'points' || type === 'group') {
                const finalTotal = type === 'group' && participants.length > 1
                    ? calculateGroupPurchasePrice(videoMeta.pointsPrice, participants.length).finalTotal
                    : videoMeta.pointsPrice;

                await client.post('/payment/points/redeem', {
                    videoId: roomState.videoId,
                    totalPoints: finalTotal
                });
            } else {
                onPaymentRequired?.(roomState.videoId);
            }

            setShowPaymentModal(false);
            entitlement.refresh();
        } catch (err: any) {
            setError(err?.error || '支付失败');
        } finally {
            setPurchasing(false);
        }
    };

    // Viewer sync: follow host's play/pause/seek state from GunDB
    useEffect(() => {
        if (isHost || !playerRef.current || !roomState) return;

        const player = playerRef.current;
        if (roomState.isPlaying && player.paused()) {
            player.play().catch(() => { });
        } else if (!roomState.isPlaying && !player.paused()) {
            player.pause();
        }
        if (roomState.currentTime > 0) {
            const localTime = player.currentTime() || 0;
            const drift = Math.abs(localTime - roomState.currentTime);
            if (drift > 3) {
                player.currentTime(roomState.currentTime);
            }
        }
    }, [isHost, roomState?.isPlaying, roomState?.currentTime, roomState?.updatedAt]);

    // === RENDER ===

    // Loading state
    if (isLoading) {
        return (
            <div className="wp-video-screen">
                <div className="wp-video-loading">
                    <div className="wp-spinner" />
                    <span>加载中...</span>
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
            <div className="wp-video-screen wp-video-locked">
                <div className="wp-payment-prompt">
                    <Lock size={48} className="wp-lock-icon" />
                    <h3>此视频需要付费观看</h3>
                    <p className="wp-video-title">{videoMeta?.title}</p>

                    {streamPurchase && (
                        <div className="wp-stream-progress">
                            <AlertCircle size={16} />
                            <span>您已通过流支付购买了 {Math.floor(streamPurchase.paidUntilSeconds / 60)} 分钟</span>
                        </div>
                    )}

                    <div className="wp-payment-options">
                        {videoMeta && videoMeta.pointsPrice > 0 && (
                            <button className="wp-payment-btn wp-payment-points" onClick={() => { setPaymentType('points'); setShowPaymentModal(true); }}>
                                <CreditCard size={20} />
                                <span>积分购买</span>
                                <span className="wp-price">{videoMeta.pointsPrice} 积分</span>
                            </button>
                        )}

                        {videoMeta && videoMeta.streamPricePerMinute > 0 && (
                            <button className="wp-payment-btn wp-payment-stream" onClick={() => { setPaymentType('stream'); handlePayment('stream'); }}>
                                <Zap size={20} />
                                <span>流支付</span>
                                <span className="wp-price">{videoMeta.streamPricePerMinute} 积分/分钟</span>
                            </button>
                        )}

                        {isHost && groupPrice && videoMeta && participants.length > 1 && (
                            <button className="wp-payment-btn wp-payment-group" onClick={() => { setPaymentType('group'); setShowPaymentModal(true); }}>
                                <span className="wp-group-badge">团购</span>
                                <span>为全员购买</span>
                                <div className="wp-group-info">
                                    <span className="wp-original-price">{groupPrice.originalTotal} 积分</span>
                                    <span className="wp-final-price">{groupPrice.finalTotal} 积分</span>
                                    <span className="wp-discount">({Math.round((1 - groupPrice.discount) * 100)}% 折扣)</span>
                                </div>
                            </button>
                        )}
                    </div>

                    {error && <p className="wp-error">{error}</p>}
                </div>

                {showPaymentModal && (
                    <div className="wp-modal-overlay" onClick={() => setShowPaymentModal(false)}>
                        <div className="wp-modal" onClick={e => e.stopPropagation()}>
                            <h3>确认{paymentType === 'group' ? '团购' : '购买'}</h3>
                            {paymentType === 'points' && videoMeta && (
                                <p>将花费 <strong>{videoMeta.pointsPrice} 积分</strong> 购买此视频</p>
                            )}
                            {paymentType === 'group' && groupPrice && (
                                <div className="wp-group-summary">
                                    <p>为 {participants.length} 位观众购买</p>
                                    <p>原价: {groupPrice.originalTotal} 积分</p>
                                    <p className="wp-discount-highlight">折扣价: {groupPrice.finalTotal} 积分</p>
                                </div>
                            )}
                            <div className="wp-modal-actions">
                                <button className="wp-btn wp-btn-secondary" onClick={() => setShowPaymentModal(false)}>取消</button>
                                <button className="wp-btn wp-btn-primary" onClick={() => handlePayment(paymentType)} disabled={purchasing}>
                                    {purchasing ? '处理中...' : '确认支付'}
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        );
    }

    // Main video player view — video element is ALWAYS rendered here
    return (
        <div className="wp-video-screen wp-video-playing">
            <div data-vjs-player className="wp-video-player">
                <video
                    ref={videoRef}
                    className="video-js vjs-big-play-centered vjs-theme-city"
                    playsInline
                />
            </div>

            {/* Waiting overlay */}
            {roomState?.status === 'waiting' && (
                <div className="wp-sync-overlay">
                    <Play size={48} />
                    <span>等待开始...</span>
                </div>
            )}

            {error && (
                <div className="wp-error-overlay">
                    <AlertCircle size={24} />
                    <span>{error}</span>
                </div>
            )}
        </div>
    );
};

export default WatchPartyVideo;
