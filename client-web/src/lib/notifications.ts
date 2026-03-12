// FILE: /video-platform/client-web/src/lib/notifications.ts
/**
 * Real-time Notification System via WebSocket
 * 
 * Connects to messaging service WebSocket for:
 * - Payment confirmations
 * - New comments/likes
 * - Live stream start notifications
 * - System announcements
 * 
 * Falls back to polling when WebSocket is unavailable.
 */

import { getApiClient } from './apiClient';

export type NotificationType =
    | 'payment_success'
    | 'payment_failed'
    | 'new_comment'
    | 'new_like'
    | 'new_follower'
    | 'live_start'
    | 'nft_minted'
    | 'withdrawal_complete'
    | 'system';

export interface Notification {
    id: string;
    type: NotificationType;
    title: string;
    message: string;
    data?: Record<string, any>;
    read: boolean;
    createdAt: string;
}

type NotificationHandler = (notification: Notification) => void;

class NotificationService {
    private ws: WebSocket | null = null;
    private handlers: Set<NotificationHandler> = new Set();
    private reconnectAttempts = 0;
    private maxReconnectAttempts = 5;
    private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    private pollingTimer: ReturnType<typeof setInterval> | null = null;
    private connected = false;

    connect(): void {
        const jwt = sessionStorage.getItem('vp.jwt');
        if (!jwt) return;

        // Try WebSocket
        const wsUrl = this.getWsUrl();
        try {
            this.ws = new WebSocket(wsUrl);

            this.ws.onopen = () => {
                this.connected = true;
                this.reconnectAttempts = 0;
                console.log('[WS] Connected to notification service');

                // Authenticate
                this.ws?.send(JSON.stringify({
                    type: 'auth',
                    token: jwt,
                }));
            };

            this.ws.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data);
                    if (data.type === 'notification') {
                        this.dispatch(data.payload as Notification);
                    } else if (data.type === 'ping') {
                        this.ws?.send(JSON.stringify({ type: 'pong' }));
                    }
                } catch (e) {
                    console.warn('[WS] Failed to parse message:', e);
                }
            };

            this.ws.onclose = () => {
                this.connected = false;
                console.log('[WS] Disconnected');
                this.scheduleReconnect();
            };

            this.ws.onerror = () => {
                console.warn('[WS] Connection error, falling back to polling');
                this.startPolling();
            };
        } catch (e) {
            console.warn('[WS] WebSocket not available, using polling');
            this.startPolling();
        }
    }

    disconnect(): void {
        if (this.ws) {
            this.ws.close();
            this.ws = null;
        }
        if (this.reconnectTimer) {
            clearTimeout(this.reconnectTimer);
            this.reconnectTimer = null;
        }
        if (this.pollingTimer) {
            clearInterval(this.pollingTimer);
            this.pollingTimer = null;
        }
        this.connected = false;
    }

    onNotification(handler: NotificationHandler): () => void {
        this.handlers.add(handler);
        return () => this.handlers.delete(handler);
    }

    private dispatch(notification: Notification): void {
        this.handlers.forEach(h => {
            try { h(notification); } catch (e) { console.error('[WS] Handler error:', e); }
        });

        // Show browser notification if permitted
        if (Notification.permission === 'granted') {
            new Notification(notification.title, {
                body: notification.message,
                icon: '/icons/icon-192x192.png',
                tag: notification.id,
            });
        }
    }

    private getWsUrl(): string {
        const base = import.meta.env?.VITE_API_URL || window.location.origin;
        const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const host = base.replace(/^https?:\/\//, '');
        return `${wsProtocol}//${host}/messaging/ws`;
    }

    private scheduleReconnect(): void {
        if (this.reconnectAttempts >= this.maxReconnectAttempts) {
            console.warn('[WS] Max reconnect attempts reached, switching to polling');
            this.startPolling();
            return;
        }

        const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000);
        this.reconnectAttempts++;

        this.reconnectTimer = setTimeout(() => {
            console.log(`[WS] Reconnecting (attempt ${this.reconnectAttempts})...`);
            this.connect();
        }, delay);
    }

    private startPolling(): void {
        if (this.pollingTimer) return;

        const client = getApiClient();
        const jwt = sessionStorage.getItem('vp.jwt');
        if (jwt) client.setJWT(jwt);

        this.pollingTimer = setInterval(async () => {
            try {
                const res = await client.get<{ notifications: Notification[] }>('/messaging/notifications/unread');
                if (res?.notifications?.length) {
                    res.notifications.forEach(n => this.dispatch(n));
                }
            } catch {
                // Silently ignore polling errors
            }
        }, 30000); // Poll every 30 seconds
    }

    isConnected(): boolean {
        return this.connected;
    }

    // Request browser notification permission
    async requestPermission(): Promise<boolean> {
        if (!('Notification' in window)) return false;
        if (Notification.permission === 'granted') return true;
        if (Notification.permission === 'denied') return false;
        const result = await Notification.requestPermission();
        return result === 'granted';
    }
}

// Singleton
export const notificationService = new NotificationService();

// React hook
import { useState, useEffect } from 'react';

export function useNotifications() {
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [unreadCount, setUnreadCount] = useState(0);

    useEffect(() => {
        // Connect on mount
        notificationService.connect();

        const unsub = notificationService.onNotification((n) => {
            setNotifications(prev => [n, ...prev].slice(0, 50));
            if (!n.read) setUnreadCount(c => c + 1);
        });

        // Request permission
        notificationService.requestPermission();

        return () => {
            unsub();
            // Don't disconnect — keep connection alive for other components
        };
    }, []);

    const markAsRead = (id: string) => {
        setNotifications(prev =>
            prev.map(n => n.id === id ? { ...n, read: true } : n)
        );
        setUnreadCount(c => Math.max(0, c - 1));
    };

    const clearAll = () => {
        setNotifications([]);
        setUnreadCount(0);
    };

    return {
        notifications,
        unreadCount,
        markAsRead,
        clearAll,
        connected: notificationService.isConnected(),
    };
}
