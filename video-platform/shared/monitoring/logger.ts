// FILE: /video-platform/shared/monitoring/logger.ts
/**
 * 统一结构化日志模块
 * 自动包含 traceId、服务名称、时间戳
 * 
 * 输出格式: JSON (便于 ELK/Loki 聚合)
 */

import { getCurrentTraceId } from "./tracing";

// ============== 日志级别 ==============

export enum LogLevel {
    DEBUG = "debug",
    INFO = "info",
    WARN = "warn",
    ERROR = "error",
    FATAL = "fatal",
}

const LOG_LEVEL_PRIORITY: Record<LogLevel, number> = {
    [LogLevel.DEBUG]: 0,
    [LogLevel.INFO]: 1,
    [LogLevel.WARN]: 2,
    [LogLevel.ERROR]: 3,
    [LogLevel.FATAL]: 4,
};

// ============== 日志条目 ==============

export interface LogEntry {
    timestamp: string;
    level: LogLevel;
    service: string;
    message: string;
    traceId?: string;
    spanId?: string;
    userId?: string;
    requestId?: string;
    duration?: number;
    error?: {
        name: string;
        message: string;
        stack?: string;
    };
    metadata?: Record<string, any>;
}

// ============== Logger 类 ==============

export class Logger {
    private serviceName: string;
    private minLevel: LogLevel;

    constructor(serviceName: string, minLevel: LogLevel = LogLevel.INFO) {
        this.serviceName = serviceName;
        this.minLevel = process.env.LOG_LEVEL as LogLevel || minLevel;
    }

    private shouldLog(level: LogLevel): boolean {
        return LOG_LEVEL_PRIORITY[level] >= LOG_LEVEL_PRIORITY[this.minLevel];
    }

    private formatEntry(level: LogLevel, message: string, context?: Partial<LogEntry>): LogEntry {
        return {
            timestamp: new Date().toISOString(),
            level,
            service: this.serviceName,
            message,
            traceId: context?.traceId || getCurrentTraceId(),
            ...context,
        };
    }

    private output(entry: LogEntry): void {
        if (process.env.NODE_ENV === "production") {
            // 生产环境: 纯 JSON 输出
            console.log(JSON.stringify(entry));
        } else {
            // 开发环境: 可读格式 + 颜色
            const colors = {
                [LogLevel.DEBUG]: "\x1b[36m", // cyan
                [LogLevel.INFO]: "\x1b[32m",  // green
                [LogLevel.WARN]: "\x1b[33m",  // yellow
                [LogLevel.ERROR]: "\x1b[31m", // red
                [LogLevel.FATAL]: "\x1b[35m", // magenta
            };
            const reset = "\x1b[0m";
            const traceStr = entry.traceId ? ` [${entry.traceId.slice(0, 8)}]` : "";
            console.log(
                `${colors[entry.level]}[${entry.level.toUpperCase()}]${reset} ${entry.timestamp}${traceStr} ${entry.message}`,
                entry.metadata ? entry.metadata : ""
            );
            if (entry.error?.stack) {
                console.error(entry.error.stack);
            }
        }
    }

    debug(message: string, context?: Partial<LogEntry>): void {
        if (!this.shouldLog(LogLevel.DEBUG)) return;
        this.output(this.formatEntry(LogLevel.DEBUG, message, context));
    }

    info(message: string, context?: Partial<LogEntry>): void {
        if (!this.shouldLog(LogLevel.INFO)) return;
        this.output(this.formatEntry(LogLevel.INFO, message, context));
    }

    warn(message: string, context?: Partial<LogEntry>): void {
        if (!this.shouldLog(LogLevel.WARN)) return;
        this.output(this.formatEntry(LogLevel.WARN, message, context));
    }

    error(message: string, err?: Error | unknown, context?: Partial<LogEntry>): void {
        if (!this.shouldLog(LogLevel.ERROR)) return;
        const errorInfo = err instanceof Error ? {
            name: err.name,
            message: err.message,
            stack: err.stack,
        } : err ? { name: "Unknown", message: String(err) } : undefined;

        this.output(this.formatEntry(LogLevel.ERROR, message, { ...context, error: errorInfo }));
    }

    fatal(message: string, err?: Error | unknown, context?: Partial<LogEntry>): void {
        const errorInfo = err instanceof Error ? {
            name: err.name,
            message: err.message,
            stack: err.stack,
        } : err ? { name: "Unknown", message: String(err) } : undefined;

        this.output(this.formatEntry(LogLevel.FATAL, message, { ...context, error: errorInfo }));
    }

    // 创建带有默认上下文的子 logger
    child(context: Partial<LogEntry>): ChildLogger {
        return new ChildLogger(this, context);
    }
}

// ============== Child Logger ==============

class ChildLogger {
    private parent: Logger;
    private defaultContext: Partial<LogEntry>;

    constructor(parent: Logger, defaultContext: Partial<LogEntry>) {
        this.parent = parent;
        this.defaultContext = defaultContext;
    }

    debug(message: string, context?: Partial<LogEntry>): void {
        this.parent.debug(message, { ...this.defaultContext, ...context });
    }

    info(message: string, context?: Partial<LogEntry>): void {
        this.parent.info(message, { ...this.defaultContext, ...context });
    }

    warn(message: string, context?: Partial<LogEntry>): void {
        this.parent.warn(message, { ...this.defaultContext, ...context });
    }

    error(message: string, err?: Error | unknown, context?: Partial<LogEntry>): void {
        this.parent.error(message, err, { ...this.defaultContext, ...context });
    }
}

// ============== 工厂函数 ==============

const loggers = new Map<string, Logger>();

export function createLogger(serviceName: string, minLevel?: LogLevel): Logger {
    if (!loggers.has(serviceName)) {
        loggers.set(serviceName, new Logger(serviceName, minLevel));
    }
    return loggers.get(serviceName)!;
}

// ============== 请求日志中间件 ==============

import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";

export function registerRequestLogging(app: FastifyInstance, serviceName: string): void {
    const logger = createLogger(serviceName);

    app.addHook("onResponse", (req: FastifyRequest, reply: FastifyReply, done) => {
        const duration = reply.elapsedTime;
        const traceId = req.headers["x-trace-id"] as string | undefined;

        // 只记录非健康检查请求
        if (!req.url.startsWith("/health") && !req.url.startsWith("/metrics")) {
            const level = reply.statusCode >= 500 ? LogLevel.ERROR :
                reply.statusCode >= 400 ? LogLevel.WARN : LogLevel.INFO;

            logger[level](`${req.method} ${req.url} ${reply.statusCode}`, {
                traceId,
                duration: Math.round(duration),
                metadata: {
                    method: req.method,
                    url: req.url,
                    statusCode: reply.statusCode,
                    userAgent: req.headers["user-agent"],
                },
            });
        }

        done();
    });
}
