/**
 * 🌈 Theme Switcher Component
 * 主题切换组件，支持多种预设主题
 */

import React, { useEffect, useState, useCallback } from 'react';
import { Palette, Sun, Moon, Sparkles } from 'lucide-react';
import { useSound } from '../hooks/useSound';

export type ThemeType = 'default' | 'neon-pink' | 'cyber-blue' | 'dark-green' | 'sunset';

interface Theme {
    id: ThemeType;
    name: string;
    icon: React.ReactNode;
    colors: {
        accentPrimary: string;
        accentSecondary: string;
        accentHighlight: string;
        bgSpace: string;
        bgSurface: string;
        bgElevated: string;
    };
}

const THEMES: Theme[] = [
    {
        id: 'default',
        name: '默认紫',
        icon: <Sparkles size={16} />,
        colors: {
            accentPrimary: '#A267FF',
            accentSecondary: '#00F5D4',
            accentHighlight: '#FF2E93',
            bgSpace: '#0A0A10',
            bgSurface: '#13131F',
            bgElevated: '#1C1C2E',
        }
    },
    {
        id: 'neon-pink',
        name: '霓虹粉',
        icon: <Palette size={16} />,
        colors: {
            accentPrimary: '#FF2E93',
            accentSecondary: '#FF6B6B',
            accentHighlight: '#FFE66D',
            bgSpace: '#0D0D12',
            bgSurface: '#1A1A24',
            bgElevated: '#252532',
        }
    },
    {
        id: 'cyber-blue',
        name: '赛博蓝',
        icon: <Moon size={16} />,
        colors: {
            accentPrimary: '#4D61FC',
            accentSecondary: '#00D4FF',
            accentHighlight: '#00F5D4',
            bgSpace: '#080810',
            bgSurface: '#101020',
            bgElevated: '#18182E',
        }
    },
    {
        id: 'dark-green',
        name: '暗夜绿',
        icon: <Sun size={16} />,
        colors: {
            accentPrimary: '#00C853',
            accentSecondary: '#69F0AE',
            accentHighlight: '#B9F6CA',
            bgSpace: '#0A100A',
            bgSurface: '#121A12',
            bgElevated: '#1A281A',
        }
    },
    {
        id: 'sunset',
        name: '日落橙',
        icon: <Sun size={16} />,
        colors: {
            accentPrimary: '#FF6B35',
            accentSecondary: '#F7C59F',
            accentHighlight: '#FFE66D',
            bgSpace: '#0F0A08',
            bgSurface: '#1A1410',
            bgElevated: '#2A1E18',
        }
    },
];

const STORAGE_KEY = 'nexus-theme';

// 获取保存的主题
function getSavedTheme(): ThemeType {
    if (typeof window === 'undefined') return 'default';
    const saved = localStorage.getItem(STORAGE_KEY);
    return (saved as ThemeType) || 'default';
}

// 应用主题到 CSS 变量
function applyTheme(themeId: ThemeType): void {
    const theme = THEMES.find(t => t.id === themeId);
    if (!theme) return;

    const root = document.documentElement;
    root.style.setProperty('--accent-purple', theme.colors.accentPrimary);
    root.style.setProperty('--accent-cyan', theme.colors.accentSecondary);
    root.style.setProperty('--accent-pink', theme.colors.accentHighlight);
    root.style.setProperty('--neon-purple', theme.colors.accentPrimary);
    root.style.setProperty('--neon-cyan', theme.colors.accentSecondary);
    root.style.setProperty('--neon-pink', theme.colors.accentHighlight);
    root.style.setProperty('--bg-space', theme.colors.bgSpace);
    root.style.setProperty('--bg-surface', theme.colors.bgSurface);
    root.style.setProperty('--bg-elevated', theme.colors.bgElevated);

    // 更新 border-glow 基于主题色
    root.style.setProperty('--border-glow', `rgba(${hexToRgb(theme.colors.accentPrimary)}, 0.3)`);

    // 添加主题标识
    root.setAttribute('data-theme', themeId);
}

