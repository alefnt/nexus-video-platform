// FILE: /video-platform/client-web/src/components/live/LiveFollowingNotification.tsx
/**
 * 关注列表直播通知组件
 * 
 * 功能：
 * - 显示关注的创作者正在直播的数量
 * - 点击展开下拉面板显示正在直播的列表
 * - 支持浏览器推送通知（需用户授权）
 */

import React, { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { getApiClient } from '../../lib/apiClient';

const client = getApiClient();

interface Channel {
    id: string;
    slug: string;
    displayName?: string;
    avatar?: string;
    isLive: boolean;
    user?: {
        nickname?: string;
        avatar?: string;
    };
}

// 请求浏览器推送权限
async function requestNotificationPermission(): Promise<boolean> {
    if (!('Notification' in window)) {
        console.warn('浏览器不支持推送通知');
        return false;
    }

    if (Notification.permission === 'granted') {
        return true;
    }

    if (Notification.permission === 'denied') {
        return false;
    }

    const permission = await Notification.requestPermission();
    return permission === 'granted';
}

// 发送浏览器推送通知
function sendBrowserNotification(title: string, options?: NotificationOptions) {
    if (Notification.permission === 'granted') {
        new Notification(title, {
            icon: '/icons/icon-192.png',
            badge: '/icons/icon-72.png',
            ...options
        });
    }
}

export default function LiveFollowingNotification() {
    const navigate = useNavigate();
    const [liveChannels, setLiveChannels] = useState<Channel[]>([]);
    const [allFollowing, setAllFollowing] = useState<Channel[]>([]);
    const [isOpen, setIsOpen] = useState(false);
    const [notificationsEnabled, setNotificationsEnabled] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);
    const previousLiveIds = useRef<Set<string>>(new Set());

    const jwt = typeof window !== 'undefined' ? sessionStorage.getItem('vp.jwt') : null;
    if (jwt) client.setJWT(jwt);

    // 检查通知权限
    useEffect(() => {
        if ('Notification' in window) {
            setNotificationsEnabled(Notification.permission === 'granted');
        }
    }, []);

    // 获取关注列表
    const fetchFollowing = async () => {
        if (!jwt) return;

        try {
            const res = await client.get<{
                ok: boolean;
                following: Channel[];
                liveNow: Channel[];
                liveCount: number;
            }>('/live/following');

            setAllFollowing(res.following || []);

            const newLiveChannels = res.liveNow || [];

            // 检测新开播的创作者，发送通知
            if (notificationsEnabled) {
                for (const channel of newLiveChannels) {
                    if (!previousLiveIds.current.has(channel.id)) {
                        // 新开播，发送通知
                        sendBrowserNotification(
                            `${channel.displayName || channel.user?.nickname || channel.slug} 正在直播`,
                            {
                                body: '点击进入直播间',
                                tag: `live-${channel.id}`,
                                data: { url: `/live/@${channel.slug}` }
                            }
                        );
                    }
                }
            }

            // 更新已知的直播ID
            previousLiveIds.current = new Set(newLiveChannels.map(c => c.id));
            setLiveChannels(newLiveChannels);

        } catch (err) {
            console.error('获取关注列表失败:', err);
        }
    };

    // 定时轮询检查直播状态
    useEffect(() => {
        if (!jwt) return;

        fetchFollowing();
        const interval = setInterval(fetchFollowing, 30000); // 每30秒检查一次

        return () => clearInterval(interval);
    }, [jwt, notificationsEnabled]);

    // 点击外部关闭下拉
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // 处理通知权限请求
    const handleEnableNotifications = async () => {
        const granted = await requestNotificationPermission();
        setNotificationsEnabled(granted);
        if (granted) {
            sendBrowserNotification('通知已开启', {
                body: '当你关注的创作者开播时，我们会通知你'
            });
        }
    };

    if (!jwt) {
        return null; // 未登录不显示
    }

    const liveCount = liveChannels.length;

    return (
        <div ref={dropdownRef} style={{ position: 'relative' }}>
            {/* 通知按钮 */}
            <button
                onClick={() => setIsOpen(!isOpen)}
                style={{
                    position: 'relative',
                    background: 'transparent',
                    border: 'none',
                    padding: '6px 12px',
                    cursor: 'pointer',
                    fontSize: 18,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4
                }}
            >
                <span>🔔</span>
                {liveCount > 0 && (
                    <span style={{
                        position: 'absolute',
                        top: 2,
                        right: 4,
                        background: '#ff0000',
                        color: '#fff',
                        fontSize: 10,
                        fontWeight: 700,
                        padding: '1px 5px',
                        borderRadius: 10,
                        minWidth: 16,
                        textAlign: 'center'
                    }}>
                        {liveCount}
                    </span>
                )}
            </button>

            {/* 下拉面板 */}
            {isOpen && (
                <div style={{
                    position: 'absolute',
                    top: '100%',
                    right: 0,
                    marginTop: 8,
                    width: 320,
                    maxHeight: 400,
                    overflowY: 'auto',
                    background: 'rgba(20, 20, 30, 0.95)',
                    backdropFilter: 'blur(20px)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: 16,
                    boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
                    zIndex: 1000
                }}>
                    {/* 标题栏 */}
                    <div style={{
                        padding: '16px',
                        borderBottom: '1px solid rgba(255,255,255,0.1)',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center'
                    }}>
                        <span style={{ fontWeight: 700, fontSize: 14 }}>
                            关注的直播 {liveCount > 0 && <span style={{ color: '#ff0000' }}>({liveCount})</span>}
                        </span>
                        {!notificationsEnabled && 'Notification' in window && (
                            <button
                                onClick={handleEnableNotifications}
                                style={{
                                    background: 'linear-gradient(135deg, #00D9FF, #00A8CC)',
                                    border: 'none',
                                    padding: '4px 12px',
                                    borderRadius: 12,
                                    fontSize: 11,
                                    color: '#000',
                                    fontWeight: 600,
                                    cursor: 'pointer'
                                }}
                            >
                                开启通知
                            </button>
                        )}
                    </div>

                    {/* 正在直播列表 */}
                    {liveCount > 0 ? (
                        <div style={{ padding: 8 }}>
                            {liveChannels.map(channel => (
                                <div
                                    key={channel.id}
                                    onClick={() => {
                                        navigate(`/live/@${channel.slug}`);
                                        setIsOpen(false);
                                    }}
                                    style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: 12,
                                        padding: 12,
                                        borderRadius: 12,
                                        cursor: 'pointer',
                                        transition: 'background 0.2s'
                                    }}
                                    onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'}
                                    onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                                >
                                    {/* 头像 */}
                                    <div style={{
                                        width: 40,
                                        height: 40,
                                        borderRadius: '50%',
                                        background: 'linear-gradient(135deg, #ff0080, #ff4444)',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        fontSize: 16,
                                        position: 'relative'
                                    }}>
                                        {channel.avatar || channel.user?.avatar ? (
                                            <img
                                                src={channel.avatar || channel.user?.avatar}
                                                alt=""
                                                style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }}
                                            />
                                        ) : (
                                            (channel.displayName || channel.slug)[0].toUpperCase()
                                        )}
                                        {/* 直播指示点 */}
                                        <span style={{
                                            position: 'absolute',
                                            bottom: 0,
                                            right: 0,
                                            width: 12,
                                            height: 12,
                                            background: '#ff0000',
                                            borderRadius: '50%',
                                            border: '2px solid rgba(20,20,30,0.95)'
                                        }} />
                                    </div>

                                    {/* 信息 */}
                                    <div style={{ flex: 1 }}>
                                        <div style={{ fontWeight: 600, fontSize: 13 }}>
                                            {channel.displayName || channel.user?.nickname || channel.slug}
                                        </div>
                                        <div style={{ fontSize: 11, color: '#ff4444' }}>
                                            🔴 正在直播
                                        </div>
                                    </div>

                                    {/* 进入按钮 */}
                                    <span style={{ fontSize: 16 }}>→</span>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div style={{
                            padding: 32,
                            textAlign: 'center',
                            color: 'var(--text-muted)'
                        }}>
                            <div style={{ fontSize: 32, marginBottom: 12 }}>📺</div>
                            <div style={{ fontSize: 13 }}>
                                {allFollowing.length > 0
                                    ? '关注的创作者暂未开播'
                                    : '去探索页关注喜欢的创作者吧'}
                            </div>
                        </div>
                    )}

                    {/* 查看全部 */}
                    {allFollowing.length > 0 && (
                        <div
                            onClick={() => {
                                navigate('/explore');
                                setIsOpen(false);
                            }}
                            style={{
                                padding: 12,
                                textAlign: 'center',
                                borderTop: '1px solid rgba(255,255,255,0.1)',
                                fontSize: 12,
                                color: 'var(--accent-cyan)',
                                cursor: 'pointer'
                            }}
                        >
                            查看全部关注 ({allFollowing.length})
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
