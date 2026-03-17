// FILE: /video-platform/client-web/src/pages/WatchParty.tsx
/**
 * Watch Party - 一起看
 *
 * 功能...
 * 1. 创建房间：选择视频、设置倒计...
 * 2. 加入房间：通过链接或房...ID
 * 3. 同步观看：视频播放状态同...
 * 4. 实时聊天：聊天消...+ 弹幕
 */

import React, { useState, useEffect, useMemo, useRef, Suspense, lazy } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Play, Pause, Plus, Users, Clock, Share2, Copy, Check, Film, ArrowLeft, MessageCircle, Send, Crown, Wifi, Sparkles, Monitor, MonitorOff, Mouse, Hand, SkipForward, Volume2 } from 'lucide-react';
import { useWatchPartySync } from '../hooks/useWatchPartySync';
import type { ChatMessage, Participant } from '../hooks/useWatchPartySync';
import { useWebRTCParty } from '../hooks/useWebRTCParty';
import type { RemoteCursor } from '../hooks/useWebRTCParty';
import { useAuthStore } from '../stores';
import { WatchPartyVideo } from '../components/watch-party/WatchPartyVideo';
import { getApiClient } from '../lib/apiClient';
import '../styles/WatchParty.css';

// Lazy load 3D scene (may fail on some systems)
const Scene3D = lazy(() => import('../components/watch-party/scene/Scene3D').catch(() => ({ default: () => null })));

// Generate random room ID
const generateRoomId = () => Math.random().toString(36).substring(2, 10);

// Extract room ID from a full URL or plain ID
// e.g. "http://localhost:5173/watch-party?room=abc123" → "abc123"
// e.g. "abc123" → "abc123"
const extractRoomId = (input: string): string => {
    const trimmed = input.trim();
    try {
        const url = new URL(trimmed);
        const roomParam = url.searchParams.get('room');
        if (roomParam) return extractRoomId(roomParam); // recursive for double-encoded
        return trimmed;
    } catch {
        // Not a URL, check for embedded room= pattern
        const match = trimmed.match(/[?&]room=([^&]+)/);
        if (match) return match[1];
        return trimmed;
    }
};

// Generate fallback user ID (if not logged in)
const generateFallbackUserId = () => {
    const stored = sessionStorage.getItem('wp-user-id');
    if (stored) return stored;
    const id = Math.random().toString(36).substring(2, 12);
    sessionStorage.setItem('wp-user-id', id);
    return id;
};

