/**
 * Search & Recommendation Service
 * 
 * 搜索推荐服务 - 使用 Meilisearch (开源轻量)
 */

import Fastify from 'fastify';
import { MeiliSearch } from 'meilisearch';
import { PrismaClient } from '@video-platform/database';
import { register, Counter } from 'prom-client';
import { registerSecurityPlugins } from "@video-platform/shared/security/index";
import { getOrFetch, CACHE_PREFIX, CACHE_TTL } from "@video-platform/shared/stores/redis";

const app = Fastify({ logger: true });
const prisma = new PrismaClient();

// ============== 环境变量 ==============
const PORT = Number(process.env.SEARCH_PORT || process.env.PORT) || 8101;
const MEILI_URL = process.env.MEILISEARCH_URL || 'http://localhost:7700';
const MEILI_KEY = process.env.MEILISEARCH_KEY || 'nexus-search-key-2026';

// ============== Meilisearch 客户端 ==============
const meili = new MeiliSearch({
    host: MEILI_URL,
    apiKey: MEILI_KEY,
});

// ============== 指标 ==============
const searchCounter = new Counter({
    name: 'search_queries_total',
    help: 'Total search queries',
    labelNames: ['type'],
});

// ============== Security ==============
await registerSecurityPlugins(app, { rateLimit: { max: 200, timeWindow: "1 minute" } });

// ============== 健康检查 ==============
app.get('/health', async () => ({ status: 'ok', service: 'search', engine: 'meilisearch' }));
app.get('/metrics', async () => register.metrics());

// ============== 初始化索引 ==============
async function initIndexes() {
    try {
        // 创建视频索引
        await meili.createIndex('videos', { primaryKey: 'id' });
        const videosIndex = meili.index('videos');
        await videosIndex.updateSearchableAttributes(['title', 'description', 'category', 'creatorName']);
        await videosIndex.updateFilterableAttributes(['category', 'creatorId']);
        await videosIndex.updateSortableAttributes(['views', 'createdAt']);

        // 创建直播索引
        await meili.createIndex('lives', { primaryKey: 'id' });
        const livesIndex = meili.index('lives');
        await livesIndex.updateSearchableAttributes(['title', 'description', 'creatorName']);

        // 创建用户索引
        await meili.createIndex('users', { primaryKey: 'id' });
        const usersIndex = meili.index('users');
        await usersIndex.updateSearchableAttributes(['nickname', 'did']);

        console.log('✅ Meilisearch indexes initialized');
    } catch (e: any) {
        console.warn('⚠️ Meilisearch init:', e.message);
    }
}

// ============== 搜索 API ==============

/**
 * 全文搜索
 * GET /search?q=xxx&type=video|live|user&page=1&limit=20
 */
app.get('/search', async (req, reply) => {
    try {
        const query = req.query as { q?: string; type?: string; page?: string; limit?: string };
        const q = query.q?.trim() || '';
        const type = query.type || 'video';
        const page = Math.max(1, parseInt(query.page || '1'));
        const limit = Math.min(50, Math.max(1, parseInt(query.limit || '20')));

        if (!q) {
            return reply.status(400).send({ error: '缺少搜索关键词', code: 'missing_query' });
        }

        searchCounter.inc({ type });

        const indexMap: Record<string, string> = {
            video: 'videos',
            live: 'lives',
            user: 'users',
        };

        const indexName = indexMap[type];
        if (!indexName) {
            return reply.status(400).send({ error: '不支持的类型' });
        }

        try {
            const index = meili.index(indexName);
            const result = await index.search(q, {
                offset: (page - 1) * limit,
                limit,
            });

            return reply.send({
                query: q,
                type,
                page,
                limit,
                total: result.estimatedTotalHits,
                results: result.hits,
                processingTimeMs: result.processingTimeMs,
            });
        } catch (meiliError: any) {
            // Meilisearch 不可用，回退到数据库
            req.log.warn({ error: meiliError.message }, 'Meilisearch unavailable, falling back to DB');
            return await fallbackDbSearch(type, q, page, limit, reply);
        }
    } catch (err: any) {
        req.log.error(err, 'Search failed');
        return reply.status(500).send({ error: err?.message || '搜索失败' });
    }
});

