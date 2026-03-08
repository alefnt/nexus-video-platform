// FILE: /video-platform/services/content/src/indexer.ts
/**
 * CKB Spore NFT 链上索引服务
 *
 * 替代 The Graph 的方案 — 使用 CKB 内置索引器 (v0.106+ RPC)
 * 和 Mercury 高级 API 来索引 Spore Cell 的创建、转移、销毁。
 *
 * 架构：
 *   CKB Node (testnet/mainnet)
 *   → JSON-RPC get_cells / get_transactions
 *   → 解析 Spore Cell data
 *   → 写入 PostgreSQL (via Prisma)
 *   → Redis 缓存查询结果
 *   → REST API 暴露给前端
 *
 * Mercury RPC 文档: https://github.com/nervosnetwork/mercury
 * CKB Indexer RPC: https://github.com/nervosnetwork/ckb-indexer
 *
 * 环境变量：
 *   CKB_RPC_URL       - CKB 节点 RPC (默认 testnet)
 *   CKB_NETWORK        - mainnet | testnet
 *   MERCURY_RPC_URL    - Mercury RPC 端点 (可选)
 *   INDEXER_POLL_INTERVAL_MS - 轮询间隔 (默认 15000ms)
 */

import { setKey, getKey, setWithFallback, getWithFallback } from '@video-platform/shared/stores/redis';

// ============== Configuration ==============

const CKB_RPC_URL = process.env.CKB_RPC_URL || 'https://testnet.ckbapp.dev';
const MERCURY_RPC_URL = process.env.MERCURY_RPC_URL || '';
const CKB_NETWORK = process.env.CKB_NETWORK || 'testnet';
const POLL_INTERVAL_MS = Number(process.env.INDEXER_POLL_INTERVAL_MS || 15000);

// Spore Protocol 合约的 code_hash (testnet / mainnet)
// 参考: https://github.com/sporeprotocol/spore-sdk
const SPORE_TYPE_SCRIPT: Record<string, { codeHash: string; hashType: string }> = {
    testnet: {
        codeHash: '0x685a60219309029d01310311dba953d67029170ca4848a4ff638e57002130a0d',
        hashType: 'data1',
    },
    mainnet: {
        codeHash: '0x4a4dce1df3dffff7f8b2cd7dff7303df3b6150c340b35571f6d7c7f2dff9c301',
        hashType: 'data1',
    },
};

// ============== Types ==============

export interface IndexedSporeAsset {
    sporeId: string;
    txHash: string;
    creator: string;        // CKB address
    owner: string;          // Current owner
    contentType: string;    // video/music/article
    contentHash?: string;   // SHA-256
    ipfsCid?: string;
    arweaveTxId?: string;
    createdAt: string;
    updatedAt: string;
    clusterId?: string;
    isAccessPass?: boolean;
}

export interface IndexerStats {
    lastBlockNumber: number;
    totalAssetsIndexed: number;
    lastPollTime: string;
    isRunning: boolean;
}

// ============== CKB RPC Client ==============

async function ckbRpc(method: string, params: any[]): Promise<any> {
    const response = await fetch(CKB_RPC_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            id: Date.now(),
            jsonrpc: '2.0',
            method,
            params,
        }),
    });
    const json = await response.json();
    if (json.error) {
        throw new Error(`CKB RPC error: ${json.error.message || JSON.stringify(json.error)}`);
    }
    return json.result;
}

/**
 * Mercury RPC 调用（高级查询接口）
 * Mercury 提供 get_balance, build_transfer_transaction 等便利方法
 */
async function mercuryRpc(method: string, params: any[]): Promise<any> {
    if (!MERCURY_RPC_URL) {
        throw new Error('Mercury RPC URL not configured');
    }
    const response = await fetch(MERCURY_RPC_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            id: Date.now(),
            jsonrpc: '2.0',
            method,
            params,
        }),
    });
    const json = await response.json();
    if (json.error) {
        throw new Error(`Mercury RPC error: ${json.error.message}`);
    }
    return json.result;
}

// ============== Spore Cell Parser ==============

/**
 * 解析 Spore Cell 的 data 字段，提取内容元数据。
 * Spore Cell data 是 Molecule 编码的，包含 contentType + content。
 * 简化解析：我们关注 type_script.args 中的 Spore ID。
 */
