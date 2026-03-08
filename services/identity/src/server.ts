// FILE: /video-platform/services/identity/src/server.ts
/**
 * 功能说明：
 * - 身份服务 + API 网关统一入口。
 * - 提供 /auth/joyid 登录，签发 HS256 JWT（>=32 字节密钥）。
 * - 代理 /payment、/content、/metadata、/royalty 路由到对应服务。
 * - 提供限流、监控与健康检查。
 *
 * 环境变量：
 * - process.env.JWT_SECRET
 * - process.env.PAYMENT_URL (默认 http://localhost:8091)
 * - process.env.CONTENT_URL (默认 http://localhost:8092)
 * - process.env.METADATA_URL (默认 http://localhost:8093)
 * - process.env.ROYALTY_URL (默认 http://localhost:8094)
 * - process.env.API_PORT (默认 8080)
 */

import Fastify from "fastify";
import cors from "@fastify/cors";
import jwt from "@fastify/jwt";
import rateLimit from "@fastify/rate-limit";
import replyFrom from "@fastify/reply-from";
import { register } from "prom-client";
import { v4 as uuidv4 } from "uuid";
import { getCircuitBreaker, getAllCircuitStats, CircuitBreakerOpenError } from "@video-platform/shared/resilience/circuit-breaker";
import { createHash, randomBytes } from "crypto";
import type { AuthRequest, AuthResponse, JWTClaims, OfflineToken, JoyIDAuthRequest, VideoMeta } from "@video-platform/shared/types";
import { resolveBitDomain, reverseResolveAddress, checkBitAvailability } from "@video-platform/shared/web3/das";
import fastifySwagger from '@fastify/swagger';
import fastifySwaggerUi from '@fastify/swagger-ui';
import { verifySignature } from "@joyid/ckb";
import { JoyIDAuthRequestSchema, LegacyAuthRequestSchema, EmailAuthStartSchema, EmailAuthVerifySchema, EmailMagicStartSchema, EmailMagicConsumeSchema, PhoneAuthStartSchema, PhoneAuthVerifySchema } from "@video-platform/shared/validation/schemas";
import { PrismaClient } from "@video-platform/database";
import {
  initRedis,
  setJoyIdNonce, getNonceIssuedAt, deleteNonceById,
  revokeJti, isJtiRevoked,
  setTwitterPkce, getTwitterPkce, deleteTwitterPkce,
  setGoogleOAuthState, getGoogleOAuthState, deleteGoogleOAuthState,
  setEmailCode, getEmailCode, deleteEmailCode,
  setSmsCode, getSmsCode, deleteSmsCode,
  setMagicLink, getMagicLink, deleteMagicLink,
  setBitBinding, getBitByDomain, getBitByAddress, deleteBitBinding, deleteBitByAddress,
} from "@video-platform/shared/stores/redis";

const prisma = new PrismaClient();

// Initialize Redis (falls back to in-memory if REDIS_URL not set)
initRedis();

const app = Fastify({ logger: true, bodyLimit: 500 * 1024 * 1024 }); // 500MB limit for video uploads

const JWT_SECRET = process.env.JWT_SECRET || "";
if (!JWT_SECRET || JWT_SECRET.length < 32) {
  throw new Error("JWT_SECRET 未配置或长度不足（>=32 字节）");
}

// Twitter OAuth2 (PKCE) 配置（需在平台应用中创建并配置）
const TWITTER_CLIENT_ID = process.env.TWITTER_CLIENT_ID || "";
const portEnv = Number(process.env.API_PORT || 8080);
const TWITTER_REDIRECT_URI = process.env.TWITTER_REDIRECT_URI || `http://localhost:5173/auth/twitter/callback`;
const TWITTER_SCOPE = process.env.TWITTER_SCOPE || "tweet.read users.read offline.access";

// Google OAuth2 配置
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || "";
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || "";
const GOOGLE_REDIRECT_URI = process.env.GOOGLE_REDIRECT_URI || `http://localhost:5173/auth/google/callback`;
const GOOGLE_SCOPE = "openid email profile";

const ADMIN_USER_IDS = (process.env.ADMIN_USER_IDS || "").split(",").map(s => s.trim()).filter(Boolean);
const ADMIN_BIT_DOMAINS = (process.env.ADMIN_BIT_DOMAINS || "").split(",").map(s => s.trim().toLowerCase()).filter(Boolean);

await app.register(fastifySwagger, {
  openapi: {
    info: {
      title: 'Nexus Platform API',
      description: 'API documentation for the Nexus Video Platform gateway',
      version: '1.0.0',
    },
    servers: [{ url: 'http://localhost:8080', description: 'Local gateway' }],
    components: {
      securitySchemes: {
        bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
      },
    },
  },
});
await app.register(fastifySwaggerUi, { routePrefix: '/docs' });

app.register(cors, {
  origin: (origin, cb) => {
    // 允许本地开发的 Vite 端口与同源请求（5173/5174 常见）
    if (!origin) return cb(null, true);
    const ok = (
      origin.includes("localhost:5173") ||
      origin.includes("127.0.0.1:5173") ||
      origin.includes("localhost:5174") ||
      origin.includes("127.0.0.1:5174")
    );
    if (ok) return cb(null, true);
    // 生产可按需收敛白名单（本地默认放行）
    cb(null, true);
  },
  methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
  // 允许前端 POST 预检携带的自定义请求头
  // ApiClient 为所有 POST 请求自动添加 Idempotency-Key，用于幂等保障
  allowedHeaders: ["Content-Type", "Authorization", "Idempotency-Key", "X-Request-Id"],
});
app.register(jwt, { secret: JWT_SECRET });
// Global rate limit: 200 req/min per IP (general), auth endpoints get tighter limits below
app.register(rateLimit, {
  max: 200,
  timeWindow: "1 minute",
  keyGenerator: (req: any) => req.ip,
  errorResponseBuilder: (_req: any, context: any) => ({
    error: "Rate limit exceeded",
    code: "rate_limit",
    retryAfter: context.after,
  }),
});
// 仅注册一次 reply-from，避免重复装饰导致错误
app.register(replyFrom);

// NOTE: JWT 吊销已迁移至 Redis (revokeJti / isJtiRevoked)

type HttpMethod = "GET" | "POST" | "PUT" | "DELETE" | "PATCH";
const methods: HttpMethod[] = ["GET", "POST", "PUT", "DELETE", "PATCH"];
const proxies = [
  { prefix: "/payment", base: process.env.PAYMENT_URL || "http://localhost:8091" },
  { prefix: "/content", base: process.env.CONTENT_URL || "http://localhost:8092" },
  { prefix: "/metadata", base: process.env.METADATA_URL || "http://localhost:8093" },
  { prefix: "/user", base: process.env.METADATA_URL || "http://localhost:8093" },
  { prefix: "/royalty", base: process.env.ROYALTY_URL || "http://localhost:8094" },
  { prefix: "/nft", base: process.env.NFT_URL || "http://localhost:8095" },
  { prefix: "/live", base: process.env.LIVE_URL || "http://localhost:8096" },
  { prefix: "/achievement", base: process.env.ACHIEVEMENT_URL || "http://localhost:8097" },
  { prefix: "/governance", base: process.env.GOVERNANCE_URL || "http://localhost:8098" },
  { prefix: "/bridge", base: process.env.BRIDGE_URL || "http://localhost:8099" },
  { prefix: "/transcode", base: process.env.TRANSCODE_URL || "http://localhost:8100" },
  { prefix: "/search", base: process.env.SEARCH_URL || "http://localhost:8101" },
  { prefix: "/moderation", base: process.env.MODERATION_URL || "http://localhost:8102" },
  { prefix: "/notifications", base: process.env.MESSAGING_URL || "http://localhost:8103" },
  { prefix: "/engagement", base: process.env.ENGAGEMENT_URL || "http://localhost:8104" },
];

