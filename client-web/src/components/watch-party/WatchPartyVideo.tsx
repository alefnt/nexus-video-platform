// FILE: /video-platform/client-web/src/components/watch-party/WatchPartyVideo.tsx
/**
 * Watch Party 视频播放组件
 * 带有付费检查、流支付恢复、和同步播放功能
 */

import React, { useRef, useEffect, useState, useCallback } from 'react';
import { Play, Pause, AlertCircle, Lock, CreditCard, Zap } from 'lucide-react';
import videojs from 'video.js';
import 'video.js/dist/video-js.css';
import { useVideoEntitlement, StreamPurchaseProgress, calculateGroupPurchasePrice } from '../../hooks/useVideoEntitlement';
import type { RoomState, Participant } from '../../hooks/useWatchPartySync';
import { getApiClient } from '../../lib/apiClient';

const client = getApiClient();

interface WatchPartyVideoProps {
    roomState: RoomState | null;
    userId: string;
    isHost: boolean;
    participants: Participant[];
    onTimeUpdate?: (time: number) => void;
    onPaymentRequired?: (videoId: string) => void;
    onPlayStateChange?: (isPlaying: boolean, currentTime: number) => void;
    syncToTime?: number | null;
    syncIsPlaying?: boolean | null;
    streamUrl?: string; // Direct HLS/MP4 URL (for demo videos)
}