// 十六进制转 RGB
function hexToRgb(hex: string): string {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    if (!result) return '162, 103, 255';
    return `${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(result[3], 16)}`;
}

// 全局主题 hook
export function useTheme() {
    const [theme, setThemeState] = useState<ThemeType>(() => getSavedTheme());

    useEffect(() => {
        applyTheme(theme);
    }, [theme]);

    // 初始化时应用主题
    useEffect(() => {
        const savedTheme = getSavedTheme();
        applyTheme(savedTheme);
        setThemeState(savedTheme);
    }, []);

    const setTheme = useCallback((newTheme: ThemeType) => {
        localStorage.setItem(STORAGE_KEY, newTheme);
        setThemeState(newTheme);
        applyTheme(newTheme);
    }, []);

    const cycleTheme = useCallback(() => {
        const currentIndex = THEMES.findIndex(t => t.id === theme);
        const nextIndex = (currentIndex + 1) % THEMES.length;
        setTheme(THEMES[nextIndex].id);
    }, [theme, setTheme]);

    return {
        theme,
        themes: THEMES,
        setTheme,
        cycleTheme,
        currentTheme: THEMES.find(t => t.id === theme) || THEMES[0],
    };
}

interface ThemeSwitcherProps {
    variant?: 'icon' | 'dropdown' | 'pills';
    className?: string;
}

