// FILE: /video-platform/services/content/src/dataLifecycle.ts
/**
 * 数据生命周期管理器
 *
 * 定时扫描 StorageManifest，自动执行数据温度降级：
 *   hot (MinIO/S3) → warm (Filecoin/IPFS) → cold (Arweave)
 *
 * 降温策略：
 *   - accessCount < 10 && age > 7d   → 提前降温到 Filecoin
 *   - age > 30d (lastAccess)          → 标准降温到 Filecoin
 *   - age > 90d                       → 归档到 Arweave (仅元数据)
 *   - contentType === 'article'       → 创建即存 Arweave (由上传流程处理)
 *
 * 运行方式：可作为独立 cron 进程，也可被 content service 导入调用
 */

import { getManifestStore, type StorageManifestEntry } from '@video-platform/shared/storage/storageManifest';
import { FilecoinStorageClient } from '@video-platform/shared/web3/filecoin';
import { uploadToArweave, getArweaveUrl } from '@video-platform/shared/web3/arweave';
import { getObject } from '@video-platform/shared/storage/minio-client';

// ============== Configuration ==============

const HOT_MAX_AGE_DAYS = Number(process.env.LIFECYCLE_HOT_MAX_DAYS || 30);
const WARM_MAX_AGE_DAYS = Number(process.env.LIFECYCLE_WARM_MAX_DAYS || 90);
const EARLY_COOLDOWN_DAYS = Number(process.env.LIFECYCLE_EARLY_COOLDOWN_DAYS || 7);
const EARLY_COOLDOWN_ACCESS_THRESHOLD = Number(process.env.LIFECYCLE_EARLY_ACCESS_THRESHOLD || 10);
const BATCH_SIZE = Number(process.env.LIFECYCLE_BATCH_SIZE || 10);
const ARWEAVE_METADATA_ONLY = (process.env.LIFECYCLE_ARWEAVE_METADATA_ONLY || 'true') === 'true'; // 推荐：仅存元数据

// ============== Types ==============

export interface LifecycleRunResult {
    scannedCount: number;
    cooledToWarm: number;
    cooledToCold: number;
    errors: Array<{ contentId: string; error: string }>;
    durationMs: number;
}

// ============== Lifecycle Manager ==============

export class DataLifecycleManager {
    private manifest = getManifestStore();
    private filecoin = new FilecoinStorageClient();

    /**
     * Run a full lifecycle scan and execute cooldown operations.
     */
    async run(): Promise<LifecycleRunResult> {
        const startTime = Date.now();
        const result: LifecycleRunResult = {
            scannedCount: 0,
            cooledToWarm: 0,
            cooledToCold: 0,
            errors: [],
            durationMs: 0,
        };

        console.log('[DataLifecycle] Starting lifecycle scan...');
        const candidates = this.manifest.getCooldownCandidates(HOT_MAX_AGE_DAYS, WARM_MAX_AGE_DAYS);
        result.scannedCount = candidates.length;
        console.log(`[DataLifecycle] Found ${candidates.length} cooldown candidates`);

        // Process in batches
        for (let i = 0; i < candidates.length; i += BATCH_SIZE) {
            const batch = candidates.slice(i, i + BATCH_SIZE);
            await Promise.allSettled(
                batch.map(entry => this.processEntry(entry, result))
            );
        }

        result.durationMs = Date.now() - startTime;
        console.log(`[DataLifecycle] Complete: ${result.cooledToWarm} → warm, ${result.cooledToCold} → cold, ${result.errors.length} errors (${result.durationMs}ms)`);

        // Auto-save manifest after batch
        this.manifest.save();

        return result;
    }

