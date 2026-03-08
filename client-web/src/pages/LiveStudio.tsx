// FILE: /video-platform/client-web/src/pages/LiveStudio.tsx
/**
 * 主播端直播控制台
 * 
 * 功能...
 * - 开...下播控制
 * - 摄像...麦克风选择
 * - 屏幕共享
 * - 实时收益统计
 * - 弹幕管理
 * - 观众列表
 * - 直播设置
 */

import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    LiveKitRoom,
    VideoTrack,
    AudioTrack,
    useTracks,
    useLocalParticipant,
    useRoomContext,
    useParticipants,  // 添加：用于获取实时参与者数...
    useDataChannel,   // 添加：用于接收观众弹...
    ControlBar,
    LayoutContextProvider,
    MediaDeviceSelect,
    TrackToggle,
} from '@livekit/components-react';
import { Track, LocalVideoTrack, createLocalVideoTrack, createLocalAudioTrack, ConnectionState, RoomEvent } from 'livekit-client';
import { getApiClient } from '../lib/apiClient';
import TopNav from '../components/TopNav';
import LiveGiftEffect, { triggerGiftEffect } from '../components/live/LiveGiftEffect';
import '@livekit/components-styles';

const client = getApiClient();

interface LiveRoom {
    roomId: string;
    title: string;
    status: 'live' | 'ended' | 'scheduled';
    viewerCount: number;
    totalTips: number;
    isRecording: boolean;
    startedAt?: string;
}

function LocalVideoPreview() {
    const tracks = useTracks([{ source: Track.Source.Camera, withPlaceholder: true }]);
    const localTrack = tracks.find(t => t.participant.isLocal);

    if (!localTrack) {
        return (
            <div className="w-full h-full flex items-center justify-center bg-black text-gray-500">
                <div className="text-center">
                    <div className="text-4xl mb-2">🎥</div>
                    <div className="font-mono text-sm">Camera Off</div>
                </div>
            </div>
        );
    }

    return (
        <VideoTrack trackRef={localTrack as any} className="absolute inset-0 w-full h-full object-cover" />
    );
}

