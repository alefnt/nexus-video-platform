/**
 * Messaging & Notification Service
 * 
 * 私信与通知服务 - 使用 ntfy.sh (开源推送)
 * - WebSocket 实时消息
 * - ntfy.sh 推送通知
 */

import Fastify from 'fastify';
import websocket from '@fastify/websocket';
import { PrismaClient } from '@video-platform/database';
import { register, Counter, Gauge } from 'prom-client';
import type { WebSocket } from 'ws';
import { registerSecurityPlugins } from "@video-platform/shared/security/index";

const app = Fastify({ logger: true });
const prisma = new PrismaClient();

// ============== 环境变量 ==============
const PORT = Number(process.env.MESSAGING_PORT || process.env.PORT) || 8103;
const NTFY_URL = process.env.NTFY_URL || 'http://localhost:8070';
const NTFY_TOPIC = process.env.NTFY_TOPIC || 'nexus-video';

// ============== 指标 ==============
const messageCounter = new Counter({
    name: 'messages_total',
    help: 'Total messages sent',
    labelNames: ['type'],
});

const activeConnectionsGauge = new Gauge({
    name: 'messaging_active_connections',
    help: 'Active WebSocket connections',
});

// ============== 在线用户管理 ==============
const userSockets = new Map<string, Set<WebSocket>>();

function addUserSocket(userId: string, socket: WebSocket) {
    if (!userSockets.has(userId)) {
        userSockets.set(userId, new Set());
    }
    userSockets.get(userId)!.add(socket);
    activeConnectionsGauge.inc();
}

function removeUserSocket(userId: string, socket: WebSocket) {
    const sockets = userSockets.get(userId);
    if (sockets) {
        sockets.delete(socket);
        if (sockets.size === 0) {
            userSockets.delete(userId);
        }
    }
    activeConnectionsGauge.dec();
}

function sendToUser(userId: string, message: any) {
    const sockets = userSockets.get(userId);
    if (sockets) {
        const data = JSON.stringify(message);
        sockets.forEach(socket => {
            if (socket.readyState === 1) {
                socket.send(data);
            }
        });
        return true;
    }
    return false;
}

// ============== ntfy.sh 推送 ==============
async function sendNtfyPush(userId: string, title: string, body: string, priority?: string) {
    try {
        // 发送到用户专属 topic
        const topic = `${NTFY_TOPIC}-${userId}`;

        await fetch(`${NTFY_URL}/${topic}`, {
            method: 'POST',
            headers: {
                'Title': title,
                'Priority': priority || 'default',
                'Tags': 'video,notification',
            },
            body: body,
        });

        return true;
    } catch (e: any) {
        console.error('ntfy push failed:', e.message);
        return false;
    }
}

// ============== 插件注册 ==============
await registerSecurityPlugins(app, { rateLimit: { max: 100, timeWindow: "1 minute" } });
app.register(websocket);

// ============== 健康检查 ==============
app.get('/health', async () => ({
    status: 'ok',
    service: 'messaging',
    pushEngine: 'ntfy.sh',
}));
app.get('/metrics', async () => register.metrics());

// ============== Watch Party WebRTC 信令房间管理 ==============
interface WpMember { userId: string; userName: string; socket: WebSocket; isHost: boolean; }
interface WpRoomMeta { videoId?: string; videoTitle?: string; paymentModel?: string; isPlaying?: boolean; status?: string; currentTime?: number; }
const wpRooms = new Map<string, Map<string, WpMember>>(); // roomId → Map<userId, WpMember>
const wpRoomMeta = new Map<string, WpRoomMeta>(); // roomId → room metadata

function wpBroadcast(roomId: string, message: any, excludeUserId?: string) {
    const room = wpRooms.get(roomId);
    if (!room) return;
    const data = JSON.stringify(message);
    room.forEach((member) => {
        if (member.userId !== excludeUserId && member.socket.readyState === 1) {
            member.socket.send(data);
        }
    });
}

