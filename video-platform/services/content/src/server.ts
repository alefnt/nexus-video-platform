// FILE: /video-platform/services/content/src/server.ts
/**
 * 功能说明：
 * - 内容服务：上传视频（Base64），加密后存储（模拟 Filecoin/Arweave 返回 CID/TX）。
 * - 提供流 URL（HLS 模拟）与原始数据接口（离线缓存）。
 *
 * 环境变量：
 * - process.env.JWT_SECRET
 * - process.env.CONTENT_PORT (默认 8092)
 */

import Fastify from "fastify";
import jwt from "@fastify/jwt";
import { writeFileSync, mkdirSync, existsSync, readFileSync, createReadStream } from "node:fs";
import { resolve } from "node:path";
import { v4 as uuidv4 } from "uuid";
import type { UploadRequest, UploadResponse, EncryptedVideoRecord, StreamTicket } from "@video-platform/shared/types";
import { generateEncryptionKeyHash } from "@video-platform/shared/web3/ckb";
import { generateVideoPHash, hammingDistance } from "@video-platform/shared/utils/phash";
import crypto from "node:crypto";
import { UploadRequestSchema, OfflinePlayGrantSchema } from "@video-platform/shared/validation/schemas";
import { createMonitoringService, ErrorType } from "@video-platform/shared/monitoring/metrics";
import { uploadToArweave } from "@video-platform/shared/web3/arweave";
import { PrismaClient } from "@video-platform/database";
import { getHybridStorage } from "@video-platform/shared/storage/hybridStorage";
import type { ContentType as HybridContentType } from "@video-platform/shared/storage/storageManifest";
import { registerSecurityPlugins } from "@video-platform/shared/security/index";
import { startStorageWorker, triggerAuditNow } from './consistencyAudit';

const prisma = new PrismaClient();

const app = Fastify({ logger: true, bodyLimit: 500 * 1024 * 1024 }); // 500MB limit for video uploads
const JWT_SECRET = process.env.JWT_SECRET || "";
if (!JWT_SECRET || JWT_SECRET.length < 32) throw new Error("JWT_SECRET 未配置或长度不足");

// Security: Helmet, CORS, Rate Limiting, TraceId
await registerSecurityPlugins(app, { rateLimit: { max: 100, timeWindow: "1 minute" } });

app.register(jwt, { secret: JWT_SECRET });
// 新增：初始化监控服务与指标端点
const monitoring = createMonitoringService("content", app.log);
app.get("/metrics", async () => monitoring.getMetrics());

// 新增：幂等中间件（POST）
const idemCache = new Map<string, { status: number; body: any; expiresAt: number; paramsHash: string }>();
function hashParams(obj: any): string { try { return Buffer.from(JSON.stringify(obj || {})).toString("base64url"); } catch { return ""; } }

// Periodic cleanup of expired idempotency entries to prevent memory leak
setInterval(() => {
  const now = Date.now();
  for (const [key, val] of idemCache) {
    if (now >= val.expiresAt) idemCache.delete(key);
  }
}, 60_000); // Every 60 seconds

app.addHook("preHandler", async (req, reply) => {
  if (req.method !== "POST") return;
  const key = (req.headers["idempotency-key"] || req.headers["Idempotency-Key"] || "") as string;
  if (!key) return;
  const paramsHash = hashParams(req.body || {});
  const cacheKey = `${req.url}|${key}`;
  const hit = idemCache.get(cacheKey);
  if (hit && Date.now() < hit.expiresAt) {
    if (hit.paramsHash && hit.paramsHash !== paramsHash) {
      return reply.status(409).send({ error: "Idempotency-Key 参数不一致", code: "idempotency_conflict" });
    }
    return reply.status(hit.status).send(hit.body);
  }
  (req as any)._idempotency = { cacheKey, paramsHash };
});
app.addHook("onSend", async (req, reply, payload: any) => {
  if (req.method !== "POST") return payload;
  const mark = (req as any)._idempotency;
  if (!mark) return payload;
  const ttlMs = 15 * 60 * 1000;
  try {
    const body = typeof payload === "string" ? (() => { try { return JSON.parse(payload); } catch { return payload; } })() : payload;
    idemCache.set(mark.cacheKey, { status: reply.statusCode, body, expiresAt: Date.now() + ttlMs, paramsHash: mark.paramsHash });
  } catch { }
  return payload;
});

const STORAGE_DIR = resolve(process.cwd(), "storage");
const FILES_DIR = resolve(STORAGE_DIR, "files");
if (!existsSync(STORAGE_DIR)) mkdirSync(STORAGE_DIR, { recursive: true });
if (!existsSync(FILES_DIR)) mkdirSync(FILES_DIR, { recursive: true });

// ─── HybridStorageEngine initialization ───
const hybridStorage = getHybridStorage();
// Migrate legacy records.json into new storage manifest
const LEGACY_RECORDS_PATH = resolve(STORAGE_DIR, "records.json");
const migrated = hybridStorage.migrateLegacy(LEGACY_RECORDS_PATH);
if (migrated > 0) console.log(`[Content] Migrated ${migrated} legacy records to storage manifest`);

// ─── Start Storage Worker (Audit + Lifecycle Cron) ───
try {
  await startStorageWorker();
} catch (err) {
  console.warn('[Content] ⚠️ Storage worker failed to start (Redis may not be available):', (err as Error).message);
}

