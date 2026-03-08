// FILE: /video-platform/shared/tests/redis.test.ts
/**
 * Redis 缓存模块单元测试
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock ioredis
vi.mock("ioredis", () => {
    const mockRedis = {
        setex: vi.fn().mockResolvedValue("OK"),
        get: vi.fn().mockResolvedValue(null),
        del: vi.fn().mockResolvedValue(1),
        exists: vi.fn().mockResolvedValue(0),
        keys: vi.fn().mockResolvedValue([]),
        dbsize: vi.fn().mockResolvedValue(0),
        info: vi.fn().mockResolvedValue("used_memory_human:1M"),
        on: vi.fn(),
        quit: vi.fn().mockResolvedValue("OK"),
    };
    return { default: vi.fn(() => mockRedis) };
});

describe("Redis Cache Module", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe("CACHE_PREFIX", () => {
        it("should define standard cache prefixes", async () => {
            const { CACHE_PREFIX } = await import("../stores/redis");

            expect(CACHE_PREFIX.VIDEO_META).toBe("cache:video:");
            expect(CACHE_PREFIX.TRENDING).toBe("cache:trending");
            expect(CACHE_PREFIX.RECOMMENDATIONS).toBe("cache:recommendations");
        });
    });

    describe("CACHE_TTL", () => {
        it("should define standard TTL values", async () => {
            const { CACHE_TTL } = await import("../stores/redis");

            expect(CACHE_TTL.SHORT).toBe(30);
            expect(CACHE_TTL.MEDIUM).toBe(300);
            expect(CACHE_TTL.LONG).toBe(1800);
            expect(CACHE_TTL.HOUR).toBe(3600);
            expect(CACHE_TTL.DAY).toBe(86400);
        });
    });

    describe("getOrFetch", () => {
        it("should return cached value if available", async () => {
            const { getOrFetch, getRedis } = await import("../stores/redis");

            const redis = getRedis();
            vi.mocked(redis.get).mockResolvedValueOnce(JSON.stringify({ data: "cached" }));

            const fetcher = vi.fn().mockResolvedValue({ data: "fresh" });
            const result = await getOrFetch("test-key", fetcher, 300);

            expect(result).toEqual({ data: "cached" });
            expect(fetcher).not.toHaveBeenCalled();
        });

        it("should call fetcher and cache result if cache miss", async () => {
            const { getOrFetch, getRedis } = await import("../stores/redis");

            const redis = getRedis();
            vi.mocked(redis.get).mockResolvedValueOnce(null);

            const fetcher = vi.fn().mockResolvedValue({ data: "fresh" });
            const result = await getOrFetch("test-key", fetcher, 300);

            expect(result).toEqual({ data: "fresh" });
            expect(fetcher).toHaveBeenCalledOnce();
        });
    });
});
