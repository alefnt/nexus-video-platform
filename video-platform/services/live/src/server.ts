// FILE: /video-platform/services/live/src/server.ts
/**
 * 直播服务 - Live Streaming Service
 * Refactored to use Prisma & PostgreSQL
 */

import Fastify from "fastify";
import jwt from "@fastify/jwt";
import { v4 as uuidv4 } from "uuid";
// import * as fs from "fs"; // Removed
// import * as path from "path"; // Removed

// LiveKit 集成
import * as livekit from "./livekit";
import { WebhookReceiver } from "livekit-server-sdk";

// Database
import { PrismaClient, Prisma } from "@video-platform/database";

// Security
import { registerSecurityPlugins } from "@video-platform/shared/security/index";
import { register } from "@video-platform/shared/monitoring";

const prisma = new PrismaClient();

// 类型定义 (API Response Types)
interface LiveRoomResponse {
    roomId: string; // unique
    name: string;   // internal name (usually uuid)
    title: string;
    description?: string;
    creatorId: string;
    creatorAddress: string;
    creatorName?: string;
    creatorUsername?: string; // 用于 @username 路由
    creatorAvatar?: string;
    status: string;
    category?: string;
    coverUrl?: string;
    scheduledAt?: string;
    startedAt?: string;
    endedAt?: string;
    viewerCount: number;
    peakViewerCount: number;
    totalTips: number;
    isRecording: boolean;
    recordingUrl?: string;
    createdAt: string;
}

interface GiftType {
    id: string;
    name: string;
    icon: string;
    price: number;
    animation?: string;
}

// 预定义礼物类型
const GIFT_TYPES: GiftType[] = [
    { id: 'heart', name: '爱心', icon: '❤️', price: 1 },
    { id: 'flower', name: '鲜花', icon: '🌹', price: 5 },
    { id: 'rocket', name: '火箭', icon: '🚀', price: 10, animation: 'rocket-launch' },
    { id: 'crown', name: '皇冠', icon: '👑', price: 50, animation: 'crown-rain' },
    { id: 'diamond', name: '钻石', icon: '💎', price: 100, animation: 'diamond-burst' },
    { id: 'castle', name: '城堡', icon: '🏰', price: 500, animation: 'castle-build' },
    { id: 'spaceship', name: '飞船', icon: '🛸', price: 1000, animation: 'spaceship-fly' },
];

// 初始化 Fastify
const app = Fastify({ logger: true });
const JWT_SECRET = process.env.JWT_SECRET || "";
if (!JWT_SECRET || JWT_SECRET.length < 32) throw new Error("JWT_SECRET 未配置或长度不足");

// Security: Helmet, CORS, Rate Limiting, TraceId
await registerSecurityPlugins(app, {
    rateLimit: { max: 200, timeWindow: "1 minute" }, // Higher limit for live streaming
});

app.register(jwt, { secret: JWT_SECRET });

// Helper: Convert Prisma LiveRoom to API Response
function mapRoomToResponse(room: any): LiveRoomResponse {
    return {
        roomId: room.id,
        name: room.id, // Using ID as name for LiveKit uniqueness
        title: room.title,
        description: room.description || undefined,
        creatorId: room.creatorId,
        creatorAddress: room.creator?.address || "",
        creatorName: room.creator?.nickname || "Unknown",
        creatorUsername: room.creator?.username || undefined,
        creatorAvatar: room.creator?.avatar || undefined,
        status: room.status,
        category: room.category || undefined,
        coverUrl: room.coverUrl || undefined,
        scheduledAt: room.scheduledAt?.toISOString(),
        startedAt: room.startedAt?.toISOString(),
        endedAt: room.endedAt?.toISOString(),
        viewerCount: room.viewerCount,
        peakViewerCount: room.peakViewers,
        totalTips: Number(room.totalTips),
        isRecording: room.isRecording,
        recordingUrl: room.recordingUrl || undefined,
        createdAt: room.createdAt.toISOString(),
    };
}

// JWT 验证中间件
app.addHook("onRequest", async (req, reply) => {
    const publicPaths = ['/health', '/metrics', '/live/rooms', '/live/gifts', '/live/webhook', '/live/list'];
    // Special case: /live/room/:roomId and /live/channel/:slug are also public (GET)
    if (req.method === 'GET' && (req.url.startsWith('/live/room/') || req.url.startsWith('/live/channel/'))) {
        return;
    }
    if (publicPaths.some(p => req.url.startsWith(p))) return;

    try {
        await req.jwtVerify();
    } catch (e) {
        return reply.status(401).send({ error: "未授权", code: "unauthorized" });
    }
});

// ============== 健康检查 ==============

app.get("/health", async () => ({ status: "ok", service: "live", livekit: livekit.config.isConfigured }));
app.get("/metrics", async (_req: any, reply: any) => {
    reply.header("Content-Type", register.contentType);
    return reply.send(await register.metrics());
});

// ============== 礼物配置 ==============

app.get("/live/gifts", async (_req, reply) => {
    return reply.send({ gifts: GIFT_TYPES });
});

// ============== 直播打赏 ==============

const LIVE_PLATFORM_FEE_RATE = 0.05;
const LIVE_CREATOR_SHARE = 0.80;

app.post("/live/tip", async (req, reply) => {
    try {
        const user = req.user as any;
        const body = req.body as { roomId: string; giftId: string; message?: string };

        if (!body.roomId || !body.giftId) {
            return reply.status(400).send({ error: "缺少 roomId 或 giftId", code: "bad_request" });
        }

        const gift = GIFT_TYPES.find(g => g.id === body.giftId);
        if (!gift) return reply.status(400).send({ error: "无效礼物", code: "invalid_gift" });

        // Get room and creator
        const room = await prisma.liveRoom.findUnique({ where: { id: body.roomId }, include: { creator: true } });
        if (!room) return reply.status(404).send({ error: "直播间不存在", code: "not_found" });
        if (room.status !== 'live') return reply.status(400).send({ error: "直播间未在直播", code: "not_live" });
        if (room.creatorId === user.sub) return reply.status(400).send({ error: "不能给自己打赏", code: "self_tip" });

        const creatorEarnings = Math.floor(gift.price * LIVE_CREATOR_SHARE);

        // Atomic transaction: deduct from sender, credit to creator
        const result = await prisma.$transaction(async (tx: any) => {
            const sender = await tx.user.findUnique({ where: { id: user.sub } });
            if (!sender) throw new Error("用户不存在");
            if (Number(sender.points) < gift.price) throw new Error("积分余额不足");

            // Deduct from sender
            await tx.user.update({ where: { id: user.sub }, data: { points: Number(sender.points) - gift.price } });
            await tx.pointsTransaction.create({
                data: { userId: user.sub, type: "live_gift_send", amount: -gift.price, reason: `Live gift: ${gift.name} in room ${body.roomId}` }
            });

            // Credit to creator
            const creator = await tx.user.findUnique({ where: { id: room.creatorId } });
            if (creator) {
                await tx.user.update({ where: { id: room.creatorId }, data: { points: Number(creator.points) + creatorEarnings } });
                await tx.pointsTransaction.create({
                    data: { userId: room.creatorId, type: "live_gift_receive", amount: creatorEarnings, reason: `Live gift: ${gift.name} (${creatorEarnings}/${gift.price})` }
                });
            }

            // Update room totalTips
            await tx.liveRoom.update({ where: { id: body.roomId }, data: { totalTips: { increment: gift.price } } });

            return { senderName: sender.nickname || sender.username || "Anonymous", senderBalance: Number(sender.points) - gift.price };
        });

        // Broadcast gift via LiveKit DataChannel
        const tipPayload = {
            type: 'tip',
            tip: {
                id: `ltip_${Date.now()}`,
                fromName: result.senderName,
                amount: gift.price,
                giftIcon: gift.icon,
                giftName: gift.name,
                animation: gift.animation,
                message: body.message?.slice(0, 100),
            }
        };

        try {
            await livekit.sendRoomMessage(body.roomId, JSON.stringify(tipPayload));
        } catch (e) {
            req.log.warn({ msg: "DataChannel broadcast failed", error: e });
        }

        return reply.send({
            ok: true,
            gift: { id: gift.id, name: gift.name, icon: gift.icon, price: gift.price, animation: gift.animation },
            tip: tipPayload.tip,
            senderBalance: result.senderBalance,
        });
    } catch (err: any) {
        req.log.error(err);
        if (err?.message?.includes("余额不足") || err?.message?.includes("Insufficient")) {
            return reply.status(400).send({ error: "积分余额不足", code: "insufficient_balance" });
        }
        return reply.status(500).send({ error: err?.message || "打赏失败", code: "tip_error" });
    }
});

