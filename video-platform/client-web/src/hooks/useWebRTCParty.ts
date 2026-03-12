// FILE: /video-platform/client-web/src/hooks/useWebRTCParty.ts
/**
 * WebRTC Watch Party Hook
 * 
 * Manages:
 * - WebSocket signaling connection
 * - RTCPeerConnection lifecycle (offer/answer/ICE)
 * - Host: screen share via getDisplayMedia() + optional camera
 * - Peer: receive remote MediaStreams
 * - Collaborative controls via signaling channel
 * - Remote cursors/reactions
 */

import { useState, useEffect, useRef, useCallback } from 'react';

const ICE_SERVERS: RTCConfiguration = {
    iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
    ],
};

export interface WebRTCPeer {
    userId: string;
    isHost: boolean;
    connection?: RTCPeerConnection;
    stream?: MediaStream;
}

export interface RemoteCursor {
    userId: string;
    userName: string;
    x: number;
    y: number;
    reaction?: string;
    lastSeen: number;
}

export interface ControlAction {
    fromUserId: string;
    action: 'play' | 'pause' | 'seek' | 'speed';
    value?: number;
    timestamp: number;
}

interface UseWebRTCPartyOptions {
    roomId: string;
    userId: string;
    userName: string;
    isHost: boolean;
    signalingUrl?: string;
}