// 云/去中心化配置（可选）
const CF_ACCOUNT_ID = process.env.CF_ACCOUNT_ID || process.env.CLOUDFLARE_ACCOUNT_ID || "";
const CF_STREAM_TOKEN = process.env.CF_STREAM_API_TOKEN || process.env.CLOUDFLARE_STREAM_TOKEN || "";
const WEB3_STORAGE_TOKEN = process.env.WEB3_STORAGE_TOKEN || "";
const CONTENT_PORT = Number(process.env.CONTENT_PORT || 8092);
const PUBLIC_CONTENT_BASEURL = process.env.PUBLIC_CONTENT_BASEURL || `http://localhost:${CONTENT_PORT}`;
const CF_REQUIRE_SIGNED = (process.env.CF_REQUIRE_SIGNED_URLS || "").toString() === "1";
const CF_SIGNED_MODE = (process.env.CF_SIGNED_MODE || "api").toString();
const CF_TOKEN_TTL_SECONDS = Number(process.env.CF_TOKEN_TTL_SECONDS || 3600);
// 新增：本地签名密钥配置（Cloudflare Stream Signed URLs）
const CF_SIGNING_KEY_ID = process.env.CF_SIGNING_KEY_ID || "";
const CF_SIGNING_PRIVATE_KEY_PEM = process.env.CF_SIGNING_PRIVATE_KEY_PEM || "";

// 移除本地 JSON 记录函数，改用 Prisma 数据库
// RECORDS_PATH 与 ENTITLEMENTS_PATH 相关逻辑已废弃

async function uploadToWeb3Storage(fileBuffer: Buffer): Promise<string | undefined> {
  if (!WEB3_STORAGE_TOKEN) return undefined;
  try {
    const res = await fetch("https://api.web3.storage/upload", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${WEB3_STORAGE_TOKEN}`,
        "Content-Type": "application/octet-stream",
      },
      body: fileBuffer as any,
    });
    if (!res.ok) return undefined;
    const cid = res.headers.get("x-uploaded-cid") || (await res.text());
    // 响应体可能为 JSON { cid } 或纯 CID，做兼容处理
    try {
      const parsed = JSON.parse(cid || "{}");
      return parsed.cid || parsed.value?.cid || undefined;
    } catch {
      return cid || undefined;
    }
  } catch {
    return undefined;
  }
}

async function uploadToCloudflareStream(fileUrl: string): Promise<{ uid?: string; hls?: string }> {
  if (!CF_ACCOUNT_ID || !CF_STREAM_TOKEN) return {};
  try {
    // 尝试使用 Copy API（从 URL 拉取）。注意：本地开发环境的 URL 对 Cloudflare 可能不可达。
    const endpoint = `https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT_ID}/stream/copy`;
    const res = await fetch(endpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${CF_STREAM_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ url: fileUrl, meta: { name: fileUrl } }),
    });
    const json = await res.json();
    if (!res.ok || !json?.success) {
      return {};
    }
    const uid = json?.result?.uid as string | undefined;
    const hls = uid ? `https://videodelivery.net/${uid}/manifest/video.m3u8` : undefined;
    return { uid, hls };
  } catch {
    return {};
  }
}

async function createCloudflareDirectUpload(): Promise<{ uid?: string; uploadURL?: string }> {
  if (!CF_ACCOUNT_ID || !CF_STREAM_TOKEN) return {};
  try {
    const endpoint = `https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT_ID}/stream/direct_upload`;
    const res = await fetch(endpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${CF_STREAM_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        // 直传无文件名也可创建，此处可选传 meta
        creator: "video-platform",
      }),
    });
    const json = await res.json();
    if (!res.ok || !json?.success) return {};
    return { uid: json?.result?.uid, uploadURL: json?.result?.uploadURL };
  } catch {
    return {};
  }
}

async function getCloudflareVideoStatus(uid: string): Promise<{ readyToStream?: boolean; status?: any }> {
  if (!CF_ACCOUNT_ID || !CF_STREAM_TOKEN) return {};
  try {
    const endpoint = `https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT_ID}/stream/${uid}`;
    const res = await fetch(endpoint, {
      headers: { Authorization: `Bearer ${CF_STREAM_TOKEN}` },
    });
    const json = await res.json();
    if (!res.ok || !json?.success) return {};
    return { readyToStream: json?.result?.readyToStream, status: json?.result?.status };
  } catch {
    return {};
  }
}

