// FILE: /video-platform/shared/web3/postPaymentSplitHook.ts
/**
 * Post-Payment Split Hook — RGB++ Auto Revenue Distribution
 * 
 * Bridges Fiber Network payments to RGB++ Split Contracts:
 *   Fiber sendPayment() succeeded → lookup split contract → executeSplit()
 * 
 * Triggered after every successful Fiber (or Points) payment on content that has
 * an associated RGB++ revenue split contract.
 * 
 * Supports ALL content types: video, music, article, AI tools, live streaming.
 */

import { RGBPPSplitClient, SplitParticipant, SplitExecutionResult } from './rgbpp.js';

// ============== Types ==============

export type ContentType = 'video' | 'music' | 'article' | 'live' | 'ai_tool';

interface PaymentEvent {
    paymentHash: string;
    amount: number;            // Amount in CKB shannons or PTS
    contentId: string;         // Video/Music/Article/AI Tool ID
    contentType: ContentType;  // Discriminator for content table
    payerId: string;           // User who paid
    backend: 'fiber' | 'points';
}

interface SplitHookResult {
    triggered: boolean;
    contractId?: string;
    contentType?: ContentType;
    splitResult?: SplitExecutionResult;
    error?: string;
}

// ============== Contract Registry ==============

// In production, this queries the database for content→splitContract mappings.
// Supports all content types via composite key: `${contentType}:${contentId}`
const contractRegistry = new Map<string, {
    contractId: string;
    contentType: ContentType;
    participants: SplitParticipant[];
}>();

/**
 * Generate a registry key from content type and ID.
 */
function registryKey(contentType: ContentType, contentId: string): string {
    return `${contentType}:${contentId}`;
}

/**
 * Register a content's split contract so the hook can find it.
 * Called when a creator sets up revenue sharing via RGB++.
 * Works for ANY content type: video, music, article, AI tool, live.
 */
export function registerSplitContract(
    contentId: string,
    contractId: string,
    participants: SplitParticipant[],
    contentType: ContentType = 'video',
): void {
    const key = registryKey(contentType, contentId);
    contractRegistry.set(key, { contractId, contentType, participants });
    console.log(`[SplitHook] Registered contract ${contractId} for ${contentType}:${contentId} (${participants.length} participants)`);
}

/**
 * Unregister a content's split contract.
 */
export function unregisterSplitContract(contentId: string, contentType: ContentType = 'video'): void {
    contractRegistry.delete(registryKey(contentType, contentId));
}

// ============== The Hook ==============

const splitClient = new RGBPPSplitClient();

/**
 * Post-Payment Split Hook.
 * 
 * Call this AFTER a successful Fiber (or Points) payment.
 * It checks if the content has an RGB++ split contract, and if so,
 * automatically executes the revenue distribution.
 * 
 * This is fire-and-forget — failures are logged but do not block the payment response.
 * 
 * Supports: video, music, article, AI tool, live streaming content.
 */
export async function postPaymentSplitHook(event: PaymentEvent): Promise<SplitHookResult> {
    const { contentId, contentType, amount, paymentHash, backend } = event;

    // 1. Check if this content has a split contract (type-specific lookup)
    const key = registryKey(contentType, contentId);
    let registration = contractRegistry.get(key);

    // Fallback: try without type prefix for backward compatibility
    if (!registration) {
        registration = contractRegistry.get(registryKey('video', contentId));
    }

    if (!registration) {
        // No split contract for this content — most content won't have one
        return { triggered: false };
    }

    const { contractId, participants } = registration;

    // 2. Skip if amount is too small to meaningfully split
    if (amount <= 0) {
        return { triggered: false, error: 'Amount is 0 or negative' };
    }

    console.log(`[SplitHook] Triggering split for ${contentType}:${contentId} amount=${amount} hash=${paymentHash} backend=${backend}`);

    // 3. Execute the RGB++ split
    try {
        const splitResult = await splitClient.executeSplit(contractId, amount, participants);

        if (splitResult.success) {
            console.log(`[SplitHook] ✅ Split success for ${contentType}: ${splitResult.distributions.length} recipients, total=${splitResult.totalDistributed}, fee=${splitResult.platformFee}, tx=${splitResult.txHash}`);
        } else {
            console.error(`[SplitHook] ❌ Split failed for ${contentType}: ${splitResult.error}`);
        }

        return {
            triggered: true,
            contractId,
            contentType,
            splitResult,
        };
    } catch (error: any) {
        console.error(`[SplitHook] ❌ Exception during ${contentType} split:`, error?.message);
        return {
            triggered: true,
            contractId,
            contentType,
            error: error?.message || 'Unknown split error',
        };
    }
}

