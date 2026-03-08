// FILE: /video-platform/client-web/src/pages/ChannelPage.tsx
/**
 * 创作者频道页...
 * 
 * 功能...
 * - 根据 @username 加载频道信息
 * - 如果正在直播，显示直播播放器
 * - 如果未直播，显示频道信息
 * - 支持关注/取消关注
 */

import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getApiClient } from '../lib/apiClient';
import LivePlayer from '../components/live/LivePlayer';
import LiveChat from '../components/live/LiveChat';
import LiveGiftEffect, { triggerGiftEffect } from '../components/live/LiveGiftEffect';
import LiveTipButton from '../components/live/LiveTipButton';
import { ConnectionState } from 'livekit-client';

const client = getApiClient();

interface CreatorChannel {
    id: string;
    slug: string;
    displayName?: string;
    avatar?: string;
    description?: string;
    isLive: boolean;
    currentRoomId?: string;
    followerCount: number;
    totalStreams: number;
    user?: {
        id: string;
        nickname?: string;
        avatar?: string;
        bio?: string;
    };
}

interface LiveRoom {
    roomId: string;
    title: string;
    creatorId: string;
    creatorName?: string;
    creatorAvatar?: string;
    status: string;
    viewerCount: number;
    totalTips: number;
}

export default function ChannelPage() {
    const { username } = useParams<{ username: string }>();
    const navigate = useNavigate();

    const [channel, setChannel] = useState<CreatorChannel | null>(null);
    const [currentRoom, setCurrentRoom] = useState<LiveRoom | null>(null);
    const [token, setToken] = useState<string | null>(null);
    const [livekitUrl, setLivekitUrl] = useState<string | null>(null);
    const [isHost, setIsHost] = useState(false);
    const [isFollowing, setIsFollowing] = useState(false);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [connectionState, setConnectionState] = useState<ConnectionState>(ConnectionState.Disconnected);
    const [viewerCount, setViewerCount] = useState(0);

    const jwt = typeof window !== 'undefined' ? sessionStorage.getItem('vp.jwt') : null;
    if (jwt) client.setJWT(jwt);

    useEffect(() => {
        if (username) {
            loadChannel();
        }
    }, [username]);

    const loadChannel = async () => {
        if (!username) return;

        setLoading(true);
        setError(null);

        try {
            // 获取频道信息
            const res = await client.get<{
                ok: boolean;
                channel: CreatorChannel;
                currentRoom: LiveRoom | null;
            }>(`/live/channel/${username}`);

            setChannel(res.channel);
            setCurrentRoom(res.currentRoom);

            // 如果正在直播，获...Token
            if (res.channel.isLive && res.currentRoom) {
                await loadToken(res.currentRoom.roomId);
            }
        } catch (err) {
            console.error("Failed to load channel data", err);
        }
    };

    const loadToken = async (roomId: string) => {
        try {
            const tokenRes = await client.post<{
                token: string;
                isHost: boolean;
                livekitUrl: string;
            }>('/live/room/token', { roomId });

            setToken(tokenRes.token);
            setLivekitUrl(tokenRes.livekitUrl);
            setIsHost(tokenRes.isHost);
        } catch (err: any) {
            console.error('Token fetch failed:', err);
        }
    };

    const checkFollowStatus = async (channelId: string) => {
        try {
            const res = await client.get<{ ok: boolean; isFollowing: boolean }>(
                `/live/channel/${channelId}/is-following`
            );
            setIsFollowing(res.isFollowing);
        } catch (err) {
            // Ignore
        }
    };

    const handleFollow = async () => {
        if (!channel || !jwt) {
            navigate('/login');
            return;
        }

        try {
            if (isFollowing) {
                await client.post('/live/channel/unfollow', { channelId: channel.id });
                setIsFollowing(false);
                setChannel(prev => prev ? { ...prev, followerCount: prev.followerCount - 1 } : null);
            } else {
                await client.post('/live/channel/follow', { channelId: channel.id });
                setIsFollowing(true);
                setChannel(prev => prev ? { ...prev, followerCount: prev.followerCount + 1 } : null);
            }
        } catch (err: any) {
            console.error('Follow action failed:', err);
        }
    };

    const handleDataReceived = (data: string) => {
        try {
            const message = JSON.parse(data);
            if (message.type === 'tip' && message.tip?.animation) {
                triggerGiftEffect({
                    id: message.tip.id,
                    type: 'gift',
                    animation: message.tip.animation,
                    fromName: message.tip.fromName || '匿名',
                    amount: message.tip.amount,
                    giftIcon: message.tip.giftIcon || '🎁',
                    giftName: message.tip.giftName || '礼物',
                });
            }
        } catch (e) {
            // Ignore
        }
    };

    if (loading) {
        return (
            <div className="min-h-full text-gray-200">
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh' }}>
                    <div className="spinner" style={{
                        width: 40, height: 40,
                        border: '3px solid rgba(255,255,255,0.3)',
                        borderTopColor: '#fff',
                        borderRadius: '50%',
                        animation: 'spin 1s linear infinite'
                    }} />
                </div>
            </div>
        );
    }

    if (error || !channel) {
        return (
            <div className="min-h-full text-gray-200">
                <div style={{
                    display: 'flex', flexDirection: 'column',
                    alignItems: 'center', justifyContent: 'center',
                    height: '60vh', gap: 20
                }}>
                    <h2>😢 {error || '频道不存在'}</h2>
                    <button className="btn-neon" onClick={() => navigate('/explore')}>
                        浏览其他直播
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-full text-gray-200 channel-page">

            <style>{`
                @keyframes spin {
                    to { transform: rotate(360deg); }
                }
                .channel-header {
                    display: flex;
                    align-items: center;
                    gap: 20px;
                    padding: 24px;
                    background: rgba(255,255,255,0.05);
                    border-radius: 16px;
                    margin-bottom: 24px;
                }
                .channel-avatar {
                    width: 80px;
                    height: 80px;
                    border-radius: 50%;
                    background: linear-gradient(135deg, #00ffff, #0080ff);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-size: 32px;
                }
                .channel-avatar img {
                    width: 100%;
                    height: 100%;
                    object-fit: cover;
                    border-radius: 50%;
                }
                .channel-info {
                    flex: 1;
                }
                .channel-name {
                    font-size: 24px;
                    font-weight: 700;
                    margin: 0 0 4px;
                }
                .channel-handle {
                    color: var(--text-muted);
                    font-size: 14px;
                    margin-bottom: 8px;
                }
                .channel-stats {
                    display: flex;
                    gap: 16px;
                    font-size: 13px;
                    color: var(--text-muted);
                }
                .follow-btn {
                    padding: 12px 32px;
                    border-radius: 24px;
                    font-size: 14px;
                    font-weight: 600;
                    cursor: pointer;
                    transition: all 0.2s;
                }
                .follow-btn.following {
                    background: rgba(255,255,255,0.1);
                    border: 1px solid rgba(255,255,255,0.3);
                    color: #fff;
                }
                .follow-btn.not-following {
                    background: linear-gradient(135deg, #ff0080, #ff4444);
                    border: none;
                    color: #fff;
                }
                .live-badge {
                    display: inline-flex;
                    align-items: center;
                    gap: 6px;
                    background: #ff0000;
                    color: #fff;
                    padding: 4px 12px;
                    border-radius: 12px;
                    font-size: 12px;
                    font-weight: 700;
                    margin-left: 12px;
                }
                .live-badge .dot {
                    width: 8px;
                    height: 8px;
                    background: #fff;
                    border-radius: 50%;
                    animation: pulse 1s infinite;
                }
                @keyframes pulse {
                    0%, 100% { opacity: 1; }
                    50% { opacity: 0.5; }
                }
                .offline-message {
                    text-align: center;
                    padding: 80px 20px;
                    background: rgba(255,255,255,0.03);
                    border-radius: 16px;
                }
                .offline-message .icon {
                    font-size: 64px;
                    margin-bottom: 20px;
                }
                .live-container {
                    display: grid;
                    grid-template-columns: 1fr 360px;
                    gap: 20px;
                }
                @media (max-width: 1200px) {
                    .live-container {
                        grid-template-columns: 1fr;
                    }
                }
                .player-wrapper {
                    position: relative;
                    background: #000;
                    border-radius: 16px;
                    overflow: hidden;
                }
            `}</style>

            <div style={{ maxWidth: 1600, margin: '0 auto', padding: '20px' }}>
                {/* 频道头部 */}
                <div className="channel-header">
                    <div className="channel-avatar">
                        {channel.avatar || channel.user?.avatar ? (
                            <img src={channel.avatar || channel.user?.avatar} alt="" />
                        ) : (
                            channel.displayName?.[0] || channel.slug[0].toUpperCase()
                        )}
                    </div>
                    <div className="channel-info">
                        <h1 className="channel-name">
                            {channel.displayName || channel.user?.nickname || channel.slug}
                            {channel.isLive && (
                                <span className="live-badge">
                                    <span className="dot"></span> 直播中
                                </span>
                            )}
                        </h1>
                        <div className="channel-handle">@{channel.slug}</div>
                        <div className="channel-stats">
                            <span>{channel.followerCount} 粉丝</span>
                            <span>{channel.totalStreams} 场直播</span>
                        </div>
                    </div>
                    <button
                        className={`follow-btn ${isFollowing ? 'following' : 'not-following'}`}
                        onClick={handleFollow}
                    >
                        {isFollowing ? '已关注' : '+ 关注'}
                    </button>
                </div>

                {/* 直播内容 */}
                {channel.isLive && currentRoom && token && livekitUrl ? (
                    <div className="live-container">
                        <div className="live-main">
                            <div className="player-wrapper">
                                <LivePlayer
                                    roomId={currentRoom.roomId}
                                    token={token}
                                    serverUrl={livekitUrl}
                                    hostIdentity={currentRoom.creatorId}
                                    onConnectionChange={setConnectionState}
                                    onParticipantCountChange={setViewerCount}
                                    onDataReceived={handleDataReceived}
                                >
                                    <div style={{
                                        position: 'absolute',
                                        right: -380,
                                        top: 0,
                                        width: 360,
                                        height: 'calc(100% - 60px)',
                                        minHeight: 400
                                    }}>
                                        <LiveChat roomId={currentRoom.roomId} />
                                    </div>
                                </LivePlayer>
                                <LiveGiftEffect />
                            </div>

                            <div style={{
                                padding: 16,
                                background: 'rgba(255,255,255,0.05)',
                                borderRadius: 12,
                                marginTop: 16
                            }}>
                                <h2 style={{ margin: '0 0 12px', fontSize: 18 }}>{currentRoom.title}</h2>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                                    <span style={{ color: 'var(--text-muted)', fontSize: 13 }}>
                                        👀 {viewerCount} 人观看
                                    </span>
                                    <LiveTipButton
                                        roomId={currentRoom.roomId}
                                        onTipSuccess={() => { }}
                                    />
                                </div>
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="offline-message">
                        <div className="icon">📺</div>
                        <h2 style={{ marginBottom: 8 }}>主播当前不在直播</h2>
                        <p style={{ color: 'var(--text-muted)' }}>
                            关注 ta 可以在开播时收到通知
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
}
