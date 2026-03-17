// FILE: /video-platform/services/governance/src/server.ts
/**
 * DAO Governance Service - 去中心化治理服务
 *
 * 功能说明：
 * - 治理 Token 管理
 * - 提案系统
 * - 投票机制
 * - 链上执行
 *
 * 端口: 8098
 */

import Fastify from "fastify";
import jwt from "@fastify/jwt";
import { v4 as uuidv4 } from "uuid";
import { registerSecurityPlugins } from "@video-platform/shared/security/index";
import { register } from "@video-platform/shared/monitoring";
import { getPrisma } from "@video-platform/shared/database/client";

const prisma = getPrisma();

const app = Fastify({ logger: true });
const JWT_SECRET = process.env.JWT_SECRET || "";
if (!JWT_SECRET || JWT_SECRET.length < 32) throw new Error("JWT_SECRET 未配置或长度不足");

await registerSecurityPlugins(app, { rateLimit: { max: 100, timeWindow: "1 minute" } });

app.register(jwt, { secret: JWT_SECRET });

// ============== 治理参数 ==============

const GOVERNANCE_PARAMS = {
    minProposalThreshold: 1000,
    proposalVotingPeriod: 7 * 24 * 60 * 60 * 1000,
    proposalDelayPeriod: 24 * 60 * 60 * 1000,
    executionGracePeriod: 3 * 24 * 60 * 60 * 1000,

    defaultQuorum: 10000,
    defaultPassingThreshold: 50,
    emergencyPassingThreshold: 67,

    tokensPerVideo: 10,
    tokensPerHourWatched: 1,
    tokensPerTip100: 5,
    tokensPerAchievement: 50,
    tokensPerReferral: 20,
};

// JWT 验证
app.addHook("onRequest", async (req, reply) => {
    const publicPaths = ['/health', '/metrics', '/governance/proposals', '/governance/params'];
    if (publicPaths.some(p => req.url.startsWith(p))) return;
    try {
        await req.jwtVerify();
    } catch (e) {
        return reply.status(401).send({ error: "未授权", code: "unauthorized" });
    }
});

// ============== 健康检查 ==============

app.get("/health", async () => ({ status: "ok", service: "governance" }));
app.get("/metrics", async (_req: any, reply: any) => {
    reply.header("Content-Type", register.contentType);
    return reply.send(await register.metrics());
});

// ============== 治理参数 ==============

app.get("/governance/params", async (_req, reply) => {
    return reply.send({ params: GOVERNANCE_PARAMS });
});

// ============== 辅助函数 ==============

function toISO(d: Date | string): string {
    return d instanceof Date ? d.toISOString() : d;
}

async function computeEffectiveVotingPower(userId: string): Promise<number> {
    const token = await prisma.governanceToken.findUnique({ where: { userId } });
    if (!token) return 0;
    if (token.delegatedTo) return 0;

    let power = token.balance;
    const delegators = await prisma.governanceToken.findMany({
        where: { delegatedTo: userId },
        select: { balance: true },
    });
    for (const d of delegators) {
        power += d.balance;
    }
    return power;
}

function mapProposalToResponse(p: any, totalVoters = 0) {
    const createdMs = new Date(p.createdAt).getTime();
    return {
        id: p.id,
        title: p.title,
        description: p.description,
        category: p.category,
        proposer: p.proposerId,
        proposerAddress: "",
        actions: p.actions ?? [],
        status: p.status,
        createdAt: toISO(p.createdAt),
        startAt: new Date(createdMs + GOVERNANCE_PARAMS.proposalDelayPeriod).toISOString(),
        endAt: toISO(p.endsAt),
        executedAt: p.executionWindow ? toISO(p.executionWindow) : undefined,
        quorum: p.quorum,
        passingThreshold: p.threshold,
        forVotes: p.forVotes,
        againstVotes: p.againstVotes,
        abstainVotes: p.abstainVotes,
        totalVoters,
        discussionUrl: undefined,
    };
}

function mapVoteToResponse(v: any) {
    return {
        id: v.id,
        proposalId: v.proposalId,
        voter: v.voterId,
        voterAddress: "",
        choice: v.support,
        votingPower: v.power,
        reason: v.reason ?? undefined,
        timestamp: toISO(v.createdAt),
    };
}

