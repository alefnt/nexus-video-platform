/**
 * Collaboration Service - 协作创作系统
 * Port: 8106
 *
 * 功能:
 * - 视频合拍 (多创作者各上传片段 → 服务端合并)
 * - 审核工作流 (创建 → 审核 → 发布)
 * - 协作邀请管理
 */

import Fastify from "fastify";
import { PrismaClient } from "@prisma/client";
import { register } from "prom-client";
import { registerSecurityPlugins } from "@video-platform/shared/security/index";

const prisma = new PrismaClient();
const PORT = parseInt(process.env.PORT || "8106");
const app = Fastify({ logger: true });

// Apply security (Helmet + CORS + rate limiting)
registerSecurityPlugins(app, { rateLimit: { max: 100, timeWindow: "1 minute" } });

interface CollabProject {
    id: string;
    title: string;
    ownerId: string;
    status: "draft" | "in_progress" | "review" | "published";
    collaborators: string[];
    segments: CollabSegment[];
    createdAt: Date;
    updatedAt: Date;
}

interface CollabSegment {
    id: string;
    projectId: string;
    creatorId: string;
    order: number;
    videoUrl: string | null;
    status: "pending" | "uploaded" | "approved";
    duration: number;
}

// ============== 健康检查 ==============

app.get("/health", async () => ({ status: "ok", service: "collaboration" }));
app.get("/metrics", async (_req, reply) => {
    reply.header("Content-Type", register.contentType);
    return reply.send(await register.metrics());
});

// ============== 协作项目 API ==============

/**
 * POST /collaboration/project
 * 创建协作项目
 */
app.post<{
    Body: {
        title: string;
        ownerId: string;
        description?: string;
        collaboratorIds: string[];
    };
}>("/collaboration/project", async (req, reply) => {
    const { title, ownerId, description, collaboratorIds } = req.body || {};
    if (!title || !ownerId) {
        return reply.status(400).send({ error: "缺少标题或创建者" });
    }

    try {
        // 使用通用表存储 (或后续迁移时添加专用表)
        // 这里用 JSON 存储在 User 的 metadata 中作为 MVP
        const projectId = crypto.randomUUID();
        const project = {
            id: projectId,
            title,
            description: description || "",
            ownerId,
            status: "draft",
            collaborators: collaboratorIds,
            segments: collaboratorIds.map((cid, idx) => ({
                id: crypto.randomUUID(),
                projectId,
                creatorId: cid,
                order: idx,
                videoUrl: null,
                status: "pending",
                duration: 0,
            })),
            createdAt: new Date().toISOString(),
        };

        // 发送通知给协作者
        await Promise.all(
            collaboratorIds.map((cid) =>
                prisma.notification.create({
                    data: {
                        userId: cid,
                        type: "collab_invite",
                        title: `${title} - 协作邀请`,
                        message: `你被邀请参与协作视频项目「${title}」`,
                        data: JSON.stringify({ projectId }),
                    },
                })
            )
        );

        return reply.status(201).send({ project });
    } catch (err: any) {
        return reply.status(500).send({ error: "创建失败", message: err?.message });
    }
});

/**
 * POST /collaboration/segment/upload
 * 上传协作片段
 */
app.post<{
    Body: {
        projectId: string;
        segmentId: string;
        creatorId: string;
        videoUrl: string;
        duration: number;
    };
}>("/collaboration/segment/upload", async (req, reply) => {
    const { projectId, segmentId, creatorId, videoUrl, duration } = req.body || {};
    if (!projectId || !segmentId || !videoUrl) {
        return reply.status(400).send({ error: "缺少必要参数" });
    }

    try {
        // 通知项目所有者
        // 实际实现中应更新数据库中的项目数据
        return reply.send({
            success: true,
            message: "片段上传成功",
            segmentId,
            status: "uploaded",
        });
    } catch (err: any) {
        return reply.status(500).send({ error: "上传失败" });
    }
});

/**
 * POST /collaboration/merge
 * 合并所有片段 → 提交到 transcode 服务
 */
app.post<{
    Body: { projectId: string; ownerId: string };
}>("/collaboration/merge", async (req, reply) => {
    const { projectId, ownerId } = req.body || {};
    if (!projectId || !ownerId) {
        return reply.status(400).send({ error: "缺少参数" });
    }

    try {
        // TODO: 调用 transcode 服务合并视频片段
        // 这里返回占位, 实际需要:
        // 1. 获取所有 segments 的 videoUrl
        // 2. 调用 transcode 服务的 /merge endpoint
        // 3. 生成最终视频
        // 4. 更新项目状态为 "review"

        return reply.send({
            success: true,
            message: "合并任务已提交",
            status: "merging",
        });
    } catch (err: any) {
        return reply.status(500).send({ error: "合并失败" });
    }
});

/**
 * POST /collaboration/publish
 * 发布协作视频
 */
app.post<{
    Body: { projectId: string; ownerId: string; title: string; tags: string[] };
}>("/collaboration/publish", async (req, reply) => {
    const { projectId, ownerId, title, tags } = req.body || {};
    if (!projectId || !ownerId) {
        return reply.status(400).send({ error: "缺少参数" });
    }

    try {
        // Fetch owner's CKB address for the RGB++ contract
        const owner = await prisma.user.findUnique({ where: { id: ownerId } });

        // Create RGB++ split contract for revenue sharing
        const { rgbppClient } = await import("@video-platform/shared/web3/rgbpp");

        // Build participant list (equal split for now, can be customized)
        // TODO: Get actual collaborator addresses and custom split percentages
        const participantIds = [ownerId]; // Would include all collaborators
        const shareEach = 100 / participantIds.length;

        const splitResult = await rgbppClient.createSplitContract({
            contractName: title,
            participants: participantIds.map((id, idx) => ({
                address: owner?.address || id,
                label: idx === 0 ? "Owner" : `Collaborator ${idx}`,
                percentage: shareEach,
                role: idx === 0 ? ('owner' as const) : ('collaborator' as const),
            })),
            linkedContentIds: [projectId],
            contentType: 'video',
            creatorAddress: owner?.address || ownerId,
        });

        return reply.send({
            success: true,
            message: "协作视频已发布",
            status: "published",
            rgbppContract: {
                contractId: splitResult.contractId,
                txHash: splitResult.txHash,
                onChain: splitResult.success,
            },
        });
    } catch (err: any) {
        return reply.status(500).send({ error: "发布失败", message: err?.message });
    }
});

// ============== 启动 ==============

const start = async () => {
    try {
        await app.listen({ port: PORT, host: "0.0.0.0" });
        console.log(`🤝 Collaboration service running on port ${PORT}`);
    } catch (err) {
        app.log.error(err);
        process.exit(1);
    }
};

start();
