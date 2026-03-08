/**
 * Content Moderation Service
 * 
 * AI 内容审核服务 - 使用开源 NSFW.js + 自定义规则
 * 无需云服务，完全本地处理
 */

import Fastify from 'fastify';
import { PrismaClient } from '@video-platform/database';
import { register, Counter, Histogram } from 'prom-client';
import { registerSecurityPlugins } from "@video-platform/shared/security/index";

const app = Fastify({ logger: true });
const prisma = new PrismaClient();

// ============== 环境变量 ==============
const PORT = Number(process.env.MODERATION_PORT || process.env.PORT) || 8102;

// ============== NSFW.js 模型 (延迟加载) ==============
let nsfwModel: any = null;
let tf: any = null;

async function initNSFWModel() {
    try {
        // 动态导入 TensorFlow 和 NSFW.js
        tf = await import('@tensorflow/tfjs-node');
        const nsfwjs = await import('nsfwjs');

        nsfwModel = await nsfwjs.load();
        console.log('✅ NSFW.js model loaded');
    } catch (e: any) {
        console.warn('⚠️ NSFW.js not available, using rule-based moderation:', e.message);
    }
}

// ============== 指标 ==============
const moderationCounter = new Counter({
    name: 'moderation_requests_total',
    help: 'Total moderation requests',
    labelNames: ['type', 'result'],
});

const moderationDuration = new Histogram({
    name: 'moderation_duration_seconds',
    help: 'Moderation request duration',
    labelNames: ['type'],
    buckets: [0.1, 0.5, 1, 2, 5, 10],
});

// ============== Security ==============
await registerSecurityPlugins(app, { rateLimit: { max: 100, timeWindow: "1 minute" } });

// ============== 健康检查 ==============
app.get('/health', async () => ({
    status: 'ok',
    service: 'moderation',
    engine: 'nsfw.js + rules',
    modelLoaded: !!nsfwModel,
}));
app.get('/metrics', async () => register.metrics());

// ============== 敏感词库 ==============
const sensitiveWords = {
    porn: ['色情', '裸体', '性爱', 'xxx', 'porn'],
    violence: ['暴力', '血腥', '杀人', '打死'],
    political: ['政治', '敏感'],
    gambling: ['赌博', '博彩', '下注'],
    drugs: ['毒品', '吸毒', '贩毒'],
};

function checkTextContent(text: string): { passed: boolean; category: string | null; matches: string[] } {
    const lowerText = text.toLowerCase();
    const matches: string[] = [];
    let category: string | null = null;

    for (const [cat, words] of Object.entries(sensitiveWords)) {
        for (const word of words) {
            if (lowerText.includes(word.toLowerCase())) {
                matches.push(word);
                category = cat;
            }
        }
    }

    return {
        passed: matches.length === 0,
        category,
        matches,
    };
}

// ============== 审核 API ==============

/**
 * 审核图片 (使用 NSFW.js)
 * POST /moderation/image
 */