    /**
     * Process a single entry for cooldown.
     */
    private async processEntry(entry: StorageManifestEntry, result: LifecycleRunResult): Promise<void> {
        try {
            const now = Date.now();
            const lastAccess = new Date(entry.lastAccessedAt).getTime();
            const ageDays = (now - lastAccess) / (1000 * 60 * 60 * 24);

            if (entry.temperature === 'hot') {
                // Hot → Warm (Filecoin)
                const shouldCoolEarly = entry.accessCount < EARLY_COOLDOWN_ACCESS_THRESHOLD && ageDays > EARLY_COOLDOWN_DAYS;
                const shouldCoolStandard = ageDays > HOT_MAX_AGE_DAYS;

                if (shouldCoolEarly || shouldCoolStandard) {
                    await this.coolToWarm(entry);
                    result.cooledToWarm++;
                }
            } else if (entry.temperature === 'warm') {
                // Warm → Cold (Arweave metadata)
                if (ageDays > WARM_MAX_AGE_DAYS) {
                    await this.coolToCold(entry);
                    result.cooledToCold++;
                }
            }
        } catch (err: any) {
            console.error(`[DataLifecycle] Error processing ${entry.contentId}:`, err?.message);
            result.errors.push({ contentId: entry.contentId, error: err?.message || 'Unknown error' });
        }
    }

    /**
     * Cool down from hot → warm (upload to Filecoin/IPFS).
     */
    private async coolToWarm(entry: StorageManifestEntry): Promise<void> {
        if (entry.warm) {
            // Already on warm — just update temperature
            this.manifest.update(entry.contentId, { temperature: 'warm' });
            return;
        }

        console.log(`[DataLifecycle] Cooling ${entry.contentId} to warm (Filecoin)`);

        // Read file from MinIO
        if (!entry.hot?.key) {
            console.warn(`[DataLifecycle] No hot storage key for ${entry.contentId}, skipping`);
            return;
        }

        let fileBuffer: Buffer;
        try {
            fileBuffer = await getObject(entry.hot.key);
        } catch (err: any) {
            console.error(`[DataLifecycle] Failed to read ${entry.hot.key} from MinIO:`, err?.message);
            return;
        }

        // Upload to Filecoin via IPFS
        const ext = entry.contentType === 'music' ? '.mp3' : entry.contentType === 'article' ? '.md' : '.mp4';
        const result = await this.filecoin.uploadFile(fileBuffer, `${entry.contentId}${ext}`);

        if (result.success && result.cid) {
            this.manifest.update(entry.contentId, {
                temperature: 'warm',
                warm: {
                    provider: 'filecoin',
                    cid: result.cid,
                    dealId: result.filecoinDealId,
                    ipfsUrl: result.ipfsUrl || '',
                    migratedAt: new Date().toISOString(),
                },
            });
            console.log(`[DataLifecycle] ✅ ${entry.contentId} → Filecoin CID: ${result.cid}`);
        } else {
            throw new Error(`Filecoin upload failed: ${result.error}`);
        }
    }

    /**
     * Cool down from warm → cold (archive to Arweave).
     * By default only stores metadata JSON, not the full file (cost optimization).
     */
    private async coolToCold(entry: StorageManifestEntry): Promise<void> {
        if (entry.cold) {
            // Already on cold — just update temperature
            this.manifest.update(entry.contentId, { temperature: 'cold' });
            return;
        }

        console.log(`[DataLifecycle] Archiving ${entry.contentId} to cold (Arweave)`);

        let uploadBuffer: Buffer;
        let contentType: string;

        if (ARWEAVE_METADATA_ONLY) {
            // 推荐模式：仅存版权证书 JSON (~1KB)
            const copyrightProof = {
                platform: 'NexusVideo',
                version: '1.0',
                contentId: entry.contentId,
                contentType: entry.contentType,
                sha256: entry.sha256,
                creator: entry.creatorAddress || 'unknown',
                title: entry.title || 'Untitled',
                createdAt: entry.createdAt,
                fileSizeBytes: entry.fileSizeBytes,
                ipfsCid: entry.warm?.cid,
                filecoinDealId: entry.warm?.dealId,
                archivedAt: new Date().toISOString(),
            };
            uploadBuffer = Buffer.from(JSON.stringify(copyrightProof, null, 2));
            contentType = 'application/json';
        } else {
            // Full file mode (expensive! ~$3.50/GB one-time)
            if (entry.hot?.key) {
                uploadBuffer = await getObject(entry.hot.key);
            } else {
                throw new Error('No hot storage key and full file mode enabled');
            }
            contentType = entry.contentType === 'music' ? 'audio/mpeg' : entry.contentType === 'article' ? 'text/markdown' : 'video/mp4';
        }

        const result = await uploadToArweave(uploadBuffer, {
            contentType,
            tags: [
                { name: 'Content-Id', value: entry.contentId },
                { name: 'Content-Type-Tag', value: entry.contentType },
                { name: 'SHA-256', value: entry.sha256 },
                { name: 'Creator', value: entry.creatorAddress || 'unknown' },
                { name: 'Platform', value: 'NexusVideo' },
                { name: 'Proof-Type', value: ARWEAVE_METADATA_ONLY ? 'metadata' : 'full' },
            ],
        });

        if (result.success && result.txId) {
            this.manifest.update(entry.contentId, {
                temperature: 'cold',
                cold: {
                    provider: 'arweave',
                    txId: result.txId,
                    arweaveUrl: result.arweaveUrl || getArweaveUrl(result.txId),
                    archivedAt: new Date().toISOString(),
                },
            });
            console.log(`[DataLifecycle] ✅ ${entry.contentId} → Arweave TX: ${result.txId}`);
        } else {
            throw new Error(`Arweave upload failed: ${result.error}`);
        }
    }

