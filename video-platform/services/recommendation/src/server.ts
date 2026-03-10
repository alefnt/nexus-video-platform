/**
 * Recommendation Service - 智能推荐引擎
 * Port: 8105
 *
 * 推荐策略:
 * 1. 热门排序 (热度加权 + 时间衰减)
 * 2. 标签匹配 (用户兴趣标签 vs 视频标签)
 * 3. 协同过滤 (相似用户的观看行为)
 * 4. 探索发现 (随机多样化，防止信息茧房)
 *
 * 架构: Web2 存储 (MinIO/CDN), Web3 确权 (CKB/Spore)
 * 推荐系统只关心内容元数据, 不涉及链上数据
 */

import Fastify from "fastify";
import { PrismaClient } from "@prisma/client";
import { register } from "prom-client";
import { registerSecurityPlugins } from "@video-platform/shared/security/index";

const prisma = new PrismaClient();
const PORT = parseInt(process.env.PORT || "8105");

const app = Fastify({ logger: true });

// Apply security (Helmet + CORS + rate limiting)
registerSecurityPlugins(app, { rateLimit: { max: 200, timeWindow: "1 minute" } });

/** 推荐列表中各来源的比例 */
const FEED_COMPOSITION = {
    hot: 0.3,       // 30% 热门内容
    tagMatch: 0.35, // 35% 标签匹配
    cf: 0.15,       // 15% 协同过滤
    explore: 0.2,   // 20% 探索 (防信息茧房)
};

/** 热度衰减半衰期 (小时) */
const HOTNESS_HALF_LIFE_HOURS = 48;

/** 用户兴趣标签衰减系数 (每天) */
const INTEREST_DECAY_FACTOR = 0.95;

/** 缓存 TTL (秒) */
const CACHE_TTL = 300; // 5 分钟

// ============== 工具函数 ==============

/**
 * 计算内容热度分数
 * 公式: (views * 1 + likes * 5 + comments * 3) * timeDecay
 */
function calculateHotness(
    views: number,
    likes: number,
    comments: number,
    createdAt: Date
): number {
    const ageHours = (Date.now() - createdAt.getTime()) / (1000 * 60 * 60);
    const timeDecay = Math.pow(0.5, ageHours / HOTNESS_HALF_LIFE_HOURS);
    const engagement = views * 1 + likes * 5 + comments * 3;
    return engagement * timeDecay;
}

/**
 * 计算标签相似度 (Jaccard coefficient)
 */
function tagSimilarity(userTags: string[], videoTags: string[]): number {
    if (userTags.length === 0 || videoTags.length === 0) return 0;
    const setA = new Set(userTags);
    const setB = new Set(videoTags);
    const intersection = [...setA].filter((t) => setB.has(t)).length;
    const union = new Set([...setA, ...setB]).size;
    return union === 0 ? 0 : intersection / union;
}

/**
 * 打乱数组 (Fisher-Yates)
 */
function shuffle<T>(arr: T[]): T[] {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
}

// ============== 健康检查 ==============

app.get("/health", async () => ({ status: "ok", service: "recommendation" }));

app.get("/metrics", async (_req, reply) => {
    reply.header("Content-Type", register.contentType);
    return reply.send(await register.metrics());
});

// ============== 推荐 API ==============

interface FeedQuery {
    userId?: string;
    page?: number;
    pageSize?: number;
    contentType?: string; // video | music | article
}

/**
 * GET /recommendation/feed
 * 获取个性化推荐 Feed
 *
 * 未登录: 返回热门内容
 * 已登录: 混合推荐 (热门 + 标签匹配 + 协同过滤 + 探索)
 */
