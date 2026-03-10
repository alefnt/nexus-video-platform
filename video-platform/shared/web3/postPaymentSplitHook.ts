// FILE: /video-platform/shared/web3/postPaymentSplitHook.ts
/**
 * Post-Payment Split Hook — RGB++ Auto Revenue Distribution
 * 
 * Bridges Fiber Network payments to RGB++ Split Contracts:
 *   Fiber sendPayment() succeeded → lookup split contract → executeSplit()
 * 
 * Triggered after every successful Fiber payment on content that has
 * an associated RGB++ revenue split contract.
 */

import { RGBPPSplitClient, SplitParticipant, SplitExecutionResult } from './rgbpp.js';

// ============== Types ==============

interface PaymentEvent {
    paymentHash: string;
    amount: number;            // Amount in CKB shannons or PTS
    contentId: string;         // Video/Music/Article ID
    contentType?: 'video' | 'music' | 'article' | 'live';
    payerId: string;           // User who paid
    backend: 'fiber' | 'points';
}

interface SplitHookResult {
    triggered: boolean;
    contractId?: string;
    splitResult?: SplitExecutionResult;
    error?: string;
}

// ============== Contract Registry ==============

// In production, this queries the database for content→splitContract mappings.
// For now, uses an in-memory cache that is populated when contracts are created.
const contractRegistry = new Map<string, {
    contractId: string;
    participants: SplitParticipant[];
}>();

/**
 * Register a content's split contract so the hook can find it.
 * Called when a creator sets up revenue sharing via RGB++.
 */
export function registerSplitContract(
    contentId: string,
    contractId: string,
    participants: SplitParticipant[]
): void {
    contractRegistry.set(contentId, { contractId, participants });
    console.log(`[SplitHook] Registered contract ${contractId} for content ${contentId} (${participants.length} participants)`);
}

/**
 * Unregister a content's split contract.
 */
export function unregisterSplitContract(contentId: string): void {
    contractRegistry.delete(contentId);
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
 */
export async function postPaymentSplitHook(event: PaymentEvent): Promise<SplitHookResult> {
    const { contentId, amount, paymentHash, backend } = event;

    // 1. Check if this content has a split contract
    const registration = contractRegistry.get(contentId);
    if (!registration) {
        // No split contract for this content — most content won't have one
        return { triggered: false };
    }

    const { contractId, participants } = registration;

    // 2. Skip if amount is too small to meaningfully split
    if (amount <= 0) {
        return { triggered: false, error: 'Amount is 0 or negative' };
    }

    console.log(`[SplitHook] Triggering split for content=${contentId} amount=${amount} hash=${paymentHash} backend=${backend}`);

    // 3. Execute the RGB++ split
    try {
        const splitResult = await splitClient.executeSplit(contractId, amount, participants);

        if (splitResult.success) {
            console.log(`[SplitHook] ✅ Split success: ${splitResult.distributions.length} recipients, total=${splitResult.totalDistributed}, fee=${splitResult.platformFee}, tx=${splitResult.txHash}`);
        } else {
            console.error(`[SplitHook] ❌ Split failed: ${splitResult.error}`);
        }

        return {
            triggered: true,
            contractId,
            splitResult,
        };
    } catch (error: any) {
        console.error(`[SplitHook] ❌ Exception during split:`, error?.message);
        return {
            triggered: true,
            contractId,
            error: error?.message || 'Unknown split error',
        };
    }
}

/**
 * Load split contracts from database into the in-memory registry.
 * Call this on service startup.
 */
export async function loadSplitContractsFromDB(prisma: any): Promise<number> {
    try {
        // Query all content items that have an associated splitContractId
        const contents = await prisma.video.findMany({
            where: { splitContractId: { not: null } },
            select: { id: true, splitContractId: true, splitParticipants: true },
        });

        let loaded = 0;
        for (const content of contents || []) {
            if (content.splitContractId && content.splitParticipants) {
                try {
                    const participants = typeof content.splitParticipants === 'string'
                        ? JSON.parse(content.splitParticipants)
                        : content.splitParticipants;
                    registerSplitContract(content.id, content.splitContractId, participants);
                    loaded++;
                } catch { /* skip malformed entries */ }
            }
        }

        console.log(`[SplitHook] Loaded ${loaded} split contracts from database`);
        return loaded;
    } catch (error: any) {
        // Table/column may not exist yet — gracefully handle
        console.warn(`[SplitHook] Could not load contracts from DB: ${error?.message}`);
        return 0;
    }
}