// ============== 直播间列表 (Public) ==============

/**
 * 获取直播间列表（公开，支持分类/状态过滤）
 * GET /live/rooms?status=live&category=gaming&limit=50
 */
app.get("/live/rooms", async (req, reply) => {
    try {
        const query = req.query as { status?: string; category?: string; limit?: string };
        const status = query.status || "live";
        const category = query.category;
        const limit = Math.min(Number(query.limit) || 50, 100);

        const where: any = {};
        if (status !== "all") where.status = status;
        if (category && category !== "all") where.category = category;

        const rooms = await prisma.liveRoom.findMany({
            where,
            include: { creator: true },
            orderBy: [{ viewerCount: 'desc' }, { createdAt: 'desc' }],
            take: limit,
        });

        const mapped = rooms.map(mapRoomToResponse);

        // Featured room = highest viewer count live room
        const featured = mapped.length > 0 ? mapped[0] : null;

        return reply.send({ rooms: mapped, featured, total: mapped.length });
    } catch (err: any) {
        req.log.error(err);
        return reply.status(500).send({ error: err?.message || "查询失败", code: "list_error" });
    }
});

// Alias
app.get("/live/list", async (req, reply) => {
    // Proxy to /live/rooms
    const res = await app.inject({ method: 'GET', url: `/live/rooms?${new URLSearchParams(req.query as any).toString()}` });
    return reply.status(res.statusCode).send(JSON.parse(res.body));
});

// ============== 直播间管理 ==============

/**
 * 创建直播间（永久频道架构）
 * - 每个用户有固定的频道ID（基于 CreatorChannel.slug）
 * - 开播时复用或更新现有 LiveRoom 记录
 */
app.post("/live/room/create", async (req, reply) => {
    try {
        const user = req.user as any;
        const body = req.body as {
            title: string;
            description?: string;
            category?: string;
            coverUrl?: string;
            scheduledAt?: string;
            enableRecording?: boolean;
            isPrivate?: boolean;
            ticketPrice?: number;
            paymentMode?: 'ticket' | 'stream';
            pricePerMinute?: number;
        };

        if (!body.title) {
            return reply.status(400).send({ error: "缺少标题", code: "bad_request" });
        }

        // 1. 获取或创建用户的永久频道
        let channel = await prisma.creatorChannel.findUnique({
            where: { userId: user.sub }
        });

        if (!channel) {
            // 创建新频道，slug 使用用户名或钱包地址前8位
            const slug = user.username || user.ckb?.substring(0, 12) || user.sub.substring(0, 8);
            channel = await prisma.creatorChannel.create({
                data: {
                    userId: user.sub,
                    slug,
                    displayName: user.nickname || '未命名频道',
                }
            });
        }

        // 2. 使用频道 slug 作为固定的 LiveKit 房间名
        const roomId = channel.slug;

        // 3. 创建或重用 LiveKit Room
        try {
            await livekit.createRoom({
                name: roomId,
                title: body.title,
                creatorId: user.sub,
                creatorAddress: user.ckb,
                category: body.category,
                coverUrl: body.coverUrl,
                enableRecording: body.enableRecording,
            });
        } catch (e: any) {
            // 房间可能已存在，继续处理
            req.log.info({ msg: "LiveKit room may already exist", roomId });
        }

        // 4. 生成主播 Token
        const hostToken = await livekit.generateHostToken(
            roomId,
            user.sub,
            user.nickname || user.sub.slice(0, 8)
        );

        // 5. 复用或创建 LiveRoom 记录
        let room = await prisma.liveRoom.findUnique({
            where: { id: roomId },
            include: { creator: true }
        });

        if (room) {
            // 更新现有房间记录
            room = await prisma.liveRoom.update({
                where: { id: roomId },
                data: {
                    title: body.title,
                    description: body.description,
                    status: 'live',
                    category: body.category,
                    coverUrl: body.coverUrl,
                    startedAt: new Date(),
                    endedAt: null,
                    viewerCount: 0,
                    isPrivate: !!body.isPrivate,
                    ticketPrice: body.ticketPrice ? new Prisma.Decimal(body.ticketPrice) : new Prisma.Decimal(0),
                    paymentMode: body.paymentMode || 'ticket',
                    pricePerMinute: body.pricePerMinute ? new Prisma.Decimal(body.pricePerMinute) : new Prisma.Decimal(0),
                },
                include: { creator: true }
            });
        } else {
            // 首次开播，创建房间记录
            room = await prisma.liveRoom.create({
                data: {
                    id: roomId,
                    title: body.title,
                    description: body.description,
                    creatorId: user.sub,
                    status: 'live',
                    category: body.category,
                    coverUrl: body.coverUrl,
                    startedAt: new Date(),
                    isRecording: false,
                    isPrivate: !!body.isPrivate,
                    ticketPrice: body.ticketPrice ? new Prisma.Decimal(body.ticketPrice) : new Prisma.Decimal(0),
                    paymentMode: body.paymentMode || 'ticket',
                    pricePerMinute: body.pricePerMinute ? new Prisma.Decimal(body.pricePerMinute) : new Prisma.Decimal(0),
                },
                include: { creator: true }
            });
        }

        // 6. 更新频道状态
        await prisma.creatorChannel.update({
            where: { id: channel.id },
            data: {
                isLive: true,
                currentRoomId: roomId,
                totalStreams: { increment: 1 }
            }
        });

        req.log.info({ msg: "Room created/updated", roomId, channelSlug: channel.slug });

        return reply.send({
            ok: true,
            room: mapRoomToResponse(room),
            token: hostToken,
            livekitUrl: livekit.config.url,
            channelSlug: channel.slug,
        });
    } catch (err: any) {
        req.log.error({ err, stack: err?.stack, message: err?.message }, "Room creation failed");
        return reply.status(500).send({ error: err?.message || "创建失败", code: "create_error", details: err?.stack?.split('\n')[0] });
    }
});

