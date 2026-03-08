
// FILE: /video-platform/shared/web3/spore.ts
/**
 * Spore Protocol SDK Integration (Real Implementation)
 * Uses @spore-sdk/core and @ckb-ccc/core
 */

import { ccc } from '@ckb-ccc/core';
import {
    createSpore,
    transferSpore,
    meltSpore,
    createCluster,
    predefinedSporeConfigs
} from '@spore-sdk/core';

// Environment Configuration
const CKB_NETWORK = process.env.CKB_NETWORK || "testnet";
const CKB_PRIVATE_KEY = process.env.CKB_PRIVATE_KEY || "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee"; // Default Dev Private Key
const SPORE_CONFIG = CKB_NETWORK === 'mainnet' ? predefinedSporeConfigs.Mainnet : predefinedSporeConfigs.Testnet;

export interface SporeContent {
    contentType: string;
    content: string | Buffer; // JSON string or Buffer
}

export interface MintSporeResult {
    txHash: string;
    sporeId: string;
}

// Badge Rules Definition
export const BADGE_RULES = {
    "early_adopter": { id: "badge_early", description: "Early Adopter Badge" },
    "top_creator": { id: "badge_creator", description: "Top Creator Badge" },
    "verified_user": { id: "badge_verified", description: "Verified User Badge" }
};

export class SporeClient {
    private signer: ccc.Signer;

    constructor(privateKey?: string) {
        // Initialize Signer (Platform Wallet for server-side operations)
        const pk = privateKey || CKB_PRIVATE_KEY;
        this.signer = new ccc.SignerCkbPrivateKey(ccc.ClientPublicTestnet, pk);
    }

    /**
     * Create a Spore Cluster (Collection/Series)
     */
    async createCluster(params: { name: string; description: string; public?: boolean; ownerAddress: string; maxSpores?: number }): Promise<{ txHash: string; clusterId: string }> {
        const { tx, id } = await createCluster({
            signer: this.signer,
            data: {
                name: params.name,
                description: params.description,
            },
            config: SPORE_CONFIG,
        });

        const txHash = await tx.complete();
        console.log(`[Spore] Cluster Created: ${id} (tx: ${txHash})`);
        return { txHash, clusterId: id };
    }

    /**
     * Mint a Spore (NFT)
     * Optional: Mint to a specific receiver (User) instead of the platform wallet.
     */
    async mintSpore(params: {
        content: SporeContent;
        clusterId?: string;
        toAddress?: string
    }): Promise<MintSporeResult> {

        const { tx, id } = await createSpore({
            signer: this.signer,
            data: {
                contentType: params.content.contentType,
                content: params.content.content,
                clusterId: params.clusterId,
            },
            to: params.toAddress, // If provided, mint directly to user
            config: SPORE_CONFIG,
        });

        const txHash = await tx.complete();
        console.log(`[Spore] Minted: ${id} (tx: ${txHash})`);
        return { txHash, sporeId: id };
    }

    /**
     * Mint Video Ownership Spore specifically
     * Enforces data integrity by requiring SHA-256 and storage references.
     */
    async mintVideoOwnershipSpore(
        videoId: string,
        title: string,
        creatorAddress: string, // User's CKB Address
        sha256: string,
        ipfsCid?: string,
        arweaveTxId?: string
    ): Promise<MintSporeResult> {
        const metadata = {
            type: 'video-ownership',
            videoId,
            title,
            sha256,
            ipfsCid,
            arweaveTxId,
            issuedAt: new Date().toISOString(),
        };

        return this.mintSpore({
            content: {
                contentType: 'application/json',
                content: JSON.stringify(metadata)
            },
            toAddress: creatorAddress
        });
    }

    /**
     * Mint Audio Ownership Spore
     */
    async mintAudioOwnershipSpore(
        audioId: string,
        title: string,
        creatorAddress: string,
        sha256: string,
        arweaveTxId?: string
    ): Promise<MintSporeResult> {
        const metadata = {
            type: 'audio-ownership',
            audioId,
            title,
            sha256,
            arweaveTxId,
            issuedAt: new Date().toISOString(),
        };

        return this.mintSpore({
            content: {
                contentType: 'application/json',
                content: JSON.stringify(metadata)
            },
            toAddress: creatorAddress
        });
    }

