// FILE: /video-platform/client-web/src/pages/Live.tsx
/**
 * Viewer Page (Nexus Prime UI)
 * 
 * Features:
 * - Theater Mode Layout
 * - Immersive Video Player with Danmaku
 * - Real-time Chat & Gifting
 * - Leaderboard
 * - Cyberpunk/Neon Aesthetics
 */

import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getApiClient } from '../lib/apiClient';
import TopNav from '../components/TopNav';
import LivePlayer from '../components/live/LivePlayer';
import LiveChat, { ChatMessage } from '../components/live/LiveChat';
import DanmakuOverlay from '../components/live/DanmakuOverlay';
import LiveGiftEffect, { triggerGiftEffect } from '../components/live/LiveGiftEffect';
import LiveTipButton from '../components/live/LiveTipButton';
import { ConnectionState } from 'livekit-client';
import { LiveKitRoom, useDataChannel, LayoutContextProvider } from '@livekit/components-react';
import '@livekit/components-styles';

const client = getApiClient();

interface LiveRoom {
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

interface LeaderboardEntry {
    rank: number;
    userId: string;
    name?: string;
    totalAmount: number;
    tipCount: number;
}

// --- Inner Content Component (Inside LiveKitRoom) ---
function LiveContent({
    room,
    token,
    livekitUrl,
    initialViewerCount,
    onTipSuccess,
    leaderboard,
}: {
    room: LiveRoom,
    token: string,
    livekitUrl: string,
    initialViewerCount: number,
    onTipSuccess: () => void,
    leaderboard: LeaderboardEntry[]
}) {
    const navigate = useNavigate();
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [viewerCount, setViewerCount] = useState(initialViewerCount);
    const [connectionState, setConnectionState] = useState<ConnectionState>(ConnectionState.Disconnected);
    const [isLiked, setIsLiked] = useState(false);
    const [showDanmaku, setShowDanmaku] = useState(true);

    // Data Channel for Chat & Tips
    useDataChannel('chat', (msg) => {
        try {
            const data = JSON.parse(new TextDecoder().decode(msg.payload));
            const now = Date.now();

            if (data.type === 'tip') {
                const tipMessage: ChatMessage = {
                    id: data.tip?.id || `tip-${now}-${Math.random()}`,
                    type: 'tip',
                    fromName: data.tip?.fromName || 'Anonymous',
                    content: data.tip?.message || `Sent ${data.tip?.giftName || 'Gift'}`,
                    timestamp: now,
                    tipAmount: data.tip?.amount,
                    giftIcon: data.tip?.giftIcon,
                    giftName: data.tip?.giftName,
                    animation: data.tip?.animation,
                };
                setMessages(prev => [...prev.slice(-99), tipMessage]);

                if (data.tip?.animation) {
                    triggerGiftEffect({
                        id: tipMessage.id,
                        type: 'gift',
                        animation: data.tip.animation,
                        fromName: tipMessage.fromName,
                        amount: tipMessage.tipAmount || 0,
                        giftIcon: tipMessage.giftIcon || '🎁',
                        giftName: tipMessage.giftName || 'Gift',
                    });
                    onTipSuccess(); // Refresh leaderboard
                }
            } else if (data.type === 'chat') {
                const chatMessage: ChatMessage = {
                    id: data.id || `msg-${now}-${Math.random()}`,
                    type: 'chat',
                    fromName: data.fromName || 'Anonymous',
                    content: data.content || '',
                    timestamp: now,
                };
                setMessages(prev => [...prev.slice(-99), chatMessage]);
            }
        } catch (e) {
            console.error('Failed to parse message:', e);
        }
    });

    const handleSendMessage = useCallback((text: string) => {
        // Optimistically add message (LeadKit send is handled in LiveChat if passed? No, LiveChat is pure UI now)
        // Wait, LiveChat handled sending before. Now LiveContent should handle sending?
        // Actually LiveChat was refactored to remove useDataChannel.
        // So sending must happen HERE or passed down.
        // But `useDataChannel` returns `send`.
        // I need to capture `send` here and pass it down?
        // `useDataChannel` hook returns { send, isPublishing... }
        // Yes.
    }, []);

    // Re-implement send logic properly
    const { send } = useDataChannel('chat'); // Get send function

    const onSendMessage = useCallback((text: string) => {
        const message = {
            type: 'chat',
            id: `msg-${Date.now()}`,
            fromName: (() => { try { const u = sessionStorage.getItem('vp.user'); return u ? (JSON.parse(u).username || JSON.parse(u).email || 'Anonymous') : 'Anonymous'; } catch { return 'Anonymous'; } })(),
            content: text,
        };

        try {
            send(new TextEncoder().encode(JSON.stringify(message)), { reliable: true });

            // Local echo
            setMessages(prev => [...prev.slice(-99), {
                id: message.id,
                type: 'chat',
                fromName: message.fromName,
                content: message.content,
                timestamp: Date.now()
            }]);
        } catch (e) {
            console.error("Send failed", e);
        }
    }, [send]);


    const handleLike = () => {
        setIsLiked(true);
        setTimeout(() => setIsLiked(false), 300);
        // Send like to backend
        client.post('/live/room/like', { roomId: room.roomId }).catch(() => { });
    };

    return (
        <div className="flex-1 flex overflow-hidden w-full mx-auto">
            {/* Center: Video Player Area */}
            <main className="flex-1 flex flex-col p-4 lg:p-6 overflow-y-auto relative custom-scrollbar">
                {/* Player Wrapper */}
                <div className="w-full aspect-video rounded-2xl bg-black relative overflow-hidden shadow-[0_0_100px_rgba(34,211,238,0.1),inset_0_0_0_1px_rgba(255,255,255,0.1)] group mx-auto max-w-6xl">
                    <LivePlayer
                        roomId={room.roomId}
                        token={token}
                        serverUrl={livekitUrl}
                        hostIdentity={room.creatorId}
                        onConnectionChange={setConnectionState}
                        onParticipantCountChange={setViewerCount}
                        className="w-full h-full"
                    >
                        {/* Danmaku Overlay */}
                        {showDanmaku && <DanmakuOverlay messages={messages} />}

                        {/* Mobile Chat Overlay (Visible only on mobile) */}
                        <div className="lg:hidden absolute bottom-0 left-0 right-0 h-1/2 bg-gradient-to-t from-black/90 to-transparent p-4 flex flex-col justify-end pointer-events-none">
                            <div className="pointer-events-auto h-full overflow-hidden mask-image-linear-to-t">
                                <LiveChat messages={messages} className="bg-transparent" />
                            </div>
                        </div>
                    </LivePlayer>
                    <LiveGiftEffect />

                    {/* Live Badge */}
                    <div className="absolute top-6 left-6 flex items-center gap-3">
                        <div className="bg-red-600 text-white px-3 py-1 rounded-md text-xs font-bold tracking-widest flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-white animate-pulse"></span> LIVE
                        </div>
                        <div className="glass-panel px-3 py-1 rounded-md text-white text-xs font-medium flex items-center gap-2">
                            <svg className="w-3.5 h-3.5 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path>
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"></path>
                            </svg>
                            {viewerCount}
                        </div>
                    </div>
                </div>

                {/* Stream Info & Actions */}
                <div className="mt-8 mx-auto w-full max-w-6xl">
                    <div className="flex items-start justify-between">
                        <div>
                            <h1 className="text-3xl font-bold text-white mb-2">{room.title}</h1>
                            <div className="flex items-center gap-4 text-sm text-gray-400">
                                <span className="text-blue-400 font-semibold cursor-pointer py-0.5 rounded-full hover:underline">{room.category || 'Live Stream'}</span>
                                <span>...</span>
                                <span>Started {room.startedAt ? new Date(room.startedAt).toLocaleTimeString() : 'Recently'}</span>
                            </div>
                        </div>

                        {/* Creator Badge */}
                        <div className="flex items-center gap-4 bg-white/5 p-3 rounded-2xl border border-white/10 hover:bg-white/10 cursor-pointer transition-colors" onClick={() => navigate(`/profile/${room.creatorAddress}`)}>
                            <div className="w-12 h-12 rounded-full bg-cover" style={{ backgroundImage: `url(${room.creatorAvatar || "https://api.dicebear.com/7.x/avataaars/svg?seed=" + room.creatorId})` }}>
                            </div>
                            <div>
                                <div className="text-white font-bold flex items-center gap-1">{room.creatorName || "Anonymous Host"} <svg className="w-4 h-4 text-nexusCyan" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"></path></svg></div>
                                <div className="text-xs text-gray-400">💰 {room.totalTips} PTS Total Support</div>
                            </div>
                            <button className="ml-4 bg-white text-black px-4 py-1.5 rounded-full text-sm font-bold hover:bg-gray-200" onClick={(e) => { e.stopPropagation(); client.post('/metadata/follow', { targetId: room.creatorId, targetAddress: room.creatorAddress }).catch(() => { }); (e.target as HTMLButtonElement).textContent = 'Following'; (e.target as HTMLButtonElement).disabled = true; }}>Follow</button>
                        </div>
                    </div>

                    <div className="flex items-center gap-3 mt-6">
                        <button
                            onClick={handleLike}
                            className={`px-6 py-2 rounded-full font-bold flex items-center justify-center gap-2 transition-all ${isLiked ? 'bg-nexusPink/20 text-nexusPink border border-pink-500/50 shadow-[0_0_20px_rgba(236,72,153,0.4)] scale-110' : 'bg-white/5 border border-white/10 hover:bg-white/10'}`}
                        >
                            <span className={isLiked ? 'animate-bounce' : ''}>❤️</span> LIKE
                        </button>
                        <LiveTipButton roomId={room.roomId} onTipSuccess={onTipSuccess} />
                        <button className="p-2 px-6 rounded-full bg-white/5 border border-white/10 hover:bg-white/10" onClick={() => { navigator.clipboard.writeText(window.location.href).then(() => { const btn = document.activeElement as HTMLButtonElement; if (btn) { btn.textContent = '✅ Copied!'; setTimeout(() => { btn.textContent = '🔗 Share'; }, 2000); } }); }}>
                            🔗 Share
                        </button>
                    </div>

                    <p className="mt-8 text-gray-400 text-sm leading-relaxed max-w-4xl">
                        {room.description || 'Welcome to the live stream! Ensure you follow community guidelines while participating in the chat.'}
                    </p>
                </div>
            </main>

            {/* Right Sidebar: Chat & Leaderboard (Hidden on Mobile) */}
            <aside className="hidden lg:flex w-[380px] flex-shrink-0 bg-black/40 backdrop-blur-md flex-col h-full border-l border-white/5 shadow-2xl relative z-20">
                {/* Leaderboard Header */}
                <div className="h-16 border-b border-white/5 flex items-center justify-between px-6 bg-black/40">
                    <h3 className="font-bold text-white flex items-center gap-2 text-sm text-accent-yellow">
                        🏆 TOP CONTRIBUTORS
                    </h3>
                </div>
                {/* Leaderboard List */}
                <div className="overflow-y-auto custom-scrollbar p-2 space-y-1 max-h-[30%] border-b border-white/5 bg-[#0A0A14]">
                    {leaderboard.length === 0 ? (
                        <div className="text-center text-xs text-text-muted py-4">Be the first to support!</div>
                    ) : (
                        leaderboard.map((entry, idx) => (
                            <div key={entry.userId} className="flex items-center gap-3 p-2 rounded hover:bg-white/5 transition-colors">
                                <span className={`w-5 h-5 flex items-center justify-center rounded text-[10px] font-bold ${idx === 0 ? 'bg-yellow-500 text-black' : idx === 1 ? 'bg-gray-300 text-black' : idx === 2 ? 'bg-orange-400 text-black' : 'bg-white/10 text-text-muted'}`}>
                                    {entry.rank}
                                </span>
                                <span className="text-xs font-bold text-gray-300 truncate flex-1">{entry.name || 'User'}</span>
                                <span className="text-xs font-mono text-accent-yellow">{entry.totalAmount}</span>
                            </div>
                        ))
                    )}
                </div>

                {/* Chat Section */}
                <div className="h-12 border-b border-white/5 flex items-center justify-between px-6 bg-black/40">
                    <h3 className="font-bold text-white flex items-center gap-2">
                        <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"></path>
                        </svg>
                        Live Chat
                    </h3>
                </div>
                <div className="flex-1 min-h-0 flex flex-col">
                    <LiveChat
                        messages={messages}
                        onSendMessage={onSendMessage}
                        showDanmaku={showDanmaku}
                        onToggleDanmaku={setShowDanmaku}
                    />
                </div>
            </aside>
        </div>
    );
}


export default function Live() {
    const { roomId } = useParams<{ roomId: string }>();
    const navigate = useNavigate();

    const [room, setRoom] = useState<LiveRoom | null>(null);
    const [token, setToken] = useState<string | null>(null);
    const [livekitUrl, setLivekitUrl] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);