// ============== 治理 Token ==============

/**
 * 获取用户治理 Token 信息
 */
app.get("/governance/token/my", async (req, reply) => {
    const user = req.user as any;
    const userId = user?.sub || "";

    const userToken = await prisma.governanceToken.findUnique({ where: { userId } });

    const effectiveVotingPower = await computeEffectiveVotingPower(userId);

    const delegatedFrom = userToken
        ? (await prisma.governanceToken.findMany({
              where: { delegatedTo: userId },
              select: { userId: true },
          })).map(t => t.userId)
        : [];

    return reply.send({
        token: {
            userId,
            userAddress: "",
            balance: userToken?.balance ?? 0,
            votingPower: effectiveVotingPower,
            delegatedTo: userToken?.delegatedTo ?? undefined,
            delegatedFrom,
            earnedFrom: [],
            updatedAt: userToken ? toISO(userToken.updatedAt) : new Date().toISOString(),
        },
        effectiveVotingPower,
    });
});

/**
 * 获取 Token 余额
 */
app.get("/governance/token/balance/:userId", async (req, reply) => {
    const params = req.params as { userId: string };

    const userToken = await prisma.governanceToken.findUnique({
        where: { userId: params.userId },
    });

    return reply.send({
        userId: params.userId,
        balance: userToken?.balance || 0,
        votingPower: userToken?.votingPower || 0,
    });
});

/**
 * 获取 Token 排行榜
 */
app.get("/governance/token/leaderboard", async (req, reply) => {
    const query = req.query as { limit?: string };
    const limit = Math.min(100, Math.max(1, Number(query.limit) || 20));

    const tokens = await prisma.governanceToken.findMany({
        orderBy: { balance: "desc" },
        take: limit,
    });

    const leaderboard = tokens.map((t, i) => ({
        rank: i + 1,
        userId: t.userId,
        balance: t.balance,
        votingPower: t.votingPower,
    }));

    const agg = await prisma.governanceToken.aggregate({
        _sum: { balance: true },
        _count: { userId: true },
    });

    return reply.send({
        leaderboard,
        totalSupply: agg._sum.balance || 0,
        totalHolders: agg._count.userId,
    });
});

/**
 * 委托投票权
 */
app.post("/governance/token/delegate", async (req, reply) => {
    const user = req.user as any;
    const userId = user?.sub || "";
    const body = req.body as { delegateTo: string };

    if (!body.delegateTo) {
        return reply.status(400).send({ error: "缺少 delegateTo", code: "bad_request" });
    }

    const [userToken, delegateTarget] = await Promise.all([
        prisma.governanceToken.findUnique({ where: { userId } }),
        prisma.governanceToken.findUnique({ where: { userId: body.delegateTo } }),
    ]);

    if (!delegateTarget) {
        return reply.status(404).send({ error: "目标用户不存在", code: "not_found" });
    }
    if (!userToken) {
        return reply.status(404).send({ error: "用户 Token 不存在", code: "not_found" });
    }

    await prisma.$transaction(async (tx) => {
        if (userToken.delegatedTo) {
            await tx.governanceToken.update({
                where: { userId: userToken.delegatedTo },
                data: { delegatedPower: { decrement: userToken.balance } },
            });
        }

        await tx.governanceToken.update({
            where: { userId },
            data: { delegatedTo: body.delegateTo },
        });

        await tx.governanceToken.update({
            where: { userId: body.delegateTo },
            data: { delegatedPower: { increment: userToken.balance } },
        });
    });

    return reply.send({
        ok: true,
        delegatedTo: body.delegateTo,
        delegatedAmount: userToken.balance,
    });
});

/**
 * 取消委托
 */