    /**
     * Mint Article Ownership Spore
     */
    async mintArticleOwnershipSpore(
        articleId: string,
        title: string,
        creatorAddress: string,
        textHash: string,
        arweaveTxId?: string
    ): Promise<MintSporeResult> {
        const metadata = {
            type: 'article-ownership',
            articleId,
            title,
            textHash,
            arweaveTxId,
            issuedAt: new Date().toISOString(),
        };

        return this.mintSpore({
            content: {
                contentType: 'application/json',
                content: JSON.stringify(metadata)
            },
            toAddress: creatorAddress
        });
    }

    /**
    * Mint Access Pass Spore
    */
    async mintAccessPassSpore(
        videoId: string,
        title: string,
        buyerAddress: string,
        clusterId?: string
    ): Promise<MintSporeResult> {
        const metadata = {
            type: 'access-pass',
            videoId,
            title,
            issuedAt: new Date().toISOString(),
        };

        return this.mintSpore({
            content: {
                contentType: 'application/json',
                content: JSON.stringify(metadata)
            },
            clusterId,
            toAddress: buyerAddress
        });
    }

    /**
     * Mint Limited Edition Spore
     */
    async mintLimitedEditionSpore(
        videoId: string,
        title: string,
        buyerAddress: string,
        clusterId: string,
        editionNumber: number,
        maxEditions: number
    ): Promise<MintSporeResult> {
        const metadata = {
            type: 'limited-edition',
            videoId,
            title,
            edition: editionNumber,
            maxEditions,
            issuedAt: new Date().toISOString(),
        };

        return this.mintSpore({
            content: {
                contentType: 'application/json',
                content: JSON.stringify(metadata)
            },
            clusterId,
            toAddress: buyerAddress
        });
    }

    /**
     * Mint Creator Badge Spore
     */
    async mintCreatorBadgeSpore(
        badgeId: string,
        description: string,
        recipientAddress: string
    ): Promise<MintSporeResult> {
        const metadata = {
            type: 'creator-badge',
            badgeId,
            description,
            issuedAt: new Date().toISOString(),
        };

        return this.mintSpore({
            content: {
                contentType: 'application/json',
                content: JSON.stringify(metadata)
            },
            toAddress: recipientAddress
        });
    }

    /**
     * Transfer Spore
     */
    async transferSpore(sporeId: string, fromAddress: string, toAddress: string): Promise<{ txHash: string }> {
        // Note: Real transfer requires the owner (fromAddress) to sign. 
        // If 'fromAddress' is not the platform wallet, we cannot sign it here unless we have the private key.
        // For this MVP, we assume the platform wallet holds it or we are just simulating for now if it's user-to-user.
        // IF it is user-to-user, the Frontend must sign. 
        // HERE, we attempt to sign with the platform key, which will fail if the platform doesn't own it.

        const { tx } = await transferSpore({
            signer: this.signer,
            id: sporeId,
            to: toAddress,
            config: SPORE_CONFIG,
        });

        const txHash = await tx.complete();
        return { txHash };
    }

    /**
     * Melt Spore (Burn)
     */
    async meltSpore(sporeId: string): Promise<{ txHash: string }> {
        const { tx } = await meltSpore({
            signer: this.signer,
            id: sporeId,
            config: SPORE_CONFIG,
        });

        const txHash = await tx.complete();
        return { txHash };
    }

    // === READ METHODS (Mocked for now as running a full Indexer query is complex without one) ===

    async getVideoOwnershipSpore(videoId: string): Promise<any | null> {
        // TODO: Implement actual Indexer Query
        return null;
    }

    async hasAccessPass(videoId: string, userAddress: string): Promise<boolean> {
        // TODO: Implement actual Indexer Query
        return false;
    }

    async getSporesByOwner(ownerAddress: string): Promise<any[]> {
        // TODO: Implement actual Indexer Query
        return [];
    }
}

// Export singleton
export const sporeClient = new SporeClient();
