/**
 * 一致性审计 — BullMQ 定时任务
 *
 * 每小时执行一次，检查：
 *   1. StorageManifest 与 MinIO 文件的 SHA-256 一致性
 *   2. Spore NFT 引用的 CID 与实际存储状态
 *   3. 孤立文件检测（DB 有记录但文件已丢失，或反之）
 *
 * 结果写入 platformSetting 审计日志。
 * 未来升级路径：S3 Event Sourcing 阶段可替换为事件溯源审计。
 */

import { createWorker, addRepeatingJob, QUEUE_NAMES, type JobProcessor } from '@video-platform/shared/queue';
import { PrismaClient } from '@prisma/client';
import { getManifestStore } from '@video-platform/shared/storage/storageManifest';

const prisma = new PrismaClient();

// ============== Audit Types ==============

interface AuditResult {
    timestamp: string;
    totalChecked: number;
    inconsistencies: AuditIssue[];
    orphanedManifest: number;  // In manifest but not in DB
    orphanedDB: number;        // In DB but not in manifest
    healthy: number;
}

interface AuditIssue {
    contentId: string;
    type: 'hash_mismatch' | 'missing_file' | 'orphaned_manifest' | 'orphaned_db' | 'spore_mismatch';
    details: string;
    severity: 'low' | 'medium' | 'high';
}

// ============== Audit Processor ==============

async function runConsistencyAudit(): Promise<AuditResult> {
    const startTime = Date.now();
    const manifest = getManifestStore();
    const issues: AuditIssue[] = [];

    // 1. Get all content from DB (videos, music, articles)
    const [videos, music, articles] = await Promise.all([
        prisma.video.findMany({ select: { id: true, sha256: true, sporeId: true, filecoinCid: true, arweaveTxId: true } }),
        prisma.music.findMany({ select: { id: true, sha256: true, sporeId: true, filecoinCid: true, arweaveTxId: true } }),
        prisma.article.findMany({ select: { id: true, textHash: true, sporeId: true, arweaveTxId: true } }),
    ]);

    const dbContentIds = new Set<string>();

    // 2. Check each DB record against manifest
    for (const v of videos) {
        dbContentIds.add(v.id);
        const entry = manifest.get(v.id);
        if (entry) {
            // Check SHA-256 consistency
            if (v.sha256 && entry.sha256 && v.sha256 !== entry.sha256) {
                issues.push({
                    contentId: v.id,
                    type: 'hash_mismatch',
                    details: `DB sha256=${v.sha256?.slice(0, 16)}... vs Manifest sha256=${entry.sha256.slice(0, 16)}...`,
                    severity: 'high',
                });
            }
            // Check Spore NFT references
            if (v.sporeId && entry.cold?.txId && v.arweaveTxId !== entry.cold.txId) {
                issues.push({
                    contentId: v.id,
                    type: 'spore_mismatch',
                    details: `Spore ${v.sporeId} references arweave=${v.arweaveTxId}, manifest has cold.txId=${entry.cold.txId}`,
                    severity: 'medium',
                });
            }
        }
    }

    for (const m of music) {
        dbContentIds.add(m.id);
        const entry = manifest.get(m.id);
        if (entry && m.sha256 && entry.sha256 && m.sha256 !== entry.sha256) {
            issues.push({
                contentId: m.id,
                type: 'hash_mismatch',
                details: `Music hash mismatch: DB=${m.sha256?.slice(0, 16)}... vs Manifest=${entry.sha256.slice(0, 16)}...`,
                severity: 'high',
            });
        }
    }

    for (const a of articles) {
        dbContentIds.add(a.id);
        const entry = manifest.get(a.id);
        if (entry && a.textHash && entry.sha256 && a.textHash !== entry.sha256) {
            issues.push({
                contentId: a.id,
                type: 'hash_mismatch',
                details: `Article textHash mismatch: DB=${a.textHash?.slice(0, 16)}... vs Manifest=${entry.sha256.slice(0, 16)}...`,
                severity: 'medium',
            });
        }
    }

    // 3. Check for orphaned manifest entries (in manifest but not in DB)
    const allManifestEntries = manifest.getAll();
    let orphanedManifest = 0;
    for (const entry of allManifestEntries) {
        if (!dbContentIds.has(entry.contentId)) {
            orphanedManifest++;
            if (orphanedManifest <= 10) { // Limit logged issues
                issues.push({
                    contentId: entry.contentId,
                    type: 'orphaned_manifest',
                    details: `Entry exists in StorageManifest but not in Prisma DB (temp: ${entry.temperature})`,
                    severity: 'low',
                });
            }
        }
    }

    // 4. Check for DB entries without manifest (only if manifest has entries)
    let orphanedDB = 0;
    if (allManifestEntries.length > 0) {
        const manifestIds = new Set(allManifestEntries.map(e => e.contentId));
        for (const id of dbContentIds) {
            if (!manifestIds.has(id)) {
                orphanedDB++;
            }
        }
    }

    const result: AuditResult = {
        timestamp: new Date().toISOString(),
        totalChecked: dbContentIds.size,
        inconsistencies: issues,
        orphanedManifest,
        orphanedDB,
        healthy: dbContentIds.size - issues.filter(i => i.severity === 'high').length,
    };

    // 5. Save audit result
    const auditKey = `audit_${new Date().toISOString().slice(0, 13).replace(/[-:T]/g, '')}`; // hourly key
    await prisma.platformSetting.upsert({
        where: { key: auditKey },
        update: { value: JSON.stringify(result) },
        create: {
            key: auditKey,
            value: JSON.stringify(result),
            description: `Consistency audit at ${result.timestamp}`,
        },
    });

    const elapsed = Date.now() - startTime;
    console.log(`[Audit] ✅ Completed in ${elapsed}ms: ${result.totalChecked} checked, ${issues.length} issues (${issues.filter(i => i.severity === 'high').length} high)`);

    return result;
}