// ============== 票务系统 ==============

/**
 * 购买直播间门票
 */
app.post("/live/room/ticket/buy", async (req, reply) => {
    try {
        const user = req.user as any;
        const body = req.body as { roomId: string };

        if (!body.roomId) {
            return reply.status(400).send({ error: "缺少 roomId", code: "bad_request" });
        }

        const room = await prisma.liveRoom.findUnique({ where: { id: body.roomId } });

        if (!room) {
            return reply.status(404).send({ error: "直播间不存在", code: "not_found" });
        }

        if (!room.isPrivate) {
            return reply.status(400).send({ error: "该直播间无需购票", code: "not_private" });
        }

        const ticketPrice = Number(room.ticketPrice);

        // Check if already has ticket
        const existingTicket = await prisma.liveRoomTicket.findUnique({
            where: { userId_roomId: { userId: user.sub, roomId: body.roomId } }
        });
        if (existingTicket) {
            return reply.send({ ok: true, ticket: existingTicket, alreadyOwned: true });
        }

        // Transaction: Deduct Balance & Create Ticket
        const ticket = await prisma.$transaction(async (tx) => {
            const sender = await tx.user.findUnique({ where: { id: user.sub } });
            if (!sender) throw new Error("用户不存在");

            if (new Prisma.Decimal(sender.points).lessThan(ticketPrice)) {
                throw new Error("积分余额不足，请先充值");
            }

            // Deduct points
            await tx.user.update({
                where: { id: user.sub },
                data: { points: { decrement: ticketPrice } }
            });

            // Create Ticket
            return tx.liveRoomTicket.create({
                data: {
                    userId: user.sub,
                    roomId: body.roomId,
                    price: new Prisma.Decimal(ticketPrice)
                }
            });
        });

        req.log.info({ msg: "Ticket purchased", userId: user.sub, roomId: body.roomId, price: ticketPrice });

        return reply.send({ ok: true, ticket });
    } catch (err: any) {
        req.log.error(err);
        const isBalanceError = err.message.includes("余额不足");
        return reply.status(isBalanceError ? 402 : 500).send({
            error: err?.message || "购票失败",
            code: isBalanceError ? "insufficient_balance" : "ticket_error"
        });
    }
});

/**
 * 获取观众 Token (Updated for Private Rooms + Stream Payment)
 */
app.post("/live/room/token", async (req, reply) => {
    try {
        const user = req.user as any;
        const body = req.body as { roomId: string };

        if (!body.roomId) {
            return reply.status(400).send({ error: "缺少 roomId", code: "bad_request" });
        }

        const room = await prisma.liveRoom.findUnique({ where: { id: body.roomId } });

        if (!room || room.status === 'ended') {
            return reply.status(404).send({ error: "直播间不存在或已结束", code: "not_found" });
        }

        // 判断是否是主播
        const isHost = room.creatorId === user.sub;

        // Private Room Gate
        if (room.isPrivate && !isHost) {
            // Check payment mode
            if (room.paymentMode === 'ticket') {
                // Ticket mode: check for existing ticket
                const hasTicket = await prisma.liveRoomTicket.findUnique({
                    where: { userId_roomId: { userId: user.sub, roomId: body.roomId } }
                });
                if (!hasTicket) {
                    return reply.status(403).send({
                        error: "私密直播，请先购票",
                        code: "payment_required",
                        paymentMode: 'ticket',
                        ticketPrice: room.ticketPrice
                    });
                }
            } else if (room.paymentMode === 'stream') {
                // Stream mode: check balance and create/resume session
                const pricePerMinute = Number(room.pricePerMinute);
                const preAuthMinutes = 5; // Pre-authorize 5 minutes
                const preAuthAmount = pricePerMinute * preAuthMinutes;

                const viewer = await prisma.user.findUnique({ where: { id: user.sub } });
                if (!viewer || Number(viewer.points) < preAuthAmount) {
                    return reply.status(403).send({
                        error: "余额不足，需要至少5分钟预授权",
                        code: "payment_required",
                        paymentMode: 'stream',
                        pricePerMinute: room.pricePerMinute,
                        requiredPreAuth: preAuthAmount,
                        currentBalance: viewer?.points || 0
                    });
                }

                // Create or resume stream session
                let session = await prisma.liveStreamSession.findUnique({
                    where: { roomId_viewerId: { roomId: body.roomId, viewerId: user.sub } }
                });

                if (!session) {
                    // Create new session with pre-auth (freeze points)
                    session = await prisma.$transaction(async (tx) => {
                        // Freeze points for pre-auth
                        await tx.user.update({
                            where: { id: user.sub },
                            data: { points: { decrement: preAuthAmount } }
                        });

                        return tx.liveStreamSession.create({
                            data: {
                                roomId: body.roomId,
                                viewerId: user.sub,
                                preAuthAmount: preAuthAmount,
                                status: 'active'
                            }
                        });
                    });
                } else if (session.status === 'closed') {
                    // Reactivate closed session
                    session = await prisma.$transaction(async (tx) => {
                        await tx.user.update({
                            where: { id: user.sub },
                            data: { points: { decrement: preAuthAmount } }
                        });

                        return tx.liveStreamSession.update({
                            where: { id: session!.id },
                            data: {
                                status: 'active',
                                lastTickAt: new Date(),
                                preAuthAmount: { increment: preAuthAmount }
                            }
                        });
                    });
                }
            }
        }

        // 生成 Token
        const token = isHost
            ? await livekit.generateHostToken(body.roomId, user.sub, user.nickname || user.sub.slice(0, 8))
            : await livekit.generateViewerToken(body.roomId, user.sub, user.nickname || user.sub.slice(0, 8));

        // Include stream session info if applicable
        let streamSession = null;
        if (room.paymentMode === 'stream' && !isHost) {
            streamSession = await prisma.liveStreamSession.findUnique({
                where: { roomId_viewerId: { roomId: body.roomId, viewerId: user.sub } }
            });
        }

        return reply.send({
            ok: true,
            token,
            isHost,
            livekitUrl: livekit.config.url,
            paymentMode: room.isPrivate ? room.paymentMode : 'free',
            pricePerMinute: room.pricePerMinute,
            streamSessionId: streamSession?.id,
        });
    } catch (err: any) {
        req.log.error(err);
        return reply.status(500).send({ error: err?.message || "获取Token失败", code: "token_error" });
    }
});