// 主播控制面板组件
function StudioControls({
    room,
    onEnd,
    onToggleRecording,
}: {
    room: LiveRoom;
    onEnd: () => void;
    onToggleRecording: () => void;
}) {
    const navigate = useNavigate();
    const participants = useParticipants();
    const viewerCount = Math.max(0, participants.length - 1);

    const [stats, setStats] = useState({
        totalTips: room.totalTips,
        duration: 0,
    });
    const [messages, setMessages] = useState<{ fromName: string; content: string; timestamp: number; type?: 'chat' | 'tip' | 'gift', avatar?: string, amount?: number }[]>([]);

    useDataChannel('chat', (msg) => {
        try {
            const message = JSON.parse(new TextDecoder().decode(msg.payload));
            if (message.type === 'chat') {
                setMessages(prev => [{
                    fromName: message.fromName || '익명',
                    content: message.content || '',
                    timestamp: Date.now(),
                    type: 'chat'
                }, ...prev.slice(0, 49)]);
            } else if (message.type === 'tip') {
                setStats(prev => ({ ...prev, totalTips: prev.totalTips + (message.tip?.amount || 0) }));
                if (message.tip?.animation) {
                    triggerGiftEffect({
                        id: message.tip.id || Date.now().toString(),
                        type: 'gift',
                        animation: message.tip.animation,
                        fromName: message.tip?.fromName || 'Anonymous',
                        amount: message.tip?.amount || 0,
                        giftIcon: message.tip?.giftIcon || '🎁',
                        giftName: message.tip?.giftName || 'Gift',
                    });
                }
                setMessages(prev => [{
                    fromName: message.tip?.fromName || 'Anonymous',
                    content: `Sent ${message.tip?.giftName || 'Gift'}`,
                    amount: message.tip?.amount || 0,
                    timestamp: Date.now(),
                    type: 'gift'
                }, ...prev.slice(0, 49)]);
            }
        } catch (e) {
            console.error('[Host] Parse error:', e);
        }
    });

    useEffect(() => {
        if (!room.startedAt) return;
        const startTime = new Date(room.startedAt).getTime();
        const interval = setInterval(() => {
            setStats(prev => ({ ...prev, duration: Math.floor((Date.now() - startTime) / 1000) }));
        }, 1000);
        return () => clearInterval(interval);
    }, [room.startedAt]);

    const formatDuration = (seconds: number) => {
        const h = Math.floor(seconds / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        const s = seconds % 60;
        return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    };

    return (
        <div className="flex flex-col h-screen bg-[#050510] text-white overflow-hidden relative w-full pointer-events-auto">
            <div className="fixed inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI0MCIgaGVpZ2h0PSI0MCI+PHBhdGggZD0iTTAgMGg0MHY0MEgweiIgZmlsbD0ibm9uZSIvPPHBhdGggZD0iTTAgMGgxdjQwbS0xLThoNDBWMCIgc3Ryb2tlPSJyZ2JhKDI1NSwyNTUsMjU1LDAuMDIpIiBzdHJva2Utd2lkdGg9IjEiLz48L3N2Zz4=')] bg-[length:40px_40px] opacity-10 pointer-events-none z-0"></div>

            <header className="h-16 flex-shrink-0 flex items-center justify-between px-6 bg-black/60 backdrop-blur-xl border-b border-white/5 z-50">
                <div className="flex items-center gap-6">
                    <div className="flex items-center gap-3 cursor-pointer group" onClick={() => navigate('/home')}>
                        <div className="w-8 h-8 rounded bg-red-500/10 text-red-500 flex items-center justify-center font-bold font-sans text-xs border border-red-500/30 group-hover:bg-red-500 group-hover:text-white group-hover:shadow-[0_0_15px_rgba(239,68,68,0.5)] transition-all">
                            <svg className="w-4 h-4 text-currentColor" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18"></path></svg>
                        </div>
                        <div className="flex flex-col">
                            <span className="text-[10px] text-gray-500 font-mono uppercase tracking-widest leading-none">Creator / Broadcast</span>
                            <span className="text-lg font-display font-black tracking-widest text-white leading-tight">LIVE STUDIO</span>
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-6">
                    <div className="flex items-center gap-6 px-6 border-r border-white/10 hidden md:flex">
                        <div className="flex flex-col items-center">
                            <span className="text-[10px] text-gray-500 uppercase tracking-widest font-bold">Status</span>
                            <span className="text-xs font-bold text-red-500 font-mono flex items-center gap-1">
                                <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></span>LIVE
                            </span>
                        </div>
                        <div className="flex flex-col items-center">
                            <span className="text-[10px] text-gray-500 uppercase tracking-widest font-bold">Uptime</span>
                            <span className="text-xs font-bold text-cyan-400 font-mono">{formatDuration(stats.duration)}</span>
                        </div>
                        <div className="flex flex-col items-center">
                            <span className="text-[10px] text-gray-500 uppercase tracking-widest font-bold">Engine</span>
                            <span className="text-xs font-bold text-purple-400 font-mono">LiveKit WebRTC</span>
                        </div>
                    </div>

                    <button
                        onClick={onToggleRecording}
                        className={`border px-6 py-1.5 rounded-full text-sm font-bold tracking-widest uppercase transition-colors flex items-center gap-2 ${room.isRecording ? 'bg-red-500/10 text-red-500 border-red-500/50 hover:bg-red-500 hover:text-white' : 'bg-black text-white border-white/20 hover:bg-white/10'}`}
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"></path></svg>
                        {room.isRecording ? 'Recording...' : 'Record'}
                    </button>
                    <button
                        onClick={onEnd}
                        className="bg-[#ef4444]/10 border border-[#ef4444]/50 text-[#ef4444] hover:bg-[#ef4444] hover:text-white px-8 py-1.5 rounded-full text-sm font-black tracking-widest uppercase shadow-[0_0_15px_rgba(239,68,68,0.2)] hover:shadow-[0_0_20px_rgba(239,68,68,0.6)] hover:scale-105 transition-all"
                    >
                        End Stream
                    </button>
                </div>
            </header>

            <main className="flex-1 flex overflow-hidden z-10 relative">
                {/* Left Column */}
                <div className="flex-1 flex flex-col p-4 gap-4 overflow-y-auto custom-scrollbar">
                    {/* Video Preview */}
                    <div className="bg-[#0A0A14]/70 backdrop-blur-xl border border-white/5 p-2 rounded-2xl w-full max-w-5xl mx-auto shadow-2xl relative shrink-0">
                        <div className="w-full aspect-video relative overflow-hidden rounded-xl bg-black border border-white/10 group">
                            <LocalVideoPreview />

                            {/* Overlays */}
                            <div className="absolute top-4 left-4 flex gap-2">
                                <div className="bg-red-500 text-white px-2 py-1 rounded text-xs font-bold font-mono shadow-[0_0_10px_rgba(239,68,68,0.5)] flex items-center gap-2">
                                    <span className="w-2 h-2 rounded-full bg-white animate-pulse"></span>LIVE
                                </div>
                                <div className="bg-black/60 backdrop-blur-md text-white px-2 py-1 rounded text-xs font-mono border border-white/10 flex items-center gap-1">
                                    <svg className="w-3 h-3 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"></path></svg>
                                    {viewerCount}
                                </div>
                            </div>

                            {/* Controls Overlay */}
                            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-3 bg-black/60 backdrop-blur-md border border-white/10 p-2 rounded-full opacity-0 group-hover:opacity-100 transition-opacity">
                                <ControlBar
                                    controls={{ camera: true, microphone: true, screenShare: true, chat: false, settings: true }}
                                    className="livekit-control-bar-custom !bg-transparent !border-none !shadow-none !p-0"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Dashboard */}
                    <div className="w-full max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-4 shrink-0">
                        <div className="bg-[#0A0A14]/70 backdrop-blur-xl border border-white/5 p-4 rounded-2xl flex flex-col justify-center">
                            <span className="text-[10px] text-gray-500 uppercase tracking-widest font-bold mb-1">Total Viewers</span>
                            <div className="text-3xl font-display font-light text-white mb-2">{viewerCount}</div>
                            <div className="w-full h-1 bg-white/10 rounded-full overflow-hidden">
                                <div className="h-full bg-cyan-400" style={{ width: '10%' }}></div>
                            </div>
                        </div>

                        <div className="bg-[#0A0A14]/70 backdrop-blur-xl border border-white/5 p-4 rounded-2xl flex flex-col justify-center relative overflow-hidden group">
                            <div className="absolute inset-0 bg-gradient-to-r from-yellow-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
                            <span className="text-[10px] text-gray-500 uppercase tracking-widest font-bold mb-1">Super Tips Received</span>
                            <div className="text-3xl font-display font-light text-yellow-500 mb-2 flex items-center gap-2">
                                {stats.totalTips} <span className="text-sm text-yellow-500 font-bold">PTS</span>
                            </div>
                            <p className="text-xs text-gray-400 font-mono">...${(stats.totalTips * 0.001).toFixed(2)} USD</p>
                        </div>

                        <div className="bg-[#0A0A14]/70 backdrop-blur-xl border border-white/5 p-4 rounded-2xl flex flex-col justify-center relative overflow-hidden group">
                            <div className="absolute inset-0 bg-gradient-to-r from-purple-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
                            <span className="text-[10px] text-gray-500 uppercase tracking-widest font-bold mb-1">Room Status</span>
                            <div className="flex items-center gap-3 mt-2">
                                <div className="w-10 h-10 rounded-full bg-purple-500/20 border border-purple-500/50 flex items-center justify-center text-purple-400 animate-pulse-fast">
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z"></path></svg>
                                </div>
                                <div className="flex flex-col">
                                    <span className="text-sm font-bold text-white">LiveKit Active</span>
                                    <span className="text-[10px] font-mono text-gray-400">Low Latency</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Right Column: Chat */}
                <div className="w-[380px] flex-shrink-0 bg-[#0A0A14]/70 backdrop-blur-xl border-l border-white/10 flex flex-col h-full z-10 shadow-[-10px_0_30px_rgba(0,0,0,0.5)]">
                    <div className="h-14 flex items-center justify-between px-4 border-b border-white/10 bg-black/40">
                        <h2 className="text-xs font-bold text-white uppercase tracking-widest">Live Chat Moderation</h2>
                        <div className="flex gap-2">
                            <span className="w-2 h-2 rounded-full bg-green-500 shadow-[0_0_5px_lime]" />
                        </div>
                    </div>

                    <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-3 flex flex-col-reverse">
                        {messages.length === 0 ? (
                            <div className="text-sm text-gray-500 text-center py-10 font-mono">No messages yet...</div>
                        ) : (
                            messages.map((msg, i) => (
                                msg.type === 'gift' ? (
                                    <div key={i} className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-2 my-1 relative overflow-hidden">
                                        <div className="absolute right-0 top-0 bottom-0 w-12 bg-gradient-to-l from-yellow-500/20 to-transparent pointer-events-none"></div>
                                        <div className="flex items-center gap-2 mb-1">
                                            <span className="font-bold text-yellow-500">{msg.fromName}</span>
                                            <span className="text-[10px] bg-yellow-500 text-black px-1.5 py-0.5 rounded font-bold uppercase tracking-widest">Super Tip</span>
                                        </div>
                                        <div className="text-sm font-bold text-white flex items-center gap-2">
                                            {msg.content} <span className="text-yellow-500 font-mono text-xs">+{msg.amount} PTS</span>
                                        </div>
                                    </div>
                                ) : (
                                    <div key={i} className="text-sm">
                                        <span className="font-bold text-cyan-400 cursor-pointer hover:underline">{msg.fromName}:</span>
                                        <span className="text-gray-300 ml-1">{msg.content}</span>
                                    </div>
                                )
                            ))
                        )}
                    </div>

                    <div className="p-4 bg-black/60 border-t border-white/10 backdrop-blur-md">
                        <div className="relative">
                            <input type="text" placeholder="As a broadcaster, chat is view-only here." disabled className="w-full bg-black/50 border border-white/20 rounded-xl px-4 py-3 text-sm text-gray-400 cursor-not-allowed focus:outline-none" />
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
}