app.post("/governance/token/undelegate", async (req, reply) => {
    const user = req.user as any;
    const userId = user?.sub || "";

    const userToken = await prisma.governanceToken.findUnique({ where: { userId } });

    if (!userToken?.delegatedTo) {
        return reply.status(400).send({ error: "未委托", code: "not_delegated" });
    }

    await prisma.$transaction(async (tx) => {
        await tx.governanceToken.update({
            where: { userId: userToken.delegatedTo! },
            data: { delegatedPower: { decrement: userToken.balance } },
        });

        await tx.governanceToken.update({
            where: { userId },
            data: { delegatedTo: null },
        });
    });

    return reply.send({ ok: true });
});

/**
 * 发放 Token（内部调用）
 */
app.post("/governance/token/mint", async (req, reply) => {
    const body = req.body as {
        userId: string;
        userAddress: string;
        amount: number;
        source: string;
    };

    if (!body.userId || !body.amount || body.amount <= 0) {
        return reply.status(400).send({ error: "参数错误", code: "bad_request" });
    }

    const userToken = await prisma.governanceToken.upsert({
        where: { userId: body.userId },
        update: {
            balance: { increment: body.amount },
            totalEarned: { increment: body.amount },
            updatedAt: new Date(),
        },
        create: {
            id: uuidv4(),
            userId: body.userId,
            balance: body.amount,
            votingPower: body.amount,
            delegatedPower: 0,
            totalEarned: body.amount,
            totalSpent: 0,
        },
    });

    return reply.send({
        ok: true,
        newBalance: userToken.balance,
    });
});

// ============== 提案管理 ==============

/**
 * 获取提案列表
 */
app.get("/governance/proposals", async (req, reply) => {
    const query = req.query as { status?: string; category?: string; limit?: string };
    const limit = Math.min(50, Math.max(1, Number(query.limit) || 20));

    const now = new Date();

    const expiredActive = await prisma.proposal.findMany({
        where: { status: "active", endsAt: { lt: now } },
    });

    if (expiredActive.length > 0) {
        await prisma.$transaction(
            expiredActive.map((p) => {
                const totalVotes = p.forVotes + p.againstVotes + p.abstainVotes;
                const forPercent = totalVotes > 0 ? (p.forVotes / totalVotes) * 100 : 0;
                const newStatus = totalVotes >= p.quorum && forPercent >= p.threshold
                    ? "passed"
                    : "rejected";
                return prisma.proposal.update({
                    where: { id: p.id },
                    data: { status: newStatus },
                });
            }),
        );
    }

    const where: any = {};
    if (query.status) where.status = query.status;
    if (query.category) where.category = query.category;

    const [proposals, total] = await Promise.all([
        prisma.proposal.findMany({
            where,
            orderBy: { createdAt: "desc" },
            take: limit,
        }),
        prisma.proposal.count({ where }),
    ]);

    const proposalIds = proposals.map(p => p.id);
    const voterCounts = await prisma.vote.groupBy({
        by: ["proposalId"],
        where: { proposalId: { in: proposalIds } },
        _count: { id: true },
    });
    const voterCountMap = new Map(voterCounts.map(vc => [vc.proposalId, vc._count.id]));

    return reply.send({
        proposals: proposals.map(p =>
            mapProposalToResponse(p, voterCountMap.get(p.id) || 0),
        ),
        total,
    });
});

/**
 * 获取提案详情
 */
app.get("/governance/proposal/:id", async (req, reply) => {
    const params = req.params as { id: string };
    const proposal = await prisma.proposal.findUnique({ where: { id: params.id } });

    if (!proposal) {
        return reply.status(404).send({ error: "提案不存在", code: "not_found" });
    }

    const [votes, totalVotes] = await Promise.all([
        prisma.vote.findMany({
            where: { proposalId: params.id },
            orderBy: { createdAt: "desc" },
            take: 50,
        }),
        prisma.vote.count({ where: { proposalId: params.id } }),
    ]);

    return reply.send({
        proposal: mapProposalToResponse(proposal, totalVotes),
        votes: votes.map(mapVoteToResponse),
        totalVotes,
    });
});

/**
 * 创建提案
 */