    // Pay Gate States
    const [needsTicket, setNeedsTicket] = useState(false);
    const [ticketPrice, setTicketPrice] = useState(0);
    const [buyingTicket, setBuyingTicket] = useState(false);
    const [ticketError, setTicketError] = useState<string | null>(null);
    const [needsStreamAuth, setNeedsStreamAuth] = useState(false);
    const [pricePerSecond, setPricePerSecond] = useState(0);
    const [requiredPreAuth, setRequiredPreAuth] = useState(0);

    // Initial Load
    useEffect(() => {
        if (roomId) loadRoom();
    }, [roomId]);

    const loadRoom = async () => {
        if (!roomId) return;
        setLoading(true);
        setError(null);
        try {
            const roomRes = await client.get<{ room: LiveRoom }>(`/live/room/${roomId}`);
            setRoom(roomRes.room);

            if (roomRes.room.status !== 'live') {
                setError('Stream has ended');
                setLoading(false);
                return;
            }

            // Get Token
            const tokenRes = await client.post<{
                token: string;
                livekitUrl: string;
                paymentMode?: string;
                ticketPrice?: number;
                pricePerMinute?: number;
                requiredPreAuth?: number;
            }>('/live/room/token', { roomId });

            setToken(tokenRes.token);
            setLivekitUrl(tokenRes.livekitUrl);
            loadLeaderboard();
        } catch (err: any) {
            // Handle Payment/Private Gates
            if (err?.code === 'payment_required' || err?.error?.includes('私密') || err?.error?.includes('Private')) {
                const mode = err?.paymentMode || 'ticket';
                if (mode === 'ticket') {
                    setNeedsTicket(true);
                    setTicketPrice(Number(err.ticketPrice || 0));
                } else if (mode === 'stream') {
                    setNeedsStreamAuth(true);
                    setPricePerSecond(Number(err.pricePerSecond || err.pricePerMinute / 60 || 0));
                    setRequiredPreAuth(Number(err.requiredPreAuth || 0));
                }
                setLoading(false);
                return;
            }
            // Graceful error for room not found, stream offline, etc.
            const errMsg = err?.error || err?.message || '';
            const is404 = Number(err?.status || 0) === 404 || err?.code === 'not_found' || errMsg.toLowerCase().includes('not found');
            setError(is404 ? 'This live stream is not available or has ended.' : (errMsg || 'Stream is currently offline.'));
        } finally {
            if (!needsTicket && !needsStreamAuth) setLoading(false);
        }
    };

