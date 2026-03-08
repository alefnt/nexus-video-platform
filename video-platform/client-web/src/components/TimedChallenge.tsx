/**
 * ⏱️ 限时挑战组件
 * Timed Challenge - 实时倒计时挑战卡片
 * 从 engagement 服务 /engagement/tasks/daily API 获取真实数据
 */

import React, { useState, useEffect, useMemo } from 'react';
import { Clock, Gift, Zap, Target, ChevronRight, CheckCircle } from 'lucide-react';
import { useSound } from '../hooks/useSound';
import { getApiClient } from '../lib/apiClient';
import { useAuthStore } from '../stores';

const api = getApiClient();

interface Challenge {
  id: string;
  title: string;
  description: string;
  type: 'watch' | 'like' | 'comment' | 'share' | 'login';
  target: number;
  current: number;
  reward: number;
  endTime: string; // ISO date string
  claimed?: boolean;
}

interface TimedChallengeProps {
  challenge?: Challenge;
  variant?: 'card' | 'inline' | 'compact';
  onClaim?: (challengeId: string) => void;
  onNavigate?: (challengeId: string) => void;
}

// 时间格式化
function formatTimeLeft(endTime: string): { text: string; urgent: boolean } {
  const now = Date.now();
  const end = new Date(endTime).getTime();
  const diff = Math.max(0, end - now);

  if (diff <= 0) {
    return { text: '已过期', urgent: true };
  }

  const hours = Math.floor(diff / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  const seconds = Math.floor((diff % (1000 * 60)) / 1000);

  if (hours > 0) {
    return { text: `${hours}时${minutes}分`, urgent: hours < 1 };
  } else if (minutes > 0) {
    return { text: `${minutes}分${seconds}秒`, urgent: minutes < 10 };
  } else {
    return { text: `${seconds}秒`, urgent: true };
  }
}

// 挑战类型图标
function getChallengeIcon(type: Challenge['type']) {
  switch (type) {
    case 'watch': return <Target size={18} />;
    case 'like': return <span>❤️</span>;
    case 'comment': return <span>💬</span>;
    case 'share': return <span>📤</span>;
    case 'login': return <span>🔑</span>;
    default: return <Zap size={18} />;
  }
}

export const TimedChallengeCard: React.FC<TimedChallengeProps> = ({
  challenge,
  variant = 'card',
  onClaim,
  onNavigate
}) => {
  const [timeLeft, setTimeLeft] = useState(() =>
    challenge ? formatTimeLeft(challenge.endTime) : { text: '', urgent: false }
  );
  const [claiming, setClaiming] = useState(false);
  const { play: playSound } = useSound();

  // 倒计时更新
  useEffect(() => {
    if (!challenge) return;

    const timer = setInterval(() => {
      setTimeLeft(formatTimeLeft(challenge.endTime));
    }, 1000);

    return () => clearInterval(timer);
  }, [challenge?.endTime]);

  if (!challenge) return null;

  const progress = Math.min(100, (challenge.current / challenge.target) * 100);
  const isCompleted = challenge.current >= challenge.target;
  const canClaim = isCompleted && !challenge.claimed;

  const handleClaim = async () => {
    if (!canClaim || claiming) return;
    setClaiming(true);
    playSound('coin');

    // Call real engagement API to claim task reward
    const jwt = sessionStorage.getItem('vp.jwt');
    if (jwt) api.setJWT(jwt);
    const user = useAuthStore.getState().user;
    if (user?.id) {
      try {
        await api.post('/engagement/tasks/claim', { userId: user.id, taskType: challenge.type });
      } catch (err) {
        console.warn('[TimedChallenge] Claim failed:', err);
      }
    }
    onClaim?.(challenge.id);
    setClaiming(false);
  };

  // Compact 变体
  if (variant === 'compact') {
    return (
      <div className="challenge-compact" onClick={() => onNavigate?.(challenge.id)}>
        <div className="compact-icon">{getChallengeIcon(challenge.type)}</div>
        <div className="compact-info">
          <span className="compact-title">{challenge.title}</span>
          <span className="compact-progress">{challenge.current}/{challenge.target}</span>
        </div>
        <div className={`compact-time ${timeLeft.urgent ? 'urgent' : ''}`}>
          <Clock size={12} />
          {timeLeft.text}
        </div>
        <style>{`
          .challenge-compact {
            display: flex;
            align-items: center;
            gap: 10px;
            padding: 10px 12px;
            background: rgba(255, 255, 255, 0.03);
            border-radius: 10px;
            cursor: pointer;
            transition: all 0.2s ease;
          }
          .challenge-compact:hover {
            background: rgba(255, 255, 255, 0.06);
          }
          .compact-icon {
            font-size: 16px;
          }
          .compact-info {
            flex: 1;
            display: flex;
            flex-direction: column;
            gap: 2px;
          }
          .compact-title {
            font-size: 13px;
            font-weight: 500;
          }
          .compact-progress {
            font-size: 11px;
            color: var(--text-muted);
          }
          .compact-time {
            display: flex;
            align-items: center;
            gap: 4px;
            font-size: 11px;
            color: var(--text-muted);
          }
          .compact-time.urgent {
            color: var(--accent-pink);
          }
        `}</style>
      </div>
    );
  }

  // Card 变体（默认）
  return (
    <div className={`challenge-card ${isCompleted ? 'completed' : ''}`}>
      {/* 头部 */}
      <div className="challenge-header">
        <div className="challenge-type">
          {getChallengeIcon(challenge.type)}
          <span className="challenge-title">{challenge.title}</span>
        </div>
        <div className={`challenge-timer ${timeLeft.urgent ? 'urgent' : ''}`}>
          <Clock size={14} />
          <span>{timeLeft.text}</span>
        </div>
      </div>

      {/* 描述 */}
      <p className="challenge-desc">{challenge.description}</p>

      {/* 进度 */}
      <div className="challenge-progress">
        <div className="progress-bar">
          <div
            className="progress-fill"
            style={{ width: `${progress}%` }}
          />
        </div>
        <span className="progress-text">{challenge.current}/{challenge.target}</span>
      </div>

      {/* 奖励 & 按钮 */}
      <div className="challenge-footer">
        <div className="challenge-reward">
          <Gift size={14} />
          <span>{challenge.reward} 积分</span>
        </div>

        {canClaim ? (
          <button
            className={`claim-btn ${claiming ? 'claiming' : ''}`}
            onClick={handleClaim}
            disabled={claiming}
          >
            {claiming ? '领取中...' : '领取奖励'}
          </button>
        ) : challenge.claimed ? (
          <div className="claimed-badge">
            <CheckCircle size={14} />
            已领取
          </div>
        ) : (
          <button
            className="go-btn"
            onClick={() => onNavigate?.(challenge.id)}
          >
            去完成
            <ChevronRight size={14} />
          </button>
        )}
      </div>

      <style>{`
        .challenge-card {
          background: var(--glass-bg);
          border: 1px solid var(--glass-border);
          border-radius: var(--radius-md);
          padding: 16px;
          transition: all 0.3s ease;
        }

        .challenge-card:hover {
          border-color: rgba(255, 255, 255, 0.15);
          box-shadow: 0 4px 20px rgba(0, 0, 0, 0.2);
        }

        .challenge-card.completed {
          border-color: var(--accent-cyan);
          box-shadow: 0 0 20px rgba(0, 245, 212, 0.1);
        }

        .challenge-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 10px;
        }

        .challenge-type {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .challenge-title {
          font-size: 15px;
          font-weight: 600;
        }

        .challenge-timer {
          display: flex;
          align-items: center;
          gap: 5px;
          font-size: 12px;
          color: var(--text-muted);
          padding: 4px 8px;
          background: rgba(255, 255, 255, 0.05);
          border-radius: 20px;
        }

        .challenge-timer.urgent {
          color: var(--accent-pink);
          background: rgba(255, 46, 147, 0.1);
          animation: pulse-glow 2s ease-in-out infinite;
        }

        .challenge-desc {
          font-size: 13px;
          color: var(--text-secondary);
          margin-bottom: 12px;
        }

        .challenge-progress {
          display: flex;
          align-items: center;
          gap: 10px;
          margin-bottom: 14px;
        }

        .progress-bar {
          flex: 1;
          height: 6px;
          background: rgba(255, 255, 255, 0.1);
          border-radius: 3px;
          overflow: hidden;
        }

        .progress-fill {
          height: 100%;
          background: linear-gradient(90deg, var(--accent-purple), var(--accent-cyan));
          border-radius: 3px;
          transition: width 0.5s ease;
        }

        .progress-text {
          font-size: 12px;
          color: var(--text-muted);
          min-width: 40px;
          text-align: right;
        }

        .challenge-footer {
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .challenge-reward {
          display: flex;
          align-items: center;
          gap: 5px;
          font-size: 13px;
          color: var(--accent-cyan);
        }

        .claim-btn {
          padding: 8px 16px;
          background: linear-gradient(135deg, var(--accent-purple), var(--accent-pink));
          border: none;
          border-radius: 20px;
          color: #fff;
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.3s ease;
        }

        .claim-btn:hover:not(:disabled) {
          transform: scale(1.05);
          box-shadow: 0 0 15px rgba(162, 103, 255, 0.4);
        }

        .claim-btn.claiming {
          opacity: 0.7;
          cursor: wait;
        }

        .claimed-badge {
          display: flex;
          align-items: center;
          gap: 5px;
          font-size: 12px;
          color: var(--status-success);
        }

        .go-btn {
          display: flex;
          align-items: center;
          gap: 4px;
          padding: 8px 12px;
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 20px;
          color: var(--text-secondary);
          font-size: 13px;
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .go-btn:hover {
          background: rgba(255, 255, 255, 0.1);
          color: var(--text-primary);
        }
      `}</style>
    </div>
  );
};

// 挑战列表组件
interface TimedChallengesListProps {
  maxItems?: number;
  onNavigate?: (challengeId: string) => void;
}

export const TimedChallengesList: React.FC<TimedChallengesListProps> = ({
  maxItems = 3,
  onNavigate
}) => {
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const user = useAuthStore.getState().user;
    if (!user?.id) {
      setLoading(false);
      return;
    }
    setLoading(true);
    const jwt = sessionStorage.getItem('vp.jwt');
    if (jwt) api.setJWT(jwt);

    api.get<{ tasks?: any[]; streak?: number }>(`/engagement/tasks/daily?userId=${user.id}`)
      .then((res) => {
        const tasks = res?.tasks || (Array.isArray(res) ? res : []);
        const endOfDay = new Date();
        endOfDay.setHours(23, 59, 59, 999);
        const mapped: Challenge[] = tasks.slice(0, maxItems).map((task: any) => ({
          id: task.type || task.id,
          title: task.name || task.type,
          description: task.description || `Complete ${task.requirement || 1} ${task.type}`,
          type: (task.type as Challenge['type']) || 'watch',
          target: task.requirement || 1,
          current: task.progress || 0,
          reward: task.points || 10,
          endTime: endOfDay.toISOString(),
          claimed: task.claimed || false,
        }));
        setChallenges(mapped);
      })
      .catch((err) => {
        console.warn('[TimedChallenge] Failed to fetch tasks:', err);
        setChallenges([]);
      })
      .finally(() => setLoading(false));
  }, [maxItems]);

  const handleClaim = (challengeId: string) => {
    setChallenges(prev =>
      prev.map(c => c.id === challengeId ? { ...c, claimed: true } : c)
    );
  };

  if (loading) {
    return (
      <div className="challenges-loading">
        {[1, 2, 3].slice(0, maxItems).map(i => (
          <div key={i} className="skeleton-card" style={{ height: 140 }} />
        ))}
      </div>
    );
  }

  return (
    <div className="challenges-list">
      <div className="challenges-header">
        <h3>
          <Zap size={18} />
          限时挑战
        </h3>
        <button className="view-all" onClick={() => onNavigate?.('all')}>
          查看全部
        </button>
      </div>
      <div className="challenges-grid">
        {challenges.map(challenge => (
          <TimedChallengeCard
            key={challenge.id}
            challenge={challenge}
            onClaim={handleClaim}
            onNavigate={onNavigate}
          />
        ))}
      </div>
      <style>{`
        .challenges-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 16px;
        }
        .challenges-header h3 {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 18px;
          font-weight: 600;
        }
        .challenges-header h3 svg {
          color: var(--accent-purple);
        }
        .view-all {
          background: none;
          border: none;
          color: var(--accent-cyan);
          font-size: 13px;
          cursor: pointer;
        }
        .view-all:hover {
          text-decoration: underline;
        }
        .challenges-grid {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }
        .challenges-loading {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }
        .skeleton-card {
          background: var(--glass-bg);
          border-radius: var(--radius-md);
          animation: shimmer 1.5s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
};

export default TimedChallengeCard;
