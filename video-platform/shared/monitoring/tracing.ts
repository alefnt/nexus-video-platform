// FILE: /video-platform/shared/monitoring/tracing.ts
/**
 * 分布式追踪模块
 * 支持 OpenTelemetry 兼容的追踪和上下文传播
 * 
 * 环境变量:
 *   OTEL_EXPORTER_OTLP_ENDPOINT - OTLP 导出地址
 *   OTEL_SERVICE_NAME - 服务名称
 *   ENABLE_TRACING - 是否启用追踪 (默认: false)
 */

import crypto from "node:crypto";
import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";

// ============== TraceId 生成与传播 ==============

/**
 * 生成追踪 ID (W3C Trace Context 格式)
 */
export function generateTraceId(): string {
    return crypto.randomBytes(16).toString("hex");
}

/**
 * 生成 Span ID
 */
export function generateSpanId(): string {
    return crypto.randomBytes(8).toString("hex");
}

/**
 * 解析 traceparent header (W3C Trace Context)
 * 格式: 00-<trace-id>-<parent-span-id>-<flags>
 */
export function parseTraceparent(header: string | undefined): {
    traceId: string;
    parentSpanId: string;
    sampled: boolean;
} | null {
    if (!header) return null;

    const parts = header.split("-");
    if (parts.length !== 4) return null;

    return {
        traceId: parts[1],
        parentSpanId: parts[2],
        sampled: parts[3] === "01",
    };
}

/**
 * 构建 traceparent header
 */
export function buildTraceparent(traceId: string, spanId: string, sampled: boolean = true): string {
    const flags = sampled ? "01" : "00";
    return `00-${traceId}-${spanId}-${flags}`;
}

// ============== 追踪上下文 ==============

export interface TraceContext {
    traceId: string;
    spanId: string;
    parentSpanId?: string;
    serviceName: string;
    operationName: string;
    startTime: number;
    tags: Record<string, string | number | boolean>;
}

// AsyncLocalStorage 用于跨异步边界传播上下文
import { AsyncLocalStorage } from "node:async_hooks";

const traceStorage = new AsyncLocalStorage<TraceContext>();

/**
 * 获取当前追踪上下文
 */
export function getTraceContext(): TraceContext | undefined {
    return traceStorage.getStore();
}

/**
 * 获取当前 traceId
 */
export function getCurrentTraceId(): string | undefined {
    return traceStorage.getStore()?.traceId;
}

/**
 * 在追踪上下文中运行函数
 */
export function runWithTraceContext<T>(context: TraceContext, fn: () => T): T {
    return traceStorage.run(context, fn);
}

// ============== Span 记录 ==============

export interface SpanEvent {
    name: string;
    timestamp: number;
    attributes?: Record<string, any>;
}

export interface Span {
    traceId: string;
    spanId: string;
    parentSpanId?: string;
    operationName: string;
    serviceName: string;
    startTime: number;
    endTime?: number;
    duration?: number;
    status: "ok" | "error" | "unset";
    tags: Record<string, string | number | boolean>;
    events: SpanEvent[];
}

// 内存中的 Span 收集器 (生产环境应使用 OTLP 导出)
const spanBuffer: Span[] = [];
const MAX_SPAN_BUFFER = 1000;

/**
 * 记录完成的 Span
 */
export function recordSpan(span: Span): void {
    if (spanBuffer.length >= MAX_SPAN_BUFFER) {
        spanBuffer.shift(); // 移除最旧的
    }
    spanBuffer.push(span);

    // 日志输出 (结构化)
    if (process.env.NODE_ENV === "development") {
        console.log(JSON.stringify({
            type: "span",
            ...span,
            duration: span.endTime ? span.endTime - span.startTime : undefined,
        }));
    }
}

/**
 * 获取最近的 Spans (调试用)
 */
export function getRecentSpans(limit: number = 100): Span[] {
    return spanBuffer.slice(-limit);
}

// ============== Fastify 追踪插件 ==============

export interface TracingPluginOptions {
    serviceName: string;
    enabled?: boolean;
    sampleRate?: number; // 0-1 采样率
    ignorePaths?: string[]; // 忽略的路径
}

