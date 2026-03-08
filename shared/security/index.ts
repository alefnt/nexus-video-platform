/**
 * 安全中间件模块
 * 
 * 包含: JWT 刷新、安全头、XSS 防护
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import helmet from '@fastify/helmet';

// ============== JWT 配置 ==============
export const JWT_CONFIG = {
    accessTokenTTL: '15m',  // Access Token 15分钟过期
    refreshTokenTTL: '7d',  // Refresh Token 7天过期
    algorithm: 'HS256' as const,
};

// ============== XSS 防护 ==============

/**
 * HTML 实体转义
 */
export function escapeHtml(text: string): string {
    const map: Record<string, string> = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;',
    };
    return text.replace(/[&<>"']/g, char => map[char]);
}

/**
 * 清理用户输入 (移除潜在 XSS 脚本)
 */
export function sanitizeInput(input: string): string {
    return input
        .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
        .replace(/on\w+\s*=/gi, '')
        .replace(/javascript:/gi, '');
}

// ============== 安全头配置 ==============

// 生产环境允许的域名白名单
const ALLOWED_ORIGINS = [
    "http://localhost:5173",
    "http://localhost:3000",
    process.env.FRONTEND_URL,
    process.env.CORS_ORIGIN,
].filter(Boolean) as string[];

const isDev = process.env.NODE_ENV !== "production";

export interface SecurityOptions {
    rateLimit?: { max?: number; timeWindow?: string };
    corsOrigins?: string[];
    enableHelmet?: boolean;
    enableRateLimit?: boolean;
    enableCors?: boolean;
}

export async function registerSecurityPlugins(app: FastifyInstance, options: SecurityOptions = {}) {
    const {
        enableHelmet = true,
        enableRateLimit = true,
        enableCors = true,
        rateLimit: rateLimitOpts,
        corsOrigins,
    } = options;

    // Helmet 安全头
    if (enableHelmet) {
        await app.register(helmet, {
            contentSecurityPolicy: isDev ? false : {
                directives: {
                    defaultSrc: ["'self'"],
                    scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
                    styleSrc: ["'self'", "'unsafe-inline'"],
                    imgSrc: ["'self'", "data:", "https:"],
                    connectSrc: ["'self'", "ws:", "wss:", "http:", "https:"],
                    fontSrc: ["'self'", "https:", "data:"],
                    objectSrc: ["'none'"],
                    mediaSrc: ["'self'", "https:"],
                    frameSrc: ["'self'"],
                },
            },
            crossOriginEmbedderPolicy: false,
            crossOriginResourcePolicy: { policy: "cross-origin" },
            hsts: {
                maxAge: 31536000,
                includeSubDomains: true,
                preload: true,
            },
        });
    }

    // CORS 跨域配置
    if (enableCors) {
        const cors = await import("@fastify/cors");
        const origins = corsOrigins || ALLOWED_ORIGINS;
        await app.register(cors.default, {
            origin: isDev ? true : origins,
            credentials: true,
            methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
            allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With", "X-Trace-Id"],
        });
    }

    // Rate Limiting 请求限流
    if (enableRateLimit) {
        const rateLimit = await import("@fastify/rate-limit");
        await app.register(rateLimit.default, {
            max: rateLimitOpts?.max || 100,
            timeWindow: rateLimitOpts?.timeWindow || "1 minute",
            keyGenerator: (req) => {
                const userId = (req.user as any)?.id;
                return userId || req.ip;
            },
            errorResponseBuilder: () => ({
                error: "请求过于频繁",
                code: "rate_limit_exceeded",
                retryAfter: 60,
            }),
        });
    }

    // 添加 Trace ID
    app.addHook("onRequest", async (req) => {
        const traceId = req.headers["x-trace-id"] as string || crypto.randomUUID();
        req.headers["x-trace-id"] = traceId;
        req.log = req.log.child({ traceId });
    });

    console.log('🛡️ Security plugins registered (Helmet, CORS, RateLimit)');
}

export { ALLOWED_ORIGINS };

// ============== JWT 刷新机制 ==============

interface RefreshTokenPayload {
    sub: string;
    type: 'refresh';
    jti: string;
}

interface TokenPair {
    accessToken: string;
    refreshToken: string;
    expiresIn: number;
}

/**
 * 生成 Token 对 (Access + Refresh)
 */
export async function generateTokenPair(
    app: FastifyInstance,
    userId: string,
    claims: Record<string, any> = {}
): Promise<TokenPair> {
    const jti = crypto.randomUUID();

    // Access Token
    const accessToken = await app.jwt.sign(
        { sub: userId, ...claims },
        { expiresIn: JWT_CONFIG.accessTokenTTL }
    );

    // Refresh Token
    const refreshToken = await app.jwt.sign(
        { sub: userId, type: 'refresh', jti } as RefreshTokenPayload,
        { expiresIn: JWT_CONFIG.refreshTokenTTL }
    );

    return {
        accessToken,
        refreshToken,
        expiresIn: 15 * 60, // 15分钟 (秒)
    };
}

/**
 * 注册刷新 Token 端点
 */
export function registerRefreshEndpoint(app: FastifyInstance) {
    // 刷新 Token 吊销列表 (生产环境应使用 Redis)
    const revokedRefreshTokens = new Set<string>();

    /**
     * POST /auth/refresh
     * Body: { refreshToken: string }
     * Response: { accessToken, refreshToken, expiresIn }
     */
    app.post('/auth/refresh', async (req: FastifyRequest, reply: FastifyReply) => {
        try {
            const body = req.body as { refreshToken?: string };
            const refreshToken = body?.refreshToken;

            if (!refreshToken) {
                return reply.status(400).send({ error: '缺少 refreshToken', code: 'missing_token' });
            }

            // 验证 Refresh Token
            let payload: RefreshTokenPayload;
            try {
                payload = await app.jwt.verify<RefreshTokenPayload>(refreshToken);
            } catch {
                return reply.status(401).send({ error: 'Refresh Token 无效', code: 'invalid_token' });
            }

            // 检查 Token 类型
            if (payload.type !== 'refresh') {
                return reply.status(401).send({ error: 'Token 类型错误', code: 'wrong_token_type' });
            }

            // 检查是否已吊销
            if (revokedRefreshTokens.has(payload.jti)) {
                return reply.status(401).send({ error: 'Token 已被吊销', code: 'token_revoked' });
            }

            // 吊销旧 Token (Rotation)
            revokedRefreshTokens.add(payload.jti);

            // 生成新 Token 对
            const tokens = await generateTokenPair(app, payload.sub);

            return reply.send(tokens);
        } catch (err: any) {
            req.log.error(err, 'Token refresh failed');
            return reply.status(500).send({ error: '刷新失败', code: 'refresh_failed' });
        }
    });

    /**
     * POST /auth/revoke
     * Body: { refreshToken: string }
     */
    app.post('/auth/revoke', async (req: FastifyRequest, reply: FastifyReply) => {
        try {
            const body = req.body as { refreshToken?: string };
            const refreshToken = body?.refreshToken;

            if (!refreshToken) {
                return reply.status(400).send({ error: '缺少 refreshToken' });
            }

            let payload: RefreshTokenPayload | null = null;
            try {
                payload = await app.jwt.verify<RefreshTokenPayload>(refreshToken);
            } catch {
                // Token invalid or expired, payload stays null
            }
            if (payload?.jti) {
                revokedRefreshTokens.add(payload.jti);
            }

            return reply.send({ ok: true, message: 'Token 已吊销' });
        } catch {
            return reply.send({ ok: true });
        }
    });

    console.log('🔐 JWT refresh endpoints registered');
}

// ============== 输入验证中间件 ==============

/**
 * 请求体清理中间件
 */
export function createSanitizationHook() {
    return async (req: FastifyRequest) => {
        if (req.body && typeof req.body === 'object') {
            sanitizeObject(req.body as Record<string, unknown>);
        }
    };
}

function sanitizeObject(obj: Record<string, unknown>) {
    for (const key in obj) {
        const value = obj[key];
        if (typeof value === 'string') {
            obj[key] = sanitizeInput(value);
        } else if (value && typeof value === 'object') {
            sanitizeObject(value as Record<string, unknown>);
        }
    }
}
