// FILE: /video-platform/shared/storage/hybridStorage.ts
/**
 * HybridStorageEngine — 统一存储调度器
 *
 * 上传流程: MinIO(热) → 异步 Filecoin/Arweave(温/冷) → Spore确权
 * 检索流程: Redis缓存 → CDN → MinIO → IPFS fallback
 * 降温流程: hot → warm(Filecoin) → cold(Arweave)
 */

import { getStorageStrategy, type StorageStrategy, FilecoinStorageClient } from '../web3/filecoin';
import { uploadToArweave, checkArweaveStatus, getArweaveUrl } from '../web3/arweave';
import { uploadFile as minioUpload, getPresignedUploadUrl, deleteFile as minioDelete } from './minio-client';
import { toCDNUrl, preheatCDN, getPlaybackUrl, getCoverUrl } from './cdn';
import {
    getManifestStore,
    type StorageManifestEntry,
    type ContentType,
    type Temperature,
} from './storageManifest';
import { sha256 } from 'js-sha256';

// ============== Types ==============

export interface UploadOptions {
    contentId: string;
    contentType: ContentType;
    title?: string;
    creatorAddress?: string;
    skipWarm?: boolean;        // Skip Filecoin upload (default: false for articles)
    skipCold?: boolean;        // Skip Arweave upload
    skipCertification?: boolean;
    encryptionKeyHash?: string;
}

export interface StorageResult {
    contentId: string;
    sha256: string;
    cdnUrl?: string;
    ipfsCid?: string;
    ipfsUrl?: string;
    arweaveTxId?: string;
    arweaveUrl?: string;
    sporeTxHash?: string;
    sporeId?: string;
    temperature: Temperature;
    manifest: StorageManifestEntry;
}

export interface ResolvedUrl {
    primary: string;          // Best available URL (CDN > MinIO > IPFS > Arweave)
    cdn?: string;
    minio?: string;
    ipfs?: string;
    arweave?: string;
    fromCache: boolean;
}

export interface StorageStats {
    totalEntries: number;
    hotCount: number;
    warmCount: number;
    coldCount: number;
    totalSizeBytes: number;
}

// ============== Engine ==============

export class HybridStorageEngine {
    private filecoin: FilecoinStorageClient;
    private manifest = getManifestStore();

    constructor() {
        this.filecoin = new FilecoinStorageClient();
    }

    /**
     * Upload content through the hybrid storage pipeline.
     *
     * Sync: MinIO (hot) → immediate CDN URL
     * Async: Filecoin (warm) + Arweave (cold) + Spore (certification)
     */
    async upload(fileBuffer: Buffer, options: UploadOptions): Promise<StorageResult> {
        const contentHash = sha256(fileBuffer);
        const strategy = getStorageStrategy(options.contentType, fileBuffer.length);
        const now = new Date().toISOString();

        console.log(`[HybridStorage] Uploading ${options.contentId} (${options.contentType}, ${(fileBuffer.length / 1024 / 1024).toFixed(1)}MB)`);
        console.log(`[HybridStorage] Strategy: hot=${strategy.hot}, cold=${strategy.cold}, cert=${strategy.certification}`);

        // Initialize result
        const result: StorageResult = {
            contentId: options.contentId,
            sha256: contentHash,
            temperature: 'hot',
            manifest: {} as StorageManifestEntry,
        };

        // ─── Step 1: Hot Tier (MinIO/S3, synchronous) ───
        let hotKey: string | undefined;
        let cdnUrl: string | undefined;

        try {
            const ext = this.getExtension(options.contentType);
            hotKey = `${options.contentType}s/${options.contentId}/original${ext}`;
            const contentMime = this.getMimeType(options.contentType);

            cdnUrl = await minioUpload(hotKey, fileBuffer, contentMime);
            result.cdnUrl = cdnUrl;

            console.log(`[HybridStorage] ✅ Hot tier: ${hotKey} → ${cdnUrl}`);
        } catch (err: any) {
            console.error(`[HybridStorage] ❌ Hot tier failed:`, err?.message);
            // Continue — file will only exist in legacy storage
        }

        // ─── Step 2: Create manifest entry ───
        const entry: StorageManifestEntry = {
            contentId: options.contentId,
            contentType: options.contentType,
            sha256: contentHash,
            encryptionKeyHash: options.encryptionKeyHash,
            fileSizeBytes: fileBuffer.length,
            createdAt: now,
            hot: hotKey ? {
                provider: 'minio',
                key: hotKey,
                cdnUrl: cdnUrl || '',
                uploadedAt: now,
            } : undefined,
            temperature: 'hot',
            lastAccessedAt: now,
            accessCount: 0,
            creatorAddress: options.creatorAddress,
            title: options.title,
        };

        this.manifest.set(options.contentId, entry);
        result.manifest = entry;

        // ─── Step 3: CDN Preheat (async, fire-and-forget) ───
        if (hotKey) {
            preheatCDN([hotKey]).catch(() => { });
        }

        // ─── Step 4: Warm Tier (Filecoin/IPFS, async) ───
        if (!options.skipWarm && (strategy.cold === 'filecoin' || strategy.cold === 'both')) {
            this.uploadToWarmTier(options.contentId, fileBuffer, options.contentType).catch(err => {
                console.error(`[HybridStorage] Warm tier async error:`, err?.message);
            });
        }

        // ─── Step 5: Cold Tier (Arweave, async) ───
        const shouldArchive = !options.skipCold && (
            strategy.cold === 'arweave' || strategy.cold === 'both' ||
            options.contentType === 'article'
        );

        if (shouldArchive) {
            this.uploadToColdTier(options.contentId, fileBuffer, options.contentType).catch(err => {
                console.error(`[HybridStorage] Cold tier async error:`, err?.message);
            });
        }

        // Save manifest
        this.manifest.save();

        return result;
    }

