/**
 * NFTMarketplace — Browse and trade content NFTs
 * Video fragments, music NFTs, creator passes, SBT badges
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { usePageTitle } from '../hooks/usePageTitle';
import { getApiClient } from '../lib/apiClient';
import { showAlert, showConfirm } from '../components/ui/ConfirmModal';

const client = getApiClient();

type NFTType = 'all' | 'video_fragment' | 'music' | 'creator_pass' | 'sbt';
type SortBy = 'newest' | 'price_asc' | 'price_desc' | 'popular';

interface NFTListing {
    id: string;
    tokenId: string;
    title: string;
    description: string;
    imageUrl: string;
    type: string;
    rarity: 'common' | 'rare' | 'epic' | 'legendary';
    price: number;
    currency: string;
    seller: { id: string; name: string; avatar?: string };
    listedAt: string;
    likes: number;
}

const RARITY_COLORS: Record<string, string> = {
    common: '#9ca3af',
    rare: '#3b82f6',
    epic: '#a855f7',
    legendary: '#f59e0b',
};

const FALLBACK_LISTINGS: NFTListing[] = [
    { id: '1', tokenId: 'spore-001', title: 'Eclipse Protocol — Chapter 1 Fragment', description: 'Rare first chapter fragment', imageUrl: 'https://images.unsplash.com/photo-1451187580459-43490279c0fa?auto=format&fit=crop&q=80&w=400', type: 'video_fragment', rarity: 'rare', price: 250, currency: 'PTS', seller: { id: 'u1', name: 'CyberCreator' }, listedAt: '2026-03-01', likes: 42 },
    { id: '2', tokenId: 'spore-002', title: 'Lo-Fi Beats V2 — Full Album NFT', description: 'Own the entire album on-chain', imageUrl: 'https://images.unsplash.com/photo-1614613535308-eb5fbd3d2c17?auto=format&fit=crop&q=80&w=400', type: 'music', rarity: 'epic', price: 500, currency: 'PTS', seller: { id: 'u2', name: 'BeatMaker' }, listedAt: '2026-02-28', likes: 89 },
    { id: '3', tokenId: 'spore-003', title: 'Genesis Creator Pass #42', description: 'Lifetime premium access pass', imageUrl: 'https://images.unsplash.com/photo-1639762681057-408e52192e55?auto=format&fit=crop&q=80&w=400', type: 'creator_pass', rarity: 'legendary', price: 2000, currency: 'PTS', seller: { id: 'u3', name: 'NexusOG' }, listedAt: '2026-02-25', likes: 156 },
    { id: '4', tokenId: 'spore-004', title: 'First Upload Achievement SBT', description: 'Soul-bound token for early uploaders', imageUrl: 'https://images.unsplash.com/photo-1558618666-fcd25c85f82e?auto=format&fit=crop&q=80&w=400', type: 'sbt', rarity: 'common', price: 0, currency: 'PTS', seller: { id: 'u4', name: 'System' }, listedAt: '2026-03-02', likes: 23 },
    { id: '5', tokenId: 'spore-005', title: 'Drone Footage — Mountain Peak', description: 'Cinematic 4K drone fragment', imageUrl: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?auto=format&fit=crop&q=80&w=400', type: 'video_fragment', rarity: 'common', price: 50, currency: 'PTS', seller: { id: 'u5', name: 'SkyView' }, listedAt: '2026-03-03', likes: 15 },
    { id: '6', tokenId: 'spore-006', title: 'AI Art Remix — Neural Dreams', description: 'AI-generated visual NFT', imageUrl: 'https://images.unsplash.com/photo-1620641788421-7a1c342ea42e?auto=format&fit=crop&q=80&w=400', type: 'music', rarity: 'rare', price: 180, currency: 'PTS', seller: { id: 'u6', name: 'ArtBot' }, listedAt: '2026-03-01', likes: 67 },
];

export default function NFTMarketplace() {
    const { t } = useTranslation();
    const navigate = useNavigate();
    usePageTitle('NFT Marketplace');

    const [listings, setListings] = useState<NFTListing[]>(FALLBACK_LISTINGS);
    const [typeFilter, setTypeFilter] = useState<NFTType>('all');
    const [sortBy, setSortBy] = useState<SortBy>('newest');
    const [loading, setLoading] = useState(false);
    const [showListModal, setShowListModal] = useState(false);
    const [listForm, setListForm] = useState({ tokenId: '', title: '', price: '', description: '', type: 'video_fragment', rarity: 'common' });
    const [listLoading, setListLoading] = useState(false);

    // Fetch from API (falls back to mock)
    useEffect(() => {
        const fetchListings = async () => {
            setLoading(true);
            try {
                const jwt = sessionStorage.getItem('vp.jwt');
                if (jwt) client.setJWT(jwt);
                const data = await client.get<{ items: NFTListing[] }>('/nft/marketplace/listings');
                if (data?.items?.length) setListings(data.items);
            } catch {
                // API failed — keep empty state
            } finally {
                setLoading(false);
            }
        };
        fetchListings();
    }, []);

    const filtered = listings
        .filter(l => typeFilter === 'all' || l.type === typeFilter)
        .sort((a, b) => {
            if (sortBy === 'price_asc') return a.price - b.price;
            if (sortBy === 'price_desc') return b.price - a.price;
            if (sortBy === 'popular') return b.likes - a.likes;
            return new Date(b.listedAt).getTime() - new Date(a.listedAt).getTime();
        });

    const handleBuy = useCallback(async (item: NFTListing) => {
        const confirmed = await showConfirm({
            title: `Buy "${item.title}"`,
            message: `Price: ${item.price} ${item.currency}\nRarity: ${item.rarity.toUpperCase()}\n\nConfirm purchase?`,
            confirmText: 'Buy Now',
            variant: 'success',
        });
        if (!confirmed) return;

        try {
            const jwt = sessionStorage.getItem('vp.jwt');
            if (jwt) client.setJWT(jwt);
            await client.post('/nft/marketplace/buy', { listingId: item.id, tokenId: item.tokenId });
            showAlert({ title: 'Purchased!', message: `"${item.title}" is now in your collection.`, variant: 'success' });
            setListings(prev => prev.filter(l => l.id !== item.id));
        } catch (e: any) {
            showAlert({ title: 'Purchase Failed', message: e?.message || 'Unknown error', variant: 'danger' });
        }
    }, []);

    const handleList = async () => {
        if (!listForm.tokenId || !listForm.title || !listForm.price) return;
        try {
            setListLoading(true);
            const jwt = sessionStorage.getItem('vp.jwt');
            if (jwt) client.setJWT(jwt);
            await client.post('/nft/marketplace/list', {
                tokenId: listForm.tokenId,
                title: listForm.title,
                price: Number(listForm.price),
                description: listForm.description,
                type: listForm.type,
                rarity: listForm.rarity,
            });
            showAlert({ title: 'Listed!', message: `"${listForm.title}" is now on the marketplace.`, variant: 'success' });
            setShowListModal(false);
            setListForm({ tokenId: '', title: '', price: '', description: '', type: 'video_fragment', rarity: 'common' });
        } catch (e: any) {
            showAlert({ title: 'Listing Failed', message: e?.error || e?.message || 'Unknown error', variant: 'danger' });
        } finally {
            setListLoading(false);
        }
    };

    const S = styles;

    return (
        <div style={S.container}>
            {/* List NFT Modal */}
            {showListModal && (
                <div style={{ position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)' }} onClick={() => setShowListModal(false)}>
                    <div style={{ width: '100%', maxWidth: 440, margin: 16, background: '#0A0A14', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 20, padding: 28 }} onClick={e => e.stopPropagation()}>
                        <h3 style={{ fontSize: 18, fontWeight: 800, margin: '0 0 20px', letterSpacing: 2 }}>📦 LIST YOUR NFT</h3>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                            <input placeholder="Spore Token ID" value={listForm.tokenId} onChange={e => setListForm(f => ({ ...f, tokenId: e.target.value }))} style={{ background: 'rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, padding: '10px 12px', color: '#fff', fontSize: 13, outline: 'none' }} />
                            <input placeholder="Title" value={listForm.title} onChange={e => setListForm(f => ({ ...f, title: e.target.value }))} style={{ background: 'rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, padding: '10px 12px', color: '#fff', fontSize: 13, outline: 'none' }} />
                            <input placeholder="Price (PTS)" type="number" value={listForm.price} onChange={e => setListForm(f => ({ ...f, price: e.target.value }))} style={{ background: 'rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, padding: '10px 12px', color: '#fff', fontSize: 13, outline: 'none' }} />
                            <textarea placeholder="Description" value={listForm.description} onChange={e => setListForm(f => ({ ...f, description: e.target.value }))} rows={2} style={{ background: 'rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, padding: '10px 12px', color: '#fff', fontSize: 13, outline: 'none', resize: 'none' }} />
                            <div style={{ display: 'flex', gap: 8 }}>
                                <select value={listForm.type} onChange={e => setListForm(f => ({ ...f, type: e.target.value }))} style={{ flex: 1, background: 'rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, padding: '8px', color: '#fff', fontSize: 12, outline: 'none' }}>
                                    <option value="video_fragment">🎬 Video</option>
                                    <option value="music">🎵 Music</option>
                                    <option value="creator_pass">🎫 Pass</option>
                                </select>
                                <select value={listForm.rarity} onChange={e => setListForm(f => ({ ...f, rarity: e.target.value }))} style={{ flex: 1, background: 'rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, padding: '8px', color: '#fff', fontSize: 12, outline: 'none' }}>
                                    <option value="common">Common</option>
                                    <option value="rare">Rare</option>
                                    <option value="epic">Epic</option>
                                    <option value="legendary">Legendary</option>
                                </select>
                            </div>
                            <button onClick={handleList} disabled={listLoading || !listForm.tokenId || !listForm.title || !listForm.price}
                                style={{ ...S.listBtn, width: '100%', padding: '12px', marginTop: 8, opacity: listLoading ? 0.5 : 1 }}>
                                {listLoading ? 'Listing...' : '🚀 List on Marketplace'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Header */}
            <div style={S.header}>
                <div>
                    <h1 style={S.title}>🏪 NFT Marketplace</h1>
                    <p style={S.subtitle}>Trade video fragments, music NFTs, creator passes & more</p>
                </div>
                <button
                    style={S.listBtn}
                    onClick={() => setShowListModal(true)}
                >
                    + List My NFT
                </button>
            </div>

            {/* Filters */}
            <div style={S.filters}>
                {[
                    { key: 'all', label: '🌐 All' },
                    { key: 'video_fragment', label: '🎬 Video' },
                    { key: 'music', label: '🎵 Music' },
                    { key: 'creator_pass', label: '🎫 Pass' },
                    { key: 'sbt', label: '🏆 SBT' },
                ].map(f => (
                    <button
                        key={f.key}
                        onClick={() => setTypeFilter(f.key as NFTType)}
                        style={{
                            ...S.filterBtn,
                            ...(typeFilter === f.key ? S.filterBtnActive : {}),
                        }}
                    >
                        {f.label}
                    </button>
                ))}
                <span style={{ flex: 1 }} />
                <select
                    value={sortBy}
                    onChange={e => setSortBy(e.target.value as SortBy)}
                    style={S.sortSelect}
                >
                    <option value="newest">Newest</option>
                    <option value="popular">Most Popular</option>
                    <option value="price_asc">Price ↑</option>
                    <option value="price_desc">Price ↓</option>
                </select>
            </div>

            {/* Results count */}
            <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 13, margin: '0 0 16px' }}>
                {filtered.length} items
            </p>

            {/* Grid */}
            <div style={S.grid}>
                {filtered.map(item => (
                    <div key={item.id} style={S.card}>
                        {/* Image */}
                        <div style={S.imageContainer}>
                            <img src={item.imageUrl} alt={item.title} style={S.image} />
                            <div style={{ ...S.rarityBadge, background: RARITY_COLORS[item.rarity] + '30', color: RARITY_COLORS[item.rarity], borderColor: RARITY_COLORS[item.rarity] + '60' }}>
                                {item.rarity}
                            </div>
                            <div style={S.typeBadge}>{item.type.replace('_', ' ')}</div>
                        </div>

                        {/* Info */}
                        <div style={S.cardBody}>
                            <h3 style={S.cardTitle}>{item.title}</h3>
                            <p style={S.cardDesc}>{item.description}</p>

                            <div style={S.cardFooter}>
                                <div>
                                    <div style={S.cardPrice}>{item.price > 0 ? `${item.price} PTS` : 'Soulbound'}</div>
                                    <div style={S.cardSeller}>by {item.seller.name}</div>
                                </div>
                                {item.price > 0 && item.type !== 'sbt' ? (
                                    <button style={S.buyBtn} onClick={() => handleBuy(item)}>Buy</button>
                                ) : (
                                    <span style={S.sbtLabel}>🔒 Non-transferable</span>
                                )}
                            </div>

                            <div style={S.likes}>❤️ {item.likes}</div>
                        </div>
                    </div>
                ))}
            </div>

            {filtered.length === 0 && (
                <div style={{ textAlign: 'center', padding: '60px 0', color: 'rgba(255,255,255,0.3)' }}>
                    <div style={{ fontSize: 48, marginBottom: 12 }}>🏜️</div>
                    <p>No items found in this category</p>
                </div>
            )}
        </div>
    );
}

// ─── Styles ────────────────────────────────────────────────

const styles: Record<string, React.CSSProperties> = {
    container: { minHeight: '100vh', padding: '32px 40px 80px', color: '#fff' },
    header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 },
    title: { fontSize: 28, fontWeight: 800, margin: 0 },
    subtitle: { fontSize: 14, color: 'rgba(255,255,255,0.45)', marginTop: 4 },
    listBtn: {
        padding: '10px 20px', borderRadius: 10, border: 'none',
        background: 'linear-gradient(135deg, #8b5cf6, #6d28d9)', color: '#fff',
        fontSize: 14, fontWeight: 700, cursor: 'pointer', boxShadow: '0 0 20px rgba(139,92,246,0.3)',
    },
    filters: { display: 'flex', gap: 8, alignItems: 'center', marginBottom: 16, flexWrap: 'wrap' as const },
    filterBtn: {
        padding: '8px 16px', borderRadius: 20, border: '1px solid rgba(255,255,255,0.1)',
        background: 'rgba(255,255,255,0.04)', color: 'rgba(255,255,255,0.6)',
        fontSize: 13, fontWeight: 600, cursor: 'pointer',
    },
    filterBtnActive: {
        background: 'rgba(139,92,246,0.15)', border: '1px solid rgba(139,92,246,0.5)', color: '#c4b5fd',
    },
    sortSelect: {
        background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
        borderRadius: 8, color: '#fff', padding: '6px 12px', fontSize: 13, outline: 'none',
    },
    grid: {
        display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 20,
    },
    card: {
        background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: 16, overflow: 'hidden', transition: 'transform 0.2s, border-color 0.2s',
    },
    imageContainer: { position: 'relative' as const, paddingTop: '75%', overflow: 'hidden' },
    image: { position: 'absolute' as const, inset: 0, width: '100%', height: '100%', objectFit: 'cover' as const },
    rarityBadge: {
        position: 'absolute' as const, top: 10, left: 10, padding: '3px 10px', borderRadius: 20,
        fontSize: 10, fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: 1,
        border: '1px solid', backdropFilter: 'blur(8px)',
    },
    typeBadge: {
        position: 'absolute' as const, top: 10, right: 10, padding: '3px 8px', borderRadius: 6,
        fontSize: 10, fontWeight: 600, background: 'rgba(0,0,0,0.6)', color: 'rgba(255,255,255,0.7)',
        backdropFilter: 'blur(8px)', textTransform: 'uppercase' as const,
    },
    cardBody: { padding: 16 },
    cardTitle: { fontSize: 15, fontWeight: 700, color: '#fff', margin: '0 0 6px', lineHeight: 1.3 },
    cardDesc: { fontSize: 12, color: 'rgba(255,255,255,0.4)', margin: '0 0 12px', lineHeight: 1.5 },
    cardFooter: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
    cardPrice: { fontSize: 16, fontWeight: 800, color: '#c4b5fd' },
    cardSeller: { fontSize: 11, color: 'rgba(255,255,255,0.35)', marginTop: 2 },
    buyBtn: {
        padding: '8px 18px', borderRadius: 8, border: 'none',
        background: 'linear-gradient(135deg, #22c55e, #16a34a)', color: '#fff',
        fontSize: 13, fontWeight: 700, cursor: 'pointer',
    },
    sbtLabel: { fontSize: 11, color: 'rgba(255,255,255,0.35)' },
    likes: { fontSize: 12, color: 'rgba(255,255,255,0.3)', marginTop: 10 },
};