    const loadLeaderboard = async () => {
        if (!roomId) return;
        try {
            const res = await client.get<{ leaderboard: LeaderboardEntry[] }>(`/live/tip/leaderboard/${roomId}?limit=20`);
            setLeaderboard(res.leaderboard || []);
        } catch (e) {
            console.error(e);
        }
    };

    const handleBuyTicket = async () => {
        setBuyingTicket(true);
        setTicketError(null);
        try {
            const res = await client.post<{ ok: boolean }>('/live/room/ticket/buy', { roomId });
            if (res.ok) {
                setNeedsTicket(false);
                loadRoom();
            }
        } catch (err: any) {
            setTicketError(err?.error || 'Purchase failed');
        } finally {
            setBuyingTicket(false);
        }
    };

    // Render loading/error
    if (loading) return (
        <div className="page flex items-center justify-center h-screen">
            <div className="flex flex-col items-center gap-4">
                <div className="w-12 h-12 border-4 border-accent-cyan/20 border-t-accent-cyan rounded-full animate-spin" />
                <div className="text-accent-cyan font-bold tracking-widest animate-pulse">CONNECTING TO NEURAL NET...</div>
            </div>
        </div>
    );

    if (error || !room) return (
        <div className="page flex items-center justify-center h-screen">
            <div className="glass-panel p-8 text-center max-w-md border-red-500/30">
                <div className="text-4xl mb-4">⚠️</div>
                <h2 className="text-xl font-bold text-red-500 mb-2">STREAM OFFLINE</h2>
                <p className="text-text-muted mb-6">{error || "Signal lost."}</p>
                <button onClick={() => navigate('/')} className="px-6 py-2 bg-white/10 hover:bg-white/20 rounded-full font-bold transition-all">
                    RETURN TO BASE
                </button>
            </div>
        </div>
    );

