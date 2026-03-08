// FILE: /video-platform/client-web/src/components/NFTGallery.tsx
/**
 * NFT Gallery 组件
 * 
 * 功能说明：
 * - 显示用户持有的所有 NFT
 * - 分类: Ownership, Access Pass, Limited Edition, Badge
 * - 支持转移和熔化操作
 */

import React, { useState, useEffect } from "react";
import { getApiClient } from "../lib/apiClient";
import type { SporeInfo, SporeContent } from "@video-platform/shared/web3/spore";

const client = getApiClient();

interface NFTGalleryProps {
    showActions?: boolean;
}

export default function NFTGallery({ showActions = true }: NFTGalleryProps) {
    const [loading, setLoading] = useState(true);
    const [nfts, setNfts] = useState<{
        total: number;
        ownership: SporeInfo[];
        accessPasses: SporeInfo[];
        limitedEditions: SporeInfo[];
        badges: SporeInfo[];
    }>({ total: 0, ownership: [], accessPasses: [], limitedEditions: [], badges: [] });
    const [activeTab, setActiveTab] = useState<'all' | 'ownership' | 'access' | 'limited' | 'badges'>('all');

    useEffect(() => {
        const jwt = sessionStorage.getItem("vp.jwt");
        if (jwt) client.setJWT(jwt);

        client.get<typeof nfts>("/nft/my")
            .then(res => {
                setNfts(res);
                setLoading(false);
            })
            .catch(() => setLoading(false));
    }, []);

    const getDisplayNFTs = () => {
        switch (activeTab) {
            case 'ownership': return nfts.ownership;
            case 'access': return nfts.accessPasses;
            case 'limited': return nfts.limitedEditions;
            case 'badges': return nfts.badges;
            default: return [...nfts.ownership, ...nfts.accessPasses, ...nfts.limitedEditions, ...nfts.badges];
        }
    };

    const getTypeIcon = (type: SporeContent['type']) => {
        switch (type) {
            case 'video-ownership': return '🎬';
            case 'access-pass': return '🎫';
            case 'limited-edition': return '💎';
            case 'creator-badge': return '🏆';
            default: return '📦';
        }
    };

    const getTypeLabel = (type: SporeContent['type']) => {
        switch (type) {
            case 'video-ownership': return 'Ownership';
            case 'access-pass': return 'Access Pass';
            case 'limited-edition': return 'Limited Edition';
            case 'creator-badge': return 'Badge';
            default: return 'NFT';
        }
    };

    const handleTransfer = async (sporeId: string) => {
        const toAddress = prompt("Enter recipient CKB address:");
        if (!toAddress) return;

        try {
            const jwt = sessionStorage.getItem("vp.jwt");
            if (jwt) client.setJWT(jwt);

            await client.post("/nft/transfer", { sporeId, toAddress });
            alert("✅ Transfer successful!");
            window.location.reload();
        } catch (err: any) {
            alert("Transfer failed: " + (err?.message || err));
        }
    };

    const handleMelt = async (sporeId: string) => {
        if (!confirm("Are you sure you want to melt this NFT? You will get CKB back.")) return;

        try {
            const jwt = sessionStorage.getItem("vp.jwt");
            if (jwt) client.setJWT(jwt);

            const res = await client.post<{ ckbReturned: string }>("/nft/melt", { sporeId });
            alert(`✅ Melted! You received ${res.ckbReturned} CKB`);
            window.location.reload();
        } catch (err: any) {
            alert("Melt failed: " + (err?.message || err));
        }
    };

    if (loading) {
        return (
            <div className="glass-card" style={{ padding: 40, textAlign: "center" }}>
                <div className="spinner" style={{ width: 40, height: 40, margin: "0 auto 16px" }} />
                <p>Loading your NFTs...</p>
            </div>
        );
    }

    return (
        <div className="nft-gallery">
            {/* Header */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
                <h2 style={{ fontSize: 24, fontWeight: 700 }}>🖼️ My NFT Collection</h2>
                <div style={{ fontSize: 14, color: "var(--text-muted)" }}>
                    Total: <strong>{nfts.total}</strong> NFTs
                </div>
            </div>

            {/* Tabs */}
            <div style={{ display: "flex", gap: 8, marginBottom: 24, flexWrap: "wrap" }}>
                {[
                    { key: 'all', label: `All (${nfts.total})`, icon: '📦' },
                    { key: 'ownership', label: `Ownership (${nfts.ownership.length})`, icon: '🎬' },
                    { key: 'access', label: `Access Pass (${nfts.accessPasses.length})`, icon: '🎫' },
                    { key: 'limited', label: `Limited (${nfts.limitedEditions.length})`, icon: '💎' },
                    { key: 'badges', label: `Badges (${nfts.badges.length})`, icon: '🏆' },
                ].map(tab => (
                    <button
                        key={tab.key}
                        onClick={() => setActiveTab(tab.key as any)}
                        style={{
                            padding: "8px 16px",
                            borderRadius: 20,
                            border: activeTab === tab.key ? "2px solid var(--accent-cyan)" : "1px solid var(--border-subtle)",
                            background: activeTab === tab.key ? "rgba(0,212,255,0.1)" : "transparent",
                            color: activeTab === tab.key ? "var(--accent-cyan)" : "var(--text-muted)",
                            cursor: "pointer",
                            fontSize: 13,
                            fontWeight: 500,
                        }}
                    >
                        {tab.icon} {tab.label}
                    </button>
                ))}
            </div>

            {/* NFT Grid */}
            {getDisplayNFTs().length === 0 ? (
                <div className="glass-card" style={{ padding: 60, textAlign: "center" }}>
                    <div style={{ fontSize: 48, marginBottom: 16 }}>🖼️</div>
                    <p style={{ color: "var(--text-muted)" }}>No NFTs found in this category</p>
                </div>
            ) : (
                <div style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
                    gap: 20
                }}>
                    {getDisplayNFTs().map(nft => (
                        <div
                            key={nft.sporeId}
                            className="glass-card nft-card"
                            style={{
                                padding: 20,
                                borderRadius: 16,
                                border: "1px solid var(--glass-border)",
                                transition: "all 0.2s",
                            }}
                        >
                            {/* Type Badge */}
                            <div style={{
                                display: "inline-flex",
                                alignItems: "center",
                                gap: 6,
                                padding: "4px 10px",
                                background: "rgba(162, 103, 255, 0.2)",
                                borderRadius: 12,
                                fontSize: 12,
                                fontWeight: 600,
                                marginBottom: 12
                            }}>
                                <span>{getTypeIcon(nft.content.type)}</span>
                                <span>{getTypeLabel(nft.content.type)}</span>
                            </div>

                            {/* Content */}
                            <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>
                                {nft.content.title || nft.content.badgeType || "Untitled"}
                            </h3>

                            {/* Edition Number */}
                            {nft.content.type === 'limited-edition' && (
                                <div style={{
                                    fontSize: 20,
                                    fontWeight: 700,
                                    color: "var(--accent-cyan)",
                                    marginBottom: 8
                                }}>
                                    #{nft.content.editionNumber}/{nft.content.maxEditions}
                                </div>
                            )}

                            {/* Badge Icon */}
                            {nft.content.type === 'creator-badge' && (
                                <div style={{ fontSize: 40, marginBottom: 8 }}>
                                    {nft.content.badgeType === 'og_supporter' ? '🏆' :
                                        nft.content.badgeType === 'whale' ? '🐋' :
                                            nft.content.badgeType === 'creator_1k' ? '⭐' :
                                                nft.content.badgeType === 'remix_master' ? '🔥' : '💎'}
                                </div>
                            )}

                            {/* Description */}
                            {nft.content.description && (
                                <p style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 12 }}>
                                    {nft.content.description.slice(0, 80)}...
                                </p>
                            )}

                            {/* Meta Info */}
                            <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 12 }}>
                                <div>Issued: {new Date(nft.content.issuedAt).toLocaleDateString()}</div>
                                <div style={{ fontFamily: "monospace", fontSize: 10 }}>
                                    {nft.sporeId.slice(0, 16)}...
                                </div>
                            </div>

                            {/* CKB Value */}
                            <div style={{
                                display: "flex",
                                alignItems: "center",
                                gap: 6,
                                padding: "8px 12px",
                                background: "rgba(255, 217, 61, 0.1)",
                                borderRadius: 8,
                                marginBottom: 12
                            }}>
                                <span style={{ fontSize: 16 }}>💰</span>
                                <span style={{ fontSize: 14, fontWeight: 600, color: "var(--accent-yellow)" }}>
                                    {nft.capacity} CKB locked
                                </span>
                            </div>

                            {/* Actions */}
                            {showActions && (
                                <div style={{ display: "flex", gap: 8 }}>
                                    <button
                                        onClick={() => handleTransfer(nft.sporeId)}
                                        style={{
                                            flex: 1,
                                            padding: "8px 12px",
                                            borderRadius: 8,
                                            border: "1px solid var(--accent-purple)",
                                            background: "transparent",
                                            color: "var(--accent-purple)",
                                            cursor: "pointer",
                                            fontSize: 12,
                                        }}
                                    >
                                        Transfer
                                    </button>
                                    <button
                                        onClick={() => handleMelt(nft.sporeId)}
                                        style={{
                                            flex: 1,
                                            padding: "8px 12px",
                                            borderRadius: 8,
                                            border: "1px solid #FF6B9D",
                                            background: "transparent",
                                            color: "#FF6B9D",
                                            cursor: "pointer",
                                            fontSize: 12,
                                        }}
                                    >
                                        Melt 🔥
                                    </button>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
