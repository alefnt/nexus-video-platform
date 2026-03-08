/**
 * useLiveRoom — 直播间状态管理 Hook
 *
 * 灵感来源：Fitting Pad 的快照模式 (Snapshot Pattern)
 * 所有直播间相关状态集中管理，UI 层只消费 snapshot + actions
 *
 * 封装了：
 *  - 房间加载/创建
 *  - 门票购买
 *  - 流支付心跳 + 清理
 *  - 排行榜加载
 *  - 礼物特效触发
 */

import { useEffect, useState, useCallback, useRef } from 'react';
import { getApiClient } from '../lib/apiClient';
import { ConnectionState } from 'livekit-client';

const client = getApiClient();

// ============ Types ============

export interface LiveRoom {
    roomId: string;
    title: string;
    description?: string;
    creatorId: string;
    creatorAddress: string;
    creatorName?: string;
    creatorAvatar?: string;
    status: 'live' | 'ended' | 'scheduled';
    category?: string;
    coverUrl?: string;
    viewerCount: number;
    peakViewerCount: number;
    totalTips: number;
    startedAt?: string;
}

export interface LeaderboardEntry {
    rank: number;
    userId: string;
    name?: string;
    totalAmount: number;
    tipCount: number;
}

export type LiveRoomStatus =
    | 'loading'
    | 'ready'
    | 'error'
    | 'needs-ticket'
    | 'needs-stream-auth'
    | 'ended';

export interface LiveRoomSnapshot {
    room: LiveRoom | null;
    status: LiveRoomStatus;
    error: string | null;

    // Connection
    token: string | null;
    livekitUrl: string | null;
    isHost: boolean;
    connectionState: ConnectionState;
    viewerCount: number;

    // Payment
    paymentMode: 'free' | 'ticket' | 'stream';
    ticketPrice: number;
    pricePerMinute: number;
    requiredPreAuth: number;
    streamBalance: number;
    totalCharged: number;

    // Ticket UI
    buyingTicket: boolean;
    ticketError: string | null;

    // Social
    leaderboard: LeaderboardEntry[];
    isLiked: boolean;
}

export interface LiveRoomActions {
    buyTicket: () => Promise<void>;
    loadLeaderboard: () => Promise<void>;
    handleLike: () => void;
    setConnectionState: (state: ConnectionState) => void;
    setViewerCount: (count: number) => void;
    handleDataReceived: (data: string) => void;
}

// ============ Hook ============