const circuitBreakerConfig = {
  failureThreshold: 5,
  successThreshold: 3,
  timeout: 10000,
  resetTimeout: 30000,
};

const serviceBreakers = new Map<string, ReturnType<typeof getCircuitBreaker>>();
for (const { prefix } of proxies) {
  const name = prefix.slice(1);
  serviceBreakers.set(prefix, getCircuitBreaker({ name, ...circuitBreakerConfig }));
}

// Request-ID: generate or propagate X-Request-Id for tracing (BEFORE JWT hook)
app.addHook("onRequest", async (req, reply) => {
  const requestId = (req.headers["x-request-id"] as string) || uuidv4();
  (req as any).requestId = requestId;
  reply.header("X-Request-Id", requestId);
});

for (const { prefix, base } of proxies) {
  const breaker = serviceBreakers.get(prefix)!;
  for (const method of methods) {
    // Register both root-level and wildcard routes for each prefix
    // e.g., /notifications AND /notifications/* both proxy to the service
    const proxyHandler = async (req: any, reply: any) => {
      if (breaker.state === "OPEN") {
        return reply.status(503).send({
          error: "Service temporarily unavailable",
          code: "circuit_open",
        });
      }

      const url = req.raw.url || "";
      const target = base + url;
      const requestId = (req as any).requestId;

      return reply.from(target, {
        rewriteRequestHeaders: (_origReq: any, headers: any) => ({
          ...headers,
          "x-request-id": _origReq.id,
        }),
        onError: (_reply: any, { error }: any) => {
          breaker.recordFailure();
          reply.status(502).send({
            error: "Upstream service error",
            code: "proxy_error",
            detail: error?.message,
          });
        },
      });
    };
    // Root-level route: matches e.g. /notifications, /notifications?userId=xxx
    app.route({ method, url: prefix, handler: proxyHandler });
    // Wildcard route: matches e.g. /notifications/send, /notifications/list/xyz
    app.route({ method, url: `${prefix}/*`, handler: proxyHandler });
  }
}

// 网关统一 JWT 验证与吊销检查（健康与认证自身接口除外）
app.addHook("onRequest", async (req, reply) => {
  // 允许 CORS 预检请求（OPTIONS）直接通过，由 @fastify/cors 处理
  if (req.method === "OPTIONS") return;
  // 公共读取接口：允许 GET /metadata/* 与 GET /content/hls/* 与 GET /user/* 直接通过，写入接口仍需鉴权
  if (req.method === "GET" && (req.url.startsWith("/metadata/") || req.url.startsWith("/content/hls/") || req.url.startsWith("/user/"))) return;
  if (req.url.startsWith("/health") || req.url.startsWith("/metrics") || req.url.startsWith("/auth/") || req.url.startsWith("/admin/")) return;
  try {
    await req.jwtVerify();
  } catch (e) {
    return reply.status(401).send({ error: "未授权", code: "unauthorized" });
  }
  const claims = (req.user || {}) as JWTClaims;
  if (claims?.jti && await isJtiRevoked(claims.jti)) {
    return reply.status(401).send({ error: "令牌已吊销", code: "revoked" });
  }
  // 管理员保护的接口在网关层统一鉴权（避免后端重复逻辑）
  const path = req.url || "";
  if (path.startsWith("/payment/ckb/intents")) {
    const enabled = (process.env.ENABLE_ADMIN_CKB_INTENTS || "0") === "1";
    if (!enabled) {
      return reply.status(403).send({ error: "管理员接口未启用", code: "admin_disabled" });
    }
    if (!isAdmin(claims)) {
      return reply.status(403).send({ error: "需要管理员权限", code: "admin_only" });
    }
  }
});

app.get("/health", async () => ({ status: "ok" }));
app.get("/metrics", async () => register.metrics());
app.get("/admin/circuits", async (_req, reply) => {
  return reply.send(getAllCircuitStats());
});

// TTL 常量 (用于验证逻辑，Redis 也使用 TTL 自动过期)
const NONCE_TTL_MS = 120_000; // 2 minutes
const PKCE_TTL_MS = 600_000; // 10 minutes
const EMAIL_CODE_TTL_MS = 600_000; // 10 minutes
const MAGIC_LINK_TTL_MS = 600_000; // 10 minutes

// NOTE: 所有状态存储已迁移至 Redis
// - JoyID Nonce: setJoyIdNonce / getNonceIssuedAt / deleteNonceById
// - Twitter PKCE: setTwitterPkce / getTwitterPkce / deleteTwitterPkce
// - Email Code: setEmailCode / getEmailCode / deleteEmailCode
// - Magic Link: setMagicLink / getMagicLink / deleteMagicLink
// - JWT Revocation: revokeJti / isJtiRevoked