export const WatchPartyVideo: React.FC<WatchPartyVideoProps> = ({
    roomState,
    userId,
    isHost,
    participants,
    onTimeUpdate,
    onPaymentRequired,
    onPlayStateChange,
    syncToTime,
    syncIsPlaying,
    streamUrl: directStreamUrl,
}) => {
    const videoRef = useRef<HTMLVideoElement>(null);
    const playerRef = useRef<any>(null);
    const [showPaymentModal, setShowPaymentModal] = useState(false);
    const [paymentType, setPaymentType] = useState<'stream' | 'points' | 'group'>('points');
    const [purchasing, setPurchasing] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Get video entitlement status (skip for demo videos with direct URL)
    const entitlement = useVideoEntitlement(
        directStreamUrl ? '' : (roomState?.videoId || ''),  // empty string skips the check
        userId
    );

    // Destructure for cleaner access
    const { isLoading: entitlementLoading, hasFullAccess, isCreator, requiresPayment, streamPurchase, videoMeta } = entitlement;
    // For demo videos with direct URL, skip entitlement loading
    const isLoading = directStreamUrl ? false : entitlementLoading;

    // Resolve video stream URL
    const resolveVideoUrl = async (): Promise<string | null> => {
        // 1. Direct stream URL (demo videos)
        if (directStreamUrl) return directStreamUrl;

        // 2. From metadata API (real platform videos)
        try {
            const jwt = sessionStorage.getItem('vp.jwt') || localStorage.getItem('jwt');
            if (jwt) client.setJWT(jwt);
            const meta = await client.get<any>(`/metadata/${roomState?.videoId}`);
            const url = meta?.cdnUrl || meta?.cfPlaybackHls || meta?.videoUrl;
            if (url) return url;
        } catch (e) {
            console.warn('[WatchParty] Metadata fetch failed:', e);
        }

        // 3. videoMeta from entitlement hook
        if ((videoMeta as any)?.cdnUrl) return (videoMeta as any).cdnUrl;

        return null;
    };

    // Initialize video player
    useEffect(() => {
        if (!videoRef.current || !roomState?.videoId || isLoading) return;

        // Don't initialize if payment required and no access (but skip for demo videos with direct URLs)
        if (!directStreamUrl && requiresPayment && !hasFullAccess) {
            return;
        }

        const initPlayer = async () => {
            try {
                const videoUrl = await resolveVideoUrl();

                if (!videoUrl) {
                    setError('无法获取视频地址');
                    return;
                }

                // Determine source type
                const isHLS = videoUrl.includes('.m3u8');
                const sourceType = isHLS ? 'application/x-mpegURL' : 'video/mp4';

                // Initialize video.js
                if (!playerRef.current && videoRef.current) {
                    playerRef.current = videojs(videoRef.current!, {
                        controls: true,
                        autoplay: false,
                        preload: 'auto',
                        fluid: true,
                        sources: [{ src: videoUrl, type: sourceType }]
                    });

                    // Sync time updates
                    playerRef.current.on('timeupdate', () => {
                        if (isHost && onTimeUpdate) {
                            onTimeUpdate(playerRef.current.currentTime());
                        }
                    });
                } else if (playerRef.current) {
                    playerRef.current.src({ src: videoUrl, type: sourceType });
                }

                // If resuming from stream payment, seek to paid position
                if (streamPurchase && streamPurchase.paidUntilSeconds > 0) {
                    playerRef.current.currentTime(streamPurchase.paidUntilSeconds);
                }

                // Auto-play if room is playing
                if (roomState.status === 'playing') {
                    playerRef.current.play().catch(() => {});
                    if (roomState.currentTime) {
                        playerRef.current.currentTime(roomState.currentTime);
                    }
                }

                // Host: broadcast play/pause events + periodic time sync
                if (isHost && onPlayStateChange) {
                    playerRef.current.on('play', () => {
                        onPlayStateChange(true, playerRef.current.currentTime());
                    });
                    playerRef.current.on('pause', () => {
                        onPlayStateChange(false, playerRef.current.currentTime());
                    });
                    playerRef.current.on('seeked', () => {
                        onPlayStateChange(!playerRef.current.paused(), playerRef.current.currentTime());
                    });
                }
            } catch (err: any) {
                console.error('Failed to init video player:', err);
                setError(err?.message || '视频加载失败');
            }
        };

        initPlayer();

        return () => {
            if (playerRef.current) {
                playerRef.current.dispose();
                playerRef.current = null;
            }
        };
    }, [roomState?.videoId, isLoading, hasFullAccess, requiresPayment, isHost, streamPurchase]);

    // Viewer: React to external sync signals (play/pause/seek from host via WS)
    useEffect(() => {
        if (isHost || !playerRef.current) return;

        if (syncIsPlaying === true && playerRef.current.paused()) {
            playerRef.current.play().catch(() => {});
        } else if (syncIsPlaying === false && !playerRef.current.paused()) {
            playerRef.current.pause();
        }

        if (syncToTime != null && Math.abs(playerRef.current.currentTime() - syncToTime) > 2) {
            playerRef.current.currentTime(syncToTime);
        }
    }, [syncToTime, syncIsPlaying, isHost]);

    // Handle payment
    const handlePayment = async (type: 'stream' | 'points' | 'group') => {
        if (!roomState?.videoId || !videoMeta) return;

        setPurchasing(true);
        setError(null);

        try {
            const jwt = sessionStorage.getItem('vp.token') || localStorage.getItem('jwt');
            if (jwt) client.setJWT(jwt);

            if (type === 'points') {
                // One-time points purchase
                await client.post('/payment/buy-once', {
                    videoId: roomState.videoId,
                    points: videoMeta.pointsPrice
                });
            } else if (type === 'group') {
                // Group purchase for all participants
                const participantIds = participants.map(p => p.id);
                const { finalTotal } = calculateGroupPurchasePrice(videoMeta.pointsPrice, participantIds.length);

                await client.post('/payment/group-purchase', {
                    videoId: roomState.videoId,
                    buyerUserId: userId,
                    recipientUserIds: participantIds,
                    totalPoints: finalTotal
                });
            } else {
                // Stream payment - will be handled during playback
                onPaymentRequired?.(roomState.videoId);
            }

            setShowPaymentModal(false);
            // Refresh entitlement
            entitlement.refresh();
        } catch (err: any) {
            setError(err?.error || '支付失败');
        } finally {
            setPurchasing(false);
        }
    };

    // Render loading state
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

    // Render payment required state
    if (requiresPayment && !hasFullAccess) {
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
                        {/* Points purchase */}
                        {videoMeta && videoMeta.pointsPrice > 0 && (
                            <button
                                className="wp-payment-btn wp-payment-points"
                                onClick={() => { setPaymentType('points'); setShowPaymentModal(true); }}
                            >
                                <CreditCard size={20} />
                                <span>积分购买</span>
                                <span className="wp-price">{videoMeta.pointsPrice} 积分</span>
                            </button>
                        )}

                        {/* Stream payment */}
                        {videoMeta && videoMeta.streamPricePerMinute > 0 && (
                            <button
                                className="wp-payment-btn wp-payment-stream"
                                onClick={() => { setPaymentType('stream'); handlePayment('stream'); }}
                            >
                                <Zap size={20} />
                                <span>流支付</span>
                                <span className="wp-price">{videoMeta.streamPricePerMinute} 积分/分钟</span>
                            </button>
                        )}

                        {/* Group purchase (host only) */}
                        {isHost && groupPrice && videoMeta && participants.length > 1 && (
                            <button
                                className="wp-payment-btn wp-payment-group"
                                onClick={() => { setPaymentType('group'); setShowPaymentModal(true); }}
                            >
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

                {/* Payment confirmation modal */}
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
                                    <p className="wp-discount-highlight">折扣价: {groupPrice.finalTotal} 积分 (省 {groupPrice.originalTotal - groupPrice.finalTotal} 积分)</p>
                                </div>
                            )}

                            <div className="wp-modal-actions">
                                <button className="wp-btn wp-btn-secondary" onClick={() => setShowPaymentModal(false)}>
                                    取消
                                </button>
                                <button
                                    className="wp-btn wp-btn-primary"
                                    onClick={() => handlePayment(paymentType)}
                                    disabled={purchasing}
                                >
                                    {purchasing ? '处理中...' : '确认支付'}
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        );
    }

    // Render video player
    return (
        <div className="wp-video-screen wp-video-playing">
            <div data-vjs-player>
                <video
                    ref={videoRef}
                    className="video-js vjs-big-play-centered vjs-theme-city"
                    playsInline
                />
            </div>

            {/* Sync status overlay */}
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
