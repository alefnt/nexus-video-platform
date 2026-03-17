/**
 * Metadata Service — Production Implementation
 * All data persisted to PostgreSQL via Prisma. Redis used as read-through cache.
 * No file-based storage, no in-memory maps for business data.
 * Updated: schema validation relaxed for articles (empty cdnUrl/creatorBitDomain)
 */

import Fastify from "fastify";
import jwt from "@fastify/jwt";
import Redis from "ioredis";
import type { VideoMeta } from "@video-platform/shared/types";
import { MetadataWriteRequestSchema } from "@video-platform/shared/validation/schemas";
import { registerSecurityPlugins } from "@video-platform/shared/security/index";
import { register } from "@video-platform/shared/monitoring";
import { getPrisma, checkDatabaseHealth } from "@video-platform/shared/database/client";
import { Prisma } from "@video-platform/database";

const app = Fastify({ logger: true });
const JWT_SECRET = process.env.JWT_SECRET || "";
if (!JWT_SECRET || JWT_SECRET.length < 32) throw new Error("JWT_SECRET must be at least 32 characters");

await registerSecurityPlugins(app, { rateLimit: { max: 200, timeWindow: "1 minute" } });
app.register(jwt, { secret: JWT_SECRET });

const prisma = getPrisma();
const redis = process.env.REDIS_URL ? new Redis(process.env.REDIS_URL) : null;
const PAYMENT_BASE = process.env.PAYMENT_URL || "http://localhost:8091";
const UPLOAD_FREE_VIDEO_POINTS = Number(process.env.UPLOAD_FREE_VIDEO_POINTS || 100);
const LIKE_REWARD_THRESHOLD = Number(process.env.LIKE_REWARD_THRESHOLD || 10);
const LIKE_REWARD_POINTS = Number(process.env.LIKE_REWARD_POINTS || 100);
const REVIEW_ENABLED = (process.env.DANMAKU_REVIEW_ENABLED || "0") === "1";
const CACHE_TTL = 300; // 5 minutes

// ── Cache helpers ──

async function cacheGet(key: string): Promise<string | null> {
  if (!redis) return null;
  return redis.get(key);
}

async function cacheSet(key: string, value: string, ttl = CACHE_TTL): Promise<void> {
  if (!redis) return;
  await redis.set(key, value, "EX", ttl);
}

async function cacheDel(pattern: string): Promise<void> {
  if (!redis) return;
  // Use SCAN instead of KEYS to avoid blocking Redis in production
  if (!pattern.includes('*')) {
    // Exact key — delete directly
    await redis.del(pattern);
    return;
  }
  const stream = redis.scanStream({ match: pattern, count: 100 });
  const pipeline = redis.pipeline();
  let count = 0;
  for await (const keys of stream) {
    for (const key of keys as string[]) {
      pipeline.del(key);
      count++;
    }
  }
  if (count > 0) await pipeline.exec();
}

// ── SSE for danmaku ──

type SSEClient = { response: any; videoId: string; lastEventId: number; heartbeatTimer?: any };
const sseClients = new Map<string, Set<SSEClient>>();
let globalEventId = 0;

function broadcastDanmaku(videoId: string, payload: any) {
  const set = sseClients.get(videoId);
  if (!set || set.size === 0) return;
  globalEventId++;
  const data = `id: ${globalEventId}\ndata: ${JSON.stringify(payload)}\n\n`;
  for (const client of set) {
    try {
      client.response.write(data);
      client.lastEventId = globalEventId;
    } catch {
      set.delete(client);
      if (client.heartbeatTimer) clearInterval(client.heartbeatTimer);
    }
  }
}

// ── Prisma <-> VideoMeta conversion helpers ──

function videoToMeta(v: any): VideoMeta {
  return {
    id: v.id,
    contentType: v.contentType || "video",
    title: v.title,
    description: v.description || "",
    creatorBitDomain: v.creatorBitDomain || "",
    creatorCkbAddress: v.creatorCkbAddress || "",
    priceUSDI: v.priceUSDI || "0",
    pointsPrice: v.pointsPrice ?? undefined,
    cdnUrl: v.cfPlaybackHls || v.cdnUrlGlobal || v.videoUrl || "",
    cfStreamUid: v.cfStreamUid ?? undefined,
    filecoinCid: v.filecoinCid ?? undefined,
    arweaveTxId: v.arweaveTxId ?? undefined,
    sha256: v.sha256 ?? undefined,
    posterUrl: v.coverUrl ?? undefined,
    coverUrl: v.coverUrl ?? undefined,
    createdAt: v.createdAt?.toISOString?.() || v.createdAt || "",
    genre: v.genre ?? undefined,
    tags: v.tags || [],
    durationSeconds: v.duration || undefined,
    priceMode: v.priceMode || "free",
    streamPricePerMinute: v.streamPricePerMinute ? Number(v.streamPricePerMinute) : undefined,
    allowRemix: v.allowRemix ?? true,
    parentVideoId: v.parentVideoId ?? undefined,
    limitType: v.limitType || "none",
    limitValue: v.limitValue ? Number(v.limitValue) : undefined,
    textContent: v.textContent ?? undefined,
    views: v.views || 0,
    likes: v.likes || 0,
    creatorId: v.creatorId || undefined,
    ...(v.rawMeta || {}),
  };
}

