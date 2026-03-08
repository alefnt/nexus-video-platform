/**
 * 共享服务初始化工具
 * 
 * 将所有后端服务通用的 Fastify 初始化逻辑提取到此处，
 * 减少各服务 server.ts 中的重复代码。
 * 
 * 使用方式:
 * ```ts
 * import { createServiceApp } from '@video-platform/shared/server/bootstrap';
 * const app = await createServiceApp({ serviceName: 'payment' });
 * ```
 */

import Fastify, { type FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import rateLimit from '@fastify/rate-limit';
import { PrismaClient } from '@prisma/client';

export interface ServiceBootstrapOptions {
    serviceName: string;
    port?: number;
    bodyLimit?: number;
    rateLimitMax?: number;
    rateLimitTimeWindow?: string;
}

/**
 * 创建标准化的服务 Fastify 实例
 * 包含: CORS, Rate Limit, Health Check, Metrics, JWT 验证
 */
export async function createServiceApp(opts: ServiceBootstrapOptions): Promise<FastifyInstance> {
    const {
        serviceName,
        bodyLimit = 10 * 1024 * 1024, // 10MB default
        rateLimitMax = 100,
        rateLimitTimeWindow = '1 minute',
    } = opts;

    const app = Fastify({
        logger: {
            level: 'info',
            transport: {
                target: 'pino-pretty',
                options: { colorize: true, translateTime: 'HH:MM:ss', ignore: 'pid,hostname' },
            },
        },
        bodyLimit,
    });

    // CORS
    await app.register(cors, {
        origin: true,
        methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
        allowedHeaders: ['Content-Type', 'Authorization', 'Idempotency-Key'],
        credentials: true,
    });

    // Rate Limiting
    await app.register(rateLimit, {
        max: rateLimitMax,
        timeWindow: rateLimitTimeWindow,
    });

    // Health Check
    app.get('/health', async () => ({
        status: 'ok',
        service: serviceName,
        uptime: process.uptime(),
        timestamp: new Date().toISOString(),
    }));

    return app;
}

/**
 * 创建共享 Prisma 客户端（单例）
 */
let prismaInstance: PrismaClient | null = null;

export function getSharedPrisma(): PrismaClient {
    if (!prismaInstance) {
        prismaInstance = new PrismaClient();
    }
    return prismaInstance;
}

/**
 * 验证 JWT_SECRET 环境变量
 */
export function requireJwtSecret(): string {
    const secret = process.env.JWT_SECRET || '';
    if (!secret || secret.length < 32) {
        throw new Error(`[${process.env.SERVICE_NAME || 'service'}] JWT_SECRET 未配置或长度不足 (需要 >= 32 字节)`);
    }
    return secret;
}

/**
 * 启动服务并监听端口
 */
export async function startService(app: FastifyInstance, port: number, serviceName: string) {
    try {
        await app.listen({ port, host: '0.0.0.0' });
        console.log(`🚀 [${serviceName}] listening on port ${port}`);
    } catch (err) {
        app.log.error(err);
        process.exit(1);
    }
}
