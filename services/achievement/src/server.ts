// FILE: /video-platform/services/achievement/src/server.ts
/**
 * SBT Achievement Service - 成就系统服务
 * Refactored to use Prisma & PostgreSQL
 */

import Fastify from "fastify";
import jwt from "@fastify/jwt";
import { v4 as uuidv4 } from "uuid";
import { SporeClient } from "@video-platform/shared/web3/spore";
import { PrismaClient, Prisma } from "@video-platform/database";
import { registerSecurityPlugins } from "@video-platform/shared/security/index";
import { register } from "@video-platform/shared/monitoring";

const prisma = new PrismaClient();

const app = Fastify({ logger: true });
const JWT_SECRET = process.env.JWT_SECRET || "";
if (!JWT_SECRET || JWT_SECRET.length < 32) throw new Error("JWT_SECRET 未配置或长度不足");

// Security: Helmet, CORS, Rate Limiting, TraceId
await registerSecurityPlugins(app, { rateLimit: { max: 100, timeWindow: "1 minute" } });

app.register(jwt, { secret: JWT_SECRET });

const sporeClient = new SporeClient();

// Safe JSON parse helper - returns fallback on invalid JSON
function safeJsonParse(str: string | null | undefined, fallback: any = {}): any {
    try { return JSON.parse(str || JSON.stringify(fallback)); } catch { return fallback; }
}

// ============== 成就定义 (作为初始数据种子) ==============

