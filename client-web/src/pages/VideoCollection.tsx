// FILE: /video-platform/client-web/src/pages/VideoCollection.tsx
/**
 * 视频 NFT 收藏页面
 * 
 * 功能...
 * - 展示视频收藏版信...
 * - 购买/铸造收...NFT
 * - 显示持有者列...
 * - 收藏者权益展...
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getApiClient } from '../lib/apiClient';
import { Film, Sparkles, Gift, Users, Check } from 'lucide-react';

const client = getApiClient();

interface Collection {
    collectionId: string;
    videoId: string;
    videoTitle: string;
    creatorAddress: string;
    clusterId: string;
    maxEditions: number;
    mintedCount: number;
    price: number;
    royaltyPercent: number;
    benefits: string[];
    previewUrl?: string;
    createdAt: string;
}

interface Holder {
    sporeId: string;
    ownerAddress: string;
    editionNumber: number;
    purchasePrice: number;
    mintedAt: string;
}

export default function VideoCollection() {
    const { videoId } = useParams<{ videoId: string }>();
    const navigate = useNavigate();

    const [collection, setCollection] = useState<Collection | null>(null);
    const [holders, setHolders] = useState<Holder[]>([]);
    const [available, setAvailable] = useState(0);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [purchasing, setPurchasing] = useState(false);
    const [userHolding, setUserHolding] = useState<{
        hasCollection: boolean;
        edition?: string;
        sporeId?: string;
        benefits?: string[];
    } | null>(null);

    // 获取JWT
    const jwt = typeof window !== 'undefined' ? sessionStorage.getItem('vp.jwt') : null;
    if (jwt) client.setJWT(jwt);

    useEffect(() => {
        if (videoId) {
            loadCollection();
            checkUserHolding();
        }
    }, [videoId]);

    const loadCollection = async () => {
        if (!videoId) return;
        setLoading(true);
        setError(null);

        try {
            const res = await client.get<{
                collection: Collection;
                holders: Holder[];
                available: number;
            }>(`/nft/collection/video/${videoId}`);

            setCollection(res.collection);
            setHolders(res.holders || []);
            setAvailable(res.available);
        } catch (err: any) {
            if (err?.code === 'not_found') {
                setError('该视频暂无收藏版');
            } else {
                setError(err?.error || err?.message || '加载失败');
            }
        } finally {
            setLoading(false);
        }
    };

    const checkUserHolding = async () => {
        if (!videoId) return;
        try {
            const res = await client.get<{
                hasCollection: boolean;
                edition?: string;
                sporeId?: string;
                benefits?: string[];
            }>(`/nft/collection/check/${videoId}`);
            setUserHolding(res);
        } catch (err) {
            console.error('Check holding failed:', err);
        }
    };

    const handlePurchase = async () => {
        if (!collection) return;

        setPurchasing(true);
        try {
            const res = await client.post<{
                ok: boolean;
                sporeId: string;
                edition: string;
                benefits: string[];
            }>('/nft/collection/mint', {
                collectionId: collection.collectionId,
            });

            if (res.ok) {
                // 刷新数据
                await loadCollection();
                await checkUserHolding();
                alert(`🎉 恭喜获得 ${res.edition}！`);
            }
        } catch (err: any) {
            alert(err?.error || err?.message || '购买失败');
        } finally {
            setPurchasing(false);
        }
    };

    if (loading) {
        return (
            <div className="min-h-full text-gray-200">
                <div className="loading-container">
                    <div className="spinner"></div>
                    <p>加载.....</p>
                </div>
            </div>
        );
    }

    if (error || !collection) {
        return (
            <div className="min-h-full text-gray-200">
                <div className="empty-container">
                    <h2><Film size={20} style={{ marginRight: 8, verticalAlign: 'middle' }} />{error || '暂无收藏'}</h2>
                    <button className="btn-neon" onClick={() => navigate(-1)}>
                        返回
                    </button>
                </div>
            </div>
        );
    }

    const soldPercent = Math.round((collection.mintedCount / collection.maxEditions) * 100);

    return (
        <div className="min-h-full text-gray-200 collection-page">

            <style>{`
                .collection-page {
                    min-height: 100vh;
                }

                .collection-container {
                    max-width: 1000px;
                    margin: 0 auto;
                    padding: 24px;
                    display: grid;
                    grid-template-columns: 1fr 360px;
                    gap: 24px;
                }

                @media (max-width: 900px) {
                    .collection-container {
                        grid-template-columns: 1fr;
                    }
                }

                .collection-main {
                    display: flex;
                    flex-direction: column;
                    gap: 20px;
                }

                .preview-card {
                    aspect-ratio: 16/9;
                    background: linear-gradient(135deg, #1a1a2e, #16213e);
                    border-radius: 16px;
                    overflow: hidden;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    position: relative;
                }

                .preview-card img {
                    width: 100%;
                    height: 100%;
                    object-fit: cover;
                }

                .edition-badge {
                    position: absolute;
                    top: 16px;
                    right: 16px;
                    padding: 8px 16px;
                    background: linear-gradient(135deg, #FFD700, #FFA500);
                    border-radius: 20px;
                    color: #000;
                    font-weight: 700;
                    font-size: 13px;
                }

                .collection-info h1 {
                    margin: 0 0 12px;
                    font-size: 24px;
                }

                .creator-info {
                    display: flex;
                    align-items: center;
                    gap: 12px;
                    margin-bottom: 16px;
                    font-size: 14px;
                    color: var(--text-muted);
                }

                .royalty-tag {
                    padding: 4px 10px;
                    background: rgba(0, 255, 255, 0.1);
                    border: 1px solid rgba(0, 255, 255, 0.3);
                    border-radius: 12px;
                    font-size: 12px;
                    color: #00ffff;
                }

                .benefits-section {
                    padding: 20px;
                    background: rgba(255, 255, 255, 0.05);
                    border-radius: 12px;
                }

                .benefits-section h3 {
                    margin: 0 0 16px;
                    font-size: 16px;
                }

                .benefits-list {
                    list-style: none;
                    padding: 0;
                    margin: 0;
                }

                .benefits-list li {
                    display: flex;
                    align-items: center;
                    gap: 10px;
                    padding: 10px 0;
                    border-bottom: 1px solid rgba(255,255,255,0.1);
                    font-size: 14px;
                }

                .benefits-list li:last-child {
                    border-bottom: none;
                }

                .benefit-icon {
                    width: 28px;
                    height: 28px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    background: linear-gradient(135deg, rgba(0,255,255,0.2), rgba(0,128,255,0.2));
                    border-radius: 8px;
                    font-size: 14px;
                }

                .collection-sidebar {
                    display: flex;
                    flex-direction: column;
                    gap: 16px;
                }

                .purchase-card {
                    padding: 24px;
                    background: rgba(255,255,255,0.05);
                    border-radius: 16px;
                    border: 1px solid rgba(255,255,255,0.1);
                }

                .price-display {
                    text-align: center;
                    margin-bottom: 20px;
                }

                .price-value {
                    font-size: 32px;
                    font-weight: 700;
                    color: #FFD700;
                }

                .price-unit {
                    font-size: 14px;
                    color: var(--text-muted);
                    margin-left: 8px;
                }

                .progress-section {
                    margin-bottom: 20px;
                }

                .progress-header {
                    display: flex;
                    justify-content: space-between;
                    margin-bottom: 8px;
                    font-size: 13px;
                }

                .progress-bar {
                    height: 8px;
                    background: rgba(255,255,255,0.1);
                    border-radius: 4px;
                    overflow: hidden;
                }

                .progress-fill {
                    height: 100%;
                    background: linear-gradient(90deg, #00ffff, #0080ff);
                    transition: width 0.3s ease;
                }

                .purchase-btn {
                    width: 100%;
                    padding: 16px;
                    border: none;
                    border-radius: 12px;
                    font-size: 16px;
                    font-weight: 700;
                    cursor: pointer;
                    transition: all 0.3s ease;
                }

                .purchase-btn.available {
                    background: linear-gradient(135deg, #00ffff, #0080ff);
                    color: #000;
                }

                .purchase-btn.available:hover:not(:disabled) {
                    transform: scale(1.02);
                    box-shadow: 0 8px 25px rgba(0,255,255,0.3);
                }

                .purchase-btn.owned {
                    background: linear-gradient(135deg, #FFD700, #FFA500);
                    color: #000;
                }

                .purchase-btn.soldout {
                    background: rgba(255,255,255,0.1);
                    color: var(--text-muted);
                    cursor: not-allowed;
                }

                .purchase-btn:disabled {
                    opacity: 0.7;
                }

                .user-holding {
                    margin-top: 16px;
                    padding: 12px;
                    background: rgba(255,215,0,0.1);
                    border: 1px solid rgba(255,215,0,0.3);
                    border-radius: 10px;
                    text-align: center;
                    font-size: 14px;
                }

                .holders-section {
                    padding: 16px;
                    background: rgba(255,255,255,0.05);
                    border-radius: 12px;
                }

                .holders-section h3 {
                    margin: 0 0 12px;
                    font-size: 14px;
                }

                .holder-item {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    padding: 8px 0;
                    font-size: 13px;
                    border-bottom: 1px solid rgba(255,255,255,0.05);
                }

                .holder-item:last-child {
                    border-bottom: none;
                }

                .holder-address {
                    color: var(--text-muted);
                }

                .holder-edition {
                    color: #00ffff;
                    font-weight: 600;
                }

                .loading-container,
                .empty-container {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    height: 60vh;
                    gap: 20px;
                }

                .spinner {
                    width: 40px;
                    height: 40px;
                    border: 3px solid rgba(255,255,255,0.3);
                    border-top-color: #fff;
                    border-radius: 50%;
                    animation: spin 1s linear infinite;
                }

                @keyframes spin {
                    to { transform: rotate(360deg); }
                }
            `}</style>

            <div className="collection-container">
                {/* 左侧主区...*/}
                <div className="collection-main">
                    {/* 预览 */}
                    <div className="preview-card">
                        {collection.previewUrl ? (
                            <img src={collection.previewUrl} alt={collection.videoTitle} />
                        ) : (
                            <Film size={64} color="var(--accent-purple)" />
                        )}
                        <div className="edition-badge">
                            限量 {collection.maxEditions}
                        </div>
                    </div>

                    {/* 信息 */}
                    <div className="collection-info">
                        <h1>{collection.videoTitle}</h1>
                        <div className="creator-info">
                            <span>创作者: {collection.creatorAddress.slice(0, 12)}...</span>
                            <span className="royalty-tag">
                                版税 {collection.royaltyPercent}%
                            </span>
                        </div>
                    </div>

                    {/* 权益 */}
                    <div className="benefits-section">
                        <h3><Gift size={18} style={{ marginRight: 8, verticalAlign: 'middle' }} /> 收藏者权益</h3>
                        <ul className="benefits-list">
                            {collection.benefits.map((benefit, index) => (
                                <li key={index}>
                                    <span className="benefit-icon"><Check size={14} /></span>
                                    {benefit}
                                </li>
                            ))}
                        </ul>
                    </div>
                </div>

                {/* 右侧边栏 */}
                <div className="collection-sidebar">
                    {/* 购买卡片 */}
                    <div className="purchase-card">
                        <div className="price-display">
                            <span className="price-value">{collection.price}</span>
                            <span className="price-unit">积分</span>
                        </div>

                        <div className="progress-section">
                            <div className="progress-header">
                                <span>已售 {collection.mintedCount}/{collection.maxEditions}</span>
                                <span>{soldPercent}%</span>
                            </div>
                            <div className="progress-bar">
                                <div
                                    className="progress-fill"
                                    style={{ width: `${soldPercent}%` }}
                                />
                            </div>
                        </div>

                        {userHolding?.hasCollection ? (
                            <>
                                <button className="purchase-btn owned">
                                    <Sparkles size={16} style={{ marginRight: 6, verticalAlign: 'middle' }} /> 已拥有 {userHolding.edition}
                                </button>
                                <div className="user-holding">
                                    你是该收藏版的持有者，享有所有权益！
                                </div>
                            </>
                        ) : available > 0 ? (
                            <button
                                className="purchase-btn available"
                                onClick={handlePurchase}
                                disabled={purchasing}
                            >
                                {purchasing ? '购买中...' : `立即收藏 (剩余 ${available})`}
                            </button>
                        ) : (
                            <button className="purchase-btn soldout" disabled>
                                已售馨
                            </button>
                        )}
                    </div>

                    {/* 持有...*/}
                    <div className="holders-section">
                        <h3><Users size={16} style={{ marginRight: 8, verticalAlign: 'middle' }} /> 收藏者 ({holders.length})</h3>
                        {holders.length === 0 ? (
                            <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>
                                暂无收藏者，成为第一个吧...
                            </p>
                        ) : (
                            holders.slice(0, 10).map((holder, index) => (
                                <div key={index} className="holder-item">
                                    <span className="holder-address">
                                        {holder.ownerAddress.slice(0, 8)}...
                                    </span>
                                    <span className="holder-edition">
                                        #{holder.editionNumber}
                                    </span>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