function base64url(buf: Buffer): string {
  return buf
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function generateCodeVerifier(): string {
  // 32 字节随机数 -> base64url，长度约 43 字符，符合规范
  return base64url(randomBytes(32));
}

// SMTP 邮件发送：动态引入 nodemailer，未安装或未配置时安全降级
async function trySendEmail(to: string, subject: string, text: string, html: string): Promise<boolean> {
  const host = process.env.SMTP_HOST || "";
  const port = Number(process.env.SMTP_PORT || 0);
  const user = process.env.SMTP_USER || "";
  const pass = process.env.SMTP_PASS || "";
  const secure = (process.env.SMTP_SECURE || "true").toLowerCase() === "true"; // 465 通常为 true
  const from = process.env.SMTP_FROM || user || "no-reply@localhost";
  if (!host || !port || !user || !pass) {
    app.log.warn({ host, port, userSet: !!user, passSet: !!pass }, "SMTP 未配置，跳过真实发信");
    return false;
  }
  try {
    const nodemailer: any = await import("nodemailer");
    const transporter = nodemailer.createTransport({ host, port, secure, auth: { user, pass } });
    const info = await transporter.sendMail({ from, to, subject, text, html });
    app.log.info({ to, messageId: info?.messageId }, "SMTP 邮件已发送");
    return true;
  } catch (e: any) {
    app.log.error({ to, err: e?.message }, "SMTP 发送失败");
    return false;
  }
}

function computeCodeChallengeS256(verifier: string): string {
  const hash = createHash("sha256").update(verifier).digest();
  return base64url(hash);
}

function generateNumericCode(length = 6): string {
  const buf = randomBytes(length);
  let out = "";
  for (let i = 0; i < buf.length; i++) {
    out += (buf[i] % 10).toString();
  }
  return out;
}

app.get("/auth/joyid/nonce", {
  config: { rateLimit: { max: 10, timeWindow: "1 minute" } },
  handler: async (_req: any, reply: any) => {
    const nonceId = uuidv4();
    const challenge = `vp-login:${nonceId}`;
    await setJoyIdNonce(nonceId, Date.now());
    return reply.send({ nonceId, challenge });
  }
});

// Ethereum/EVM 钱包登录 (MetaMask, WalletConnect)
// 简单实现：根据地址直接创建或获取用户，返回 JWT
app.post<{ Body: { address: string; chainId: number } }>("/auth/ethereum", async (req, reply) => {
  try {
    const { address, chainId } = req.body || {};
    if (!address || typeof address !== "string") {
      return reply.status(400).send({ error: "缺少钱包地址", code: "invalid_address" });
    }

    // 标准化地址 (小写)
    const normalizedAddress = address.toLowerCase();

    // 查找或创建用户
    let user = await prisma.user.findFirst({
      where: { address: { equals: normalizedAddress, mode: "insensitive" } },
    });

    if (!user) {
      // 新用户：创建账户
      user = await prisma.user.create({
        data: {
          address: normalizedAddress,
          nickname: `User_${normalizedAddress.slice(2, 8)}`,
          role: "viewer",
          points: 0,
        },
      });
      app.log.info({ address: normalizedAddress, userId: user.id }, "新 EVM 用户创建");
    }

    // 生成 JWT
    const jti = uuidv4();
    const jwt = await app.jwt.sign({
      sub: user.id,
      ckb: normalizedAddress, // 复用 ckb 字段存储 EVM 地址
      eth: normalizedAddress,
      chainId,
      roles: [user.role],
      jti,
    });

    return reply.send({
      jwt,
      user: {
        id: user.id,
        address: normalizedAddress,
        nickname: user.nickname,
        chainId,
      },
    });
  } catch (e: any) {
    app.log.error({ err: e?.message }, "EVM 登录失败");
    return reply.status(500).send({ error: "登录失败", code: "login_failed" });
  }
});

// 邮箱登录（魔法链接）：发送链接（开发环境直接返回链接与 token；生产仅日志/发信）
app.post<{ Body: { email: string; deviceFingerprint: string } }>("/auth/email/magic/start", async (req, reply) => {
  try {
    const parsed = EmailMagicStartSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: "参数错误", code: "bad_request", details: parsed.error.flatten() });
    }
    const { email, deviceFingerprint } = parsed.data;
    const key = email.toLowerCase();
    // 生成一次性 token（base64url 32 字节）
    const token = base64url(randomBytes(32));
    await setMagicLink(token, { email: key, dfp: deviceFingerprint, issuedAt: Date.now() });
    const safeBase = (process.env.FRONTEND_URL || "http://localhost:5174").replace(/\/+$/, "");
    const link = `${safeBase}/#/magic?token=${encodeURIComponent(token)}`;
    app.log.info({ email, link }, "Email magic link issued");
    const isDev = (process.env.NODE_ENV !== "production");

    // 若配置了 SMTP，则尝试真实发信，否则在开发环境返回 token 便于本地验证
    const sent = await trySendEmail(
      email,
      "Video Platform 登录魔法链接",
      `点击登录：${link}`,
      `<p>点击登录：<a href="${link}">${link}</a></p>`
    );

    return reply.send({
      delivered: sent ? "email" : (isDev ? "dev" : "email_failed"),
      expiresInMs: MAGIC_LINK_TTL_MS,
      ...(isDev ? { token, link } : {})
    });
  } catch (err: any) {
    return reply.status(500).send({ error: err?.message || "发送魔法链接失败", code: "email_magic_start_error" });
  }
});

// 邮箱登录（魔法链接）：消费 token 并签发平台 JWT
app.post<{ Body: { token: string } }>("/auth/email/magic/consume", async (req, reply) => {
  try {
    const parsed = EmailMagicConsumeSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: "参数错误", code: "bad_request", details: parsed.error.flatten() });
    }
    const { token } = parsed.data;
    const rec = await getMagicLink(token);
    if (!rec) return reply.status(400).send({ error: "链接不存在或已使用", code: "link_not_found" });
    if (Date.now() - rec.issuedAt > MAGIC_LINK_TTL_MS) {
      await deleteMagicLink(token);
      return reply.status(400).send({ error: "链接已过期", code: "link_expired" });
    }

    // 消费 token 并签发平台 JWT
    await deleteMagicLink(token);

    // Persist User via Prisma
    const now = Math.floor(Date.now() / 1000);
    const user = await prisma.user.upsert({
      where: { email: rec.email },
      update: {},
      create: {
        email: rec.email,
        did: rec.email, // Use email as DID for email users
        role: "viewer",
        points: 0,
      }
    });

    const jti = uuidv4();
    const claims: JWTClaims = {
      sub: user.id,
      dom: rec.email,
      ckb: "",
      dfp: rec.dfp,
      iat: now,
      exp: now + 60 * 60 * 12,
      jti,
    };
    const jwtToken = await reply.jwtSign(claims, { algorithm: "HS256" as any });
    const offline: OfflineToken = {
      token: Buffer.from(`${user.id}|${rec.dfp}|${now}`).toString("base64"),
      deviceFingerprint: rec.dfp,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    };
    const res: AuthResponse = {
      jwt: jwtToken,
      user: {
        id: user.id,
        bitDomain: user.did || "", // Use did field for bitDomain
        joyIdPublicKey: Buffer.from("email_magic").toString("base64").slice(0, 44),
        ckbAddress: user.address || "",
        createdAt: (user.joinedAt || new Date()).toISOString(),
      },
      offlineToken: offline,
    };
    return reply.send(res);
  } catch (err: any) {
    return reply.status(500).send({ error: err?.message || "魔法链接登录失败", code: "email_magic_consume_error" });
  }
});

// 邮箱登录：发送验证码（开发环境直接返回验证码；生产仅日志）
app.post<{ Body: { email: string; deviceFingerprint: string } }>("/auth/email/start", async (req, reply) => {
  try {
    const parsed = EmailAuthStartSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: "参数错误", code: "bad_request", details: parsed.error.flatten() });
    }
    const { email, deviceFingerprint } = parsed.data;
    const key = email.toLowerCase();
    const code = generateNumericCode(6);
    await setEmailCode(key, { code, dfp: deviceFingerprint, issuedAt: Date.now() });
    // 生产环境下应发送邮件，这里示例打印日志
    app.log.info({ email, code }, "Email login code issued");
    const isDev = (process.env.NODE_ENV !== "production");

    const sent = await trySendEmail(
      email,
      "Video Platform 验证码登录",
      `验证码：${code}，有效期10分钟`,
      `<p>验证码：<b>${code}</b>，有效期10分钟</p>`
    );

    return reply.send({ delivered: sent ? "email" : (isDev ? "dev" : "email_failed"), expiresInMs: EMAIL_CODE_TTL_MS, ...(isDev ? { code } : {}) });
  } catch (err: any) {
    return reply.status(500).send({ error: err?.message || "发送验证码失败", code: "email_start_error" });
  }
});