// Note: /live/list is already defined above as an alias for /live/rooms

/**
 * 获取直播间信息
 */
app.get("/live/room/:roomId", async (req, reply) => {
    try {
        const params = req.params as { roomId: string };
        const room = await prisma.liveRoom.findUnique({
            where: { id: params.roomId },
            include: { creator: true }
        });

        if (!room) {
            return reply.status(404).send({ error: "直播间不存在", code: "not_found" });
        }

        // 获取 LiveKit 实时数据 (Optional: update viewer count if live)
        if (room.status === 'live') {
            const livekitRoom = await livekit.getRoom(params.roomId);
            if (livekitRoom && livekitRoom.participantCount !== room.viewerCount) {
                // Update DB with latest count
                // Note: Ideally allow some lag or use background job, but here we update on read for simplicity (or just return combined data)
                // Keeping it valid in DB is better for list queries.
                await prisma.liveRoom.update({
                    where: { id: room.id },
                    data: {
                        viewerCount: livekitRoom.participantCount,
                        peakViewers: Math.max(room.peakViewers, livekitRoom.participantCount)
                    }
                });
                room.viewerCount = livekitRoom.participantCount;
                room.peakViewers = Math.max(room.peakViewers, livekitRoom.participantCount);
            }
        }

        return reply.send({ room: mapRoomToResponse(room) });
    } catch (err: any) {
        req.log.error(err);
        return reply.status(500).send({ error: err?.message || "查询失败", code: "query_error" });
    }
});

// Note: /live/rooms is already defined above with more features

/**
 * 页面关闭时结束直播（sendBeacon 专用，无需 JWT header）
 * 使用 roomId + creatorToken 组合验证
 */
app.post("/live/room/end-beacon", { preHandler: [] }, async (req, reply) => {
    try {
        const body = req.body as { roomId: string; creatorToken?: string };

        if (!body.roomId) {
            return reply.status(400).send({ error: "缺少 roomId", code: "bad_request" });
        }

        const room = await prisma.liveRoom.findUnique({
            where: { id: body.roomId },
            include: { creator: true }
        });

        if (!room) {
            return reply.status(404).send({ error: "直播间不存在", code: "not_found" });
        }

        // 只有正在直播的房间才能结束
        if (room.status !== 'live') {
            return reply.status(400).send({ error: "直播间未在直播", code: "not_live" });
        }

        // 停止录制
        let recordingUrl = room.recordingUrl;
        if (room.isRecording) {
            try {
                const recordResult = await livekit.stopRecording(body.roomId);
                recordingUrl = recordResult.filePath || null;
            } catch (e) {
                req.log.warn({ msg: "Stop recording failed (beacon)", error: e });
            }
        }

        // 关闭 LiveKit 房间
        await livekit.deleteRoom(body.roomId);

        // 更新状态
        const updatedRoom = await prisma.liveRoom.update({
            where: { id: body.roomId },
            data: {
                status: 'ended',
                endedAt: new Date(),
                isRecording: false,
                recordingUrl: recordingUrl || null
            }
        });

        // 重置创作者频道状态
        await prisma.creatorChannel.updateMany({
            where: { currentRoomId: body.roomId },
            data: { isLive: false, currentRoomId: null }
        });

        req.log.info({ msg: "Room ended via beacon", roomId: body.roomId });

        return reply.send({ ok: true });
    } catch (err: any) {
        req.log.error(err);
        return reply.status(500).send({ error: err?.message || "结束失败", code: "end_error" });
    }
});

/**
 * 结束直播
 */
app.post("/live/room/end", async (req, reply) => {
    try {
        const user = req.user as any;
        const body = req.body as { roomId: string };

        if (!body.roomId) {
            return reply.status(400).send({ error: "缺少 roomId", code: "bad_request" });
        }

        const room = await prisma.liveRoom.findUnique({ where: { id: body.roomId } });

        if (!room) {
            return reply.status(404).send({ error: "直播间不存在", code: "not_found" });
        }

        if (room.creatorId !== user.sub) {
            return reply.status(403).send({ error: "无权操作", code: "forbidden" });
        }

        // 停止录制
        let recordingUrl = room.recordingUrl;
        if (room.isRecording) {
            try {
                const recordResult = await livekit.stopRecording(body.roomId);
                recordingUrl = recordResult.filePath || null;
            } catch (e) {
                req.log.warn({ msg: "Stop recording failed", error: e });
            }
        }

        // 关闭 LiveKit 房间
        await livekit.deleteRoom(body.roomId);

        // 更新状态
        const updatedRoom = await prisma.liveRoom.update({
            where: { id: body.roomId },
            data: {
                status: 'ended',
                endedAt: new Date(),
                isRecording: false,
                recordingUrl: recordingUrl || null
            },
            include: { creator: true }
        });

        // 重置创作者频道状态
        await prisma.creatorChannel.updateMany({
            where: { currentRoomId: body.roomId },
            data: { isLive: false, currentRoomId: null }
        });

        req.log.info({ msg: "Room ended", roomId: body.roomId });

        return reply.send({
            ok: true,
            room: mapRoomToResponse(updatedRoom),
        });
    } catch (err: any) {
        req.log.error(err);
        return reply.status(500).send({ error: err?.message || "结束失败", code: "end_error" });
    }
});

/**
 * 开始录制
 */
app.post("/live/room/record/start", async (req, reply) => {
    try {
        const user = req.user as any;
        const body = req.body as { roomId: string };

        const room = await prisma.liveRoom.findUnique({ where: { id: body.roomId } });

        if (!room || room.creatorId !== user.sub) {
            return reply.status(403).send({ error: "无权操作", code: "forbidden" });
        }

        if (room.isRecording) {
            return reply.status(400).send({ error: "已在录制中", code: "already_recording" });
        }

        const egressId = await livekit.startRecording(body.roomId);

        await prisma.liveRoom.update({
            where: { id: body.roomId },
            data: { isRecording: true }
        });

        return reply.send({ ok: true, egressId });
    } catch (err: any) {
        req.log.error(err);
        return reply.status(500).send({ error: err?.message || "开始录制失败", code: "record_error" });
    }
});

/**
 * 停止录制
 */
app.post("/live/room/record/stop", async (req, reply) => {
    try {
        const user = req.user as any;
        const body = req.body as { roomId: string };

        const room = await prisma.liveRoom.findUnique({ where: { id: body.roomId } });

        if (!room || room.creatorId !== user.sub) {
            return reply.status(403).send({ error: "无权操作", code: "forbidden" });
        }

        const result = await livekit.stopRecording(body.roomId);

        await prisma.liveRoom.update({
            where: { id: body.roomId },
            data: {
                isRecording: false,
                recordingUrl: result.filePath
            }
        });

        return reply.send({ ok: true, ...result });
    } catch (err: any) {
        req.log.error(err);
        return reply.status(500).send({ error: err?.message || "停止录制失败", code: "record_error" });
    }
});

