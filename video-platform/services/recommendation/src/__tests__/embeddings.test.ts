// FILE: /video-platform/services/recommendation/src/__tests__/embeddings.test.ts
/**
 * Recommendation Engine — Embedding & Bandit Tests
 * Phase 9: Tests for the Two-Tower model and Thompson Sampling
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
    tagsToVector,
    computeEngagementScore,
    buildUserEmbedding,
    buildContentEmbedding,
    cosineSimilarity,
    EMBEDDING_DIM,
    TAG_CATEGORIES,
} from '../embeddings';
import { Bandit } from '../bandit';

describe('Embedding System', () => {
    describe('tagsToVector', () => {
        it('should create a vector of correct dimension', () => {
            const vec = tagsToVector(['music', 'entertainment']);
            expect(vec.length).toBe(EMBEDDING_DIM);
        });

        it('should produce normalized vectors (magnitude ~1)', () => {
            const vec = tagsToVector(['music', 'gaming', 'tech']);
            const magnitude = Math.sqrt(vec.reduce((s, v) => s + v * v, 0));
            expect(magnitude).toBeCloseTo(1.0, 1);
        });

        it('should map known tags to correct positions', () => {
            const vec = tagsToVector(['music']);
            const musicIdx = TAG_CATEGORIES.indexOf('music');
            expect(musicIdx).toBeGreaterThanOrEqual(0);
            expect(vec[musicIdx]).toBeGreaterThan(0);
        });

        it('should handle empty tags', () => {
            const vec = tagsToVector([]);
            const allZero = vec.every(v => v === 0);
            expect(allZero).toBe(true);
        });

        it('should handle unknown tags via hashing', () => {
            const vec = tagsToVector(['some_unique_custom_tag']);
            const hasNonZero = vec.some(v => v > 0);
            expect(hasNonZero).toBe(true);
        });
    });

    describe('computeEngagementScore', () => {
        it('should score full engagement highly', () => {
            const score = computeEngagementScore({
                watchTimeMs: 60000, durationMs: 60000,
                liked: true, commented: true, shared: true,
                replayed: true, skippedEarly: false,
            });
            expect(score).toBe(100);
        });

        it('should penalize early skip', () => {
            const score = computeEngagementScore({
                watchTimeMs: 5000, durationMs: 60000,
                liked: false, commented: false, shared: false,
                replayed: false, skippedEarly: true,
            });
            expect(score).toBeLessThan(20);
        });

        it('should never go below 0', () => {
            const score = computeEngagementScore({
                watchTimeMs: 0, durationMs: 60000,
                liked: false, commented: false, shared: false,
                replayed: false, skippedEarly: true,
            });
            expect(score).toBeGreaterThanOrEqual(0);
        });

        it('should reward partial watch + like', () => {
            const score = computeEngagementScore({
                watchTimeMs: 30000, durationMs: 60000,
                liked: true, commented: false, shared: false,
                replayed: false, skippedEarly: false,
            });
            expect(score).toBeGreaterThan(30);
            expect(score).toBeLessThan(60);
        });
    });

    describe('cosineSimilarity', () => {
        it('should return 1 for identical vectors', () => {
            const v = [1, 0, 0, 1];
            expect(cosineSimilarity(v, v)).toBeCloseTo(1.0, 5);
        });

        it('should return 0 for orthogonal vectors', () => {
            const a = [1, 0, 0, 0];
            const b = [0, 1, 0, 0];
            expect(cosineSimilarity(a, b)).toBeCloseTo(0, 5);
        });

        it('should handle zero vectors', () => {
            const zero = [0, 0, 0, 0];
            const v = [1, 2, 3, 4];
            expect(cosineSimilarity(zero, v)).toBe(0);
        });
    });

    describe('buildUserEmbedding', () => {
        it('should handle empty history', () => {
            const vec = buildUserEmbedding([]);
            expect(vec.length).toBe(EMBEDDING_DIM);
            expect(vec.every(v => v === 0)).toBe(true);
        });

        it('should weight by engagement', () => {
            const history = [
                { tags: ['music'], engagement: { watchTimeMs: 60000, durationMs: 60000, liked: true, commented: false, shared: false, replayed: false, skippedEarly: false } },
                { tags: ['gaming'], engagement: { watchTimeMs: 5000, durationMs: 60000, liked: false, commented: false, shared: false, replayed: false, skippedEarly: true } },
            ];
            const vec = buildUserEmbedding(history);
            const musicIdx = TAG_CATEGORIES.indexOf('music');
            const gamingIdx = TAG_CATEGORIES.indexOf('gaming');
            if (musicIdx >= 0 && gamingIdx >= 0) {
                expect(vec[musicIdx]).toBeGreaterThan(vec[gamingIdx]);
            }
        });
    });
});

describe('Multi-Armed Bandit', () => {
    beforeEach(() => {
        Bandit.reset();
    });

    it('should initialize arms with uniform prior', () => {
        const arm = Bandit.getArm('test-content');
        expect(arm.alpha).toBe(1);
        expect(arm.beta).toBe(1);
        expect(arm.pulls).toBe(0);
    });

    it('should update arm on success', () => {
        Bandit.recordSuccess('test-content');
        const arm = Bandit.getArm('test-content');
        expect(arm.alpha).toBe(2);
        expect(arm.pulls).toBe(1);
    });

    it('should update arm on failure', () => {
        Bandit.recordFailure('test-content');
        const arm = Bandit.getArm('test-content');
        expect(arm.beta).toBe(2);
        expect(arm.pulls).toBe(1);
    });

    it('should sample values between 0 and 1', () => {
        for (let i = 0; i < 100; i++) {
            const val = Bandit.sample('test-content');
            expect(val).toBeGreaterThanOrEqual(0);
            expect(val).toBeLessThanOrEqual(1);
        }
    });

    it('should rank content by Thompson Sampling', () => {
        // Add strong signal for content A
        for (let i = 0; i < 50; i++) Bandit.recordSuccess('contentA');
        for (let i = 0; i < 2; i++) Bandit.recordFailure('contentA');

        // Add weak signal for content B
        for (let i = 0; i < 2; i++) Bandit.recordSuccess('contentB');
        for (let i = 0; i < 50; i++) Bandit.recordFailure('contentB');

        const ranked = Bandit.rankByThompsonSampling(['contentA', 'contentB']);
        // Content A should usually be ranked first (high probability)
        expect(ranked[0].contentId).toBe('contentA');
    });

    it('should enforce diversity limits', () => {
        const candidates = [
            { contentId: 'a1', category: 'music' },
            { contentId: 'a2', category: 'music' },
            { contentId: 'a3', category: 'music' },
            { contentId: 'a4', category: 'music' },
            { contentId: 'b1', category: 'gaming' },
        ];

        const selected = Bandit.selectDiverse(candidates, 5, 2);
        // Should not have more than 2 music items
        const musicCount = selected.filter(id => id.startsWith('a')).length;
        expect(musicCount).toBeLessThanOrEqual(2);
    });
});
