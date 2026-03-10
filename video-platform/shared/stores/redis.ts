// FILE: /video-platform/shared/stores/redis.ts
/**
 * Redis 客户端封装
 * 提供 Nonce 存储、JWT 黑名单等功能
 * 
 * 环境变量:
 *   REDIS_URL - Redis 连接地址 (默认: redis://localhost:6379)
 */

import Redis from "ioredis";

const REDIS_URL = process.env.REDIS_URL || "redis://localhost:6379";
const REDIS_SENTINEL_HOSTS = process.env.REDIS_SENTINEL_HOSTS || "";
const REDIS_SENTINEL_MASTER = process.env.REDIS_SENTINEL_MASTER || "mymaster";
const REDIS_PASSWORD = process.env.REDIS_PASSWORD || "";

// 全局单例
let redisClient: Redis | null = null;

/**
 * 获取 Redis 客户端单例
 * 自动检测: 如果配置了 REDIS_SENTINEL_HOSTS，使用 Sentinel 模式（自动故障转移）
 * 否则使用标准单节点连接。
 */
export function getRedis(): Redis {
    if (!redisClient) {
        if (REDIS_SENTINEL_HOSTS) {
            // Sentinel 模式: 自动故障转移
            const sentinels = REDIS_SENTINEL_HOSTS.split(",").map((hp) => {
                const [host, port] = hp.trim().split(":");
                return { host, port: parseInt(port) || 26379 };
            });
            redisClient = new Redis({
                sentinels,
                name: REDIS_SENTINEL_MASTER,
                password: REDIS_PASSWORD || undefined,
                sentinelPassword: REDIS_PASSWORD || undefined,
                role: "master",
                lazyConnect: true,
                maxRetriesPerRequest: 3,
                retryStrategy(times) {
                    return Math.min(times * 100, 3000);
                },
                reconnectOnError(err) {
                    return ["READONLY", "ETIMEDOUT", "ECONNRESET"].some(e => err.message.includes(e));
                },
            });
            redisClient.on("error", (err) => console.error("[Redis Sentinel] Error:", err.message));
            redisClient.on("connect", () => console.log("[Redis Sentinel] Master connected"));
            redisClient.on("+switch-master" as any, () => console.log("[Redis Sentinel] Master switched"));
            console.log(`[Redis] Sentinel mode enabled (${sentinels.length} sentinels, master: ${REDIS_SENTINEL_MASTER})`);
        } else {
            // 标准模式: 单节点
            redisClient = new Redis(REDIS_URL, {
                maxRetriesPerRequest: 3,
                lazyConnect: true,
                retryStrategy(times) {
                    const delay = Math.min(times * 100, 3000);
                    return delay;
                },
            });
            redisClient.on("error", (err) => console.error("[Redis] Error:", err));
            redisClient.on("connect", () => console.log("[Redis] Connected"));
        }
    }
    return redisClient;
}

/**
 * 关闭 Redis 连接
 */
export async function closeRedis(): Promise<void> {
    if (redisClient) {
        await redisClient.quit();
        redisClient = null;
    }
}

// ============== Nonce 存储 ==============

/**
 * 设置 Nonce (带 TTL)
 */
export async function setNonce(
    prefix: string,
    key: string,
    value: any,
    ttlSeconds: number
): Promise<void> {
    const redis = getRedis();
    await redis.setex(`${prefix}:${key}`, ttlSeconds, JSON.stringify(value));
}

/**
 * 获取 Nonce
 */
export async function getNonce<T = any>(prefix: string, key: string): Promise<T | null> {
    const redis = getRedis();
    const data = await redis.get(`${prefix}:${key}`);
    return data ? JSON.parse(data) : null;
}

/**
 * 删除 Nonce
 */
export async function deleteNonce(prefix: string, key: string): Promise<void> {
    const redis = getRedis();
    await redis.del(`${prefix}:${key}`);
}

/**
 * 检查 Nonce 是否存在
 */
export async function hasNonce(prefix: string, key: string): Promise<boolean> {
    const redis = getRedis();
    const exists = await redis.exists(`${prefix}:${key}`);
    return exists === 1;
}

// ============== JWT 黑名单 ==============

/**
 * 添加 JWT 到黑名单
 */
export async function addToBlacklist(jti: string, ttlSeconds: number): Promise<void> {
    const redis = getRedis();
    await redis.setex(`jwt:revoked:${jti}`, ttlSeconds, "1");
}

/**
 * 检查 JWT 是否在黑名单中
 */
export async function isBlacklisted(jti: string): Promise<boolean> {
    const redis = getRedis();
    const exists = await redis.exists(`jwt:revoked:${jti}`);
    return exists === 1;
}

// ============== 通用键值存储 ==============

/**
 * 设置键值 (带 TTL)
 */