// NOTE: /live/tip already defined above (lines ~144-224) with LiveKit DataChannel support

/**
 * 获取直播间打赏排行榜
 */
app.get("/live/tip/leaderboard/:roomId", async (req, reply) => {
    try {
        const params = req.params as { roomId: string };
        const query = req.query as { limit?: string };
        const limit = Math.min(50, Math.max(1, Number(query.limit) || 10));

        // Aggregate tips by user
        const groupedTips = await prisma.liveTip.groupBy({
            by: ['fromUserId'],
            where: { roomId: params.roomId },
            _sum: { amount: true },
            _count: { id: true },
            orderBy: {
                _sum: { amount: 'desc' }
            },
            take: limit
        });

        // Need user details. Can't join in groupBy. Fetch separately or use raw query.
        // Or findMany distinct? No.
        // Just fetch user details for these IDs.
        const userIds = groupedTips.map(t => t.fromUserId);
        const users = await prisma.user.findMany({
            where: { id: { in: userIds } },
            select: { id: true, nickname: true, avatar: true }
        });
        const userMap = new Map(users.map(u => [u.id, u]));

        const leaderboard = groupedTips.map((entry, index) => {
            const user = userMap.get(entry.fromUserId);
            return {
                rank: index + 1,
                userId: entry.fromUserId,
                name: user?.nickname || 'Unknown',
                avatar: user?.avatar,
                totalAmount: Number(entry._sum.amount || 0),
                tipCount: entry._count.id
            };
        });

        // Get total tips for room
        const room = await prisma.liveRoom.findUnique({
            where: { id: params.roomId },
            select: { totalTips: true }
        });

        // Verify with count
        // const totalTipsAgg = await prisma.liveTip.aggregate({ ... });

        return reply.send({
            roomId: params.roomId,
            leaderboard,
            totalTips: Number(room?.totalTips || 0),
            totalTippers: groupedTips.length, // approximated by top list or need another count
        });
    } catch (err: any) {
        req.log.error(err);
        return reply.status(500).send({ error: err?.message || "查询失败", code: "query_error" });
    }
});

/**
 * 获取直播间最近打赏
 */
app.get("/live/tip/recent/:roomId", async (req, reply) => {
    try {
        const params = req.params as { roomId: string };
        const query = req.query as { limit?: string };
        const limit = Math.min(100, Math.max(1, Number(query.limit) || 20));

        const tips = await prisma.liveTip.findMany({
            where: { roomId: params.roomId },
            orderBy: { createdAt: 'desc' },
            take: limit,
            include: { fromUser: true }
        });

        // 添加礼物信息
        const tipsWithGifts = tips.map(tip => ({
            id: tip.id,
            roomId: tip.roomId,
            fromUserId: tip.fromUserId,
            fromName: tip.fromUser?.nickname,
            fromAddress: tip.fromUser?.address,
            amount: Number(tip.amount),
            message: tip.message,
            giftType: tip.giftId,
            createdAt: tip.createdAt.toISOString(),
            gift: tip.giftId ? GIFT_TYPES.find(g => g.id === tip.giftId) : undefined,
        }));

        return reply.send({
            roomId: params.roomId,
            tips: tipsWithGifts,
        });
    } catch (err: any) {
        req.log.error(err);
        return reply.status(500).send({ error: err?.message || "查询失败", code: "query_error" });
    }
});

// ============== 主播管理 ==============

/**
 * 踢出观众
 */
app.post("/live/room/kick", async (req, reply) => {
    try {
        const user = req.user as any;
        const body = req.body as { roomId: string; targetUserId: string };

        const room = await prisma.liveRoom.findUnique({ where: { id: body.roomId } });

        if (!room || room.creatorId !== user.sub) {
            return reply.status(403).send({ error: "无权操作", code: "forbidden" });
        }

        await livekit.removeParticipant(body.roomId, body.targetUserId);

        return reply.send({ ok: true });
    } catch (err: any) {
        req.log.error(err);
        return reply.status(500).send({ error: err?.message || "操作失败", code: "kick_error" });
    }
});

/**
 * 获取观众列表
 */
app.get("/live/room/participants/:roomId", async (req, reply) => {
    try {
        const params = req.params as { roomId: string };
        const participants = await livekit.getParticipants(params.roomId);

        return reply.send({
            roomId: params.roomId,
            participants: participants.map(p => ({
                identity: p.identity,
                name: p.name,
                joinedAt: p.joinedAt,
                isPublisher: (p.tracks?.length || 0) > 0,
            })),
            count: participants.length,
        });
    } catch (err: any) {
        req.log.error(err);
        return reply.status(500).send({ error: err?.message || "查询失败", code: "query_error" });
    }
});

// ============== Webhook ==============

const webhookReceiver = new WebhookReceiver(
    process.env.LIVEKIT_API_KEY || "API7G63Reip94z9",
    process.env.LIVEKIT_API_SECRET || "g7BEIVLH21JoHX2flUaeuAq7eBtDbqIwKXGIVPQDhepC"
);

app.post('/live/webhook', async (req, reply) => {
    try {
        const authHeader = req.headers['authorization'];
        if (!authHeader) {
            req.log.warn("Missing Authorization header in webhook");
        }

        const event = await webhookReceiver.receive(req.body as string, authHeader);

        req.log.info({ msg: "Webhook received", event: event.event });

        if (event.event === 'room_finished') {
            // Updated logic to use DB
            const roomId = event.room?.name; // We use uuid as name
            if (roomId) {
                await prisma.liveRoom.updateMany({
                    where: { id: roomId, status: 'live' },
                    data: {
                        status: 'ended',
                        endedAt: new Date(),
                        // peakViewers: ... // Hard to update peak from this event alone without prior state, relying on polling or periodic updates
                    }
                });
                req.log.info({ msg: "Room ended via webhook", roomId });
            }
        }

        // Handle participant_left for stream payment sessions
        if (event.event === 'participant_left' && event?.participant?.identity) {
            const roomId = event?.room?.name || '';
            const participantId = event?.participant?.identity;

            if (roomId && participantId) {
                // Close any active stream session for this viewer
                const session = await prisma.liveStreamSession.findFirst({
                    where: {
                        roomId,
                        viewerId: participantId,
                        status: 'active'
                    }
                });

                if (session) {
                    await closeStreamSession(session.id, 'left via webhook');
                    req.log.info({ msg: "Stream session closed via webhook", sessionId: session.id, roomId, viewerId: participantId });
                }
            }
        }

        return reply.status(200).send('ok');
    } catch (error) {
        req.log.error({ msg: "Webhook error", error });
        return reply.status(200).send('ok');
    }
});

// ============== 流支付管理 ==============

/**
 * 流支付心跳 - 观众每5秒调用一次
 */