// 生成 TUS 断点续传直传链接（返回 Location）
async function createCloudflareTusUpload(opts: { uploadLength: number; name?: string; filetype?: string; maxDurationSeconds?: number }) {
  if (!CF_ACCOUNT_ID || !CF_STREAM_TOKEN) return {} as { location?: string };
  try {
    const endpoint = `https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT_ID}/stream?direct_user=true`;
    // TUS 需要在首个请求包含 Tus-Resumable、Upload-Length、Upload-Metadata
    const metaPairs: string[] = [];
    if (opts.maxDurationSeconds) metaPairs.push(`maxdurationseconds ${Buffer.from(String(opts.maxDurationSeconds)).toString("base64")}`);
    if (opts.name) metaPairs.push(`name ${Buffer.from(opts.name).toString("base64")}`);
    if (opts.filetype) metaPairs.push(`filetype ${Buffer.from(opts.filetype).toString("base64")}`);
    const res = await fetch(endpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${CF_STREAM_TOKEN}`,
        "Tus-Resumable": "1.0.0",
        "Upload-Length": String(opts.uploadLength),
        "Upload-Metadata": metaPairs.join(","),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({}),
    });
    const loc = res.headers.get("Location") || undefined;
    if (!res.ok || !loc) return {} as { location?: string };
    return { location: loc };
  } catch {
    return {} as { location?: string };
  }
}

app.addHook("onRequest", async (req, reply) => {
  (req as any)._start = process.hrtime.bigint();
  if (req.url.startsWith("/health") || req.url.startsWith("/metrics")) return;
  // 免费 HLS 清单与分片允许匿名访问
  if (req.method === "GET" && req.url.startsWith("/content/hls/")) return;
  try { await req.jwtVerify(); } catch (e) {
    const userId = "unknown";
    monitoring.record403Error(req.url, userId, ErrorType.UNAUTHORIZED, {
      method: req.method,
      userAgent: req.headers["user-agent"],
      ip: req.ip,
    });
    return reply.status(401).send({ error: "未授权", code: "unauthorized" });
  }
});

app.addHook("onResponse", async (req, reply) => {
  const start = (req as any)._start as bigint | undefined;
  if (typeof start === "bigint") {
    const end = process.hrtime.bigint();
    const durationSeconds = Number(end - start) / 1e9;
    monitoring.recordRequestDuration(req.method, req.url, reply.statusCode, durationSeconds);
  }
});

app.get("/health", async () => ({ status: "ok" }));

app.post("/content/upload", async (req, reply) => {
  try {
    const parsed = UploadRequestSchema.safeParse((req.body || {}) as UploadRequest);
    if (!parsed.success) {
      return reply.status(400).send({ error: "参数错误", code: "bad_request", details: parsed.error.flatten() });
    }
    const body = parsed.data;
    const keyHash = generateEncryptionKeyHash(body.creatorCkbAddress, body.videoId);

    // Determine extension & Type
    let ext = "mp4";
    let type = body.contentType || "video";

    if (type === "audio") ext = "mp3";
    else if (type === "article") ext = "pdf"; // Default for binary articles, textContent stored in metadata

    const base64Path = resolve(STORAGE_DIR, `${body.videoId}.base64`);
    writeFileSync(base64Path, body.base64Content);
    const fileBuf = Buffer.from(body.base64Content, "base64");
    const mp4Path = resolve(FILES_DIR, `${body.videoId}.${ext}`);
    writeFileSync(mp4Path, fileBuf);

    const sha = crypto.createHash("sha256").update(fileBuf).digest("hex");

    // ─── HybridStorage: async push to MinIO(hot) → Filecoin(warm) → Arweave(cold) ───
    const hybridContentType: HybridContentType = type === 'audio' ? 'music' : type === 'article' ? 'article' : 'video';
    hybridStorage.upload(fileBuf, {
      contentId: body.videoId,
      contentType: hybridContentType,
      title: 'Upload',
      creatorAddress: body.creatorCkbAddress,
      encryptionKeyHash: keyHash,
      skipCold: type !== 'article', // Only articles go to Arweave immediately
    }).then(hsResult => {
      console.log(`[HybridStorage] Upload complete for ${body.videoId}: cdn=${hsResult.cdnUrl || 'n/a'}`);
    }).catch(err => {
      console.error(`[HybridStorage] Upload failed for ${body.videoId}:`, err?.message);
    });
    const userId = (req.user as any)?.sub;
    if (!userId) throw new Error("User not authenticated");

    // ============================================
    // Type-Specific Deduplication & Storage
    // ============================================

    if (type === "audio") {
      // 1. Music Deduplication (SHA-256)
      const existingMusic = await prisma.music.findFirst({ where: { sha256: sha } });
      if (existingMusic) {
        return reply.status(409).send({
          error: "Duplicate audio detected (Music Ownership Protection)",
          code: "duplicate_music",
          details: { originalId: existingMusic.id }
        });
      }

      // 2. Create Music Record
      // Note: We don't have pHash for audio yet (need chromaprint), skipping for now.
      await prisma.music.create({
        data: {
          id: body.videoId,
          title: "Untitled Audio",
          audioUrl: `file://${body.videoId}`,
          sha256: sha,
          creatorId: userId,
          duration: 0,
          size: fileBuf.length,
          moderationStatus: "pending",
        }
      });

    } else if (type === "article") {
      // 1. Article Deduplication (SHA-256 of content)
      // Note: For article, base64Content IS the content (PDF or Markdown).
      const existingArticle = await prisma.article.findFirst({ where: { textHash: sha } });
      if (existingArticle) {
        return reply.status(409).send({
          error: "Duplicate article content (Text Ownership Protection)",
          code: "duplicate_article",
          details: { originalId: existingArticle.id }
        });
      }

      // 2. Create Article Record
      let contentStr = "";
      try { contentStr = fileBuf.toString("utf-8"); } catch { } // Try to treat as text

      await prisma.article.create({
        data: {
          id: body.videoId,
          title: "Untitled Article",
          content: contentStr.substring(0, 10000),
          textHash: sha,
          creatorId: userId,
          moderationStatus: "pending",
        }
      });

    } else {
      // DEFAULT: VIDEO
      // Deduplication Check 1: Perfect Hash Match
      const existingExact = await prisma.video.findFirst({ where: { sha256: sha } });
      if (existingExact) {
        return reply.status(409).send({
          error: "Video already exists",
          code: "duplicate_content",
          details: { originalVideoId: existingExact.id }
        });
      }

      // Deduplication Check 2: Perceptual Hash (Similarity)
      const pHash = await generateVideoPHash(fileBuf);
      if (pHash) {
        const potentialDupes = await prisma.video.findMany({
          where: { phash: { not: null } },
          select: { id: true, phash: true, title: true },
          orderBy: { createdAt: 'desc' },
          take: 1000
        });

        for (const candidate of potentialDupes) {
          if (candidate.phash && hammingDistance(pHash, candidate.phash) < 5) {
            return reply.status(409).send({
              error: "Similar video content detected",
              code: "duplicate_content_phash",
              details: { originalVideoId: candidate.id, similarity: "high" }
            });
          }
        }
      }

      // Persistence (Video)
      const record: EncryptedVideoRecord = {
        videoId: body.videoId,
        encryptionKeyHash: keyHash,
        sha256: sha,
      };

      // Optional Uploads (Cloudflare / Web3.Storage)
      // ... (Similar logic as before, simplified for brevity but keeping core)
      if (body.enableArweave) {
        const arResult = await uploadToArweave(fileBuf, { contentType: "video/mp4" });
        if (arResult.success && arResult.txId) record.arweaveTxId = arResult.txId;
      }

      const fileUrl = `${PUBLIC_CONTENT_BASEURL}/content/file/${body.videoId}.mp4`;
      const cf = await uploadToCloudflareStream(fileUrl);
      if (cf.uid) record.cfStreamUid = cf.uid;
      if (cf.hls) record.cfPlaybackHls = cf.hls;

      await prisma.video.upsert({
        where: { id: body.videoId },
        update: {
          encryptionKeyHash: record.encryptionKeyHash,
          sha256: record.sha256,
          phash: pHash || null,
          cfStreamUid: record.cfStreamUid,
          cfPlaybackHls: record.cfPlaybackHls,
          arweaveTxId: record.arweaveTxId,
          filecoinCid: record.filecoinCid,
          moderationStatus: "pending",
        },
        create: {
          id: body.videoId,
          title: "Untitled Upload",
          videoUrl: record.filecoinCid ? `ipfs://${record.filecoinCid}` : (record.arweaveTxId ? `ar://${record.arweaveTxId}` : `file://${body.videoId}`),
          encryptionKeyHash: record.encryptionKeyHash,
          sha256: record.sha256,
          phash: pHash || null,
          cfStreamUid: record.cfStreamUid,
          cfPlaybackHls: record.cfPlaybackHls,
          arweaveTxId: record.arweaveTxId,
          filecoinCid: record.filecoinCid,
          creatorId: userId,
          moderationStatus: "pending",
        }
      });

      const coverUrl = `${PUBLIC_CONTENT_BASEURL}/content/file/${body.videoId}.mp4`;
      const newVideoId = body.videoId;
      fetch(`${process.env.MODERATION_URL || 'http://localhost:8102'}/moderation/image`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageUrl: coverUrl, videoId: newVideoId }),
      }).then(async (res) => {
        if (res.ok) {
          const result = await res.json();
          await prisma.video.update({
            where: { id: newVideoId },
            data: {
              moderationStatus: result.passed ? 'approved' : 'flagged',
              moderationNote: result.label || null,
            },
          });
        }
      }).catch(() => { });
    }

    // Final response (use type-agnostic fields — record was only used for video path above)
    const resp: UploadResponse = { record: { videoId: body.videoId, encryptionKeyHash: keyHash, sha256: sha } };
    return reply.send(resp);

  } catch (err: any) {
    req.log.error(err);
    return reply.status(500).send({ error: err?.message || "上传错误", code: "upload_error" });
  }
});

