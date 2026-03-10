/**
 * Redis Cache Layer — Unified caching with in-memory fallback
 *
 * Usage:
 *   import { cache } from '@video-platform/shared/cache';
 *   await cache.set('key', data, 3600);  // TTL in seconds
 *   const val = await cache.get('key');
 *
 * If REDIS_URL is set, uses Redis. Otherwise falls back to in-memory Map.
 */

// ═══ In-Memory Fallback ═══

interface CacheEntry {
    value: string;
    expiresAt: number;
}

const memoryStore = new Map<string, CacheEntry>();

// Cleanup expired entries every 60s
setInterval(() => {
    const now = Date.now();
    memoryStore.forEach((entry, key) => {
        if (entry.expiresAt > 0 && now > entry.expiresAt) memoryStore.delete(key);
    });
}, 60_000);

// ═══ Redis Client (lazy init) ═══

let redisClient: any = null;
let redisConnected = false;

async function getRedisClient() {
    if (redisClient) return redisConnected ? redisClient : null;
    const url = process.env.REDIS_URL;
    if (!url) return null;

    try {
        // Dynamic import to avoid hard dependency
        const redis = await import("redis").catch(() => null);
        if (!redis) return null;

        redisClient = redis.createClient({ url });
        redisClient.on("error", () => { redisConnected = false; });
        redisClient.on("connect", () => { redisConnected = true; });
        await redisClient.connect();
        redisConnected = true;
        console.log("✅ Redis connected:", url);
        return redisClient;
    } catch {
        console.warn("⚠️  Redis not available, using in-memory cache");
        return null;
    }
}

// ═══ Unified Cache API ═══

export const cache = {
    /** Get a cached value */
    async get<T = any>(key: string): Promise<T | null> {
        const redis = await getRedisClient();
        if (redis) {
            try {
                const val = await redis.get(`nexus:${key}`);
                return val ? JSON.parse(val) : null;
            } catch {
                // Fallback to memory on Redis error
            }
        }
        const entry = memoryStore.get(key);
        if (!entry) return null;
        if (entry.expiresAt > 0 && Date.now() > entry.expiresAt) {
            memoryStore.delete(key);
            return null;
        }
        return JSON.parse(entry.value);
    },

    /** Set a cached value with optional TTL (seconds) */
    async set(key: string, value: any, ttlSeconds = 0): Promise<void> {
        const serialized = JSON.stringify(value);
        const redis = await getRedisClient();
        if (redis) {
            try {
                if (ttlSeconds > 0) {
                    await redis.setEx(`nexus:${key}`, ttlSeconds, serialized);
                } else {
                    await redis.set(`nexus:${key}`, serialized);
                }
                return;
            } catch { /* fallback */ }
        }
        memoryStore.set(key, {
            value: serialized,
            expiresAt: ttlSeconds > 0 ? Date.now() + ttlSeconds * 1000 : 0,
        });
    },

    /** Delete a cached entry */
    async del(key: string): Promise<void> {
        const redis = await getRedisClient();
        if (redis) {
            try { await redis.del(`nexus:${key}`); return; } catch { /* fallback */ }
        }
        memoryStore.delete(key);
    },

    /** Check if key exists */
    async has(key: string): Promise<boolean> {
        return (await cache.get(key)) !== null;
    },

    /** Get cache stats */
    stats(): { backend: string; entries: number; connected: boolean } {
        return {
            backend: redisConnected ? "redis" : "memory",
            entries: memoryStore.size,
            connected: redisConnected,
        };
    },

    /** Flush all entries */
    async flush(): Promise<void> {
        memoryStore.clear();
        const redis = await getRedisClient();
        if (redis) {
            try {
                const keys = await redis.keys("nexus:*");
                if (keys.length > 0) await redis.del(keys);
            } catch { /* ignore */ }
        }
    },
};

export default cache;
