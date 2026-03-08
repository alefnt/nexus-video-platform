/**
 * 🎰 每日转盘抽奖页面
 * Daily Spin Wheel - 每日一次免费抽奖机... */

import React, { useState, useRef, useEffect } from 'react';
import { Gift, Star, Coins, Ticket, Crown, Gem, Zap, Award, RefreshCw } from 'lucide-react';
import { useSound } from '../hooks/useSound';
import { getApiClient } from '../lib/apiClient';

const client = getApiClient();

interface Prize {
  id: string;
  name: string;
  icon: React.ReactNode;
  color: string;
  chance: number; // 概率权重
  reward: {
    type: 'points' | 'coupon' | 'vip' | 'mystery';
    value: number;
  };
}

const PRIZES: Prize[] = [
  { id: 'points_10', name: '10积分', icon: <Coins size={24} />, color: '#FFD700', chance: 30, reward: { type: 'points', value: 10 } },
  { id: 'points_50', name: '50积分', icon: <Coins size={24} />, color: '#FFA500', chance: 20, reward: { type: 'points', value: 50 } },
  { id: 'points_100', name: '100积分', icon: <Star size={24} />, color: '#FF6B35', chance: 10, reward: { type: 'points', value: 100 } },
  { id: 'coupon_5', name: '5折券', icon: <Ticket size={24} />, color: '#00F5D4', chance: 15, reward: { type: 'coupon', value: 50 } },
  { id: 'coupon_3', name: '3折券', icon: <Ticket size={24} />, color: '#A267FF', chance: 5, reward: { type: 'coupon', value: 30 } },
  { id: 'vip_1', name: '1天VIP', icon: <Crown size={24} />, color: '#FF2E93', chance: 10, reward: { type: 'vip', value: 1 } },
  { id: 'mystery', name: '神秘奖品', icon: <Gem size={24} />, color: '#4D61FC', chance: 5, reward: { type: 'mystery', value: 0 } },
  { id: 'points_500', name: '500积分', icon: <Award size={24} />, color: '#00FF88', chance: 5, reward: { type: 'points', value: 500 } },
];

