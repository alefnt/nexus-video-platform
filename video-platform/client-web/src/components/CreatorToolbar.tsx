// FILE: /video-platform/client-web/src/components/CreatorToolbar.tsx
/**
 * Nexus Video - 桌面端创作者工具栏
 * 
 * 仅在桌面端显示（>1024px）
 * 功能：
 * - 创作者统计
 * - 快速上传入口
 * - 创作引导
 */

import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { getApiClient } from "../lib/apiClient";
import { Sparkles, Plus, User, Gem, Film } from "lucide-react";

const client = getApiClient();

interface CreatorStats {
  totalVideos: number;
  totalViews: number;
  totalEarnings: string;
  newFollowers: number;
}

export function CreatorToolbar() {
  const navigate = useNavigate();
  const [stats, setStats] = useState<CreatorStats>({
    totalVideos: 0,
    totalViews: 0,
    totalEarnings: "0.00",
    newFollowers: 0,
  });
  const [hasUploaded, setHasUploaded] = useState(true);
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  useEffect(() => {
    checkLoginAndFetchStats();
  }, []);

  const checkLoginAndFetchStats = async () => {
    const jwt = sessionStorage.getItem("vp.jwt");
    if (!jwt) {
      setIsLoggedIn(false);
      return;
    }
    setIsLoggedIn(true);

    try {
      const res = await client.get<{
        stats: CreatorStats;
        hasUploaded: boolean;
      }>("/user/creator-stats").catch(() => ({
        stats: {
          totalVideos: 0,
          totalViews: 0,
          totalEarnings: "0.00",
          newFollowers: 0,
        },
        hasUploaded: false,
      }));
      setStats(res.stats);
      setHasUploaded(res.hasUploaded);
    } catch (e) {
      console.error("Failed to fetch creator stats:", e);
    }
  };

  const formatNumber = (n: number): string => {
    if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
    if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
    return n.toString();
  };

  if (!isLoggedIn) return null;

  return (
    <aside className="creator-toolbar">
      {/* 创作引导横幅 */}
      {!hasUploaded && (
        <div className="creator-banner">
          <span className="banner-icon"><Sparkles size={24} /></span>
          <span className="banner-text">发布你的第一个视频</span>
          <p className="banner-sub">开始赚取收入</p>
        </div>
      )}

      {/* 快速上传按钮 */}
      <button
        className="upload-btn btn-neon"
        onClick={() => navigate("/creator/upload")}
        aria-label="上传视频"
      >
        <span className="upload-icon"><Plus size={16} /></span>
        上传视频
      </button>

      {/* 创作者统计 */}
      <div className="stats-panel glass-card">
        <h3 className="stats-title">创作者工作台</h3>

        <div className="stat-row">
          <div className="stat-item">
            <span className="stat-value">{stats.totalVideos}</span>
            <span className="stat-label">视频</span>
          </div>
          <div className="stat-item">
            <span className="stat-value">{formatNumber(stats.totalViews)}</span>
            <span className="stat-label">播放</span>
          </div>
        </div>

        <div className="stat-row">
          <div className="stat-item">
            <span className="stat-value text-gradient">
              ${stats.totalEarnings}
            </span>
            <span className="stat-label">收入</span>
          </div>
          <div className="stat-item">
            <span className="stat-value" style={{ color: "var(--accent-cyan)" }}>
              +{stats.newFollowers}
            </span>
            <span className="stat-label">新粉丝</span>
          </div>
        </div>
      </div>

      {/* 快捷操作 */}
      <div className="quick-actions">
        <button
          className="action-btn"
          onClick={() => navigate("/user")}
          aria-label="查看主页"
        >
          <User size={14} style={{ marginRight: 6, verticalAlign: 'middle' }} /> 查看主页
        </button>
        <button
          className="action-btn"
          onClick={() => navigate("/points")}
          aria-label="积分中心"
        >
          <Gem size={14} style={{ marginRight: 6, verticalAlign: 'middle' }} /> 积分中心
        </button>
        <button
          className="action-btn"
          onClick={() => navigate("/videos")}
          aria-label="视频管理"
        >
          <Film size={14} style={{ marginRight: 6, verticalAlign: 'middle' }} /> 视频管理
        </button>
      </div>

      {/* 样式 */}
      <style>{`
        .creator-toolbar {
          position: sticky;
          top: 80px;
          width: 280px;
          display: flex;
          flex-direction: column;
          gap: 16px;
        }

        /* 仅桌面端显示 */
        @media (max-width: 1024px) {
          .creator-toolbar {
            display: none;
          }
        }

        .creator-banner {
          background: linear-gradient(135deg, rgba(162, 103, 255, 0.2), rgba(0, 245, 212, 0.2));
          border: 1px solid rgba(162, 103, 255, 0.3);
          border-radius: var(--radius-md);
          padding: 16px;
          text-align: center;
        }

        .banner-icon {
          font-size: 24px;
          display: block;
          margin-bottom: 8px;
        }

        .banner-text {
          font-size: 16px;
          font-weight: 600;
          color: var(--text-primary);
        }

        .banner-sub {
          font-size: 12px;
          color: var(--text-muted);
          margin: 4px 0 0 0;
        }

        .upload-btn {
          width: 100%;
          padding: 14px;
          font-size: 15px;
        }

        .upload-icon {
          margin-right: 8px;
        }

        .stats-panel {
          padding: 16px;
        }

        .stats-title {
          margin: 0 0 16px 0;
          font-size: 14px;
          font-weight: 600;
          color: var(--text-secondary);
        }

        .stat-row {
          display: flex;
          gap: 16px;
          margin-bottom: 12px;
        }

        .stat-row:last-child {
          margin-bottom: 0;
        }

        .stat-item {
          flex: 1;
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .stat-value {
          font-size: 20px;
          font-weight: 700;
          color: var(--text-primary);
        }

        .stat-label {
          font-size: 11px;
          color: var(--text-muted);
        }

        .quick-actions {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .action-btn {
          width: 100%;
          padding: 10px 14px;
          background: var(--bg-elevated);
          border: 1px solid var(--border-subtle);
          border-radius: var(--radius-sm);
          color: var(--text-secondary);
          font-size: 13px;
          text-align: left;
          cursor: pointer;
          transition: all 0.2s;
        }

        .action-btn:hover {
          background: var(--bg-surface);
          border-color: rgba(255, 255, 255, 0.15);
          color: var(--text-primary);
        }
      `}</style>
    </aside>
  );
}

export default CreatorToolbar;
