/**
 * Engagement Service - 观众激励系统
 * 
 * 功能:
 * - 每日任务 (签到、观看、评论)
 * - 粉丝等级
 * - 直播奖励
 * - NFT 掉落
 * - 防刷机制
 */

import Fastify from "fastify";
import { PrismaClient } from "@video-platform/database";
import { registerSecurityPlugins } from "@video-platform/shared/security/index";
import { register } from "@video-platform/shared/monitoring";

const app = Fastify({ logger: true });
const prisma = new PrismaClient();

const PORT = parseInt(process.env.ENGAGEMENT_PORT || "8104");

// Security: Helmet, CORS, Rate Limiting, TraceId
await registerSecurityPlugins(app, {
    rateLimit: { max: 100, timeWindow: "1 minute" },
});

// ============== 常量配置 ==============

const BASE_CHECKIN_POINTS = 10;
const MAX_STREAK_MULTIPLIER = 7;

// 每日任务配置
const DAILY_TASKS = [
    { type: "checkin", name: "每日签到", description: "每日首次登录签到", points: 10, maxDaily: 1, requirement: 1 },
    { type: "watch_videos", name: "观看视频", description: "观看3个视频(每个≥1分钟)", points: 30, maxDaily: 1, requirement: 3 },
    { type: "comment", name: "发表评论", description: "发表1条有效评论", points: 20, maxDaily: 1, requirement: 1 },
    { type: "share", name: "分享视频", description: "分享视频给好友", points: 50, maxDaily: 3, requirement: 1 },
    { type: "live_watch", name: "观看直播", description: "累计观看直播10分钟", points: 40, maxDaily: 1, requirement: 10 },
];

// 防刷限制
const DAILY_LIMITS: Record<string, number> = {
    watch: 50,      // 每日最多记录50次观看
    comment: 20,    // 每日最多20条评论
    share: 10,      // 每日最多10次分享
    tip: 100,       // 每日最多100次打赏
    live_checkin: 10, // 每日最多进入10个直播间签到
};

// 粉丝等级阈值
const FAN_LEVEL_THRESHOLDS = [0, 100, 500, 2000, 10000];

// ============== 工具函数 ==============

