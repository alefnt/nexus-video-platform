/**
 * 💎 碎片收集页面
 * Fragment Gallery - 展示收集的碎片和 NFT 合成入口
 * ...engagement 服务.../drops/history API 获取真实 NFT 掉落数据
 */

import React, { useState, useEffect, useMemo } from 'react';
import { FragmentCard, Fragment, FragmentRarity } from '../components/FragmentCard';
import { Gem, Sparkles, Package, ChevronRight, Info, Gift, Zap } from 'lucide-react';
import { useSound } from '../hooks/useSound';
import { motion, AnimatePresence } from 'framer-motion';
import { getApiClient } from '../lib/apiClient';
import { useAuthStore } from '../stores';
import { useTranslation } from 'react-i18next';

const api = getApiClient();

// Rarity icon mapping for NFT drops
const RARITY_ICONS: Record<string, string> = {
  common: '⚪', rare: '💜', epic: '💎', legendary: '🔥',
};

// NFT 合成配方 (game design constants - kept as config)
interface NFTRecipe {
  id: string;
  name: string;
  description: string;
  fragments: { rarity: string; count: number }[];
  reward: string;
  rarity: FragmentRarity;
}

const NFT_RECIPES: NFTRecipe[] = [
  {
    id: 'nft1',
    name: '星空守望者',
    description: '收集普通碎片合成',
    fragments: [{ rarity: 'common', count: 10 }],
    reward: 'NFT 徽章 + 500 积分',
    rarity: 'rare'
  },
  {
    id: 'nft2',
    name: '霓虹行者',
    description: '收集稀有碎片合成',
    fragments: [{ rarity: 'rare', count: 5 }],
    reward: 'NFT 头像 + 1000 积分',
    rarity: 'epic'
  },
  {
    id: 'nft3',
    name: '虚空领主',
    description: '收集史诗碎片合成',
    fragments: [
      { rarity: 'epic', count: 3 },
      { rarity: 'legendary', count: 1 },
    ],
    reward: '限定 NFT + VIP 特权',
    rarity: 'legendary'
  },
];