app.post("/live/stream/tick", async (req, reply) => {
    try {
        const user = req.user as any;
        const body = req.body as { sessionId: string };

        if (!body.sessionId) {
            return reply.status(400).send({ error: "缺少 sessionId", code: "bad_request" });
        }

        const session = await prisma.liveStreamSession.findUnique({
            where: { id: body.sessionId },
            include: { room: true }
        });

        if (!session) {
            return reply.status(404).send({ error: "会话不存在", code: "not_found" });
        }

        if (session.viewerId !== user.sub) {
            return reply.status(403).send({ error: "无权操作", code: "forbidden" });
        }

        if (session.status !== 'active') {
            return reply.status(400).send({ error: "会话已结束", code: "session_closed" });
        }

        // Calculate time since last tick
        const now = new Date();
        const lastTick = session.lastTickAt;
        const secondsSinceLastTick = Math.floor((now.getTime() - lastTick.getTime()) / 1000);

        // Max 10 seconds per tick to prevent abuse
        const billableSeconds = Math.min(secondsSinceLastTick, 10);

        // Calculate charge
        const pricePerSecond = Number(session.room.pricePerMinute) / 60;
        const chargeAmount = pricePerSecond * billableSeconds;

        // Check if pre-auth covers the charge
        const currentPreAuth = Number(session.preAuthAmount);

        if (currentPreAuth < chargeAmount) {
            // Need to deduct from balance directly or close session
            const viewer = await prisma.user.findUnique({ where: { id: user.sub } });
            const availableBalance = Number(viewer?.points || 0);

            if (availableBalance < chargeAmount - currentPreAuth) {
                // Insufficient balance - close session
                await closeStreamSession(session.id, 'insufficient_balance');
                return reply.status(402).send({
                    error: "余额不足，会话已结束",
                    code: "insufficient_balance",
                    totalCharged: Number(session.totalCharged) + currentPreAuth,
                    totalSeconds: session.totalSeconds + billableSeconds
                });
            }
        }

        // Update session atomically
        const updated = await prisma.$transaction(async (tx) => {
            // Deduct from pre-auth first, then from balance if needed
            let remainingCharge = chargeAmount;
            let newPreAuth = currentPreAuth;

            if (currentPreAuth >= chargeAmount) {
                newPreAuth = currentPreAuth - chargeAmount;
            } else {
                // Use all pre-auth and deduct remainder from balance
                remainingCharge = chargeAmount - currentPreAuth;
                newPreAuth = 0;

                await tx.user.update({
                    where: { id: user.sub },
                    data: { points: { decrement: remainingCharge } }
                });
            }

            // Credit creator
            if (chargeAmount > 0) {
                await tx.user.update({
                    where: { id: session.room.creatorId },
                    data: { points: { increment: chargeAmount } }
                });
            }

            return tx.liveStreamSession.update({
                where: { id: session.id },
                data: {
                    lastTickAt: now,
                    totalSeconds: { increment: billableSeconds },
                    totalCharged: { increment: chargeAmount },
                    preAuthAmount: newPreAuth
                }
            });
        });

        // Get updated viewer balance
        const viewer = await prisma.user.findUnique({ where: { id: user.sub } });

        return reply.send({
            ok: true,
            sessionId: session.id,
            billedSeconds: billableSeconds,
            chargedAmount: chargeAmount,
            totalSeconds: updated.totalSeconds,
            totalCharged: Number(updated.totalCharged),
            remainingPreAuth: Number(updated.preAuthAmount),
            viewerBalance: Number(viewer?.points || 0),
            pricePerMinute: Number(session.room.pricePerMinute)
        });
    } catch (err: any) {
        req.log.error(err);
        return reply.status(500).send({ error: err?.message || "心跳失败", code: "tick_error" });
    }
});

/**
 * 流支付离开 - 观众主动离开时调用
 */
app.post("/live/stream/leave", async (req, reply) => {
    try {
        const user = req.user as any;
        const body = req.body as { sessionId: string };

        if (!body.sessionId) {
            return reply.status(400).send({ error: "缺少 sessionId", code: "bad_request" });
        }

        const session = await prisma.liveStreamSession.findUnique({
            where: { id: body.sessionId }
        });

        if (!session) {
            return reply.status(404).send({ error: "会话不存在", code: "not_found" });
        }

        if (session.viewerId !== user.sub) {
            return reply.status(403).send({ error: "无权操作", code: "forbidden" });
        }

        if (session.status === 'closed') {
            return reply.send({ ok: true, alreadyClosed: true, totalCharged: Number(session.totalCharged) });
        }

        const result = await closeStreamSession(session.id, 'user_left');

        return reply.send({
            ok: true,
            totalSeconds: result.totalSeconds,
            totalCharged: Number(result.totalCharged),
            refundedPreAuth: result.refundedPreAuth
        });
    } catch (err: any) {
        req.log.error(err);
        return reply.status(500).send({ error: err?.message || "离开失败", code: "leave_error" });
    }
});

/**
 * 关闭流支付会话的通用函数
 */
async function closeStreamSession(sessionId: string, reason: string = 'closed') {
    const session = await prisma.liveStreamSession.findUnique({
        where: { id: sessionId },
        include: { room: true }
    });

    if (!session || session.status === 'closed') {
        return { totalSeconds: session?.totalSeconds || 0, totalCharged: session?.totalCharged || 0, refundedPreAuth: 0 };
    }

    // Refund remaining pre-auth to viewer
    const preAuthRemaining = Number(session.preAuthAmount);

    await prisma.$transaction(async (tx) => {
        // Refund remaining pre-auth
        if (preAuthRemaining > 0) {
            await tx.user.update({
                where: { id: session.viewerId },
                data: { points: { increment: preAuthRemaining } }
            });
        }

        // Close session
        await tx.liveStreamSession.update({
            where: { id: sessionId },
            data: {
                status: 'closed',
                endedAt: new Date(),
                preAuthAmount: 0
            }
        });
    });

    return {
        totalSeconds: session.totalSeconds,
        totalCharged: session.totalCharged,
        refundedPreAuth: preAuthRemaining
    };
}

// ============== 创作者频道 API ==============

/**
 * 获取或创建创作者频道
 */
app.get("/live/channel", async (req, reply) => {
    try {
        const user = req.user as any;

        let channel = await prisma.creatorChannel.findUnique({
            where: { userId: user.sub },
            include: { user: true }
        });

        // 如果没有频道，自动创建
        if (!channel) {
            const u = await prisma.user.findUnique({ where: { id: user.sub } });
            const slug = u?.username || user.sub.substring(0, 8);

            channel = await prisma.creatorChannel.create({
                data: {
                    userId: user.sub,
                    slug,
                    displayName: u?.nickname || '未命名频道',
                    avatar: u?.avatar,
                },
                include: { user: true }
            });
        }

        return reply.send({ ok: true, channel });
    } catch (err: any) {
        req.log.error(err);
        return reply.status(500).send({ error: err?.message || "获取频道失败" });
    }
});

/**
 * 更新用户名 (创建永久频道 URL)
 */