function wpSendTo(roomId: string, targetUserId: string, message: any) {
    const room = wpRooms.get(roomId);
    if (!room) return;
    const member = room.get(targetUserId);
    if (member && member.socket.readyState === 1) {
        member.socket.send(JSON.stringify(message));
    }
}

function wpRemoveUser(userId: string) {
    wpRooms.forEach((room, roomId) => {
        if (room.has(userId)) {
            room.delete(userId);
            wpBroadcast(roomId, { type: 'wp:peer_left', userId });
            if (room.size === 0) wpRooms.delete(roomId);
        }
    });
}

// ============== WebSocket 端点 ==============
app.register(async function (fastify) {
    fastify.get('/ws', { websocket: true }, (socket: WebSocket, req) => {
        let userId: string | null = null;

        socket.on('message', async (raw: Buffer) => {
            try {
                const msg = JSON.parse(raw.toString());

                // 认证消息
                if (msg.type === 'auth' && msg.userId) {
                    userId = msg.userId;
                    addUserSocket(userId, socket);
                    socket.send(JSON.stringify({ type: 'auth_ok', userId }));
                    return;
                }

                // 私信
                if (msg.type === 'dm' && msg.toUserId && msg.content && userId) {
                    // 保存消息到数据库
                    const dm = await prisma.directMessage.create({
                        data: {
                            fromUserId: userId,
                            toUserId: msg.toUserId,
                            content: msg.content,
                        },
                    });

                    // 尝试实时发送
                    const delivered = sendToUser(msg.toUserId, {
                        type: 'dm',
                        from: userId,
                        content: msg.content,
                        timestamp: new Date().toISOString(),
                    });

                    // 如果用户不在线，发送 ntfy 推送
                    if (!delivered) {
                        await sendNtfyPush(
                            msg.toUserId,
                            '新私信',
                            msg.content.substring(0, 100),
                            'default'
                        );
                    }

                    messageCounter.inc({ type: 'dm' });
                    socket.send(JSON.stringify({ type: 'dm_sent', msgId: dm.id }));
                }

                // ════════════════ Watch Party WebRTC Signaling ════════════════

                // Join Watch Party room
                if (msg.type === 'wp:join' && msg.roomId && userId) {
                    if (!wpRooms.has(msg.roomId)) wpRooms.set(msg.roomId, new Map());
                    const room = wpRooms.get(msg.roomId)!;
                    room.set(userId, { userId, userName: msg.userName || userId, socket, isHost: !!msg.isHost });

                    // Notify existing peers about new member
                    wpBroadcast(msg.roomId, {
                        type: 'wp:peer_joined',
                        userId,
                        userName: msg.userName || userId,
                        isHost: !!msg.isHost,
                        peers: Array.from(room.entries()).map(([id, m]) => ({
                            userId: id, userName: m.userName, isHost: m.isHost,
                        })),
                    }, userId);

                    // Send current room members + room metadata to the new joiner
                    const meta = wpRoomMeta.get(msg.roomId);
                    socket.send(JSON.stringify({
                        type: 'wp:room_state',
                        roomId: msg.roomId,
                        peers: Array.from(room.entries()).map(([id, m]) => ({
                            userId: id, userName: m.userName, isHost: m.isHost,
                        })),
                        ...(meta || {}),
                    }));

                    messageCounter.inc({ type: 'wp_join' });
                    return;
                }

                // WebRTC SDP Offer — relay to specific peer
                if (msg.type === 'wp:offer' && msg.roomId && msg.targetUserId && userId) {
                    wpSendTo(msg.roomId, msg.targetUserId, {
                        type: 'wp:offer',
                        fromUserId: userId,
                        sdp: msg.sdp,
                    });
                    return;
                }

                // WebRTC SDP Answer — relay to specific peer
                if (msg.type === 'wp:answer' && msg.roomId && msg.targetUserId && userId) {
                    wpSendTo(msg.roomId, msg.targetUserId, {
                        type: 'wp:answer',
                        fromUserId: userId,
                        sdp: msg.sdp,
                    });
                    return;
                }

                // WebRTC ICE Candidate — relay to specific peer
                if (msg.type === 'wp:ice' && msg.roomId && msg.targetUserId && userId) {
                    wpSendTo(msg.roomId, msg.targetUserId, {
                        type: 'wp:ice',
                        fromUserId: userId,
                        candidate: msg.candidate,
                    });
                    return;
                }

                // Collaborative control — broadcast play/pause/seek to all peers
                if (msg.type === 'wp:control' && msg.roomId && userId) {
                    wpBroadcast(msg.roomId, {
                        type: 'wp:control',
                        fromUserId: userId,
                        action: msg.action,   // 'play' | 'pause' | 'seek' | 'speed'
                        value: msg.value,      // seek time or speed value
                        timestamp: Date.now(),
                    }, userId);
                    // Update room metadata on play/pause/seek controls
                    const ctrlMeta = wpRoomMeta.get(msg.roomId);
                    if (ctrlMeta) {
                        if (msg.action === 'play') {
                            ctrlMeta.isPlaying = true;
                            ctrlMeta.status = 'playing';
                        } else if (msg.action === 'pause') {
                            ctrlMeta.isPlaying = false;
                        } else if (msg.action === 'seek' && typeof msg.value === 'number') {
                            ctrlMeta.currentTime = msg.value;
                        }
                    }
                    messageCounter.inc({ type: 'wp_control' });
                    return;
                }

                // Host periodic position sync — broadcast current playback time to all viewers
                if (msg.type === 'wp:sync' && msg.roomId && userId) {
                    wpBroadcast(msg.roomId, {
                        type: 'wp:sync',
                        fromUserId: userId,
                        currentTime: msg.currentTime,
                        isPlaying: msg.isPlaying,
                        timestamp: Date.now(),
                    }, userId);
                    // Update room metadata with latest playback state
                    const syncMeta = wpRoomMeta.get(msg.roomId);
                    if (syncMeta) {
                        syncMeta.isPlaying = msg.isPlaying;
                        syncMeta.currentTime = msg.currentTime;
                        if (msg.isPlaying) syncMeta.status = 'playing';
                    }
                    return;
                }

                // Remote cursor / reactions — broadcast to all peers
                if (msg.type === 'wp:cursor' && msg.roomId && userId) {
                    wpBroadcast(msg.roomId, {
                        type: 'wp:cursor',
                        fromUserId: userId,
                        userName: msg.userName,
                        x: msg.x, y: msg.y,
                        reaction: msg.reaction,
                    }, userId);
                    return;
                }

                // Chat message — broadcast to all room members
                if (msg.type === 'wp:chat' && msg.roomId && userId) {
                    wpBroadcast(msg.roomId, {
                        type: 'wp:chat',
                        fromUserId: userId,
                        userName: msg.userName || userId,
                        content: msg.content,
                        msgType: msg.msgType || 'chat', // 'chat' | 'danmaku' | 'system'
                        timestamp: Date.now(),
                    });
                    messageCounter.inc({ type: 'wp_chat' });
                    return;
                }

                // Room info update — host shares video metadata with room
                if (msg.type === 'wp:room_info' && msg.roomId && userId) {
                    wpRoomMeta.set(msg.roomId, {
                        videoId: msg.videoId,
                        videoTitle: msg.videoTitle,
                        paymentModel: msg.paymentModel,
                        isPlaying: false,
                        status: 'waiting',
                        currentTime: 0,
                    });
                    wpBroadcast(msg.roomId, {
                        type: 'wp:room_info',
                        fromUserId: userId,
                        videoId: msg.videoId,
                        videoTitle: msg.videoTitle,
                        paymentModel: msg.paymentModel,
                        timestamp: Date.now(),
                    }, userId);
                    return;
                }

                // Reaction/emoji — broadcast to all room members
                if (msg.type === 'wp:reaction' && msg.roomId && userId) {
                    wpBroadcast(msg.roomId, {
                        type: 'wp:reaction',
                        fromUserId: userId,
                        userName: msg.userName || userId,
                        emoji: msg.emoji,
                        amount: msg.amount || 0,
                        timestamp: Date.now(),
                    });
                    return;
                }

                // Leave Watch Party room
                if (msg.type === 'wp:leave' && msg.roomId && userId) {
                    const room = wpRooms.get(msg.roomId);
                    if (room) {
                        const member = room.get(userId);
                        room.delete(userId);
                        wpBroadcast(msg.roomId, { type: 'wp:peer_left', userId, userName: member?.userName || userId });
                        if (room.size === 0) {
                            wpRooms.delete(msg.roomId);
                            wpRoomMeta.delete(msg.roomId);
                        }
                    }
                    return;
                }

            } catch (e: any) {
                socket.send(JSON.stringify({ type: 'error', error: e.message }));
            }
        });

        socket.on('close', () => {
            if (userId) {
                removeUserSocket(userId, socket);
                wpRemoveUser(userId);
            }
        });
    });
});