/**
 * Load split contracts from database into the in-memory registry.
 * Call this on service startup.
 * 
 * Queries ALL content tables: Video, Music, Article.
 * Also loads RevenueSplitRule entries for cross-referencing.
 */
export async function loadSplitContractsFromDB(prisma: any): Promise<number> {
    let totalLoaded = 0;

    // ── Video split contracts ──
    try {
        const videos = await prisma.video.findMany({
            where: { splitContractId: { not: null } },
            select: { id: true, splitContractId: true, splitParticipants: true, contentType: true },
        });

        for (const content of videos || []) {
            if (content.splitContractId && content.splitParticipants) {
                try {
                    const participants = typeof content.splitParticipants === 'string'
                        ? JSON.parse(content.splitParticipants)
                        : content.splitParticipants;
                    // Video model can hold video, audio, or article via contentType field
                    const type: ContentType = content.contentType === 'audio' ? 'music' : (content.contentType || 'video');
                    registerSplitContract(content.id, content.splitContractId, participants, type);
                    totalLoaded++;
                } catch { /* skip malformed entries */ }
            }
        }
        console.log(`[SplitHook] Loaded ${videos?.length || 0} video split contracts`);
    } catch (error: any) {
        console.warn(`[SplitHook] Could not load video contracts: ${error?.message}`);
    }

    // ── Music split contracts ──
    try {
        const musicItems = await prisma.music.findMany({
            where: { splitContractId: { not: null } },
            select: { id: true, splitContractId: true, splitParticipants: true },
        });

        for (const content of musicItems || []) {
            if (content.splitContractId && content.splitParticipants) {
                try {
                    const participants = typeof content.splitParticipants === 'string'
                        ? JSON.parse(content.splitParticipants)
                        : content.splitParticipants;
                    registerSplitContract(content.id, content.splitContractId, participants, 'music');
                    totalLoaded++;
                } catch { /* skip malformed entries */ }
            }
        }
        console.log(`[SplitHook] Loaded ${musicItems?.length || 0} music split contracts`);
    } catch (error: any) {
        console.warn(`[SplitHook] Could not load music contracts: ${error?.message}`);
    }

    // ── Article split contracts ──
    try {
        const articles = await prisma.article.findMany({
            where: { splitContractId: { not: null } },
            select: { id: true, splitContractId: true, splitParticipants: true },
        });

        for (const content of articles || []) {
            if (content.splitContractId && content.splitParticipants) {
                try {
                    const participants = typeof content.splitParticipants === 'string'
                        ? JSON.parse(content.splitParticipants)
                        : content.splitParticipants;
                    registerSplitContract(content.id, content.splitContractId, participants, 'article');
                    totalLoaded++;
                } catch { /* skip malformed entries */ }
            }
        }
        console.log(`[SplitHook] Loaded ${articles?.length || 0} article split contracts`);
    } catch (error: any) {
        console.warn(`[SplitHook] Could not load article contracts: ${error?.message}`);
    }

    // ── RevenueSplitRule-based contracts (fallback for content without dedicated split fields) ──
    try {
        const rules = await prisma.revenueSplitRule.findMany({
            select: { targetType: true, targetId: true, userId: true, percentage: true, role: true, fiberAddress: true },
        });

        // Group rules by targetType:targetId
        const ruleGroups = new Map<string, SplitParticipant[]>();
        for (const rule of rules || []) {
            const key = `${rule.targetType}:${rule.targetId}`;
            if (!ruleGroups.has(key)) ruleGroups.set(key, []);
            ruleGroups.get(key)!.push({
                address: rule.fiberAddress || rule.userId,
                percentage: Number(rule.percentage),
                role: rule.role || 'collaborator',
            });
        }

        // Register rule groups that aren't already registered from content tables
        for (const [key, participants] of ruleGroups) {
            if (!contractRegistry.has(key)) {
                const [type, id] = key.split(':');
                // Use a synthetic contract ID for rule-based splits
                registerSplitContract(id, `rule:${key}`, participants, type as ContentType);
                totalLoaded++;
            }
        }
        console.log(`[SplitHook] Loaded ${ruleGroups.size} revenue split rules`);
    } catch (error: any) {
        console.warn(`[SplitHook] Could not load revenue split rules: ${error?.message}`);
    }

    console.log(`[SplitHook] Total: ${totalLoaded} split contracts loaded from database`);
    return totalLoaded;
}
