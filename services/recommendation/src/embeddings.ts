// FILE: /video-platform/services/recommendation/src/embeddings.ts
/**
 * User & Content Embeddings — TikTok-style Recommendation Engine
 * 
 * Two-Tower Architecture:
 *   Tower 1: User Embedding (interests, watch history, engagement signals)
 *   Tower 2: Content Embedding (tags, category, creator, engagement metrics)
 * 
 * Scoring: cosine_similarity(user_vec, content_vec) * engagement_boost
 */

// ============== Types ==============

export interface UserEmbedding {
    userId: string;
    vector: number[];
    lastUpdated: number;
}

export interface ContentEmbedding {
    contentId: string;
    vector: number[];
    engagementScore: number;
    createdAt: number;
}

export interface EngagementSignals {
    watchTimeMs: number;
    durationMs: number;
    liked: boolean;
    commented: boolean;
    shared: boolean;
    replayed: boolean;
    skippedEarly: boolean; // Exited before 30% of video
}

// ============== Vector Dimensions ==============
// Each dimension represents a feature category

const EMBEDDING_DIM = 32;

const TAG_CATEGORIES = [
    "entertainment", "education", "music", "gaming", "sports", "news",
    "technology", "science", "art", "cooking", "travel", "fitness",
    "comedy", "drama", "documentary", "animation", "web3", "crypto",
    "defi", "nft", "live", "tutorial", "review", "vlog",
    "film", "podcast", "interview", "diy", "fashion", "nature",
    "politics", "history"
];

// ============== Embedding Computation ==============

/** Convert tags to a sparse vector */
export function tagsToVector(tags: string[]): number[] {
    const vec = new Array(EMBEDDING_DIM).fill(0);
    for (const tag of tags) {
        const idx = TAG_CATEGORIES.indexOf(tag.toLowerCase());
        if (idx >= 0 && idx < EMBEDDING_DIM) {
            vec[idx] = 1.0;
        } else {
            // Hash unknown tags into a dimension
            const hash = simpleHash(tag) % EMBEDDING_DIM;
            vec[hash] = Math.max(vec[hash], 0.5);
        }
    }
    // Normalize
    return normalize(vec);
}

/** Compute engagement score (TikTok formula) */
export function computeEngagementScore(signals: EngagementSignals): number {
    const watchRatio = signals.durationMs > 0 ? signals.watchTimeMs / signals.durationMs : 0;

    let score = 0;
    score += Math.min(watchRatio, 1.0) * 40;    // Watch completion: 40 points max
    score += signals.liked ? 20 : 0;             // Like: 20 points
    score += signals.commented ? 15 : 0;         // Comment: 15 points
    score += signals.shared ? 15 : 0;            // Share: 15 points
    score += signals.replayed ? 10 : 0;          // Replay: 10 points
    score -= signals.skippedEarly ? 30 : 0;      // Early skip: -30 points

    return Math.max(0, Math.min(100, score));     // Clamp to [0, 100]
}

/** Build user embedding from their engagement history */
export function buildUserEmbedding(
    watchedContent: { tags: string[]; engagement: EngagementSignals }[]
): number[] {
    if (watchedContent.length === 0) return new Array(EMBEDDING_DIM).fill(0);

    const vec = new Array(EMBEDDING_DIM).fill(0);
    let totalWeight = 0;

    for (const item of watchedContent) {
        const contentVec = tagsToVector(item.tags);
        const weight = computeEngagementScore(item.engagement) / 100;

        for (let i = 0; i < EMBEDDING_DIM; i++) {
            vec[i] += contentVec[i] * weight;
        }
        totalWeight += weight;
    }

    if (totalWeight > 0) {
        for (let i = 0; i < EMBEDDING_DIM; i++) vec[i] /= totalWeight;
    }

    return normalize(vec);
}

/** Build content embedding from metadata */
export function buildContentEmbedding(
    tags: string[],
    category: string,
    engagementRate: number // 0-1
): number[] {
    const tagVec = tagsToVector([...tags, category]);

    // Boost by engagement rate (popular content gets slightly larger vector magnitude)
    const boost = 0.8 + engagementRate * 0.4; // 0.8 to 1.2
    return tagVec.map(v => v * boost);
}

// ============== Similarity ==============

/** Cosine similarity between two vectors */
export function cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) return 0;
    let dot = 0, magA = 0, magB = 0;
    for (let i = 0; i < a.length; i++) {
        dot += a[i] * b[i];
        magA += a[i] * a[i];
        magB += b[i] * b[i];
    }
    const denom = Math.sqrt(magA) * Math.sqrt(magB);
    return denom === 0 ? 0 : dot / denom;
}

// ============== Utility ==============

function normalize(vec: number[]): number[] {
    const mag = Math.sqrt(vec.reduce((s, v) => s + v * v, 0));
    return mag === 0 ? vec : vec.map(v => v / mag);
}

function simpleHash(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        hash = ((hash << 5) - hash + str.charCodeAt(i)) | 0;
    }
    return Math.abs(hash);
}

// ============== Embedding Cache ==============

const userEmbeddingCache = new Map<string, UserEmbedding>();
const contentEmbeddingCache = new Map<string, ContentEmbedding>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

export function getCachedUserEmbedding(userId: string): UserEmbedding | null {
    const cached = userEmbeddingCache.get(userId);
    if (cached && Date.now() - cached.lastUpdated < CACHE_TTL) return cached;
    return null;
}

export function setCachedUserEmbedding(userId: string, vector: number[]): void {
    userEmbeddingCache.set(userId, { userId, vector, lastUpdated: Date.now() });
    // Evict old entries if cache too large
    if (userEmbeddingCache.size > 10000) {
        const oldest = [...userEmbeddingCache.entries()]
            .sort((a, b) => a[1].lastUpdated - b[1].lastUpdated)
            .slice(0, 1000);
        for (const [key] of oldest) userEmbeddingCache.delete(key);
    }
}

export function getCachedContentEmbedding(contentId: string): ContentEmbedding | null {
    const cached = contentEmbeddingCache.get(contentId);
    if (cached && Date.now() - cached.createdAt < CACHE_TTL) return cached;
    return null;
}

export function setCachedContentEmbedding(contentId: string, vector: number[], engagementScore: number): void {
    contentEmbeddingCache.set(contentId, { contentId, vector, engagementScore, createdAt: Date.now() });
}

export { EMBEDDING_DIM, TAG_CATEGORIES };