// ============== REST API ==============

/**
 * 发送系统通知
 * POST /notifications/send
 */
app.post('/notifications/send', async (req, reply) => {
    try {
        const body = req.body as { userId: string; title: string; body: string; type?: string };

        if (!body.userId || !body.title) {
            return reply.status(400).send({ error: '缺少参数' });
        }

        // 保存通知
        const notification = await prisma.notification.create({
            data: {
                userId: body.userId,
                title: body.title,
                body: body.body,
                type: body.type || 'system',
                read: false,
            },
        });

        // 实时推送
        const delivered = sendToUser(body.userId, {
            type: 'notification',
            ...notification,
        });

        // ntfy 推送
        if (!delivered) {
            await sendNtfyPush(body.userId, body.title, body.body || '');
        }

        messageCounter.inc({ type: 'notification' });
        return reply.send({ ok: true, notificationId: notification.id, delivered });
    } catch (err: any) {
        req.log.error(err, 'Send notification failed');
        return reply.status(500).send({ error: err?.message });
    }
});

/**
 * 获取用户通知列表
 */
app.get('/notifications', async (req, reply) => {
    try {
        const query = req.query as { userId?: string; limit?: string };
        const userId = query.userId;
        const limit = parseInt(query.limit || '50');

        if (!userId) {
            return reply.status(400).send({ error: '缺少 userId' });
        }

        const notifications = await prisma.notification.findMany({
            where: { userId },
            orderBy: { createdAt: 'desc' },
            take: limit,
        });

        return reply.send({ notifications });
    } catch (err: any) {
        return reply.status(500).send({ error: err?.message });
    }
});

/**
 * 获取 ntfy 订阅信息
 * GET /notifications/subscribe-info
 */
app.get('/notifications/subscribe-info', async (req, reply) => {
    const query = req.query as { userId: string };

    if (!query.userId) {
        return reply.status(400).send({ error: '缺少 userId' });
    }

    const topic = `${NTFY_TOPIC}-${query.userId}`;

    return reply.send({
        engine: 'ntfy.sh',
        subscribeUrl: `${NTFY_URL}/${topic}/json`,
        websocketUrl: `${NTFY_URL.replace('http', 'ws')}/${topic}/ws`,
        topic,
        instructions: [
            '1. 安装 ntfy 手机App (Android/iOS)',
            `2. 订阅 topic: ${topic}`,
            '3. 即可收到推送通知',
        ],
    });
});

// ============== 启动 ==============
const start = async () => {
    try {
        await app.listen({ port: PORT, host: '0.0.0.0' });
        console.log(`💬 Messaging service (ntfy.sh) running on port ${PORT}`);
    } catch (err) {
        app.log.error(err);
        process.exit(1);
    }
};

start();