export default function LiveStudio() {
    const navigate = useNavigate();

    // 状...
    const [step, setStep] = useState<'setup' | 'preview' | 'live'>('setup');
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [category, setCategory] = useState('');
    const [coverPreview, setCoverPreview] = useState<string | null>(null);
    const [enableRecording, setEnableRecording] = useState(false);
    const [isPrivate, setIsPrivate] = useState(false);
    const [ticketPrice, setTicketPrice] = useState('100');
    const [paymentMode, setPaymentMode] = useState<'ticket' | 'stream'>('ticket');
    const [pricePerMinute, setPricePerMinute] = useState('10');

    const [room, setRoom] = useState<LiveRoom | null>(null);
    const [token, setToken] = useState<string | null>(null);
    const [livekitUrl, setLivekitUrl] = useState<string | null>(null);

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [showEndConfirm, setShowEndConfirm] = useState(false);
    const [mediaPermission, setMediaPermission] = useState<'unknown' | 'granted' | 'denied'>('unknown');
    const [checkingPermission, setCheckingPermission] = useState(false);

    // 获取JWT
    const jwt = typeof window !== 'undefined' ? sessionStorage.getItem('vp.jwt') : null;
    if (jwt) client.setJWT(jwt);

    // 分类列表
    const categories = ['游戏', '音乐', '聊天', '教育', '美食', '户外', '其他'];

    // 恢复上次的直播会话（刷新重连...
    useEffect(() => {
        try {
            const savedSession = sessionStorage.getItem('vp.liveSession');
            if (savedSession) {
                const session = JSON.parse(savedSession);
                if (session.room && session.token && session.livekitUrl) {
                    console.log('[LiveStudio] Restoring live session after refresh:', session.room.roomId);
                    setRoom(session.room);
                    setToken(session.token);
                    setLivekitUrl(session.livekitUrl);
                    setTitle(session.room.title || '');
                    setStep('live');
                }
            }
        } catch (e) {
            console.warn('[LiveStudio] Failed to restore session:', e);
        }
    }, []);

    // 请求摄像...麦克风权...
    const requestMediaPermissions = async () => {
        setCheckingPermission(true);
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
            // 获取权限后立即释放设...
            stream.getTracks().forEach(t => t.stop());
            setMediaPermission('granted');
        } catch (err) {
            console.error('[LiveStudio] Media permission denied:', err);
            setMediaPermission('denied');
            setError('无法访问摄像头和麦克风，请在浏览器设置中允许权限后重试');
        } finally {
            setCheckingPermission(false);
        }
    };

    const handleStartLive = async () => {
        if (!title.trim()) {
            setError('请输入直播标题');
            return;
        }

        // 检查媒体权...
        if (mediaPermission !== 'granted') {
            await requestMediaPermissions();
            if (mediaPermission === 'denied') return;
        }

        setLoading(true);
        setError(null);

        try {
            const res = await client.post<{
                ok: boolean;
                room: LiveRoom;
                token: string;
                livekitUrl: string;
            }>('/live/room/create', {
                title: title.trim(),
                description: description.trim() || undefined,
                category: category || undefined,
                enableRecording,
                isPrivate,
                ticketPrice: isPrivate && paymentMode === 'ticket' ? Number(ticketPrice) : undefined,
                paymentMode: isPrivate ? paymentMode : undefined,
                pricePerMinute: isPrivate && paymentMode === 'stream' ? Number(pricePerMinute) : undefined,
            });

            if (res.ok) {
                setRoom(res.room);
                setToken(res.token);
                setLivekitUrl(res.livekitUrl);
                setStep('live');

                // 保存会话...sessionStorage，支持刷新重...
                try {
                    sessionStorage.setItem('vp.liveSession', JSON.stringify({
                        room: res.room,
                        token: res.token,
                        livekitUrl: res.livekitUrl,
                    }));
                } catch { }
            }
        } catch (err: any) {
            console.error('[LiveStudio] Create room error:', err);
            if (err?.code === 'unauthorized' || err?.error === '未授权') {
                setError('请先登录后再开播');
                setTimeout(() => navigate('/login'), 2000);
            } else {
                setError(err?.error || err?.message || '创建直播间失败');
            }
        } finally {
            setLoading(false);
        }
    };

    // 结束直播
    const handleEndLive = async () => {
        if (!room?.roomId) return;

        setShowEndConfirm(false);
        setLoading(true);
        try {
            await client.post('/live/room/end', { roomId: room.roomId });
            // 清除会话存储
            try { sessionStorage.removeItem('vp.liveSession'); } catch { }
            navigate('/');
        } catch (err: any) {
            setError(err?.error || err?.message || '结束直播失败');
        } finally {
            setLoading(false);
        }
    };

    // 页面刷新/关闭时只显示警告，不自动结束直播
    useEffect(() => {
        if (step !== 'live' || !room?.roomId) return;

        const handleBeforeUnload = (e: BeforeUnloadEvent) => {
            // 只显示确认对话框，不结束直播
            e.preventDefault();
            e.returnValue = '直播正在进行中，刷新后可自动重连。确定要离开吗？';
            return e.returnValue;
        };

        window.addEventListener('beforeunload', handleBeforeUnload);

        return () => {
            window.removeEventListener('beforeunload', handleBeforeUnload);
            // SPA 导航离开时也不自动结束，用户可能只是切换页面
            // 只有明确点击 "End Stream" 才结束直...
            console.log('[LiveStudio] Component unmounted, session preserved for reconnect');
        };
    }, [step, room?.roomId]);

    // 切换录制
    const handleToggleRecording = async () => {
        if (!room?.roomId) return;

        try {
            if (room.isRecording) {
                await client.post('/live/room/record/stop', { roomId: room.roomId });
            } else {
                await client.post('/live/room/record/start', { roomId: room.roomId });
            }
            setRoom(prev => prev ? { ...prev, isRecording: !prev.isRecording } : null);
        } catch (err: any) {
            setError(err?.error || err?.message || '操作失败');
        }
    };

    // 渲染 Live 模式 (Return immediately if in live mode to avoid nesting)
    if (step === 'live' && room && token && livekitUrl) {
        return (
            <div className="flex flex-col h-screen bg-[#050510] relative w-full overflow-hidden" data-lk-theme="default">
                <LiveKitRoom
                    serverUrl={livekitUrl}
                    token={token}
                    connect={true}
                    audio={true}
                    video={true}
                >
                    <LayoutContextProvider>
                        <StudioControls
                            room={room}
                            onEnd={() => setShowEndConfirm(true)}
                            onToggleRecording={handleToggleRecording}
                        />
                    </LayoutContextProvider>
                </LiveKitRoom>
                {/* 礼物特效...*/}
                <LiveGiftEffect />

                {/* 结束直播确认弹窗 */}
                {showEndConfirm && (
                    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-[9999]" onClick={() => setShowEndConfirm(false)}>
                        <div className="bg-gradient-to-br from-[#1a1a24] to-[#252532] rounded-3xl p-8 max-w-[400px] w-[90%] text-center border border-white/10 shadow-[0_20px_60px_rgba(0,0,0,0.5)]" onClick={e => e.stopPropagation()}>
                            <div className="text-6xl mb-4 drop-shadow-[0_0_15px_rgba(255,255,255,0.2)]">📡</div>
                            <h2 className="text-2xl font-black mb-3 text-white tracking-wide">END LIVESTREAM?</h2>
                            <p className="text-gray-400 text-sm mb-8">Viewers will be disconnected and the session will be closed permanently.</p>
                            <div className="flex gap-4 justify-center">
                                <button className="flex-1 py-3 px-6 bg-white/5 border border-white/10 rounded-xl text-white text-sm font-bold hover:bg-white/10 transition-colors" onClick={() => setShowEndConfirm(false)}>CANCEL</button>
                                <button className="flex-1 py-3 px-6 bg-red-600/20 border border-red-500/50 text-red-500 hover:bg-red-600 hover:text-white rounded-xl text-sm font-black tracking-widest uppercase transition-all shadow-[0_0_15px_rgba(239,68,68,0.2)] hover:shadow-[0_0_25px_rgba(239,68,68,0.5)] disabled:opacity-50" onClick={handleEndLive} disabled={loading}>{loading ? 'ENDING...' : 'CONFIRM'}</button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        );
    }

    // 渲染 Setup 模式
    return (
        <div className="page live-studio min-h-[100dvh] bg-[#050510] text-white flex flex-col items-center">
            <TopNav />
            <div className="fixed inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI0MCIgaGVpZ2h0PSI0MCI+PHBhdGggZD0iTTAgMGg0MHY0MEgweiIgZmlsbD0ibm9uZSIvPPHBhdGggZD0iTTAgMGgxdjQwbS0xLThoNDBWMCIgc3Ryb2tlPSJyZ2JhKDI1NSwyNTUsMjU1LDAuMDIpIiBzdHJva2Utd2lkdGg9IjEiLz48L3N2Zz4=')] bg-[length:40px_40px] opacity-[0.05] pointer-events-none z-0"></div>

            <div className="container mx-auto px-4 py-8 md:py-12 relative z-10 flex-1 flex flex-col items-center justify-center">
                {/* 设置阶段 */}
                {step === 'setup' && (
                    <div className="w-full max-w-2xl bg-[#0A0A14]/80 backdrop-blur-2xl border border-white/10 p-6 md:p-10 rounded-3xl relative overflow-hidden shadow-[0_0_50px_rgba(0,0,0,0.5)]">
                        {/* Background glow in card */}
                        <div className="absolute top-0 right-0 w-64 h-64 bg-cyan-500/10 blur-[100px] rounded-full pointer-events-none" />
                        <div className="absolute bottom-0 left-0 w-64 h-64 bg-purple-500/10 blur-[100px] rounded-full pointer-events-none" />

                        <div className="relative z-10">
                            <h1 className="text-3xl md:text-5xl font-black font-display mb-8 tracking-wider text-transparent bg-clip-text bg-gradient-to-r from-white to-cyan-400">
                                STUDIO SETUP
                            </h1>

                            {/* 频道信息提示 */}
                            <div className="flex items-start gap-4 p-5 bg-cyan-500/10 border border-cyan-500/30 rounded-2xl mb-8">
                                <div className="text-2xl mt-1">📡</div>
                                <div>
                                    <div className="font-bold text-cyan-400 text-sm mb-1 uppercase tracking-wider">Permanent Channel</div>
                                    <div className="text-xs text-gray-400 leading-relaxed">Your channel ID remains the same. Viewers can bookmark your link to join anytime you go live.</div>
                                </div>
                            </div>

                            <div className="space-y-6">
                                <div>
                                    <label className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2 block">Stream Title</label>
                                    <input
                                        className="w-full bg-black/50 border border-white/10 focus:border-cyan-400 rounded-xl px-4 py-3 text-white placeholder-gray-600 transition-colors focus:outline-none focus:shadow-[0_0_15px_rgba(34,211,238,0.2)]"
                                        type="text"
                                        value={title}
                                        onChange={(e) => setTitle(e.target.value)}
                                        placeholder="Enter a catchy title..."
                                        maxLength={50}
                                    />
                                </div>

                                <div>
                                    <label className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2 block">Description</label>
                                    <textarea
                                        className="w-full min-h-[100px] bg-black/50 border border-white/10 focus:border-cyan-400 rounded-xl p-4 text-white placeholder-gray-600 resize-none transition-colors focus:outline-none focus:shadow-[0_0_15px_rgba(34,211,238,0.2)]"
                                        value={description}
                                        onChange={(e) => setDescription(e.target.value)}
                                        placeholder="What's this stream about?"
                                        maxLength={200}
                                    />
                                </div>

                                <div>
                                    <label className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2 block">Category</label>
                                    <div className="relative">
                                        <select
                                            className="w-full bg-black/50 border border-white/10 focus:border-cyan-400 rounded-xl px-4 py-3 text-white cursor-pointer transition-colors focus:outline-none appearance-none"
                                            value={category}
                                            onChange={(e) => setCategory(e.target.value)}
                                        >
                                            <option value="" className="bg-gray-900">Select Category</option>
                                            {categories.map(cat => (
                                                <option key={cat} value={cat} className="bg-gray-900">{cat}</option>
                                            ))}
                                        </select>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                                    {/* Camera/Mic Permission Check */}
                                    <button
                                        type="button"
                                        onClick={requestMediaPermissions}
                                        disabled={checkingPermission || mediaPermission === 'granted'}
                                        className={`group p-4 rounded-xl flex items-center gap-3 transition-all border ${mediaPermission === 'granted'
                                            ? 'bg-green-500/10 border-green-500/30 text-green-400 cursor-default'
                                            : mediaPermission === 'denied'
                                                ? 'bg-red-500/10 border-red-500/30 text-red-400 hover:bg-red-500/20 cursor-pointer'
                                                : 'bg-cyan-500/10 border-cyan-500/30 text-cyan-400 hover:bg-cyan-500/20 cursor-pointer'
                                            }`}
                                    >
                                        <span className="text-lg">
                                            {mediaPermission === 'granted' ? '✅' : mediaPermission === 'denied' ? '❌' : checkingPermission ? '⏳' : '🎥'}
                                        </span>
                                        <span className="font-medium text-sm">
                                            {mediaPermission === 'granted' ? 'Camera & Mic Ready' : mediaPermission === 'denied' ? 'Permission Denied ...Click to Retry' : checkingPermission ? 'Requesting...' : 'Check Camera & Mic'}
                                        </span>
                                    </button>

                                    <label className="group p-4 bg-black/40 border border-white/5 rounded-xl flex items-center gap-3 cursor-pointer hover:bg-white/5 hover:border-red-500/50 transition-all">
                                        <input
                                            type="checkbox"
                                            className="w-5 h-5 accent-red-500 rounded cursor-pointer"
                                            checked={enableRecording}
                                            onChange={(e) => setEnableRecording(e.target.checked)}
                                        />
                                        <span className="font-medium text-sm text-gray-300 group-hover:text-white transition-colors">🔴 Auto-Record</span>
                                    </label>

                                    <label className="group p-4 bg-black/40 border border-white/5 rounded-xl flex items-center gap-3 cursor-pointer hover:bg-white/5 hover:border-purple-500/50 transition-all">
                                        <input
                                            type="checkbox"
                                            className="w-5 h-5 accent-purple-500 rounded cursor-pointer"
                                            checked={isPrivate}
                                            onChange={(e) => setIsPrivate(e.target.checked)}
                                        />
                                        <span className="font-medium text-sm text-gray-300 group-hover:text-white transition-colors">🔒 Private / Ticketed</span>
                                    </label>
                                </div>

                                {isPrivate && (
                                    <div className="p-6 rounded-2xl border border-purple-500/30 bg-purple-500/5 mt-4">
                                        <label className="text-xs font-bold text-purple-400 uppercase tracking-widest mb-4 block">Monetization</label>
                                        <div className="flex gap-4 mb-6">
                                            <label className={`flex-1 p-3 rounded-xl border cursor-pointer text-sm font-bold text-center transition-all ${paymentMode === 'ticket' ? 'border-purple-500 bg-purple-500/20 text-white shadow-[0_0_15px_rgba(168,85,247,0.3)]' : 'border-white/10 text-gray-500 hover:bg-white/5'}`}>
                                                <input type="radio" name="paymentMode" value="ticket" checked={paymentMode === 'ticket'} onChange={() => setPaymentMode('ticket')} className="hidden" />
                                                🎫 Ticket Entry
                                            </label>
                                            <label className={`flex-1 p-3 rounded-xl border cursor-pointer text-sm font-bold text-center transition-all ${paymentMode === 'stream' ? 'border-yellow-500 bg-yellow-500/20 text-white shadow-[0_0_15px_rgba(234,179,8,0.3)]' : 'border-white/10 text-gray-500 hover:bg-white/5'}`}>
                                                <input type="radio" name="paymentMode" value="stream" checked={paymentMode === 'stream'} onChange={() => setPaymentMode('stream')} className="hidden" />
                                                ⏱️ Pay-Per-Minute
                                            </label>
                                        </div>

                                        {paymentMode === 'ticket' ? (
                                            <div>
                                                <label className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2 block">Ticket Price (Points)</label>
                                                <input className="w-full bg-black/50 border border-white/10 focus:border-purple-500 rounded-xl px-4 py-3 text-white transition-colors focus:outline-none font-mono" type="number" value={ticketPrice} onChange={e => setTicketPrice(e.target.value)} min="1" />
                                            </div>
                                        ) : (
                                            <div>
                                                <label className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2 block">Price Per Minute (Points)</label>
                                                <input className="w-full bg-black/50 border border-white/10 focus:border-yellow-500 rounded-xl px-4 py-3 text-white transition-colors focus:outline-none font-mono" type="number" value={pricePerMinute} onChange={e => setPricePerMinute(e.target.value)} min="1" />
                                                <p className="text-[10px] text-yellow-500/80 mt-2 font-mono">Viewers are charged per second of watch time.</p>
                                            </div>
                                        )}
                                    </div>
                                )}

                                {error && <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-sm flex items-center gap-3 mt-4">⚠️ {error}</div>}

                                <button
                                    className="w-full py-4 mt-6 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 text-white text-lg font-black uppercase tracking-[0.2em] shadow-[0_0_20px_rgba(34,211,238,0.4)] hover:shadow-[0_0_30px_rgba(34,211,238,0.6)] disabled:opacity-50 disabled:cursor-not-allowed hover:scale-[1.02] transition-all"
                                    onClick={handleStartLive}
                                    disabled={loading || !title.trim()}
                                >
                                    {loading ? 'INITIALIZING...' : 'GO LIVE'}
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* end of setup */}

            </div>
        </div>
    );
}