    return (
        <div className="flex flex-col h-screen bg-[#050510] text-white overflow-hidden font-sans">
            {/* Custom HDR Header for Live */}
            <header className="h-16 flex-shrink-0 flex items-center justify-between px-6 bg-[#050510] border-b border-white/5 z-20">
                <div className="flex items-center gap-6">
                    <button onClick={() => navigate(-1)} className="text-gray-400 hover:text-white transition-colors p-2 rounded-full hover:bg-white/5">
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18"></path>
                        </svg>
                    </button>
                    <div className="flex items-center gap-2 cursor-pointer" onClick={() => navigate('/home')}>
                        <svg className="w-6 h-6 text-nexusCyan" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon>
                        </svg>
                        <span className="text-lg font-black tracking-widest text-white">NEXUS</span>
                    </div>
                </div>
                <div className="flex items-center gap-4">
                    <button className="bg-white/10 text-white px-4 py-2 rounded-full text-sm font-bold hover:bg-white/20 transition-colors flex items-center gap-2" onClick={() => navigate('/watch-party')}>
                        <svg className="w-4 h-4 text-nexusPurple" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"></path>
                        </svg>
                        Create Watch Party
                    </button>
                </div>
            </header>

            {(needsTicket || needsStreamAuth) ? (
                <div className="flex-1 overflow-auto">
                    <div className="container mx-auto px-4 h-full flex items-center justify-center relative z-10">
                        <div className="relative max-w-lg w-full group">
                            {/* Holographic BG Glow */}
                            <div className={`absolute inset-0 blur-[100px] rounded-full opacity-40 animate-pulse ${needsTicket ? 'bg-accent-purple/40' : 'bg-accent-cyan/40'}`} />

                            {/* Main Glass Panel */}
                            <div className={`relative glass-panel p-10 border shadow-[0_0_50px_rgba(0,0,0,0.5)] backdrop-blur-2xl text-center overflow-hidden transition-all duration-500 hover:scale-[1.02] ${needsTicket ? 'border-accent-purple/50 shadow-accent-purple/20' : 'border-accent-cyan/50 shadow-accent-cyan/20'}`}>

                                {/* Scanning Line Effect */}
                                <div className="absolute inset-0 pointer-events-none bg-[linear-gradient(transparent_0%,rgba(255,255,255,0.05)_50%,transparent_100%)] bg-[length:100%_4px] animate-scan" />

                                {needsTicket ? (
                                    <>
                                        <div className="relative mb-8">
                                            <div className="text-7xl py-4 animate-float filter drop-shadow-[0_0_20px_rgba(168,85,247,0.6)]">🎫</div>
                                            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-32 h-32 bg-accent-purple/20 blur-2xl rounded-full" />
                                        </div>

                                        <h2 className="text-4xl font-display font-black text-white mb-2 tracking-wider glitch-text" data-text="TICKET REQUIRED">
                                            TICKET REQUIRED
                                        </h2>
                                        <p className="text-text-muted mb-8 text-lg font-light">Access to this exclusive stream is restricted.</p>

                                        <div className="bg-black/60 rounded-xl p-6 mb-8 border border-white/10 relative overflow-hidden group-hover:border-accent-purple/50 transition-colors">
                                            <div className="absolute top-0 left-0 w-1 h-full bg-accent-purple" />
                                            <div className="text-xs uppercase tracking-[0.2em] text-accent-purple font-bold mb-2 flex items-center justify-center gap-2">
                                                <span className="w-2 h-2 rounded-full bg-accent-purple animate-ping" /> ADMISSION PRICE
                                            </div>
                                            <div className="text-5xl font-mono font-bold text-white tracking-tight flex items-center justify-center gap-2">
                                                <span className="text-2xl text-accent-purple">$</span>{ticketPrice}<span className="text-lg text-text-muted">PTS</span>
                                            </div>
                                        </div>

                                        {ticketError && (
                                            <div className="mb-6 text-red-400 text-sm bg-red-950/30 border border-red-500/30 p-3 rounded flex items-center justify-center gap-2">
                                                <span>⚠️</span> {ticketError}
                                            </div>
                                        )}

                                        <button
                                            onClick={handleBuyTicket}
                                            disabled={buyingTicket}
                                            className="w-full py-4 bg-gradient-to-r from-accent-purple to-fuchsia-600 rounded-xl font-black text-lg text-white shadow-[0_0_20px_rgba(168,85,247,0.4)] hover:shadow-[0_0_30px_rgba(168,85,247,0.6)] transition-all hover:scale-[1.03] active:scale-[0.98] disabled:opacity-50 disabled:scale-100 uppercase tracking-widest relative overflow-hidden"
                                        >
                                            <div className="absolute inset-0 bg-white/20 translate-y-full hover:translate-y-0 transition-transform duration-300 transform skew-y-12" />
                                            {buyingTicket ? (
                                                <span className="flex items-center justify-center gap-2">
                                                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> PROCESSING...
                                                </span>
                                            ) : 'UNLOCK STREAM ACCESS'}
                                        </button>
                                    </>
                                ) : (
                                    <>
                                        <div className="relative mb-8">
                                            <div className="text-7xl py-4 animate-float filter drop-shadow-[0_0_20px_rgba(6,182,212,0.6)]">⏱️</div>
                                            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-32 h-32 bg-accent-cyan/20 blur-2xl rounded-full" />
                                        </div>

                                        <h2 className="text-4xl font-display font-black text-white mb-2 tracking-wider glitch-text" data-text="PAY-PER-VIEW">
                                            PAY-PER-VIEW
                                        </h2>
                                        <p className="text-text-muted mb-8 text-lg font-light">Real-time streaming payment required.</p>

                                        <div className="grid grid-cols-2 gap-4 mb-8">
                                            <div className="bg-black/60 rounded-xl p-5 border border-white/10 relative overflow-hidden group-hover:border-accent-cyan/30 transition-colors">
                                                <div className="text-[10px] uppercase tracking-widest text-accent-cyan font-bold mb-2">LIVE RATE</div>
                                                <div className="text-2xl font-mono font-bold text-white">{pricePerSecond.toFixed(2)}<span className="text-sm text-text-muted ml-1">/sec</span></div>
                                            </div>
                                            <div className="bg-black/60 rounded-xl p-5 border border-white/10 relative overflow-hidden group-hover:border-accent-yellow/30 transition-colors">
                                                <div className="text-[10px] uppercase tracking-widest text-accent-yellow font-bold mb-2">PRE-AUTH</div>
                                                <div className="text-2xl font-mono font-bold text-white">{requiredPreAuth}<span className="text-sm text-text-muted ml-1">PTS</span></div>
                                            </div>
                                        </div>

                                        <button
                                            onClick={() => navigate('/points')}
                                            className="w-full py-4 bg-gradient-to-r from-accent-cyan to-blue-600 rounded-xl font-black text-lg text-black shadow-[0_0_20px_rgba(6,182,212,0.4)] hover:shadow-[0_0_30px_rgba(6,182,212,0.6)] transition-all hover:scale-[1.03] active:scale-[0.98] uppercase tracking-widest relative overflow-hidden"
                                        >
                                            <div className="absolute inset-0 bg-white/30 translate-y-full hover:translate-y-0 transition-transform duration-300 transform skew-y-12" />
                                            INITIATE CONNECTION
                                        </button>
                                    </>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            ) : (
                <LiveKitRoom
                    token={token!}
                    serverUrl={livekitUrl!}
                    connect={true}
                    video={false}
                    audio={false}
                    data-lk-theme="default"
                >
                    <LayoutContextProvider>
                        <LiveContent
                            room={room}
                            token={token!}
                            livekitUrl={livekitUrl!}
                            initialViewerCount={room.viewerCount}
                            onTipSuccess={loadLeaderboard}
                            leaderboard={leaderboard}
                        />
                    </LayoutContextProvider>
                </LiveKitRoom>
            )}
        </div>
    );
}