export default function FragmentGallery() {
  const [fragments, setFragments] = useState<Fragment[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'all' | FragmentRarity>('all');
  const [selectedFragment, setSelectedFragment] = useState<Fragment | null>(null);
  const { play: playSound } = useSound();
  const user = useAuthStore((s) => s.user);
  const { t } = useTranslation();

  // Synthesis State
  const [isSynthesizing, setIsSynthesizing] = useState(false);
  const [synthRecipe, setSynthRecipe] = useState<NFTRecipe | null>(null);

  // Fetch real NFT drops from engagement service
  useEffect(() => {
    if (!user?.id) {
      setLoading(false);
      setFragments([]);
      return;
    }
    setLoading(true);
    const jwt = sessionStorage.getItem('vp.jwt');
    if (jwt) api.setJWT(jwt);

    api.get<{ drops?: any[] }>(`/drops/history?userId=${user.id}&limit=100`)
      .then((res) => {
        const drops = res?.drops || (Array.isArray(res) ? res : []);
        // Map drops to Fragment format, aggregate by rarity
        const rarityMap: Record<string, Fragment> = {};
        drops.forEach((drop: any) => {
          const rarity = (drop.rarity || 'common').toLowerCase() as FragmentRarity;
          const key = rarity;
          if (!rarityMap[key]) {
            rarityMap[key] = {
              id: key,
              name: drop.nftName || `${rarity} Fragment`,
              description: drop.description || `${rarity} rarity NFT fragment`,
              rarity,
              icon: RARITY_ICONS[rarity] || '⚪',
              collected: drop.claimed || false,
              count: 0,
              maxCount: rarity === 'legendary' ? 1 : rarity === 'epic' ? 3 : rarity === 'rare' ? 5 : 10,
            };
          }
          if (drop.claimed) {
            rarityMap[key].collected = true;
            rarityMap[key].count += 1;
          }
        });
        const mapped = Object.values(rarityMap);
        setFragments(mapped.length > 0 ? mapped : []);
      })
      .catch((err) => {
        console.warn('[FragmentGallery] Failed to fetch drops:', err);
        setFragments([]);
      })
      .finally(() => setLoading(false));
  }, [user?.id]);

  // 按稀有度分组
  const groupedFragments = useMemo(() => {
    const groups: Record<FragmentRarity, Fragment[]> = {
      common: [],
      rare: [],
      epic: [],
      legendary: []
    };
    fragments.forEach(f => {
      groups[f.rarity].push(f);
    });
    return groups;
  }, [fragments]);

  // 统计
  const stats = useMemo(() => {
    const collected = fragments.filter(f => f.collected).length;
    const total = fragments.length;
    const totalCount = fragments.reduce((sum, f) => sum + f.count, 0);
    return { collected, total, totalCount };
  }, [fragments]);

  // 过滤显示
  const displayFragments = activeTab === 'all'
    ? fragments
    : groupedFragments[activeTab];

  const handleFragmentClick = (fragment: Fragment) => {
    playSound('click');
    setSelectedFragment(fragment);
  };

  const RARITY_TABS: { key: 'all' | FragmentRarity; label: string; color?: string }[] = [
    { key: 'all', label: '全部' },
    { key: 'common', label: '普通', color: '#A0A0A0' },
    { key: 'rare', label: '稀有', color: '#4D61FC' },
    { key: 'epic', label: '史诗', color: '#A267FF' },
    { key: 'legendary', label: '传说', color: '#FFD700' },
  ];

  // [NEW] Synthesis Animation Overlay
  const SynthesisOverlay = () => (
    <motion.div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-md"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={() => setIsSynthesizing(false)}
    >
      {/* Ambient Glow */}
      <motion.div
        className="absolute inset-0 bg-gradient-to-r from-nexusPurple/20 to-cyan-500/20"
        animate={{ opacity: [0.2, 0.5, 0.2] }}
        transition={{ duration: 2, repeat: Infinity }}
      />

      <div className="relative flex flex-col items-center">
        {/* Converging Fragments */}
        {[...Array(8)].map((_, i) => (
          <motion.div
            key={i}
            className="absolute w-4 h-4 rounded-full bg-nexusCyan shadow-[0_0_15px_cyan]"
            initial={{
              x: Math.cos(i * 45 * Math.PI / 180) * 400,
              y: Math.sin(i * 45 * Math.PI / 180) * 400,
              opacity: 0,
              scale: 0.5
            }}
            animate={{
              x: 0,
              y: 0,
              opacity: [0, 1, 0],
              scale: [0.5, 1.5, 0]
            }}
            transition={{ duration: 1.5, ease: "easeIn" }}
          />
        ))}

        {/* Explosion Flash */}
        <motion.div
          className="absolute w-[800px] h-[800px] bg-white rounded-full blur-3xl"
          initial={{ opacity: 0, scale: 0 }}
          animate={{ opacity: [0, 1, 0], scale: [0, 2, 3] }}
          transition={{ delay: 1.4, duration: 0.8 }}
        />

        {/* Result Card */}
        <motion.div
          initial={{ scale: 0, rotateY: 180 }}
          animate={{ scale: 1, rotateY: 0 }}
          transition={{ delay: 1.6, type: "spring", stiffness: 200 }}
          className="relative z-10 p-1 bg-gradient-to-br from-yellow-400 to-purple-600 rounded-xl"
        >
          <div className="bg-gray-900 rounded-xl p-8 flex flex-col items-center gap-4 min-w-[300px] border border-white/10">
            <div className="text-6xl animate-bounce">
              🏆
            </div>
            <h2 className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 to-purple-400">
              SYNTHESIS COMPLETE
            </h2>
            <div className="text-center text-gray-400">
              <p className="text-lg text-white font-semibold">{synthRecipe?.reward}</p>
              <p className="text-sm mt-2">Added to your inventory</p>
            </div>
            <button
              className="btn-neon mt-4 w-full"
              onClick={(e) => {
                e.stopPropagation();
                setIsSynthesizing(false);
              }}
            >
              Collect
            </button>
          </div>
        </motion.div>
      </div>
    </motion.div>
  );

  return (
    <div className="min-h-full text-gray-200 pb-24 fragment-page">

      <AnimatePresence>
        {isSynthesizing && <SynthesisOverlay />}
      </AnimatePresence>

      <div className="fragment-container">
        {/* 头部统计 */}
        <div className="fragment-header">
          <div className="header-title">
            <Gem className="title-icon" />
            <h1>碎片收藏室</h1>
          </div>
          <p className="header-desc">收集碎片，合成专属NFT</p>

          <div className="stats-row">
            <div className="stat-item">
              <Package size={20} />
              <div className="stat-info">
                <span className="stat-value">{stats.collected}/{stats.total}</span>
                <span className="stat-label">已收集</span>
              </div>
            </div>
            <div className="stat-item">
              <Sparkles size={20} />
              <div className="stat-info">
                <span className="stat-value">{stats.totalCount}</span>
                <span className="stat-label">碎片总数</span>
              </div>
            </div>
          </div>
        </div>

        {/* 获取方式提示 */}
        <div className="source-tips glass-card">
          <Info size={16} />
          <div className="tips-content">
            <span className="tips-title">碎片获取方式</span>
            <ul>
              <li>📺 观看视频每 5 分钟获得 1 个普通碎片</li>
              <li>...每日签到获得随机碎片</li>
              <li>🎯 完成任务获得稀有碎片</li>
              <li>🎰 转盘抽奖可能获得史诗/传说碎片</li>
            </ul>
          </div>
        </div>

        {/* 稀有度标签 */}
        <div className="rarity-tabs">
          {RARITY_TABS.map(tab => (
            <button
              key={tab.key}
              className={`rarity-tab ${activeTab === tab.key ? 'active' : ''}`}
              onClick={() => {
                playSound('click');
                setActiveTab(tab.key);
              }}
              style={{ '--tab-color': tab.color || 'var(--accent-cyan)' } as React.CSSProperties}
            >
              {tab.label}
              <span className="tab-count">
                {tab.key === 'all' ? fragments.length : groupedFragments[tab.key].length}
              </span>
            </button>
          ))}
        </div>

        {/* 碎片网格 */}
        {loading ? (
          <div className="fragments-loading">
            {[1, 2, 3, 4, 5, 6].map(i => (
              <div key={i} className="skeleton-card" style={{ width: 120, height: 150 }} />
            ))}
          </div>
        ) : (
          <div className="fragments-grid">
            {displayFragments.map(fragment => (
              <FragmentCard
                key={fragment.id}
                fragment={fragment}
                onClick={handleFragmentClick}
              />
            ))}
          </div>
        )}

        {/* NFT 合成入口 */}
        <div className="synthesis-section">
          <div className="section-header">
            <h2>
              <Zap size={20} />
              NFT 合成
            </h2>
            <button className="view-all-btn">
              查看全部 <ChevronRight size={14} />
            </button>
          </div>

          <div className="recipes-list">
            {NFT_RECIPES.map(recipe => {
              const canSynthesize = recipe.fragments.every(rf => {
                const f = fragments.find(f => f.rarity === rf.rarity);
                return f && f.count >= rf.count;
              });

              return (
                <div
                  key={recipe.id}
                  className={`recipe-card ${recipe.rarity} ${canSynthesize ? 'available' : ''}`}
                >
                  <div className="recipe-icon">
                    <Gift size={24} />
                  </div>
                  <div className="recipe-info">
                    <span className="recipe-name">{recipe.name}</span>
                    <span className="recipe-desc">{recipe.description}</span>
                    <span className="recipe-reward">{recipe.reward}</span>
                  </div>
                  <button
                    className={`synth-btn ${canSynthesize ? '' : 'disabled'}`}
                    disabled={!canSynthesize}
                    onClick={() => {
                      if (canSynthesize) {
                        playSound('achievement');
                        setSynthRecipe(recipe);
                        setIsSynthesizing(true);
                      }
                    }}
                  >
                    {canSynthesize ? '合成' : '碎片不足'}
                  </button>
                </div>
              );
            })}
          </div>
        </div>

        {/* 碎片详情弹窗 */}
        {selectedFragment && (
          <div className="fragment-modal-overlay" onClick={() => setSelectedFragment(null)}>
            <div className="fragment-modal" onClick={e => e.stopPropagation()}>
              <div className="modal-icon" style={{ fontSize: 64 }}>
                {selectedFragment.icon}
              </div>
              <h3 className="modal-name">{selectedFragment.name}</h3>
              <p className="modal-desc">{selectedFragment.description}</p>
              <div className="modal-stats">
                <span>拥有数量: <b>{selectedFragment.count}</b></span>
                <span>合成需要: <b>{selectedFragment.maxCount}</b></span>
              </div>
              <button className="modal-close" onClick={() => setSelectedFragment(null)}>
                关闭
              </button>
            </div>
          </div>
        )}
      </div>

      <style>{`
        .fragment-page {
          min-height: 100vh;
          padding-bottom: 100px;
        }

        .fragment-container {
          max-width: 800px;
          margin: 0 auto;
          padding: 20px;
        }

        .fragment-header {
          text-align: center;
          margin-bottom: 24px;
        }

        .header-title {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 12px;
          margin-bottom: 8px;
        }

        .header-title h1 {
          font-size: 28px;
          font-weight: 700;
          background: linear-gradient(135deg, var(--accent-purple), var(--accent-cyan));
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
        }

        .title-icon {
          color: var(--accent-purple);
          animation: float 3s ease-in-out infinite;
        }

        .header-desc {
          color: var(--text-muted);
          font-size: 14px;
        }

        .stats-row {
          display: flex;
          justify-content: center;
          gap: 32px;
          margin-top: 20px;
        }

        .stat-item {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 12px 20px;
          background: var(--glass-bg);
          border: 1px solid var(--glass-border);
          border-radius: 12px;
        }

        .stat-item svg {
          color: var(--accent-cyan);
        }

        .stat-info {
          display: flex;
          flex-direction: column;
        }

        .stat-value {
          font-size: 20px;
          font-weight: 700;
          color: var(--text-primary);
        }

        .stat-label {
          font-size: 12px;
          color: var(--text-muted);
        }

        /* 获取提示 */
        .source-tips {
          display: flex;
          gap: 12px;
          padding: 16px;
          margin-bottom: 24px;
        }

        .source-tips svg {
          color: var(--accent-cyan);
          flex-shrink: 0;
          margin-top: 2px;
        }

        .tips-title {
          font-weight: 600;
          display: block;
          margin-bottom: 8px;
        }

        .tips-content ul {
          list-style: none;
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 6px;
        }

        .tips-content li {
          font-size: 12px;
          color: var(--text-secondary);
        }

        /* 标签...*/
        .rarity-tabs {
          display: flex;
          gap: 8px;
          margin-bottom: 20px;
          overflow-x: auto;
          padding: 4px 0;
        }

        .rarity-tab {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 8px 16px;
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 20px;
          color: var(--text-secondary);
          font-size: 13px;
          cursor: pointer;
          transition: all 0.2s ease;
          white-space: nowrap;
        }

        .rarity-tab:hover {
          background: rgba(255, 255, 255, 0.1);
        }

        .rarity-tab.active {
          background: rgba(255, 255, 255, 0.1);
          border-color: var(--tab-color);
          color: var(--tab-color);
        }

        .tab-count {
          font-size: 11px;
          padding: 2px 6px;
          background: rgba(255, 255, 255, 0.1);
          border-radius: 10px;
        }

        /* 碎片网格 */
        .fragments-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
          gap: 16px;
          margin-bottom: 32px;
        }

        .fragments-loading {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
          gap: 16px;
        }

        /* 合成区域 */
        .synthesis-section {
          margin-top: 32px;
        }

        .section-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 16px;
        }

        .section-header h2 {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 18px;
        }

        .section-header h2 svg {
          color: var(--accent-purple);
        }

        .view-all-btn {
          display: flex;
          align-items: center;
          gap: 4px;
          background: none;
          border: none;
          color: var(--accent-cyan);
          font-size: 13px;
          cursor: pointer;
        }

        .recipes-list {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .recipe-card {
          display: flex;
          align-items: center;
          gap: 16px;
          padding: 16px;
          background: var(--glass-bg);
          border: 1px solid var(--glass-border);
          border-radius: 12px;
          transition: all 0.3s ease;
        }

        .recipe-card.available {
          border-color: var(--accent-purple);
          box-shadow: 0 0 20px rgba(162, 103, 255, 0.1);
        }

        .recipe-card.legendary {
          border-color: rgba(255, 215, 0, 0.3);
        }

        .recipe-card.legendary.available {
          animation: glow-border 3s ease-in-out infinite;
        }

        .recipe-icon {
          width: 48px;
          height: 48px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: rgba(162, 103, 255, 0.2);
          border-radius: 12px;
          color: var(--accent-purple);
        }

        .recipe-info {
          flex: 1;
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .recipe-name {
          font-size: 15px;
          font-weight: 600;
        }

        .recipe-desc {
          font-size: 12px;
          color: var(--text-muted);
        }

        .recipe-reward {
          font-size: 11px;
          color: var(--accent-cyan);
        }

        .synth-btn {
          padding: 10px 20px;
          background: linear-gradient(135deg, var(--accent-purple), var(--accent-pink));
          border: none;
          border-radius: 20px;
          color: #fff;
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.3s ease;
        }

        .synth-btn:hover:not(:disabled) {
          transform: scale(1.05);
          box-shadow: 0 0 15px rgba(162, 103, 255, 0.4);
        }

        .synth-btn.disabled {
          background: rgba(100, 100, 100, 0.5);
          cursor: not-allowed;
        }

        /* 详情弹窗 */
        .fragment-modal-overlay {
          position: fixed;
          inset: 0;
          background: rgba(0, 0, 0, 0.8);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
          animation: fadeIn 0.3s ease;
        }

        .fragment-modal {
          background: var(--bg-elevated);
          border: 2px solid var(--accent-purple);
          border-radius: 20px;
          padding: 32px;
          text-align: center;
          max-width: 300px;
          animation: bounceIn 0.4s ease;
        }

        .modal-icon {
          margin-bottom: 16px;
        }

        .modal-name {
          font-size: 20px;
          margin-bottom: 8px;
        }

        .modal-desc {
          font-size: 14px;
          color: var(--text-muted);
          margin-bottom: 16px;
        }

        .modal-stats {
          display: flex;
          justify-content: center;
          gap: 24px;
          font-size: 13px;
          color: var(--text-secondary);
          margin-bottom: 20px;
        }

        .modal-stats b {
          color: var(--accent-cyan);
        }

        .modal-close {
          padding: 10px 24px;
          background: rgba(255, 255, 255, 0.1);
          border: 1px solid rgba(255, 255, 255, 0.2);
          border-radius: 20px;
          color: var(--text-primary);
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .modal-close:hover {
          background: rgba(255, 255, 255, 0.15);
        }

        @keyframes bounceIn {
          0% { transform: scale(0.8); opacity: 0; }
          50% { transform: scale(1.05); }
          100% { transform: scale(1); opacity: 1; }
        }

        @media (max-width: 480px) {
          .stats-row {
            flex-direction: column;
            gap: 12px;
          }

          .tips-content ul {
            grid-template-columns: 1fr;
          }

          .fragments-grid {
            grid-template-columns: repeat(3, 1fr);
          }
        }
      `}</style>
    </div>
  );
}