// 直传初始化：返回 Cloudflare 直传 uploadURL 与预分配的 uid，并记录映射
app.post("/content/upload/direct_init", async (req, reply) => {
  try {
    const { videoId, creatorCkbAddress } = (req.body || {}) as { videoId: string; creatorCkbAddress: string };
    if (!videoId || !creatorCkbAddress) {
      return reply.status(400).send({ error: "参数错误", code: "bad_request" });
    }
    const cf = await createCloudflareDirectUpload();
    if (!cf.uploadURL || !cf.uid) {
      return reply.status(500).send({ error: "直传初始化失败", code: "direct_init_failed" });
    }
    const keyHash = generateEncryptionKeyHash(creatorCkbAddress, videoId);

    // Persist to DB
    const userId = (req.user as any)?.sub;
    // Note: If userId does not match creatorCkbAddress ownership, we might have an issue.
    // For now we assume req.user is the creator.

    await prisma.video.upsert({
      where: { id: videoId },
      update: {
        encryptionKeyHash: keyHash,
        cfStreamUid: cf.uid,
        moderationStatus: "pending",
      },
      create: {
        id: videoId,
        title: "Direct Upload",
        videoUrl: "pending",
        encryptionKeyHash: keyHash,
        cfStreamUid: cf.uid,
        creatorId: userId,
        moderationStatus: "pending",
      }
    });

    return reply.send({ uploadURL: cf.uploadURL, cfStreamUid: cf.uid });
  } catch (err: any) {
    return reply.status(500).send({ error: err?.message || "直传初始化错误", code: "direct_init_error" });
  }
});

// Cloudflare 处理状态查询
app.get("/content/cf/status/:uid", async (req, reply) => {
  try {
    const uid = (req.params as any).uid as string;
    if (!uid) return reply.status(400).send({ error: "参数错误", code: "bad_request" });
    const st = await getCloudflareVideoStatus(uid);
    return reply.send({ uid, readyToStream: !!st.readyToStream, status: st.status });
  } catch (err: any) {
    return reply.status(500).send({ error: err?.message || "状态查询错误", code: "cf_status_error" });
  }
});

// 断点续传初始化：返回 TUS 直传 Location，前端按 tus 协议 PATCH 上传
app.post("/content/upload/resumable_init", async (req, reply) => {
  try {
    const { videoId, creatorCkbAddress, uploadLength, name, filetype } = (req.body || {}) as { videoId: string; creatorCkbAddress: string; uploadLength: number; name?: string; filetype?: string };
    if (!videoId || !creatorCkbAddress || !uploadLength || uploadLength <= 0) {
      return reply.status(400).send({ error: "参数错误", code: "bad_request" });
    }
    const tus = await createCloudflareTusUpload({ uploadLength, name, filetype, maxDurationSeconds: 3600 });
    if (!tus.location) {
      return reply.status(500).send({ error: "断点续传初始化失败", code: "tus_init_failed" });
    }
    const keyHash = generateEncryptionKeyHash(creatorCkbAddress, videoId);

    // Persist to DB
    const userId = (req.user as any)?.sub;

    await prisma.video.upsert({
      where: { id: videoId },
      update: { encryptionKeyHash: keyHash, moderationStatus: "pending" },
      create: {
        id: videoId,
        title: name || "Resumable Upload",
        videoUrl: "pending",
        encryptionKeyHash: keyHash,
        creatorId: userId,
        moderationStatus: "pending",
      }
    });

    return reply.send({ tusURL: tus.location });
  } catch (err: any) {
    return reply.status(500).send({ error: err?.message || "断点续传初始化错误", code: "tus_init_error" });
  }
});