/**
 * Fastify 追踪插件
 * 自动为每个请求创建 Span 并传播 TraceId
 */
export function registerTracingPlugin(
    app: FastifyInstance,
    options: TracingPluginOptions
): void {
    const {
        serviceName,
        enabled = process.env.ENABLE_TRACING === "true",
        sampleRate = 1.0,
        ignorePaths = ["/health", "/metrics"],
    } = options;

    if (!enabled) {
        console.log(`[Tracing] Disabled for ${serviceName} (set ENABLE_TRACING=true to enable)`);
        return;
    }

    app.addHook("onRequest", async (req: FastifyRequest, _reply: FastifyReply) => {
        // 忽略特定路径
        if (ignorePaths.some(p => req.url.startsWith(p))) return;

        // 采样决策
        if (Math.random() > sampleRate) return;

        // 解析或生成 traceId
        const traceparent = req.headers["traceparent"] as string | undefined;
        const parsed = parseTraceparent(traceparent);

        const traceId = parsed?.traceId || generateTraceId();
        const spanId = generateSpanId();
        const parentSpanId = parsed?.parentSpanId;

        // 创建追踪上下文
        const context: TraceContext = {
            traceId,
            spanId,
            parentSpanId,
            serviceName,
            operationName: `${req.method} ${req.routeOptions?.url || req.url}`,
            startTime: Date.now(),
            tags: {
                "http.method": req.method,
                "http.url": req.url,
                "http.host": req.hostname || "",
            },
        };

        // 注入到请求头 (方便日志使用)
        req.headers["x-trace-id"] = traceId;
        req.headers["x-span-id"] = spanId;

        // 存储到 req 对象
        (req as any).traceContext = context;
    });

    app.addHook("onResponse", async (req: FastifyRequest, reply: FastifyReply) => {
        const context = (req as any).traceContext as TraceContext | undefined;
        if (!context) return;

        const endTime = Date.now();
        const span: Span = {
            traceId: context.traceId,
            spanId: context.spanId,
            parentSpanId: context.parentSpanId,
            operationName: context.operationName,
            serviceName: context.serviceName,
            startTime: context.startTime,
            endTime,
            duration: endTime - context.startTime,
            status: reply.statusCode >= 400 ? "error" : "ok",
            tags: {
                ...context.tags,
                "http.status_code": reply.statusCode,
            },
            events: [],
        };

        recordSpan(span);

        // 在响应头中返回 traceId (方便前端调试)
        reply.header("x-trace-id", context.traceId);
    });

    console.log(`[Tracing] Enabled for ${serviceName} (sample rate: ${sampleRate * 100}%)`);
}

// ============== 手动 Span 创建 ==============

/**
 * 创建子 Span 用于追踪内部操作
 */
export function createChildSpan(operationName: string): {
    spanId: string;
    end: (status?: "ok" | "error", tags?: Record<string, any>) => void;
} {
    const parent = getTraceContext();
    const spanId = generateSpanId();
    const startTime = Date.now();

    return {
        spanId,
        end: (status = "ok", tags = {}) => {
            if (!parent) return;

            const span: Span = {
                traceId: parent.traceId,
                spanId,
                parentSpanId: parent.spanId,
                operationName,
                serviceName: parent.serviceName,
                startTime,
                endTime: Date.now(),
                duration: Date.now() - startTime,
                status,
                tags,
                events: [],
            };

            recordSpan(span);
        },
    };
}

// ============== 追踪统计 ==============

export function getTracingStats(): {
    spanCount: number;
    avgDurationMs: number;
    errorRate: number;
} {
    if (spanBuffer.length === 0) {
        return { spanCount: 0, avgDurationMs: 0, errorRate: 0 };
    }

    const totalDuration = spanBuffer.reduce((sum, s) => sum + (s.duration || 0), 0);
    const errorCount = spanBuffer.filter(s => s.status === "error").length;

    return {
        spanCount: spanBuffer.length,
        avgDurationMs: Math.round(totalDuration / spanBuffer.length),
        errorRate: Math.round((errorCount / spanBuffer.length) * 100) / 100,
    };
}