export async function setKey(key: string, value: string, ttlSeconds?: number): Promise<void> {
    const redis = getRedis();
    if (ttlSeconds) {
        await redis.setex(key, ttlSeconds, value);
    } else {
        await redis.set(key, value);
    }
}

/**
 * 获取键值
 */
export async function getKey(key: string): Promise<string | null> {
    const redis = getRedis();
    return redis.get(key);
}

/**
 * 删除键
 */
export async function deleteKey(key: string): Promise<void> {
    const redis = getRedis();
    await redis.del(key);
}

// ============== 内存回退模式 ==============

// 当 Redis 不可用时的内存回退存储
const memoryFallback = new Map<string, { value: any; expiresAt: number }>();

/**
 * 设置值 (带自动回退到内存)
 */
export async function setWithFallback(
    prefix: string,
    key: string,
    value: any,
    ttlSeconds: number
): Promise<void> {
    try {
        await setNonce(prefix, key, value, ttlSeconds);
    } catch (err) {
        console.warn("[Redis] Fallback to memory:", err);
        const fullKey = `${prefix}:${key}`;
        memoryFallback.set(fullKey, {
            value,
            expiresAt: Date.now() + ttlSeconds * 1000,
        });
    }
}

/**
 * 获取值 (带自动回退到内存)
 */
export async function getWithFallback<T = any>(prefix: string, key: string): Promise<T | null> {
    try {
        return await getNonce<T>(prefix, key);
    } catch (err) {
        console.warn("[Redis] Fallback to memory:", err);
        const fullKey = `${prefix}:${key}`;
        const entry = memoryFallback.get(fullKey);
        if (!entry) return null;
        if (Date.now() > entry.expiresAt) {
            memoryFallback.delete(fullKey);
            return null;
        }
        return entry.value;
    }
}

/**
 * 删除值 (带自动回退到内存)
 */
export async function deleteWithFallback(prefix: string, key: string): Promise<void> {
    try {
        await deleteNonce(prefix, key);
    } catch (err) {
        console.warn("[Redis] Fallback to memory:", err);
        const fullKey = `${prefix}:${key}`;
        memoryFallback.delete(fullKey);
    }
}

// ============== Identity Service 专用函数 ==============

const NONCE_TTL_SEC = 120; // 2 minutes
const OAUTH_TTL_SEC = 600; // 10 minutes
const JWT_REVOKE_TTL_SEC = 12 * 60 * 60; // 12 hours (token lifetime)

/**
 * 初始化 Redis 连接（懒加载模式，无操作）
 */
export function initRedis(): void {
    // Redis is initialized on first use via getRedis()
    console.log("[Redis] Lazy init configured, will connect on first use");
}

// JoyID Nonce 存储
export async function setJoyIdNonce(nonceId: string, issuedAt: number): Promise<void> {
    const redis = getRedis();
    await redis.setex(`identity:nonce:${nonceId}`, NONCE_TTL_SEC, String(issuedAt));
}

export async function getNonceIssuedAt(nonceId: string): Promise<number | null> {
    const redis = getRedis();
    const data = await redis.get(`identity:nonce:${nonceId}`);
    return data ? Number(data) : null;
}

export async function deleteNonceById(nonceId: string): Promise<void> {
    const redis = getRedis();
    await redis.del(`identity:nonce:${nonceId}`);
}

// JWT 吊销
export async function revokeJti(jti: string): Promise<void> {
    const redis = getRedis();
    await redis.setex(`jwt:revoked:${jti}`, JWT_REVOKE_TTL_SEC, "1");
}

export async function isJtiRevoked(jti: string): Promise<boolean> {
    const redis = getRedis();
    const exists = await redis.exists(`jwt:revoked:${jti}`);
    return exists === 1;
}

// Twitter OAuth PKCE 存储
export async function setTwitterPkce(
    state: string,
    data: { codeVerifier: string; dfp: string; issuedAt: number }
): Promise<void> {
    const redis = getRedis();
    await redis.setex(`identity:twitter:${state}`, OAUTH_TTL_SEC, JSON.stringify(data));
}

export async function getTwitterPkce(
    state: string
): Promise<{ codeVerifier: string; dfp: string; issuedAt: number } | null> {
    const redis = getRedis();
    const data = await redis.get(`identity:twitter:${state}`);
    return data ? JSON.parse(data) : null;
}

export async function deleteTwitterPkce(state: string): Promise<void> {
    const redis = getRedis();
    await redis.del(`identity:twitter:${state}`);
}

// 邮箱验证码存储
export async function setEmailCode(
    email: string,
    data: { code: string; dfp: string; issuedAt: number }
): Promise<void> {
    const redis = getRedis();
    await redis.setex(`identity:email:${email}`, OAUTH_TTL_SEC, JSON.stringify(data));
}