// 邮箱登录：校验验证码并签发平台 JWT（无 CKB 地址，仅浏览）
app.post<{ Body: { email: string; code: string } }>("/auth/email/verify", async (req, reply) => {
  try {
    const parsed = EmailAuthVerifySchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: "参数错误", code: "bad_request", details: parsed.error.flatten() });
    }
    const { email, code } = parsed.data;
    const key = email.toLowerCase();
    const rec = await getEmailCode(key);
    if (!rec) return reply.status(400).send({ error: "验证码会话不存在", code: "code_not_found" });
    if (Date.now() - rec.issuedAt > EMAIL_CODE_TTL_MS) {
      await deleteEmailCode(key);
      return reply.status(400).send({ error: "验证码已过期", code: "code_expired" });
    }
    if (rec.code !== code) return reply.status(400).send({ error: "验证码错误", code: "code_invalid" });

    // 一次性使用
    await deleteEmailCode(key);

    // Persist User via Prisma
    const now = Math.floor(Date.now() / 1000);
    const user = await prisma.user.upsert({
      where: { email: email },
      update: {},
      create: {
        email: email,
        did: email,
        role: "viewer",
        points: 0,
      }
    });

    const jti = uuidv4();
    const claims: JWTClaims = {
      sub: user.id,
      dom: email,
      ckb: "",
      dfp: rec.dfp,
      iat: now,
      exp: now + 60 * 60 * 12,
      jti,
    };
    const jwtToken = await reply.jwtSign(claims, { algorithm: "HS256" as any });
    const offline: OfflineToken = {
      token: Buffer.from(`${user.id}|${rec.dfp}|${now}`).toString("base64"),
      deviceFingerprint: rec.dfp,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    };
    const res: AuthResponse = {
      jwt: jwtToken,
      user: {
        id: user.id,
        bitDomain: user.did || "",
        joyIdPublicKey: Buffer.from("email_login").toString("base64").slice(0, 44),
        ckbAddress: user.address || "",
        createdAt: (user.joinedAt || new Date()).toISOString(),
      },
      offlineToken: offline,
    };
    return reply.send(res);
  } catch (err: any) {
    return reply.status(500).send({ error: err?.message || "邮箱登录失败", code: "email_verify_error" });
  }
});

// ===== 手机号 SMS 登录（多国家支持）=====
const SMS_CODE_TTL_MS = 10 * 60 * 1000; // 10 分钟有效期

/**
 * 发送 SMS 验证码
 * 生产环境按 countryCode 自动选择服务商:
 * - 中国大陆 (86): 阿里云 SMS / 腾讯云 SMS
 * - 国际: Twilio / Vonage / MessageBird
 * 开发环境: 仅打印日志, 返回验证码
 */
async function trySendSms(phone: string, code: string, countryCode: string): Promise<boolean> {
  // 已预留短信服务商集成入口
  // 可通过 env 变量 SMS_PROVIDER 选择: twilio | vonage | aliyun | tencent
  const provider = process.env.SMS_PROVIDER || "";
  const isDev = process.env.NODE_ENV !== "production";

  if (!provider || isDev) {
    // 开发环境 / 未配置短信服务商: 日志输出
    console.log(`[SMS] Sending code to ${phone} (country: +${countryCode}): ${code}`);
    return true;
  }

  try {
    switch (provider) {
      case "twilio": {
        const accountSid = process.env.TWILIO_ACCOUNT_SID || "";
        const authToken = process.env.TWILIO_AUTH_TOKEN || "";
        const from = process.env.TWILIO_FROM_NUMBER || "";
        if (!accountSid || !authToken || !from) return false;
        const resp = await fetch(
          `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/x-www-form-urlencoded",
              Authorization: `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString("base64")}`,
            },
            body: new URLSearchParams({
              To: phone,
              From: from,
              Body: `[Nexus] Your verification code is: ${code}. Valid for 10 minutes.`,
            }).toString(),
          }
        );
        return resp.ok;
      }
      case "aliyun": {
        // 阿里云 SMS 简化实现 (需要签名和模板)
        console.log(`[SMS:Aliyun] Would send code ${code} to ${phone}`);
        return true;
      }
      default:
        console.warn(`[SMS] Unknown provider: ${provider}`);
        return false;
    }
  } catch (e: any) {
    console.error(`[SMS] Send failed:`, e?.message);
    return false;
  }
}

app.post<{ Body: { phone: string; countryCode: string; deviceFingerprint: string } }>("/auth/phone/start", async (req, reply) => {
  try {
    const parsed = PhoneAuthStartSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: "参数错误", code: "bad_request", details: parsed.error.flatten() });
    }
    const { phone, countryCode, deviceFingerprint } = parsed.data;
    const code = generateNumericCode(6);
    await setSmsCode(phone, { code, dfp: deviceFingerprint, issuedAt: Date.now() });
    app.log.info({ phone, code }, "SMS login code issued");

    const isDev = process.env.NODE_ENV !== "production";
    const sent = await trySendSms(phone, code, countryCode);

    return reply.send({
      delivered: sent ? "sms" : (isDev ? "dev" : "sms_failed"),
      expiresInMs: SMS_CODE_TTL_MS,
      ...(isDev ? { code } : {}),
    });
  } catch (err: any) {
    return reply.status(500).send({ error: err?.message || "发送验证码失败", code: "phone_start_error" });
  }
});

app.post<{ Body: { phone: string; code: string } }>("/auth/phone/verify", async (req, reply) => {
  try {
    const parsed = PhoneAuthVerifySchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: "参数错误", code: "bad_request", details: parsed.error.flatten() });
    }
    const { phone, code } = parsed.data;
    const rec = await getSmsCode(phone);
    if (!rec) return reply.status(400).send({ error: "验证码会话不存在", code: "code_not_found" });
    if (Date.now() - rec.issuedAt > SMS_CODE_TTL_MS) {
      await deleteSmsCode(phone);
      return reply.status(400).send({ error: "验证码已过期", code: "code_expired" });
    }
    if (rec.code !== code) return reply.status(400).send({ error: "验证码错误", code: "code_invalid" });

    // 一次性使用
    await deleteSmsCode(phone);

    // Persist User via Prisma — phone as unique identifier
    const now = Math.floor(Date.now() / 1000);
    const user = await prisma.user.upsert({
      where: { phone },
      update: {},
      create: {
        phone,
        did: phone,
        role: "viewer",
        points: 0,
      },
    });

    const jti = uuidv4();
    const claims: JWTClaims = {
      sub: user.id,
      dom: phone,
      ckb: "",
      dfp: rec.dfp,
      iat: now,
      exp: now + 60 * 60 * 12,
      jti,
    };
    const jwtToken = await reply.jwtSign(claims, { algorithm: "HS256" as any });
    const offline: OfflineToken = {
      token: Buffer.from(`${user.id}|${rec.dfp}|${now}`).toString("base64"),
      deviceFingerprint: rec.dfp,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    };
    const res: AuthResponse = {
      jwt: jwtToken,
      user: {
        id: user.id,
        bitDomain: user.did || "",
        joyIdPublicKey: Buffer.from("phone_login").toString("base64").slice(0, 44),
        ckbAddress: user.address || "",
        createdAt: (user.joinedAt || new Date()).toISOString(),
      },
      offlineToken: offline,
    };
    return reply.send(res);
  } catch (err: any) {
    return reply.status(500).send({ error: err?.message || "手机号登录失败", code: "phone_verify_error" });
  }
});

// 启动 Twitter OAuth2 + PKCE 登录流程：返回授权 URL，前端跳转
app.get("/auth/twitter/start", async (req, reply) => {
  try {
    const dfp = ((req as any).query?.dfp || "") as string;
    if (!dfp) return reply.status(400).send({ error: "缺少设备指纹", code: "bad_request" });
    if (!TWITTER_CLIENT_ID) {
      return reply.status(500).send({ error: "Twitter 配置未设置：请配置 TWITTER_CLIENT_ID", code: "twitter_config_missing" });
    }
    const state = uuidv4();
    const codeVerifier = generateCodeVerifier();
    const codeChallenge = computeCodeChallengeS256(codeVerifier);
    await setTwitterPkce(state, { codeVerifier, dfp, issuedAt: Date.now() });
    const params = new URLSearchParams({
      response_type: "code",
      client_id: TWITTER_CLIENT_ID,
      redirect_uri: TWITTER_REDIRECT_URI,
      scope: TWITTER_SCOPE,
      state,
      code_challenge: codeChallenge,
      code_challenge_method: "S256",
    });
    const authUrl = `https://twitter.com/i/oauth2/authorize?${params.toString()}`;
    return reply.send({ authUrl, state });
  } catch (err: any) {
    return reply.status(500).send({ error: err?.message || "Twitter 启动失败", code: "twitter_start_error" });
  }
});

// Twitter OAuth2 回调（SPA 前端调用此接口完成交换并签发平台 JWT）
app.post<{
  Body: { code: string; state: string };
}>("/auth/twitter/callback", async (req, reply) => {
  try {
    const { code, state } = (req.body || {}) as { code: string; state: string };
    if (!code || !state) return reply.status(400).send({ error: "缺少 code 或 state", code: "bad_request" });
    const rec = await getTwitterPkce(state);
    if (!rec) return reply.status(400).send({ error: "state 无效或已过期", code: "invalid_state" });
    if (Date.now() - rec.issuedAt > PKCE_TTL_MS) {
      await deleteTwitterPkce(state);
      return reply.status(400).send({ error: "登录会话已过期", code: "pkce_expired" });
    }

    // 交换访问令牌
    const body = new URLSearchParams({
      client_id: TWITTER_CLIENT_ID,
      grant_type: "authorization_code",
      code,
      redirect_uri: TWITTER_REDIRECT_URI,
      code_verifier: rec.codeVerifier,
    });
    const tokenResp = await fetch("https://api.twitter.com/2/oauth2/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: body.toString(),
    });
    if (!tokenResp.ok) {
      const t = await tokenResp.text();
      return reply.status(400).send({ error: "Twitter 令牌交换失败", code: "token_exchange_failed", details: t });
    }
    const tokenJson: any = await tokenResp.json();
    const accessToken = tokenJson?.access_token;
    if (!accessToken) return reply.status(400).send({ error: "缺少 access_token", code: "token_missing" });

    // 获取当前用户信息
    const meResp = await fetch("https://api.twitter.com/2/users/me", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!meResp.ok) {
      const t = await meResp.text();
      return reply.status(400).send({ error: "获取 Twitter 用户信息失败", code: "user_info_failed", details: t });
    }
    const meJson: any = await meResp.json();
    const data = meJson?.data || {};
    const username = data?.username || "twitter-user";
    const displayDomain = `@${username}`;

    // 签发平台 JWT - Persist in DB
    const now = Math.floor(Date.now() / 1000);

    // Attempt to finding user by DID (displayDomain)
    const user = await prisma.user.upsert({
      where: { did: displayDomain },
      update: {},
      create: {
        did: displayDomain,
        role: "viewer",
        points: 0,
      }
    });

    const jti = uuidv4();
    const claims: JWTClaims = {
      sub: user.id,
      dom: displayDomain,
      ckb: "",
      dfp: rec.dfp,
      iat: now,
      exp: now + 60 * 60 * 12,
      jti,
    };
    const jwtToken = await reply.jwtSign(claims, { algorithm: "HS256" as any });
    const offline: OfflineToken = {
      token: Buffer.from(`${user.id}|${rec.dfp}|${now}`).toString("base64"),
      deviceFingerprint: rec.dfp,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    };
    const res: AuthResponse = {
      jwt: jwtToken,
      user: {
        id: user.id,
        bitDomain: user.did || "",
        joyIdPublicKey: Buffer.from("twitter_oauth").toString("base64").slice(0, 44),
        ckbAddress: user.address || "",
        createdAt: (user.joinedAt || new Date()).toISOString(),
      },
      offlineToken: offline,
    };
    // 一次性使用
    await deleteTwitterPkce(state);
    return reply.send(res);
  } catch (err: any) {
    return reply.status(500).send({ error: err?.message || "Twitter 回调处理失败", code: "twitter_callback_error" });
  }
});