export const ThemeSwitcher: React.FC<ThemeSwitcherProps> = ({
    variant = 'dropdown',
    className = ''
}) => {
    const { theme, themes, setTheme, currentTheme } = useTheme();
    const [isOpen, setIsOpen] = useState(false);
    const { play: playSound } = useSound();

    const handleThemeChange = (themeId: ThemeType) => {
        playSound('click');
        setTheme(themeId);
        setIsOpen(false);
    };

    // Icon 变体：点击循环切换
    if (variant === 'icon') {
        return (
            <button
                className={`theme-switcher-icon ${className}`}
                onClick={() => {
                    playSound('click');
                    const currentIndex = themes.findIndex(t => t.id === theme);
                    const nextIndex = (currentIndex + 1) % themes.length;
                    setTheme(themes[nextIndex].id);
                }}
                title={`当前主题: ${currentTheme.name}`}
                aria-label="切换主题"
            >
                {currentTheme.icon}
                <style>{`
          .theme-switcher-icon {
            display: flex;
            align-items: center;
            justify-content: center;
            width: 36px;
            height: 36px;
            background: rgba(255, 255, 255, 0.05);
            border: 1px solid rgba(255, 255, 255, 0.1);
            border-radius: 8px;
            color: var(--accent-purple);
            cursor: pointer;
            transition: all 0.2s ease;
          }
          .theme-switcher-icon:hover {
            background: rgba(255, 255, 255, 0.1);
            border-color: var(--accent-purple);
            box-shadow: 0 0 10px rgba(162, 103, 255, 0.3);
          }
          .theme-switcher-icon:active {
            transform: scale(0.95);
          }
        `}</style>
            </button>
        );
    }

    // Pills 变体：横排显示所有主题
    if (variant === 'pills') {
        return (
            <div className={`theme-switcher-pills ${className}`}>
                {themes.map(t => (
                    <button
                        key={t.id}
                        className={`theme-pill ${theme === t.id ? 'active' : ''}`}
                        onClick={() => handleThemeChange(t.id)}
                        title={t.name}
                        style={{
                            '--pill-color': t.colors.accentPrimary
                        } as React.CSSProperties}
                    >
                        <span className="pill-color" style={{ background: t.colors.accentPrimary }} />
                        <span className="pill-name">{t.name}</span>
                    </button>
                ))}
                <style>{`
          .theme-switcher-pills {
            display: flex;
            gap: 8px;
            flex-wrap: wrap;
          }
          .theme-pill {
            display: flex;
            align-items: center;
            gap: 6px;
            padding: 6px 12px;
            background: rgba(255, 255, 255, 0.05);
            border: 1px solid rgba(255, 255, 255, 0.1);
            border-radius: 20px;
            color: var(--text-secondary);
            cursor: pointer;
            transition: all 0.2s ease;
            font-size: 12px;
          }
          .theme-pill:hover {
            background: rgba(255, 255, 255, 0.1);
            border-color: var(--pill-color);
          }
          .theme-pill.active {
            background: rgba(162, 103, 255, 0.15);
            border-color: var(--pill-color);
            color: var(--text-primary);
            box-shadow: 0 0 10px rgba(162, 103, 255, 0.2);
          }
          .pill-color {
            width: 12px;
            height: 12px;
            border-radius: 50%;
          }
          .theme-pill:active {
            transform: scale(0.95);
          }
        `}</style>
            </div>
        );
    }

    // Dropdown 变体（默认）
    return (
        <div className={`theme-switcher-dropdown ${className}`}>
            <button
                className="theme-trigger"
                onClick={() => {
                    playSound('click');
                    setIsOpen(!isOpen);
                }}
            >
                <span className="theme-preview" style={{ background: currentTheme.colors.accentPrimary }} />
                <span className="theme-name">{currentTheme.name}</span>
                <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor" style={{
                    transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                    transition: 'transform 0.2s ease'
                }}>
                    <path d="M2 4L6 8L10 4" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" />
                </svg>
            </button>

            {isOpen && (
                <>
                    <div className="theme-backdrop" onClick={() => setIsOpen(false)} />
                    <div className="theme-menu">
                        {themes.map(t => (
                            <button
                                key={t.id}
                                className={`theme-option ${theme === t.id ? 'active' : ''}`}
                                onClick={() => handleThemeChange(t.id)}
                            >
                                <span className="option-color" style={{ background: t.colors.accentPrimary }} />
                                <span className="option-name">{t.name}</span>
                                {theme === t.id && <span className="option-check">✓</span>}
                            </button>
                        ))}
                    </div>
                </>
            )}

            <style>{`
        .theme-switcher-dropdown {
          position: relative;
        }
        .theme-trigger {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 8px 12px;
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 8px;
          color: var(--text-primary);
          cursor: pointer;
          transition: all 0.2s ease;
          font-size: 13px;
        }
        .theme-trigger:hover {
          background: rgba(255, 255, 255, 0.1);
          border-color: rgba(255, 255, 255, 0.2);
        }
        .theme-preview {
          width: 14px;
          height: 14px;
          border-radius: 50%;
        }
        .theme-backdrop {
          position: fixed;
          inset: 0;
          z-index: 100;
        }
        .theme-menu {
          position: absolute;
          top: calc(100% + 8px);
          right: 0;
          min-width: 160px;
          background: var(--bg-elevated);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 12px;
          padding: 8px;
          z-index: 101;
          box-shadow: 0 10px 40px rgba(0, 0, 0, 0.5);
          animation: themeMenuIn 0.2s ease;
        }
        @keyframes themeMenuIn {
          from { opacity: 0; transform: translateY(-8px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .theme-option {
          display: flex;
          align-items: center;
          gap: 10px;
          width: 100%;
          padding: 10px 12px;
          background: transparent;
          border: none;
          border-radius: 8px;
          color: var(--text-secondary);
          cursor: pointer;
          transition: all 0.15s ease;
          font-size: 13px;
        }
        .theme-option:hover {
          background: rgba(255, 255, 255, 0.08);
          color: var(--text-primary);
        }
        .theme-option.active {
          background: rgba(162, 103, 255, 0.15);
          color: var(--text-primary);
        }
        .option-color {
          width: 16px;
          height: 16px;
          border-radius: 50%;
        }
        .option-name {
          flex: 1;
          text-align: left;
        }
        .option-check {
          color: var(--accent-purple);
          font-weight: bold;
        }
      `}</style>
        </div>
    );
};

export default ThemeSwitcher;