function parseSporeData(cellData: string): { contentType: string; content: string } | null {
    try {
        if (!cellData || cellData === '0x') return null;
        // Spore data format (Molecule):
        // total_size (4 bytes) + field_count (4 bytes) + offsets + content_type + content + cluster_id
        // For simplicity, we'll extract what we can from known offsets
        const data = cellData.startsWith('0x') ? cellData.slice(2) : cellData;
        if (data.length < 16) return null;

        // Read total size and field count from first 8 bytes
        // The actual parsing needs Molecule format handling
        // For now, return a simplified version
        return {
            contentType: 'application/json', // Would need Molecule decode
            content: data.substring(0, 128), // First 64 bytes as hex
        };
    } catch {
        return null;
    }
}

/**
 * 从 Spore Cell 的 type_script.args 提取 Spore ID
 */
function extractSporeId(typeScript: any): string {
    if (!typeScript?.args) return '';
    return typeScript.args;
}

// ============== Indexer Service ==============

export class CKBSporeIndexer {
    private lastProcessedBlock: number = 0;
    private isRunning = false;
    private pollTimer: NodeJS.Timeout | null = null;
    private assets: Map<string, IndexedSporeAsset> = new Map();
    private stats: IndexerStats = {
        lastBlockNumber: 0,
        totalAssetsIndexed: 0,
        lastPollTime: '',
        isRunning: false,
    };

    constructor() {
        this.loadState();
    }

    /** Load last processed block from Redis */
    private async loadState(): Promise<void> {
        try {
            const cached = await getKey('ckb_indexer_last_block');
            if (cached) this.lastProcessedBlock = parseInt(cached, 10);

            const cachedAssets = await getWithFallback<string>('ckb_indexer', 'assets_cache');
            if (cachedAssets) {
                const parsed = JSON.parse(cachedAssets);
                for (const [k, v] of Object.entries(parsed)) {
                    this.assets.set(k, v as IndexedSporeAsset);
                }
            }
        } catch {
            // Start from beginning if no cached state
        }
    }

    /** Save state to Redis */
    private async saveState(): Promise<void> {
        try {
            await setKey('ckb_indexer_last_block', String(this.lastProcessedBlock));
            const assetsObj: Record<string, IndexedSporeAsset> = {};
            for (const [k, v] of this.assets) assetsObj[k] = v;
            await setWithFallback('ckb_indexer', 'assets_cache', JSON.stringify(assetsObj), 3600);
        } catch (err) {
            console.error('[CKBIndexer] Failed to save state:', err);
        }
    }

    /**
     * Start the indexer polling loop.
     */
    start(): void {
        if (this.isRunning) {
            console.log('[CKBIndexer] Already running');
            return;
        }

        this.isRunning = true;
        this.stats.isRunning = true;
        console.log(`[CKBIndexer] Starting indexer on ${CKB_NETWORK} (${CKB_RPC_URL})`);
        console.log(`[CKBIndexer] Poll interval: ${POLL_INTERVAL_MS}ms`);

        this.poll(); // First poll immediately
        this.pollTimer = setInterval(() => this.poll(), POLL_INTERVAL_MS);
    }

    /**
     * Stop the indexer.
     */
    stop(): void {
        this.isRunning = false;
        this.stats.isRunning = false;
        if (this.pollTimer) {
            clearInterval(this.pollTimer);
            this.pollTimer = null;
        }
        console.log('[CKBIndexer] Stopped');
    }

