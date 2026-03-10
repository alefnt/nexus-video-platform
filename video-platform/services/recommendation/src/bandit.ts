// FILE: /video-platform/services/recommendation/src/bandit.ts
/**
 * Multi-Armed Bandit — Thompson Sampling
 * 
 * Exploration-exploitation balance for content recommendation.
 * Each content item is an "arm" with Beta(alpha, beta) distribution.
 * 
 * - alpha = successful engagement count (watch > 50%, like, etc.)
 * - beta = non-engagement count (skip, exit early)
 * 
 * Thompson Sampling naturally balances:
 * - Exploitation: showing proven high-engagement content
 * - Exploration: giving new/uncertain content a chance
 * 
 * Reference: TikTok uses a similar approach for their "For You" feed.
 */

// ============== Types ==============

export interface ArmStats {
    contentId: string;
    alpha: number; // Successes (engagement)
    beta: number;  // Failures (non-engagement)
    pulls: number; // Total times shown
    lastPulled: number;
}

// ============== Thompson Sampling ==============

/**
 * Sample from Beta distribution using Jöhnk's algorithm
 * This gives us the estimated engagement probability for each arm
 */
function sampleBeta(alpha: number, beta: number): number {
    // For computational efficiency, use the gamma function approach
    const x = gammaVariate(alpha);
    const y = gammaVariate(beta);
    return x / (x + y);
}

/**
 * Generate a gamma-distributed random variable using Marsaglia and Tsang's method
 */
function gammaVariate(shape: number): number {
    if (shape < 1) {
        return gammaVariate(shape + 1) * Math.pow(Math.random(), 1 / shape);
    }

    const d = shape - 1 / 3;
    const c = 1 / Math.sqrt(9 * d);

    while (true) {
        let x: number, v: number;
        do {
            x = normalRandom();
            v = 1 + c * x;
        } while (v <= 0);

        v = v * v * v;
        const u = Math.random();

        if (u < 1 - 0.0331 * x * x * x * x) return d * v;
        if (Math.log(u) < 0.5 * x * x + d * (1 - v + Math.log(v))) return d * v;
    }
}

/** Standard normal random using Box-Muller transform */
function normalRandom(): number {
    const u1 = Math.random();
    const u2 = Math.random();
    return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
}

// ============== Bandit Manager ==============

// In-memory store (Redis-backed in production)
const armStatsMap = new Map<string, ArmStats>();

export const Bandit = {
    /**
     * Initialize or get arm stats for a content item
     */
    getArm(contentId: string): ArmStats {
        if (!armStatsMap.has(contentId)) {
            armStatsMap.set(contentId, {
                contentId,
                alpha: 1, // Uniform prior
                beta: 1,  // Uniform prior
                pulls: 0,
                lastPulled: 0,
            });
        }
        return armStatsMap.get(contentId)!;
    },

    /**
     * Sample engagement probability for content via Thompson Sampling
     * Higher values = more likely to be recommended
     */
    sample(contentId: string): number {
        const arm = this.getArm(contentId);
        return sampleBeta(arm.alpha, arm.beta);
    },

    /**
     * Record engagement (positive signal)
     */
    recordSuccess(contentId: string): void {
        const arm = this.getArm(contentId);
        arm.alpha += 1;
        arm.pulls += 1;
        arm.lastPulled = Date.now();
    },

    /**
     * Record non-engagement (negative signal)
     */
    recordFailure(contentId: string): void {
        const arm = this.getArm(contentId);
        arm.beta += 1;
        arm.pulls += 1;
        arm.lastPulled = Date.now();
    },

    /**
     * Rank a list of content IDs by Thompson Sampling scores
     * Returns sorted content IDs (highest engagement probability first)
     */
    rankByThompsonSampling(contentIds: string[]): { contentId: string; score: number }[] {
        return contentIds
            .map(id => ({ contentId: id, score: this.sample(id) }))
            .sort((a, b) => b.score - a.score);
    },

    /**
     * Select top N content items using Thompson Sampling with diversity
     * Ensures category diversity by limiting same-category items
     */
    selectDiverse(
        candidates: { contentId: string; category?: string }[],
        n: number,
        maxPerCategory: number = 3
    ): string[] {
        const scored = candidates.map(c => ({
            ...c,
            score: this.sample(c.contentId),
        }));
        scored.sort((a, b) => b.score - a.score);

        const selected: string[] = [];
        const categoryCount = new Map<string, number>();

        for (const item of scored) {
            if (selected.length >= n) break;
            const cat = item.category || "unknown";
            const count = categoryCount.get(cat) || 0;
            if (count >= maxPerCategory) continue; // Skip to maintain diversity
            selected.push(item.contentId);
            categoryCount.set(cat, count + 1);
        }

        return selected;
    },

    /**
     * Get stats for debugging/monitoring
     */
    getStats(): { total: number; topArms: ArmStats[] } {
        const all = [...armStatsMap.values()];
        const topArms = all
            .sort((a, b) => (b.alpha / (b.alpha + b.beta)) - (a.alpha / (a.alpha + a.beta)))
            .slice(0, 20);
        return { total: all.length, topArms };
    },

    /**
     * Reset stats (for testing)
     */
    reset(): void {
        armStatsMap.clear();
    },
};

export default Bandit;