app.post("/governance/proposal/create", async (req, reply) => {
    const user = req.user as any;
    const userId = user?.sub || "";

    const body = req.body as {
        title: string;
        description: string;
        category: "platform" | "treasury" | "parameter" | "community" | "emergency";
        actions: any[];
        discussionUrl?: string;
    };

    if (!body.title || !body.description || !body.category) {
        return reply.status(400).send({ error: "缺少必要参数", code: "bad_request" });
    }

    const userToken = await prisma.governanceToken.findUnique({ where: { userId } });
    if (!userToken || userToken.balance < GOVERNANCE_PARAMS.minProposalThreshold) {
        return reply.status(403).send({
            error: `需要至少 ${GOVERNANCE_PARAMS.minProposalThreshold} Token 才能创建提案`,
            code: "insufficient_tokens",
            required: GOVERNANCE_PARAMS.minProposalThreshold,
            current: userToken?.balance || 0,
        });
    }

    const now = new Date();
    const startAt = new Date(now.getTime() + GOVERNANCE_PARAMS.proposalDelayPeriod);
    const endsAt = new Date(startAt.getTime() + GOVERNANCE_PARAMS.proposalVotingPeriod);
    const isEmergency = body.category === "emergency";

    const proposal = await prisma.proposal.create({
        data: {
            id: uuidv4(),
            title: body.title,
            description: body.description,
            proposerId: userId,
            status: "pending",
            type: body.category,
            category: body.category,
            quorum: isEmergency ? GOVERNANCE_PARAMS.defaultQuorum * 0.5 : GOVERNANCE_PARAMS.defaultQuorum,
            threshold: isEmergency ? GOVERNANCE_PARAMS.emergencyPassingThreshold : GOVERNANCE_PARAMS.defaultPassingThreshold,
            forVotes: 0,
            againstVotes: 0,
            abstainVotes: 0,
            actions: (body.actions || []) as any,
            endsAt,
            createdAt: now,
        },
    });

    return reply.send({
        ok: true,
        proposal: mapProposalToResponse(proposal, 0),
    });
});

/**
 * 投票
 */
app.post("/governance/proposal/vote", async (req, reply) => {
    const user = req.user as any;
    const userId = user?.sub || "";

    const body = req.body as {
        proposalId: string;
        choice: "for" | "against" | "abstain";
        reason?: string;
    };

    if (!body.proposalId || !body.choice) {
        return reply.status(400).send({ error: "缺少参数", code: "bad_request" });
    }

    const proposal = await prisma.proposal.findUnique({ where: { id: body.proposalId } });
    if (!proposal) {
        return reply.status(404).send({ error: "提案不存在", code: "not_found" });
    }

    const now = Date.now();
    let currentStatus = proposal.status;

    const startAt = new Date(proposal.createdAt).getTime() + GOVERNANCE_PARAMS.proposalDelayPeriod;
    if (currentStatus === "pending" && startAt <= now) {
        await prisma.proposal.update({ where: { id: proposal.id }, data: { status: "active" } });
        currentStatus = "active";
    }

    if (currentStatus !== "active") {
        return reply.status(400).send({ error: "提案未在投票期", code: "not_active" });
    }

    if (new Date(proposal.endsAt).getTime() < now) {
        return reply.status(400).send({ error: "投票已结束", code: "voting_ended" });
    }

    const existingVote = await prisma.vote.findFirst({
        where: { proposalId: body.proposalId, voterId: userId },
    });
    if (existingVote) {
        return reply.status(400).send({ error: "已投票", code: "already_voted" });
    }

    const userToken = await prisma.governanceToken.findUnique({ where: { userId } });
    if (!userToken || userToken.balance <= 0) {
        return reply.status(403).send({ error: "无投票权", code: "no_voting_power" });
    }

    const votingPower = await computeEffectiveVotingPower(userId);
    if (votingPower <= 0) {
        return reply.status(403).send({ error: "投票权已委托", code: "power_delegated" });
    }

    const incrementField =
        body.choice === "for" ? "forVotes"
        : body.choice === "against" ? "againstVotes"
        : "abstainVotes";

    const [vote, updatedProposal] = await prisma.$transaction(async (tx) => {
        const v = await tx.vote.create({
            data: {
                id: uuidv4(),
                proposalId: body.proposalId,
                voterId: userId,
                support: body.choice,
                power: votingPower,
                reason: body.reason,
            },
        });

        const p = await tx.proposal.update({
            where: { id: body.proposalId },
            data: { [incrementField]: { increment: votingPower } },
        });

        return [v, p] as const;
    });

    const totalVoters = await prisma.vote.count({ where: { proposalId: body.proposalId } });

    return reply.send({
        ok: true,
        vote: mapVoteToResponse(vote),
        proposalStats: {
            forVotes: updatedProposal.forVotes,
            againstVotes: updatedProposal.againstVotes,
            abstainVotes: updatedProposal.abstainVotes,
            totalVoters,
        },
    });
});