const ACHIEVEMENTS_SEED = [
    // === 创作者成就 ===
    {
        slug: 'creator-first-video',
        name: '初露锋芒',
        description: '发布第一个视频',
        icon: '🎬',
        category: 'creator',
        tier: 'bronze',
        condition: { type: 'totalVideos', value: 1 },
        benefits: ['创作者认证标识'],
        pointsReward: 100,
    },
    {
        slug: 'creator-10-videos',
        name: '内容产出者',
        description: '发布 10 个视频',
        icon: '📹',
        category: 'creator',
        tier: 'silver',
        condition: { type: 'totalVideos', value: 10 },
        benefits: ['首页推荐权重 +5%'],
        pointsReward: 500,
    },
    {
        slug: 'creator-100-videos',
        name: '高产创作者',
        description: '发布 100 个视频',
        icon: '🎥',
        category: 'creator',
        tier: 'gold',
        condition: { type: 'totalVideos', value: 100 },
        benefits: ['首页推荐权重 +15%', '专属创作者徽章'],
        pointsReward: 2000,
    },
    {
        slug: 'creator-1k-views',
        name: '小有名气',
        description: '累计播放量达到 1,000',
        icon: '👀',
        category: 'creator',
        tier: 'bronze',
        condition: { type: 'totalViews', value: 1000 },
        benefits: ['观众分析面板'],
        pointsReward: 200,
    },
    {
        slug: 'creator-100k-views',
        name: '人气创作者',
        description: '累计播放量达到 100,000',
        icon: '🔥',
        category: 'creator',
        tier: 'gold',
        condition: { type: 'totalViews', value: 100000 },
        benefits: ['首页推荐位 x1', 'VIP 客服通道'],
        pointsReward: 3000,
    },
    {
        slug: 'creator-1m-views',
        name: '百万播放',
        description: '累计播放量达到 1,000,000',
        icon: '💎',
        category: 'creator',
        tier: 'diamond',
        condition: { type: 'totalViews', value: 1000000 },
        benefits: ['平台年度分成 +5%', '专属推广活动'],
        pointsReward: 10000,
    },
    {
        slug: 'creator-1k-tips',
        name: '受人喜爱',
        description: '累计收到 1,000 积分打赏',
        icon: '💰',
        category: 'creator',
        tier: 'silver',
        condition: { type: 'totalTipsReceived', value: 1000 },
        benefits: ['打赏提现费率 -1%'],
        pointsReward: 500,
    },
    {
        slug: 'creator-streamer',
        name: '直播达人',
        description: '完成 10 次直播',
        icon: '📡',
        category: 'creator',
        tier: 'gold',
        condition: { type: 'liveStreamCount', value: 10 },
        benefits: ['直播推流码率提升', '礼物特效优先展示'],
        pointsReward: 1500,
    },

    // === 观众成就 ===
    {
        slug: 'viewer-first-watch',
        name: '首次观看',
        description: '观看第一个视频',
        icon: '👁️',
        category: 'viewer',
        tier: 'bronze',
        condition: { type: 'totalWatchTime', value: 1 },
        benefits: ['新手礼包 50 积分'],
        pointsReward: 50,
    },
    {
        slug: 'viewer-100-hours',
        name: '忠实观众',
        description: '累计观看 100 小时',
        icon: '⏰',
        category: 'viewer',
        tier: 'silver',
        condition: { type: 'totalWatchTime', value: 6000 },
        benefits: ['观看积分奖励 +10%'],
        pointsReward: 300,
    },
    {
        slug: 'viewer-1000-hours',
        name: '资深观众',
        description: '累计观看 1,000 小时',
        icon: '🎖️',
        category: 'viewer',
        tier: 'platinum',
        condition: { type: 'totalWatchTime', value: 60000 },
        benefits: ['专属观众徽章', '弹幕优先显示'],
        pointsReward: 2000,
    },
    {
        slug: 'viewer-generous',
        name: '慷慨解囊',
        description: '累计打赏 10,000 积分',
        icon: '🎁',
        category: 'viewer',
        tier: 'gold',
        condition: { type: 'totalTipsSent', value: 10000 },
        benefits: ['打赏特效升级', '专属粉丝徽章'],
        pointsReward: 1000,
    },

    // === 收藏家成就 ===
    {
        slug: 'collector-first',
        name: '初级收藏家',
        description: '收藏第一个视频 NFT',
        icon: '🎨',
        category: 'collector',
        tier: 'bronze',
        condition: { type: 'totalCollections', value: 1 },
        benefits: ['收藏家标识'],
        pointsReward: 100,
    },
    {
        slug: 'collector-10',
        name: '资深收藏家',
        description: '收藏 10 个视频 NFT',
        icon: '🖼️',
        category: 'collector',
        tier: 'silver',
        condition: { type: 'totalCollections', value: 10 },
        benefits: ['NFT 购买折扣 5%'],
        pointsReward: 500,
    },
    {
        slug: 'collector-50',
        name: '顶级收藏家',
        description: '收藏 50 个视频 NFT',
        icon: '👑',
        category: 'collector',
        tier: 'platinum',
        condition: { type: 'totalCollections', value: 50 },
        benefits: ['NFT 购买折扣 15%', '限量版优先购买权'],
        pointsReward: 3000,
    },
    {
        slug: 'collector-nft-minter',
        name: 'NFT 发行者',
        description: '发行 5 个视频收藏版',
        icon: '💫',
        category: 'collector',
        tier: 'gold',
        condition: { type: 'nftMintCount', value: 5 },
        benefits: ['NFT 版税上限提升至 30%'],
        pointsReward: 2000,
    },

    // === 社区成就 ===
    {
        slug: 'community-social',
        name: '社交达人',
        description: '分享 100 次内容',
        icon: '🔗',
        category: 'community',
        tier: 'silver',
        condition: { type: 'totalShares', value: 100 },
        benefits: ['分享奖励 +20%'],
        pointsReward: 500,
    },
    {
        slug: 'community-referral',
        name: '推广大使',
        description: '邀请 50 位新用户',
        icon: '🤝',
        category: 'community',
        tier: 'gold',
        condition: { type: 'totalReferrals', value: 50 },
        benefits: ['邀请奖励 +50%', '专属推广链接'],
        pointsReward: 2000,
    },
    {
        slug: 'community-loyal',
        name: '忠诚用户',
        description: '连续登录 30 天',
        icon: '📅',
        category: 'community',
        tier: 'silver',
        condition: { type: 'consecutiveLoginDays', value: 30 },
        benefits: ['每日签到奖励 x2'],
        pointsReward: 600,
    },
    {
        slug: 'community-year-loyal',
        name: '周年纪念',
        description: '连续登录 365 天',
        icon: '🏆',
        category: 'community',
        tier: 'diamond',
        condition: { type: 'consecutiveLoginDays', value: 365 },
        benefits: ['专属周年徽章', '年度积分奖励 10,000'],
        pointsReward: 10000,
    },

    // === 特殊成就 ===
    {
        slug: 'special-early-bird',
        name: '早期用户',
        description: '平台早期注册用户',
        icon: '🐦',
        category: 'special',
        tier: 'gold',
        condition: { type: 'special', value: 0 },
        benefits: ['终身 VIP 标识', '创始会员权益'],
        pointsReward: 5000,
    },
    {
        slug: 'special-beta-tester',
        name: 'Beta 测试者',
        description: '参与 Beta 测试',
        icon: '🧪',
        category: 'special',
        tier: 'silver',
        condition: { type: 'special', value: 0 },
        benefits: ['Beta 特权标识'],
        pointsReward: 1000,
    },
];