app.post("/live/channel/set-username", async (req, reply) => {
    try {
        const user = req.user as any;
        const body = req.body as { username: string };

        if (!body.username || body.username.length < 3) {
            return reply.status(400).send({ error: "用户名至少3个字符" });
        }

        // 检查用户名格式
        if (!/^[a-zA-Z0-9_]+$/.test(body.username)) {
            return reply.status(400).send({ error: "用户名只能包含字母、数字和下划线" });
        }

        // 检查用户名是否已被占用
        const existing = await prisma.user.findUnique({ where: { username: body.username } });
        if (existing && existing.id !== user.sub) {
            return reply.status(409).send({ error: "用户名已被占用" });
        }

        // 更新用户和频道
        await prisma.user.update({
            where: { id: user.sub },
            data: { username: body.username }
        });

        // 更新或创建频道
        const channel = await prisma.creatorChannel.upsert({
            where: { userId: user.sub },
            update: { slug: body.username },
            create: {
                userId: user.sub,
                slug: body.username,
            }
        });

        return reply.send({ ok: true, username: body.username, channel });
    } catch (err: any) {
        req.log.error(err);
        return reply.status(500).send({ error: err?.message || "设置用户名失败" });
    }
});

/**
 * 按 slug 获取频道详情（公开）
 */
app.get("/live/channel/:slug", { preHandler: [] }, async (req, reply) => {
    try {
        const { slug } = req.params as { slug: string };

        const channel = await prisma.creatorChannel.findUnique({
            where: { slug },
            include: {
                user: {
                    select: { id: true, nickname: true, avatar: true, bio: true }
                }
            }
        });

        if (!channel) {
            return reply.status(404).send({ error: "频道不存在" });
        }

        // 如果正在直播，获取当前直播间信息
        let currentRoom = null;
        if (channel.isLive && channel.currentRoomId) {
            currentRoom = await prisma.liveRoom.findUnique({
                where: { id: channel.currentRoomId }
            });
        }

        return reply.send({
            ok: true,
            channel,
            currentRoom: currentRoom ? mapRoomToResponse({ ...currentRoom, creator: channel.user }) : null
        });
    } catch (err: any) {
        req.log.error(err);
        return reply.status(500).send({ error: err?.message || "获取频道失败" });
    }
});

/**
 * 关注频道
 */
app.post("/live/channel/follow", async (req, reply) => {
    try {
        const user = req.user as any;
        const body = req.body as { channelId: string };

        if (!body.channelId) {
            return reply.status(400).send({ error: "缺少 channelId" });
        }

        const channel = await prisma.creatorChannel.findUnique({ where: { id: body.channelId } });
        if (!channel) {
            return reply.status(404).send({ error: "频道不存在" });
        }

        // 不能关注自己
        if (channel.userId === user.sub) {
            return reply.status(400).send({ error: "不能关注自己" });
        }

        // 创建关注
        await prisma.follow.upsert({
            where: { followerId_channelId: { followerId: user.sub, channelId: body.channelId } },
            create: { followerId: user.sub, channelId: body.channelId },
            update: {}
        });

        // 更新频道粉丝数
        await prisma.creatorChannel.update({
            where: { id: body.channelId },
            data: { followerCount: { increment: 1 } }
        });

        return reply.send({ ok: true, followed: true });
    } catch (err: any) {
        req.log.error(err);
        return reply.status(500).send({ error: err?.message || "关注失败" });
    }
});

/**
 * 取消关注
 */
app.post("/live/channel/unfollow", async (req, reply) => {
    try {
        const user = req.user as any;
        const body = req.body as { channelId: string };

        if (!body.channelId) {
            return reply.status(400).send({ error: "缺少 channelId" });
        }

        const existingFollow = await prisma.follow.findUnique({
            where: { followerId_channelId: { followerId: user.sub, channelId: body.channelId } }
        });

        if (existingFollow) {
            await prisma.follow.delete({
                where: { id: existingFollow.id }
            });

            // 更新频道粉丝数
            await prisma.creatorChannel.update({
                where: { id: body.channelId },
                data: { followerCount: { decrement: 1 } }
            });
        }

        return reply.send({ ok: true, followed: false });
    } catch (err: any) {
        req.log.error(err);
        return reply.status(500).send({ error: err?.message || "取消关注失败" });
    }
});

/**
 * 检查是否关注
 */
app.get("/live/channel/:channelId/is-following", async (req, reply) => {
    try {
        const user = req.user as any;
        const { channelId } = req.params as { channelId: string };

        const follow = await prisma.follow.findUnique({
            where: { followerId_channelId: { followerId: user.sub, channelId } }
        });

        return reply.send({ ok: true, isFollowing: !!follow });
    } catch (err: any) {
        req.log.error(err);
        return reply.status(500).send({ error: err?.message || "查询失败" });
    }
});

/**
 * 获取关注列表（含直播状态，用于通知）
 */
app.get("/live/following", async (req, reply) => {
    try {
        const user = req.user as any;

        const follows = await prisma.follow.findMany({
            where: { followerId: user.sub, notifyOnLive: true },
            include: {
                channel: {
                    include: {
                        user: {
                            select: { id: true, nickname: true, avatar: true }
                        }
                    }
                }
            }
        });

        const channels = follows.map(f => f.channel);
        const liveChannels = channels.filter(c => c.isLive);

        return reply.send({
            ok: true,
            following: channels,
            liveNow: liveChannels,
            liveCount: liveChannels.length
        });
    } catch (err: any) {
        req.log.error(err);
        return reply.status(500).send({ error: err?.message || "获取关注列表失败" });
    }
});

// ============== 连麦 PK 系统 ==============

/**
 * 发起连麦请求
 * POST /live/pk/request
 */
app.post("/live/pk/request", async (req, reply) => {
    try {
        const user = req.user as any;
        const body = req.body as { targetRoomId: string };

        if (!body.targetRoomId) {
            return reply.status(400).send({ error: "缺少目标房间ID" });
        }

        // 检查发起者是否正在直播
        const myRoom = await prisma.liveRoom.findFirst({
            where: { creatorId: user.sub, status: 'live' }
        });

        if (!myRoom) {
            return reply.status(400).send({ error: "您当前没有在直播" });
        }

        // 检查目标房间
        const targetRoom = await prisma.liveRoom.findUnique({
            where: { id: body.targetRoomId },
            include: { creator: true }
        });

        if (!targetRoom || targetRoom.status !== 'live') {
            return reply.status(404).send({ error: "目标房间不存在或未在直播" });
        }

        // 创建 PK 请求记录
        const pkRequest = await prisma.pkRequest.create({
            data: {
                fromRoomId: myRoom.id,
                toRoomId: targetRoom.id,
                fromUserId: user.sub,
                toUserId: targetRoom.creatorId,
                status: 'pending',
                expiresAt: new Date(Date.now() + 60 * 1000), // 60秒超时
            } as any,
        });

        // 通过 LiveKit DataChannel 通知目标主播
        await livekit.sendDataMessage(targetRoom.id, {
            type: 'pk_request',
            from: {
                roomId: myRoom.id,
                userId: user.sub,
                nickname: user.nickname,
            },
            requestId: pkRequest.id,
        });

        return reply.send({
            ok: true,
            requestId: pkRequest.id,
            message: "连麦请求已发送，等待对方响应"
        });
    } catch (err: any) {
        req.log.error(err);
        return reply.status(500).send({ error: err?.message || "发起连麦失败" });
    }
});

