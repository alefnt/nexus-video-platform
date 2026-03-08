// FILE: /video-platform/client-web/src/components/BottomTabBar.tsx
/**
 * Nexus Video - 移动端底部导航标签栏
 * 
 * 响应式设计：
 * - 移动端显示底部 Tab Bar
 * - 桌面端隐藏（使用顶部导航）
 * 
 * 标签：首页 / 发现 / 创作 / 我的
 */

import React from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useSound } from "../hooks/useSound";

interface TabItem {
  path: string;
  label: string;
  icon: React.ReactNode;
  activeIcon?: React.ReactNode;
}

const tabKeys = [
  { path: "/home", labelKey: "nav.home", icon: <HomeIcon />, activeIcon: <HomeIcon active /> },
  { path: "/feed", labelKey: "nav.feed", icon: <DiscoverIcon />, activeIcon: <DiscoverIcon active /> },
  { path: "/creator/upload", labelKey: "nav.create", icon: <CreateIcon />, activeIcon: <CreateIcon active /> },
  { path: "/user", labelKey: "nav.profile", icon: <ProfileIcon />, activeIcon: <ProfileIcon active /> },
];

export function BottomTabBar() {
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useTranslation();
  const currentPath = location.pathname;
  const [ripple, setRipple] = React.useState<{ path: string; x: number; y: number } | null>(null);
  const { play: playSound } = useSound();

  const tabs: TabItem[] = tabKeys.map(tk => ({ ...tk, label: t(tk.labelKey) }));

  // 触觉反馈模拟（通过轻微振动）
  const triggerHaptic = () => {
    if ('vibrate' in navigator) {
      navigator.vibrate(10);
    }
  };

  const handleTabClick = (path: string, e: React.MouseEvent<HTMLButtonElement>) => {
    triggerHaptic();
    playSound('click');

    // 创建 ripple 效果
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    setRipple({ path, x, y });
    setTimeout(() => setRipple(null), 500);

    navigate(path);
  };

  return (
    <>
      {/* 底部空间占位（防止内容被遮挡） */}
      <div className="bottom-tab-spacer" />

      {/* 标签栏 */}
      <nav className="bottom-tab-bar">
        {tabs.map((tab, index) => {
          const isActive =
            currentPath === tab.path ||
            (tab.path === "/home" && (currentPath === "/" || currentPath.startsWith("/home"))) ||
            (tab.path === "/user" && currentPath.startsWith("/user")) ||
            (tab.path === "/creator/upload" && currentPath.startsWith("/creator"));
          const isCreateButton = tab.path === "/creator/upload";

          return (
            <button
              key={tab.path}
              type="button"
              className={`tab-item ${isActive ? "active" : ""} ${isCreateButton ? "create-btn" : ""}`}
              onClick={(e) => handleTabClick(tab.path, e)}
              style={{ animationDelay: `${index * 50}ms` }}
              aria-label={tab.label}
              aria-current={isActive ? "page" : undefined}
            >
              {/* Ripple 效果 */}
              {ripple?.path === tab.path && (
                <span
                  className="tab-ripple"
                  style={{
                    left: ripple.x,
                    top: ripple.y,
                  }}
                />
              )}
              <span className={`tab-icon ${isActive ? 'icon-active' : ''}`}>
                {isActive ? tab.activeIcon || tab.icon : tab.icon}
              </span>
              <span className="tab-label">{tab.label}</span>
            </button>
          );
        })}

        {/* 样式 */}
        <style>{`
          .bottom-tab-spacer {
            height: 90px;
          }

          .bottom-tab-bar {
            position: fixed;
            bottom: 20px;
            left: 20px;
            right: 20px;
            height: 70px;
            background: rgba(20, 20, 30, 0.9);
            backdrop-filter: blur(24px);
            -webkit-backdrop-filter: blur(24px);
            border: 1px solid rgba(255, 255, 255, 0.08);
            border-radius: 35px;
            display: flex;
            justify-content: space-around;
            align-items: center;
            padding: 0 12px;
            z-index: 1000;
            box-shadow: 
              0 10px 40px rgba(0,0,0,0.5),
              0 0 0 1px rgba(255, 255, 255, 0.05) inset;
            animation: slideUp 0.4s cubic-bezier(0.16, 1, 0.3, 1);
          }

          /* 桌面端隐藏 */
          @media (min-width: 768px) {
            .bottom-tab-bar,
            .bottom-tab-spacer {
              display: none;
            }
          }

          .tab-item {
            flex: 1;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            gap: 4px;
            padding: 8px 4px;
            background: transparent;
            border: none;
            cursor: pointer;
            transition: transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1);
            position: relative;
            overflow: hidden;
            -webkit-tap-highlight-color: transparent;
          }

          /* Ripple 效果 */
          .tab-ripple {
            position: absolute;
            width: 60px;
            height: 60px;
            background: rgba(0, 245, 212, 0.2);
            border-radius: 50%;
            transform: translate(-50%, -50%) scale(0);
            animation: ripple 0.5s ease-out forwards;
            pointer-events: none;
          }

          @keyframes ripple {
            to {
              transform: translate(-50%, -50%) scale(2);
              opacity: 0;
            }
          }

          .tab-item.active::after {
             content: '';
             position: absolute;
             bottom: 2px;
             width: 4px;
             height: 4px;
             border-radius: 50%;
             background: var(--accent-cyan);
             box-shadow: 0 0 12px var(--accent-cyan), 0 0 24px var(--accent-cyan);
             animation: pulse-dot 2s ease-in-out infinite;
          }

          @keyframes pulse-dot {
            0%, 100% { opacity: 1; transform: scale(1); }
            50% { opacity: 0.7; transform: scale(1.2); }
          }

          .tab-icon {
            display: flex;
            align-items: center;
            justify-content: center;
            width: 28px;
            height: 28px;
            transition: all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
          }

          .tab-icon svg {
            transition: all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
          }

          .tab-item.active .tab-icon svg {
            transform: scale(1.15);
            filter: drop-shadow(0 0 6px var(--accent-cyan));
          }

          .tab-label {
            font-size: 11px;
            font-weight: 500;
            color: var(--text-muted);
            transition: all 0.3s ease;
            opacity: 0.8;
          }

          .tab-item.active .tab-label {
            color: var(--accent-cyan);
            opacity: 1;
            text-shadow: 0 0 10px rgba(0, 245, 212, 0.5);
          }

          .tab-item:active {
            transform: scale(0.92);
          }

          /* 创作按钮特殊样式 */
          .tab-item.create-btn .tab-icon {
            width: 48px;
            height: 48px;
            background: linear-gradient(135deg, var(--accent-purple), var(--accent-cyan));
            border-radius: 16px;
            margin-top: -16px;
            box-shadow: 
              0 6px 20px rgba(162, 103, 255, 0.5),
              0 0 30px rgba(0, 245, 212, 0.2);
            animation: create-glow 3s ease-in-out infinite;
          }

          @keyframes create-glow {
            0%, 100% {
              box-shadow: 
                0 6px 20px rgba(162, 103, 255, 0.5),
                0 0 30px rgba(0, 245, 212, 0.2);
            }
            50% {
              box-shadow: 
                0 8px 30px rgba(162, 103, 255, 0.7),
                0 0 50px rgba(0, 245, 212, 0.4);
            }
          }

          .tab-item.create-btn:active .tab-icon {
            transform: scale(0.9);
          }

          .tab-item.create-btn .tab-icon svg {
            color: white !important;
            stroke: white !important;
          }

          .tab-item.create-btn .tab-label {
            margin-top: 4px;
          }

          /* 安全区域适配 (iOS) */
          @supports (padding-bottom: env(safe-area-inset-bottom)) {
            .bottom-tab-bar {
              bottom: calc(12px + env(safe-area-inset-bottom));
            }
            .bottom-tab-spacer {
              height: calc(90px + env(safe-area-inset-bottom));
            }
          }
        `}</style>
      </nav>
    </>
  );
}

// 图标组件
function HomeIcon({ active }: { active?: boolean }) {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill={active ? "var(--accent-cyan)" : "none"}
      stroke={active ? "var(--accent-cyan)" : "var(--text-muted)"}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
      <polyline points="9 22 9 12 15 12 15 22" />
    </svg>
  );
}

function DiscoverIcon({ active }: { active?: boolean }) {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke={active ? "var(--accent-cyan)" : "var(--text-muted)"}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="10" />
      <polygon
        points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76"
        fill={active ? "var(--accent-cyan)" : "none"}
      />
    </svg>
  );
}

function CreateIcon({ active }: { active?: boolean }) {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke={active ? "white" : "white"}
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  );
}

function ProfileIcon({ active }: { active?: boolean }) {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill={active ? "var(--accent-cyan)" : "none"}
      stroke={active ? "var(--accent-cyan)" : "var(--text-muted)"}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  );
}

export default BottomTabBar;