function metaToVideoData(meta: VideoMeta, creatorId: string) {
  return {
    id: meta.id,
    title: meta.title || "Untitled",
    description: meta.description || null,
    coverUrl: meta.posterUrl || meta.coverUrl || null,
    videoUrl: meta.cdnUrl || "",
    duration: meta.durationSeconds || 0,
    contentType: meta.contentType || "video",
    genre: meta.genre || null,
    tags: meta.tags || [],
    creatorBitDomain: meta.creatorBitDomain || null,
    creatorCkbAddress: meta.creatorCkbAddress || null,
    priceUSDI: String(meta.priceUSDI || "0"),
    pointsPrice: meta.pointsPrice ?? null,
    priceMode: meta.priceMode || "free",
    streamPricePerMinute: meta.streamPricePerMinute || 0,
    allowRemix: meta.allowRemix ?? true,
    parentVideoId: meta.parentVideoId || null,
    limitType: meta.limitType || "none",
    limitValue: meta.limitValue ? BigInt(meta.limitValue) : null,
    textContent: meta.textContent || null,
    sha256: meta.sha256 || null,
    cfStreamUid: meta.cfStreamUid || null,
    cfPlaybackHls: meta.cdnUrl || null,
    arweaveTxId: meta.arweaveTxId || null,
    filecoinCid: meta.filecoinCid || null,
    creatorId,
    rawMeta: meta as any,
  };
}

// ── Auth hook ──

app.addHook("onRequest", async (req, reply) => {
  const path = req.url.split("?")[0];
  const publicPaths = ["/health", "/metrics", "/metadata/list", "/metadata/recommendations", "/metadata/trending", "/metadata/ckb/status", "/user/profile/", "/user/by-id/"];
  if (publicPaths.some(p => path.startsWith(p))) return;
  if (req.method === "GET" && path.startsWith("/metadata/")) return;
  try { await req.jwtVerify(); } catch { return reply.status(401).send({ error: "Unauthorized", code: "unauthorized" }); }
});

// ── Health & Metrics ──

app.get("/health", async () => {
  const dbOk = await checkDatabaseHealth();
  return { status: dbOk ? "ok" : "degraded", db: dbOk };
});

app.get("/metrics", async (_req: any, reply: any) => {
  reply.header("Content-Type", register.contentType);
  return reply.send(await register.metrics());
});

// ── Write metadata ──

