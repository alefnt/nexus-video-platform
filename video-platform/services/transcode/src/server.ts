/**
 * Transcode Service - 使用 MinIO 存储
 * 
 * Livepeer 转码 + MinIO (S3 兼容) 存储
 */

import Fastify from 'fastify';
import { PrismaClient } from '@video-platform/database';
import { Livepeer } from 'livepeer';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { register, Counter, Histogram } from 'prom-client';
import { registerSecurityPlugins } from "@video-platform/shared/security/index";

const app = Fastify({ logger: true });
const prisma = new PrismaClient();

// ============== 环境变量 ==============
const PORT = Number(process.env.TRANSCODE_PORT || process.env.PORT) || 8100;
const LIVEPEER_API_KEY = process.env.LIVEPEER_API_KEY || '';

// MinIO 配置 (开源 S3 替代)
const MINIO_ENDPOINT = process.env.MINIO_ENDPOINT || 'http://localhost:9000';
const MINIO_ACCESS_KEY = process.env.MINIO_ACCESS_KEY || 'nexus';
const MINIO_SECRET_KEY = process.env.MINIO_SECRET_KEY || 'nexus123456';
const MINIO_BUCKET = process.env.MINIO_BUCKET || 'videos';

// ============== 客户端初始化 ==============

// Livepeer 客户端
const livepeer = new Livepeer({
    apiKey: LIVEPEER_API_KEY,
});

// MinIO 客户端 (S3 兼容)
const minioClient = new S3Client({
    region: 'us-east-1', // MinIO 需要但实际不使用
    endpoint: MINIO_ENDPOINT,
    credentials: {
        accessKeyId: MINIO_ACCESS_KEY,
        secretAccessKey: MINIO_SECRET_KEY,
    },
    forcePathStyle: true, // MinIO 需要
});

// ============== 指标 ==============
const transcodeCounter = new Counter({
    name: 'transcode_jobs_total',
    help: 'Total transcode jobs',
    labelNames: ['status'],
});

const transcodeDuration = new Histogram({
    name: 'transcode_duration_seconds',
    help: 'Transcode job duration',
    buckets: [10, 30, 60, 120, 300, 600],
});

// ============== Security ==============
await registerSecurityPlugins(app, { rateLimit: { max: 30, timeWindow: "1 minute" } });

// ============== 健康检查 ==============
app.get('/health', async () => ({
    status: 'ok',
    service: 'transcode',
    livepeerConfigured: !!LIVEPEER_API_KEY,
    storage: 'minio',
}));
app.get('/metrics', async () => register.metrics());

// ============== 转码 API ==============

/**
 * 请求转码
 * POST /transcode/start
 * Body: { videoId: string, sourceUrl: string }
 */
app.post('/transcode/start', async (req, reply) => {
    try {
        const body = req.body as { videoId: string; sourceUrl: string };

        if (!body.videoId || !body.sourceUrl) {
            return reply.status(400).send({ error: '缺少 videoId 或 sourceUrl' });
        }

        // 更新视频状态为 processing
        await prisma.video.update({
            where: { id: body.videoId },
            data: { transcodeStatus: 'processing' } as any,
        });

        if (!LIVEPEER_API_KEY) {
            // 无 Livepeer，模拟转码
            setTimeout(async () => {
                await prisma.video.update({
                    where: { id: body.videoId },
                    data: {
                        transcodeStatus: 'done',
                        transcodedUrls: JSON.stringify({
                            '720p': body.sourceUrl,
                            '480p': body.sourceUrl,
                        }),
                    } as any,
                });
            }, 5000);

            transcodeCounter.inc({ status: 'simulated' });
            return reply.send({ ok: true, taskId: `sim_${Date.now()}`, simulated: true });
        }

        // 调用 Livepeer 转码 API
        const task = await livepeer.transcode.create({
            input: { url: body.sourceUrl },
            storage: {
                type: 's3',
                endpoint: MINIO_ENDPOINT,
                credentials: {
                    accessKeyId: MINIO_ACCESS_KEY,
                    secretAccessKey: MINIO_SECRET_KEY,
                },
                bucket: MINIO_BUCKET,
            },
            outputs: {
                hls: { path: `/videos/${body.videoId}/hls` },
                mp4: { path: `/videos/${body.videoId}/mp4` },
            },
            profiles: [
                { name: '720p', width: 1280, height: 720, bitrate: 2500000, fps: 30 },
                { name: '480p', width: 854, height: 480, bitrate: 1000000, fps: 30 },
                { name: '360p', width: 640, height: 360, bitrate: 500000, fps: 30 },
            ],
        });

        transcodeCounter.inc({ status: 'started' });
        req.log.info({ videoId: body.videoId, taskId: task.task?.id }, 'Transcode started');

        return reply.send({
            ok: true,
            taskId: task.task?.id,
            videoId: body.videoId,
        });
    } catch (err: any) {
        req.log.error(err, 'Transcode start failed');
        transcodeCounter.inc({ status: 'failed' });
        return reply.status(500).send({ error: err?.message || '转码启动失败' });
    }
});