export function useLiveRoom(roomId: string | undefined): {
    snapshot: LiveRoomSnapshot;
    actions: LiveRoomActions;
} {
    // Room state
    const [room, setRoom] = useState<LiveRoom | null>(null);
    const [token, setToken] = useState<string | null>(null);
    const [livekitUrl, setLivekitUrl] = useState<string | null>(null);
    const [isHost, setIsHost] = useState(false);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [connectionState, setConnectionState] = useState<ConnectionState>(ConnectionState.Disconnected);
    const [viewerCount, setViewerCount] = useState(0);
    const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
    const [isLiked, setIsLiked] = useState(false);

    // Ticket state
    const [needsTicket, setNeedsTicket] = useState(false);
    const [ticketPrice, setTicketPrice] = useState(0);
    const [buyingTicket, setBuyingTicket] = useState(false);
    const [ticketError, setTicketError] = useState<string | null>(null);

    // Stream payment state
    const [paymentMode, setPaymentMode] = useState<'free' | 'ticket' | 'stream'>('free');
    const [streamSessionId, setStreamSessionId] = useState<string | null>(null);
    const [pricePerMinute, setPricePerMinute] = useState(0);
    const [streamBalance, setStreamBalance] = useState(0);
    const [totalCharged, setTotalCharged] = useState(0);
    const [needsStreamAuth, setNeedsStreamAuth] = useState(false);
    const [requiredPreAuth, setRequiredPreAuth] = useState(0);

    // Refs for callbacks
    const roomIdRef = useRef(roomId);
    roomIdRef.current = roomId;

    // JWT setup
    const jwt = typeof window !== 'undefined' ? sessionStorage.getItem('vp.jwt') : null;
    if (jwt) client.setJWT(jwt);

    // ---- Load Room ----
    const loadRoom = useCallback(async () => {
        if (!roomIdRef.current) return;
        const currentRoomId = roomIdRef.current;

        setLoading(true);
        setError(null);

        try {
            const roomRes = await client.get<{ room: LiveRoom }>(`/live/room/${currentRoomId}`);
            setRoom(roomRes.room);

            if (roomRes.room.status !== 'live') {
                setError('直播已结束');
                setLoading(false);
                return;
            }

            const tokenRes = await client.post<{
                token: string;
                isHost: boolean;
                livekitUrl: string;
                room: LiveRoom;
                paymentMode?: 'free' | 'ticket' | 'stream';
                pricePerMinute?: number;
                streamSessionId?: string;
            }>('/live/room/token', { roomId: currentRoomId });

            setToken(tokenRes.token);
            setLivekitUrl(tokenRes.livekitUrl);
            setIsHost(tokenRes.isHost);
            setPaymentMode(tokenRes.paymentMode || 'free');
            setPricePerMinute(Number(tokenRes.pricePerMinute || 0));
            setStreamSessionId(tokenRes.streamSessionId || null);

            loadLeaderboard();
        } catch (err: any) {
            if (err?.code === 'payment_required' || err?.error?.includes('私密直播')) {
                const mode = err?.paymentMode || 'ticket';
                setPaymentMode(mode);

                if (mode === 'ticket') {
                    setNeedsTicket(true);
                    setTicketPrice(Number(err.ticketPrice || 0));
                } else if (mode === 'stream') {
                    setNeedsStreamAuth(true);
                    setPricePerMinute(Number(err.pricePerMinute || 0));
                    setRequiredPreAuth(Number(err.requiredPreAuth || 0));
                    setStreamBalance(Number(err.currentBalance || 0));
                }
                setLoading(false);
                return;
            }

            setError(err?.error || err?.message || '加载失败');
        } finally {
            if (!needsTicket) setLoading(false);
        }
    }, []);

    // ---- Actions ----
    const buyTicket = useCallback(async () => {
        setBuyingTicket(true);
        setTicketError(null);
        try {
            const res = await client.post<{ ok: boolean; ticket: any }>('/live/room/ticket/buy', { roomId: roomIdRef.current });
            if (res.ok) {
                setNeedsTicket(false);
                loadRoom();
            }
        } catch (err: any) {
            const msg = err?.error || err?.message || '购买失败';
            if (err?.code === 'insufficient_balance') {
                setTicketError("余额不足，请充值积分");
            } else {
                setTicketError(msg);
            }
        } finally {
            setBuyingTicket(false);
        }
    }, [loadRoom]);

    const loadLeaderboard = useCallback(async () => {
        if (!roomIdRef.current) return;
        try {
            const res = await client.get<{
                leaderboard: LeaderboardEntry[];
                totalTips: number;
            }>(`/live/tip/leaderboard/${roomIdRef.current}?limit=10`);
            setLeaderboard(res.leaderboard || []);
        } catch (err) {
            console.error('Load leaderboard failed:', err);
        }
    }, []);

    const handleLike = useCallback(() => {
        setIsLiked(true);
        setTimeout(() => setIsLiked(false), 300);
    }, []);

    const handleDataReceived = useCallback((data: string) => {
        try {
            const message = JSON.parse(data);
            if (message.type === 'tip' && message.tip?.animation) {
                // 由外部消费者处理礼物特效
                // 此处只负责更新排行榜
                loadLeaderboard();
            }
        } catch {
            // 忽略解析错误
        }
    }, [loadLeaderboard]);

    // ---- Effects ----

    // Load room on mount
    useEffect(() => {
        if (roomId) loadRoom();
    }, [roomId]);

    // Stream payment heartbeat
    useEffect(() => {
        if (!streamSessionId || paymentMode !== 'stream') return;

        const tickInterval = setInterval(async () => {
            try {
                const res = await client.post<{
                    ok: boolean;
                    viewerBalance: number;
                    totalCharged: number;
                    chargedAmount: number;
                    pricePerMinute: number;
                }>('/live/stream/tick', { sessionId: streamSessionId });

                if (res.ok) {
                    setStreamBalance(res.viewerBalance);
                    setTotalCharged(res.totalCharged);
                }
            } catch (err: any) {
                if (err?.code === 'insufficient_balance' || err?.code === 'session_closed') {
                    setError('余额不足，观看已结束');
                    setToken(null);
                }
            }
        }, 5000);

        return () => clearInterval(tickInterval);
    }, [streamSessionId, paymentMode]);

    // Cleanup stream session on leave
    useEffect(() => {
        const handleBeforeUnload = () => {
            if (streamSessionId && paymentMode === 'stream') {
                const data = JSON.stringify({ sessionId: streamSessionId });
                const gateway = (import.meta as any)?.env?.VITE_API_GATEWAY_URL || '';
                navigator.sendBeacon(`${gateway}/live/stream/leave`, data);
            }
        };

        window.addEventListener('beforeunload', handleBeforeUnload);
        return () => {
            window.removeEventListener('beforeunload', handleBeforeUnload);
            if (streamSessionId && paymentMode === 'stream') {
                client.post('/live/stream/leave', { sessionId: streamSessionId }).catch(() => { });
            }
        };
    }, [streamSessionId, paymentMode]);

    // ---- Build Snapshot ----
    const computeStatus = (): LiveRoomStatus => {
        if (loading) return 'loading';
        if (error) return 'error';
        if (needsTicket) return 'needs-ticket';
        if (needsStreamAuth) return 'needs-stream-auth';
        if (room?.status === 'ended') return 'ended';
        return 'ready';
    };

    const snapshot: LiveRoomSnapshot = {
        room,
        status: computeStatus(),
        error,
        token,
        livekitUrl,
        isHost,
        connectionState,
        viewerCount,
        paymentMode,
        ticketPrice,
        pricePerMinute,
        requiredPreAuth,
        streamBalance,
        totalCharged,
        buyingTicket,
        ticketError,
        leaderboard,
        isLiked,
    };

    const actions: LiveRoomActions = {
        buyTicket,
        loadLeaderboard,
        handleLike,
        setConnectionState,
        setViewerCount,
        handleDataReceived,
    };

    return { snapshot, actions };
}

export default useLiveRoom;