app.post("/metadata/write", async (req, reply) => {
  try {
    const parsed = MetadataWriteRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: "Invalid request", code: "bad_request", details: parsed.error.flatten() });
    }
    const { meta } = parsed.data;
    const userId = (req.user as any)?.sub;
    if (!userId) return reply.status(401).send({ error: "Unauthorized" });

    const existing = await prisma.video.findUnique({ where: { id: meta.id } });
    const videoData = metaToVideoData(meta, userId);

    if (existing) {
      await prisma.video.update({ where: { id: meta.id }, data: videoData });
    } else {
      await prisma.video.create({ data: videoData });

      // Handle collaborators (Universal Revenue Splits)
      if (meta.collaborators && meta.collaborators.length > 0) {
        const totalShare = meta.collaborators.reduce((sum, c) => sum + Number(c.percentage), 0);
        if (totalShare <= 100) {
          try {
            // Look up fiberAddresses for the collaborators (allow username/email/address aliases)
            const inputIds = meta.collaborators.map(c => String(c.userId));
            const users = await prisma.user.findMany({
              where: {
                OR: [
                  { id: { in: inputIds } },
                  { username: { in: inputIds } },
                  { email: { in: inputIds } },
                  { address: { in: inputIds } }
                ]
              },
              select: { id: true, address: true, username: true, email: true }
            });

            await prisma.revenueSplitRule.createMany({
              data: meta.collaborators.map((c: any) => {
                const searchStr = String(c.userId);
                const u = users.find(u => u.id === searchStr || u.username === searchStr || u.email === searchStr || u.address === searchStr);
                return {
                  targetType: meta.contentType || "video",
                  targetId: meta.id,
                  userId: u?.id || searchStr, // Default to original string if not found, but it will probably throw FK error if not valid UUID
                  percentage: new Prisma.Decimal(c.percentage),
                  fiberAddress: c.fiberAddress || u?.address || null,
                  role: c.role || "collaborator"
                };
              })
            });
          } catch (e: any) {
            req.log.warn({ msg: "Failed to create split rules", err: e.message });
          }
        }
      }
    }

    await cacheDel(`metadata:${meta.id}`);
    await cacheDel("metadata:list:*");
    await cacheDel("metadata:trending");
    await cacheDel("metadata:recommendations");

    if (!existing && Number(meta.priceUSDI) === 0) {
      const authHeader = String(req.headers["authorization"] || "");
      try {
        await fetch(`${PAYMENT_BASE}/payment/points/earn`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: authHeader },
          body: JSON.stringify({ amount: UPLOAD_FREE_VIDEO_POINTS, reason: "Free content upload reward" }),
        });
      } catch (e: any) {
        req.log.warn({ msg: "Points reward failed (non-blocking)", err: String(e?.message) });
      }
    }

    let ownershipNftMinted = false;
    let ownershipSporeId: string | undefined;
    let ownershipMintError: string | undefined;
    if (!existing && meta.creatorCkbAddress) {
      try {
        const authHeader = String(req.headers["authorization"] || "");
        const nftRes = await fetch(`${process.env.NFT_URL || "http://localhost:8095"}/nft/ownership/mint`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: authHeader },
          body: JSON.stringify({ videoId: meta.id, title: meta.title, contentType: meta.contentType || "video", ipfsCid: meta.filecoinCid }),
        });
        if (nftRes.ok) {
          const nftData = await nftRes.json() as any;
          ownershipNftMinted = true;
          ownershipSporeId = nftData?.sporeId;
        } else {
          const errBody = await nftRes.json().catch(() => ({})) as any;
          ownershipMintError = errBody?.error || `NFT service returned ${nftRes.status}`;
          req.log.warn({ msg: "NFT mint returned error (non-blocking)", status: nftRes.status, err: ownershipMintError });
        }
      } catch (e: any) {
        ownershipMintError = e?.message || String(e);
        req.log.warn({ msg: "NFT minting error (non-blocking)", err: ownershipMintError });
      }
    }

    return reply.send({ ok: true, txHash: `db_${meta.id}`, ownershipNftMinted, ownershipSporeId, ownershipMintError });
  } catch (err: any) {
    return reply.status(500).send({ error: err?.message || "Write error", code: "write_error" });
  }
});

// ── Get single metadata ──

app.get("/metadata/:id", async (req, reply) => {
  try {
    const id = (req.params as any).id as string;
    const cacheKey = `metadata:${id}`;
    const cached = await cacheGet(cacheKey);
    if (cached) return reply.send(JSON.parse(cached));

    const video = await prisma.video.findUnique({ where: { id }, include: { creator: { select: { nickname: true, avatar: true } } } });
    if (!video) return reply.status(404).send({ error: "Not found", code: "not_found" });

    const meta = videoToMeta(video);
    await cacheSet(cacheKey, JSON.stringify(meta));
    return reply.send(meta);
  } catch (err: any) {
    return reply.status(500).send({ error: err?.message || "Read error", code: "read_error" });
  }
});

// ── Clear cache ──

app.post("/metadata/cache/clear", async (_req, reply) => {
  await cacheDel("metadata:*");
  return reply.send({ ok: true, message: "Cache cleared" });
});

// ── List metadata ──

app.get("/metadata/list", async (req, reply) => {
  try {
    const q = req.query as any;
    const contentType = q.type || "video";
    const tag = q.tag;
    const page = Math.max(1, Number(q.page || 1));
    const limit = Math.min(100, Math.max(1, Number(q.limit || 50)));
    const offset = (page - 1) * limit;

    const where: any = {
      contentType,
      moderationStatus: "approved",
    };

    if (tag) {
      where.OR = [
        { tags: { has: tag } },
        { genre: { equals: tag, mode: "insensitive" } },
        { title: { contains: tag, mode: "insensitive" } },
      ];
    }

    // Filter expired timed content
    where.NOT = {
      AND: [
        { limitType: "time" },
        { limitValue: { lt: BigInt(Date.now()) } },
      ],
    };

    const videos = await prisma.video.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: offset,
      take: limit,
    });

    const metas = videos.map(videoToMeta);
    return reply.send(metas);
  } catch (err: any) {
    return reply.status(500).send({ error: err?.message || "List error", code: "list_error" });
  }
});

// ── Like / Unlike ──