export async function getEmailCode(
    email: string
): Promise<{ code: string; dfp: string; issuedAt: number } | null> {
    const redis = getRedis();
    const data = await redis.get(`identity:email:${email}`);
    return data ? JSON.parse(data) : null;
}

export async function deleteEmailCode(email: string): Promise<void> {
    const redis = getRedis();
    await redis.del(`identity:email:${email}`);
}

// 手机验证码存储 (SMS)
export async function setSmsCode(
    phone: string,
    data: { code: string; dfp: string; issuedAt: number }
): Promise<void> {
    const redis = getRedis();
    await redis.setex(`identity:phone:${phone}`, OAUTH_TTL_SEC, JSON.stringify(data));
}

export async function getSmsCode(
    phone: string
): Promise<{ code: string; dfp: string; issuedAt: number } | null> {
    const redis = getRedis();
    const data = await redis.get(`identity:phone:${phone}`);
    return data ? JSON.parse(data) : null;
}

export async function deleteSmsCode(phone: string): Promise<void> {
    const redis = getRedis();
    await redis.del(`identity:phone:${phone}`);
}

// 魔法链接存储
export async function setMagicLink(
    token: string,
    data: { email: string; dfp: string; issuedAt: number }
): Promise<void> {
    const redis = getRedis();
    await redis.setex(`identity:magic:${token}`, OAUTH_TTL_SEC, JSON.stringify(data));
}

export async function getMagicLink(
    token: string
): Promise<{ email: string; dfp: string; issuedAt: number } | null> {
    const redis = getRedis();
    const data = await redis.get(`identity:magic:${token}`);
    return data ? JSON.parse(data) : null;
}

export async function deleteMagicLink(token: string): Promise<void> {
    const redis = getRedis();
    await redis.del(`identity:magic:${token}`);
}

// .bit 域名绑定存储（持久化）
export async function setBitBinding(domain: string, address: string): Promise<void> {
    const redis = getRedis();
    // 双向绑定：domain -> address, address -> domain
    await redis.set(`identity:bit:domain:${domain}`, address);
    await redis.set(`identity:bit:addr:${address}`, domain);
}

export async function getBitByDomain(domain: string): Promise<string | null> {
    const redis = getRedis();
    return redis.get(`identity:bit:domain:${domain}`);
}

export async function getBitByAddress(address: string): Promise<string | null> {
    const redis = getRedis();
    return redis.get(`identity:bit:addr:${address}`);
}

export async function deleteBitBinding(domain: string, address?: string): Promise<void> {
    const redis = getRedis();
    await redis.del(`identity:bit:domain:${domain}`);
    if (address) {
        await redis.del(`identity:bit:addr:${address}`);
    }
}

export async function deleteBitByAddress(address: string): Promise<void> {
    const redis = getRedis();
    const domain = await getBitByAddress(address);
    await redis.del(`identity:bit:addr:${address}`);
    if (domain) {
        await redis.del(`identity:bit:domain:${domain}`);
    }
}

// Google OAuth State 存储
export async function setGoogleOAuthState(
    state: string,
    data: { codeVerifier: string; dfp: string; issuedAt: number }
): Promise<void> {
    const redis = getRedis();
    await redis.setex(`identity:google:${state}`, OAUTH_TTL_SEC, JSON.stringify(data));
}

export async function getGoogleOAuthState(
    state: string
): Promise<{ codeVerifier: string; dfp: string; issuedAt: number } | null> {
    const redis = getRedis();
    const data = await redis.get(`identity:google:${state}`);
    return data ? JSON.parse(data) : null;
}

export async function deleteGoogleOAuthState(state: string): Promise<void> {
    const redis = getRedis();
    await redis.del(`identity:google:${state}`);
}

// TikTok OAuth State 存储
export async function setTikTokOAuthState(
    state: string,
    data: { codeVerifier: string; dfp: string; issuedAt: number }
): Promise<void> {
    const redis = getRedis();
    await redis.setex(`identity:tiktok:${state}`, OAUTH_TTL_SEC, JSON.stringify(data));
}

export async function getTikTokOAuthState(
    state: string
): Promise<{ codeVerifier: string; dfp: string; issuedAt: number } | null> {
    const redis = getRedis();
    const data = await redis.get(`identity:tiktok:${state}`);
    return data ? JSON.parse(data) : null;
}

export async function deleteTikTokOAuthState(state: string): Promise<void> {
    const redis = getRedis();
    await redis.del(`identity:tiktok:${state}`);
}

// YouTube OAuth State 存储
export async function setYouTubeOAuthState(
    state: string,
    data: { codeVerifier: string; dfp: string; issuedAt: number }
): Promise<void> {
    const redis = getRedis();
    await redis.setex(`identity:youtube:${state}`, OAUTH_TTL_SEC, JSON.stringify(data));
}