// ============== Google OAuth2 登录 ==============

// 启动 Google OAuth2 登录流程
app.get("/auth/google/start", async (req, reply) => {
  try {
    const dfp = ((req as any).query?.dfp || "browser") as string;
    if (!GOOGLE_CLIENT_ID) {
      return reply.status(500).send({ error: "Google 配置未设置：请配置 GOOGLE_CLIENT_ID 和 GOOGLE_CLIENT_SECRET", code: "google_config_missing" });
    }
    const state = uuidv4();
    const codeVerifier = generateCodeVerifier();
    const codeChallenge = computeCodeChallengeS256(codeVerifier);
    await setGoogleOAuthState(state, { codeVerifier, dfp, issuedAt: Date.now() });
    const params = new URLSearchParams({
      response_type: "code",
      client_id: GOOGLE_CLIENT_ID,
      redirect_uri: GOOGLE_REDIRECT_URI,
      scope: GOOGLE_SCOPE,
      state,
      code_challenge: codeChallenge,
      code_challenge_method: "S256",
      access_type: "offline",
      prompt: "consent",
    });
    const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
    return reply.send({ authUrl, state });
  } catch (err: any) {
    return reply.status(500).send({ error: err?.message || "Google 启动失败", code: "google_start_error" });
  }
});

// Google OAuth2 回调
app.post<{
  Body: { code: string; state: string };
}>("/auth/google/callback", async (req, reply) => {
  try {
    const { code, state } = (req.body || {}) as { code: string; state: string };
    if (!code || !state) return reply.status(400).send({ error: "缺少 code 或 state", code: "bad_request" });
    const rec = await getGoogleOAuthState(state);
    if (!rec) return reply.status(400).send({ error: "state 无效或已过期", code: "invalid_state" });
    if (Date.now() - rec.issuedAt > PKCE_TTL_MS) {
      await deleteGoogleOAuthState(state);
      return reply.status(400).send({ error: "登录会话已过期", code: "pkce_expired" });
    }

    // 交换访问令牌
    const body = new URLSearchParams({
      client_id: GOOGLE_CLIENT_ID,
      client_secret: GOOGLE_CLIENT_SECRET,
      grant_type: "authorization_code",
      code,
      redirect_uri: GOOGLE_REDIRECT_URI,
      code_verifier: rec.codeVerifier,
    });
    const tokenResp = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: body.toString(),
    });
    if (!tokenResp.ok) {
      const t = await tokenResp.text();
      return reply.status(400).send({ error: "Google 令牌交换失败", code: "token_exchange_failed", details: t });
    }
    const tokenJson: any = await tokenResp.json();
    const accessToken = tokenJson?.access_token;
    if (!accessToken) return reply.status(400).send({ error: "缺少 access_token", code: "token_missing" });

    // 获取用户信息
    const userInfoResp = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!userInfoResp.ok) {
      const t = await userInfoResp.text();
      return reply.status(400).send({ error: "获取 Google 用户信息失败", code: "user_info_failed", details: t });
    }
    const userInfo: any = await userInfoResp.json();
    const googleEmail = userInfo?.email || "";
    const googleName = userInfo?.name || userInfo?.given_name || "Google User";
    const googleAvatar = userInfo?.picture || "";

    if (!googleEmail) {
      return reply.status(400).send({ error: "Google 账户未提供邮箱", code: "no_email" });
    }

    // 使用邮箱查找或创建用户
    const now = Math.floor(Date.now() / 1000);
    const user = await prisma.user.upsert({
      where: { email: googleEmail.toLowerCase() },
      update: {
        nickname: googleName,
        avatar: googleAvatar || undefined,
      },
      create: {
        email: googleEmail.toLowerCase(),
        did: googleEmail.toLowerCase(),
        nickname: googleName,
        avatar: googleAvatar || undefined,
        role: "viewer",
        points: 0,
      }
    });

    const jti = uuidv4();
    const claims: JWTClaims = {
      sub: user.id,
      dom: googleEmail,
      ckb: "",
      dfp: rec.dfp,
      iat: now,
      exp: now + 60 * 60 * 12,
      jti,
    };
    const jwtToken = await reply.jwtSign(claims, { algorithm: "HS256" as any });
    const offline: OfflineToken = {
      token: Buffer.from(`${user.id}|${rec.dfp}|${now}`).toString("base64"),
      deviceFingerprint: rec.dfp,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    };
    const res: AuthResponse = {
      jwt: jwtToken,
      user: {
        id: user.id,
        bitDomain: user.did || "",
        joyIdPublicKey: Buffer.from("google_oauth").toString("base64").slice(0, 44),
        ckbAddress: user.address || "",
        createdAt: (user.joinedAt || new Date()).toISOString(),
      },
      offlineToken: offline,
    };
    await deleteGoogleOAuthState(state);
    return reply.send(res);
  } catch (err: any) {
    return reply.status(500).send({ error: err?.message || "Google 回调处理失败", code: "google_callback_error" });
  }
});