app.post("/metadata/like", async (req, reply) => {
  try {
    const videoId = (req.body as any)?.videoId;
    if (!videoId) return reply.status(400).send({ error: "Missing videoId", code: "bad_request" });
    try { await req.jwtVerify(); } catch { }
    const userId = (req.user as any)?.sub;
    if (!userId) return reply.status(401).send({ error: "Unauthorized" });

    const existing = await prisma.like.findUnique({ where: { userId_videoId: { userId, videoId } } });
    if (existing) {
      const video = await prisma.video.findUnique({ where: { id: videoId }, select: { likes: true } });
      return reply.send({ ok: true, videoId, count: video?.likes || 0, liked: true });
    }

    const [_, video] = await prisma.$transaction([
      prisma.like.create({ data: { userId, videoId } }),
      prisma.video.update({ where: { id: videoId }, data: { likes: { increment: 1 } }, select: { likes: true, creatorBitDomain: true, creatorCkbAddress: true } }),
    ]);

    // Threshold reward (check once)
    if (video.likes >= LIKE_REWARD_THRESHOLD) {
      const rewardKey = `like_reward:${videoId}`;
      const rewarded = redis ? await redis.get(rewardKey) : null;
      if (!rewarded && video.creatorCkbAddress) {
        try {
          await fetch(`${PAYMENT_BASE}/payment/points/earnTo`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ amount: LIKE_REWARD_POINTS, reason: "Like threshold reward", targetBitDomain: video.creatorBitDomain, targetCkbAddress: video.creatorCkbAddress }),
          });
          if (redis) await redis.set(rewardKey, "1");
        } catch (e: any) {
          req.log.warn({ msg: "Like reward failed", err: String(e?.message) });
        }
      }
    }

    await cacheDel(`metadata:${videoId}`);
    return reply.send({ ok: true, videoId, count: video.likes, liked: true });
  } catch (err: any) {
    return reply.status(500).send({ error: err?.message || "Like error", code: "like_error" });
  }
});

app.post("/metadata/unlike", async (req, reply) => {
  try {
    const videoId = (req.body as any)?.videoId;
    if (!videoId) return reply.status(400).send({ error: "Missing videoId", code: "bad_request" });
    try { await req.jwtVerify(); } catch { }
    const userId = (req.user as any)?.sub;
    if (!userId) return reply.status(401).send({ error: "Unauthorized" });

    const existing = await prisma.like.findUnique({ where: { userId_videoId: { userId, videoId } } });
    if (!existing) {
      const video = await prisma.video.findUnique({ where: { id: videoId }, select: { likes: true } });
      return reply.send({ ok: true, videoId, count: video?.likes || 0, liked: false });
    }

    const [_, video] = await prisma.$transaction([
      prisma.like.delete({ where: { userId_videoId: { userId, videoId } } }),
      prisma.video.update({ where: { id: videoId }, data: { likes: { decrement: 1 } }, select: { likes: true } }),
    ]);

    await cacheDel(`metadata:${videoId}`);
    return reply.send({ ok: true, videoId, count: Math.max(0, video.likes), liked: false });
  } catch (err: any) {
    return reply.status(500).send({ error: err?.message || "Unlike error", code: "unlike_error" });
  }
});

app.get("/metadata/likes/:id", async (req, reply) => {
  try {
    const videoId = (req.params as any)?.id;
    if (!videoId) return reply.status(400).send({ error: "Missing videoId", code: "bad_request" });
    let userId: string | undefined;
    try { await req.jwtVerify(); userId = (req.user as any)?.sub; } catch { }

    const video = await prisma.video.findUnique({ where: { id: videoId }, select: { likes: true } });
    let liked = false;
    if (userId) {
      const likeRecord = await prisma.like.findUnique({ where: { userId_videoId: { userId, videoId } } });
      liked = !!likeRecord;
    }
    return reply.send({ videoId, count: video?.likes || 0, liked });
  } catch (err: any) {
    return reply.status(500).send({ error: err?.message || "Query error", code: "likes_query_error" });
  }
});

// ── Comments ──

