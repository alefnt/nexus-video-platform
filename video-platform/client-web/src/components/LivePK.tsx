/**
 * 🎤 直播 PK 组件
 * Live PK Battle - 两个主播 PK，观众投票决定胜负
 */

import React, { useState, useEffect, useCallback } from 'react';
import { Swords, Heart, Trophy, Users, Timer, Zap, Flame } from 'lucide-react';
import { useSound } from '../hooks/useSound';
import { AvatarFrame, AvatarFrameData } from './AvatarFrame';

export interface PKPlayer {
    id: string;
    name: string;
    avatar: string;
    avatarFrame?: AvatarFrameData;
    score: number;
    votes: number;
}

export interface PKBattle {
    id: string;
    status: 'waiting' | 'active' | 'ended';
    startTime: string;
    duration: number; // 秒
    player1: PKPlayer;
    player2: PKPlayer;
    totalVotes: number;
    myVote?: 'player1' | 'player2';
}

interface LivePKProps {
    battle: PKBattle;
    onVote?: (playerId: string) => void;
    onSendGift?: (playerId: string, giftId: string) => void;
}

export const LivePK: React.FC<LivePKProps> = ({
    battle,
    onVote,
    onSendGift
}) => {
    const [timeLeft, setTimeLeft] = useState(0);
    const [voted, setVoted] = useState<'player1' | 'player2' | null>(battle.myVote || null);
    const [showWinner, setShowWinner] = useState(false);
    const { play: playSound } = useSound();

    // 计算剩余时间
    useEffect(() => {
        if (battle.status !== 'active') return;

        const updateTime = () => {
            const now = Date.now();
            const start = new Date(battle.startTime).getTime();
            const end = start + battle.duration * 1000;
            const remaining = Math.max(0, Math.floor((end - now) / 1000));
            setTimeLeft(remaining);

            if (remaining === 0 && battle.status === 'active') {
                setShowWinner(true);
                playSound('achievement');
            }
        };

        updateTime();
        const timer = setInterval(updateTime, 1000);
        return () => clearInterval(timer);
    }, [battle, playSound]);

    // 格式化时间
    const formatTime = (seconds: number) => {
        const m = Math.floor(seconds / 60);
        const s = seconds % 60;
        return `${m}:${s.toString().padStart(2, '0')}`;
    };

    // 计算百分比
    const totalScore = battle.player1.score + battle.player2.score;
    const player1Percent = totalScore > 0 ? (battle.player1.score / totalScore) * 100 : 50;
    const player2Percent = 100 - player1Percent;

    const winner = battle.player1.score > battle.player2.score ? 'player1' :
        battle.player2.score > battle.player1.score ? 'player2' : null;

    const handleVote = (player: 'player1' | 'player2') => {
        if (voted || battle.status !== 'active') return;

        playSound('success');
        setVoted(player);
        onVote?.(battle[player].id);
    };

    return (
        <>
            <div className={`pk-container ${battle.status}`}>
                {/* PK 标题 */}
                <div className="pk-header">
                    <div className="pk-title">
                        <Swords size={24} />
                        <span>主播 PK</span>
                    </div>

                    {battle.status === 'active' && (
                        <div className={`pk-timer ${timeLeft <= 30 ? 'urgent' : ''}`}>
                            <Timer size={16} />
                            <span>{formatTime(timeLeft)}</span>
                        </div>
                    )}

                    {battle.status === 'ended' && (
                        <div className="pk-ended-badge">
                            <Trophy size={16} />
                            已结束
                        </div>
                    )}
                </div>

                {/* PK 对战区 */}
                <div className="pk-battle-area">
                    {/* 玩家1 */}
                    <div className={`pk-player left ${winner === 'player1' && showWinner ? 'winner' : ''}`}>
                        <div className="player-avatar-wrapper">
                            <AvatarFrame
                                avatarUrl={battle.player1.avatar}
                                frame={battle.player1.avatarFrame}
                                size={60}
                            />
                            {winner === 'player1' && showWinner && (
                                <div className="winner-crown">👑</div>
                            )}
                        </div>
                        <span className="player-name">{battle.player1.name}</span>
                        <div className="player-score">
                            <Flame size={14} />
                            {battle.player1.score.toLocaleString()}
                        </div>

                        {battle.status === 'active' && !voted && (
                            <button
                                className="vote-btn left-btn"
                                onClick={() => handleVote('player1')}
                            >
                                <Heart size={14} />
                                投票
                            </button>
                        )}

                        {voted === 'player1' && (
                            <span className="voted-badge">已投票 ✓</span>
                        )}
                    </div>

                    {/* VS 标志 */}
                    <div className="vs-badge">
                        <span>VS</span>
                    </div>

                    {/* 玩家2 */}
                    <div className={`pk-player right ${winner === 'player2' && showWinner ? 'winner' : ''}`}>
                        <div className="player-avatar-wrapper">
                            <AvatarFrame
                                avatarUrl={battle.player2.avatar}
                                frame={battle.player2.avatarFrame}
                                size={60}
                            />
                            {winner === 'player2' && showWinner && (
                                <div className="winner-crown">👑</div>
                            )}
                        </div>
                        <span className="player-name">{battle.player2.name}</span>
                        <div className="player-score">
                            <Flame size={14} />
                            {battle.player2.score.toLocaleString()}
                        </div>

                        {battle.status === 'active' && !voted && (
                            <button
                                className="vote-btn right-btn"
                                onClick={() => handleVote('player2')}
                            >
                                <Heart size={14} />
                                投票
                            </button>
                        )}

                        {voted === 'player2' && (
                            <span className="voted-badge">已投票 ✓</span>
                        )}
                    </div>
                </div>

                {/* 进度条 */}
                <div className="pk-progress-bar">
                    <div
                        className="progress-left"
                        style={{ width: `${player1Percent}%` }}
                    >
                        <span className="progress-percent">{Math.round(player1Percent)}%</span>
                    </div>
                    <div
                        className="progress-right"
                        style={{ width: `${player2Percent}%` }}
                    >
                        <span className="progress-percent">{Math.round(player2Percent)}%</span>
                    </div>
                </div>

                {/* 统计信息 */}
                <div className="pk-stats">
                    <div className="stat-item">
                        <Users size={14} />
                        <span>总票数: {battle.totalVotes}</span>
                    </div>
                    <div className="stat-item">
                        <Zap size={14} />
                        <span>总积分: {totalScore.toLocaleString()}</span>
                    </div>
                </div>

                {/* 胜利弹窗 */}
                {showWinner && winner && (
                    <div className="winner-overlay" onClick={() => setShowWinner(false)}>
                        <div className="winner-card">
                            <div className="winner-confetti" />
                            <Trophy size={48} className="winner-trophy" />
                            <h3>🎉 PK 结束</h3>
                            <div className="winner-info">
                                <AvatarFrame
                                    avatarUrl={battle[winner].avatar}
                                    frame={battle[winner].avatarFrame}
                                    size={80}
                                />
                                <span className="winner-name">{battle[winner].name}</span>
                                <span className="winner-label">获得胜利！</span>
                            </div>
                            <div className="final-score">
                                {battle.player1.score} : {battle.player2.score}
                            </div>
                        </div>
                    </div>
                )}
            </div>

            <style>{`
        .pk-container {
          background: var(--glass-bg);
          border: 1px solid var(--glass-border);
          border-radius: var(--radius-lg);
          padding: 16px;
          position: relative;
          overflow: hidden;
        }

        .pk-container.active {
          border-color: var(--accent-pink);
          animation: pk-pulse 2s ease-in-out infinite;
        }

        @keyframes pk-pulse {
          0%, 100% { box-shadow: 0 0 10px rgba(255, 46, 147, 0.2); }
          50% { box-shadow: 0 0 25px rgba(255, 46, 147, 0.4); }
        }

        .pk-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 16px;
        }

        .pk-title {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 16px;
          font-weight: 700;
          color: var(--accent-pink);
        }

        .pk-timer {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 6px 12px;
          background: rgba(255, 255, 255, 0.1);
          border-radius: 20px;
          font-size: 14px;
          font-weight: 600;
        }

        .pk-timer.urgent {
          background: rgba(255, 46, 147, 0.2);
          color: var(--accent-pink);
          animation: blink 1s ease-in-out infinite;
        }

        @keyframes blink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }

        .pk-ended-badge {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 6px 12px;
          background: rgba(100, 100, 100, 0.3);
          border-radius: 20px;
          font-size: 12px;
          color: var(--text-muted);
        }

        /* 对战区 */
        .pk-battle-area {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 16px;
        }

        .pk-player {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 8px;
          flex: 1;
        }

        .pk-player.winner {
          animation: winner-glow 1s ease-in-out infinite;
        }

        @keyframes winner-glow {
          0%, 100% { filter: drop-shadow(0 0 10px rgba(255, 215, 0, 0.5)); }
          50% { filter: drop-shadow(0 0 20px rgba(255, 215, 0, 0.8)); }
        }

        .player-avatar-wrapper {
          position: relative;
        }

        .winner-crown {
          position: absolute;
          top: -20px;
          left: 50%;
          transform: translateX(-50%);
          font-size: 24px;
          animation: bounce 1s ease-in-out infinite;
        }

        @keyframes bounce {
          0%, 100% { transform: translateX(-50%) translateY(0); }
          50% { transform: translateX(-50%) translateY(-5px); }
        }

        .player-name {
          font-size: 14px;
          font-weight: 600;
          max-width: 100px;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .player-score {
          display: flex;
          align-items: center;
          gap: 4px;
          font-size: 13px;
          color: var(--accent-cyan);
        }

        .vote-btn {
          display: flex;
          align-items: center;
          gap: 4px;
          padding: 8px 16px;
          border: none;
          border-radius: 20px;
          font-size: 12px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.3s ease;
        }

        .left-btn {
          background: linear-gradient(135deg, #FF2E93, #FF6B9D);
          color: #fff;
        }

        .right-btn {
          background: linear-gradient(135deg, #4D61FC, #00F5D4);
          color: #fff;
        }

        .vote-btn:hover {
          transform: scale(1.05);
        }

        .voted-badge {
          font-size: 11px;
          color: var(--status-success);
        }

        .vs-badge {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 50px;
          height: 50px;
          background: linear-gradient(135deg, var(--accent-purple), var(--accent-pink));
          border-radius: 50%;
          font-size: 16px;
          font-weight: 900;
          color: #fff;
          text-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
          animation: vs-pulse 2s ease-in-out infinite;
        }

        @keyframes vs-pulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.1); }
        }

        /* 进度条 */
        .pk-progress-bar {
          display: flex;
          height: 24px;
          background: rgba(100, 100, 100, 0.3);
          border-radius: 12px;
          overflow: hidden;
          margin-bottom: 12px;
        }

        .progress-left {
          background: linear-gradient(90deg, #FF2E93, #FF6B9D);
          display: flex;
          align-items: center;
          justify-content: flex-end;
          padding-right: 8px;
          min-width: 40px;
          transition: width 0.5s ease;
        }

        .progress-right {
          background: linear-gradient(90deg, #4D61FC, #00F5D4);
          display: flex;
          align-items: center;
          justify-content: flex-start;
          padding-left: 8px;
          min-width: 40px;
          transition: width 0.5s ease;
        }

        .progress-percent {
          font-size: 11px;
          font-weight: 700;
          color: #fff;
          text-shadow: 0 1px 2px rgba(0, 0, 0, 0.3);
        }

        /* 统计 */
        .pk-stats {
          display: flex;
          justify-content: center;
          gap: 24px;
        }

        .stat-item {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 12px;
          color: var(--text-muted);
        }

        /* 胜利弹窗 */
        .winner-overlay {
          position: fixed;
          inset: 0;
          background: rgba(0, 0, 0, 0.85);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
          animation: fadeIn 0.3s ease;
        }

        .winner-card {
          background: var(--bg-elevated);
          border: 2px solid #FFD700;
          border-radius: 20px;
          padding: 32px;
          text-align: center;
          position: relative;
          overflow: hidden;
          animation: bounceIn 0.5s ease;
        }

        .winner-confetti {
          position: absolute;
          inset: 0;
          background: radial-gradient(circle, rgba(255, 215, 0, 0.1) 0%, transparent 70%);
          animation: confetti-pulse 2s ease-in-out infinite;
        }

        @keyframes confetti-pulse {
          0%, 100% { opacity: 0.5; }
          50% { opacity: 1; }
        }

        .winner-trophy {
          color: #FFD700;
          margin-bottom: 16px;
          animation: trophy-shine 2s ease-in-out infinite;
        }

        @keyframes trophy-shine {
          0%, 100% { filter: drop-shadow(0 0 10px rgba(255, 215, 0, 0.5)); }
          50% { filter: drop-shadow(0 0 25px rgba(255, 215, 0, 1)); }
        }

        .winner-info {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 8px;
          margin: 16px 0;
        }

        .winner-name {
          font-size: 20px;
          font-weight: 700;
        }

        .winner-label {
          font-size: 14px;
          color: #FFD700;
        }

        .final-score {
          font-size: 24px;
          font-weight: 700;
          color: var(--text-muted);
          margin-top: 16px;
        }

        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }

        @keyframes bounceIn {
          0% { transform: scale(0.8); opacity: 0; }
          50% { transform: scale(1.05); }
          100% { transform: scale(1); opacity: 1; }
        }
      `}</style>
        </>
    );
};

export default LivePK;
