// FILE: /video-platform/shared/storage/storageManifest.ts
/**
 * 存储清单数据结构
 * 记录每个内容的多层存储位置和生命周期状态
 */

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

// ============== Types ==============

export type ContentType = 'video' | 'music' | 'article' | 'live_recording';
export type Temperature = 'hot' | 'warm' | 'cold';
export type HotProvider = 'minio' | 's3' | 'oss';
export type WarmProvider = 'filecoin';
export type ColdProvider = 'arweave';
export type CertProvider = 'ckb';

export interface HotStorageInfo {
    provider: HotProvider;
    key: string;         // object storage key, e.g. "videos/abc/master.m3u8"
    cdnUrl: string;      // CDN URL for playback
    bucket?: string;
    uploadedAt: string;
}

export interface WarmStorageInfo {
    provider: WarmProvider;
    cid: string;         // IPFS CID
    dealId?: string;     // Filecoin deal ID
    ipfsUrl: string;     // IPFS gateway URL
    migratedAt: string;
    dealStatus?: 'queued' | 'proposing' | 'accepted' | 'active' | 'expired';
}

export interface ColdStorageInfo {
    provider: ColdProvider;
    txId: string;        // Arweave TX ID
    arweaveUrl: string;  // Arweave gateway URL
    archivedAt: string;
    confirmed?: boolean;
    confirmations?: number;
}

export interface CertificationInfo {
    chain: CertProvider;
    sporeTxHash: string;
    sporeId: string;
    certifiedAt: string;
    explorerUrl?: string;
}

export interface StorageManifestEntry {
    contentId: string;
    contentType: ContentType;
    sha256: string;
    encryptionKeyHash?: string;
    fileSizeBytes: number;
    createdAt: string;

    // Multi-tier storage
    hot?: HotStorageInfo;
    warm?: WarmStorageInfo;
    cold?: ColdStorageInfo;
    certification?: CertificationInfo;

    // Lifecycle
    temperature: Temperature;
    lastAccessedAt: string;
    accessCount: number;

    // Creator info
    creatorAddress?: string;
    title?: string;
}

// ============== Manifest Store ==============

const DEFAULT_MANIFEST_PATH = resolve(process.cwd(), 'storage', 'storage_manifest.json');

export class StorageManifestStore {
    private entries: Map<string, StorageManifestEntry> = new Map();
    private filePath: string;
    private dirty = false;

    constructor(filePath?: string) {
        this.filePath = filePath || DEFAULT_MANIFEST_PATH;
        this.load();
    }

    /** Load manifest from disk */
    private load(): void {
        try {
            if (existsSync(this.filePath)) {
                const raw = readFileSync(this.filePath, 'utf-8');
                const data = JSON.parse(raw) as Record<string, StorageManifestEntry>;
                for (const [k, v] of Object.entries(data)) {
                    this.entries.set(k, v);
                }
            }
        } catch (err) {
            console.warn('[StorageManifest] Failed to load:', err);
        }
    }

    /** Persist manifest to disk */
    save(): void {
        try {
            const obj: Record<string, StorageManifestEntry> = {};
            for (const [k, v] of this.entries) obj[k] = v;
            writeFileSync(this.filePath, JSON.stringify(obj, null, 2));
            this.dirty = false;
        } catch (err) {
            console.error('[StorageManifest] Save failed:', err);
        }
    }

    /** Get entry by content ID */
    get(contentId: string): StorageManifestEntry | undefined {
        return this.entries.get(contentId);
    }

    /** Set or update an entry */
    set(contentId: string, entry: StorageManifestEntry): void {
        this.entries.set(contentId, entry);
        this.dirty = true;
    }

    /** Update partial fields of an entry */
    update(contentId: string, partial: Partial<StorageManifestEntry>): StorageManifestEntry | undefined {
        const existing = this.entries.get(contentId);
        if (!existing) return undefined;
        const updated = { ...existing, ...partial };
        this.entries.set(contentId, updated);
        this.dirty = true;
        return updated;
    }

    /** Record an access (increments counter, updates timestamp) */
    recordAccess(contentId: string): void {
        const entry = this.entries.get(contentId);
        if (entry) {
            entry.accessCount += 1;
            entry.lastAccessedAt = new Date().toISOString();
            this.dirty = true;
        }
    }

    /** Get all entries */
    getAll(): StorageManifestEntry[] {
        return Array.from(this.entries.values());
    }

    /** Get entries by temperature */
    getByTemperature(temp: Temperature): StorageManifestEntry[] {
        return this.getAll().filter(e => e.temperature === temp);
    }

    /** Get entries that should be cooled down */
    getCooldownCandidates(hotMaxAgeDays: number = 30, warmMaxAgeDays: number = 90): StorageManifestEntry[] {
        const now = Date.now();
        return this.getAll().filter(entry => {
            const lastAccess = new Date(entry.lastAccessedAt).getTime();
            const ageMs = now - lastAccess;
            const ageDays = ageMs / (1000 * 60 * 60 * 24);

            if (entry.temperature === 'hot' && ageDays > hotMaxAgeDays) return true;
            if (entry.temperature === 'warm' && ageDays > warmMaxAgeDays) return true;
            // Early cooldown: low access + old enough
            if (entry.temperature === 'hot' && entry.accessCount < 10 && ageDays > 7) return true;
            return false;
        });
    }

    /** Delete entry */
    delete(contentId: string): boolean {
        const deleted = this.entries.delete(contentId);
        if (deleted) this.dirty = true;
        return deleted;
    }

    /** Auto-save if dirty */
    autoSave(): void {
        if (this.dirty) this.save();
    }

    /** Total entries count */
    get size(): number {
        return this.entries.size;
    }

    /** Migrate from legacy records.json */
    migrateFromLegacy(legacyPath: string): number {
        try {
            if (!existsSync(legacyPath)) return 0;
            const raw = readFileSync(legacyPath, 'utf-8');
            const records = JSON.parse(raw) as Record<string, {
                videoId: string;
                encryptionKeyHash: string;
                sha256: string;
            }>;

            let migrated = 0;
            for (const [id, rec] of Object.entries(records)) {
                if (this.entries.has(id)) continue; // Already migrated
                this.entries.set(id, {
                    contentId: id,
                    contentType: 'video',
                    sha256: rec.sha256,
                    encryptionKeyHash: rec.encryptionKeyHash,
                    fileSizeBytes: 0, // Unknown from legacy
                    createdAt: new Date().toISOString(),
                    temperature: 'hot',
                    lastAccessedAt: new Date().toISOString(),
                    accessCount: 0,
                });
                migrated++;
            }
            if (migrated > 0) {
                this.dirty = true;
                this.save();
            }
            return migrated;
        } catch (err) {
            console.error('[StorageManifest] Legacy migration failed:', err);
            return 0;
        }
    }
}

// Export singleton
let _store: StorageManifestStore | null = null;
export function getManifestStore(filePath?: string): StorageManifestStore {
    if (!_store) _store = new StorageManifestStore(filePath);
    return _store;
}