function getToday(): Date {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

function getYesterday(): Date {
    const today = getToday();
    return new Date(today.getTime() - 24 * 60 * 60 * 1000);
}

function calculateFanLevel(points: number): number {
    for (let i = FAN_LEVEL_THRESHOLDS.length - 1; i >= 0; i--) {
        if (points >= FAN_LEVEL_THRESHOLDS[i]) return i + 1;
    }
    return 1;
}

// ============== 防刷检查 ==============

async function checkRateLimit(userId: string, actionType: string, ip?: string): Promise<{ allowed: boolean; remaining: number }> {
    const today = getToday();
    const limit = DAILY_LIMITS[actionType] || 100;

    let record = await prisma.userDailyLimit.findUnique({
        where: { userId_date_actionType: { userId, date: today, actionType } },
    });

    if (!record) {
        record = await prisma.userDailyLimit.create({
            data: { userId, date: today, actionType, count: 0, lastIp: ip },
        });
    }

    if (record.count >= limit) {
        return { allowed: false, remaining: 0 };
    }

    // 更新计数
    await prisma.userDailyLimit.update({
        where: { id: record.id },
        data: { count: record.count + 1, lastIp: ip },
    });

    return { allowed: true, remaining: limit - record.count - 1 };
}

// ============== 健康检查 ==============

app.get("/health", async () => ({ status: "ok", service: "engagement" }));
app.get("/metrics", async (_req: any, reply: any) => {
    reply.header("Content-Type", register.contentType);
    return reply.send(await register.metrics());
});

// ============== 签到 API ==============

/**
 * POST /checkin
 * 每日签到，连续签到有加成
 */
app.post<{ Body: { userId: string } }>("/engagement/checkin", async (req, reply) => {
    const { userId } = req.body || {};
    if (!userId) return reply.status(400).send({ error: "缺少 userId" });

    try {
        // 首先检查用户是否存在
        const user = await prisma.user.findUnique({ where: { id: userId } });
        if (!user) {
            return reply.status(404).send({ error: "用户不存在", code: "USER_NOT_FOUND" });
        }

        const today = getToday();

        // 检查是否已签到
        const existing = await prisma.checkinRecord.findUnique({
            where: { userId_date: { userId, date: today } },
        });
        if (existing) {
            return reply.status(400).send({ error: "今日已签到", streak: existing.streak, points: existing.points });
        }

        // 检查昨日签到 (计算连续天数)
        const yesterday = getYesterday();
        const lastCheckin = await prisma.checkinRecord.findUnique({
            where: { userId_date: { userId, date: yesterday } },
        });

        const streak = lastCheckin ? Math.min(lastCheckin.streak + 1, MAX_STREAK_MULTIPLIER) : 1;
        const multiplier = Math.min(streak, MAX_STREAK_MULTIPLIER);
        const points = Math.floor(BASE_CHECKIN_POINTS * multiplier);

        // 创建签到记录
        const record = await prisma.checkinRecord.create({
            data: { userId, date: today, streak, bonusMultiplier: multiplier, points },
        });

        // 更新任务进度
        await prisma.userTaskProgress.upsert({
            where: { userId_taskType_date: { userId, taskType: "checkin", date: today } },
            create: { userId, taskType: "checkin", date: today, progress: 1, completed: true },
            update: { progress: 1, completed: true },
        });

        // 增加用户积分
        await prisma.user.update({
            where: { id: userId },
            data: { points: { increment: points } },
        });

        return reply.send({
            success: true,
            streak,
            multiplier,
            points,
            message: streak > 1 ? `连续签到 ${streak} 天! 获得 ${points} 积分 (${multiplier}x 加成)` : `签到成功! 获得 ${points} 积分`,
        });
    } catch (err: any) {
        console.error("[Checkin] Error:", err);
        return reply.status(500).send({ error: "签到失败", message: err?.message });
    }
});

// ============== 任务 API ==============

/**
 * GET /tasks/daily
 * 获取今日任务列表和进度
 */
app.get<{ Querystring: { userId: string } }>("/engagement/tasks/daily", async (req, reply) => {
    const { userId } = req.query;
    if (!userId) return reply.status(400).send({ error: "缺少 userId" });

    const today = getToday();

    // 获取用户今日进度
    const progresses = await prisma.userTaskProgress.findMany({
        where: { userId, date: today },
    });
    const progressMap = new Map(progresses.map(p => [p.taskType, p]));

    // 获取签到信息
    const checkin = await prisma.checkinRecord.findUnique({
        where: { userId_date: { userId, date: today } },
    });

    const tasks = DAILY_TASKS.map(task => {
        const progress = progressMap.get(task.type);
        return {
            ...task,
            progress: progress?.progress || 0,
            completed: progress?.completed || false,
            rewardClaimed: progress?.rewardClaimed || false,
        };
    });

    return reply.send({
        tasks,
        streak: checkin?.streak || 0,
        todayCheckedIn: !!checkin,
    });
});

/**
 * POST /tasks/progress
 * 报告任务进度 (观看视频、评论等)
 */
app.post<{ Body: { userId: string; taskType: string; increment?: number } }>("/engagement/tasks/progress", async (req, reply) => {
    const { userId, taskType, increment = 1 } = req.body || {};
    if (!userId || !taskType) return reply.status(400).send({ error: "缺少参数" });

    const task = DAILY_TASKS.find(t => t.type === taskType);
    if (!task) return reply.status(400).send({ error: "无效任务类型" });

    // 防刷检查
    const rateCheck = await checkRateLimit(userId, taskType, req.ip);
    if (!rateCheck.allowed) {
        return reply.status(429).send({ error: "今日操作次数已达上限", remaining: 0 });
    }

    const today = getToday();

    // 更新进度
    const progress = await prisma.userTaskProgress.upsert({
        where: { userId_taskType_date: { userId, taskType, date: today } },
        create: { userId, taskType, date: today, progress: increment },
        update: { progress: { increment } },
    });

    // 检查是否完成
    const completed = progress.progress >= task.requirement;
    if (completed && !progress.completed) {
        await prisma.userTaskProgress.update({
            where: { id: progress.id },
            data: { completed: true },
        });
    }

    return reply.send({
        taskType,
        progress: progress.progress,
        requirement: task.requirement,
        completed,
        remaining: rateCheck.remaining,
    });
});

/**
 * POST /tasks/claim
 * 领取任务奖励
 */
app.post<{ Body: { userId: string; taskType: string } }>("/engagement/tasks/claim", async (req, reply) => {
    const { userId, taskType } = req.body || {};
    if (!userId || !taskType) return reply.status(400).send({ error: "缺少参数" });

    const task = DAILY_TASKS.find(t => t.type === taskType);
    if (!task) return reply.status(400).send({ error: "无效任务类型" });

    const today = getToday();
    const progress = await prisma.userTaskProgress.findUnique({
        where: { userId_taskType_date: { userId, taskType, date: today } },
    });

    if (!progress || !progress.completed) {
        return reply.status(400).send({ error: "任务未完成" });
    }
    if (progress.rewardClaimed) {
        return reply.status(400).send({ error: "奖励已领取" });
    }

    // 标记已领取
    await prisma.userTaskProgress.update({
        where: { id: progress.id },
        data: { rewardClaimed: true },
    });

    // 增加积分
    await prisma.user.update({
        where: { id: userId },
        data: { points: { increment: task.points } },
    });

    return reply.send({
        success: true,
        points: task.points,
        message: `获得 ${task.points} 积分`,
    });
});

// ============== 粉丝等级 API ==============

/**
 * GET /fans/level/:creatorId
 * 获取对特定创作者的粉丝等级
 */
app.get<{ Params: { creatorId: string }; Querystring: { userId: string } }>("/fans/level/:creatorId", async (req, reply) => {
    const { creatorId } = req.params;
    const { userId } = req.query;
    if (!userId) return reply.status(400).send({ error: "缺少 userId" });

    let fanLevel = await prisma.fanLevel.findUnique({
        where: { userId_creatorId: { userId, creatorId } },
    });

    if (!fanLevel) {
        fanLevel = { id: "", userId, creatorId, totalPoints: 0, level: 1, watchTime: 0, tipAmount: 0, interactions: 0, createdAt: new Date(), updatedAt: new Date() };
    }

    const nextLevelThreshold = FAN_LEVEL_THRESHOLDS[fanLevel.level] || Infinity;
    const progress = fanLevel.level < 5 ? (fanLevel.totalPoints / nextLevelThreshold) * 100 : 100;

    return reply.send({
        level: fanLevel.level,
        totalPoints: fanLevel.totalPoints,
        watchTime: fanLevel.watchTime,
        tipAmount: fanLevel.tipAmount,
        interactions: fanLevel.interactions,
        nextLevelThreshold,
        progress: Math.min(progress, 100),
        levelName: ["", "路人粉", "铁粉", "真爱粉", "守护者", "舰长"][fanLevel.level],
    });
});

/**
 * POST /fans/contribute
 * 记录粉丝贡献 (观看/打赏/互动)
 */
app.post<{ Body: { userId: string; creatorId: string; type: "watch" | "tip" | "interact"; amount: number } }>("/fans/contribute", async (req, reply) => {
    const { userId, creatorId, type, amount } = req.body || {};
    if (!userId || !creatorId || !type) return reply.status(400).send({ error: "缺少参数" });

    // 防刷
    const rateCheck = await checkRateLimit(userId, type, req.ip);
    if (!rateCheck.allowed) {
        return reply.status(429).send({ error: "操作频率过高" });
    }

    // 积分换算
    const pointsMap = { watch: 1, tip: amount * 2, interact: 5 };
    const points = pointsMap[type] || 0;

    // 更新粉丝等级
    const fanLevel = await prisma.fanLevel.upsert({
        where: { userId_creatorId: { userId, creatorId } },
        create: {
            userId,
            creatorId,
            totalPoints: points,
            watchTime: type === "watch" ? amount : 0,
            tipAmount: type === "tip" ? amount : 0,
            interactions: type === "interact" ? 1 : 0,
        },
        update: {
            totalPoints: { increment: points },
            watchTime: type === "watch" ? { increment: amount } : undefined,
            tipAmount: type === "tip" ? { increment: amount } : undefined,
            interactions: type === "interact" ? { increment: 1 } : undefined,
        },
    });

    // 重新计算等级
    const newLevel = calculateFanLevel(fanLevel.totalPoints);
    if (newLevel !== fanLevel.level) {
        await prisma.fanLevel.update({
            where: { id: fanLevel.id },
            data: { level: newLevel },
        });
    }

    return reply.send({
        success: true,
        level: newLevel,
        totalPoints: fanLevel.totalPoints,
        levelUp: newLevel > fanLevel.level,
    });
});

/**
 * GET /fans/leaderboard/:creatorId
 * 获取创作者粉丝排行榜
 */
app.get<{ Params: { creatorId: string } }>("/fans/leaderboard/:creatorId", async (req, reply) => {
    const { creatorId } = req.params;

    const topFans = await prisma.fanLevel.findMany({
        where: { creatorId },
        orderBy: { totalPoints: "desc" },
        take: 20,
    });

    // 获取用户信息
    const userIds = topFans.map(f => f.userId);
    const users = await prisma.user.findMany({
        where: { id: { in: userIds } },
        select: { id: true, nickname: true, avatar: true },
    });
    const userMap = new Map(users.map(u => [u.id, u]));

    const leaderboard = topFans.map((fan, index) => {
        const user = userMap.get(fan.userId);
        return {
            rank: index + 1,
            userId: fan.userId,
            nickname: user?.nickname || "匿名用户",
            avatar: user?.avatar,
            level: fan.level,
            totalPoints: fan.totalPoints,
            levelName: ["", "路人粉", "铁粉", "真爱粉", "守护者", "舰长"][fan.level],
        };
    });

    return reply.send({ leaderboard });
});

// ============== 直播奖励 API ==============

/**
 * POST /live/reward
 * 记录直播奖励
 */
app.post<{ Body: { userId: string; roomId: string; rewardType: string } }>("/live/reward", async (req, reply) => {
    const { userId, roomId, rewardType } = req.body || {};
    if (!userId || !roomId || !rewardType) return reply.status(400).send({ error: "缺少参数" });

    // 防刷
    const rateCheck = await checkRateLimit(userId, `live_${rewardType}`, req.ip);
    if (!rateCheck.allowed) {
        return reply.status(429).send({ error: "奖励领取频率过高" });
    }

    const pointsMap: Record<string, number> = {
        checkin: 5,
        watch_5min: 10,
        danmaku_10: 15,
        lottery: Math.floor(Math.random() * 100) + 1,
    };

    const points = pointsMap[rewardType] || 0;
    if (points === 0) return reply.status(400).send({ error: "无效奖励类型" });

    // 记录奖励
    await prisma.liveReward.create({
        data: { userId, roomId, rewardType, points },
    });

    // 增加积分
    await prisma.user.update({
        where: { id: userId },
        data: { points: { increment: points } },
    });

    // 更新直播观看任务进度
    if (rewardType === "watch_5min") {
        const today = getToday();
        await prisma.userTaskProgress.upsert({
            where: { userId_taskType_date: { userId, taskType: "live_watch", date: today } },
            create: { userId, taskType: "live_watch", date: today, progress: 5 },
            update: { progress: { increment: 5 } },
        });
    }

    return reply.send({
        success: true,
        points,
        message: rewardType === "lottery" ? `抽奖获得 ${points} 积分!` : `获得 ${points} 积分`
    });
});

// ============== NFT 掉落系统 ==============

// NFT 配置
const NFT_DROP_CONFIG = {
    // 稀有度概率 (百分比)
    rarityProbabilities: {
        N: 70,   // 普通
        R: 25,   // 稀有
        SR: 4,   // 史诗
        SSR: 1,  // 传说
    },
    // 触发条件
    triggers: {
        live_watch_30min: { chance: 10, name: "直播观看30分钟" },
        daily_complete: { chance: 5, name: "完成每日全部任务" },
        first_tip: { chance: 100, name: "首次打赏创作者" },
        consecutive_7days: { chance: 20, name: "连续签到7天" },
        special_event: { chance: 50, name: "特殊活动" },
    },
    // NFT 类型
    nftTypes: {
        N: [
            { name: "观众徽章", type: "badge", imageUrl: "/nft/badge_viewer.png" },
            { name: "弹幕达人", type: "badge", imageUrl: "/nft/badge_danmaku.png" },
            { name: "忠实粉丝", type: "badge", imageUrl: "/nft/badge_fan.png" },
        ],
        R: [
            { name: "创作者签名", type: "signature", imageUrl: "/nft/signature.png" },
            { name: "专属头像框", type: "frame", imageUrl: "/nft/frame_rare.png" },
        ],
        SR: [
            { name: "限量版封面", type: "cover", imageUrl: "/nft/cover_epic.png" },
            { name: "VIP 通行证", type: "pass", imageUrl: "/nft/pass_vip.png" },
        ],
        SSR: [
            { name: "传说纪念品", type: "special", imageUrl: "/nft/legendary.png" },
            { name: "创始会员徽章", type: "special", imageUrl: "/nft/founding.png" },
        ],
    },
};

/**
 * 根据概率随机选择稀有度
 */
function rollRarity(): string {
    const rand = Math.random() * 100;
    let cumulative = 0;
    for (const [rarity, prob] of Object.entries(NFT_DROP_CONFIG.rarityProbabilities)) {
        cumulative += prob;
        if (rand < cumulative) return rarity;
    }
    return "N";
}

/**
 * 随机选择 NFT 类型
 */
function rollNFT(rarity: string): { name: string; type: string; imageUrl: string } {
    const options = NFT_DROP_CONFIG.nftTypes[rarity as keyof typeof NFT_DROP_CONFIG.nftTypes] || NFT_DROP_CONFIG.nftTypes.N;
    return options[Math.floor(Math.random() * options.length)];
}

/**
 * POST /drops/trigger
 * 触发 NFT 掉落检查
 */
app.post<{ Body: { userId: string; triggerType: string } }>("/drops/trigger", async (req, reply) => {
    const { userId, triggerType } = req.body || {};
    if (!userId || !triggerType) return reply.status(400).send({ error: "缺少参数" });

    const trigger = NFT_DROP_CONFIG.triggers[triggerType as keyof typeof NFT_DROP_CONFIG.triggers];
    if (!trigger) return reply.status(400).send({ error: "无效触发类型" });

    // 检查今日是否已触发过此类型
    const today = getToday();
    const existingToday = await prisma.nFTDrop.findFirst({
        where: {
            userId,
            triggerType,
            createdAt: { gte: today },
        },
    });
    if (existingToday && triggerType !== "first_tip") {
        return reply.send({ dropped: false, reason: "今日已触发过此类型" });
    }

    // 随机判定是否掉落
    const roll = Math.random() * 100;
    if (roll > trigger.chance) {
        return reply.send({ dropped: false, reason: "未触发掉落" });
    }

    // 掉落成功，生成 NFT
    const rarity = rollRarity();
    const nft = rollNFT(rarity);

    // 24小时后过期
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

    const drop = await prisma.nFTDrop.create({
        data: {
            userId,
            triggerType,
            rarity,
            nftType: nft.type,
            nftName: nft.name,
            imageUrl: nft.imageUrl,
            expiresAt,
        },
    });

    app.log.info({ userId, triggerType, rarity, nftName: nft.name }, "NFT dropped");

    return reply.send({
        dropped: true,
        drop: {
            id: drop.id,
            rarity,
            nftName: nft.name,
            nftType: nft.type,
            imageUrl: nft.imageUrl,
            expiresAt,
        },
    });
});

/**
 * GET /drops/pending
 * 获取待领取的 NFT 掉落
 */
app.get<{ Querystring: { userId: string } }>("/drops/pending", async (req, reply) => {
    const { userId } = req.query;
    if (!userId) return reply.status(400).send({ error: "缺少 userId" });

    const drops = await prisma.nFTDrop.findMany({
        where: {
            userId,
            claimed: false,
            expiresAt: { gt: new Date() },
        },
        orderBy: { createdAt: "desc" },
    });

    return reply.send({
        drops: drops.map(d => ({
            id: d.id,
            rarity: d.rarity,
            nftName: d.nftName,
            nftType: d.nftType,
            imageUrl: d.imageUrl,
            expiresAt: d.expiresAt,
            createdAt: d.createdAt,
        })),
    });
});

/**
 * POST /drops/claim
 * 领取 NFT (铸造 Spore)
 */
app.post<{ Body: { userId: string; dropId: string } }>("/drops/claim", async (req, reply) => {
    const { userId, dropId } = req.body || {};
    if (!userId || !dropId) return reply.status(400).send({ error: "缺少参数" });

    const drop = await prisma.nFTDrop.findUnique({ where: { id: dropId } });
    if (!drop) return reply.status(404).send({ error: "掉落不存在" });
    if (drop.userId !== userId) return reply.status(403).send({ error: "无权领取" });
    if (drop.claimed) return reply.status(400).send({ error: "已领取" });
    if (drop.expiresAt && drop.expiresAt < new Date()) {
        return reply.status(400).send({ error: "已过期" });
    }

    // 获取用户地址
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { address: true } });
    if (!user?.address) {
        return reply.status(400).send({ error: "用户未绑定钱包地址" });
    }

    // Call NFT service to mint a real Spore NFT on CKB testnet
    let sporeId: string;
    const NFT_SERVICE_URL = process.env.NFT_SERVICE_URL || "http://localhost:8098";
    try {
        const mintRes = await fetch(`${NFT_SERVICE_URL}/nft/badge/mint`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                toAddress: user.address,
                name: drop.nftName,
                rarity: drop.rarity,
                dropId,
                userId,
            }),
        });
        const mintData = await mintRes.json();
        sporeId = mintData.sporeId || mintData.tokenId || `spore_${Date.now()}_${Math.random().toString(36).slice(2)}`;
        if (!mintRes.ok) {
            app.log.warn({ status: mintRes.status, mintData }, "NFT mint returned non-OK, using fallback sporeId");
        }
    } catch (nftErr: any) {
        app.log.warn({ err: nftErr.message }, "NFT service unavailable, using local sporeId");
        sporeId = `spore_local_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    }

    // 更新掉落记录
    await prisma.nFTDrop.update({
        where: { id: dropId },
        data: {
            claimed: true,
            claimedAt: new Date(),
            sporeId: sporeId,
        },
    });

    app.log.info({ userId, dropId, sporeId: sporeId }, "NFT claimed");

    return reply.send({
        success: true,
        sporeId: sporeId,
        nftName: drop.nftName,
        rarity: drop.rarity,
        message: `恭喜获得 ${drop.rarity} 级 NFT: ${drop.nftName}!`,
    });
});

/**
 * GET /drops/history
 * 获取 NFT 掉落历史
 */
app.get<{ Querystring: { userId: string; limit?: string } }>("/drops/history", async (req, reply) => {
    const { userId, limit = "20" } = req.query;
    if (!userId) return reply.status(400).send({ error: "缺少 userId" });

    const drops = await prisma.nFTDrop.findMany({
        where: { userId },
        orderBy: { createdAt: "desc" },
        take: Math.min(50, parseInt(limit)),
    });

    return reply.send({
        drops: drops.map(d => ({
            id: d.id,
            rarity: d.rarity,
            nftName: d.nftName,
            nftType: d.nftType,
            imageUrl: d.imageUrl,
            claimed: d.claimed,
            sporeId: d.sporeId,
            createdAt: d.createdAt,
            claimedAt: d.claimedAt,
        })),
    });
});

// ============== 转盘抽奖 API ==============

const WHEEL_PRIZES = [
    { id: 'points_10', weight: 30, type: 'points', value: 10 },
    { id: 'points_50', weight: 20, type: 'points', value: 50 },
    { id: 'points_100', weight: 10, type: 'points', value: 100 },
    { id: 'coupon_5', weight: 15, type: 'coupon', value: 50 },
    { id: 'coupon_3', weight: 5, type: 'coupon', value: 30 },
    { id: 'vip_1', weight: 10, type: 'vip', value: 1 },
    { id: 'mystery', weight: 5, type: 'mystery', value: 0 },
    { id: 'points_500', weight: 5, type: 'points', value: 500 },
];

/**
 * GET /engagement/wheel/status
 * 获取今日抽奖状态
 */
app.get<{ Querystring: { userId: string } }>("/engagement/wheel/status", async (req, reply) => {
    const { userId } = req.query;
    if (!userId) return reply.status(400).send({ error: "缺少 userId" });

    const today = getToday();
    // 使用 UserDailyLimit 记录抽奖次数，actionType = "wheel"
    const record = await prisma.userDailyLimit.findUnique({
        where: { userId_date_actionType: { userId, date: today, actionType: "wheel" } },
    });

    const hasSpun = (record?.count || 0) >= 1;

    return reply.send({
        canSpin: !hasSpun,
        remainingSpins: hasSpun ? 0 : 1,
    });
});

/**
 * POST /engagement/wheel/spin
 * 每日抽奖
 */
app.post<{ Body: { userId: string } }>("/engagement/wheel/spin", async (req, reply) => {
    const { userId } = req.body || {};
    if (!userId) return reply.status(400).send({ error: "缺少 userId" });

    // 1. 检查今日次数 (手动限制为 1 次)
    const today = getToday();

    // 直接查表判断是否已经抽过
    const existing = await prisma.userDailyLimit.findUnique({
        where: { userId_date_actionType: { userId, date: today, actionType: "wheel" } },
    });

    if (existing && existing.count >= 1) {
        return reply.status(400).send({ error: "今日抽奖次数已用完" });
    }

    // 记录本次抽奖
    if (!existing) {
        await prisma.userDailyLimit.create({
            data: { userId, date: today, actionType: "wheel", count: 1, lastIp: req.ip },
        });
    } else {
        await prisma.userDailyLimit.update({
            where: { id: existing.id },
            data: { count: existing.count + 1 },
        });
    }

    // 2. 随机抽奖逻辑
    const totalWeight = WHEEL_PRIZES.reduce((sum, p) => sum + p.weight, 0);
    let random = Math.random() * totalWeight;
    let selectedPrize = WHEEL_PRIZES[0];

    for (const prize of WHEEL_PRIZES) {
        random -= prize.weight;
        if (random <= 0) {
            selectedPrize = prize;
            break;
        }
    }

    // 3. 发放奖励
    // 如果是积分，直接加
    if (selectedPrize.type === 'points' && selectedPrize.value > 0) {
        await prisma.user.update({
            where: { id: userId },
            data: { points: { increment: selectedPrize.value } },
        });
    }

    // 其他类型暂时只记录日志，后续可扩展（比如发券、VIP）
    app.log.info({ userId, prize: selectedPrize }, "Wheel Spin Result");

    return reply.send({
        success: true,
        prizeId: selectedPrize.id,
        reward: {
            type: selectedPrize.type,
            value: selectedPrize.value
        }
    });
});


// ============== 启动服务 ==============

try {
    await app.listen({ port: PORT, host: "0.0.0.0" });
    console.log(`🎮 Engagement service running on port ${PORT}`);

    // 初始化任务定义
    for (const task of DAILY_TASKS) {
        await prisma.dailyTask.upsert({
            where: { type: task.type },
            create: task,
            update: { name: task.name, description: task.description, points: task.points },
        });
    }
    console.log("📋 Daily tasks initialized");
} catch (err) {
    app.log.error(err);
    process.exit(1);
}