app.post<{ Body: JoyIDAuthRequest | AuthRequest }>("/auth/joyid", async (req, reply) => {
  try {
    // 兼容老的模拟请求（joyIdAssertion），也支持真实 JoyID 签名（signatureData）
    const body = req.body as JoyIDAuthRequest | AuthRequest;

    if ((body as any).signatureData) {
      // Zod 校验 JoyID 登录请求（含可选 authType: "ccc"）
      const parsed = JoyIDAuthRequestSchema.safeParse(body);
      if (!parsed.success) {
        return reply.status(400).send({ error: "参数错误", code: "bad_request", details: parsed.error.flatten() });
      }
      const { signatureData, deviceFingerprint, bitDomain, address, authType } = parsed.data;
      const isCCCAuth = authType === "ccc";
      if (!signatureData || !deviceFingerprint) {
        return reply.status(400).send({ error: "缺少参数", code: "bad_request" });
      }

      // 校验挑战与 nonce 有效性
      const challenge = signatureData.challenge;
      const nonceId = challenge?.startsWith("vp-login:") ? challenge.slice("vp-login:".length) : "";
      const issuedAt = await getNonceIssuedAt(nonceId);
      if (!issuedAt) {
        return reply.status(400).send({ error: "无效或已使用的挑战", code: "invalid_challenge" });
      }
      // Note: Redis TTL handles expiry automatically, but keep check for logging clarity
      if (Date.now() - issuedAt > NONCE_TTL_MS) {
        await deleteNonceById(nonceId);
        return reply.status(400).send({ error: "挑战已过期", code: "challenge_expired" });
      }

      // 签名验证逻辑
      if (isCCCAuth) {
        // CCC 钱包登录：信任钱包连接提供的地址
        // CCC 库在前端已完成 WebAuthn/Passkey 验证，后端只需验证 nonce
        // 这里我们要求必须提供 address
        if (!address) {
          return reply.status(400).send({ error: "CCC 登录需要提供地址", code: "missing_address" });
        }
        app.log.info({ address, authType: "ccc" }, "CCC wallet login accepted");
      } else {
        // 传统 JoyID SDK 验签
        const ok = await verifySignature(signatureData as any);
        if (!ok) {
          return reply.status(401).send({ error: "签名验证失败", code: "verify_failed" });
        }
      }

      // 加严校验：同时提供了 address 与 bitDomain 时，需一致
      // 开发者 / Admin 用户可以绕过此校验进行测试
      const isDeveloperUser = ADMIN_USER_IDS.includes(address || "") || ADMIN_BIT_DOMAINS.includes((bitDomain || "").toLowerCase());

      if (address && bitDomain && !isDeveloperUser) {
        const byDomain = await resolveBitDomain(bitDomain);
        if ((byDomain.ckbAddress || "") !== address) {
          return reply.status(400).send({
            error: `域名 ${bitDomain} 解析地址与提交地址不一致`,
            code: "address_domain_mismatch",
          });
        }
      }
      await deleteNonceById(nonceId);

      // 解析地址：优先使用 JoyID connect 提供的 address，其次解析 .bit 域名
      const resolved = address
        ? { ckbAddress: address }
        : (bitDomain ? await resolveBitDomain(bitDomain) : { ckbAddress: "" });
      if (!resolved.ckbAddress) {
        return reply.status(400).send({ error: "缺少 CKB 地址", code: "missing_ckb" });
      }
      const rev = (!bitDomain && resolved.ckbAddress) ? await reverseResolveAddress(resolved.ckbAddress) : { domain: null };
      const finalDomain = bitDomain || rev.domain || "";

      // 使用 CKB 地址生成确定性的 userId，确保同一钱包每次登录获得相同的 sub
      // Persist User to DB!
      // Improved DID validation logic:
      // 1. Check if wallet already has a user with a DID
      // 2. If user provides a different DID, warn them
      // 3. Check DID availability before assigning

      let user = await prisma.user.findUnique({ where: { address: resolved.ckbAddress } });

      if (user) {
        // Existing user - check DID consistency
        if (user.did && finalDomain && user.did !== finalDomain) {
          // User is trying to login with a different .bit domain than previously used
          return reply.status(400).send({
            error: `此钱包已绑定 ${user.did}，与当前输入的 ${finalDomain} 不一致`,
            code: "did_mismatch",
            existingDid: user.did,
            requestedDid: finalDomain
          });
        }

        // If user doesn't have a DID yet and wants to set one
        if (!user.did && finalDomain) {
          // Check if the DID is available
          const didTaken = await prisma.user.findUnique({ where: { did: finalDomain } });
          if (didTaken) {
            return reply.status(400).send({
              error: `${finalDomain} 已被其他钱包绑定`,
              code: "did_taken",
              requestedDid: finalDomain
            });
          }
          // DID is available, update user
          user = await prisma.user.update({
            where: { id: user.id },
            data: { did: finalDomain }
          });
        }
      } else {
        // New user - check DID availability if provided
        if (finalDomain) {
          const existingDidUser = await prisma.user.findUnique({ where: { did: finalDomain } });
          if (existingDidUser) {
            return reply.status(400).send({
              error: `${finalDomain} 已被其他钱包绑定`,
              code: "did_taken",
              requestedDid: finalDomain
            });
          }
        }

        user = await prisma.user.create({
          data: {
            address: resolved.ckbAddress,
            did: finalDomain || undefined,
            role: "viewer",
            points: 0,
          }
        });
      }

      const now = Math.floor(Date.now() / 1000);
      const jti = uuidv4();
      const claims: JWTClaims = {
        sub: user.id,
        dom: finalDomain,
        ckb: resolved.ckbAddress,
        dfp: deviceFingerprint,
        iat: now,
        exp: now + 60 * 60 * 12,
        jti,
      };
      const jwtToken = await reply.jwtSign(claims, { algorithm: "HS256" as any });
      const offline: OfflineToken = {
        token: Buffer.from(`${user.id}|${deviceFingerprint}|${now}`).toString("base64"),
        deviceFingerprint,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      };
      const res: AuthResponse = {
        jwt: jwtToken,
        user: {
          id: user.id,
          bitDomain: user.did || "",
          joyIdPublicKey: signatureData.pubkey ? Buffer.from(signatureData.pubkey).toString("base64").slice(0, 44) : "",
          ckbAddress: user.address || "",
          createdAt: (user.joinedAt || new Date()).toISOString(),
        },
        offlineToken: offline,
      };
      return reply.send(res);
    }

    // 回退：兼容旧的模拟登录
    // Zod 校验旧版模拟登录
    const legacyParsed = LegacyAuthRequestSchema.safeParse(body);
    if (!legacyParsed.success) {
      return reply.status(400).send({ error: "参数错误", code: "bad_request", details: legacyParsed.error.flatten() });
    }
    const { bitDomain, joyIdAssertion, deviceFingerprint } = legacyParsed.data;
    const resolved = await resolveBitDomain(bitDomain);

    // Legacy support: Try to persist if address unknown but domain known? 
    // If resolved.ckbAddress is null, we can't key by address.
    // If resolved.ckbAddress exists, use it.
    let user: any;
    if (resolved.ckbAddress) {
      user = await prisma.user.upsert({
        where: { address: resolved.ckbAddress },
        update: { did: bitDomain },
        create: {
          address: resolved.ckbAddress,
          did: bitDomain,
          role: "viewer",
          points: 0
        }
      });
    } else {
      // Fallback: Key by DID only
      user = await prisma.user.upsert({
        where: { did: bitDomain },
        update: {},
        create: {
          did: bitDomain,
          role: "viewer",
          points: 0
        }
      });
    }

    const now = Math.floor(Date.now() / 1000);
    const jti = uuidv4();
    const claims: JWTClaims = {
      sub: user.id,
      dom: bitDomain,
      ckb: resolved.ckbAddress,
      dfp: deviceFingerprint,
      iat: now,
      exp: now + 60 * 60 * 12, // 12h
      jti,
    };
    const jwtToken = await reply.jwtSign(claims, { algorithm: "HS256" as any });
    const offline: OfflineToken = {
      token: Buffer.from(`${user.id}|${deviceFingerprint}|${now}`).toString("base64"),
      deviceFingerprint,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    };
    const res: AuthResponse = {
      jwt: jwtToken,
      user: {
        id: user.id,
        bitDomain: user.did || "",
        joyIdPublicKey: Buffer.from(joyIdAssertion).toString("base64").slice(0, 44),
        ckbAddress: user.address || "",
        createdAt: (user.joinedAt || new Date()).toISOString(),
      },
      offlineToken: offline,
    };
    return reply.send(res);
  } catch (err: any) {
    console.error("[AUTH JOYID ERROR]", err, err?.stack);
    return reply.status(500).send({ error: err?.message || "登录错误", code: "auth_error" });
  }
});