/**
 * 获取转码状态
 * GET /transcode/status/:taskId
 */
app.get('/transcode/status/:taskId', async (req, reply) => {
    try {
        const { taskId } = req.params as { taskId: string };

        if (taskId.startsWith('sim_')) {
            return reply.send({ taskId, status: 'completed', simulated: true });
        }

        const task = await livepeer.task.get(taskId);

        return reply.send({
            taskId,
            status: task.task?.status?.phase,
            progress: task.task?.status?.progress,
            output: task.task?.output,
        });
    } catch (err: any) {
        return reply.status(500).send({ error: err?.message });
    }
});

/**
 * Livepeer Webhook 回调
 * POST /transcode/webhook
 */
app.post('/transcode/webhook', async (req, reply) => {
    try {
        const body = req.body as any;

        req.log.info({ event: body.event }, 'Livepeer webhook received');

        if (body.event === 'task.completed' && body.task?.id) {
            // 从 task output 中提取视频 ID
            const outputPath = body.task?.output?.hls?.path || '';
            const videoIdMatch = outputPath.match(/\/videos\/([^/]+)/);

            if (videoIdMatch) {
                const videoId = videoIdMatch[1];

                await prisma.video.update({
                    where: { id: videoId },
                    data: {
                        transcodeStatus: 'done',
                        transcodedUrls: JSON.stringify({
                            hls: `${MINIO_ENDPOINT}/${MINIO_BUCKET}/videos/${videoId}/hls/index.m3u8`,
                            '720p': `${MINIO_ENDPOINT}/${MINIO_BUCKET}/videos/${videoId}/mp4/720p.mp4`,
                            '480p': `${MINIO_ENDPOINT}/${MINIO_BUCKET}/videos/${videoId}/mp4/480p.mp4`,
                        }),
                    } as any,
                });

                transcodeCounter.inc({ status: 'completed' });
                req.log.info({ videoId }, 'Transcode completed');
            }
        }

        return reply.send({ ok: true });
    } catch (err: any) {
        req.log.error(err, 'Webhook processing failed');
        return reply.status(500).send({ error: err?.message });
    }
});

/**
 * 直接上传到 MinIO
 * POST /transcode/upload
 */
app.post('/transcode/upload', async (req, reply) => {
    try {
        const body = req.body as { videoId: string; filename: string; data: string };

        if (!body.videoId || !body.data) {
            return reply.status(400).send({ error: '缺少参数' });
        }

        const buffer = Buffer.from(body.data, 'base64');
        const key = `videos/${body.videoId}/${body.filename || 'video.mp4'}`;

        await minioClient.send(new PutObjectCommand({
            Bucket: MINIO_BUCKET,
            Key: key,
            Body: buffer,
            ContentType: 'video/mp4',
        }));

        const url = `${MINIO_ENDPOINT}/${MINIO_BUCKET}/${key}`;

        return reply.send({ ok: true, url });
    } catch (err: any) {
        return reply.status(500).send({ error: err?.message });
    }
});

// ============== 启动服务 ==============
const start = async () => {
    try {
        await app.listen({ port: PORT, host: '0.0.0.0' });
        console.log(`🎬 Transcode service (MinIO + Livepeer) running on port ${PORT}`);
    } catch (err) {
        app.log.error(err);
        process.exit(1);
    }
};

start();
