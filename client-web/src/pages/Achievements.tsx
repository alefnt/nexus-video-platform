// FILE: /video-platform/client-web/src/pages/Achievements.tsx
/**
 * 成就中心页面
 * 
 * 功能增强...
 * - 成就卡片翻转展示效果
 * - 进度条渐变填充动...
 * - 已解锁成就发光边...
 * - 分类标签页切换动...
 * - Skeleton 加载状...
 * - 响应式优...
 */

import React, { useState, useEffect } from 'react';
import { getApiClient } from '../lib/apiClient';
import { Trophy, Target, Star, Sparkles, Crown, Gem, Award, Lock, CheckCircle } from 'lucide-react';
import { useSound } from '../hooks/useSound';

const client = getApiClient();

interface Achievement {
    id: string;
    name: string;
    description: string;
    icon: string;
    category: 'creator' | 'viewer' | 'collector' | 'community' | 'special';
    tier: 'bronze' | 'silver' | 'gold' | 'platinum' | 'diamond';
    benefits: string[];
    pointsReward: number;
}

interface UserAchievement {
    id: string;
    achievementId: string;
    sporeId?: string;
    txHash?: string;
    unlockedAt: string;
    achievement?: Achievement;
}

interface AchievementProgress {
    achievementId: string;
    name: string;
    icon: string;
    tier: string;
    category: string;
    current: number;
    target: number;
    percent: number;
}

const TIER_CONFIG: Record<string, { color: string; glow: string; icon: React.ReactNode }> = {
    bronze: { color: '#CD7F32', glow: 'rgba(205, 127, 50, 0.4)', icon: <Award size={14} /> },
    silver: { color: '#C0C0C0', glow: 'rgba(192, 192, 192, 0.4)', icon: <Star size={14} /> },
    gold: { color: '#FFD700', glow: 'rgba(255, 215, 0, 0.4)', icon: <Crown size={14} /> },
    platinum: { color: '#E5E4E2', glow: 'rgba(229, 228, 226, 0.5)', icon: <Gem size={14} /> },
    diamond: { color: '#00FFFF', glow: 'rgba(0, 255, 255, 0.4)', icon: <Sparkles size={14} /> },
};

const CATEGORY_CONFIG: Record<string, { name: string; icon: React.ReactNode }> = {
    creator: { name: '创作者', icon: '🎬' },
    viewer: { name: '观众', icon: '👀' },
    collector: { name: '收藏家', icon: '💎' },
    community: { name: '社区', icon: '🤝' },
    special: { name: '特殊', icon: '✨' },
};