// 刷新令牌：要求当前 JWT 有效且 dfp 匹配
app.post("/auth/refresh", async (req, reply) => {
  try {
    await req.jwtVerify();
  } catch (e) {
    return reply.status(401).send({ error: "未授权", code: "unauthorized" });
  }
  const claims = (req.user || {}) as JWTClaims;
  const now = Math.floor(Date.now() / 1000);
  const newClaims: JWTClaims = { ...claims, iat: now, exp: now + 60 * 60, jti: uuidv4() };
  const token = await reply.jwtSign(newClaims, { algorithm: "HS256" as any });
  return reply.send({ jwt: token, exp: newClaims.exp });
});

// ===== Wallet Binding: Bind JoyID CKB address to existing Web2 account =====
app.post<{
  Body: { ckbAddress: string; nostrPubkey?: string };
}>("/auth/bind-wallet", async (req, reply) => {
  try {
    await req.jwtVerify();
  } catch (e) {
    return reply.status(401).send({ error: "Not authenticated", code: "unauthorized" });
  }
  const claims = (req.user || {}) as JWTClaims;
  const userId = claims?.sub;
  if (!userId) return reply.status(400).send({ error: "Invalid token", code: "bad_token" });

  const { ckbAddress, nostrPubkey } = req.body || {};
  if (!ckbAddress || typeof ckbAddress !== "string") {
    return reply.status(400).send({ error: "Missing CKB address", code: "bad_request" });
  }

  // Check if address is already bound to another user
  const existing = await prisma.user.findFirst({ where: { address: ckbAddress } });
  if (existing && existing.id !== userId) {
    return reply.status(409).send({ error: "Address already bound to another account", code: "address_taken" });
  }

  // Update user with CKB address (and optionally Nostr pubkey)
  const updated = await prisma.user.update({
    where: { id: userId },
    data: {
      address: ckbAddress,
      ...(nostrPubkey ? { nostrPubkey } : {}),
    },
  });

  // Issue new JWT with CKB address
  const now = Math.floor(Date.now() / 1000);
  const jti = uuidv4();
  const newClaims: JWTClaims = {
    sub: userId,
    dom: claims.dom || "",
    ckb: ckbAddress,
    dfp: claims.dfp || "",
    iat: now,
    exp: now + 60 * 60 * 12,
    jti,
  };
  const newToken = await reply.jwtSign(newClaims, { algorithm: "HS256" as any });

  app.log.info({ userId, ckbAddress, nostrPubkey: !!nostrPubkey }, "Wallet bound to account");
  return reply.send({
    jwt: newToken,
    walletBound: true,
    ckbAddress,
    nostrPubkey: nostrPubkey || null,
  });
});

// ===== Nostr NIP-07 Login =====
app.post<{
  Body: { pubkey: string; signature: string; event: any };
}>("/auth/nostr", async (req, reply) => {
  try {
    const { pubkey, signature, event } = req.body || {};
    if (!pubkey || !signature) {
      return reply.status(400).send({ error: "Missing pubkey or signature", code: "bad_request" });
    }

    // Verify Nostr event signature (NIP-01)
    // In production, use nostr-tools verifyEvent()
    // For now, accept the pubkey and create/find user
    const normalizedPubkey = pubkey.toLowerCase();

    let user = await prisma.user.findFirst({
      where: { nostrPubkey: normalizedPubkey },
    });

    if (!user) {
      user = await prisma.user.create({
        data: {
          nostrPubkey: normalizedPubkey,
          nickname: `nostr_${normalizedPubkey.slice(0, 8)}`,
          role: "viewer",
          points: 0,
        },
      });
      app.log.info({ pubkey: normalizedPubkey, userId: user.id }, "New Nostr user created");
    }

    const now = Math.floor(Date.now() / 1000);
    const jti = uuidv4();
    const claims: JWTClaims = {
      sub: user.id,
      dom: `nostr:${normalizedPubkey.slice(0, 16)}`,
      ckb: user.address || "",
      dfp: "",
      iat: now,
      exp: now + 60 * 60 * 12,
      jti,
    };
    const jwtToken = await reply.jwtSign(claims, { algorithm: "HS256" as any });
    const offline: OfflineToken = {
      token: Buffer.from(`${user.id}|nostr|${now}`).toString("base64"),
      deviceFingerprint: "nostr",
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    };
    const res: AuthResponse = {
      jwt: jwtToken,
      user: {
        id: user.id,
        bitDomain: user.did || "",
        joyIdPublicKey: normalizedPubkey,
        ckbAddress: user.address || "",
        createdAt: (user.joinedAt || new Date()).toISOString(),
      },
      offlineToken: offline,
    };
    return reply.send(res);
  } catch (err: any) {
    return reply.status(500).send({ error: err?.message || "Nostr login failed", code: "nostr_auth_error" });
  }
});

// 吊销当前令牌（加入吊销列表）
app.post("/auth/revoke", async (req, reply) => {
  try {
    await req.jwtVerify();
  } catch (e) {
    return reply.status(401).send({ error: "未授权", code: "unauthorized" });
  }
  const claims = (req.user || {}) as JWTClaims;
  if (!claims?.jti) return reply.status(400).send({ error: "缺少 jti", code: "bad_request" });
  await revokeJti(claims.jti);
  return reply.send({ revoked: true, jti: claims.jti });
});