app.get("/content/raw/:id", async (req, reply) => {
  try {
    const id = (req.params as any).id as string;
    const filePath = resolve(STORAGE_DIR, `${id}.base64`);
    if (!existsSync(filePath)) return reply.status(404).send({ error: "未找到", code: "not_found" });
    const base64 = readFileSync(filePath, "utf-8");
    return reply.send({ base64 });
  } catch (err: any) {
    return reply.status(500).send({ error: err?.message || "读取错误", code: "raw_error" });
  }
});

app.post("/content/ticket", async (req, reply) => {
  try {
    const { videoId } = (req.body || {}) as { videoId: string };
    const ticket: StreamTicket = { videoId, jwt: await reply.jwtSign({ vid: videoId }, { algorithm: "HS256" as any }), signedAt: new Date().toISOString() };
    return reply.send(ticket);
  } catch (err: any) {
    return reply.status(500).send({ error: err?.message || "票据错误", code: "ticket_error" });
  }
});

app.get("/content/stream/:id", async (req, reply) => {
  try {
    const id = (req.params as any).id as string;
    // 分发鉴权：需要用户已购买授权
    const claims = (req.user || {}) as any;
    const uid = (claims?.sub as string) || "";

    // Check Entitlement in DB
    const entitlement = await prisma.entitlement.findUnique({
      where: {
        userId_videoId: { userId: uid, videoId: id }
      }
    });

    const allowed = !!entitlement;

    if (!allowed) {
      monitoring.record403Error(req.url, uid || "unknown", ErrorType.PAYMENT_REQUIRED, { videoId: id });
      return reply.status(403).send({ error: "未授权播放，请先购买", code: "not_entitled" });
    }

    const video = await prisma.video.findUnique({ where: { id } });
    if (!video) return reply.status(404).send({ error: "视频不存在", code: "not_found" });

    if (video.cfStreamUid) {
      if (CF_REQUIRE_SIGNED) {
        const signed = await generateSignedHlsUrl(video.cfStreamUid, { userId: uid });
        if (signed) return reply.send({ url: signed });
      }
      if (video.cfPlaybackHls) return reply.send({ url: video.cfPlaybackHls });
      // 兜底
      return reply.send({ url: `https://videodelivery.net/${video.cfStreamUid}/manifest/video.m3u8` });
    }
    if (video.cfPlaybackHls) {
      return reply.send({ url: video.cfPlaybackHls });
    }
    // 回退：返回本地 HLS 模拟
    return reply.send({ url: `http://localhost:${CONTENT_PORT}/content/hls/${id}/index.m3u8` });
  } catch (err: any) {
    return reply.status(500).send({ error: err?.message || "流错误", code: "stream_error" });
  }
});

// 查询当前用户被授权的视频 ID 列表
app.get("/content/entitlements/by-user/me", async (req, reply) => {
  try {
    // JWT 验证（双重保障：即使网关已验签，内容服务也进行校验）
    try { await req.jwtVerify(); } catch { return reply.status(401).send({ error: "未授权", code: "unauthorized" }); }
    const claims = (req.user || {}) as any;
    const uid = (claims?.sub as string) || "";
    if (!uid) return reply.status(401).send({ error: "未授权", code: "unauthorized" });
    // DB Query
    const entitlements = await prisma.entitlement.findMany({
      where: { userId: uid },
      select: { videoId: true }
    });
    const videoIds = entitlements.map(e => e.videoId);
    return reply.send({ videoIds });
  } catch (err: any) {
    return reply.status(500).send({ error: err?.message || "查询错误", code: "entitlement_query_error" });
  }
});

// 离线播放授权：生成离线 Token（7 天有效），并返回分片地址列表
app.post("/play/offline", async (req, reply) => {
  try {
    const parsed = OfflinePlayGrantSchema.safeParse((req.body || {}) as { videoId: string; deviceFingerprint: string });
    if (!parsed.success) {
      return reply.status(400).send({ error: "参数错误", code: "bad_request", details: parsed.error.flatten() });
    }
    const { videoId, deviceFingerprint } = parsed.data;
    const expiresIn = 7 * 24 * 60 * 60; // 7 天秒数
    const offlineToken = await reply.jwtSign({ vid: videoId, offline: true, dfp: deviceFingerprint }, { algorithm: "HS256" as any, expiresIn });
    const base = `http://localhost:${process.env.CONTENT_PORT || 8092}/content/hls/${videoId}`;
    const cdn_urls = ["seg-1.ts", "seg-2.ts", "seg-3.ts"].map((s) => `${base}/${s}`);
    return reply.send({ video_id: videoId, offline_token: offlineToken, expires_in: expiresIn, cdn_urls });
  } catch (err: any) {
    return reply.status(500).send({ error: err?.message || "离线授权错误", code: "offline_error" });
  }
});

// 兼容路径：/content/play/offline（供前端/移动端统一使用）
app.post("/content/play/offline", async (req, reply) => {
  return app.inject({
    method: "POST",
    url: "/play/offline",
    payload: req.body as any,
    headers: req.headers as any,
  }).then((res) => reply.code(res.statusCode).headers(res.headers as any).send(res.body));
});

// 授权接口：支付成功后由 Payment 服务调用，授予用户对某视频的播放权
app.post("/content/entitlement/grant", async (req, reply) => {
  try {
    const { videoId, userId } = (req.body || {}) as { videoId: string; userId: string };
    if (!videoId || !userId) {
      return reply.status(400).send({ error: "参数错误", code: "bad_request" });
    }

    // DB Upsert Entitlement
    await prisma.entitlement.upsert({
      where: { userId_videoId: { userId, videoId } },
      update: {},
      create: { userId, videoId }
    });

    // 立即计算播放 URL（用于支付后“立刻可播”）
    const video = await prisma.video.findUnique({ where: { id: videoId } });
    let streamUrl: string | undefined;
    if (video?.cfStreamUid) {
      streamUrl = CF_REQUIRE_SIGNED ? await generateSignedHlsUrl(video.cfStreamUid, { userId }) : (video.cfPlaybackHls || `https://videodelivery.net/${video.cfStreamUid}/manifest/video.m3u8`);
    } else if (video?.cfPlaybackHls) {
      streamUrl = video.cfPlaybackHls;
    } else {
      streamUrl = `http://localhost:${CONTENT_PORT}/content/hls/${videoId}/index.m3u8`;
    }

    return reply.send({ ok: true, streamUrl });
  } catch (err: any) {
    return reply.status(500).send({ error: err?.message || "授权错误", code: "entitlement_error" });
  }
});