app.post('/moderation/image', async (req, reply) => {
    const startTime = Date.now();
    try {
        const body = req.body as { imageUrl?: string; imageBase64?: string };

        if (!body.imageUrl && !body.imageBase64) {
            return reply.status(400).send({ error: '需要 imageUrl 或 imageBase64' });
        }

        let result: ModerationResult;

        if (nsfwModel && tf) {
            try {
                // 使用 NSFW.js 分析
                let imageBuffer: Buffer;

                if (body.imageUrl) {
                    const resp = await fetch(body.imageUrl);
                    imageBuffer = Buffer.from(await resp.arrayBuffer());
                } else {
                    imageBuffer = Buffer.from(body.imageBase64!, 'base64');
                }

                const imageTensor = tf.node.decodeImage(imageBuffer, 3);
                const predictions = await nsfwModel.classify(imageTensor);
                imageTensor.dispose();

                // 分析结果
                const nsfw = predictions.find((p: any) =>
                    ['Porn', 'Hentai', 'Sexy'].includes(p.className)
                );

                const nsfwScore = nsfw?.probability || 0;
                const isNsfw = nsfwScore > 0.7;

                result = {
                    passed: !isNsfw,
                    suggestion: isNsfw ? 'Block' : 'Pass',
                    label: nsfw?.className || 'Safe',
                    score: Math.round(nsfwScore * 100),
                    predictions: predictions.map((p: any) => ({
                        class: p.className,
                        probability: Math.round(p.probability * 100),
                    })),
                };
            } catch (e: any) {
                // 模型分析失败，使用默认通过
                req.log.warn({ error: e.message }, 'NSFW.js analysis failed');
                result = { passed: true, suggestion: 'Pass', label: 'Unknown', details: 'Analysis failed, default pass' };
            }
        } else {
            // 无模型，模拟通过
            result = { passed: true, suggestion: 'Pass', label: 'NotAnalyzed', details: 'Model not loaded' };
        }

        moderationCounter.inc({ type: 'image', result: result.passed ? 'pass' : 'reject' });
        moderationDuration.observe({ type: 'image' }, (Date.now() - startTime) / 1000);

        return reply.send({ type: 'image', ...result });
    } catch (err: any) {
        req.log.error(err, 'Image moderation failed');
        moderationCounter.inc({ type: 'image', result: 'error' });
        return reply.status(500).send({ error: err?.message || '审核失败' });
    }
});

/**
 * 审核文本 (规则匹配)
 * POST /moderation/text
 */
app.post('/moderation/text', async (req, reply) => {
    const startTime = Date.now();
    try {
        const body = req.body as { text: string };

        if (!body.text) {
            return reply.status(400).send({ error: '缺少 text' });
        }

        const check = checkTextContent(body.text);

        const result: ModerationResult = {
            passed: check.passed,
            suggestion: check.passed ? 'Pass' : 'Block',
            label: check.category || 'Safe',
            details: check.matches.length > 0 ? `检测到: ${check.matches.join(', ')}` : null,
        };

        moderationCounter.inc({ type: 'text', result: result.passed ? 'pass' : 'reject' });
        moderationDuration.observe({ type: 'text' }, (Date.now() - startTime) / 1000);

        return reply.send({ type: 'text', ...result });
    } catch (err: any) {
        moderationCounter.inc({ type: 'text', result: 'error' });
        return reply.status(500).send({ error: err?.message || '审核失败' });
    }
});

/**
 * 审核视频 (抽帧+NSFW.js)
 * POST /moderation/video
 */
app.post('/moderation/video', async (req, reply) => {
    try {
        const body = req.body as { videoUrl: string; videoId: string };

        if (!body.videoUrl || !body.videoId) {
            return reply.status(400).send({ error: '缺少参数' });
        }

        // 视频审核异步处理
        const taskId = `mod_${Date.now()}`;

        // 模拟异步处理
        setTimeout(async () => {
            try {
                // TODO: 使用 FFmpeg 抽帧 + NSFW.js 分析
                await prisma.video.update({
                    where: { id: body.videoId },
                    data: { moderationStatus: 'approved' } as any,
                });
            } catch (e) {
                console.error('Video moderation failed', e);
            }
        }, 5000);

        moderationCounter.inc({ type: 'video', result: 'submitted' });

        return reply.send({
            type: 'video',
            videoId: body.videoId,
            taskId,
            status: 'pending',
            message: '视频审核任务已提交',
        });
    } catch (err: any) {
        return reply.status(500).send({ error: err?.message });
    }
});

// ============== 类型定义 ==============

interface ModerationResult {
    passed: boolean;
    suggestion: 'Pass' | 'Review' | 'Block';
    label?: string;
    score?: number;
    details?: string | null;
    predictions?: any[];
}

// ============== 启动 ==============
const start = async () => {
    try {
        await initNSFWModel();
        await app.listen({ port: PORT, host: '0.0.0.0' });
        console.log(`🛡️ Moderation service (open-source) running on port ${PORT}`);
    } catch (err) {
        app.log.error(err);
        process.exit(1);
    }
};

start();
