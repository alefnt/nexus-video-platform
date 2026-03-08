// FILE: /video-platform/shared/stores/redis-sentinel.ts
/**
 * Redis Sentinel 客户端
 * 支持自动故障转移和读写分离
 * 
 * 环境变量:
 *   REDIS_SENTINEL_HOSTS - Sentinel 节点列表 (逗号分隔)
 *   REDIS_SENTINEL_MASTER - 主节点名称 (默认: mymaster)
 *   REDIS_PASSWORD - Redis 密码
 */

import Redis from "ioredis";

// ============== 配置 ==============

const SENTINEL_HOSTS = process.env.REDIS_SENTINEL_HOSTS || "localhost:26379,localhost:26380,localhost:26381";
const SENTINEL_MASTER = process.env.REDIS_SENTINEL_MASTER || "mymaster";
const REDIS_PASSWORD = process.env.REDIS_PASSWORD || "nexus123";

// 解析 Sentinel 节点
function parseSentinelHosts(): Array<{ host: string; port: number }> {
    return SENTINEL_HOSTS.split(",").map((hostPort) => {
        const [host, port] = hostPort.trim().split(":");
        return { host, port: parseInt(port) || 26379 };
    });
}

// ============== 客户端管理 ==============

let masterClient: Redis | null = null;
let replicaClient: Redis | null = null;

/**
 * 获取主节点客户端 (用于写操作)
 */
export function getMasterClient(): Redis {
    if (!masterClient) {
        masterClient = new Redis({
            sentinels: parseSentinelHosts(),
            name: SENTINEL_MASTER,
            password: REDIS_PASSWORD,
            sentinelPassword: REDIS_PASSWORD,
            role: "master",
            lazyConnect: true,
            maxRetriesPerRequest: 3,
            retryStrategy(times) {
                const delay = Math.min(times * 100, 3000);
                return delay;
            },
            reconnectOnError(err) {
                const targetErrors = ["READONLY", "ETIMEDOUT", "ECONNRESET"];
                return targetErrors.some((e) => err.message.includes(e));
            },
        });

        masterClient.on("connect", () => {
            console.log("[Redis Sentinel] Master connected");
        });

        masterClient.on("error", (err) => {
            console.error("[Redis Sentinel] Master error:", err.message);
        });

        masterClient.on("+switch-master", (name) => {
            console.log(`[Redis Sentinel] Master switched: ${name}`);
        });
    }

    return masterClient;
}

/**
 * 获取从节点客户端 (用于读操作)
 */
export function getReplicaClient(): Redis {
    if (!replicaClient) {
        replicaClient = new Redis({
            sentinels: parseSentinelHosts(),
            name: SENTINEL_MASTER,
            password: REDIS_PASSWORD,
            sentinelPassword: REDIS_PASSWORD,
            role: "slave",
            preferredSlaves: [
                // 优先选择本地从节点
                { ip: "localhost", port: "6380", prio: 1 },
                { ip: "localhost", port: "6381", prio: 2 },
            ],
            lazyConnect: true,
            maxRetriesPerRequest: 3,
            retryStrategy(times) {
                const delay = Math.min(times * 100, 3000);
                return delay;
            },
        });

        replicaClient.on("connect", () => {
            console.log("[Redis Sentinel] Replica connected");
        });

        replicaClient.on("error", (err) => {
            console.error("[Redis Sentinel] Replica error:", err.message);
        });
    }

    return replicaClient;
}

/**
 * 关闭所有连接
 */
export async function closeSentinelClients(): Promise<void> {
    if (masterClient) {
        await masterClient.quit();
        masterClient = null;
    }
    if (replicaClient) {
        await replicaClient.quit();
        replicaClient = null;
    }
    console.log("[Redis Sentinel] All clients closed");
}

// ============== 读写分离工具 ==============

/**
 * 写操作 (自动使用主节点)
 */
export async function writeToRedis(
    key: string,
    value: string,
    ttlSeconds?: number
): Promise<void> {
    const client = getMasterClient();
    if (ttlSeconds) {
        await client.setex(key, ttlSeconds, value);
    } else {
        await client.set(key, value);
    }
}

/**
 * 读操作 (优先使用从节点)
 */
export async function readFromRedis(key: string): Promise<string | null> {
    const client = getReplicaClient();
    return client.get(key);
}

/**
 * 删除操作 (使用主节点)
 */
export async function deleteFromRedis(key: string): Promise<void> {
    const client = getMasterClient();
    await client.del(key);
}

// ============== 健康检查 ==============

export interface SentinelHealth {
    master: { connected: boolean; info?: string };
    replica: { connected: boolean; info?: string };
    sentinels: number;
}

export async function checkSentinelHealth(): Promise<SentinelHealth> {
    const health: SentinelHealth = {
        master: { connected: false },
        replica: { connected: false },
        sentinels: 0,
    };

    try {
        const master = getMasterClient();
        const info = await master.info("replication");
        health.master = {
            connected: true,
            info: info.split("\n").find((l) => l.startsWith("role:")) || "master",
        };
    } catch (err: any) {
        health.master = { connected: false, info: err.message };
    }

    try {
        const replica = getReplicaClient();
        const info = await replica.info("replication");
        health.replica = {
            connected: true,
            info: info.split("\n").find((l) => l.startsWith("role:")) || "slave",
        };
    } catch (err: any) {
        health.replica = { connected: false, info: err.message };
    }

    try {
        const master = getMasterClient();
        const sentinelInfo = await (master as any).sentinel("sentinels", SENTINEL_MASTER);
        health.sentinels = Array.isArray(sentinelInfo) ? sentinelInfo.length + 1 : 1;
    } catch {
        health.sentinels = 0;
    }

    return health;
}