    /**
     * Update Filecoin deal statuses for all warm entries.
     */
    async refreshDealStatuses(): Promise<number> {
        const warmEntries = this.manifest.getByTemperature('warm');
        let updated = 0;

        for (const entry of warmEntries) {
            if (!entry.warm?.cid) continue;
            try {
                const status = await this.filecoin.getDealStatus(entry.warm.cid);
                if (status.status !== 'unknown') {
                    this.manifest.update(entry.contentId, {
                        warm: {
                            ...entry.warm,
                            dealStatus: status.status,
                            dealId: status.dealId || entry.warm.dealId,
                        },
                    });
                    updated++;
                }
            } catch {
                // Skip errors for individual entries
            }
        }

        if (updated > 0) this.manifest.save();
        console.log(`[DataLifecycle] Refreshed ${updated} Filecoin deal statuses`);
        return updated;
    }

    /**
     * Get lifecycle summary for dashboard.
     */
    getSummary(): {
        hot: { count: number; sizeBytes: number };
        warm: { count: number; sizeBytes: number; activeDealCount: number };
        cold: { count: number; sizeBytes: number };
        pendingCooldown: number;
    } {
        const entries = this.manifest.getAll();
        const hot = entries.filter(e => e.temperature === 'hot');
        const warm = entries.filter(e => e.temperature === 'warm');
        const cold = entries.filter(e => e.temperature === 'cold');
        const pending = this.manifest.getCooldownCandidates(HOT_MAX_AGE_DAYS, WARM_MAX_AGE_DAYS);

        return {
            hot: {
                count: hot.length,
                sizeBytes: hot.reduce((s, e) => s + e.fileSizeBytes, 0),
            },
            warm: {
                count: warm.length,
                sizeBytes: warm.reduce((s, e) => s + e.fileSizeBytes, 0),
                activeDealCount: warm.filter(e => e.warm?.dealStatus === 'active').length,
            },
            cold: {
                count: cold.length,
                sizeBytes: cold.reduce((s, e) => s + e.fileSizeBytes, 0),
            },
            pendingCooldown: pending.length,
        };
    }
}

// ============== CLI Runner ==============

// If run directly as a script: node dataLifecycle.js
const isMainModule = typeof require !== 'undefined' && require.main === module;
if (isMainModule || process.argv.includes('--run-lifecycle')) {
    const manager = new DataLifecycleManager();
    manager.run().then(result => {
        console.log('[DataLifecycle] Run result:', JSON.stringify(result, null, 2));
        process.exit(0);
    }).catch(err => {
        console.error('[DataLifecycle] Fatal error:', err);
        process.exit(1);
    });
}

export const lifecycleManager = new DataLifecycleManager();