// Initialize DB with seed data
async function seedAchievements() {
    console.log("Seeding achievements...");
    for (const seed of ACHIEVEMENTS_SEED) {
        await prisma.achievement.upsert({
            where: { slug: seed.slug },
            update: {
                name: seed.name,
                description: seed.description,
                icon: seed.icon,
                category: seed.category,
                tier: seed.tier,
                condition: JSON.stringify(seed.condition),
                pointsReward: seed.pointsReward,
                benefits: JSON.stringify(seed.benefits) // store as JSON string
            },
            create: {
                slug: seed.slug,
                name: seed.name,
                description: seed.description,
                icon: seed.icon,
                category: seed.category,
                tier: seed.tier,
                condition: JSON.stringify(seed.condition),
                pointsReward: seed.pointsReward,
                benefits: JSON.stringify(seed.benefits)
            }
        });
    }
    console.log("Achievements seeded.");
}

// Ensure UserStat exists
async function ensureUserStat(userId: string) {
    const stat = await prisma.userStat.findUnique({ where: { userId } });
    if (!stat) {
        return await prisma.userStat.create({
            data: { userId }
        });
    }
    return stat;
}

// JWT 验证
app.addHook("onRequest", async (req, reply) => {
    if (req.url.startsWith("/health") || req.url.startsWith("/metrics") || req.url.startsWith("/achievement/list") || req.url.startsWith("/internal/")) return;
    try {
        await req.jwtVerify();
    } catch (e) {
        return reply.status(401).send({ error: "未授权", code: "unauthorized" });
    }
});

// ============== 健康检查 ==============

app.get("/health", async () => ({ status: "ok", service: "achievement" }));
app.get("/metrics", async (_req: any, reply: any) => {
    reply.header("Content-Type", register.contentType);
    return reply.send(await register.metrics());
});

// ============== 成就列表 ==============

app.get("/achievement/list", async (req, reply) => {
    const query = req.query as { category?: string };

    const where: any = {};
    if (query.category) where.category = query.category;

    const achievements = await prisma.achievement.findMany({ where });

    return reply.send({
        achievements: achievements.map(a => ({
            ...a,
            condition: safeJsonParse(a.condition, {}),
            benefits: safeJsonParse(a.benefits, [])
        })),
        categories: ['creator', 'viewer', 'collector', 'community', 'special'],
        totalCount: achievements.length,
    });
});

app.get("/achievement/:id", async (req, reply) => {
    const params = req.params as { id: string };
    const achievement = await prisma.achievement.findUnique({ where: { id: params.id } });

    if (!achievement) {
        return reply.status(404).send({ error: "成就不存在", code: "not_found" });
    }

    return reply.send({
        achievement: {
            ...achievement,
            condition: safeJsonParse(achievement.condition, {}),
            benefits: safeJsonParse(achievement.benefits, [])
        }
    });
});

// ============== 用户成就 ==============

app.get("/achievement/my", async (req, reply) => {
    const user = req.user as any;
    const userId = user?.sub || "";

    const userAchievements = await prisma.userAchievement.findMany({
        where: { userId },
        include: { achievement: true }
    });

    // 统计
    const stats = {
        total: ACHIEVEMENTS_SEED.length, // approximation
        unlocked: userAchievements.length,
        totalPoints: userAchievements.reduce((sum, ua) => sum + (ua.achievement.pointsReward || 0), 0),
    };

    return reply.send({
        achievements: userAchievements.map(ua => ({
            ...ua,
            achievement: {
                ...ua.achievement,
                condition: safeJsonParse(ua.achievement.condition, {}),
                benefits: safeJsonParse(ua.achievement.benefits, [])
            }
        })),
        stats,
    });
});

app.get("/achievement/progress", async (req, reply) => {
    const user = req.user as any;
    const userId = user?.sub || "";

    const userStat = await ensureUserStat(userId);
    const achievements = await prisma.achievement.findMany();
    const unlocked = await prisma.userAchievement.findMany({
        where: { userId },
        select: { achievementId: true }
    });
    const unlockedIds = new Set(unlocked.map(u => u.achievementId));

    const progress = achievements
        .filter(a => !unlockedIds.has(a.id))
        .map(a => {
            const condition = safeJsonParse(a.condition, {});
            if (condition.type === 'special') return null;

            const currentValue = (userStat as any)[condition.type] || 0;
            const targetValue = condition.value || 1;
            // Handle Decimal/Int types
            const currentNum = typeof currentValue === 'object' ? Number(currentValue) : Number(currentValue);

            const percent = Math.min(100, Math.round((currentNum / targetValue) * 100));

            return {
                achievementId: a.id,
                name: a.name,
                icon: a.icon,
                tier: a.tier,
                category: a.category,
                current: currentNum,
                target: targetValue,
                percent,
                remaining: Math.max(0, targetValue - currentNum),
            };
        })
        .filter(Boolean)
        .sort((a: any, b: any) => b.percent - a.percent)
        .slice(0, 10);

    return reply.send({
        progress,
        userStats: userStat,
    });
});