app.get<{ Querystring: FeedQuery }>("/recommendation/feed", async (req, reply) => {
    const { userId, page = 1, pageSize = 20, contentType = "video" } = req.query;
    const skip = (page - 1) * pageSize;

    try {
        // 获取已观看列表 (排除已看过的)
        let watchedIds: string[] = [];
        let userTags: { tag: string; score: number }[] = [];

        if (userId) {
            const [watched, interests] = await Promise.all([
                prisma.watchHistory.findMany({
                    where: { userId },
                    select: { videoId: true },
                    orderBy: { lastWatchedAt: "desc" },
                    take: 200,
                }),
                prisma.userInterest.findMany({
                    where: { userId },
                    orderBy: { score: "desc" },
                    take: 50,
                }),
            ]);
            watchedIds = watched.map((w) => w.videoId);
            userTags = interests.map((i) => ({ tag: i.tag, score: i.score }));
        }

        // ========== 1. 热门内容 ==========
        const hotCount = Math.ceil(pageSize * FEED_COMPOSITION.hot);
        const hotVideos = await prisma.video.findMany({
            where: {
                id: { notIn: watchedIds },
                moderationStatus: "approved",
                ...(contentType !== "all" ? { contentType } : {}),
            },
            orderBy: [{ views: "desc" }, { likes: "desc" }],
            take: hotCount * 3, // 取多一些用于排序
            select: {
                id: true, title: true, coverUrl: true, videoUrl: true,
                duration: true, views: true, likes: true, commentCount: true,
                tags: true, contentType: true, createdAt: true,
                creator: { select: { id: true, username: true, avatarUrl: true } },
            },
        });

        // 按热度分数排序
        const hotRanked = hotVideos
            .map((v) => ({
                ...v,
                _hotness: calculateHotness(v.views, v.likes, v.commentCount, v.createdAt),
                _source: "hot" as const,
            }))
            .sort((a, b) => b._hotness - a._hotness)
            .slice(0, hotCount);

        // ========== 2. 标签匹配 ==========
        let tagMatched: typeof hotRanked = [];
        if (userId && userTags.length > 0) {
            const tagCount = Math.ceil(pageSize * FEED_COMPOSITION.tagMatch);
            const topTags = userTags.slice(0, 10).map((t) => t.tag);

            const tagVideos = await prisma.video.findMany({
                where: {
                    id: { notIn: [...watchedIds, ...hotRanked.map((v) => v.id)] },
                    tags: { hasSome: topTags },
                    moderationStatus: "approved",
                    ...(contentType !== "all" ? { contentType } : {}),
                },
                take: tagCount * 3,
                select: {
                    id: true, title: true, coverUrl: true, videoUrl: true,
                    duration: true, views: true, likes: true, commentCount: true,
                    tags: true, contentType: true, createdAt: true,
                    creator: { select: { id: true, username: true, avatarUrl: true } },
                },
            });

            const userTagNames = userTags.map((t) => t.tag);
            tagMatched = tagVideos
                .map((v) => ({
                    ...v,
                    _hotness: calculateHotness(v.views, v.likes, v.commentCount, v.createdAt),
                    _tagScore: tagSimilarity(userTagNames, v.tags),
                    _source: "tag_match" as const,
                }))
                .sort((a, b) => b._tagScore * b._hotness - a._tagScore * a._hotness)
                .slice(0, tagCount);
        }

        // ========== 3. 协同过滤 (简化版) ==========
        let cfVideos: typeof hotRanked = [];
        if (userId && watchedIds.length > 0) {
            const cfCount = Math.ceil(pageSize * FEED_COMPOSITION.cf);

            // 找到看过同样视频的相似用户
            const similarUsers = await prisma.watchHistory.findMany({
                where: {
                    videoId: { in: watchedIds.slice(0, 20) },
                    userId: { not: userId },
                    completed: true,
                },
                select: { userId: true },
                distinct: ["userId"],
                take: 50,
            });

            if (similarUsers.length > 0) {
                const similarUserIds = similarUsers.map((u) => u.userId);
                const excludeIds = [
                    ...watchedIds,
                    ...hotRanked.map((v) => v.id),
                    ...tagMatched.map((v) => v.id),
                ];

                // 相似用户喜欢但当前用户没看过的视频
                const cfResults = await prisma.watchHistory.findMany({
                    where: {
                        userId: { in: similarUserIds },
                        videoId: { notIn: excludeIds },
                        completed: true,
                    },
                    select: {
                        video: {
                            select: {
                                id: true, title: true, coverUrl: true, videoUrl: true,
                                duration: true, views: true, likes: true, commentCount: true,
                                tags: true, contentType: true, createdAt: true,
                                moderationStatus: true,
                                creator: { select: { id: true, username: true, avatarUrl: true } },
                            },
                        },
                    },
                    distinct: ["videoId"],
                    take: cfCount * 3,
                });

                cfVideos = cfResults
                    .map((r) => r.video)
                    .filter((v) => v.moderationStatus === "approved")
                    .map((v) => ({
                        ...v,
                        _hotness: calculateHotness(v.views, v.likes, v.commentCount, v.createdAt),
                        _source: "cf" as const,
                    }))
                    .slice(0, cfCount);
            }
        }

        // ========== 4. 探索发现 (随机) ==========
        const exploreCount = Math.ceil(pageSize * FEED_COMPOSITION.explore);
        const totalVideos = await prisma.video.count({
            where: { moderationStatus: "approved" },
        });
        const randomSkip = Math.max(0, Math.floor(Math.random() * Math.max(totalVideos - exploreCount, 1)));

        const existingIds = [
            ...hotRanked.map((v) => v.id),
            ...tagMatched.map((v) => v.id),
            ...cfVideos.map((v) => v.id),
            ...watchedIds,
        ];

        const exploreVideos = await prisma.video.findMany({
            where: {
                id: { notIn: existingIds },
                moderationStatus: "approved",
                ...(contentType !== "all" ? { contentType } : {}),
            },
            skip: randomSkip,
            take: exploreCount,
            select: {
                id: true, title: true, coverUrl: true, videoUrl: true,
                duration: true, views: true, likes: true, commentCount: true,
                tags: true, contentType: true, createdAt: true,
                creator: { select: { id: true, username: true, avatarUrl: true } },
            },
        });

        const exploreRanked = exploreVideos.map((v) => ({
            ...v,
            _hotness: 0,
            _source: "explore" as const,
        }));

        // ========== 合并+混排 ==========
        const allResults = [...hotRanked, ...tagMatched, ...cfVideos, ...exploreRanked];

        // 混排: 不按来源严格分区, 而是交叉排列以增加多样性
        const feed = shuffle(allResults).slice(skip, skip + pageSize);

        // 记录推荐日志 (异步, 不阻塞响应)
        if (userId && feed.length > 0) {
            const logs = feed.map((item, idx) => ({
                userId,
                videoId: item.id,
                position: skip + idx,
                source: item._source,
            }));
            prisma.recommendationLog
                .createMany({ data: logs })
                .catch((err) => console.error("[RecommendationLog] Error:", err));
        }

        // 清理内部字段
        const cleanFeed = feed.map(({ _hotness, _source, ...rest }) => ({
            ...rest,
            recommendSource: _source,
        }));

        return reply.send({
            items: cleanFeed,
            page,
            pageSize,
            hasMore: allResults.length > skip + pageSize,
        });
    } catch (err: any) {
        console.error("[Recommendation] Feed error:", err);
        return reply.status(500).send({ error: "推荐获取失败", message: err?.message });
    }
});