    /**
     * Single poll iteration: query CKB for new Spore cells.
     */
    private async poll(): Promise<void> {
        try {
            const sporeScript = SPORE_TYPE_SCRIPT[CKB_NETWORK] || SPORE_TYPE_SCRIPT.testnet;

            // Use CKB built-in indexer RPC: get_cells
            // This queries for all live cells with the Spore type script
            const result = await ckbRpc('get_cells', [
                {
                    script: {
                        code_hash: sporeScript.codeHash,
                        hash_type: sporeScript.hashType,
                        args: '0x', // Match all Spore cells
                    },
                    script_type: 'type',
                },
                'asc',
                '0x64', // limit: 100
            ]);

            if (result?.objects) {
                let newCount = 0;
                for (const cell of result.objects) {
                    const sporeId = extractSporeId(cell.output?.type);
                    if (!sporeId || this.assets.has(sporeId)) continue;

                    const asset: IndexedSporeAsset = {
                        sporeId,
                        txHash: cell.out_point?.tx_hash || '',
                        creator: cell.output?.lock?.args || '',
                        owner: cell.output?.lock?.args || '',
                        contentType: 'unknown',
                        createdAt: new Date().toISOString(),
                        updatedAt: new Date().toISOString(),
                    };

                    // Try to parse Spore data for content metadata
                    const parsed = parseSporeData(cell.output_data || '');
                    if (parsed) {
                        asset.contentType = parsed.contentType;
                    }

                    this.assets.set(sporeId, asset);
                    newCount++;
                }

                if (newCount > 0) {
                    console.log(`[CKBIndexer] Indexed ${newCount} new Spore assets (total: ${this.assets.size})`);
                    await this.saveState();
                }
            }

            // Get current tip block
            const tipHeader = await ckbRpc('get_tip_header', []);
            if (tipHeader?.number) {
                this.lastProcessedBlock = parseInt(tipHeader.number, 16);
            }

            this.stats.lastBlockNumber = this.lastProcessedBlock;
            this.stats.totalAssetsIndexed = this.assets.size;
            this.stats.lastPollTime = new Date().toISOString();

        } catch (err: any) {
            console.error('[CKBIndexer] Poll error:', err?.message);
        }
    }

    // ============== Query APIs ==============

    /**
     * Get all Spore assets owned by an address.
     */
    async getAssetsByOwner(ownerAddress: string): Promise<IndexedSporeAsset[]> {
        // Check Redis cache first
        const cacheKey = `spore_assets_${ownerAddress}`;
        const cached = await getWithFallback<string>('ckb_indexer', cacheKey);
        if (cached) {
            try {
                return JSON.parse(cached);
            } catch { /* fall through */ }
        }

        // Query from in-memory index
        const results = Array.from(this.assets.values())
            .filter(a => a.owner === ownerAddress || a.creator === ownerAddress);

        // Cache for 60s
        await setWithFallback('ckb_indexer', cacheKey, JSON.stringify(results), 60);

        return results;
    }

    /**
     * Get a specific Spore asset by ID.
     */
    getAssetById(sporeId: string): IndexedSporeAsset | undefined {
        return this.assets.get(sporeId);
    }

    /**
     * Get all indexed assets (with pagination).
     */
    getAllAssets(offset: number = 0, limit: number = 50): { assets: IndexedSporeAsset[]; total: number } {
        const all = Array.from(this.assets.values());
        return {
            assets: all.slice(offset, offset + limit),
            total: all.length,
        };
    }

    /**
     * Get indexer statistics.
     */
    getStats(): IndexerStats {
        return { ...this.stats };
    }

    /**
     * Query Mercury for address balance (if Mercury is configured).
     */
    async getAddressBalance(address: string): Promise<{ ckb: string; udt: any[] } | null> {
        if (!MERCURY_RPC_URL) return null;
        try {
            const result = await mercuryRpc('get_balance', [{
                item: { type: 'Address', value: address },
                asset_infos: [],
            }]);
            return {
                ckb: result?.balances?.find((b: any) => b.asset_info?.asset_type === 'CKB')?.free || '0',
                udt: result?.balances?.filter((b: any) => b.asset_info?.asset_type === 'UDT') || [],
            };
        } catch (err: any) {
            console.error('[CKBIndexer] Mercury balance query error:', err?.message);
            return null;
        }
    }

    /**
     * Search assets by content hash (SHA-256).
     */
    searchByContentHash(sha256: string): IndexedSporeAsset[] {
        return Array.from(this.assets.values())
            .filter(a => a.contentHash === sha256);
    }
}

// ============== Singleton & Export ==============

export const sporeIndexer = new CKBSporeIndexer();

// Auto-start if run directly or if ENABLE_CKB_INDEXER is set
if (process.env.ENABLE_CKB_INDEXER === 'true' || process.argv.includes('--run-indexer')) {
    sporeIndexer.start();
    console.log('[CKBIndexer] Auto-started via environment flag');
}