/**
 * 检测并解锁成就
 */
app.post("/achievement/check", async (req, reply) => {
    const user = req.user as any;
    const userId = user?.sub || "";
    const userAddress = user?.ckb || "";

    const userStat = await ensureUserStat(userId);
    const achievements = await prisma.achievement.findMany();
    const existing = await prisma.userAchievement.findMany({ where: { userId } });
    const unlockedIds = new Set(existing.map(u => u.achievementId));

    const newlyUnlocked: any[] = [];

    for (const achievement of achievements) {
        if (unlockedIds.has(achievement.id)) continue;
        const condition = safeJsonParse(achievement.condition, {});
        if (condition.type === 'special' || !condition.type) continue;

        const currentValue = (userStat as any)[condition.type];
        const currentNum = typeof currentValue === 'object' ? Number(currentValue) : Number(currentValue || 0);

        if (currentNum >= condition.value) {
            // Unlock
            const ua = await prisma.userAchievement.create({
                data: {
                    userId,
                    achievementId: achievement.id,
                    unlockedAt: new Date(),
                }
            });

            // Mint SBT (Async)
            if (userAddress) {
                sporeClient.mintCreatorBadgeSpore(
                    `sbt-${achievement.slug}`,
                    `${achievement.name}: ${achievement.description}`,
                    userAddress
                ).then(async (res) => {
                    await prisma.userAchievement.update({
                        where: { id: ua.id },
                        data: { sporeId: res.sporeId, txHash: res.txHash }
                    });
                }).catch(err => console.error("SBT Mint Error", err));
            }

            // Grant Points (Async - call payment service or update User.points directly if linked)
            // For now, assume User model has points
            await prisma.user.update({
                where: { id: userId },
                data: { points: { increment: achievement.pointsReward } }
            });

            newlyUnlocked.push({
                ...ua,
                achievement: {
                    ...achievement,
                    condition,
                    benefits: safeJsonParse(achievement.benefits, [])
                }
            });
        }
    }

    return reply.send({
        newlyUnlocked,
        count: newlyUnlocked.length,
    });
});

/**
 * 更新用户统计 (Internal)
 */
app.post("/achievement/stats/update", async (req, reply) => {
    const body = req.body as {
        userId: string;
        field: string;
        value?: number;
        increment?: number;
    };

    if (!body.userId || !body.field) {
        return reply.status(400).send({ error: "Missing parameters", code: "bad_request" });
    }

    // List of allowed fields to prevent injection
    const ALLOWED_FIELDS = [
        'totalVideos', 'totalViews', 'totalLikes', 'totalTipsReceived',
        'totalSubscribers', 'totalWatchTime', 'totalTipsSent', 'totalCollections',
        'totalComments', 'totalShares', 'totalReferrals', 'consecutiveLoginDays',
        'liveStreamCount', 'nftMintCount'
    ];
    if (!ALLOWED_FIELDS.includes(body.field)) {
        return reply.status(400).send({ error: "Invalid field", code: "invalid_field" });
    }

    const updateData: any = {};
    if (body.value !== undefined) {
        updateData[body.field] = body.value;
    } else if (body.increment !== undefined) {
        updateData[body.field] = { increment: body.increment };
    }

    const stat = await prisma.userStat.upsert({
        where: { userId: body.userId },
        update: updateData,
        create: {
            userId: body.userId,
            [body.field]: body.value || body.increment || 0
        }
    });

    return reply.send({ ok: true, stats: stat });
});

app.get("/achievement/stats/:userId", async (req, reply) => {
    const params = req.params as { userId: string };
    const stat = await ensureUserStat(params.userId);
    return reply.send({ stats: stat });
});

// ============== 启动服务 ==============

const PORT = Number(process.env.ACHIEVEMENT_PORT || 8097);
app.listen({ port: PORT, host: "0.0.0.0" }).then(async () => {
    console.log(`Achievement Service started on port ${PORT}`);
    await seedAchievements();
});

export { app };
