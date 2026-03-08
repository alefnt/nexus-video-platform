// FILE: /video-platform/shared/web3/nostr.ts
/**
 * Nostr Protocol Integration — Decentralized Social Distribution
 * 
 * Enables:
 * - Content auto-publishing to Nostr relays
 * - Creator profile sync via NIP-01 events
 * - Asset binding (Nostr pubkey ↔ CKB address via JoyID)
 * - Social graph interoperability
 * 
 * References:
 * - NIP-01 (Basic): https://github.com/nostr-protocol/nips/blob/master/01.md
 * - NIP-07 (Browser): https://github.com/nostr-protocol/nips/blob/master/07.md
 * - nostr-tools: https://github.com/nbd-wtf/nostr-tools
 * 
 * Environment Variables:
 * - NOSTR_RELAYS: Comma-separated list of relay URLs
 * - NOSTR_PRIVATE_KEY: Platform's Nostr private key (for auto-publishing)
 */

// ============== Types ==============

export interface NostrEvent {
    id?: string;
    pubkey: string;
    created_at: number;
    kind: number;
    tags: string[][];
    content: string;
    sig?: string;
}

export interface NostrPublishResult {
    success: boolean;
    eventId?: string;
    relays?: string[];
    error?: string;
}

// ============== Constants ==============

const DEFAULT_RELAYS = [
    "wss://relay.damus.io",
    "wss://relay.nostr.band",
    "wss://nos.lol",
    "wss://relay.snort.social",
];

function getRelays(): string[] {
    const envRelays = process.env.NOSTR_RELAYS;
    if (envRelays) {
        return envRelays.split(",").map(r => r.trim()).filter(Boolean);
    }
    return DEFAULT_RELAYS;
}

// ============== Content Publishing ==============

/**
 * Publish content to Nostr network.
 * Uses NIP-01 Kind 1 (text note) for announcements.
 * 
 * @param content - The text content or announcement
 * @param tags - Nostr tags (e.g., ["t", "video"], ["p", pubkey])
 * @param pubkey - Publisher's Nostr public key
 */
export async function publishToNostr(params: {
    content: string;
    pubkey: string;
    tags?: string[][];
    kind?: number;
}): Promise<NostrPublishResult> {
    const relays = getRelays();

    const event: NostrEvent = {
        pubkey: params.pubkey,
        created_at: Math.floor(Date.now() / 1000),
        kind: params.kind || 1, // Kind 1 = text note
        tags: params.tags || [],
        content: params.content,
    };

    try {
        // In production, use nostr-tools to sign and publish
        // const { getEventHash, signEvent, SimplePool } = await import("nostr-tools");
        // event.id = getEventHash(event);
        // event.sig = signEvent(event, privateKey);
        // const pool = new SimplePool();
        // await pool.publish(relays, event);

        // For now, attempt WebSocket publish to first available relay
        const published = await publishToRelay(relays[0], event);

        console.log(`[Nostr] Published event (kind ${event.kind}): ${event.content.slice(0, 50)}...`);
        return {
            success: published,
            eventId: event.id,
            relays: published ? [relays[0]] : [],
        };
    } catch (err: any) {
        console.error(`[Nostr] Publish failed:`, err?.message);
        return { success: false, error: err?.message };
    }
}

/**
 * Publish a video/content announcement to Nostr
 */
export async function publishContentAnnouncement(params: {
    title: string;
    description: string;
    contentUrl: string;
    contentType: "video" | "music" | "article";
    creatorPubkey: string;
    sporeId?: string;
    tags?: string[];
}): Promise<NostrPublishResult> {
    const content = [
        `🎬 New ${params.contentType}: ${params.title}`,
        "",
        params.description.slice(0, 200),
        "",
        `Watch: ${params.contentUrl}`,
        params.sporeId ? `📜 NFT: ${params.sporeId}` : "",
    ].filter(Boolean).join("\n");

    const nostrTags: string[][] = [
        ["t", params.contentType],
        ["t", "nexus"],
        ...(params.tags || []).map(t => ["t", t]),
        ...(params.sporeId ? [["r", params.sporeId]] : []),
    ];

    return publishToNostr({
        content,
        pubkey: params.creatorPubkey,
        tags: nostrTags,
        kind: 1,
    });
}

// ============== Asset Binding ==============

/**
 * Bind a Nostr pubkey to a CKB address (via record)
 * Uses NIP-05-like verification pattern
 */
export function createAssetBindingEvent(params: {
    nostrPubkey: string;
    ckbAddress: string;
    sporeIds?: string[];
}): NostrEvent {
    return {
        pubkey: params.nostrPubkey,
        created_at: Math.floor(Date.now() / 1000),
        kind: 30078, // Kind 30078 = application-specific data
        tags: [
            ["d", "nexus-asset-binding"],
            ["ckb", params.ckbAddress],
            ...(params.sporeIds || []).map(id => ["spore", id]),
        ],
        content: JSON.stringify({
            platform: "nexus",
            ckbAddress: params.ckbAddress,
            sporeIds: params.sporeIds || [],
            timestamp: Date.now(),
        }),
    };
}

// ============== Low-level WebSocket Publish ==============

async function publishToRelay(relayUrl: string, event: NostrEvent): Promise<boolean> {
    try {
        // Use dynamic import for WebSocket in Node.js
        const WebSocket = globalThis.WebSocket || (await import("ws")).default;

        return new Promise((resolve) => {
            const ws = new WebSocket(relayUrl);
            const timeout = setTimeout(() => {
                ws.close();
                resolve(false);
            }, 5000);

            ws.onopen = () => {
                ws.send(JSON.stringify(["EVENT", event]));
            };

            ws.onmessage = (msg: any) => {
                const data = JSON.parse(typeof msg.data === "string" ? msg.data : msg.data.toString());
                if (data[0] === "OK") {
                    clearTimeout(timeout);
                    ws.close();
                    resolve(true);
                }
            };

            ws.onerror = () => {
                clearTimeout(timeout);
                resolve(false);
            };
        });
    } catch {
        return false;
    }
}
