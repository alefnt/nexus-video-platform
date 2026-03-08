// FILE: /video-platform/shared/queue/index.ts
/**
 * 消息队列模块 - 基于 Bull (Redis)
 * 支持异步任务处理、延迟任务、重试机制
 * 
 * 环境变量:
 *   REDIS_URL - Redis 连接地址
 *   QUEUE_PREFIX - 队列前缀 (默认: vp)
 */

import { Queue, Worker, Job, QueueEvents, JobsOptions } from "bullmq";
import { getRedis } from "../stores/redis";

// ============== 队列名称常量 ==============

export const QUEUE_NAMES = {
    TRANSCODE: "transcode",      // 视频转码
    NOTIFICATION: "notification", // 通知推送
    EMAIL: "email",              // 邮件发送
    NFT_MINT: "nft-mint",        // NFT 铸造
    ANALYTICS: "analytics",      // 数据分析
    CLEANUP: "cleanup",          // 清理任务
    SETTLEMENT: "settlement",    // 支付结算 (Stream Pay / Fiber / Tips)
    STORAGE: "storage",          // 存储生命周期 (降温 / 审计)
} as const;

export type QueueName = typeof QUEUE_NAMES[keyof typeof QUEUE_NAMES];

// ============== 队列配置 ==============

const QUEUE_PREFIX = process.env.QUEUE_PREFIX || "vp";
const REDIS_URL = process.env.REDIS_URL || "redis://localhost:6379";

const defaultJobOptions: JobsOptions = {
    attempts: 3,
    backoff: {
        type: "exponential",
        delay: 1000,
    },
    removeOnComplete: {
        count: 1000,  // 保留最近 1000 个完成的任务
        age: 86400,   // 24 小时后清理
    },
    removeOnFail: {
        count: 5000,  // 保留最近 5000 个失败的任务
        age: 604800,  // 7 天后清理
    },
};

// ============== 队列实例管理 ==============

const queues = new Map<string, Queue>();
const workers = new Map<string, Worker>();

/**
 * 获取或创建队列实例
 */
export function getQueue(name: QueueName): Queue {
    if (!queues.has(name)) {
        const queue = new Queue(name, {
            connection: { url: REDIS_URL },
            prefix: QUEUE_PREFIX,
            defaultJobOptions,
        });
        queues.set(name, queue);
        console.log(`[Queue] Created queue: ${name}`);
    }
    return queues.get(name)!;
}

/**
 * 添加任务到队列
 */
export async function addJob<T>(
    queueName: QueueName,
    jobName: string,
    data: T,
    options?: Partial<JobsOptions>
): Promise<Job<T>> {
    const queue = getQueue(queueName);
    const job = await queue.add(jobName, data, options);
    console.log(`[Queue] Job added: ${queueName}/${jobName} (${job.id})`);
    return job;
}

/**
 * 添加延迟任务
 */
export async function addDelayedJob<T>(
    queueName: QueueName,
    jobName: string,
    data: T,
    delayMs: number
): Promise<Job<T>> {
    return addJob(queueName, jobName, data, { delay: delayMs });
}

/**
 * 添加定时重复任务
 */
export async function addRepeatingJob<T>(
    queueName: QueueName,
    jobName: string,
    data: T,
    pattern: string // cron pattern, e.g. "0 * * * *" (every hour)
): Promise<Job<T>> {
    const queue = getQueue(queueName);
    const job = await queue.add(jobName, data, {
        repeat: { pattern },
    });
    console.log(`[Queue] Repeating job added: ${queueName}/${jobName} (${pattern})`);
    return job;
}

// ============== Worker 创建 ==============

export type JobProcessor<T, R> = (job: Job<T>) => Promise<R>;

/**
 * 创建队列 Worker
 */
export function createWorker<T, R>(
    queueName: QueueName,
    processor: JobProcessor<T, R>,
    concurrency: number = 5
): Worker<T, R> {
    if (workers.has(queueName)) {
        console.warn(`[Queue] Worker for ${queueName} already exists`);
        return workers.get(queueName) as Worker<T, R>;
    }

    const worker = new Worker<T, R>(
        queueName,
        processor,
        {
            connection: { url: REDIS_URL },
            prefix: QUEUE_PREFIX,
            concurrency,
            limiter: {
                max: 100,        // 最多 100 个任务
                duration: 1000,  // 每秒
            },
        }
    );

    worker.on("completed", (job, result) => {
        console.log(`[Queue] Job completed: ${queueName}/${job.name} (${job.id})`);
    });

    worker.on("failed", (job, error) => {
        console.error(`[Queue] Job failed: ${queueName}/${job?.name} (${job?.id})`, error.message);
    });

    worker.on("error", (error) => {
        console.error(`[Queue] Worker error: ${queueName}`, error);
    });

    workers.set(queueName, worker);
    console.log(`[Queue] Worker started: ${queueName} (concurrency: ${concurrency})`);

    return worker;
}

// ============== 队列监控 ==============

export interface QueueStats {
    name: string;
    waiting: number;
    active: number;
    completed: number;
    failed: number;
    delayed: number;
}

/**
 * 获取队列统计信息
 */
export async function getQueueStats(queueName: QueueName): Promise<QueueStats> {
    const queue = getQueue(queueName);
    const [waiting, active, completed, failed, delayed] = await Promise.all([
        queue.getWaitingCount(),
        queue.getActiveCount(),
        queue.getCompletedCount(),
        queue.getFailedCount(),
        queue.getDelayedCount(),
    ]);

    return {
        name: queueName,
        waiting,
        active,
        completed,
        failed,
        delayed,
    };
}

/**
 * 获取所有队列统计
 */
export async function getAllQueueStats(): Promise<QueueStats[]> {
    const stats: QueueStats[] = [];
    for (const name of Object.values(QUEUE_NAMES)) {
        stats.push(await getQueueStats(name));
    }
    return stats;
}

// ============== 清理和关闭 ==============

/**
 * 优雅关闭所有队列和 Worker
 */
export async function closeAllQueues(): Promise<void> {
    console.log("[Queue] Closing all queues and workers...");

    // 先关闭 Workers
    for (const [name, worker] of workers) {
        await worker.close();
        console.log(`[Queue] Worker closed: ${name}`);
    }
    workers.clear();

    // 再关闭 Queues
    for (const [name, queue] of queues) {
        await queue.close();
        console.log(`[Queue] Queue closed: ${name}`);
    }
    queues.clear();

    console.log("[Queue] All queues closed");
}

// ============== 预定义任务类型 ==============

export interface TranscodeJobData {
    videoId: string;
    sourceUrl: string;
    profiles: string[];
}

export interface NotificationJobData {
    userId: string;
    type: "live_start" | "new_video" | "tip_received" | "achievement";
    title: string;
    body: string;
    data?: Record<string, any>;
}

export interface EmailJobData {
    to: string;
    subject: string;
    html: string;
    from?: string;
}

export interface NFTMintJobData {
    userId: string;
    videoId?: string;
    nftType: "ownership" | "access_pass" | "limited_edition" | "badge";
    metadata: Record<string, any>;
}
