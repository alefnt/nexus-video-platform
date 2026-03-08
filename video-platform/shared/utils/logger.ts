/**
 * 生产级结构化日志工具
 * FILE: /video-platform/shared/utils/logger.ts
 *
 * 封装 pino 日志（与 Fastify 内置 logger 一致），
 * 提供统一的 JSON 格式日志输出，适配 ELK/Loki 等日志系统。
 *
 * 使用示例:
 *   import { createLogger } from '@video-platform/shared/utils/logger';
 *   const logger = createLogger('identity');
 *   logger.info({ userId }, '用户登录成功');
 *   logger.error({ err }, '数据库查询失败');
 */

import pino from 'pino';

export interface LoggerOptions {
    /** 日志级别 (默认: 根据 NODE_ENV 决定) */
    level?: string;
    /** 是否美化输出 (开发模式自动启用) */
    pretty?: boolean;
}

/**
 * 创建服务日志实例
 * @param serviceName 服务名称（出现在每条日志的 service 字段中）
 * @param options 可选配置
 */
export function createLogger(serviceName: string, options?: LoggerOptions) {
    const isProduction = process.env.NODE_ENV === 'production';
    const level = options?.level || process.env.LOG_LEVEL || (isProduction ? 'info' : 'debug');
    const pretty = options?.pretty ?? !isProduction;

    const transport = pretty
        ? {
            target: 'pino-pretty',
            options: {
                colorize: true,
                translateTime: 'SYS:HH:MM:ss.l',
                ignore: 'pid,hostname',
            },
        }
        : undefined;

    return pino({
        level,
        ...(transport ? { transport } : {}),
        base: {
            service: serviceName,
            env: process.env.NODE_ENV || 'development',
        },
        timestamp: pino.stdTimeFunctions.isoTime,
        // 序列化 Error 对象
        serializers: {
            err: pino.stdSerializers.err,
            req: pino.stdSerializers.req,
            res: pino.stdSerializers.res,
        },
        // 生产环境使用 JSON 格式，方便 ELK/Loki 采集
        formatters: {
            level(label: string) {
                return { level: label };
            },
        },
    });
}

/**
 * 获取 Fastify 兼容的日志配置
 * 传递给 Fastify({ logger: getFastifyLoggerConfig('identity') })
 */
export function getFastifyLoggerConfig(serviceName: string) {
    const isProduction = process.env.NODE_ENV === 'production';

    if (isProduction) {
        return {
            level: process.env.LOG_LEVEL || 'info',
            serializers: {
                req(req: any) {
                    return {
                        method: req.method,
                        url: req.url,
                        remoteAddress: req.remoteAddress,
                    };
                },
            },
        };
    }

    return {
        level: 'debug',
        transport: {
            target: 'pino-pretty',
            options: {
                colorize: true,
                translateTime: 'SYS:HH:MM:ss.l',
            },
        },
    };
}