export function useWebRTCParty({
    roomId,
    userId,
    userName,
    isHost,
    signalingUrl,
}: UseWebRTCPartyOptions) {
    const [connected, setConnected] = useState(false);
    const [peers, setPeers] = useState<WebRTCPeer[]>([]);
    const [localStream, setLocalStream] = useState<MediaStream | null>(null);
    const [remoteStreams, setRemoteStreams] = useState<Map<string, MediaStream>>(new Map());
    const [remoteCursors, setRemoteCursors] = useState<RemoteCursor[]>([]);
    const [lastControl, setLastControl] = useState<ControlAction | null>(null);
    const [lastSync, setLastSync] = useState<{ currentTime: number; isPlaying: boolean; timestamp: number } | null>(null);
    const [chatMessages, setChatMessages] = useState<{ fromUserId: string; userName: string; content: string; msgType: string; timestamp: number }[]>([]);
    const [roomInfo, setRoomInfo] = useState<{ videoId?: string; videoTitle?: string; paymentModel?: string } | null>(null);
    const [reactions, setReactions] = useState<{ fromUserId: string; userName: string; emoji: string; amount: number; timestamp: number }[]>([]);
    const [isScreenSharing, setIsScreenSharing] = useState(false);

    const wsRef = useRef<WebSocket | null>(null);
    const peerConnectionsRef = useRef<Map<string, RTCPeerConnection>>(new Map());
    const localStreamRef = useRef<MediaStream | null>(null);

    // Resolve signaling URL
    const wsUrl = signalingUrl || (() => {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const host = window.location.hostname;
        return `${protocol}//${host}:8103/ws`;
    })();

    // ── WebSocket Connection ──
    useEffect(() => {
        if (!roomId || !userId) return;

        const ws = new WebSocket(wsUrl);
        wsRef.current = ws;

        ws.onopen = () => {
            // Authenticate
            ws.send(JSON.stringify({ type: 'auth', userId }));
            // Join Watch Party room
            ws.send(JSON.stringify({ type: 'wp:join', roomId, userId, userName, isHost }));
            setConnected(true);
        };

        ws.onmessage = (event) => {
            try {
                const msg = JSON.parse(event.data);
                handleSignalingMessage(msg);
            } catch (e) {
                console.error('[WebRTC] Parse error:', e);
            }
        };

        ws.onclose = () => {
            setConnected(false);
            // Attempt reconnect after 3 seconds
            setTimeout(() => {
                if (wsRef.current?.readyState === WebSocket.CLOSED) {
                    console.log('[WebRTC] Reconnecting...');
                }
            }, 3000);
        };

        ws.onerror = (e) => {
            console.error('[WebRTC] WS error:', e);
        };

        return () => {
            ws.send(JSON.stringify({ type: 'wp:leave', roomId }));
            ws.close();
            // Cleanup peer connections
            peerConnectionsRef.current.forEach((pc) => pc.close());
            peerConnectionsRef.current.clear();
            localStreamRef.current?.getTracks().forEach(t => t.stop());
        };
    }, [roomId, userId, userName, isHost, wsUrl]);

    // ── Handle Signaling Messages ──
    const handleSignalingMessage = useCallback((msg: any) => {
        switch (msg.type) {
            case 'wp:sync':
                setLastSync({
                    currentTime: msg.currentTime,
                    isPlaying: msg.isPlaying,
                    timestamp: msg.timestamp,
                });
                break;

            case 'wp:chat':
                setChatMessages(prev => {
                    const newMsg = {
                        fromUserId: msg.fromUserId,
                        userName: msg.userName,
                        content: msg.content,
                        msgType: msg.msgType || 'chat',
                        timestamp: msg.timestamp,
                    };
                    setLastChat(newMsg);
                    return [...prev.slice(-99), newMsg];
                });
                break;

            case 'wp:room_info':
                setRoomInfo({
                    videoId: msg.videoId,
                    videoTitle: msg.videoTitle,
                    paymentModel: msg.paymentModel,
                });
                break;

            case 'wp:room_state':
                setPeers(msg.peers.map((p: any) => ({
                    userId: p.userId,
                    userName: p.userName,
                    isHost: p.isHost,
                })));
                // Room state also includes video metadata for joiners
                if (msg.videoId) {
                    setRoomInfo({
                        videoId: msg.videoId,
                        videoTitle: msg.videoTitle,
                        paymentModel: msg.paymentModel,
                    });
                }
                break;

            case 'wp:peer_joined':
                setPeers(prev => {
                    // Replace entire peer list from server (authoritative)
                    if (msg.peers && Array.isArray(msg.peers)) {
                        return msg.peers.map((p: any) => ({
                            userId: p.userId,
                            userName: p.userName,
                            isHost: p.isHost,
                        }));
                    }
                    if (prev.some(p => p.userId === msg.userId)) return prev;
                    return [...prev, { userId: msg.userId, userName: msg.userName, isHost: msg.isHost }];
                });
                // System message for join
                setChatMessages(prev => [...prev, {
                    fromUserId: 'system',
                    userName: 'System',
                    content: `${msg.userName || msg.userId} joined the room`,
                    msgType: 'system',
                    timestamp: Date.now(),
                }]);
                // If we are host and sharing, initiate offer to new peer
                if (isHost && localStreamRef.current) {
                    createOffer(msg.userId);
                }
                break;

            case 'wp:peer_left':
                setPeers(prev => prev.filter(p => p.userId !== msg.userId));
                const pcLeft = peerConnectionsRef.current.get(msg.userId);
                if (pcLeft) { pcLeft.close(); peerConnectionsRef.current.delete(msg.userId); }
                setRemoteStreams(prev => {
                    const next = new Map(prev);
                    next.delete(msg.userId);
                    return next;
                });
                setChatMessages(prev => [...prev, {
                    fromUserId: 'system',
                    userName: 'System',
                    content: `${msg.userName || msg.userId} left the room`,
                    msgType: 'system',
                    timestamp: Date.now(),
                }]);
                break;

            case 'wp:offer':
                handleOffer(msg.fromUserId, msg.sdp);
                break;

            case 'wp:answer':
                handleAnswer(msg.fromUserId, msg.sdp);
                break;

            case 'wp:ice':
                handleIceCandidate(msg.fromUserId, msg.candidate);
                break;

            case 'wp:control':
                setLastControl({
                    fromUserId: msg.fromUserId,
                    action: msg.action,
                    value: msg.value,
                    timestamp: msg.timestamp,
                });
                break;

            case 'wp:cursor':
                setRemoteCursors(prev => {
                    const filtered = prev.filter(c => c.userId !== msg.fromUserId);
                    return [...filtered, {
                        userId: msg.fromUserId,
                        userName: msg.userName,
                        x: msg.x,
                        y: msg.y,
                        reaction: msg.reaction,
                        lastSeen: Date.now(),
                    }];
                });
                break;
        }
    }, [isHost]);

    // ── Create PeerConnection ──
    const getOrCreatePC = useCallback((peerId: string): RTCPeerConnection => {
        if (peerConnectionsRef.current.has(peerId)) {
            return peerConnectionsRef.current.get(peerId)!;
        }

        const pc = new RTCPeerConnection(ICE_SERVERS);

        // Send ICE candidates
        pc.onicecandidate = (event) => {
            if (event.candidate) {
                wsRef.current?.send(JSON.stringify({
                    type: 'wp:ice',
                    roomId,
                    targetUserId: peerId,
                    candidate: event.candidate,
                }));
            }
        };

        // Receive remote tracks
        pc.ontrack = (event) => {
            const [stream] = event.streams;
            if (stream) {
                setRemoteStreams(prev => new Map(prev).set(peerId, stream));
            }
        };

        pc.onconnectionstatechange = () => {
            if (pc.connectionState === 'failed' || pc.connectionState === 'disconnected') {
                console.warn(`[WebRTC] Connection to ${peerId}: ${pc.connectionState}`);
            }
        };

        peerConnectionsRef.current.set(peerId, pc);
        return pc;
    }, [roomId]);

    // ── Create Offer (Host → Peer) ──
    const createOffer = useCallback(async (targetUserId: string) => {
        const pc = getOrCreatePC(targetUserId);

        // Add local tracks to peer connection
        if (localStreamRef.current) {
            localStreamRef.current.getTracks().forEach(track => {
                pc.addTrack(track, localStreamRef.current!);
            });
        }

        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);

        wsRef.current?.send(JSON.stringify({
            type: 'wp:offer',
            roomId,
            targetUserId,
            sdp: offer,
        }));
    }, [roomId, getOrCreatePC]);

    // ── Handle Offer (Peer receives from Host) ──
    const handleOffer = useCallback(async (fromUserId: string, sdp: RTCSessionDescriptionInit) => {
        const pc = getOrCreatePC(fromUserId);
        await pc.setRemoteDescription(new RTCSessionDescription(sdp));

        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);

        wsRef.current?.send(JSON.stringify({
            type: 'wp:answer',
            roomId,
            targetUserId: fromUserId,
            sdp: answer,
        }));
    }, [roomId, getOrCreatePC]);

    // ── Handle Answer ──
    const handleAnswer = useCallback(async (fromUserId: string, sdp: RTCSessionDescriptionInit) => {
        const pc = peerConnectionsRef.current.get(fromUserId);
        if (pc) {
            await pc.setRemoteDescription(new RTCSessionDescription(sdp));
        }
    }, []);

    // ── Handle ICE Candidate ──
    const handleIceCandidate = useCallback(async (fromUserId: string, candidate: RTCIceCandidateInit) => {
        const pc = peerConnectionsRef.current.get(fromUserId);
        if (pc) {
            await pc.addIceCandidate(new RTCIceCandidate(candidate));
        }
    }, []);

    // ── Start Screen Share (Host) ──
    const startScreenShare = useCallback(async () => {
        try {
            const stream = await navigator.mediaDevices.getDisplayMedia({
                video: { width: { ideal: 1920 }, height: { ideal: 1080 }, frameRate: { ideal: 30 } },
                audio: true,
            });

            localStreamRef.current = stream;
            setLocalStream(stream);
            setIsScreenSharing(true);

            // When user stops sharing via browser UI
            stream.getVideoTracks()[0].onended = () => {
                stopScreenShare();
            };

            // Create offers to all existing peers
            peers.forEach(peer => {
                if (peer.userId !== userId) {
                    createOffer(peer.userId);
                }
            });

            return stream;
        } catch (err) {
            console.error('[WebRTC] Screen share failed:', err);
            return null;
        }
    }, [peers, userId, createOffer]);

    // ── Stop Screen Share ──
    const stopScreenShare = useCallback(() => {
        localStreamRef.current?.getTracks().forEach(t => t.stop());
        localStreamRef.current = null;
        setLocalStream(null);
        setIsScreenSharing(false);

        // Close all peer connections
        peerConnectionsRef.current.forEach(pc => pc.close());
        peerConnectionsRef.current.clear();
    }, []);

    // ── Send Control Action ──
    const sendControl = useCallback((action: 'play' | 'pause' | 'seek' | 'speed', value?: number) => {
        wsRef.current?.send(JSON.stringify({
            type: 'wp:control',
            roomId,
            action,
            value,
        }));
    }, [roomId]);

    // ── Send Cursor/Reaction ──
    const sendCursor = useCallback((x: number, y: number, reaction?: string) => {
        wsRef.current?.send(JSON.stringify({
            type: 'wp:cursor',
            roomId,
            userName,
            x, y,
            reaction,
        }));
    }, [roomId, userName]);

    // ── Send Sync (Host → all viewers, periodic position broadcast) ──
    const sendSync = useCallback((currentTime: number, isPlaying: boolean) => {
        wsRef.current?.send(JSON.stringify({
            type: 'wp:sync',
            roomId,
            currentTime,
            isPlaying,
        }));
    }, [roomId]);

    // ── Send Chat Message ──
    const sendChat = useCallback((content: string, msgType: 'chat' | 'danmaku' | 'system' = 'chat') => {
        if (!content.trim()) return;
        // Add locally immediately for instant feedback
        setChatMessages(prev => [...prev.slice(-99), {
            fromUserId: userId,
            userName,
            content,
            msgType,
            timestamp: Date.now(),
        }]);
        // Send via WS
        wsRef.current?.send(JSON.stringify({
            type: 'wp:chat',
            roomId,
            userName,
            content,
            msgType,
        }));
    }, [roomId, userId, userName]);

    // ── Send Room Info (Host shares video metadata) ──
    const sendRoomInfo = useCallback((videoId: string, videoTitle: string, paymentModel?: string) => {
        wsRef.current?.send(JSON.stringify({
            type: 'wp:room_info',
            roomId,
            videoId,
            videoTitle,
            paymentModel,
        }));
    }, [roomId]);

    // ── Send Reaction/Emoji ──
    const sendReaction = useCallback((emoji: string, amount: number = 0) => {
        // Add locally immediately
        setReactions(prev => [...prev.slice(-49), {
            fromUserId: userId,
            userName,
            emoji,
            amount,
            timestamp: Date.now(),
        }]);
        wsRef.current?.send(JSON.stringify({
            type: 'wp:reaction',
            roomId,
            userName,
            emoji,
            amount,
        }));
    }, [roomId, userId, userName]);

    // ── Clean up stale cursors ──
    useEffect(() => {
        const interval = setInterval(() => {
            setRemoteCursors(prev => prev.filter(c => Date.now() - c.lastSeen < 5000));
        }, 2000);
        return () => clearInterval(interval);
    }, []);

    return {
        connected,
        peers,
        localStream,
        remoteStreams,
        remoteCursors,
        lastControl,
        lastSync,
        chatMessages,
        roomInfo,
        reactions,
        isScreenSharing,
        startScreenShare,
        stopScreenShare,
        sendControl,
        sendSync,
        sendChat,
        sendRoomInfo,
        sendReaction,
        sendCursor,
    };
}