/**
 * 执行提案
 */
app.post("/governance/proposal/execute", async (req, reply) => {
    const user = req.user as any;
    const userId = user?.sub || "";
    const body = req.body as { proposalId: string };

    const proposal = await prisma.proposal.findUnique({ where: { id: body.proposalId } });
    if (!proposal) {
        return reply.status(404).send({ error: "提案不存在", code: "not_found" });
    }

    // Only the proposer can execute their own passed proposals
    if (proposal.proposerId !== userId) {
        return reply.status(403).send({ error: "只有提案人可以执行", code: "forbidden" });
    }

    if (proposal.status !== "passed") {
        return reply.status(400).send({ error: "提案未通过", code: "not_passed" });
    }

    const endTime = new Date(proposal.endsAt).getTime();
    const now = Date.now();
    if (now > endTime + GOVERNANCE_PARAMS.executionGracePeriod) {
        await prisma.proposal.update({ where: { id: proposal.id }, data: { status: "cancelled" } });
        return reply.status(400).send({ error: "执行窗口已过", code: "execution_expired" });
    }

    const updatedProposal = await prisma.proposal.update({
        where: { id: proposal.id },
        data: {
            status: "executed",
            executionWindow: new Date(),
        },
    });

    const totalVoters = await prisma.vote.count({ where: { proposalId: proposal.id } });

    return reply.send({
        ok: true,
        proposal: mapProposalToResponse(updatedProposal, totalVoters),
    });
});

/**
 * 取消提案（仅提案人）
 */
app.post("/governance/proposal/cancel", async (req, reply) => {
    const user = req.user as any;
    const userId = user?.sub || "";
    const body = req.body as { proposalId: string };

    const proposal = await prisma.proposal.findUnique({ where: { id: body.proposalId } });
    if (!proposal) {
        return reply.status(404).send({ error: "提案不存在", code: "not_found" });
    }

    if (proposal.proposerId !== userId) {
        return reply.status(403).send({ error: "无权限", code: "forbidden" });
    }

    if (!["draft", "pending"].includes(proposal.status)) {
        return reply.status(400).send({ error: "无法取消", code: "cannot_cancel" });
    }

    await prisma.proposal.update({ where: { id: proposal.id }, data: { status: "cancelled" } });

    return reply.send({ ok: true });
});

/**
 * 获取用户投票记录
 */
app.get("/governance/votes/my", async (req, reply) => {
    const user = req.user as any;
    const userId = user?.sub || "";

    const votes = await prisma.vote.findMany({
        where: { voterId: userId },
        orderBy: { createdAt: "desc" },
    });

    const proposalIds = [...new Set(votes.map(v => v.proposalId))];
    const proposals = proposalIds.length > 0
        ? await prisma.proposal.findMany({ where: { id: { in: proposalIds } } })
        : [];
    const proposalMap = new Map(proposals.map(p => [p.id, p]));

    const votesWithProposal = votes.map(v => ({
        ...mapVoteToResponse(v),
        proposal: proposalMap.has(v.proposalId)
            ? mapProposalToResponse(proposalMap.get(v.proposalId)!)
            : undefined,
    }));

    return reply.send({
        votes: votesWithProposal,
        total: votes.length,
    });
});

// ============== 启动服务 ==============

const PORT = Number(process.env.GOVERNANCE_PORT || 8098);
app.listen({ port: PORT, host: "0.0.0.0" }).then(() => {
    console.log(`Governance Service started on port ${PORT}`);
});

export { app, GOVERNANCE_PARAMS };
