// FILE: /video-platform/client-web/src/components/TopNav.tsx
/**
 * Nexus Video - 顶部导航栏
 * 
 * 增强功能：
 * - 滚动时的毛玻璃效果增强
 * - 积分余额快速查看
 * - 通知铃铛红点指示器
 * - 平滑动画过渡
 */

import React, { useState, useEffect } from "react";
import "../styles/fun.css";
import { useNavigate, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import LiveFollowingNotification from "./live/LiveFollowingNotification";
import { Target, Bell, Coins, ChevronLeft, Sparkles, Globe, Search } from "lucide-react";
import { getApiClient } from "../lib/apiClient";
import { useAuthStore, usePointsStore } from "../stores";
import { changeLanguage, getCurrentLanguage } from "../i18n";

const client = getApiClient();

export default function TopNav() {
  const navigate = useNavigate();
  const loc = useLocation();
  const { t } = useTranslation();
  const current = `${loc.pathname}${loc.search || ""}`;

  const [hideBack, setHideBack] = useState<boolean>(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const [points, setPoints] = useState<number | null>(null);
  const [hasNotifications, setHasNotifications] = useState(false);
  const [lang, setLang] = useState<'zh' | 'en'>(getCurrentLanguage());
  const [searchQ, setSearchQ] = useState("");

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = searchQ.trim();
    if (trimmed) {
      navigate(`/search?q=${encodeURIComponent(trimmed)}`);
      setSearchQ("");
    }
  };

  const toggleLanguage = () => {
    const newLang = lang === 'zh' ? 'en' : 'zh';
    changeLanguage(newLang);
    setLang(newLang);
    // react-i18next auto re-renders all components using t(), no reload needed
  };

  // 获取 JWT 和用户信息
  const jwt = typeof window !== "undefined" ? sessionStorage.getItem("vp.jwt") : null;
  const userRaw = typeof window !== "undefined" ? sessionStorage.getItem("vp.user") : null;
  const user = userRaw ? JSON.parse(userRaw) : null;

  // 滚动检测
  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // 加载积分余额（使用统一API）
  useEffect(() => {
    if (jwt) {
      client.setJWT(jwt);
      client.get<{ balance?: number; points?: number }>('/payment/points/balance')
        .then(res => {
          const bal = res?.balance ?? res?.points ?? 0;
          setPoints(bal);
          // 同步到全局 zustand store
          usePointsStore.getState().setBalance(bal);
        })
        .catch(() => setPoints(null));
    }
  }, [jwt]);

  // 返回按钮逻辑
  useEffect(() => {
    try {
      const once = typeof window !== "undefined" ? sessionStorage.getItem("vp.hideBackOnce") : null;
      if (once === "1") {
        setHideBack(true);
        sessionStorage.removeItem("vp.hideBackOnce");
        return;
      }
      setHideBack(loc.pathname === "/home");
    } catch {
      setHideBack(loc.pathname === "/home");
    }
  }, [loc.pathname]);

  function goBack() {
    try {
      const last = sessionStorage.getItem("vp.lastRoute");
      if (last && last !== current) {
        navigate(last);
        return;
      }
    } catch { }
    if (window.history.length > 1) {
      navigate(-1);
    } else {
      navigate("/home");
    }
  }

  // 格式化积分显示
  const formatPoints = (p: number) => {
    if (p >= 10000) return `${(p / 1000).toFixed(1)}K`;
    if (p >= 1000) return `${(p / 1000).toFixed(1)}K`;
    return p.toString();
  };

  return (
    <>
      <nav
        className={`top-nav ${isScrolled ? 'scrolled' : ''}`}
      >
        {/* Logo 区域 */}
        <div className="nav-left">
          <div className="nav-logo" onClick={() => navigate("/home")} role="button" tabIndex={0} onKeyDown={e => e.key === "Enter" && navigate("/home")} aria-label={t('nav.home')}>
            <Sparkles size={20} className="logo-icon" />
            <span className="logo-text">NEXUS</span>
          </div>
          {!hideBack && (
            <button type="button" className="nav-back-btn" onClick={goBack} aria-label={t('common.back')}>
              <ChevronLeft size={18} />
              <span>{t('common.back')}</span>
            </button>
          )}
        </div>

        {/* 桌面端菜单 */}
        <div className="nav-center desktop-menu">
          <button type="button" className={`nav-link ${loc.pathname === '/home' ? 'active' : ''}`} onClick={() => navigate("/home")} aria-label={t('nav.home')}>{t('nav.home')}</button>
          <button type="button" className={`nav-link ${loc.pathname === '/feed' ? 'active' : ''}`} onClick={() => navigate("/feed")} aria-label={t('nav.feed')}>{t('nav.feed')}</button>
          <button type="button" className={`nav-link ${loc.pathname === '/videos' ? 'active' : ''}`} onClick={() => navigate("/videos")} aria-label={t('nav.videos')}>{t('nav.videos')}</button>
          <button type="button" className={`nav-link ${loc.pathname === '/music' ? 'active' : ''}`} onClick={() => navigate("/music")} aria-label={t('nav.music')}>{t('nav.music')}</button>
          <button type="button" className={`nav-link ${loc.pathname === '/articles' ? 'active' : ''}`} onClick={() => navigate("/articles")} aria-label={t('nav.read')}>{t('nav.read')}</button>
          <button type="button" className={`nav-link ${loc.pathname === '/explore' ? 'active' : ''}`} onClick={() => navigate("/explore")} aria-label={t('nav.live')}>{t('nav.live')}</button>
          <button type="button" className={`nav-link ${loc.pathname.startsWith('/creator') ? 'active' : ''}`} onClick={() => navigate("/creator/upload")} aria-label={t('nav.create')}>{t('nav.create')}</button>
          <button type="button" className={`nav-link ${loc.pathname === '/about' ? 'active' : ''}`} onClick={() => navigate("/about")} aria-label={t('nav.about')}>{t('nav.about')}</button>
        </div>

        {/* 搜索栏 */}
        <form className="nav-search-form desktop-menu" onSubmit={handleSearch}>
          <Search size={14} className="nav-search-icon" />
          <input
            type="text"
            value={searchQ}
            onChange={(e) => setSearchQ(e.target.value)}
            placeholder={t('nav.search', 'Search...')}
            className="nav-search-input"
          />
        </form>

        {/* 右侧操作区 */}
        <div className="nav-right desktop-menu">
          {/* 语言切换 */}
          <button type="button" className="nav-lang-btn" onClick={toggleLanguage} title={t('nav.switchLang')} aria-label={t('nav.switchLang')}>
            <Globe size={16} />
            <span>{lang === 'zh' ? '中文' : 'EN'}</span>
          </button>
          {points !== null && (
            <button type="button" className="nav-points" onClick={() => navigate("/points")} aria-label={t('nav.points', 'Points')}>
              <Coins size={16} />
              <span>{formatPoints(points)}</span>
            </button>
          )}
          <button type="button" className="nav-tasks" onClick={() => navigate("/tasks")} aria-label={t('nav.tasks')}>
            <Target size={16} />
            <span>{t('nav.tasks')}</span>
          </button>

          {/* 通知 */}
          <div className="nav-notification-wrapper">
            <LiveFollowingNotification />
          </div>

          {/* 分隔线 */}
          <div className="nav-divider" />

          {/* 用户中心 */}
          <button type="button" className="btn-neon nav-user-btn" onClick={() => navigate("/user")} aria-label={t('nav.mySpace')}>
            {t('nav.mySpace')}
          </button>
        </div>

        <div className="mobile-points-wrapper">
          {points !== null && (
            <button type="button" className="nav-points mobile" onClick={() => navigate("/points")} aria-label={t('nav.points', 'Points')}>
              <Coins size={14} />
              <span>{formatPoints(points)}</span>
            </button>
          )}
        </div>
      </nav>

      <style>{`
        .top-nav {
          position: sticky;
          top: 16px;
          z-index: 100;
          display: flex;
          gap: 12px;
          justify-content: space-between;
          align-items: center;
          padding: 10px 20px;
          margin-bottom: 24px;
          border-radius: var(--radius-full);
          border: 1px solid rgba(255, 255, 255, 0.06);
          background: rgba(20, 20, 30, 0.6);
          backdrop-filter: blur(16px);
          -webkit-backdrop-filter: blur(16px);
          transition: all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1);
          animation: slideDown 0.4s cubic-bezier(0.16, 1, 0.3, 1);
        }

        .top-nav.scrolled {
          background: rgba(10, 10, 16, 0.95);
          border-color: rgba(162, 103, 255, 0.15);
          box-shadow: 0 10px 40px rgba(0, 0, 0, 0.5), 0 0 30px rgba(162, 103, 255, 0.1);
        }

        .nav-left {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .nav-logo {
          display: flex;
          align-items: center;
          gap: 8px;
          cursor: pointer;
          transition: all 0.2s;
        }

        .nav-logo:hover {
          transform: scale(1.02);
        }

        .logo-icon {
          color: var(--accent-cyan);
          animation: pulse-glow 3s ease-in-out infinite;
        }

        .logo-text {
          font-weight: 800;
          font-size: 18px;
          letter-spacing: -0.02em;
          background: linear-gradient(135deg, var(--text-primary), var(--accent-cyan));
          -webkit-background-clip: text;
          background-clip: text;
          color: transparent;
        }

        .nav-back-btn {
          display: flex;
          align-items: center;
          gap: 4px;
          padding: 6px 12px;
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid var(--border-subtle);
          border-radius: var(--radius-full);
          color: var(--text-muted);
          font-size: 13px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s;
        }

        .nav-back-btn:hover {
          background: rgba(255, 255, 255, 0.1);
          color: var(--text-primary);
          border-color: rgba(255, 255, 255, 0.2);
        }

        .nav-back-btn:active {
          transform: scale(0.97);
        }

        .nav-center {
          display: flex;
          gap: 4px;
          align-items: center;
        }

        .nav-link {
          padding: 8px 16px;
          background: transparent;
          border: none;
          border-radius: var(--radius-full);
          color: var(--text-muted);
          font-size: 14px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s;
          position: relative;
        }

        .nav-link::after {
          content: '';
          position: absolute;
          bottom: 4px;
          left: 50%;
          transform: translateX(-50%) scaleX(0);
          width: 20px;
          height: 2px;
          background: var(--accent-cyan);
          border-radius: 2px;
          transition: transform 0.2s;
        }

        .nav-link:hover {
          color: var(--text-primary);
          background: rgba(255, 255, 255, 0.05);
        }

        .nav-link.active {
          color: var(--accent-cyan);
        }

        .nav-link.active::after {
          transform: translateX(-50%) scaleX(1);
        }

        .nav-right {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .nav-points {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 6px 14px;
          background: rgba(255, 217, 61, 0.1);
          border: 1px solid rgba(255, 217, 61, 0.2);
          border-radius: var(--radius-full);
          color: #FFD93D;
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
        }

        .nav-points:hover {
          background: rgba(255, 217, 61, 0.15);
          border-color: rgba(255, 217, 61, 0.3);
          transform: scale(1.02);
        }

        .nav-tasks {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 6px 14px;
          background: transparent;
          border: 1px solid var(--border-subtle);
          border-radius: var(--radius-full);
          color: var(--accent-cyan);
          font-size: 13px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s;
        }

        .nav-tasks:hover {
          background: rgba(0, 245, 212, 0.1);
          border-color: rgba(0, 245, 212, 0.3);
        }

        .nav-notification-wrapper {
          display: flex;
          align-items: center;
        }

        .nav-divider {
          width: 1px;
          height: 24px;
          background: var(--border-subtle);
          margin: 0 4px;
        }

        .nav-user-btn {
          padding: 8px 20px !important;
          height: 36px;
          font-size: 13px !important;
        }

        .mobile-points-wrapper {
          display: none;
        }

        /* 移动端响应式 */
        @media (max-width: 768px) {
          .desktop-menu {
            display: none !important;
          }

          .top-nav {
            padding: 10px 16px;
            margin-bottom: 16px;
            top: 8px;
          }

          .mobile-points-wrapper {
            display: block;
          }

          .nav-points.mobile {
            padding: 4px 10px;
            font-size: 12px;
          }
        }

        /* 减少动画 */
        @media (prefers-reduced-motion: reduce) {
          .top-nav {
            animation: none;
          }
          .logo-icon {
            animation: none;
          }
        }
        .nav-search-form {
            display: flex;
            align-items: center;
            gap: 6px;
            padding: 4px 12px;
            background: rgba(255, 255, 255, 0.05);
            border: 1px solid var(--border-subtle);
            border-radius: var(--radius-full);
            transition: all 0.2s;
        }
        .nav-search-form:focus-within {
            background: rgba(255, 255, 255, 0.08);
            border-color: var(--accent-cyan);
            box-shadow: 0 0 12px rgba(0, 245, 212, 0.15);
        }
        .nav-search-icon {
            color: var(--text-muted);
            flex-shrink: 0;
        }
        .nav-search-input {
            background: transparent;
            border: none;
            outline: none;
            color: var(--text-primary);
            font-size: 13px;
            width: 140px;
            transition: width 0.3s;
        }
        .nav-search-input::placeholder {
            color: var(--text-muted);
            font-size: 12px;
        }
        .nav-search-form:focus-within .nav-search-input {
            width: 200px;
        }
        .nav-lang-btn {
            display: flex;
            align-items: center;
            gap: 6px;
            padding: 6px 12px;
            border-radius: var(--radius-full);
            background: rgba(255, 255, 255, 0.05);
            border: 1px solid var(--border-subtle);
            color: var(--text-muted);
            font-size: 12px;
            font-weight: 500;
            cursor: pointer;
            transition: all 0.2s;
        }
        .nav-lang-btn:hover {
            background: rgba(255, 255, 255, 0.1);
            color: var(--text-primary);
            border-color: rgba(255, 255, 255, 0.2);
        }
      `}</style>
    </>
  );
}