app.post("/metadata/comment", async (req, reply) => {
  try {
    const body = (req.body as any) || {};
    const videoId = String(body.videoId || "");
    const text = String(body.text || "").trim();
    const parentId = body.parentId || null;
    const amount = Number(body.amount || 0);
    if (!videoId || !text) return reply.status(400).send({ error: "Missing fields", code: "bad_request" });

    try { await req.jwtVerify(); } catch { }
    const userId = (req.user as any)?.sub;
    if (!userId) return reply.status(401).send({ error: "Unauthorized" });

    let isPaid = false;
    if (amount > 0) {
      const authHeader = String(req.headers["authorization"] || "");
      const res = await fetch(`${PAYMENT_BASE}/payment/points/deduct`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: authHeader },
        body: JSON.stringify({ amount, reason: `Paid Danmaku: ${text.slice(0, 20)}...` }),
      });
      if (!res.ok) {
        const errJson = await res.json().catch(() => ({})) as any;
        return reply.status(400).send({ error: errJson.error || "Insufficient points", code: "payment_failed" });
      }
      isPaid = true;
    }

    const comment = await prisma.comment.create({
      data: {
        videoId,
        userId,
        content: text,
        parentId,
        isHidden: REVIEW_ENABLED,
      },
    });

    await prisma.video.update({ where: { id: videoId }, data: { commentCount: { increment: 1 } } });

    if (isPaid && amount > 0) {
      const video = await prisma.video.findUnique({ where: { id: videoId }, select: { creatorBitDomain: true, creatorCkbAddress: true } });
      if (video?.creatorCkbAddress) {
        const share = Math.floor(amount * 0.8);
        if (share > 0) {
          fetch(`${PAYMENT_BASE}/payment/points/earnTo`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ amount: share, reason: "Danmaku tip", targetBitDomain: video.creatorBitDomain, targetCkbAddress: video.creatorCkbAddress }),
          }).catch(() => { });
        }
      }
    }

    const item = { id: comment.id, userId, text: comment.content, createdAt: comment.createdAt.toISOString(), status: REVIEW_ENABLED ? "pending" : "approved", isPaid, amount: isPaid ? amount : undefined };
    if (!REVIEW_ENABLED) broadcastDanmaku(videoId, { type: "comment", item });
    return reply.send({ ok: true, videoId, comment: item });
  } catch (err: any) {
    return reply.status(500).send({ error: err?.message || "Comment error", code: "comment_error" });
  }
});

app.get("/metadata/comments/:id", async (req, reply) => {
  try {
    const videoId = (req.params as any)?.id;
    const limit = Math.min(200, Number((req.query as any)?.limit || 50));
    if (!videoId) return reply.status(400).send({ error: "Missing videoId", code: "bad_request" });

    const comments = await prisma.comment.findMany({
      where: { videoId, isHidden: false, parentId: null },
      include: {
        user: { select: { nickname: true, avatar: true, address: true } },
        replies: {
          where: { isHidden: false },
          include: { user: { select: { nickname: true, avatar: true, address: true } } },
          orderBy: { createdAt: "asc" },
          take: 10,
        },
      },
      orderBy: { createdAt: "desc" },
      take: limit,
    });

    const formatted = comments.map(c => ({
      id: c.id,
      userId: c.userId,
      userName: c.user?.nickname || undefined,
      userAvatar: c.user?.avatar || undefined,
      text: c.content,
      likes: c.likes,
      isPinned: c.isPinned,
      createdAt: c.createdAt.toISOString(),
      status: "approved" as const,
      replies: c.replies.map(r => ({
        id: r.id,
        userId: r.userId,
        userName: r.user?.nickname || undefined,
        text: r.content,
        createdAt: r.createdAt.toISOString(),
        status: "approved" as const,
      })),
    }));

    return reply.send({ videoId, comments: formatted });
  } catch (err: any) {
    return reply.status(500).send({ error: err?.message || "Comments query error", code: "comments_query_error" });
  }
});

// ── Danmaku SSE stream ──

app.get("/metadata/danmaku/stream/:id", async (req, reply) => {
  try {
    const videoId = (req.params as any)?.id;
    if (!videoId) return reply.status(400).send({ error: "Missing videoId", code: "bad_request" });

    reply.header("Content-Type", "text/event-stream");
    reply.header("Cache-Control", "no-cache");
    reply.header("Connection", "keep-alive");
    reply.header("Access-Control-Allow-Origin", "*");

    const client: SSEClient = { response: reply.raw, videoId, lastEventId: 0 };
    globalEventId++;
    client.lastEventId = globalEventId;
    reply.raw.write(`id: ${globalEventId}\ndata: ${JSON.stringify({ type: "hello", videoId })}\n\n`);

    const set = sseClients.get(videoId) || new Set<SSEClient>();
    set.add(client);
    sseClients.set(videoId, set);

    client.heartbeatTimer = setInterval(() => {
      try {
        globalEventId++;
        reply.raw.write(`id: ${globalEventId}\ndata: heartbeat\n\n`);
      } catch {
        set.delete(client);
        if (client.heartbeatTimer) clearInterval(client.heartbeatTimer);
      }
    }, 30000);

    req.raw.on("close", () => {
      const s = sseClients.get(videoId);
      if (s) { s.delete(client); if (s.size === 0) sseClients.delete(videoId); }
      if (client.heartbeatTimer) clearInterval(client.heartbeatTimer);
    });
  } catch (err: any) {
    return reply.status(500).send({ error: err?.message || "SSE error", code: "sse_error" });
  }
});

// ── Moderation approval ──

