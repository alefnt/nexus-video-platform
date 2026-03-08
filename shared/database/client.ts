// FILE: /video-platform/shared/database/client.ts
/**
 * 共享数据库客户端
 * 提供连接池配置和共享 Prisma 实例
 * 
 * 环境变量:
 *   DATABASE_URL - 数据库连接 URL
 *   DB_POOL_SIZE - 连接池大小 (默认: 10)
 *   DB_POOL_TIMEOUT - 连接超时秒数 (默认: 30)
 */

import { PrismaClient, Prisma } from "@video-platform/database";

// 连接池配置
const DB_POOL_SIZE = Number(process.env.DB_POOL_SIZE || 10);
const DB_POOL_TIMEOUT = Number(process.env.DB_POOL_TIMEOUT || 30);

// 构建带连接池参数的 DATABASE_URL
function buildDatabaseUrl(): string {
    const baseUrl = process.env.DATABASE_URL || "";
    if (!baseUrl) return "";

    // 检查是否已有查询参数
    const hasParams = baseUrl.includes("?");
    const separator = hasParams ? "&" : "?";

    // 添加连接池参数
    return `${baseUrl}${separator}connection_limit=${DB_POOL_SIZE}&pool_timeout=${DB_POOL_TIMEOUT}`;
}

// 全局单例
let prismaClient: PrismaClient | null = null;

/**
 * 获取 Prisma 客户端单例
 */
export function getPrisma(): PrismaClient {
    if (!prismaClient) {
        prismaClient = new PrismaClient({
            log: process.env.NODE_ENV === "development"
                ? ["query", "info", "warn", "error"]
                : ["warn", "error"],
            datasources: {
                db: {
                    url: buildDatabaseUrl(),
                },
            },
        });

        console.log(`[Database] Prisma client initialized (pool_size=${DB_POOL_SIZE}, timeout=${DB_POOL_TIMEOUT}s)`);
    }
    return prismaClient;
}

/**
 * 关闭数据库连接
 */
export async function closePrisma(): Promise<void> {
    if (prismaClient) {
        await prismaClient.$disconnect();
        prismaClient = null;
        console.log("[Database] Connection closed");
    }
}

/**
 * 健康检查
 */
export async function checkDatabaseHealth(): Promise<{
    connected: boolean;
    latencyMs?: number;
    error?: string;
}> {
    try {
        const start = Date.now();
        const prisma = getPrisma();
        await prisma.$queryRaw`SELECT 1`;
        const latencyMs = Date.now() - start;
        return { connected: true, latencyMs };
    } catch (err: any) {
        return { connected: false, error: err.message };
    }
}

/**
 * 优雅关闭处理
 */
export function setupGracefulShutdown(): void {
    const signals: NodeJS.Signals[] = ["SIGTERM", "SIGINT"];

    for (const signal of signals) {
        process.on(signal, async () => {
            console.log(`[Database] Received ${signal}, closing connections...`);
            await closePrisma();
            process.exit(0);
        });
    }
}

// ============== 查询增强工具 ==============

/**
 * 带重试的数据库操作
 */
export async function withRetry<T>(
    operation: () => Promise<T>,
    maxRetries: number = 3,
    baseDelayMs: number = 100
): Promise<T> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
        try {
            return await operation();
        } catch (err: any) {
            lastError = err;

            // 判断是否为可重试错误
            const isRetryable =
                err.code === "P2024" || // Connection pool timeout
                err.code === "P2010" || // Raw query failed
                err.code === "P1017" || // Server closed connection
                err.message?.includes("Connection");

            if (!isRetryable || attempt === maxRetries - 1) {
                throw err;
            }

            // 指数退避
            const delay = baseDelayMs * Math.pow(2, attempt);
            console.warn(`[Database] Retry ${attempt + 1}/${maxRetries} after ${delay}ms:`, err.code || err.message);
            await new Promise(resolve => setTimeout(resolve, delay));
        }
    }

    throw lastError;
}

/**
 * 分页查询帮助函数（游标分页）
 */
export interface CursorPaginationParams {
    cursor?: string;
    take?: number;
}

export interface CursorPaginationResult<T> {
    items: T[];
    nextCursor?: string;
    hasMore: boolean;
}

export function buildCursorPagination(
    params: CursorPaginationParams,
    defaultTake: number = 20,
    maxTake: number = 100
): { cursor?: { id: string }; take: number; skip: number } {
    const take = Math.min(params.take || defaultTake, maxTake);

    if (params.cursor) {
        return {
            cursor: { id: params.cursor },
            take: take + 1, // 多取一个用于判断 hasMore
            skip: 1, // 跳过 cursor 本身
        };
    }

    return {
        take: take + 1,
        skip: 0,
    };
}

export function processCursorResult<T extends { id: string }>(
    items: T[],
    take: number
): CursorPaginationResult<T> {
    const hasMore = items.length > take;
    const resultItems = hasMore ? items.slice(0, -1) : items;
    const nextCursor = hasMore ? resultItems[resultItems.length - 1]?.id : undefined;

    return {
        items: resultItems,
        nextCursor,
        hasMore,
    };
}

/**
 * Alias for closePrisma — matches the import name used by consuming services
 * (`@video-platform/shared/database/client`).
 */
export const disconnectDatabase = closePrisma;

// 导出 Prisma 类型
export { Prisma };