export async function getYouTubeOAuthState(
    state: string
): Promise<{ codeVerifier: string; dfp: string; issuedAt: number } | null> {
    const redis = getRedis();
    const data = await redis.get(`identity:youtube:${state}`);
    return data ? JSON.parse(data) : null;
}

export async function deleteYouTubeOAuthState(state: string): Promise<void> {
    const redis = getRedis();
    await redis.del(`identity:youtube:${state}`);
}

// Bilibili OAuth State 存储
export async function setBilibiliOAuthState(
    state: string,
    data: { codeVerifier: string; dfp: string; issuedAt: number }
): Promise<void> {
    const redis = getRedis();
    await redis.setex(`identity:bilibili:${state}`, OAUTH_TTL_SEC, JSON.stringify(data));
}

export async function getBilibiliOAuthState(
    state: string
): Promise<{ codeVerifier: string; dfp: string; issuedAt: number } | null> {
    const redis = getRedis();
    const data = await redis.get(`identity:bilibili:${state}`);
    return data ? JSON.parse(data) : null;
}

export async function deleteBilibiliOAuthState(state: string): Promise<void> {
    const redis = getRedis();
    await redis.del(`identity:bilibili:${state}`);
}

// ============== API 响应缓存 ==============

// 缓存前缀常量
export const CACHE_PREFIX = {
    VIDEO_META: "cache:video:",
    VIDEO_LIST: "cache:videos:list",
    TRENDING: "cache:trending",
    RECOMMENDATIONS: "cache:recommendations",
    USER_PROFILE: "cache:user:",
    LIVE_ROOMS: "cache:live:rooms",
    NFT_COLLECTIONS: "cache:nft:collections",
    SEARCH: "cache:search:",
} as const;

// 默认 TTL (秒)
export const CACHE_TTL = {
    SHORT: 30,       // 30秒 - 高频变化数据
    MEDIUM: 300,     // 5分钟 - 一般列表
    LONG: 1800,      // 30分钟 - 较稳定数据
    HOUR: 3600,      // 1小时
    DAY: 86400,      // 1天 - 很少变化的数据
} as const;

/**
 * 获取缓存数据
 */
export async function getCache<T = any>(key: string): Promise<T | null> {
    try {
        const redis = getRedis();
        const data = await redis.get(key);
        if (!data) return null;
        return JSON.parse(data) as T;
    } catch (err) {
        console.warn("[Cache] Get failed:", key, err);
        return null;
    }
}

/**
 * 设置缓存数据
 */
export async function setCache(key: string, value: any, ttlSeconds: number = CACHE_TTL.MEDIUM): Promise<void> {
    try {
        const redis = getRedis();
        await redis.setex(key, ttlSeconds, JSON.stringify(value));
    } catch (err) {
        console.warn("[Cache] Set failed:", key, err);
    }
}

/**
 * 删除缓存
 */
export async function invalidateCache(key: string): Promise<void> {
    try {
        const redis = getRedis();
        await redis.del(key);
    } catch (err) {
        console.warn("[Cache] Invalidate failed:", key, err);
    }
}

/**
 * 按前缀批量删除缓存
 */
export async function invalidateCacheByPrefix(prefix: string): Promise<number> {
    try {
        const redis = getRedis();
        const keys = await redis.keys(`${prefix}*`);
        if (keys.length === 0) return 0;
        await redis.del(...keys);
        console.log(`[Cache] Invalidated ${keys.length} keys with prefix: ${prefix}`);
        return keys.length;
    } catch (err) {
        console.warn("[Cache] Bulk invalidate failed:", prefix, err);
        return 0;
    }
}

/**
 * 带缓存的读取模式（Read-Through）
 * 先检查缓存，未命中则调用 fetcher 获取数据并缓存
 */
export async function getOrFetch<T>(
    key: string,
    fetcher: () => Promise<T>,
    ttlSeconds: number = CACHE_TTL.MEDIUM
): Promise<T> {
    // 尝试从缓存读取
    const cached = await getCache<T>(key);
    if (cached !== null) {
        return cached;
    }

    // 缓存未命中，调用 fetcher
    const data = await fetcher();

    // 写入缓存（异步，不阻塞返回）
    setCache(key, data, ttlSeconds).catch(() => { });

    return data;
}

/**
 * 获取缓存统计信息
 */
export async function getCacheStats(): Promise<{
    connected: boolean;
    keys: number;
    memory: string;
}> {
    try {
        const redis = getRedis();
        const info = await redis.info("memory");
        const dbsize = await redis.dbsize();
        const memMatch = info.match(/used_memory_human:(\S+)/);
        return {
            connected: true,
            keys: dbsize,
            memory: memMatch ? memMatch[1] : "unknown",
        };
    } catch (err) {
        return {
            connected: false,
            keys: 0,
            memory: "0B",
        };
    }
}