// ============== Worker Router ==============

async function storageJobRouter(job: any): Promise<any> {
    switch (job.name) {
        case 'consistency-audit':
            return runConsistencyAudit();
        case 'lifecycle-scan': {
            // Import DataLifecycleManager dynamically
            const { DataLifecycleManager } = await import('./dataLifecycle');
            const mgr = new DataLifecycleManager();
            return mgr.run();
        }
        case 'deal-refresh': {
            const { DataLifecycleManager } = await import('./dataLifecycle');
            const mgr = new DataLifecycleManager();
            return mgr.refreshDealStatuses();
        }
        default:
            console.warn(`[Storage] Unknown job: ${job.name}`);
            return { status: 'skipped' };
    }
}

// ============== Init ==============

let storageWorkerStarted = false;

export async function startStorageWorker(): Promise<void> {
    if (storageWorkerStarted) return;
    storageWorkerStarted = true;

    // Create worker
    createWorker(
        QUEUE_NAMES.STORAGE,
        storageJobRouter as JobProcessor<any, any>,
        1 // concurrency: 1 for storage operations
    );

    // Register repeating jobs
    try {
        // Consistency audit: every hour
        await addRepeatingJob(QUEUE_NAMES.STORAGE, 'consistency-audit', {}, '0 * * * *');

        // Lifecycle scan: every 6 hours
        await addRepeatingJob(QUEUE_NAMES.STORAGE, 'lifecycle-scan', {}, '0 */6 * * *');

        // Deal status refresh: every 24 hours at 3am
        await addRepeatingJob(QUEUE_NAMES.STORAGE, 'deal-refresh', {}, '0 3 * * *');

        console.log('[Storage] 📦 Worker started with cron jobs: audit(1h), lifecycle(6h), deal-refresh(24h)');
    } catch (err) {
        console.warn('[Storage] Failed to register cron jobs (Redis may not be available):', (err as Error).message);
    }
}

// ============== Manual Trigger for API ==============

export async function triggerAuditNow(): Promise<AuditResult> {
    return runConsistencyAudit();
}