// 简易 HLS 清单与分片（Mock）
app.get("/content/hls/:id/index.m3u8", async (req, reply) => {
  const id = (req.params as any).id as string;
  const m3u8 = `#EXTM3U\n#EXT-X-VERSION:3\n#EXT-X-TARGETDURATION:4\n#EXTINF:4,\n/ content/hls/${id}/seg-1.ts\n#EXTINF:4,\n/ content/hls/${id}/seg-2.ts\n#EXT-X-ENDLIST`.
    replace(/\s\//g, "/");
  reply.header("Content-Type", "application/vnd.apple.mpegurl");
  return reply.send(m3u8);
});

app.get("/content/hls/:id/:seg", async (req, reply) => {
  // 返回伪 TS 分片（非真实视频，仅用于流水线测试）
  const buf = Buffer.from("0001fake-ts-segment");
  reply.header("Content-Type", "video/MP2T");
  return reply.send(buf);
});

// 供 Cloudflare Stream Copy API 拉取的原始 mp4 文件（仅本地开发）
app.get("/content/file/:name", async (req, reply) => {
  try {
    const name = (req.params as any).name as string; // e.g. demo.mp4
    const filePath = resolve(FILES_DIR, name);
    if (!existsSync(filePath)) return reply.status(404).send({ error: "未找到", code: "not_found" });
    reply.header("Content-Type", "video/mp4");
    return reply.send(createReadStream(filePath));
  } catch (err: any) {
    return reply.status(500).send({ error: err?.message || "文件读取错误", code: "file_error" });
  }
});

// ─── Storage Status API ───
app.get("/content/:id/storage-status", async (req, reply) => {
  try {
    const id = (req.params as any).id as string;
    const status = hybridStorage.getStorageStatus(id);
    if (!status) return reply.status(404).send({ error: "No storage manifest for this content", code: "not_found" });
    return reply.send(status);
  } catch (err: any) {
    return reply.status(500).send({ error: err?.message || "Storage status error", code: "storage_error" });
  }
});

// ─── Storage Stats API ───
app.get("/content/storage/stats", async (req, reply) => {
  try {
    const stats = hybridStorage.getStats();
    return reply.send(stats);
  } catch (err: any) {
    return reply.status(500).send({ error: err?.message || "Stats error", code: "stats_error" });
  }
});

// ─── Manual Cooldown API ───
app.post("/content/:id/cooldown", async (req, reply) => {
  try {
    const id = (req.params as any).id as string;
    const { target } = (req.body || {}) as { target?: 'filecoin' | 'arweave' };
    if (!target || !['filecoin', 'arweave'].includes(target)) {
      return reply.status(400).send({ error: "target must be 'filecoin' or 'arweave'", code: "bad_request" });
    }
    await hybridStorage.coolDown(id, target);
    return reply.send({ ok: true, message: `Cooldown to ${target} initiated for ${id}` });
  } catch (err: any) {
    return reply.status(500).send({ error: err?.message || "Cooldown error", code: "cooldown_error" });
  }
});

// ─── PUBLISH PIPELINE: Upload → Metadata → NFT → Royalty (One-Click) ───
app.post("/content/publish", async (req, reply) => {
  const startTime = Date.now();
  const steps: Array<{ step: string; status: string; result?: any; error?: string }> = [];

  try {
    const body = req.body as {
      // Content
      base64Content: string;
      contentType?: "video" | "audio" | "article";
      // Metadata
      title: string;
      description?: string;
      genre?: string;
      language?: string;
      tags?: string[];
      // Blockchain
      creatorCkbAddress: string;
      autoMintNFT?: boolean;
      // Royalty
      collaborators?: Array<{ address: string; percentage: number; role?: string }>;
      // Pricing
      paymentMode?: "free" | "buy_once" | "stream" | "both";
      pointsPrice?: number;
      streamPricePerSecond?: number;
    };

    const userId = (req.user as any)?.sub;
    if (!userId) return reply.status(401).send({ error: "未授权", code: "unauthorized" });

    if (!body.base64Content || !body.title?.trim() || !body.creatorCkbAddress) {
      return reply.status(400).send({
        error: "缺少必填参数: base64Content, title, creatorCkbAddress",
        code: "bad_request"
      });
    }

    const videoId = uuidv4();
    const contentType = body.contentType || "video";

    // ── Step 1: Upload Content ──
    steps.push({ step: "upload", status: "running" });
    const keyHash = generateEncryptionKeyHash(body.creatorCkbAddress, videoId);
    const fileBuf = Buffer.from(body.base64Content, "base64");
    const sha = crypto.createHash("sha256").update(fileBuf).digest("hex");

    // File storage
    let ext = contentType === "audio" ? "mp3" : contentType === "article" ? "pdf" : "mp4";
    const base64Path = resolve(STORAGE_DIR, `${videoId}.base64`);
    writeFileSync(base64Path, body.base64Content);
    const filePath = resolve(FILES_DIR, `${videoId}.${ext}`);
    writeFileSync(filePath, fileBuf);

    // DB record
    if (contentType === "audio") {
      await prisma.music.create({
        data: { id: videoId, title: body.title.trim(), audioUrl: `file://${videoId}`, sha256: sha, creatorId: userId, duration: 0, size: fileBuf.length, moderationStatus: "approved" }
      });
    } else if (contentType === "article") {
      let contentStr = ""; try { contentStr = fileBuf.toString("utf-8"); } catch { }
      await prisma.article.create({
        data: { id: videoId, title: body.title.trim(), content: contentStr.substring(0, 10000), textHash: sha, creatorId: userId, moderationStatus: "approved" }
      });
    } else {
      await prisma.video.upsert({
        where: { id: videoId },
        update: { sha256: sha, encryptionKeyHash: keyHash, moderationStatus: "approved" },
        create: { id: videoId, title: body.title.trim(), videoUrl: `file://${videoId}`, sha256: sha, encryptionKeyHash: keyHash, creatorId: userId, moderationStatus: "approved" }
      });
    }

    // HybridStorage async push
    const hybridContentType: HybridContentType = contentType === 'audio' ? 'music' : contentType === 'article' ? 'article' : 'video';
    hybridStorage.upload(fileBuf, { contentId: videoId, contentType: hybridContentType, title: body.title.trim(), creatorAddress: body.creatorCkbAddress, encryptionKeyHash: keyHash }).catch(() => { });

    steps[steps.length - 1].status = "done";
    steps[steps.length - 1].result = { videoId, sha256: sha, size: fileBuf.length };

    // ── Step 2: Write Metadata ──
    steps.push({ step: "metadata", status: "running" });
    try {
      const metadataUrl = process.env.METADATA_URL || "http://localhost:8093";
      const jwt = req.headers.authorization || "";
      await fetch(`${metadataUrl}/metadata/write`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: jwt },
        body: JSON.stringify({
          meta: {
            id: videoId,
            title: body.title.trim(),
            description: body.description || "",
            genre: body.genre || "Other",
            language: body.language || "English",
            creatorCkbAddress: body.creatorCkbAddress,
            creatorBitDomain: "",
            priceUSDI: "0",
            pointsPrice: body.pointsPrice || 0,
            streamPricePerSecond: body.streamPricePerSecond || 0,
            createdAt: new Date().toISOString(),
            collaborators: (body.collaborators || []).map(c => ({ userId: c.address, percentage: c.percentage, role: c.role || "collaborator" })),
          }
        })
      });
      steps[steps.length - 1].status = "done";
    } catch (err: any) {
      steps[steps.length - 1].status = "skipped";
      steps[steps.length - 1].error = err?.message || "metadata write failed (non-blocking)";
    }

    // ── Step 3: Auto-Mint NFT ──
    let nftResult: { sporeId?: string; txHash?: string } | undefined;
    if (body.autoMintNFT) {
      steps.push({ step: "nft_mint", status: "running" });
      try {
        const nftUrl = process.env.NFT_URL || "http://localhost:8095";
        const jwt = req.headers.authorization || "";
        const nftRes = await fetch(`${nftUrl}/nft/ownership/mint`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: jwt },
          body: JSON.stringify({ videoId, contentType })
        });
        if (nftRes.ok) {
          nftResult = await nftRes.json() as any;
          steps[steps.length - 1].status = "done";
          steps[steps.length - 1].result = nftResult;
        } else {
          const err = await nftRes.text();
          steps[steps.length - 1].status = "failed";
          steps[steps.length - 1].error = err;
        }
      } catch (err: any) {
        steps[steps.length - 1].status = "failed";
        steps[steps.length - 1].error = err?.message || "NFT mint failed";
      }
    }

    // ── Step 4: Royalty Contract ──
    let royaltyResult: any;
    const validCollabs = (body.collaborators || []).filter(c => c.address?.trim());
    if (validCollabs.length > 0) {
      steps.push({ step: "royalty_contract", status: "running" });
      try {
        const paymentUrl = process.env.PAYMENT_URL || "http://localhost:8091";
        const jwt = req.headers.authorization || "";
        const royaltyRes = await fetch(`${paymentUrl}/payment/rgbpp/auto-split`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: jwt },
          body: JSON.stringify({
            contentId: videoId,
            contentType,
            title: body.title.trim(),
            collaborators: validCollabs.map(c => ({ address: c.address, percentage: c.percentage, role: c.role || "collaborator" })),
            creatorAddress: body.creatorCkbAddress,
          })
        });
        if (royaltyRes.ok) {
          royaltyResult = await royaltyRes.json();
          steps[steps.length - 1].status = "done";
          steps[steps.length - 1].result = royaltyResult;
        } else {
          steps[steps.length - 1].status = "failed";
          steps[steps.length - 1].error = await royaltyRes.text();
        }
      } catch (err: any) {
        steps[steps.length - 1].status = "failed";
        steps[steps.length - 1].error = err?.message || "Royalty contract failed";
      }
    }

    // ── Step 5: Auto-Moderation ──
    steps.push({ step: "moderation", status: "running" });
    try {
      const moderationUrl = process.env.MODERATION_URL || "http://localhost:8102";
      // Text moderation on title + description
      const textToCheck = `${body.title} ${body.description || ""}`.trim();
      const modRes = await fetch(`${moderationUrl}/moderation/text`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: textToCheck })
      });
      if (modRes.ok) {
        const modResult = await modRes.json() as any;
        const modStatus = modResult.passed ? "approved" : "flagged";
        // Update DB record moderation status
        if (contentType === "video") {
          await prisma.video.update({ where: { id: videoId }, data: { moderationStatus: modStatus, moderationNote: modResult.label || null } }).catch(() => { });
        } else if (contentType === "audio") {
          await prisma.music.update({ where: { id: videoId }, data: { moderationStatus: modStatus } }).catch(() => { });
        } else if (contentType === "article") {
          await prisma.article.update({ where: { id: videoId }, data: { moderationStatus: modStatus } }).catch(() => { });
        }
        steps[steps.length - 1].status = "done";
        steps[steps.length - 1].result = { passed: modResult.passed, label: modResult.label };
      } else {
        steps[steps.length - 1].status = "skipped";
        steps[steps.length - 1].error = "moderation service unavailable";
      }
    } catch (err: any) {
      steps[steps.length - 1].status = "skipped";
      steps[steps.length - 1].error = err?.message || "moderation failed (non-blocking)";
    }

    // ── Step 6: Achievement Auto-Check ──
    steps.push({ step: "achievement_check", status: "running" });
    try {
      const achievementUrl = process.env.ACHIEVEMENT_URL || "http://localhost:8097";
      const jwtHeader = req.headers.authorization || "";
      // Update stats: increment totalVideos for the creator
      await fetch(`${achievementUrl}/achievement/stats/update`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: jwtHeader },
        body: JSON.stringify({ userId, field: "totalVideos", increment: 1 })
      });
      // Check and auto-unlock achievements
      const checkRes = await fetch(`${achievementUrl}/achievement/check`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: jwtHeader },
        body: JSON.stringify({})
      });
      if (checkRes.ok) {
        const checkResult = await checkRes.json() as any;
        steps[steps.length - 1].status = "done";
        steps[steps.length - 1].result = { newlyUnlocked: checkResult.count || 0, achievements: checkResult.newlyUnlocked?.map((a: any) => a.achievement?.name) };
      } else {
        steps[steps.length - 1].status = "skipped";
      }
    } catch (err: any) {
      steps[steps.length - 1].status = "skipped";
      steps[steps.length - 1].error = err?.message || "achievement check failed (non-blocking)";
    }

    const elapsed = Date.now() - startTime;
    return reply.send({
      ok: true,
      videoId,
      contentType,
      pipeline: steps,
      nft: nftResult,
      royalty: royaltyResult,
      elapsed: `${elapsed}ms`,
    });

  } catch (err: any) {
    req.log.error(err);
    return reply.status(500).send({
      error: err?.message || "发布流程失败",
      code: "publish_pipeline_error",
      pipeline: steps,
    });
  }
});

