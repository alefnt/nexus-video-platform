// FILE: /client-web/src/lib/nostrAuth.ts
/**
 * Nostr NIP-07 Authentication Helper
 * 
 * Uses the browser's NIP-07 extension (e.g., nos2x, Alby) to sign login events.
 * Falls back to JoyID's nostrPubkey if available.
 * 
 * Reference: https://github.com/nostr-protocol/nips/blob/master/07.md
 */

import { getApiClient } from "./apiClient";

declare global {
    interface Window {
        nostr?: {
            getPublicKey(): Promise<string>;
            signEvent(event: any): Promise<any>;
        };
    }
}

/**
 * Check if a NIP-07 Nostr extension is available
 */
export function hasNostrExtension(): boolean {
    return typeof window !== "undefined" && !!window.nostr;
}

/**
 * Login with Nostr NIP-07 extension
 */
export async function loginWithNostr(): Promise<{
    success: boolean;
    jwt?: string;
    user?: any;
    error?: string;
}> {
    try {
        if (!window.nostr) {
            return { success: false, error: "No Nostr extension found. Install nos2x or Alby." };
        }

        // 1. Get public key from extension
        const pubkey = await window.nostr.getPublicKey();
        if (!pubkey) {
            return { success: false, error: "Failed to get Nostr public key" };
        }

        // 2. Create a login event (kind 22242 = NIP-42 AUTH)
        const event = {
            kind: 22242,
            created_at: Math.floor(Date.now() / 1000),
            tags: [["challenge", `nexus-login-${Date.now()}`]],
            content: "Login to Nexus Video Platform",
        };

        // 3. Sign the event
        const signedEvent = await window.nostr.signEvent(event);
        if (!signedEvent?.sig) {
            return { success: false, error: "Event signing failed" };
        }

        // 4. Send to backend
        const api = getApiClient();
        const result = await api.post<{
            jwt: string;
            user: any;
            offlineToken: any;
        }>("/auth/nostr", {
            pubkey,
            signature: signedEvent.sig,
            event: signedEvent,
        });

        if (result?.jwt) {
            sessionStorage.setItem("vp.jwt", result.jwt);
            if (result.user) {
                sessionStorage.setItem("vp.user", JSON.stringify(result.user));
            }
            return { success: true, jwt: result.jwt, user: result.user };
        }

        return { success: false, error: "Login response missing JWT" };
    } catch (err: any) {
        return { success: false, error: err?.message || "Nostr login failed" };
    }
}