// ============== 热门/趋势 API ==============

/**
 * GET /recommendation/trending
 * 获取趋势内容 (不需要登录)
 */
app.get<{ Querystring: { hours?: number; limit?: number; contentType?: string } }>(
    "/recommendation/trending",
    async (req, reply) => {
        const { hours = 24, limit = 20, contentType = "video" } = req.query;
        const since = new Date(Date.now() - hours * 60 * 60 * 1000);

        try {
            const trending = await prisma.video.findMany({
                where: {
                    createdAt: { gte: since },
                    moderationStatus: "approved",
                    ...(contentType !== "all" ? { contentType } : {}),
                },
                orderBy: [{ views: "desc" }, { likes: "desc" }],
                take: limit * 2,
                select: {
                    id: true, title: true, coverUrl: true, videoUrl: true,
                    duration: true, views: true, likes: true, commentCount: true,
                    tags: true, contentType: true, createdAt: true,
                    creator: { select: { id: true, username: true, avatarUrl: true } },
                },
            });

            const ranked = trending
                .map((v) => ({
                    ...v,
                    hotness: calculateHotness(v.views, v.likes, v.commentCount, v.createdAt),
                }))
                .sort((a, b) => b.hotness - a.hotness)
                .slice(0, limit);

            return reply.send({ items: ranked, period: `${hours}h` });
        } catch (err: any) {
            return reply.status(500).send({ error: "趋势获取失败" });
        }
    }
);

// ============== 用户兴趣管理 ==============

/**
 * POST /recommendation/interest
 * 更新用户兴趣 (观看/点赞/搜索时调用)
 */
app.post<{
    Body: { userId: string; tags: string[]; source?: string; weight?: number };
}>("/recommendation/interest", async (req, reply) => {
    const { userId, tags, source = "watch", weight = 1.0 } = req.body || {};
    if (!userId || !tags?.length) {
        return reply.status(400).send({ error: "缺少 userId 或 tags" });
    }

    try {
        // 批量 upsert 兴趣标签
        const updates = tags.map((tag) =>
            prisma.userInterest.upsert({
                where: { userId_tag: { userId, tag } },
                create: { userId, tag, score: weight, source },
                update: {
                    // 递增分数 (新行为增加权重)
                    score: { increment: weight },
                    source,
                },
            })
        );
        await Promise.all(updates);

        return reply.send({ success: true, updated: tags.length });
    } catch (err: any) {
        return reply.status(500).send({ error: "兴趣更新失败" });
    }
});

/**
 * POST /recommendation/feedback
 * 记录用户对推荐的反馈 (点击/观看/完成)
 */