app.post("/metadata/moderate/approve", async (req, reply) => {
  try {
    const { videoId, commentId } = (req.body as any) || {};
    if (!videoId || !commentId) return reply.status(400).send({ error: "Missing fields", code: "bad_request" });
    if (!REVIEW_ENABLED) return reply.send({ ok: true, reviewed: false });

    const comment = await prisma.comment.update({ where: { id: commentId }, data: { isHidden: false } });
    broadcastDanmaku(videoId, { type: "comment", item: { id: comment.id, userId: comment.userId, text: comment.content, createdAt: comment.createdAt.toISOString(), status: "approved" } });
    return reply.send({ ok: true, reviewed: true });
  } catch (err: any) {
    return reply.status(500).send({ error: err?.message || "Moderation error", code: "moderate_error" });
  }
});

// ── Recommendations ──

app.get("/metadata/recommendations", async (_req, reply) => {
  try {
    const cacheKey = "metadata:recommendations";
    const cached = await cacheGet(cacheKey);
    if (cached) return reply.send(JSON.parse(cached));

    const trending = await prisma.video.findMany({
      where: { moderationStatus: "approved", contentType: "video" },
      orderBy: { likes: "desc" },
      take: 20,
    });

    const fresh = await prisma.video.findMany({
      where: { moderationStatus: "approved", contentType: "video", id: { notIn: trending.map(v => v.id) } },
      orderBy: { createdAt: "desc" },
      take: 20,
    });

    const combined: VideoMeta[] = [];
    const maxLen = Math.max(trending.length, fresh.length);
    for (let i = 0; i < maxLen; i++) {
      if (i < trending.length) combined.push(videoToMeta(trending[i]));
      if (i < fresh.length) combined.push(videoToMeta(fresh[i]));
    }

    const result = combined.slice(0, 20);
    await cacheSet(cacheKey, JSON.stringify(result), 120);
    return reply.send(result);
  } catch (err: any) {
    return reply.status(500).send({ error: err?.message || "Recommendation error", code: "recommend_error" });
  }
});

// ── Trending ──

app.get("/metadata/trending", async (_req, reply) => {
  try {
    const cacheKey = "metadata:trending";
    const cached = await cacheGet(cacheKey);
    if (cached) return reply.send(JSON.parse(cached));

    const videos = await prisma.video.findMany({
      where: { moderationStatus: "approved", contentType: "video" },
      orderBy: [{ likes: "desc" }, { views: "desc" }],
      take: 12,
    });

    const result = videos.map(videoToMeta);
    await cacheSet(cacheKey, JSON.stringify(result), 120);
    return reply.send(result);
  } catch (err: any) {
    return reply.status(500).send({ error: err?.message || "Trending error", code: "trending_error" });
  }
});

// ── Follow / Unfollow (user-to-user) ──

// Helper: resolve targetId from body (supports targetId or targetAddress)
async function resolveTargetId(body: any): Promise<string | null> {
  if (body?.targetId) return String(body.targetId);
  if (body?.targetAddress) {
    const user = await prisma.user.findFirst({ where: { address: String(body.targetAddress) } });
    return user?.id || null;
  }
  return null;
}

app.post("/metadata/follow", async (req, reply) => {
  try {
    const targetId = await resolveTargetId(req.body as any);
    if (!targetId) return reply.status(400).send({ error: "Missing targetId or targetAddress", code: "bad_request" });
    try { await req.jwtVerify(); } catch { }
    const userId = (req.user as any)?.sub;
    if (!userId) return reply.status(401).send({ error: "Unauthorized" });
    if (userId === targetId) return reply.status(400).send({ error: "Cannot follow yourself", code: "self_follow" });

    await prisma.userFollow.upsert({
      where: { followerId_followingId: { followerId: userId, followingId: targetId } },
      update: {},
      create: { followerId: userId, followingId: targetId },
    });

    return reply.send({ ok: true, following: true });
  } catch (err: any) {
    return reply.status(500).send({ error: err?.message || "Follow error", code: "follow_error" });
  }
});

app.post("/metadata/unfollow", async (req, reply) => {
  try {
    const targetId = await resolveTargetId(req.body as any);
    if (!targetId) return reply.status(400).send({ error: "Missing targetId or targetAddress", code: "bad_request" });
    try { await req.jwtVerify(); } catch { }
    const userId = (req.user as any)?.sub;
    if (!userId) return reply.status(401).send({ error: "Unauthorized" });

    await prisma.userFollow.deleteMany({ where: { followerId: userId, followingId: targetId } });
    return reply.send({ ok: true, following: false });
  } catch (err: any) {
    return reply.status(500).send({ error: err?.message || "Unfollow error", code: "unfollow_error" });
  }
});

