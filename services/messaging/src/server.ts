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
            } catch (e: any) {
                socket.send(JSON.stringify({ type: 'error', error: e.message }));
            }
        });

        socket.on('close', () => {
            if (userId) {
                removeUserSocket(userId, socket);
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