app.post<{
    Body: { userId: string; videoId: string; action: "click" | "watch" | "complete"; watchTime?: number };
}>("/recommendation/feedback", async (req, reply) => {
    const { userId, videoId, action, watchTime = 0 } = req.body || {};
    if (!userId || !videoId) {
        return reply.status(400).send({ error: "缺少参数" });
    }

    try {
        // 更新最近的推荐日志
        const recentLog = await prisma.recommendationLog.findFirst({
            where: { userId, videoId },
            orderBy: { createdAt: "desc" },
        });

        if (recentLog) {
            await prisma.recommendationLog.update({
                where: { id: recentLog.id },
                data: {
                    clicked: action === "click" || recentLog.clicked,
                    watchTime: action === "watch" ? watchTime : recentLog.watchTime,
                    completed: action === "complete" || recentLog.completed,
                },
            });
        }

        // 如果用户完成了观看, 增加相关标签的兴趣权重
        if (action === "complete" || (action === "watch" && watchTime > 60)) {
            const video = await prisma.video.findUnique({
                where: { id: videoId },
                select: { tags: true },
            });

            if (video?.tags?.length) {
                const weight = action === "complete" ? 2.0 : 1.0;
                const updates = video.tags.map((tag) =>
                    prisma.userInterest.upsert({
                        where: { userId_tag: { userId, tag } },
                        create: { userId, tag, score: weight, source: "watch" },
                        update: { score: { increment: weight } },
                    })
                );
                await Promise.all(updates);
            }
        }

        return reply.send({ success: true });
    } catch (err: any) {
        return reply.status(500).send({ error: "反馈记录失败" });
    }
});

// ============== 相似内容 API ==============

/**
 * GET /recommendation/similar/:videoId
 * 基于标签的相似内容推荐
 */
app.get<{ Params: { videoId: string }; Querystring: { limit?: number } }>(
    "/recommendation/similar/:videoId",
    async (req, reply) => {
        const { videoId } = req.params;
        const { limit = 10 } = req.query;

        try {
            const video = await prisma.video.findUnique({
                where: { id: videoId },
                select: { tags: true, creatorId: true, contentType: true },
            });

            if (!video) {
                return reply.status(404).send({ error: "视频不存在" });
            }

            if (!video.tags?.length) {
                // 无标签: 返回同创作者的其他内容
                const sameCreator = await prisma.video.findMany({
                    where: {
                        creatorId: video.creatorId,
                        id: { not: videoId },
                        moderationStatus: "approved",
                    },
                    take: limit,
                    orderBy: { views: "desc" },
                    select: {
                        id: true, title: true, coverUrl: true, videoUrl: true,
                        duration: true, views: true, likes: true, tags: true,
                        contentType: true, createdAt: true,
                        creator: { select: { id: true, username: true, avatarUrl: true } },
                    },
                });
                return reply.send({ items: sameCreator });
            }

            // 标签匹配
            const similar = await prisma.video.findMany({
                where: {
                    id: { not: videoId },
                    tags: { hasSome: video.tags },
                    moderationStatus: "approved",
                },
                take: limit * 3,
                select: {
                    id: true, title: true, coverUrl: true, videoUrl: true,
                    duration: true, views: true, likes: true, tags: true,
                    contentType: true, createdAt: true,
                    creator: { select: { id: true, username: true, avatarUrl: true } },
                },
            });

            // 按标签重叠度排序
            const ranked = similar
                .map((v) => ({
                    ...v,
                    similarity: tagSimilarity(video.tags, v.tags),
                }))
                .sort((a, b) => b.similarity - a.similarity)
                .slice(0, limit);

            return reply.send({ items: ranked });
        } catch (err: any) {
            return reply.status(500).send({ error: "相似推荐失败" });
        }
    }
);

// ============== 兴趣衰减定时任务 ==============

/**
 * POST /recommendation/decay
 * 对所有用户兴趣分数进行时间衰减 (建议每天执行一次)
 */
app.post("/recommendation/decay", async (_req, reply) => {
    try {
        // 批量衰减所有兴趣分数
        await prisma.$executeRaw`
            UPDATE "UserInterest"
            SET score = score * ${INTEREST_DECAY_FACTOR}
            WHERE score > 0.01
        `;

        // 清理分数过低的记录
        const deleted = await prisma.userInterest.deleteMany({
            where: { score: { lt: 0.01 } },
        });

        // 清理超过 30 天的推荐日志
        const logDeleted = await prisma.recommendationLog.deleteMany({
            where: { createdAt: { lt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } },
        });

        return reply.send({
            success: true,
            decayFactor: INTEREST_DECAY_FACTOR,
            prunedInterests: deleted.count,
            prunedLogs: logDeleted.count,
        });
    } catch (err: any) {
        return reply.status(500).send({ error: "衰减失败" });
    }
});

// ============== 启动 ==============

const start = async () => {
    try {
        await app.listen({ port: PORT, host: "0.0.0.0" });
        console.log(`🎯 Recommendation service running on port ${PORT}`);
    } catch (err) {
        app.log.error(err);
        process.exit(1);
    }
};

start();