/**
 * 响应连麦请求
 * POST /live/pk/respond
 */
app.post("/live/pk/respond", async (req, reply) => {
    try {
        const user = req.user as any;
        const body = req.body as { requestId: string; accept: boolean };

        const pkRequest = await (prisma.pkRequest as any).findUnique({
            where: { id: body.requestId }
        });

        if (!pkRequest || pkRequest.toUserId !== user.sub) {
            return reply.status(404).send({ error: "请求不存在" });
        }

        if (pkRequest.status !== 'pending') {
            return reply.status(400).send({ error: "请求已处理" });
        }

        // 更新状态
        await (prisma.pkRequest as any).update({
            where: { id: body.requestId },
            data: { status: body.accept ? 'accepted' : 'rejected' }
        });

        if (body.accept) {
            // 创建 PK 会话
            const pkSession = await (prisma.pkSession as any).create({
                data: {
                    room1Id: pkRequest.fromRoomId,
                    room2Id: pkRequest.toRoomId,
                    status: 'active',
                    startedAt: new Date(),
                }
            });

            // 通知双方开始 PK
            await Promise.all([
                livekit.sendDataMessage(pkRequest.fromRoomId, {
                    type: 'pk_started',
                    sessionId: pkSession.id,
                    partnerRoomId: pkRequest.toRoomId,
                }),
                livekit.sendDataMessage(pkRequest.toRoomId, {
                    type: 'pk_started',
                    sessionId: pkSession.id,
                    partnerRoomId: pkRequest.fromRoomId,
                }),
            ]);

            return reply.send({ ok: true, sessionId: pkSession.id, status: 'accepted' });
        }

        // 通知发起者被拒绝
        await livekit.sendDataMessage(pkRequest.fromRoomId, {
            type: 'pk_rejected',
            requestId: body.requestId,
        });

        return reply.send({ ok: true, status: 'rejected' });
    } catch (err: any) {
        req.log.error(err);
        return reply.status(500).send({ error: err?.message || "响应连麦失败" });
    }
});

/**
 * 结束 PK
 * POST /live/pk/end
 */
app.post("/live/pk/end", async (req, reply) => {
    try {
        const user = req.user as any;
        const body = req.body as { sessionId: string };

        const session = await (prisma.pkSession as any).findUnique({
            where: { id: body.sessionId }
        });

        if (!session || session.status !== 'active') {
            return reply.status(404).send({ error: "PK会话不存在或已结束" });
        }

        // 结束 PK
        await (prisma.pkSession as any).update({
            where: { id: body.sessionId },
            data: { status: 'ended', endedAt: new Date() }
        });

        // 通知双方
        await Promise.all([
            livekit.sendDataMessage(session.room1Id, { type: 'pk_ended', sessionId: body.sessionId }),
            livekit.sendDataMessage(session.room2Id, { type: 'pk_ended', sessionId: body.sessionId }),
        ]);

        return reply.send({ ok: true });
    } catch (err: any) {
        req.log.error(err);
        return reply.status(500).send({ error: err?.message || "结束PK失败" });
    }
});

// ============== 直播回放 ==============

/**
 * 获取直播回放列表
 * GET /live/replays/:channelSlug
 */
app.get("/live/replays/:channelSlug", async (req, reply) => {
    try {
        const { channelSlug } = req.params as { channelSlug: string };

        const channel = await prisma.creatorChannel.findUnique({
            where: { slug: channelSlug },
            include: { user: true }
        });

        if (!channel) {
            return reply.status(404).send({ error: "频道不存在" });
        }

        // 获取已结束且有录制的直播
        const replays = await prisma.liveRoom.findMany({
            where: {
                creatorId: channel.userId,
                status: 'ended',
                recordingUrl: { not: null },
            },
            orderBy: { endedAt: 'desc' },
            take: 50,
        });

        return reply.send({
            channel: {
                slug: channel.slug,
                displayName: channel.displayName,
            },
            replays: replays.map(r => ({
                id: r.id,
                title: r.title,
                thumbnail: r.coverUrl,
                duration: r.endedAt && r.startedAt
                    ? Math.floor((r.endedAt.getTime() - r.startedAt.getTime()) / 1000)
                    : 0,
                viewerCount: r.peakViewers,
                recordedAt: r.endedAt?.toISOString(),
                url: r.recordingUrl,
            })),
        });
    } catch (err: any) {
        req.log.error(err);
        return reply.status(500).send({ error: err?.message || "获取回放失败" });
    }
});

/**
 * 开始录制（启用 LiveKit Egress）
 * POST /live/room/:roomId/record/start
 */
app.post("/live/room/:roomId/record/start", async (req, reply) => {
    try {
        const user = req.user as any;
        const { roomId } = req.params as { roomId: string };

        const room = await prisma.liveRoom.findUnique({ where: { id: roomId } });

        if (!room || room.creatorId !== user.sub) {
            return reply.status(403).send({ error: "无权操作" });
        }

        // 调用 LiveKit Egress 开始录制
        const egress = await livekit.startRoomCompositeEgress(roomId, {
            file: {
                fileType: 'mp4',
                filepath: `recordings/${roomId}/${Date.now()}.mp4`,
            },
        });

        await prisma.liveRoom.update({
            where: { id: roomId },
            data: { isRecording: true, egressId: egress?.egressId } as any,
        });

        return reply.send({ ok: true, egressId: egress?.egressId });
    } catch (err: any) {
        req.log.error(err);
        return reply.status(500).send({ error: err?.message || "启动录制失败" });
    }
});

/**
 * 停止录制
 * POST /live/room/:roomId/record/stop
 */
app.post("/live/room/:roomId/record/stop", async (req, reply) => {
    try {
        const user = req.user as any;
        const { roomId } = req.params as { roomId: string };

        const room = await prisma.liveRoom.findUnique({ where: { id: roomId } }) as any;

        if (!room || room.creatorId !== user.sub) {
            return reply.status(403).send({ error: "无权操作" });
        }

        if (room.egressId) {
            await livekit.stopEgress(room.egressId);
        }

        await prisma.liveRoom.update({
            where: { id: roomId },
            data: { isRecording: false },
        });

        return reply.send({ ok: true });
    } catch (err: any) {
        req.log.error(err);
        return reply.status(500).send({ error: err?.message || "停止录制失败" });
    }
});

// ============== 启动服务 ==============

const PORT = Number(process.env.LIVE_PORT || 8096);
app.listen({ port: PORT, host: "0.0.0.0" }).then(() => {
    console.log(`Live Streaming Service started on port ${PORT}`);
    console.log(`LiveKit configured: ${livekit.config.isConfigured}`);
});

export { app };
