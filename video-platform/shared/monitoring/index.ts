/**
 * Shared Monitoring Module
 * 
 * 统一的监控配置 - Prometheus + Sentry
 * 所有服务应使用此模块进行集成
 */

import * as Sentry from '@sentry/node';
import { register, Counter, Histogram, Gauge, collectDefaultMetrics } from 'prom-client';
import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';

// ============== Sentry 初始化 ==============

export function initSentry(serviceName: string) {
    const dsn = process.env.SENTRY_DSN;
    if (!dsn) {
        console.log(`[${serviceName}] Sentry DSN not configured, skipping`);
        return false;
    }

    Sentry.init({
        dsn,
        environment: process.env.NODE_ENV || 'development',
        release: `${serviceName}@1.0.0`,
        tracesSampleRate: 0.1, // 10% 采样率
        profilesSampleRate: 0.1,
    });

    console.log(`[${serviceName}] Sentry initialized`);
    return true;
}

// ============== Prometheus 指标 ==============

// 收集默认 Node.js 指标 (内存, CPU, 事件循环等)
collectDefaultMetrics({ prefix: 'nexus_' });

// HTTP 请求指标
export const httpRequestCounter = new Counter({
    name: 'nexus_http_requests_total',
    help: 'Total HTTP requests',
    labelNames: ['method', 'path', 'status'],
});

export const httpRequestDuration = new Histogram({
    name: 'nexus_http_request_duration_seconds',
    help: 'HTTP request duration in seconds',
    labelNames: ['method', 'path'],
    buckets: [0.01, 0.05, 0.1, 0.5, 1, 5, 10],
});

export const activeConnections = new Gauge({
    name: 'nexus_active_connections',
    help: 'Number of active connections',
});

// 业务指标
export const liveRoomsGauge = new Gauge({
    name: 'nexus_live_rooms_active',
    help: 'Number of active live rooms',
});

export const videoViewsCounter = new Counter({
    name: 'nexus_video_views_total',
    help: 'Total video views',
    labelNames: ['video_id'],
});

export const paymentCounter = new Counter({
    name: 'nexus_payments_total',
    help: 'Total payments processed',
    labelNames: ['type', 'status'],
});

export const transcodeCounter = new Counter({
    name: 'nexus_transcode_jobs_total',
    help: 'Total transcode jobs',
    labelNames: ['status'],
});

// ============== Fastify 插件 ==============

export function registerMonitoringHooks(app: FastifyInstance) {
    // 请求开始时记录时间
    app.addHook('onRequest', async (request: FastifyRequest) => {
        (request as any).startTime = Date.now();
        activeConnections.inc();
    });

    // 请求完成时记录指标
    app.addHook('onResponse', async (request: FastifyRequest, reply: FastifyReply) => {
        const duration = (Date.now() - ((request as any).startTime || Date.now())) / 1000;
        const path = normalizePath(request.url);

        httpRequestCounter.inc({
            method: request.method,
            path,
            status: reply.statusCode,
        });

        httpRequestDuration.observe(
            { method: request.method, path },
            duration
        );

        activeConnections.dec();
    });

    // 错误上报到 Sentry
    app.addHook('onError', async (request: FastifyRequest, reply: FastifyReply, error: Error) => {
        Sentry.captureException(error, {
            extra: {
                url: request.url,
                method: request.method,
                headers: request.headers,
            },
        });
    });
}

// 规范化路径，避免高基数 (去除动态参数)
function normalizePath(url: string): string {
    return url
        .split('?')[0] // 去除查询参数
        .replace(/\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, '/:id') // UUID
        .replace(/\/\d+/g, '/:num'); // 数字
}

// ============== Metrics 端点 ==============

export async function metricsHandler() {
    return register.metrics();
}

// ============== 导出 ==============

export { register, Sentry };