// 数据库回退搜索
async function fallbackDbSearch(type: string, q: string, page: number, limit: number, reply: any) {
    const offset = (page - 1) * limit;

    if (type === 'video') {
        const [videos, total] = await Promise.all([
            prisma.video.findMany({
                where: {
                    OR: [
                        { title: { contains: q, mode: 'insensitive' } },
                        { description: { contains: q, mode: 'insensitive' } },
                    ],
                },
                include: { creator: true },
                skip: offset,
                take: limit,
                orderBy: { views: 'desc' },
            }),
            prisma.video.count({
                where: {
                    OR: [
                        { title: { contains: q, mode: 'insensitive' } },
                        { description: { contains: q, mode: 'insensitive' } },
                    ],
                },
            }),
        ]);
        return reply.send({ query: q, type, page, limit, total, results: videos, fallback: true });
    }

    if (type === 'live') {
        const [rooms, total] = await Promise.all([
            prisma.liveRoom.findMany({
                where: {
                    status: 'live',
                    OR: [
                        { title: { contains: q, mode: 'insensitive' } },
                        { description: { contains: q, mode: 'insensitive' } },
                    ],
                },
                include: { creator: true },
                skip: offset,
                take: limit,
            }),
            prisma.liveRoom.count({
                where: {
                    status: 'live',
                    OR: [
                        { title: { contains: q, mode: 'insensitive' } },
                    ],
                },
            }),
        ]);
        return reply.send({ query: q, type, page, limit, total, results: rooms, fallback: true });
    }

    if (type === 'user') {
        const [users, total] = await Promise.all([
            prisma.user.findMany({
                where: {
                    OR: [
                        { nickname: { contains: q, mode: 'insensitive' } },
                        { did: { contains: q, mode: 'insensitive' } },
                    ],
                },
                skip: offset,
                take: limit,
            }),
            prisma.user.count({
                where: {
                    OR: [
                        { nickname: { contains: q, mode: 'insensitive' } },
                    ],
                },
            }),
        ]);
        return reply.send({ query: q, type, page, limit, total, results: users, fallback: true });
    }

    return reply.status(400).send({ error: '不支持的类型' });
}

// ============== 推荐 API (带缓存) ==============
app.get('/recommendations', async (req, reply) => {
    try {
        const query = req.query as { userId?: string; limit?: string };
        const limit = Math.min(50, parseInt(query.limit || '20'));
        const cacheKey = `${CACHE_PREFIX.RECOMMENDATIONS}:${limit}`;

        const data = await getOrFetch(cacheKey, async () => {
            const videos = await prisma.video.findMany({
                include: { creator: true },
                orderBy: [{ views: 'desc' }, { createdAt: 'desc' }],
                take: limit,
            });
            return { recommendations: videos, algorithm: 'popularity', cached: false };
        }, CACHE_TTL.MEDIUM);

        return reply.send({ ...data, cached: data.cached !== false });
    } catch (err: any) {
        return reply.status(500).send({ error: err?.message });
    }
});

// ============== 热门排行 (带缓存) ==============
app.get('/trending', async (req, reply) => {
    try {
        const query = req.query as { type?: string; limit?: string };
        const type = query.type || 'video';
        const limit = Math.min(50, parseInt(query.limit || '20'));
        const cacheKey = `${CACHE_PREFIX.TRENDING}:${type}:${limit}`;

        // 直播数据用更短的缓存时间
        const ttl = type === 'live' ? CACHE_TTL.SHORT : CACHE_TTL.MEDIUM;

        const data = await getOrFetch(cacheKey, async () => {
            if (type === 'video') {
                const videos = await prisma.video.findMany({
                    include: { creator: true },
                    orderBy: { views: 'desc' },
                    take: limit,
                });
                return { type, trending: videos, cached: false };
            }

            if (type === 'live') {
                const rooms = await prisma.liveRoom.findMany({
                    where: { status: 'live' },
                    include: { creator: true },
                    orderBy: { viewerCount: 'desc' },
                    take: limit,
                });
                return { type, trending: rooms, cached: false };
            }

            throw new Error('不支持的类型');
        }, ttl);

        return reply.send({ ...data, cached: data.cached !== false });
    } catch (err: any) {
        if (err.message === '不支持的类型') {
            return reply.status(400).send({ error: err.message });
        }
        return reply.status(500).send({ error: err?.message });
    }
});

// ============== 同步索引 ==============
app.post('/sync/videos', async (req, reply) => {
    try {
        const videos = await prisma.video.findMany({ include: { creator: true } });

        const documents = videos.map(v => ({
            id: v.id,
            title: v.title,
            description: v.description || '',
            category: v.category || '',
            creatorId: v.creatorId,
            creatorName: v.creator?.nickname || '',
            views: v.views,
            createdAt: v.createdAt.getTime(),
        }));

        const index = meili.index('videos');
        await index.addDocuments(documents);

        return reply.send({ ok: true, indexed: documents.length });
    } catch (err: any) {
        return reply.status(500).send({ error: err?.message });
    }
});

// ============== 启动 ==============
const start = async () => {
    try {
        await initIndexes();
        await app.listen({ port: PORT, host: '0.0.0.0' });
        console.log(`🔍 Search service (Meilisearch) running on port ${PORT}`);
    } catch (err) {
        app.log.error(err);
        process.exit(1);
    }
};

start();