export default function DailyWheel() {
  const [isSpinning, setIsSpinning] = useState(false);
  const [rotation, setRotation] = useState(0);
  const [result, setResult] = useState<Prize | null>(null);
  const [showResult, setShowResult] = useState(false);
  const [spinsLeft, setSpinsLeft] = useState(1);
  const [loading, setLoading] = useState(true);
  const wheelRef = useRef<HTMLDivElement>(null);
  const { play: playSound } = useSound();

  const jwt = typeof window !== 'undefined' ? sessionStorage.getItem('vp.jwt') : null;
  const user = React.useMemo(() => {
    try {
      const raw = sessionStorage.getItem('vp.user');
      return raw ? JSON.parse(raw) : null;
    } catch { return null; }
  }, []);

  if (jwt) client.setJWT(jwt);

  useEffect(() => {
    checkSpinStatus();
  }, []);

  const checkSpinStatus = async () => {
    try {
      setLoading(true);
      const userRaw = sessionStorage.getItem('vp.user');
      if (userRaw) {
        const u = JSON.parse(userRaw);
        console.log('[DailyWheel] Checking spin status for user:', u.id);
        const res = await client.get<{ canSpin: boolean; remainingSpins: number }>(`/engagement/wheel/status?userId=${u.id}`);
        console.log('[DailyWheel] Spin status response:', res);
        setSpinsLeft(res.canSpin ? 1 : 0);
      } else {
        console.log('[DailyWheel] No user found, setting spinsLeft to 1 (demo mode)');
        setSpinsLeft(1);
      }
    } catch (err) {
      console.error('[DailyWheel] Check spin status failed:', err);
      // Fallback for demo if offline: assume 1 spin
      setSpinsLeft(1);
    } finally {
      setLoading(false);
    }
  };

  // 根据概率权重选择奖品
  const selectPrize = (): Prize => {
    const totalWeight = PRIZES.reduce((sum, p) => sum + p.chance, 0);
    let random = Math.random() * totalWeight;

    for (const prize of PRIZES) {
      random -= prize.chance;
      if (random <= 0) {
        return prize;
      }
    }
    return PRIZES[0];
  };

  const handleSpin = async () => {
    if (isSpinning || spinsLeft <= 0) return;
    const userRaw = sessionStorage.getItem('vp.user');
    if (!userRaw) {
      alert("请先登录");
      return;
    }
    const u = JSON.parse(userRaw);

    setIsSpinning(true);
    setShowResult(false);
    playSound('spin');

    try {
      // 1. 调用后端获取结果
      const res = await client.post<{ success: boolean; prizeId: string; reward: any }>('/engagement/wheel/spin', { userId: u.id });

      if (!res.success) {
        throw new Error("抽奖失败");
      }

      const prizeId = res.prizeId;
      const prize = PRIZES.find(p => p.id === prizeId) || PRIZES[0];
      const prizeIndex = PRIZES.findIndex(p => p.id === prize.id);

      // 2. 计算旋转角度
      const segmentAngle = 360 / PRIZES.length;
      const targetAngle = 360 - (prizeIndex * segmentAngle) - (segmentAngle / 2);
      const spins = 5;
      const finalRotation = rotation + (spins * 360) + targetAngle + Math.random() * 10 - 5;

      setRotation(finalRotation);

      // 3. 等待动画完成
      setTimeout(() => {
        setIsSpinning(false);
        setResult(prize);
        setShowResult(true);
        setSpinsLeft(0);
        playSound('prize');
      }, 5000);

    } catch (err: any) {
      setIsSpinning(false);

      // Check if error is "already spun today" - set spinsLeft to 0 without showing failure
      const errorMsg = err?.error || err?.message || '';
      if (errorMsg.includes('已用完') || errorMsg.includes('次数')) {
        // User already spun today, just update the status
        setSpinsLeft(0);
      } else {
        // Actual API failure
        alert(errorMsg || "抽奖失败，请稍后重试");
        checkSpinStatus(); // Re-check status
      }
    }
  };

  const segmentAngle = 360 / PRIZES.length;

  return (
    <div className="min-h-full text-gray-200 wheel-page">

      <div className="wheel-container">
        {/* 标题 */}
        <div className="wheel-header">
          <h1 className="wheel-title">
            <Gift className="title-icon" />
            每日幸运转盘
          </h1>
          <p className="wheel-subtitle">每天一次免费抽奖机会，精彩好礼等你来拿</p>
        </div>

        {/* 转盘 */}
        <div className="wheel-wrapper">
          <div className="wheel-pointer">
            <Zap size={24} />
          </div>

          <div
            ref={wheelRef}
            className="wheel"
            style={{
              transform: `rotate(${rotation}deg)`,
              transition: isSpinning ? 'transform 5s cubic-bezier(0.17, 0.67, 0.12, 0.99)' : 'none'
            }}
          >
            {PRIZES.map((prize, index) => (
              <div
                key={prize.id}
                className="wheel-segment"
                style={{
                  transform: `rotate(${index * segmentAngle}deg)`,
                  '--segment-color': prize.color,
                } as React.CSSProperties}
              >
                <div className="segment-content">
                  <span className="segment-icon">{prize.icon}</span>
                  <span className="segment-name">{prize.name}</span>
                </div>
              </div>
            ))}
          </div>

          {/* 中心按钮 */}
          <button
            className={`spin-button ${isSpinning ? 'spinning' : ''} ${spinsLeft <= 0 ? 'disabled' : ''}`}
            onClick={handleSpin}
            disabled={isSpinning || spinsLeft <= 0}
          >
            {isSpinning ? (
              <RefreshCw size={32} className="spin-icon" />
            ) : spinsLeft > 0 ? (
              <>
                <span className="spin-text">抽奖</span>
                <span className="spin-count">{spinsLeft} 次</span>
              </>
            ) : (
              <>
                <span className="spin-text">明天</span>
                <span className="spin-count">再来</span>
              </>
            )}
          </button>
        </div>

        {/* 奖品列表 */}
        <div className="prize-list">
          <h3>奖品列表</h3>
          <div className="prize-grid">
            {PRIZES.map(prize => (
              <div key={prize.id} className="prize-item" style={{ '--prize-color': prize.color } as React.CSSProperties}>
                <span className="prize-icon">{prize.icon}</span>
                <span className="prize-name">{prize.name}</span>
              </div>
            ))}
          </div>
        </div>

        {/* 中奖结果弹窗 */}
        {showResult && result && (
          <div className="result-overlay" onClick={() => setShowResult(false)}>
            <div className="result-modal" onClick={e => e.stopPropagation()}>
              <div className="result-fireworks" />
              <div className="result-content">
                <div className="result-icon" style={{ color: result.color }}>
                  {result.icon}
                </div>
                <h2 className="result-title">🎉 恭喜获得</h2>
                <p className="result-prize" style={{ color: result.color }}>{result.name}</p>
                <p className="result-desc">
                  {result.reward.type === 'points' && `${result.reward.value} 积分已发放到账户`}
                  {result.reward.type === 'coupon' && `${result.reward.value}% 折扣券已发放`}
                  {result.reward.type === 'vip' && `${result.reward.value} 天VIP已激活`}
                  {result.reward.type === 'mystery' && '神秘奖品稍后发放'}
                </p>
                <button className="result-btn" onClick={() => setShowResult(false)}>
                  太棒了！
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      <style>{`
        .wheel-page {
          min-height: 100vh;
          padding-bottom: 100px;
        }

        .wheel-container {
          max-width: 500px;
          margin: 0 auto;
          padding: 20px;
        }

        .wheel-header {
          text-align: center;
          margin-bottom: 30px;
        }

        .wheel-title {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 12px;
          font-size: 28px;
          font-weight: 700;
          background: linear-gradient(135deg, var(--accent-purple), var(--accent-cyan));
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          margin-bottom: 8px;
        }

        .title-icon {
          color: var(--accent-purple);
          animation: float 3s ease-in-out infinite;
        }

        .wheel-subtitle {
          color: var(--text-muted);
          font-size: 14px;
        }

        /* 转盘容器 */
        .wheel-wrapper {
          position: relative;
          width: 320px;
          height: 320px;
          margin: 0 auto 40px;
        }

        /* 指针 */
        .wheel-pointer {
          position: absolute;
          top: -10px;
          left: 50%;
          transform: translateX(-50%);
          z-index: 10;
          color: var(--accent-pink);
          filter: drop-shadow(0 0 10px var(--accent-pink));
          animation: pulse-glow 2s ease-in-out infinite;
        }

        /* 转盘 */
        .wheel {
          width: 100%;
          height: 100%;
          border-radius: 50%;
          position: relative;
          background: var(--bg-elevated);
          border: 4px solid var(--accent-purple);
          box-shadow: 
            0 0 30px rgba(162, 103, 255, 0.3),
            inset 0 0 30px rgba(0, 0, 0, 0.5);
          overflow: hidden;
        }

        .wheel-segment {
          position: absolute;
          width: 50%;
          height: 50%;
          left: 50%;
          top: 0;
          transform-origin: 0% 100%;
          clip-path: polygon(0% 100%, 100% 100%, 50% 0%);
        }

        .wheel-segment::before {
          content: '';
          position: absolute;
          inset: 0;
          background: linear-gradient(
            to bottom,
            var(--segment-color) 0%,
            color-mix(in srgb, var(--segment-color) 60%, #000) 100%
          );
          opacity: 0.9;
        }

        .segment-content {
          position: absolute;
          top: 20%;
          left: 50%;
          transform: translateX(-50%) rotate(22.5deg);
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 4px;
        }

        .segment-icon {
          filter: drop-shadow(0 2px 4px rgba(0,0,0,0.5));
        }

        .segment-name {
          font-size: 10px;
          font-weight: 600;
          color: #fff;
          text-shadow: 0 1px 2px rgba(0,0,0,0.5);
          white-space: nowrap;
        }

        /* 中心按钮 */
        .spin-button {
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          width: 90px;
          height: 90px;
          border-radius: 50%;
          background: linear-gradient(135deg, var(--accent-purple), var(--accent-pink));
          border: 4px solid #fff;
          color: #fff;
          font-weight: 700;
          cursor: pointer;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          box-shadow: 
            0 0 20px rgba(162, 103, 255, 0.5),
            0 4px 15px rgba(0, 0, 0, 0.3);
          transition: all 0.3s ease;
          z-index: 5;
        }

        .spin-button:hover:not(:disabled) {
          transform: translate(-50%, -50%) scale(1.05);
          box-shadow: 
            0 0 30px rgba(162, 103, 255, 0.7),
            0 6px 20px rgba(0, 0, 0, 0.4);
        }

        .spin-button:active:not(:disabled) {
          transform: translate(-50%, -50%) scale(0.98);
        }

        .spin-button.disabled {
          background: linear-gradient(135deg, #555, #333);
          cursor: not-allowed;
          opacity: 0.8;
        }

        .spin-button.spinning {
          cursor: wait;
        }

        .spin-text {
          font-size: 18px;
        }

        .spin-count {
          font-size: 12px;
          opacity: 0.9;
        }

        .spin-icon {
          animation: spin 1s linear infinite;
        }

        /* 奖品列表 */
        .prize-list {
          background: var(--glass-bg);
          border: 1px solid var(--glass-border);
          border-radius: var(--radius-lg);
          padding: 20px;
        }

        .prize-list h3 {
          font-size: 16px;
          margin-bottom: 16px;
          color: var(--text-secondary);
        }

        .prize-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 12px;
        }

        .prize-item {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 6px;
          padding: 12px 8px;
          background: rgba(255, 255, 255, 0.03);
          border: 1px solid rgba(255, 255, 255, 0.05);
          border-radius: 12px;
          transition: all 0.2s ease;
        }

        .prize-item:hover {
          background: rgba(255, 255, 255, 0.06);
          border-color: var(--prize-color);
          box-shadow: 0 0 15px color-mix(in srgb, var(--prize-color) 30%, transparent);
        }

        .prize-icon {
          color: var(--prize-color);
        }

        .prize-name {
          font-size: 11px;
          color: var(--text-muted);
          text-align: center;
        }

        /* 中奖弹窗 */
        .result-overlay {
          position: fixed;
          inset: 0;
          background: rgba(0, 0, 0, 0.8);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
          animation: fadeIn 0.3s ease;
        }

        .result-modal {
          background: var(--bg-elevated);
          border: 2px solid var(--accent-purple);
          border-radius: var(--radius-lg);
          padding: 40px;
          text-align: center;
          position: relative;
          overflow: hidden;
          animation: bounceIn 0.5s ease;
          box-shadow: 0 0 50px rgba(162, 103, 255, 0.3);
        }

        @keyframes bounceIn {
          0% { transform: scale(0.8); opacity: 0; }
          50% { transform: scale(1.05); }
          100% { transform: scale(1); opacity: 1; }
        }

        .result-fireworks {
          position: absolute;
          inset: 0;
          background: radial-gradient(circle at center, transparent 30%, var(--accent-purple) 100%);
          opacity: 0.1;
          animation: pulse 2s ease-in-out infinite;
        }

        .result-content {
          position: relative;
          z-index: 1;
        }

        .result-icon {
          font-size: 64px;
          margin-bottom: 16px;
          animation: float 2s ease-in-out infinite;
        }

        .result-icon svg {
          width: 64px;
          height: 64px;
        }

        .result-title {
          font-size: 24px;
          margin-bottom: 12px;
        }

        .result-prize {
          font-size: 32px;
          font-weight: 700;
          margin-bottom: 8px;
        }

        .result-desc {
          font-size: 14px;
          color: var(--text-muted);
          margin-bottom: 24px;
        }

        .result-btn {
          padding: 12px 32px;
          background: linear-gradient(135deg, var(--accent-purple), var(--accent-pink));
          border: none;
          border-radius: var(--radius-full);
          color: #fff;
          font-size: 16px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.3s ease;
        }

        .result-btn:hover {
          transform: scale(1.05);
          box-shadow: 0 0 20px rgba(162, 103, 255, 0.5);
        }

        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }

        @keyframes pulse {
          0%, 100% { opacity: 0.1; }
          50% { opacity: 0.2; }
        }

        @media (max-width: 480px) {
          .wheel-wrapper {
            width: 280px;
            height: 280px;
          }

          .spin-button {
            width: 70px;
            height: 70px;
          }

          .spin-text {
            font-size: 14px;
          }

          .prize-grid {
            grid-template-columns: repeat(2, 1fr);
          }
        }
      `}</style>
    </div>
  );
}