export default function Achievements() {
    const [allAchievements, setAllAchievements] = useState<Achievement[]>([]);
    const [userAchievements, setUserAchievements] = useState<UserAchievement[]>([]);
    const [progress, setProgress] = useState<AchievementProgress[]>([]);
    const [stats, setStats] = useState({ total: 0, unlocked: 0, totalPoints: 0 });
    const [loading, setLoading] = useState(true);
    const [activeCategory, setActiveCategory] = useState<string>('all');
    const [hoveredCard, setHoveredCard] = useState<string | null>(null);
    const [mintingSbtId, setMintingSbtId] = useState<string | null>(null);

    const mintSBT = async (achievementId: string) => {
        try {
            setMintingSbtId(achievementId);
            const prepRes = await client.post<{ txHash?: string; sporeId?: string }>('/ownership/mint/prepare', {
                type: 'achievement_sbt', achievementId
            });
            if (prepRes?.txHash) {
                await client.post('/ownership/mint/submit', { txHash: prepRes.txHash });
                // Update local state
                setUserAchievements(prev => prev.map(ua =>
                    ua.achievementId === achievementId ? { ...ua, sporeId: prepRes.sporeId || 'minted', txHash: prepRes.txHash } : ua
                ));
            }
        } catch (e: any) {
            alert(e?.error || e?.message || 'Minting failed');
        } finally {
            setMintingSbtId(null);
        }
    };

    const jwt = typeof window !== 'undefined' ? sessionStorage.getItem('vp.jwt') : null;
    if (jwt) client.setJWT(jwt);

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        setLoading(true);
        try {
            const allRes = await client.get<{ achievements: Achievement[] }>('/achievement/list');
            setAllAchievements(allRes.achievements || []);

            const myRes = await client.get<{
                achievements: UserAchievement[];
                stats: { total: number; unlocked: number; totalPoints: number };
            }>('/achievement/my');
            setUserAchievements(myRes.achievements || []);
            setStats(myRes.stats);

            const progressRes = await client.get<{ progress: AchievementProgress[] }>('/achievement/progress');
            setProgress(progressRes.progress || []);
        } catch (err) {
            console.error('Load achievements failed:', err);
        } finally {
            setLoading(false);
        }
    };

    const unlockedIds = new Set(userAchievements.map(ua => ua.achievementId));
    const filteredAchievements = activeCategory === 'all'
        ? allAchievements
        : allAchievements.filter(a => a.category === activeCategory);

    const categories = ['all', 'creator', 'viewer', 'collector', 'community', 'special'];

    // Skeleton 加载组件
    const AchievementSkeleton = () => (
        <div className="achievements-grid">
            {[1, 2, 3, 4, 5, 6].map(i => (
                <div key={i} className="achievement-card skeleton-card" style={{ animationDelay: `${i * 80}ms` }}>
                    <div className="skeleton" style={{ width: 60, height: 20, position: 'absolute', top: 16, right: 16, borderRadius: 12 }} />
                    <div style={{ display: 'flex', gap: 16, marginBottom: 16 }}>
                        <div className="skeleton skeleton-avatar" style={{ width: 56, height: 56, borderRadius: 14 }} />
                        <div style={{ flex: 1 }}>
                            <div className="skeleton skeleton-text" style={{ width: '70%', height: 18, marginBottom: 8 }} />
                            <div className="skeleton skeleton-text" style={{ width: '100%', height: 14 }} />
                        </div>
                    </div>
                    <div className="skeleton" style={{ width: '100%', height: 32, borderRadius: 8 }} />
                </div>
            ))}
        </div>
    );

    return (
        <div className="min-h-full text-gray-200 achievements-page">

            <div className="achievements-container">
                {/* 页面头部 */}
                <div className="page-header animate-enter">
                    <div className="header-content">
                        <div className="header-icon-wrapper">
                            <Trophy size={40} />
                            <div className="header-glow" />
                        </div>
                        <div>
                            <h1 className="text-gradient">成就中心</h1>
                            <p>收集成就，展示你的荣耀</p>
                        </div>
                    </div>
                    <div className="stats-summary">
                        <div className="stat-item">
                            <div className="stat-value animate-count-up">{stats.unlocked}</div>
                            <div className="stat-divider">/</div>
                            <div className="stat-total">{stats.total}</div>
                            <div className="stat-label">已解锁</div>
                        </div>
                        <div className="stat-item points">
                            <Sparkles size={16} />
                            <div className="stat-value animate-count-up">{stats.totalPoints.toLocaleString()}</div>
                            <div className="stat-label">积分奖励</div>
                        </div>
                    </div>
                </div>

                {loading ? (
                    <>
                        <div className="category-tabs">
                            {categories.map((_, i) => (
                                <div key={i} className="skeleton" style={{ width: 80, height: 40, borderRadius: 20 }} />
                            ))}
                        </div>
                        <AchievementSkeleton />
                    </>
                ) : (
                    <>
                        {/* 进度区域 */}
                        {progress.length > 0 && (
                            <div className="progress-section animate-enter delay-100">
                                <h2>
                                    <Target size={20} />
                                    即将解锁
                                </h2>
                                <div className="progress-grid">
                                    {progress.slice(0, 4).map((p, index) => (
                                        <div
                                            key={p.achievementId}
                                            className="glass-card progress-card card-interactive"
                                            style={{ animationDelay: `${index * 100}ms` }}
                                        >
                                            <div className="progress-header">
                                                <div className="progress-icon">{p.icon}</div>
                                                <div className="progress-info">
                                                    <h4>{p.name}</h4>
                                                    <span>{CATEGORY_CONFIG[p.category]?.name} · {p.tier}</span>
                                                </div>
                                            </div>
                                            <div className="progress-bar">
                                                <div
                                                    className="progress-bar-fill animated"
                                                    style={{ width: `${p.percent}%` }}
                                                />
                                            </div>
                                            <div className="progress-text">
                                                <span>{p.current} / {p.target}</span>
                                                <span className="progress-percent">{p.percent}%</span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* 分类标签 */}
                        <div className="category-tabs animate-enter delay-200">
                            {categories.map(cat => (
                                <button
                                    key={cat}
                                    className={`category-tab ${activeCategory === cat ? 'active' : ''}`}
                                    onClick={() => setActiveCategory(cat)}
                                >
                                    {cat !== 'all' && (
                                        <span className="cat-icon">{CATEGORY_CONFIG[cat]?.icon}</span>
                                    )}
                                    <span>{cat === 'all' ? '全部' : CATEGORY_CONFIG[cat]?.name}</span>
                                    {cat === 'all' && (
                                        <span className="cat-count">{allAchievements.length}</span>
                                    )}
                                </button>
                            ))}
                        </div>

                        {/* 成就网格 */}
                        <div className="achievements-grid">
                            {filteredAchievements.map((achievement, index) => {
                                const isUnlocked = unlockedIds.has(achievement.id);
                                const tierConfig = TIER_CONFIG[achievement.tier];
                                const isHovered = hoveredCard === achievement.id;

                                return (
                                    <div
                                        key={achievement.id}
                                        className={`glass-card achievement-card ${isUnlocked ? 'unlocked' : 'locked'} ${isHovered ? 'hovered' : ''}`}
                                        style={{
                                            '--tier-color': tierConfig.color,
                                            '--tier-glow': tierConfig.glow,
                                            animationDelay: `${index * 60}ms`
                                        } as React.CSSProperties}
                                        onMouseEnter={() => setHoveredCard(achievement.id)}
                                        onMouseLeave={() => setHoveredCard(null)}
                                    >
                                        {/* 等级徽章 */}
                                        <div className="tier-badge">
                                            {tierConfig.icon}
                                            <span>{achievement.tier}</span>
                                        </div>

                                        {/* 解锁状态覆盖层 */}
                                        {!isUnlocked && (
                                            <div className="locked-overlay">
                                                <Lock size={24} />
                                            </div>
                                        )}

                                        <div className="achievement-header">
                                            <div className={`achievement-icon ${isUnlocked ? 'glow' : ''}`}>
                                                <span>{achievement.icon}</span>
                                            </div>
                                            <div className="achievement-title">
                                                <h3>{achievement.name}</h3>
                                                <p>{achievement.description}</p>
                                            </div>
                                        </div>

                                        <div className="achievement-benefits">
                                            {achievement.benefits.slice(0, 3).map((benefit, i) => (
                                                <span key={i} className="benefit-tag">{benefit}</span>
                                            ))}
                                        </div>

                                        <div className="achievement-footer">
                                            <div className="points-reward">
                                                <Sparkles size={14} />
                                                +{achievement.pointsReward} 积分
                                            </div>
                                            {isUnlocked && (
                                                <div className="unlocked-badge">
                                                    <CheckCircle size={16} />
                                                    <span>已解锁</span>
                                                </div>
                                            )}
                                            {isUnlocked && (() => {
                                                const ua = userAchievements.find(u => u.achievementId === achievement.id);
                                                if (ua?.sporeId) return (
                                                    <a href={`https://explorer.nervos.org/transaction/${ua.txHash}`} target="_blank" rel="noreferrer"
                                                        className="benefit-tag" style={{ textDecoration: 'none', cursor: 'pointer', fontSize: 10 }}>
                                                        🔗 SBT Minted
                                                    </a>
                                                );
                                                return (
                                                    <button onClick={() => mintSBT(achievement.id)}
                                                        disabled={mintingSbtId === achievement.id}
                                                        style={{ background: 'linear-gradient(135deg, #a855f7, #22d3ee)', border: 'none', color: '#000', padding: '4px 12px', borderRadius: 8, fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>
                                                        {mintingSbtId === achievement.id ? '⏳...' : '🪙 Mint SBT'}
                                                    </button>
                                                );
                                            })()}
                                        </div>

                                        {/* 发光效果 */}
                                        {isUnlocked && <div className="achievement-glow" />}
                                    </div>
                                );
                            })}
                        </div>
                    </>
                )}
            </div>

            <style>{`
                .achievements-page {
                    min-height: 100vh;
                    padding: 20px;
                    padding-bottom: 100px;
                }

                .achievements-container {
                    max-width: 1200px;
                    margin: 0 auto;
                }

                /* 页面头部 */
                .page-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 32px;
                    flex-wrap: wrap;
                    gap: 24px;
                }

                .header-content {
                    display: flex;
                    align-items: center;
                    gap: 20px;
                }

                .header-icon-wrapper {
                    position: relative;
                    color: var(--accent-cyan);
                }

                .header-glow {
                    position: absolute;
                    inset: -20px;
                    background: radial-gradient(circle, rgba(0, 245, 212, 0.3) 0%, transparent 70%);
                    filter: blur(15px);
                    animation: pulse-glow 3s ease-in-out infinite;
                }

                .page-header h1 {
                    font-size: 32px;
                    font-weight: 800;
                    margin: 0 0 4px;
                }

                .page-header p {
                    color: var(--text-muted);
                    margin: 0;
                }

                .stats-summary {
                    display: flex;
                    gap: 16px;
                }

                .stat-item {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    padding: 12px 20px;
                    background: rgba(255, 255, 255, 0.05);
                    border: 1px solid var(--border-subtle);
                    border-radius: var(--radius-md);
                }

                .stat-item.points {
                    color: #FFD93D;
                }

                .stat-value {
                    font-size: 28px;
                    font-weight: 800;
                    color: var(--accent-cyan);
                }

                .stat-item.points .stat-value {
                    color: #FFD93D;
                }

                .stat-divider {
                    font-size: 24px;
                    color: var(--text-muted);
                }

                .stat-total {
                    font-size: 20px;
                    color: var(--text-muted);
                }

                .stat-label {
                    font-size: 12px;
                    color: var(--text-muted);
                    margin-left: 8px;
                }

                /* 进度区域 */
                .progress-section {
                    margin-bottom: 32px;
                }

                .progress-section h2 {
                    display: flex;
                    align-items: center;
                    gap: 10px;
                    font-size: 20px;
                    margin-bottom: 16px;
                }

                .progress-section h2 svg {
                    color: var(--accent-purple);
                }

                .progress-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
                    gap: 16px;
                }

                .progress-card {
                    padding: 20px;
                    animation: fadeInUp 0.5s ease-out forwards;
                    opacity: 0;
                }

                .progress-header {
                    display: flex;
                    align-items: center;
                    gap: 12px;
                    margin-bottom: 16px;
                }

                .progress-icon {
                    width: 44px;
                    height: 44px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    background: rgba(162, 103, 255, 0.15);
                    border-radius: 12px;
                    font-size: 22px;
                }

                .progress-info h4 {
                    margin: 0;
                    font-size: 15px;
                    font-weight: 600;
                }

                .progress-info span {
                    font-size: 12px;
                    color: var(--text-muted);
                }

                .progress-text {
                    display: flex;
                    justify-content: space-between;
                    font-size: 12px;
                    color: var(--text-muted);
                    margin-top: 8px;
                }

                .progress-percent {
                    color: var(--accent-cyan);
                    font-weight: 600;
                }

                /* 分类标签 */
                .category-tabs {
                    display: flex;
                    gap: 10px;
                    margin-bottom: 24px;
                    flex-wrap: wrap;
                }

                .category-tab {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    padding: 10px 18px;
                    background: rgba(255, 255, 255, 0.05);
                    border: 1px solid var(--border-subtle);
                    border-radius: var(--radius-full);
                    color: var(--text-muted);
                    font-size: 14px;
                    font-weight: 500;
                    cursor: pointer;
                    transition: all 0.3s;
                }

                .category-tab:hover {
                    background: rgba(255, 255, 255, 0.08);
                    border-color: rgba(255, 255, 255, 0.15);
                }

                .category-tab.active {
                    background: linear-gradient(135deg, rgba(162, 103, 255, 0.2), rgba(0, 245, 212, 0.2));
                    border-color: var(--accent-cyan);
                    color: var(--accent-cyan);
                }

                .cat-icon {
                    font-size: 16px;
                }

                .cat-count {
                    background: rgba(0, 245, 212, 0.2);
                    padding: 2px 8px;
                    border-radius: 10px;
                    font-size: 12px;
                }

                /* 成就网格 */
                .achievements-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
                    gap: 20px;
                }

                .achievement-card {
                    padding: 24px;
                    position: relative;
                    overflow: hidden;
                    animation: fadeInUp 0.5s ease-out forwards;
                    opacity: 0;
                    transition: all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1);
                }

                .achievement-card.unlocked {
                    border-color: var(--tier-color);
                }

                .achievement-card.unlocked.hovered {
                    box-shadow: 0 0 40px var(--tier-glow);
                    transform: translateY(-4px);
                }

                .achievement-card.locked {
                    opacity: 0.65;
                }

                .locked-overlay {
                    position: absolute;
                    top: 50%;
                    right: 24px;
                    transform: translateY(-50%);
                    color: var(--text-muted);
                    opacity: 0.3;
                }

                .tier-badge {
                    position: absolute;
                    top: 16px;
                    right: 16px;
                    display: flex;
                    align-items: center;
                    gap: 4px;
                    padding: 6px 12px;
                    border-radius: var(--radius-full);
                    font-size: 11px;
                    font-weight: 700;
                    text-transform: uppercase;
                    letter-spacing: 0.5px;
                    background: var(--tier-color);
                    color: #000;
                }

                .achievement-header {
                    display: flex;
                    gap: 16px;
                    margin-bottom: 16px;
                    padding-right: 80px;
                }

                .achievement-icon {
                    width: 56px;
                    height: 56px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    background: rgba(255, 255, 255, 0.08);
                    border-radius: 14px;
                    font-size: 28px;
                    transition: all 0.3s;
                    flex-shrink: 0;
                }

                .achievement-icon.glow {
                    background: rgba(var(--tier-color), 0.1);
                    box-shadow: 0 0 20px var(--tier-glow);
                }

                .locked .achievement-icon {
                    filter: grayscale(80%);
                }

                .achievement-title h3 {
                    margin: 0 0 6px;
                    font-size: 17px;
                    font-weight: 700;
                }

                .achievement-title p {
                    margin: 0;
                    font-size: 13px;
                    color: var(--text-muted);
                    line-height: 1.5;
                }

                .achievement-benefits {
                    display: flex;
                    flex-wrap: wrap;
                    gap: 8px;
                    margin-bottom: 16px;
                }

                .benefit-tag {
                    padding: 5px 12px;
                    background: rgba(162, 103, 255, 0.1);
                    border: 1px solid rgba(162, 103, 255, 0.2);
                    border-radius: var(--radius-sm);
                    font-size: 12px;
                    color: var(--accent-purple);
                }

                .achievement-footer {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    padding-top: 16px;
                    border-top: 1px solid var(--border-subtle);
                }

                .points-reward {
                    display: flex;
                    align-items: center;
                    gap: 6px;
                    color: #FFD93D;
                    font-weight: 700;
                    font-size: 14px;
                }

                .unlocked-badge {
                    display: flex;
                    align-items: center;
                    gap: 6px;
                    color: var(--status-success);
                    font-size: 13px;
                    font-weight: 600;
                }

                .achievement-glow {
                    position: absolute;
                    inset: 0;
                    border-radius: inherit;
                    pointer-events: none;
                    box-shadow: inset 0 0 30px var(--tier-glow);
                    opacity: 0.3;
                }

                /* Skeleton */
                .skeleton-card {
                    padding: 24px;
                    position: relative;
                    background: rgba(255, 255, 255, 0.03) !important;
                    animation: fadeInUp 0.5s ease-out forwards;
                    opacity: 0;
                }

                /* 移动端适配 */
                @media (max-width: 768px) {
                    .page-header {
                        flex-direction: column;
                        align-items: flex-start;
                    }

                    .header-content {
                        flex-direction: column;
                        text-align: center;
                        width: 100%;
                    }

                    .stats-summary {
                        width: 100%;
                        justify-content: center;
                    }

                    .stat-item {
                        flex: 1;
                        justify-content: center;
                        flex-wrap: wrap;
                    }

                    .achievements-grid {
                        grid-template-columns: 1fr;
                    }

                    .category-tabs {
                        overflow-x: auto;
                        flex-wrap: nowrap;
                        padding-bottom: 8px;
                        -webkit-overflow-scrolling: touch;
                    }

                    .category-tab {
                        flex-shrink: 0;
                    }
                }
            `}</style>
        </div>
    );
}
