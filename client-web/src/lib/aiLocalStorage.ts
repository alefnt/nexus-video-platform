/**
 * AI Content Local Storage — IndexedDB
 *
 * All AI-generated content (music, video, articles) lives in the browser's
 * IndexedDB until the user explicitly publishes it to the Nexus platform.
 *
 * Storage structure:
 *   DB: "nexus-ai-studio"
 *   Stores:
 *     - "generations" → generation metadata + result references
 *     - "blobs"       → binary content (audio/video files as Blobs)
 */

const DB_NAME = "nexus-ai-studio";
const DB_VERSION = 1;
const STORE_GENERATIONS = "generations";
const STORE_BLOBS = "blobs";

// ── Types ──────────────────────────────────────

export interface LocalGeneration {
    id: string;
    type: "text" | "music" | "video";
    status: "queued" | "processing" | "completed" | "failed";
    progress: number;
    prompt: string;
    params: Record<string, any>;

    // Results (stored locally)
    resultContent?: string;        // For text/article
    resultBlobKey?: string;        // Key into blobs store (for audio/video)
    resultUrl?: string;            // External URL (e.g. from provider CDN — temporary)
    resultMeta?: Record<string, any>;

    // Publishing status
    published: boolean;
    publishedAt?: number;
    platformContentId?: string;    // ID in platform storage after publish

    error?: string;
    createdAt: number;
    completedAt?: number;
}

// ── DB Init ──────────────────────────────────────

function openDB(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
        const req = indexedDB.open(DB_NAME, DB_VERSION);

        req.onupgradeneeded = (e) => {
            const db = (e.target as IDBOpenDBRequest).result;

            if (!db.objectStoreNames.contains(STORE_GENERATIONS)) {
                const store = db.createObjectStore(STORE_GENERATIONS, { keyPath: "id" });
                store.createIndex("type", "type", { unique: false });
                store.createIndex("createdAt", "createdAt", { unique: false });
                store.createIndex("status", "status", { unique: false });
            }

            if (!db.objectStoreNames.contains(STORE_BLOBS)) {
                db.createObjectStore(STORE_BLOBS);
            }
        };

        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
    });
}

// ── Generation CRUD ──────────────────────────────

export async function saveGeneration(gen: LocalGeneration): Promise<void> {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_GENERATIONS, "readwrite");
        tx.objectStore(STORE_GENERATIONS).put(gen);
        tx.oncomplete = () => { db.close(); resolve(); };
        tx.onerror = () => { db.close(); reject(tx.error); };
    });
}

export async function getGeneration(id: string): Promise<LocalGeneration | null> {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_GENERATIONS, "readonly");
        const req = tx.objectStore(STORE_GENERATIONS).get(id);
        req.onsuccess = () => { db.close(); resolve(req.result || null); };
        req.onerror = () => { db.close(); reject(req.error); };
    });
}

export async function getGenerationsByType(type: "text" | "music" | "video", limit = 50): Promise<LocalGeneration[]> {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_GENERATIONS, "readonly");
        const store = tx.objectStore(STORE_GENERATIONS);
        const index = store.index("type");
        const req = index.getAll(type);
        req.onsuccess = () => {
            const results = (req.result || [])
                .sort((a: LocalGeneration, b: LocalGeneration) => b.createdAt - a.createdAt)
                .slice(0, limit);
            db.close();
            resolve(results);
        };
        req.onerror = () => { db.close(); reject(req.error); };
    });
}

export async function deleteGeneration(id: string): Promise<void> {
    const db = await openDB();
    // Also delete associated blob
    const gen = await getGeneration(id);
    return new Promise((resolve, reject) => {
        const stores = [STORE_GENERATIONS];
        if (gen?.resultBlobKey) stores.push(STORE_BLOBS);

        const tx = db.transaction(stores, "readwrite");
        tx.objectStore(STORE_GENERATIONS).delete(id);
        if (gen?.resultBlobKey) {
            tx.objectStore(STORE_BLOBS).delete(gen.resultBlobKey);
        }
        tx.oncomplete = () => { db.close(); resolve(); };
        tx.onerror = () => { db.close(); reject(tx.error); };
    });
}

export async function markPublished(id: string, platformContentId: string): Promise<void> {
    const gen = await getGeneration(id);
    if (!gen) return;
    gen.published = true;
    gen.publishedAt = Date.now();
    gen.platformContentId = platformContentId;
    await saveGeneration(gen);
}

// ── Blob Storage (audio/video binary) ──────────────

export async function saveBlob(key: string, blob: Blob): Promise<void> {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_BLOBS, "readwrite");
        tx.objectStore(STORE_BLOBS).put(blob, key);
        tx.oncomplete = () => { db.close(); resolve(); };
        tx.onerror = () => { db.close(); reject(tx.error); };
    });
}

export async function getBlob(key: string): Promise<Blob | null> {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_BLOBS, "readonly");
        const req = tx.objectStore(STORE_BLOBS).get(key);
        req.onsuccess = () => { db.close(); resolve(req.result || null); };
        req.onerror = () => { db.close(); reject(req.error); };
    });
}

export async function getBlobUrl(key: string): Promise<string | null> {
    const blob = await getBlob(key);
    if (!blob) return null;
    return URL.createObjectURL(blob);
}

// ── Helper: Download external URL to local blob ──────────────

export async function downloadToLocal(url: string, genId: string, mimeType?: string): Promise<string> {
    const blobKey = `gen-${genId}`;
    try {
        const res = await fetch(url);
        if (!res.ok) throw new Error(`Download failed: ${res.status}`);
        const blob = await res.blob();
        const typedBlob = mimeType ? new Blob([blob], { type: mimeType }) : blob;
        await saveBlob(blobKey, typedBlob);
        return blobKey;
    } catch (err) {
        // If download fails, just store the URL reference
        console.warn("Failed to download to local storage:", err);
        return "";
    }
}

// ── Storage Stats ──────────────────────────────

export async function getStorageStats(): Promise<{
    totalGenerations: number;
    byType: Record<string, number>;
    estimatedSizeMB: number;
}> {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction([STORE_GENERATIONS, STORE_BLOBS], "readonly");

        const genReq = tx.objectStore(STORE_GENERATIONS).getAll();
        genReq.onsuccess = () => {
            const gens = genReq.result as LocalGeneration[];
            const byType: Record<string, number> = {};
            for (const g of gens) {
                byType[g.type] = (byType[g.type] || 0) + 1;
            }

            // Estimate blob sizes (rough)
            let estimatedSize = 0;
            const blobStore = tx.objectStore(STORE_BLOBS);
            const cursor = blobStore.openCursor();
            cursor.onsuccess = () => {
                const c = cursor.result;
                if (c) {
                    const blob = c.value as Blob;
                    estimatedSize += blob?.size || 0;
                    c.continue();
                } else {
                    db.close();
                    resolve({
                        totalGenerations: gens.length,
                        byType,
                        estimatedSizeMB: Math.round(estimatedSize / 1024 / 1024 * 100) / 100,
                    });
                }
            };
        };
        genReq.onerror = () => { db.close(); reject(genReq.error); };
    });
}

// ── Clear All Data ──────────────────────────────

export async function clearAllLocalAI(): Promise<void> {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction([STORE_GENERATIONS, STORE_BLOBS], "readwrite");
        tx.objectStore(STORE_GENERATIONS).clear();
        tx.objectStore(STORE_BLOBS).clear();
        tx.oncomplete = () => { db.close(); resolve(); };
        tx.onerror = () => { db.close(); reject(tx.error); };
    });
}