// Fallback demo videos (shown when API returns empty)
// SVG data URIs for demo video posters (no btoa — use encodeURIComponent for Unicode safety)
const makePoster = (c1: string, c2: string, label: string) =>
    `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="320" height="180"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="${c1}"/><stop offset="100%" stop-color="${c2}"/></linearGradient></defs><rect fill="url(#g)" width="320" height="180"/><text x="160" y="85" fill="white" font-size="16" font-family="Arial" font-weight="bold" text-anchor="middle" dominant-baseline="middle">${label}</text></svg>`)}`;
const DEMO_VIDEOS = [
    { id: 'sample-bbb-720p', title: 'Big Buck Bunny', poster: makePoster('#22d3ee', '#a855f7', 'Big Buck Bunny') },
    { id: 'sintel-hls', title: 'Sintel (HLS)', poster: makePoster('#f97316', '#ec4899', 'Sintel') },
    { id: 'elephants-dream', title: 'Elephants Dream', poster: makePoster('#10b981', '#3b82f6', 'Elephants Dream') },
];

// Simple Chat Component (inline)
const ChatPanel: React.FC<{
    messages: ChatMessage[];
    onSend: (content: string, type: 'chat' | 'danmaku') => void;
    currentUserId: string;
}> = ({ messages, onSend, currentUserId }) => {
    const [input, setInput] = useState('');
    const [sendAsDanmaku, setSendAsDanmaku] = useState(false);

    const handleSend = () => {
        if (!input.trim()) return;
        onSend(input.trim(), sendAsDanmaku ? 'danmaku' : 'chat');
        setInput('');
    };

    return (
        <div className="flex flex-col h-full overflow-hidden bg-transparent">
            {/* Chat Header */}
            <div className="flex items-center justify-between p-4 border-b border-white/5 bg-black/20 shrink-0">
                <h3 className="font-bold text-white flex items-center gap-2 text-sm uppercase tracking-widest">
                    <MessageCircle size={16} className="text-nexusPurple" /> Live Comm
                </h3>
                <span className="text-xs font-mono text-nexusCyan bg-nexusCyan/10 px-2 py-0.5 rounded-sm">{messages.length}</span>
            </div>
            {/* Messages Area */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
                {messages.map((msg) => (
                    <div key={msg.id} className={`flex flex-col ${msg.type === 'system' ? 'items-center' : msg.senderId === currentUserId ? 'items-end' : 'items-start'} max-w-full`}>
                        {msg.type === 'system' ? (
                            <div className="text-[10px] font-bold text-gray-400 bg-white/5 px-3 py-1 rounded-full border border-white/5">
                                {msg.content}
                            </div>
                        ) : (
                            <div className={`max-w-[85%] flex flex-col ${msg.senderId === currentUserId ? 'items-end' : 'items-start'}`}>
                                <div className="flex items-center gap-2 mb-1">
                                    <span className={`text-[10px] font-bold truncate ${msg.senderId === currentUserId ? 'text-nexusCyan' : 'text-gray-400'}`}>
                                        {msg.senderName}
                                    </span>
                                    <span className="text-[9px] text-gray-600 font-mono">
                                        {new Date(msg.timestamp).toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' })}
                                    </span>
                                </div>
                                <div className={`px-4 py-2.5 rounded-2xl text-sm shadow-sm relative group w-fit break-words ${msg.senderId === currentUserId ? 'bg-nexusCyan/20 text-white rounded-br-sm border border-nexusCyan/30' : 'bg-white/5 text-gray-200 rounded-bl-sm border border-white/10'}`}>
                                    {msg.type === 'danmaku' && <Sparkles size={12} className="absolute -top-2 -right-2 text-nexusYellow animate-pulse" />}
                                    {msg.content}
                                </div>
                            </div>
                        )}
                    </div>
                ))}
            </div>
            {/* Input Area */}
            <div className="p-4 border-t border-white/5 bg-[#0A0A14] shrink-0">
                {/* Quick Tip Reactions */}
                <div className="flex items-center gap-2 mb-3">
                    {[
                        { emoji: '👏', amount: 1, label: '1' },
                        { emoji: '🔥', amount: 5, label: '5' },
                        { emoji: '💰', amount: 10, label: '10' },
                        { emoji: '⚡', amount: 50, label: '50' },
                    ].map(({ emoji, amount, label }) => (
                        <button
                            key={emoji}
                            className="flex items-center gap-1 px-3 py-1.5 rounded-full bg-white/5 border border-white/10 hover:bg-nexusPurple/20 hover:border-nexusPurple/50 hover:scale-110 transition-all text-sm"
                            onClick={() => {
                                onSend(`${emoji} Tipped ${label} PTS!`, 'chat');
                            }}
                        >
                            <span>{emoji}</span>
                            <span className="text-[10px] font-mono text-nexusYellow">{label}</span>
                        </button>
                    ))}
                </div>
                <div className="flex items-center gap-2 bg-black/60 border border-white/10 rounded-xl p-1.5 focus-within:border-nexusPurple/50 focus-within:ring-1 focus-within:ring-nexusPurple/50 transition-all">
                    <button
                        className={`p-2 rounded-lg transition-colors ${sendAsDanmaku ? 'bg-nexusYellow/20 text-nexusYellow' : 'text-gray-500 hover:text-white hover:bg-white/5'}`}
                        onClick={() => setSendAsDanmaku(!sendAsDanmaku)}
                        title={sendAsDanmaku ? "Danmaku Mode ON" : "Danmaku Mode OFF"}
                    >
                        <Sparkles size={16} />
                    </button>
                    <input
                        type="text"
                        className="flex-1 bg-transparent border-none outline-none text-white text-sm placeholder-gray-600 px-2"
                        placeholder={sendAsDanmaku ? "Broadcast Danmaku..." : "Transmit message..."}
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                    />
                    <button
                        className={`p-2 rounded-lg transition-all ${input.trim() ? 'bg-nexusPurple text-white shadow-[0_0_10px_rgba(168,85,247,0.4)]' : 'bg-white/5 text-gray-600 cursor-not-allowed'}`}
                        onClick={handleSend}
                        disabled={!input.trim()}
                    >
                        <Send size={16} />
                    </button>
                </div>
            </div>
        </div>
    );
}

const Background3D: React.FC = () => {
    const [enable3D, setEnable3D] = useState(false);

    useEffect(() => {
        // Delay 3D loading to let base UI render first
        const timer = setTimeout(() => setEnable3D(true), 500);
        return () => clearTimeout(timer);
    }, []);

    if (!enable3D) {
        return (
            <div className="wp-fallback-bg">
                <div className="wp-grid-overlay" />
            </div>
        );
    }

    return (
        <Suspense fallback={<div className="wp-fallback-bg"><div className="wp-grid-overlay" /></div>}>
            <Scene3D />
        </Suspense>
    );
};

const WatchParty: React.FC = () => {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();

    // Room state
    const roomIdFromUrl = searchParams.get('room');
    const [currentRoomId, setCurrentRoomId] = useState(roomIdFromUrl ? extractRoomId(roomIdFromUrl) : '');
    const [isHost, setIsHost] = useState(!roomIdFromUrl);

    // User info — prefer real logged-in user, fallback to random ID
    const authUser = useAuthStore(s => s.user);
    const userId = useMemo(() => authUser?.id || generateFallbackUserId(), [authUser?.id]);
    const userName = useMemo(() => authUser?.nickname || authUser?.bitDomain || `观众${userId.slice(0, 4)}`, [authUser, userId]);

    // Video library: load from API, fallback to samples.json then demos
    const [videoLibrary, setVideoLibrary] = useState<{ id: string; title: string; poster: string }[]>(DEMO_VIDEOS);
    const [videosLoading, setVideosLoading] = useState(true);

    useEffect(() => {
        const jwt = sessionStorage.getItem('vp.jwt');
        const client = getApiClient();
        if (jwt) client.setJWT(jwt);

        // Try API first, then samples.json, then DEMO_VIDEOS
        const loadVideos = async () => {
            let vids: { id: string; title: string; poster: string }[] = [];
            // 1) Try metadata API
            try {
                const res = await client.get<{ videos?: any[] }>('/metadata/videos?limit=50');
                vids = (res?.videos || [])
                    .filter((v: any) => v.id && v.title)
                    .map((v: any) => ({ id: v.id, title: v.title || 'Untitled', poster: v.coverUrl || v.thumbnail || '' }));
            } catch { }
            // 2) Also load samples.json for local demo videos
            try {
                const resp = await fetch('/videos/samples.json');
                if (resp.ok) {
                    const arr = await resp.json();
                    const sampleVids = (Array.isArray(arr) ? arr : []).filter((v: any) => v.id && v.title)
                        .map((v: any) => ({ id: v.id, title: v.title, poster: v.coverUrl || v.thumbnail || '' }));
                    // Merge without duplicates
                    const existingIds = new Set(vids.map(v => v.id));
                    sampleVids.forEach((v: any) => { if (!existingIds.has(v.id)) vids.push(v); });
                }
            } catch { }
            // 3) Always append demo videos
            const existingIds = new Set(vids.map(v => v.id));
            DEMO_VIDEOS.forEach(v => { if (!existingIds.has(v.id)) vids.push(v); });
            if (vids.length > 0) setVideoLibrary(vids);
            setVideosLoading(false);
        };
        loadVideos();
    }, []);

    // UI state
    const [view, setView] = useState<'lobby' | 'create' | 'room'>(roomIdFromUrl ? 'room' : 'lobby');
    const [selectedVideo, setSelectedVideo] = useState(DEMO_VIDEOS[0]);
    const [countdown, setCountdown] = useState(60);
    const [copied, setCopied] = useState(false);
    const [paymentModel, setPaymentModel] = useState<'host_treats' | 'pay_your_own'>('pay_your_own');
    const [isVideoPlaying, setIsVideoPlaying] = useState(false);

    // Watch party sync (GunDB)
    const {
        roomState,
        participants,
        messages,
        isConnected,
        createRoom,
        updatePlayback,
        startPlayback,
        sendMessage
    } = useWatchPartySync({
        roomId: currentRoomId,
        userId,
        userName,
        isHost
    });

    const {
        connected: rtcConnected,
        peers: rtcPeers,
        localStream,
        remoteStreams,
        remoteCursors,
        lastControl,
        lastSync,
        chatMessages: wsChatMessages,
        roomInfo: wsRoomInfo,
        reactions: wsReactions,
        isScreenSharing,
        startScreenShare,
        stopScreenShare,
        sendControl,
        sendSync,
        sendChat: wsSendChat,
        sendRoomInfo: wsSendRoomInfo,
        sendReaction: wsSendReaction,
        sendCursor,
    } = useWebRTCParty({
        roomId: currentRoomId,
        userId,
        userName,
        isHost,
    });

    // ── Reconcile isHost from WS server's peer list (authoritative) ──
    // If server says we're NOT host but local state thinks we are, fix it
    useEffect(() => {
        if (!rtcPeers || rtcPeers.length === 0) return;
        const myPeer = rtcPeers.find(p => p.userId === userId);
        if (myPeer && myPeer.isHost !== isHost) {
            setIsHost(myPeer.isHost);
        }
    }, [rtcPeers, userId]);

    // n.eko-inspired control model: one controller at a time
    const [controllerId, setControllerId] = useState<string | null>(null);
    const [controlRequests, setControlRequests] = useState<string[]>([]);
    const hasControl = controllerId === userId;
    const remoteVideoRef = useRef<HTMLVideoElement>(null);

    // Attach remote stream to video element
    useEffect(() => {
        if (remoteVideoRef.current && remoteStreams.size > 0) {
            // Get first remote stream (from host)
            const stream = Array.from(remoteStreams.values())[0];
            if (stream && remoteVideoRef.current.srcObject !== stream) {
                remoteVideoRef.current.srcObject = stream;
            }
        }
    }, [remoteStreams]);

    // Build effective roomState: GunDB is primary, WS roomInfo is fallback
    // This ensures viewers get videoId even when GunDB peers are unreliable
    const effectiveRoomState = useMemo(() => {
        // GunDB roomState has everything — use it directly
        if (roomState?.videoId) return roomState;
        // WS roomInfo provides videoId/title as fallback
        if (wsRoomInfo?.videoId) {
            return {
                id: currentRoomId,
                hostId: '',
                hostName: '',
                videoId: wsRoomInfo.videoId,
                videoTitle: wsRoomInfo.videoTitle || '',
                scheduledStart: 0,
                isPlaying: wsRoomInfo.isPlaying ?? true,
                currentTime: wsRoomInfo.currentTime ?? 0,
                updatedAt: Date.now(),
                status: (wsRoomInfo.status as 'waiting' | 'playing' | 'ended') || 'playing',
                paymentModel: (wsRoomInfo.paymentModel as any) || 'pay_your_own',
            };
        }
        return roomState;
    }, [roomState, wsRoomInfo, currentRoomId]);

    // Handle incoming control actions (WS real-time — play/pause/seek)
    useEffect(() => {
        if (!lastControl) return;
        // Apply control action to local video player
        const video = document.querySelector('.wp-video-player video') as HTMLVideoElement;
        if (!video) return;
        switch (lastControl.action) {
            case 'play': video.play().catch(() => {}); break;
            case 'pause': video.pause(); break;
            case 'seek': if (lastControl.value !== undefined) video.currentTime = lastControl.value; break;
            case 'speed': if (lastControl.value !== undefined) video.playbackRate = lastControl.value; break;
        }
    }, [lastControl]);

    // Host: periodic position sync broadcast via WS (every 3 seconds)
    useEffect(() => {
        if (!isHost || view !== 'room') return;
        const interval = setInterval(() => {
            const video = document.querySelector('.wp-video-player video') as HTMLVideoElement;
            if (video) {
                sendSync(video.currentTime, !video.paused);
            }
        }, 3000);
        return () => clearInterval(interval);
    }, [isHost, view, sendSync]);

    // Viewer: position correction from host's wp:sync (drift > 2s → seek)
    useEffect(() => {
        if (isHost || !lastSync) return;
        const video = document.querySelector('.wp-video-player video') as HTMLVideoElement;
        if (!video) return;
        // Sync play/pause state
        if (lastSync.isPlaying && video.paused) {
            video.play().catch(() => {});
        } else if (!lastSync.isPlaying && !video.paused) {
            video.pause();
        }
        // Correct position if drift > 2 seconds
        const drift = Math.abs(video.currentTime - lastSync.currentTime);
        if (drift > 2) {
            video.currentTime = lastSync.currentTime;
        }
    }, [isHost, lastSync]);

    // ── GUEST: When initial lastSync arrives, update room state for immediate video play ──
    // This handles the case where the guest joins while the host is already playing
    useEffect(() => {
        if (isHost || !lastSync) return;
        if (lastSync.isPlaying && effectiveRoomState?.status === 'waiting') {
            // Host is already playing, force local playback
            const video = document.querySelector('.wp-video-player video') as HTMLVideoElement;
            if (video) {
                video.currentTime = lastSync.currentTime;
                video.play().catch(() => {});
            }
        }
    }, [lastSync, isHost]);

    // Track video play/pause state via DOM events for UI button sync
    useEffect(() => {
        if (view !== 'room') return;
        let videoEl: HTMLVideoElement | null = null;
        const onPlay = () => setIsVideoPlaying(true);
        const onPause = () => setIsVideoPlaying(false);
        // Small delay to ensure video element is mounted by video.js
        const timer = setTimeout(() => {
            videoEl = document.querySelector('.wp-video-player video') as HTMLVideoElement;
            if (!videoEl) return;
            videoEl.addEventListener('play', onPlay);
            videoEl.addEventListener('pause', onPause);
            // Sync initial state
            setIsVideoPlaying(!videoEl.paused);
        }, 500);
        return () => {
            clearTimeout(timer);
            if (videoEl) {
                videoEl.removeEventListener('play', onPlay);
                videoEl.removeEventListener('pause', onPause);
            }
        };
    }, [view, effectiveRoomState?.videoId]);

    // Countdown timer
    const [timeLeft, setTimeLeft] = useState<number | null>(null);

    useEffect(() => {
        if (roomState?.status === 'waiting' && roomState.scheduledStart) {
            const interval = setInterval(() => {
                const left = Math.max(0, Math.floor((roomState.scheduledStart - Date.now()) / 1000));
                setTimeLeft(left);
                if (left === 0 && isHost) {
                    startPlayback();
                }
            }, 1000);
            return () => clearInterval(interval);
        }
    }, [roomState, isHost, startPlayback]);

    const handleCreateRoom = () => {
        const newRoomId = generateRoomId();
        setCurrentRoomId(newRoomId);
        setIsHost(true);
        setView('create');
    };

    const handleStartParty = () => {
        const scheduledStart = Date.now() + countdown * 1000;
        createRoom(selectedVideo.id, selectedVideo.title, selectedVideo.poster || '', scheduledStart, paymentModel);
        // Try sending room info immediately (may fail if WS not ready yet)
        wsSendRoomInfo(selectedVideo.id, selectedVideo.title, paymentModel);
        setView('room');
        window.history.pushState({}, '', `/watch-party?room=${currentRoomId}`);
    };

    // ── HOST: Reliably ensure server has room info ──
    // Re-send room info when WS connection is (re)established
    // This handles the race condition where handleStartParty sends before WS is ready
    useEffect(() => {
        if (!isHost || view !== 'room' || !rtcConnected) return;
        // effectiveRoomState may come from GunDB or a previous WS send
        const vid = effectiveRoomState?.videoId || selectedVideo?.id;
        const title = effectiveRoomState?.videoTitle || selectedVideo?.title;
        if (vid) {
            wsSendRoomInfo(vid, title || '', paymentModel);
        }
    }, [isHost, view, rtcConnected]);

    // ── HOST: Re-send room info when a new peer joins ──
    // So the server always has fresh metadata for future joiners
    useEffect(() => {
        if (!isHost || view !== 'room' || !rtcConnected) return;
        if (rtcPeers.length <= 1) return; // only self
        const vid = effectiveRoomState?.videoId || selectedVideo?.id;
        const title = effectiveRoomState?.videoTitle || selectedVideo?.title;
        if (vid) {
            wsSendRoomInfo(vid, title || '', paymentModel);
            // Also send current playback state so server has latest
            const video = document.querySelector('.wp-video-player video') as HTMLVideoElement;
            if (video) {
                sendSync(video.currentTime, !video.paused);
            }
        }
    }, [rtcPeers.length]);

    const handleJoinRoom = (roomId: string) => {
        const cleanId = extractRoomId(roomId);
        setCurrentRoomId(cleanId);
        setIsHost(false);
        setView('room');
        window.history.pushState({}, '', `/watch-party?room=${cleanId}`);
    };

    const copyInviteLink = () => {
        navigator.clipboard.writeText(`${window.location.origin}/watch-party?room=${currentRoomId}`);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const formatTime = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    };

    // Merge participants from GunDB + WS peers (deduplicated by userId)
    const mergedParticipants = useMemo(() => {
        const map = new Map<string, { id: string; name: string; isHost: boolean }>();
        // WS peers are more reliable and have names
        rtcPeers.forEach((p: any) => {
            map.set(p.userId, { id: p.userId, name: p.userName || p.userId, isHost: !!p.isHost });
        });
        // GunDB participants as fallback
        participants.forEach((p) => {
            if (!map.has(p.id)) {
                map.set(p.id, { id: p.id, name: p.name, isHost: p.isHost });
            }
        });
        // Always include self
        if (!map.has(userId)) {
            map.set(userId, { id: userId, name: userName, isHost });
        }
        return Array.from(map.values());
    }, [rtcPeers, participants, userId, userName, isHost]);

    // Merge chat messages from GunDB + WS (deduplicated, sorted by timestamp)
    const allChatMessages = useMemo(() => {
        const seen = new Set<string>();
        const all: ChatMessage[] = [];
        // WS messages (more reliable for real-time)
        wsChatMessages.forEach((m) => {
            const key = `${m.fromUserId}-${m.timestamp}-${m.content.substring(0, 20)}`;
            if (!seen.has(key)) {
                seen.add(key);
                all.push({
                    id: key,
                    senderId: m.fromUserId,
                    senderName: m.userName,
                    content: m.content,
                    timestamp: m.timestamp,
                    type: m.msgType as any || 'chat',
                });
            }
        });
        // GunDB messages as additional source
        messages.forEach((m) => {
            const key = `${m.senderId}-${m.timestamp}-${m.content.substring(0, 20)}`;
            if (!seen.has(key)) {
                seen.add(key);
                all.push(m);
            }
        });
        return all.sort((a, b) => a.timestamp - b.timestamp).slice(-100);
    }, [wsChatMessages, messages]);

    // Lobby View
    if (view === 'lobby') {
        return (
            <div className="flex-1 flex items-center justify-center relative min-h-[calc(100vh-80px)] px-6 overflow-hidden">
                {/* Background Blobs (No more Scene3D, matching HTML specifically) */}
                <div className="absolute inset-0 pointer-events-none z-0 overflow-hidden">
                    <div className="absolute top-1/4 left-1/4 w-[600px] h-[600px] bg-[radial-gradient(circle,rgba(34,211,238,0.15)_0%,transparent_60%)] rounded-full mix-blend-screen filter blur-[100px] animate-pulse z-0"></div>
                    <div className="absolute top-1/3 right-1/4 w-[500px] h-[500px] bg-[radial-gradient(circle,rgba(168,85,247,0.15)_0%,transparent_60%)] rounded-full mix-blend-screen filter blur-[100px] animate-pulse z-0" style={{ animationDelay: '2s' }}></div>
                    <div className="absolute bottom-1/4 left-1/2 w-[700px] h-[700px] bg-[radial-gradient(circle,rgba(234,179,8,0.1)_0%,transparent_60%)] rounded-full mix-blend-screen filter blur-[100px] animate-pulse z-0" style={{ animationDelay: '4s' }}></div>
                    <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI0IiBoZWlnaHQ9IjQiPgo8cmVjdCB3aWR0aD0iNCIgaGVpZ2h0PSI0IiBmaWxsPSIjZmZmIiBmaWxsLW9wYWNpdHk9IjAuMDUiLz4KPC9zdmc+')] opacity-20"></div>
                </div>

                <div className="w-full max-w-5xl grid grid-cols-1 lg:grid-cols-2 gap-16 lg:gap-24 items-center relative z-10">
                    {/* Left Side: Action Terminal */}
                    <div className="flex flex-col items-center lg:items-start text-center lg:text-left">
                        <h1 className="text-6xl md:text-7xl font-serif font-black mb-4 tracking-widest uppercase text-transparent bg-clip-text bg-gradient-to-r from-nexusCyan via-nexusPurple to-nexusYellow drop-shadow-[0_0_20px_rgba(34,211,238,0.5)]">
                            WATCH PARTY
                        </h1>
                        <p className="text-gray-400 text-lg mb-12 tracking-wide">Synchronized viewing. Infinite connections.</p>

                        <div className="w-full max-w-md space-y-8 glass-panel p-8 rounded-3xl border border-white/10 shadow-[0_0_50px_rgba(0,0,0,0.5)] relative overflow-hidden group">
                            <div className="absolute inset-0 bg-gradient-to-r from-nexusCyan/5 via-nexusPurple/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-1000"></div>

                            <button onClick={handleCreateRoom} className="w-full bg-gradient-to-r from-nexusCyan to-nexusPurple text-white font-black text-lg py-5 rounded-2xl shadow-[0_0_30px_rgba(34,211,238,0.4)] hover:shadow-[0_0_50px_rgba(168,85,247,0.6)] hover:scale-[1.02] transform transition-all flex items-center justify-center gap-3 relative z-10 hover:brightness-110">
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4"></path>
                                </svg>
                                HOST A ROOM
                            </button>

                            <div className="relative flex items-center py-2">
                                <div className="flex-grow border-t border-white/10"></div>
                                <span className="flex-shrink-0 mx-4 text-gray-600 text-xs font-bold uppercase tracking-widest">Connect to Network</span>
                                <div className="flex-grow border-t border-white/10"></div>
                            </div>

                            <div className="relative z-10 flex gap-2">
                                <input type="text" placeholder="ENTER ROOM ID SECRETS..."
                                    value={currentRoomId} onChange={(e) => setCurrentRoomId(e.target.value)}
                                    className="flex-1 bg-black/60 border border-white/10 rounded-xl py-4 px-5 text-sm font-mono text-white placeholder-gray-600 focus:outline-none focus:border-nexusCyan/50 focus:bg-black/80 transition-all shadow-inner tracking-widest uppercase"
                                />
                                <button
                                    onClick={() => handleJoinRoom(currentRoomId)} disabled={!currentRoomId.trim()}
                                    className="bg-white/5 hover:bg-white/10 border border-white/10 text-nexusCyan px-6 rounded-xl font-bold flex flex-col items-center justify-center gap-1 transition-all hover:border-nexusCyan/50 hover:shadow-[0_0_15px_rgba(34,211,238,0.2)] disabled:opacity-50">
                                    <svg className="w-5 h-5 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z"></path>
                                    </svg>
                                    <span className="text-[10px] tracking-wider uppercase">Join</span>
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Right Side: Trending Public Rooms */}
                    <div className="hidden lg:flex flex-col gap-6 pl-12 border-l border-white/5">
                        <div className="flex items-center justify-between">
                            <h3 className="text-sm font-bold text-gray-500 uppercase tracking-[0.2em] flex items-center gap-2">
                                <span className="w-1.5 h-1.5 rounded-full bg-nexusGreen animate-pulse"></span>
                                Trending Public Rooms
                            </h3>
                        </div>

                        {/* Room Card 1 */}
                        <div onClick={() => handleJoinRoom('cyber123')} className="glass-panel p-4 rounded-2xl border border-white/5 flex gap-4 cursor-pointer hover:border-nexusPurple/30 hover:bg-white/5 transition-all group opacity-80 hover:opacity-100">
                            <div className="w-24 h-32 rounded-lg bg-gray-900 overflow-hidden relative border border-white/10 flex-shrink-0">
                                <img src="https://images.unsplash.com/photo-1536440136628-849c177e76a1?auto=format&fit=crop&q=80" className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" alt="Room" />
                                <div className="absolute inset-0 bg-black/40 group-hover:bg-transparent transition-colors"></div>
                                <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                    <div className="w-8 h-8 rounded-full bg-nexusPurple/80 flex items-center justify-center backdrop-blur shadow-[0_0_10px_rgba(168,85,247,0.8)]">
                                        <svg className="w-4 h-4 text-white ml-0.5" fill="currentColor" viewBox="0 0 20 20"><path d="M4 4l12 6-12 6z"></path></svg>
                                    </div>
                                </div>
                            </div>
                            <div className="flex flex-col justify-between py-2 flex-1">
                                <div>
                                    <div className="flex justify-between items-start mb-1">
                                        <h4 className="text-white font-bold text-sm leading-tight group-hover:text-nexusPurple transition-colors">Cybernetic Dawn (Premiere)</h4>
                                        <span className="bg-nexusGreen/20 text-nexusGreen border border-nexusGreen/50 text-[10px] px-1.5 rounded-sm font-bold ml-2">FREE</span>
                                    </div>
                                    <p className="text-[11px] text-gray-400">Host: @Director_K</p>
                                </div>
                                <div className="flex items-center justify-between">
                                    <div className="flex -space-x-2">
                                        <img className="w-6 h-6 rounded-full border-2 border-[#0A0A14]" src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&h=100&fit=crop" alt="avatar" />
                                        <img className="w-6 h-6 rounded-full border-2 border-[#0A0A14]" src="https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&h=100&fit=crop" alt="avatar" />
                                        <div className="w-6 h-6 rounded-full border-2 border-[#0A0A14] bg-gray-800 flex items-center justify-center text-[8px] text-white">+42</div>
                                    </div>
                                    <span className="text-xs font-mono text-gray-500 flex items-center gap-1">
                                        <svg className="w-3 h-3 text-nexusCyan" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"></path></svg>
                                        45 Sync
                                    </span>
                                </div>
                            </div>
                        </div>

                        {/* Room Card 2 */}
                        <div onClick={() => handleJoinRoom('underground_dj')} className="glass-panel p-4 rounded-2xl border border-white/5 flex gap-4 cursor-pointer hover:border-nexusCyan/30 hover:bg-white/5 transition-all group opacity-80 hover:opacity-100">
                            <div className="w-24 h-32 rounded-lg bg-gray-900 overflow-hidden relative border border-white/10 flex-shrink-0">
                                <img src="https://images.unsplash.com/photo-1514525253161-7a46d19cd819?auto=format&fit=crop&q=80" className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" alt="Room" />
                                <div className="absolute inset-0 bg-black/40 group-hover:bg-transparent transition-colors"></div>
                                <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                    <div className="w-8 h-8 rounded-full bg-nexusCyan/80 flex items-center justify-center backdrop-blur shadow-[0_0_10px_rgba(34,211,238,0.8)]">
                                        <svg className="w-4 h-4 text-white ml-0.5" fill="currentColor" viewBox="0 0 20 20"><path d="M4 4l12 6-12 6z"></path></svg>
                                    </div>
                                </div>
                            </div>
                            <div className="flex flex-col justify-between py-2 flex-1">
                                <div>
                                    <div className="flex justify-between items-start mb-1">
                                        <h4 className="text-white font-bold text-sm leading-tight group-hover:text-nexusCyan transition-colors">Underground DJ Set</h4>
                                        <span className="bg-white/10 text-nexusCyan border border-nexusCyan/30 text-[10px] px-1.5 rounded-sm font-bold font-mono ml-2">VIP</span>
                                    </div>
                                    <p className="text-[11px] text-gray-400">Host: @NeonBeats</p>
                                </div>
                                <div className="flex items-center justify-between">
                                    <div className="flex -space-x-2">
                                        <img className="w-6 h-6 rounded-full border-2 border-[#0A0A14]" src="https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?w=100&h=100&fit=crop" alt="avatar" />
                                        <img className="w-6 h-6 rounded-full border-2 border-[#0A0A14]" src="https://images.unsplash.com/photo-1531427186611-ecfd6d936c79?w=100&h=100&fit=crop" alt="avatar" />
                                        <div className="w-6 h-6 rounded-full border-2 border-[#0A0A14] bg-gray-800 flex items-center justify-center text-[8px] text-white">+12</div>
                                    </div>
                                    <span className="text-xs font-mono text-gray-500 flex items-center gap-1">
                                        <svg className="w-3 h-3 text-nexusCyan" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"></path></svg>
                                        14 Sync
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    // Create Room View
    if (view === 'create') {
        return (
            <div className="flex-1 flex items-center justify-center relative min-h-[calc(100vh-80px)] px-6 overflow-hidden py-12">
                <div className="absolute inset-0 pointer-events-none z-0 overflow-hidden bg-[#050510]/80"></div>
                <div className="w-full max-w-2xl glass-panel p-8 rounded-3xl border border-white/10 shadow-[0_0_50px_rgba(0,0,0,0.5)] relative z-10 flex flex-col gap-8 mx-auto">
                    <div className="flex items-center gap-4 border-b border-white/10 pb-6">
                        <button className="text-gray-400 hover:text-white transition-colors p-2 rounded-full hover:bg-white/5" onClick={() => setView('lobby')}><ArrowLeft size={20} /></button>
                        <h2 className="text-2xl font-bold text-white tracking-widest uppercase">CREATE WATCH PARTY</h2>
                    </div>

                    <div className="flex flex-col gap-4">
                        <h3 className="text-sm font-bold text-nexusCyan uppercase tracking-widest flex items-center gap-2"><Film size={16} /> Select Media</h3>
                        <div className="flex gap-4 overflow-x-auto pb-2 custom-scrollbar">
                            {videosLoading ? (
                                <div className="text-gray-500 text-sm py-8 text-center w-full">Loading videos...</div>
                            ) : videoLibrary.map((video) => (
                                <div key={video.id} className={`flex-shrink-0 w-48 bg-black/40 rounded-xl overflow-hidden cursor-pointer border transition-all ${selectedVideo.id === video.id ? 'border-nexusCyan shadow-[0_0_15px_rgba(34,211,238,0.3)]' : 'border-white/5 hover:border-white/20'}`} onClick={() => setSelectedVideo(video)}>
                                    <div className="w-full aspect-video bg-gray-900 flex items-center justify-center relative text-white/50 overflow-hidden">
                                        {video.poster ? (
                                            <img src={video.poster} alt={video.title} className="w-full h-full object-cover absolute inset-0" />
                                        ) : (
                                            <div className="absolute inset-0 bg-gradient-to-br from-gray-800 to-gray-900 flex items-center justify-center">
                                                <span className="text-sm text-gray-400 font-bold px-2 text-center">{video.title}</span>
                                            </div>
                                        )}
                                        <Play size={24} className={`relative z-10 ${selectedVideo.id === video.id ? 'text-nexusCyan' : ''}`} />
                                    </div>
                                    <div className="p-3 text-sm font-bold text-white truncate">{video.title}</div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Payment Model Selection */}
                    <div className="flex flex-col gap-4">
                        <h3 className="text-sm font-bold text-emerald-400 uppercase tracking-widest flex items-center gap-2">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z"></path></svg>
                            Payment Model
                        </h3>
                        <div className="grid grid-cols-2 gap-3">
                            <button
                                className={`p-4 rounded-xl border transition-all text-left ${paymentModel === 'host_treats'
                                    ? 'bg-emerald-500/10 border-emerald-500/50 shadow-[0_0_15px_rgba(16,185,129,0.2)]'
                                    : 'bg-white/5 border-white/10 hover:border-white/20 hover:bg-white/10'}`}
                                onClick={() => setPaymentModel('host_treats')}
                            >
                                <div className="text-lg mb-1">🎁</div>
                                <div className="text-sm font-bold text-white">Host Treats</div>
                                <div className="text-[11px] text-gray-400 mt-1">房主为全员买单</div>
                            </button>
                            <button
                                className={`p-4 rounded-xl border transition-all text-left ${paymentModel === 'pay_your_own'
                                    ? 'bg-blue-500/10 border-blue-500/50 shadow-[0_0_15px_rgba(59,130,246,0.2)]'
                                    : 'bg-white/5 border-white/10 hover:border-white/20 hover:bg-white/10'}`}
                                onClick={() => setPaymentModel('pay_your_own')}
                            >
                                <div className="text-lg mb-1">💳</div>
                                <div className="text-sm font-bold text-white">Pay Your Own</div>
                                <div className="text-[11px] text-gray-400 mt-1">每位观众自行付费</div>
                            </button>
                        </div>
                    </div>

                    <div className="flex flex-col gap-4">
                        <h3 className="text-sm font-bold text-nexusPurple uppercase tracking-widest flex items-center gap-2"><Clock size={16} /> Countdown Timer</h3>
                        <div className="flex flex-wrap gap-3">
                            {[
                                { secs: 30, label: '30S' },
                                { secs: 60, label: '1M' },
                                { secs: 300, label: '5M' },
                                { secs: 600, label: '10M' },
                                { secs: 1800, label: '30M' },
                            ].map(({ secs, label }) => (
                                <button key={secs} className={`px-4 py-2 rounded-lg font-mono text-sm font-bold border transition-all ${countdown === secs ? 'bg-nexusPurple/20 border-nexusPurple text-nexusPurple shadow-[0_0_10px_rgba(168,85,247,0.3)]' : 'bg-white/5 border-white/10 text-gray-400 hover:text-white hover:bg-white/10'}`} onClick={() => setCountdown(secs)}>
                                    {label}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="flex flex-col gap-4">
                        <h3 className="text-sm font-bold text-nexusYellow uppercase tracking-widest flex items-center gap-2"><Share2 size={16} /> Network Link</h3>
                        <div className="flex items-center justify-between bg-black/60 border border-white/10 rounded-xl p-4">
                            <span className="font-mono text-gray-300 text-sm">ID: {currentRoomId}</span>
                            <button className="text-nexusCyan hover:text-white font-bold text-xs uppercase tracking-widest flex items-center gap-2 transition-colors" onClick={copyInviteLink}>
                                {copied ? <Check size={14} /> : <Copy size={14} />} {copied ? 'COPIED' : 'COPY'}
                            </button>
                        </div>
                    </div>

                    <button className="w-full mt-4 bg-gradient-to-r from-nexusCyan to-nexusPurple text-white font-black text-lg py-5 rounded-2xl shadow-[0_0_30px_rgba(34,211,238,0.4)] hover:shadow-[0_0_50px_rgba(168,85,247,0.6)] hover:scale-[1.02] transform transition-all flex items-center justify-center gap-3 relative z-10 hover:brightness-110" onClick={handleStartParty}>
                        <Play size={20} fill="currentColor" /> INITIALIZE SESSION
                    </button>
                </div>
            </div>
        );
    }

    // Room View
    return (
        <div className="flex-1 flex overflow-hidden w-full h-[calc(100vh-80px)] bg-[#050510] relative">
            {/* Background */}
            <div className="absolute inset-0 pointer-events-none z-0 overflow-hidden">
                <div className="absolute top-1/4 left-1/4 w-[600px] h-[600px] bg-[radial-gradient(circle,rgba(34,211,238,0.1)_0%,transparent_60%)] rounded-full mix-blend-screen filter blur-[100px] z-0"></div>
                <div className="absolute bottom-1/4 right-1/4 w-[500px] h-[500px] bg-[radial-gradient(circle,rgba(168,85,247,0.1)_0%,transparent_60%)] rounded-full mix-blend-screen filter blur-[100px] z-0"></div>
            </div>

            {/* Main Area */}
            <main className="flex-1 flex flex-col p-4 lg:p-6 overflow-y-auto relative custom-scrollbar z-10 min-w-0">
                {/* Top Bar */}
                <div className="flex items-center justify-between mb-4 glass-panel px-6 py-3 rounded-2xl border border-white/10">
                    <div className="flex items-center gap-4">
                        <button className="text-gray-400 hover:text-white transition-colors p-2 rounded-full hover:bg-white/5" onClick={() => navigate('/watch-party')}><ArrowLeft size={20} /></button>
                        <h1 className="text-xl font-bold text-white tracking-widest flex items-center gap-3">
                            <span className="text-nexusCyan">WATCH PARTY</span>
                            <span className="w-px h-4 bg-white/20"></span>
                            <span className="text-gray-400 text-sm font-normal">{effectiveRoomState?.videoTitle || 'Loading...'}</span>
                        </h1>
                    </div>
                    <div className="flex items-center gap-3">
                        {/* WebRTC Status */}
                        <div className={`px-3 py-1.5 rounded-full flex items-center gap-2 text-xs font-bold border ${rtcConnected ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' : 'bg-yellow-500/10 text-yellow-400 border-yellow-500/30'}`}>
                            <Wifi size={12} /> {rtcConnected ? 'WebRTC' : 'Connecting'}
                        </div>
                        <div className="bg-white/5 px-4 py-1.5 rounded-full flex items-center gap-2 text-sm font-bold text-white border border-white/10">
                            <Users size={14} className="text-nexusCyan" /> {mergedParticipants.length} SYNCED
                        </div>
                        {/* Payment Model Badge */}
                        <div className={`px-3 py-1.5 rounded-full flex items-center gap-1.5 text-xs font-bold border ${effectiveRoomState?.paymentModel === 'host_treats' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' : 'bg-blue-500/10 text-blue-400 border-blue-500/30'}`}>
                            {effectiveRoomState?.paymentModel === 'host_treats' ? '🎁 Host Treats' : '💳 Pay Your Own'}
                        </div>
                        <button className="bg-nexusPurple text-white px-4 py-1.5 rounded-full text-sm font-bold flex items-center gap-2 hover:bg-purple-500 transition-colors shadow-[0_0_15px_rgba(168,85,247,0.4)]" onClick={copyInviteLink}>
                            {copied ? <Check size={14} /> : <Share2 size={14} />} INVITE
                        </button>
                    </div>
                </div>

                {/* Video Player Area */}
                <div className="w-full aspect-video rounded-2xl bg-black relative overflow-hidden shadow-[0_0_50px_rgba(0,0,0,0.5)] border border-white/10 mx-auto max-w-6xl wp-video-player"
                    onMouseMove={(e) => {
                        if (!hasControl && !isHost) return;
                        const rect = e.currentTarget.getBoundingClientRect();
                        sendCursor(
                            ((e.clientX - rect.left) / rect.width) * 100,
                            ((e.clientY - rect.top) / rect.height) * 100
                        );
                    }}
                >
                    {/* Always render WatchPartyVideo — both host and joiners use it */}
                    <WatchPartyVideo
                        roomState={effectiveRoomState}
                        userId={userId}
                        isHost={isHost}
                        participants={participants}
                        onTimeUpdate={(time) => {
                            if (isHost) {
                                updatePlayback(true, time);
                            }
                        }}
                        onPlayStateChange={(playing, time) => {
                            if (isHost) {
                                sendControl(playing ? 'play' : 'pause', time);
                                updatePlayback(playing, time);
                                sendSync(time, playing);
                            }
                        }}
                        onPaymentRequired={(videoId) => navigate(`/player/${videoId}?mode=stream`)}
                    />

                    {/* WebRTC Remote Screen Share overlay (when host shares screen) */}
                    {remoteStreams.size > 0 && !isHost && (
                        <div className="absolute inset-0 z-20 bg-black">
                            <video
                                ref={remoteVideoRef}
                                autoPlay
                                playsInline
                                className="w-full h-full object-contain bg-black"
                            />
                            <div className="absolute top-2 left-2 bg-[#22d3ee]/80 text-black text-[10px] font-bold px-2 py-0.5 rounded z-30">
                                📡 SCREEN SHARE
                            </div>
                        </div>
                    )}

                    {/* Host Local Preview (PiP when sharing) */}
                    {isHost && localStream && (
                        <div className="absolute top-4 left-4 w-48 aspect-video rounded-lg overflow-hidden border-2 border-nexusCyan shadow-[0_0_20px_rgba(34,211,238,0.4)] z-30">
                            <video
                                autoPlay
                                muted
                                playsInline
                                ref={(el) => { if (el && localStream) el.srcObject = localStream; }}
                                className="w-full h-full object-cover"
                            />
                            <div className="absolute bottom-1 left-2 text-[10px] text-nexusCyan font-bold bg-black/60 px-2 py-0.5 rounded">
                                📡 SHARING
                            </div>
                        </div>
                    )}

                    {/* Remote Cursors Overlay (n.eko inspired) */}
                    {remoteCursors.map((cursor) => (
                        <div
                            key={cursor.userId}
                            className="absolute pointer-events-none z-40 transition-all duration-100"
                            style={{ left: `${cursor.x}%`, top: `${cursor.y}%`, transform: 'translate(-2px, -2px)' }}
                        >
                            <Mouse size={16} className="text-nexusYellow drop-shadow-[0_0_4px_rgba(234,179,8,0.8)]" />
                            <span className="absolute top-4 left-3 text-[10px] bg-nexusYellow/90 text-black px-1.5 py-0.5 rounded font-bold whitespace-nowrap">
                                {cursor.userName}
                            </span>
                            {cursor.reaction && (
                                <span className="absolute -top-6 left-0 text-2xl animate-bounce">{cursor.reaction}</span>
                            )}
                        </div>
                    ))}

                    {/* Connection Status Overlay */}
                    {!isConnected && (
                        <div className="absolute top-4 right-4 bg-red-500/80 backdrop-blur text-white px-3 py-1 rounded-full text-xs font-bold flex items-center gap-2 z-50">
                            <div className="w-2 h-2 rounded-full bg-white animate-pulse"></div> RECONNECTING...
                        </div>
                    )}
                </div>

                {/* ═══ Collaborative Control Bar (n.eko inspired) ═══ */}
                <div className="mt-4 flex items-center justify-between glass-panel px-6 py-3 rounded-2xl border border-white/10 max-w-6xl mx-auto w-full">
                    {/* Left: Screen Share (Host) / Request Control (Peer) */}
                    <div className="flex items-center gap-3">
                        {isHost ? (
                            <button
                                onClick={isScreenSharing ? stopScreenShare : startScreenShare}
                                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all ${isScreenSharing
                                        ? 'bg-red-500/20 text-red-400 border border-red-500/30 hover:bg-red-500/30'
                                        : 'bg-nexusCyan/10 text-nexusCyan border border-nexusCyan/30 hover:bg-nexusCyan/20'
                                    }`}
                            >
                                {isScreenSharing ? <><MonitorOff size={16} /> Stop Sharing</> : <><Monitor size={16} /> Share Screen</>}
                            </button>
                        ) : (
                            <button
                                onClick={() => {
                                    if (!hasControl) {
                                        setControlRequests(prev => [...prev, userId]);
                                        sendCursor(50, 50, '🖐️');
                                    }
                                }}
                                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all ${hasControl
                                        ? 'bg-nexusGreen/20 text-nexusGreen border border-nexusGreen/30'
                                        : 'bg-white/5 text-gray-400 border border-white/10 hover:text-white hover:bg-white/10'
                                    }`}
                            >
                                <Hand size={16} /> {hasControl ? 'You Have Control' : 'Request Control'}
                            </button>
                        )}
                    </div>

                    {/* Center: Playback Controls (anyone can use) */}
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => sendControl('seek', Math.max(0, (document.querySelector('.wp-video-player video') as HTMLVideoElement)?.currentTime - 10))}
                            className="p-2 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 transition-all"
                            title="Rewind 10s"
                        >
                            <SkipForward size={16} className="rotate-180" />
                        </button>
                        <button
                            onClick={() => {
                                const v = document.querySelector('.wp-video-player video') as HTMLVideoElement;
                                if (v?.paused) {
                                    v.play();
                                    sendControl('play');
                                    updatePlayback(true, v.currentTime || 0);
                                } else {
                                    v?.pause();
                                    sendControl('pause');
                                    updatePlayback(false, v?.currentTime || 0);
                                }
                            }}
                            className="p-3 rounded-xl bg-nexusPurple/20 text-nexusPurple border border-nexusPurple/30 hover:bg-nexusPurple/30 transition-all"
                        >
                            {isVideoPlaying ? <Pause size={18} /> : <Play size={18} />}
                        </button>
                        <button
                            onClick={() => sendControl('seek', (document.querySelector('.wp-video-player video') as HTMLVideoElement)?.currentTime + 10)}
                            className="p-2 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 transition-all"
                            title="Forward 10s"
                        >
                            <SkipForward size={16} />
                        </button>
                    </div>

                    {/* Right: Reactions */}
                    <div className="flex items-center gap-2">
                        {['👍', '😂', '😮', '🔥', '❤️'].map((emoji) => (
                            <button
                                key={emoji}
                                onClick={() => {
                                    wsSendReaction(emoji);
                                    sendCursor(50, 50, emoji);
                                }}
                                className="text-lg hover:scale-150 transition-transform p-1"
                            >
                                {emoji}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Host Controls: Start Playback */}
                {isHost && effectiveRoomState?.status === 'waiting' && (
                    <div className="mt-6 flex justify-center">
                        <button className="bg-gradient-to-r from-nexusCyan to-nexusPurple text-white font-black text-lg px-12 py-4 rounded-xl shadow-[0_0_30px_rgba(34,211,238,0.4)] hover:shadow-[0_0_50px_rgba(168,85,247,0.6)] hover:scale-[1.02] transform transition-all flex items-center justify-center gap-3 relative z-10 uppercase tracking-widest" onClick={() => {
                        startPlayback();
                        // Also sync via WS so server + all peers get the state
                        sendSync(0, true);
                        sendControl('play');
                    }}>
                            <Play size={20} fill="currentColor" /> INITIATE PLAYBACK NOW
                        </button>
                    </div>
                )}
            </main>

            {/* Right Sidebar */}
            <aside className="hidden lg:flex w-[350px] flex-shrink-0 bg-[#0A0A14]/80 backdrop-blur-xl flex-col h-full border-l border-white/5 shadow-2xl relative z-20">
                <div className="flex flex-col h-1/3 border-b border-white/5 p-4 overflow-hidden">
                    <h3 className="text-sm font-bold text-gray-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-nexusCyan animate-pulse"></span> NETWORK NODES ({mergedParticipants.length})
                    </h3>
                    <div className="flex-1 overflow-y-auto custom-scrollbar space-y-2 pr-2">
                        {mergedParticipants.map((p) => (
                            <div key={p.id} className="flex items-center gap-3 bg-white/5 p-2 rounded-lg border border-white/5">
                                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-nexusCyan to-nexusPurple flex items-center justify-center text-white font-bold text-xs relative">
                                    {p.name.charAt(0).toUpperCase()}
                                    {p.isHost && <div className="absolute -top-1 -right-1 bg-nexusYellow rounded-full p-0.5"><Crown size={8} className="text-black" /></div>}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="text-sm font-bold text-white truncate flex items-center gap-2">
                                        {p.name} {p.id === userId && <span className="text-[10px] text-nexusCyan bg-nexusCyan/20 px-1.5 rounded-sm">YOU</span>}
                                    </div>
                                    <div className="text-[10px] text-gray-500 flex items-center gap-1">
                                        <div className="w-1.5 h-1.5 rounded-full bg-nexusGreen"></div>
                                        SYNCED
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
                <div className="flex-1 flex flex-col min-h-0">
                    <ChatPanel messages={allChatMessages} onSend={(c, t) => wsSendChat(c, t)} currentUserId={userId} />
                </div>
            </aside>
        </div>
    );
};

export default WatchParty;