app.get("/metadata/bonds/:userId", async (req, reply) => {
  try {
    const subjectId = (req.params as any).userId;
    const targetId = (req.query as any).targetId;
    const targetAddress = (req.query as any).targetAddress;

    // Resolve target: accept either targetId or targetAddress
    let resolvedTargetId = targetId;
    if (!resolvedTargetId && targetAddress) {
      const targetUser = await prisma.user.findFirst({ where: { address: String(targetAddress) } });
      resolvedTargetId = targetUser?.id || null;
    }

    if (resolvedTargetId) {
      const record = await prisma.userFollow.findUnique({ where: { followerId_followingId: { followerId: subjectId, followingId: resolvedTargetId } } });
      return reply.send({ subjectId, targetId: resolvedTargetId, isFollowing: !!record });
    }

    const [followingList, followersList] = await Promise.all([
      prisma.userFollow.findMany({ where: { followerId: subjectId }, select: { followingId: true } }),
      prisma.userFollow.findMany({ where: { followingId: subjectId }, select: { followerId: true } }),
    ]);

    return reply.send({
      subjectId,
      following: followingList.map(f => f.followingId),
      followers: followersList.map(f => f.followerId),
    });
  } catch (err: any) {
    return reply.status(500).send({ error: err?.message || "Bonds query error", code: "bonds_error" });
  }
});

// ── User Profile (public) ──

app.get("/user/profile/:address", async (req: any, reply: any) => {
  try {
    const address = String(req.params.address);
    const user = await prisma.user.findFirst({ where: { address } });
    if (!user) {
      // Return a minimal profile even if user not found
      const followerCount = 0;
      const followingCount = 0;
      return reply.send({
        address,
        displayName: address.slice(0, 8) + "..." + address.slice(-4),
        followers: followerCount,
        following: followingCount,
        totalViews: 0,
        joinedAt: null,
        avatar: null,
        bitDomain: null,
      });
    }
    const [followerCount, followingCount, totalViews] = await Promise.all([
      prisma.userFollow.count({ where: { followingId: user.id } }),
      prisma.userFollow.count({ where: { followerId: user.id } }),
      prisma.video.aggregate({ where: { creatorId: user.id }, _sum: { views: true } }).then(r => r._sum.views || 0),
    ]);
    return reply.send({
      address: user.address,
      displayName: (user as any).displayName || (user as any).bitDomain || (user.address?.slice(0, 8) + "..." + user.address?.slice(-4)),
      followers: followerCount,
      following: followingCount,
      totalViews,
      joinedAt: (user as any).joinedAt || user.updatedAt,
      avatar: (user as any).avatar || null,
      bitDomain: (user as any).bitDomain || null,
      id: user.id,
    });
  } catch (err: any) {
    return reply.status(500).send({ error: err?.message || "Profile error", code: "profile_error" });
  }
});

// ── Content listing (proxy for Profile page) ──

app.get("/metadata/creator-videos", async (req: any, reply: any) => {
  try {
    const creator = String(req.query.creator || "");
    if (!creator) return reply.send({ videos: [] });
    // Find user by address
    const user = await prisma.user.findFirst({ where: { address: creator } });
    if (!user) return reply.send({ videos: [] });
    const videos = await prisma.video.findMany({
      where: { creatorId: user.id },
      orderBy: { createdAt: "desc" },
      take: 50,
    });
    return reply.send({ videos: videos.map(videoToMeta) });
  } catch (err: any) {
    return reply.send({ videos: [] });
  }
});

// ── User lookup by ID (public) ──

app.get("/user/by-id/:id", async (req: any, reply: any) => {
  try {
    const userId = String(req.params.id);
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) return reply.send({ address: null });
    return reply.send({
      address: user.address,
      bitDomain: (user as any).bitDomain || null,
      displayName: (user as any).displayName || (user as any).bitDomain || null,
    });
  } catch {
    return reply.send({ address: null });
  }
});

// ── Gift / Tip System ──

const GIFT_CATALOG = [
  { id: 'fire', name: 'Blaze', icon: '🔥', price: 50, animation: 'fire' },
  { id: 'diamond', name: 'Diamond', icon: '💎', price: 100, animation: 'diamond' },
  { id: 'star', name: 'Star Burst', icon: '🌟', price: 200, animation: 'star' },
  { id: 'rainbow', name: 'Rainbow', icon: '🌈', price: 500, animation: 'rainbow' },
  { id: 'fireworks', name: 'Fireworks', icon: '🎆', price: 1000, animation: 'fireworks' },
];

const PLATFORM_FEE_RATE = 0.05; // 5% platform fee
const CREATOR_SHARE_RATE = 0.80; // 80% to creator

app.get("/metadata/gifts", async (_req, reply) => {
  return reply.send({ gifts: GIFT_CATALOG });
});