    /**
     * Resolve the best playback/access URL for content.
     */
    async resolve(contentId: string): Promise<ResolvedUrl> {
        const entry = this.manifest.get(contentId);
        if (!entry) {
            return { primary: '', fromCache: false };
        }

        // Record access
        this.manifest.recordAccess(contentId);

        const resolved: ResolvedUrl = {
            primary: '',
            fromCache: false,
        };

        // Priority: CDN > MinIO > IPFS > Arweave
        if (entry.hot?.cdnUrl) {
            resolved.cdn = entry.hot.cdnUrl;
            resolved.primary = entry.hot.cdnUrl;
        }

        if (entry.warm?.ipfsUrl) {
            resolved.ipfs = entry.warm.ipfsUrl;
            if (!resolved.primary) resolved.primary = entry.warm.ipfsUrl;
        }

        if (entry.cold?.arweaveUrl) {
            resolved.arweave = entry.cold.arweaveUrl;
            if (!resolved.primary) resolved.primary = entry.cold.arweaveUrl;
        }

        return resolved;
    }

    /**
     * Manually cool down content from hot → warm or warm → cold.
     */
    async coolDown(contentId: string, target: 'filecoin' | 'arweave'): Promise<void> {
        const entry = this.manifest.get(contentId);
        if (!entry) throw new Error(`Content ${contentId} not found in manifest`);

        // We need the file buffer from hot storage to migrate
        // In practice, this would read from MinIO
        console.log(`[HybridStorage] Cooling down ${contentId} → ${target}`);

        if (target === 'filecoin' && !entry.warm) {
            // Read from MinIO and upload to Filecoin
            // For now, log the intent (actual implementation needs MinIO getObject)
            console.log(`[HybridStorage] TODO: Read ${entry.hot?.key} from MinIO → upload to Filecoin`);
            this.manifest.update(contentId, { temperature: 'warm' });
        }

        if (target === 'arweave' && !entry.cold) {
            console.log(`[HybridStorage] TODO: Read content → upload to Arweave`);
            this.manifest.update(contentId, { temperature: 'cold' });
        }

        this.manifest.save();
    }

    /**
     * Get storage status for a content item.
     */
    getStorageStatus(contentId: string): StorageManifestEntry | undefined {
        return this.manifest.get(contentId);
    }

    /**
     * Get aggregate storage statistics.
     */
    getStats(): StorageStats {
        const entries = this.manifest.getAll();
        return {
            totalEntries: entries.length,
            hotCount: entries.filter(e => e.temperature === 'hot').length,
            warmCount: entries.filter(e => e.temperature === 'warm').length,
            coldCount: entries.filter(e => e.temperature === 'cold').length,
            totalSizeBytes: entries.reduce((sum, e) => sum + e.fileSizeBytes, 0),
        };
    }

    /**
     * Migrate legacy records.json entries into the manifest.
     */
    migrateLegacy(legacyPath: string): number {
        return this.manifest.migrateFromLegacy(legacyPath);
    }

    // ─── Private Helpers ───

    private async uploadToWarmTier(contentId: string, buffer: Buffer, contentType: ContentType): Promise<void> {
        try {
            const result = await this.filecoin.uploadFile(buffer, `${contentId}.${this.getExtension(contentType)}`);
            if (result.success && result.cid) {
                this.manifest.update(contentId, {
                    warm: {
                        provider: 'filecoin',
                        cid: result.cid,
                        dealId: result.filecoinDealId,
                        ipfsUrl: result.ipfsUrl || '',
                        migratedAt: new Date().toISOString(),
                    },
                });
                this.manifest.save();
                console.log(`[HybridStorage] ✅ Warm tier: CID=${result.cid}`);
            }
        } catch (err: any) {
            console.error(`[HybridStorage] ❌ Warm tier upload failed:`, err?.message);
        }
    }

    private async uploadToColdTier(contentId: string, buffer: Buffer, contentType: ContentType): Promise<void> {
        try {
            const mime = this.getMimeType(contentType);
            const result = await uploadToArweave(buffer, {
                contentType: mime,
                tags: [
                    { name: 'Content-Id', value: contentId },
                    { name: 'Content-Type-Tag', value: contentType },
                    { name: 'Platform', value: 'NexusVideo' },
                ],
            });
            if (result.success && result.txId) {
                this.manifest.update(contentId, {
                    cold: {
                        provider: 'arweave',
                        txId: result.txId,
                        arweaveUrl: result.arweaveUrl || getArweaveUrl(result.txId),
                        archivedAt: new Date().toISOString(),
                    },
                });
                this.manifest.save();
                console.log(`[HybridStorage] ✅ Cold tier: txId=${result.txId}`);
            }
        } catch (err: any) {
            console.error(`[HybridStorage] ❌ Cold tier upload failed:`, err?.message);
        }
    }

    private getExtension(contentType: ContentType): string {
        switch (contentType) {
            case 'video': return '.mp4';
            case 'music': return '.mp3';
            case 'article': return '.md';
            case 'live_recording': return '.mp4';
            default: return '.bin';
        }
    }

    private getMimeType(contentType: ContentType): string {
        switch (contentType) {
            case 'video': return 'video/mp4';
            case 'music': return 'audio/mpeg';
            case 'article': return 'text/markdown';
            case 'live_recording': return 'video/mp4';
            default: return 'application/octet-stream';
        }
    }
}

// ============== Singleton ==============

let _engine: HybridStorageEngine | null = null;

export function getHybridStorage(): HybridStorageEngine {
    if (!_engine) _engine = new HybridStorageEngine();
    return _engine;
}
