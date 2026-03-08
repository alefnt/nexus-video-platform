// FILE: /video-platform/client-web/src/hooks/useWatchPartySync.ts
/**
 * Watch Party 同步 Hook
 * 基于 GunDB 实现 P2P 实时同步：
 * - 房间状态管理
 * - 视频播放同步
 * - 实时聊天
 * - 参与者列表
 */

import { useState, useEffect, useRef, useCallback } from 'react';

// GunDB 类型
declare global {
    interface Window {
        Gun?: any;
    }
}

export interface RoomState {
    id: string;
    hostId: string;
    hostName: string;
    videoId: string;
    videoTitle: string;
    videoPoster?: string;
    scheduledStart: number;  // Unix timestamp for countdown
    isPlaying: boolean;
    currentTime: number;
    updatedAt: number;
    status: 'waiting' | 'playing' | 'ended';
}

export interface Participant {
    id: string;
    name: string;
    avatar?: string;
    isHost: boolean;
    joinedAt: number;
    lastSeen: number;
}

export interface ChatMessage {
    id: string;
    senderId: string;
    senderName: string;
    content: string;
    timestamp: number;
    type: 'chat' | 'danmaku' | 'system';
}

interface UseWatchPartySyncOptions {
    roomId: string;
    userId: string;
    userName: string;
    isHost?: boolean;
}

export function useWatchPartySync({ roomId, userId, userName, isHost = false }: UseWatchPartySyncOptions) {
    const [roomState, setRoomState] = useState<RoomState | null>(null);
    const [participants, setParticipants] = useState<Participant[]>([]);
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [isConnected, setIsConnected] = useState(false);
    const gunRef = useRef<any>(null);
    const heartbeatRef = useRef<NodeJS.Timeout | null>(null);

    // Initialize GunDB
    useEffect(() => {
        const initGun = async () => {
            try {
                if (!window.Gun) {
                    const GunModule = await import('gun');
                    gunRef.current = (GunModule.default || GunModule)({
                        localStorage: true,
                        radisk: true
                    });
                } else {
                    gunRef.current = window.Gun({
                        localStorage: true,
                        radisk: true
                    });
                }
                setIsConnected(true);
            } catch (e) {
                console.error('GunDB initialization failed:', e);
            }
        };

        initGun();

        return () => {
            if (heartbeatRef.current) clearInterval(heartbeatRef.current);
        };
    }, []);

    // Subscribe to room state
    useEffect(() => {
        if (!gunRef.current || !roomId) return;

        const roomNode = gunRef.current.get(`watchparty/${roomId}`);

        // Subscribe to room state
        roomNode.get('state').on((data: any) => {
            if (data) {
                setRoomState(data);
            }
        });

        // Subscribe to participants
        roomNode.get('participants').map().on((data: any, key: string) => {
            if (data && data.id) {
                setParticipants(prev => {
                    const filtered = prev.filter(p => p.id !== data.id);
                    // Only include if seen in last 30 seconds
                    if (Date.now() - data.lastSeen < 30000) {
                        return [...filtered, data].sort((a, b) => a.joinedAt - b.joinedAt);
                    }
                    return filtered;
                });
            }
        });

        // Subscribe to chat messages
        roomNode.get('messages').map().on((data: any) => {
            if (data && data.id) {
                setMessages(prev => {
                    if (prev.some(m => m.id === data.id)) return prev;
                    return [...prev, data].sort((a, b) => a.timestamp - b.timestamp).slice(-100);
                });
            }
        });

        // Join room - register as participant
        const joinRoom = () => {
            const participant: Participant = {
                id: userId,
                name: userName,
                isHost,
                joinedAt: Date.now(),
                lastSeen: Date.now()
            };
            roomNode.get('participants').get(userId).put(participant);

            // System message
            if (!isHost) {
                sendMessage(`${userName} 加入了房间`, 'system');
            }
        };

        joinRoom();

        // Heartbeat to show online status
        heartbeatRef.current = setInterval(() => {
            roomNode.get('participants').get(userId).put({
                id: userId,
                name: userName,
                isHost,
                lastSeen: Date.now()
            });
        }, 10000);

        return () => {
            if (heartbeatRef.current) clearInterval(heartbeatRef.current);
            // Leave message
            sendMessage(`${userName} 离开了房间`, 'system');
        };
    }, [roomId, userId, userName, isHost]);

    // Create room (host only)
    const createRoom = useCallback((videoId: string, videoTitle: string, videoPoster: string, scheduledStart: number) => {
        if (!gunRef.current || !isHost) return;

        const state: RoomState = {
            id: roomId,
            hostId: userId,
            hostName: userName,
            videoId,
            videoTitle,
            videoPoster,
            scheduledStart,
            isPlaying: false,
            currentTime: 0,
            updatedAt: Date.now(),
            status: 'waiting'
        };

        gunRef.current.get(`watchparty/${roomId}`).get('state').put(state);
    }, [roomId, userId, userName, isHost]);

    // Update playback state (host only)
    const updatePlayback = useCallback((isPlaying: boolean, currentTime: number) => {
        if (!gunRef.current || !isHost) return;

        gunRef.current.get(`watchparty/${roomId}`).get('state').put({
            isPlaying,
            currentTime,
            updatedAt: Date.now(),
            status: 'playing'
        });
    }, [roomId, isHost]);

    // Start playback (host only)
    const startPlayback = useCallback(() => {
        if (!gunRef.current || !isHost) return;

        gunRef.current.get(`watchparty/${roomId}`).get('state').put({
            isPlaying: true,
            currentTime: 0,
            updatedAt: Date.now(),
            status: 'playing'
        });

        sendMessage('🎬 视频开始播放！', 'system');
    }, [roomId, isHost]);

    // Send chat message
    const sendMessage = useCallback((content: string, type: 'chat' | 'danmaku' | 'system' = 'chat') => {
        if (!gunRef.current || !roomId) return;

        const message: ChatMessage = {
            id: `${userId}-${Date.now()}`,
            senderId: userId,
            senderName: userName,
            content,
            timestamp: Date.now(),
            type
        };

        gunRef.current.get(`watchparty/${roomId}`).get('messages').set(message);
    }, [roomId, userId, userName]);

    return {
        roomState,
        participants,
        messages,
        isConnected,
        createRoom,
        updatePlayback,
        startPlayback,
        sendMessage
    };
}