// 新增：检查 .bit 域名在应用内是否唯一（绑定占用）与链上是否已注册
app.get("/auth/bit/check", async (req, reply) => {
  const qs = (req.query || {}) as any;
  const domain = String(qs.domain || "").trim().toLowerCase();
  if (!domain.endsWith(".bit")) {
    return reply.status(400).send({ error: "域名格式不正确", code: "bad_domain" });
  }
  const boundTo = await getBitByDomain(domain);
  let registered = false;
  try {
    const r = await checkBitAvailability(domain);
    registered = !!r.registered;
  } catch {
    registered = false;
  }
  const unique = !boundTo;
  return reply.send({ domain, unique, registered, boundTo });
});

// 新增：绑定 .bit 域名到当前登录地址（未注册域名的应用内临时绑定）
app.post("/auth/bit/bind", async (req, reply) => {
  try {
    await req.jwtVerify();
  } catch (e) {
    return reply.status(401).send({ error: "未授权", code: "unauthorized" });
  }
  const claims = (req.user || {}) as JWTClaims;
  const body: any = req.body || {};
  const domain = String(body.domain || "").trim().toLowerCase();
  if (!domain.endsWith(".bit")) return reply.status(400).send({ error: "域名格式不正确", code: "bad_domain" });
  const addr = claims.ckb || "";
  if (!addr) return reply.status(400).send({ error: "请先使用 JoyID 登录", code: "require_joyid_login" });
  const existing = await getBitByDomain(domain);
  if (existing && existing !== addr) {
    return reply.status(400).send({ error: "域名已被其他地址绑定", code: "domain_taken", details: { domain, boundTo: existing } });
  }
  await setBitBinding(domain, addr);
  return reply.send({ domain, boundTo: addr, ok: true });
});

// 解绑 .bit 与地址的临时绑定
app.post("/auth/bit/unbind", async (req, reply) => {
  try {
    await req.jwtVerify();
  } catch (e) {
    return reply.status(401).send({ error: "未授权", code: "unauthorized" });
  }
  const claims = (req.user || {}) as JWTClaims;
  const body: any = req.body || {};
  const domainRaw = String(body.domain || "").trim().toLowerCase();
  const addr = claims.ckb || "";
  if (!addr) return reply.status(400).send({ error: "请先使用 JoyID 登录", code: "require_joyid_login" });

  if (domainRaw && domainRaw.endsWith(".bit")) {
    const boundAddr = await getBitByDomain(domainRaw);
    await deleteBitBinding(domainRaw, boundAddr || undefined);
    return reply.send({ domain: domainRaw, ok: true });
  }

  const boundDomain = await getBitByAddress(addr);
  if (boundDomain) {
    await deleteBitBinding(boundDomain, addr);
    return reply.send({ domain: boundDomain, ok: true });
  }
  return reply.send({ ok: true });
});

// Public: Reverse resolve — given a CKB address, return its bound .bit domain
app.get("/auth/bit/reverse", async (req, reply) => {
  const qs = (req.query || {}) as any;
  const address = String(qs.address || "").trim();
  if (!address) {
    return reply.status(400).send({ error: "Missing address", code: "bad_request" });
  }
  // 1. Check Redis in-app binding first
  let domain: string | null = null;
  try {
    domain = await getBitByAddress(address);
  } catch { /* ignore */ }
  // 2. Fall back to Prisma user record
  if (!domain) {
    try {
      const user = await prisma.user.findUnique({ where: { address } });
      if (user?.did && user.did.endsWith(".bit")) {
        domain = user.did;
      }
    } catch { /* ignore */ }
  }
  // 3. Fall back to on-chain reverse resolution
  if (!domain) {
    try {
      const rev = await reverseResolveAddress(address);
      if (rev?.domain) domain = rev.domain;
    } catch { /* ignore */ }
  }
  return reply.send({ address, domain });
});

// 创作者统计聚合：返回总上传、近 7 天上传、Cloudflare 转码中的数量与完成率
app.get("/creator/stats", async (req, reply) => {
  try {
    await req.jwtVerify();
  } catch (e) {
    return reply.status(401).send({ error: "未授权", code: "unauthorized" });
  }
  const claims = (req.user || {}) as JWTClaims;
  try {
    const metadataBase = process.env.METADATA_URL || "http://localhost:8093";
    const contentBase = process.env.CONTENT_URL || "http://localhost:8092";
    const metasResp = await fetch(`${metadataBase}/metadata/list`);
    if (!metasResp.ok) {
      return reply.status(500).send({ error: "元数据服务不可用", code: "metadata_unavailable" });
    }
    const metas = (await metasResp.json()) as VideoMeta[];
    let filtered = metas;
    if (claims.ckb) {
      filtered = metas.filter((m) => m.creatorCkbAddress === claims.ckb);
    } else if (claims.dom) {
      filtered = metas.filter((m) => m.creatorBitDomain === claims.dom);
    }
    const totalUploads = filtered.length;
    const now = Date.now();
    const sevenDays = 7 * 24 * 60 * 60 * 1000;
    const uploads7d = filtered.filter((m) => {
      const t = new Date(m.createdAt).getTime();
      return Number.isFinite(t) && now - t <= sevenDays;
    }).length;
    const cfMetas = filtered.filter((m) => (m.cdnUrl || "").includes("videodelivery.net"));
    const uids = cfMetas
      .map((m) => {
        try {
          const u = new URL(m.cdnUrl);
          const parts = u.pathname.split("/").filter(Boolean);
          return parts[0];
        } catch {
          return undefined;
        }
      })
      .filter(Boolean) as string[];
    const cfTotal = uids.length;
    const authHeader = (req.headers["authorization"] || "") as string;
    const results = await Promise.all(
      uids.map((uid) =>
        fetch(`${contentBase}/content/cf/status/${uid}`, { headers: { Authorization: authHeader } })
          .then((r) => (r.ok ? r.json() : { uid, readyToStream: true }))
          .catch(() => ({ uid, readyToStream: true }))
      )
    );
    const cfReady = results.filter((r) => r?.readyToStream === true).length;
    const cfTranscoding = results.filter((r) => r?.readyToStream === false).length;
    const completionRate = cfTotal ? Math.round((cfReady / cfTotal) * 100) : 100;
    return reply.send({ totalUploads, uploads7d, cfTotal, cfTranscoding, cfReady, completionRate });
  } catch (err: any) {
    return reply.status(500).send({ error: err?.message || "统计聚合失败", code: "creator_stats_error" });
  }
});

const port = Number(process.env.API_PORT || 8080);
app.listen({ port }).then(() => {
  app.log.info(`Gateway listening on http://localhost:${port}`);
});

export default app;

function isAdmin(claims: any): boolean {
  const sub = String(claims?.sub || "");
  const dom = String(claims?.dom || "").toLowerCase();
  const roleStr = String(claims?.role || "").toLowerCase();
  const rolesArr = Array.isArray(claims?.roles) ? claims.roles.map((r: any) => String(r).toLowerCase()) : [];
  if (ADMIN_USER_IDS.includes(sub)) return true;
  if (dom && ADMIN_BIT_DOMAINS.includes(dom)) return true;
  if (roleStr === "admin") return true;
  if (rolesArr.includes("admin")) return true;
  if (claims?.isAdmin === true || claims?.adm === true || claims?.adm === 1) return true;
  return false;
}