const port = CONTENT_PORT;
app.listen({ port }).then(() => app.log.info(`Content listening on ${PUBLIC_CONTENT_BASEURL}`));
export default app;

async function generateSignedHlsUrl(uid: string, opts?: { ttlSeconds?: number; downloadable?: boolean; allowedOrigins?: string[]; userId?: string }) {
  const ttl = Number((opts?.ttlSeconds ?? CF_TOKEN_TTL_SECONDS) || 3600);
  try {
    if (!CF_ACCOUNT_ID || !CF_STREAM_TOKEN) return undefined;
    if (CF_SIGNED_MODE === "api") {
      const endpoint = `https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT_ID}/stream/${uid}/token`;
      const body: any = { expirySeconds: ttl };
      if (opts?.downloadable === false) body.downloadable = false;
      if (Array.isArray(opts?.allowedOrigins) && opts!.allowedOrigins!.length > 0) body.allowedOrigins = opts!.allowedOrigins;
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { Authorization: `Bearer ${CF_STREAM_TOKEN}`, "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json().catch(() => ({}));
      const token = json?.result?.token || json?.token || json?.result; // 兼容不同返回格式
      if (res.ok && token && typeof token === "string") {
        return `https://videodelivery.net/${token}/manifest/video.m3u8`;
      }
      // API 失败则记录并回退非签名 URL（避免播放中断）
      monitoring.recordTokenGenerationFailure("stream_token", ErrorType.STREAM_TOKEN_ERROR, opts?.userId || "unknown", {
        uid,
        status: res.status,
        body: json,
        mode: CF_SIGNED_MODE,
      });
      return `https://videodelivery.net/${uid}/manifest/video.m3u8`;
    }
    // 本地签名模式：使用 Cloudflare Stream 的签名密钥生成 JWT
    if (CF_SIGNED_MODE === "local" && CF_SIGNING_KEY_ID && CF_SIGNING_PRIVATE_KEY_PEM) {
      // 仅使用必须字段：sub=uid, exp=now+ttl；header.kid=CF_SIGNING_KEY_ID；算法 RS256
      const now = Math.floor(Date.now() / 1000);
      // 延迟几秒生效，避免时钟偏差；可选 nbf
      const payload: any = { sub: uid, exp: now + ttl };
      // 可选：基于 opts 控制可下载/来源限制（若后续需要，接入 Cloudflare 自定义策略）
      // 生成 JWT
      const { createSign } = await import("node:crypto");
      const header = { alg: "RS256", typ: "JWT", kid: CF_SIGNING_KEY_ID } as any;
      const enc = (obj: any) => Buffer.from(JSON.stringify(obj)).toString("base64url");
      const signingInput = `${enc(header)}.${enc(payload)}`;
      const signer = createSign("RSA-SHA256");
      signer.update(signingInput);
      const signature = signer.sign(CF_SIGNING_PRIVATE_KEY_PEM).toString("base64url");
      const token = `${enc(header)}.${enc(payload)}.${signature}`;
      return `https://videodelivery.net/${token}/manifest/video.m3u8`;
    }
    // 默认回退：未配置签名密钥或模式未知，返回非签名 URL
    return `https://videodelivery.net/${uid}/manifest/video.m3u8`;
  } catch (err: any) {
    monitoring.recordTokenGenerationFailure("stream_token", CF_SIGNED_MODE === "local" ? ErrorType.JWT_SIGN_ERROR : ErrorType.STREAM_TOKEN_ERROR, opts?.userId || "unknown", {
      uid,
      error: err?.message,
      mode: CF_SIGNED_MODE,
    });
    return `https://videodelivery.net/${uid}/manifest/video.m3u8`;
  }
}

function computeStreamUrlForRecord(rec: any): string | undefined {
  if (!rec) return undefined;
  const uid: string | undefined = rec.cfStreamUid;
  const plainHls: string | undefined = rec.cfPlaybackHls;
  if (uid && CF_REQUIRE_SIGNED) {
    // 使用签名 URL（优先）
    return undefined; // 占位，调用方异步生成
  }
  return plainHls;
}