app.post("/metadata/gift", async (req, reply) => {
  try {
    try { await req.jwtVerify(); } catch { }
    const userId = (req.user as any)?.sub;
    if (!userId) return reply.status(401).send({ error: "Unauthorized" });

    const body = req.body as any;
    const giftId = String(body?.giftId || "");
    const videoId = body?.videoId ? String(body.videoId) : undefined;
    const targetId = body?.targetId ? String(body.targetId) : undefined;
    const targetAddress = body?.targetAddress ? String(body.targetAddress) : undefined;
    const message = body?.message ? String(body.message).slice(0, 100) : undefined;

    const gift = GIFT_CATALOG.find(g => g.id === giftId);
    if (!gift) return reply.status(400).send({ error: "Invalid gift", code: "invalid_gift" });

    // Resolve target creator
    let creatorId = targetId;
    if (!creatorId && targetAddress) {
      const u = await prisma.user.findFirst({ where: { address: targetAddress } });
      creatorId = u?.id || null;
    }
    if (!creatorId && videoId) {
      const video = await prisma.video.findUnique({ where: { id: videoId }, select: { creatorId: true } });
      creatorId = video?.creatorId || null;
    }
    if (!creatorId) return reply.status(400).send({ error: "Cannot determine creator", code: "no_creator" });
    if (creatorId === userId) return reply.status(400).send({ error: "Cannot tip yourself", code: "self_tip" });

    // Execute atomic transaction: deduct from sender, credit to creator
    const creatorEarnings = Math.floor(gift.price * CREATOR_SHARE_RATE);
    const platformFee = gift.price - creatorEarnings;

    const result = await prisma.$transaction(async (tx: any) => {
      // Check sender balance
      const sender = await tx.user.findUnique({ where: { id: userId } });
      if (!sender) throw new Error("Sender not found");
      if (Number(sender.points) < gift.price) throw new Error("Insufficient balance");

      // Deduct from sender
      await tx.user.update({ where: { id: userId }, data: { points: Number(sender.points) - gift.price } });
      await tx.pointsTransaction.create({
        data: { userId, type: "gift_send", amount: -gift.price, reason: `Sent ${gift.name} to creator` }
      });

      // Credit to creator
      const creator = await tx.user.findUnique({ where: { id: creatorId! } });
      if (creator) {
        await tx.user.update({ where: { id: creatorId! }, data: { points: Number(creator.points) + creatorEarnings } });
        await tx.pointsTransaction.create({
          data: { userId: creatorId!, type: "gift_receive", amount: creatorEarnings, reason: `Received ${gift.name} gift (${creatorEarnings}/${gift.price} after ${platformFee} fee)` }
        });
      }

      return { senderBalance: Number(sender.points) - gift.price, senderName: sender.nickname || sender.username || "Anonymous" };
    });

    return reply.send({
      ok: true,
      gift: { id: gift.id, name: gift.name, icon: gift.icon, price: gift.price, animation: gift.animation },
      tip: {
        id: `tip_${Date.now()}`,
        fromName: result.senderName,
        amount: gift.price,
        creatorEarnings,
        platformFee,
        message,
      },
      senderBalance: result.senderBalance,
    });
  } catch (err: any) {
    if (err?.message === "Insufficient balance") {
      return reply.status(400).send({ error: "Insufficient balance", code: "insufficient_balance" });
    }
    return reply.status(500).send({ error: err?.message || "Gift error", code: "gift_error" });
  }
});

// Note: /metadata/like and /metadata/unlike are already defined above (lines ~349-418)

app.get("/metadata/like-status", async (req, reply) => {
  try {
    try { await req.jwtVerify(); } catch { }
    const userId = (req.user as any)?.sub;
    if (!userId) return reply.send({ liked: false });
    const videoId = String((req.query as any)?.videoId || "");
    if (!videoId) return reply.send({ liked: false });

    try {
      const existing = await prisma.like.findFirst({ where: { userId, videoId } });
      return reply.send({ liked: !!existing });
    } catch {
      return reply.send({ liked: false });
    }
  } catch (err: any) {
    return reply.status(500).send({ error: err?.message || "Like status error" });
  }
});

// NOTE: /metadata/trending and /metadata/recommendations already defined above (lines ~643, ~608)

// ── CKB status (kept for compatibility) ──

app.get("/metadata/ckb/status", async (_req, reply) => {
  return reply.send({ configured: !!process.env.CKB_RPC_URL, ok: true, tipBlockNumber: null, error: null });
});

// ── Start server ──

const port = Number(process.env.METADATA_PORT || 8093);
app.listen({ port, host: "0.0.0.0" }).then(() => app.log.info(`Metadata service listening on :${port}`));
export default app;
