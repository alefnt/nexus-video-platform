/**
 * 🖼️ 头像框组件
 * Avatar Frame - NFT 头像框，带动画特效
 */

import React from 'react';

export type FrameRarity = 'basic' | 'vip' | 'nft' | 'legendary';

export interface AvatarFrameData {
    id: string;
    name: string;
    rarity: FrameRarity;
    imageUrl?: string;
    borderColor?: string;
    glowColor?: string;
    animationType?: 'none' | 'glow' | 'rotate' | 'pulse' | 'particles';
    owned?: boolean;
    price?: number;
}

const FRAME_CONFIG: Record<FrameRarity, {
    borderWidth: number;
    defaultColor: string;
    glowIntensity: number;
    animation?: string;
}> = {
    basic: {
        borderWidth: 2,
        defaultColor: '#666',
        glowIntensity: 0
    },
    vip: {
        borderWidth: 3,
        defaultColor: '#FFD700',
        glowIntensity: 0.4,
        animation: 'glow'
    },
    nft: {
        borderWidth: 3,
        defaultColor: '#A267FF',
        glowIntensity: 0.6,
        animation: 'pulse'
    },
    legendary: {
        borderWidth: 4,
        defaultColor: '#00F5D4',
        glowIntensity: 0.8,
        animation: 'rotate'
    }
};

interface AvatarFrameProps {
    avatarUrl: string;
    frame?: AvatarFrameData;
    size?: number;
    showBadge?: boolean;
    onClick?: () => void;
}

export const AvatarFrame: React.FC<AvatarFrameProps> = ({
    avatarUrl,
    frame,
    size = 64,
    showBadge = false,
    onClick
}) => {
    const config = frame ? FRAME_CONFIG[frame.rarity] : FRAME_CONFIG.basic;
    const borderColor = frame?.borderColor || config.defaultColor;
    const glowColor = frame?.glowColor || borderColor;
    const animationType = frame?.animationType || config.animation || 'none';

    return (
        <>
            <div
                className={`avatar-frame-wrapper ${animationType}`}
                style={{
                    '--frame-size': `${size}px`,
                    '--border-color': borderColor,
                    '--glow-color': glowColor,
                    '--border-width': `${config.borderWidth}px`,
                    '--glow-intensity': config.glowIntensity,
                } as React.CSSProperties}
                onClick={onClick}
            >
                {/* 外层装饰框 */}
                {frame && frame.rarity !== 'basic' && (
                    <div className="frame-decoration" />
                )}

                {/* 头像容器 */}
                <div className="avatar-container">
                    <img
                        src={avatarUrl}
                        alt="avatar"
                        className="avatar-image"
                    />
                </div>

                {/* 粒子效果（传说级） */}
                {animationType === 'particles' && (
                    <div className="particle-container">
                        {[...Array(8)].map((_, i) => (
                            <span
                                key={i}
                                className="particle"
                                style={{ '--i': i } as React.CSSProperties}
                            />
                        ))}
                    </div>
                )}

                {/* 稀有度徽章 */}
                {showBadge && frame && frame.rarity !== 'basic' && (
                    <span className={`rarity-badge ${frame.rarity}`}>
                        {frame.rarity === 'vip' && 'VIP'}
                        {frame.rarity === 'nft' && 'NFT'}
                        {frame.rarity === 'legendary' && '✦'}
                    </span>
                )}
            </div>

            <style>{`
        .avatar-frame-wrapper {
          position: relative;
          width: var(--frame-size);
          height: var(--frame-size);
          cursor: pointer;
        }

        .avatar-container {
          position: relative;
          width: 100%;
          height: 100%;
          border-radius: 50%;
          border: var(--border-width) solid var(--border-color);
          overflow: hidden;
          z-index: 1;
          transition: all 0.3s ease;
        }

        .avatar-image {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }

        /* 装饰框 */
        .frame-decoration {
          position: absolute;
          inset: -4px;
          border-radius: 50%;
          border: 2px solid var(--border-color);
          opacity: 0.5;
        }

        /* Glow 动画 */
        .avatar-frame-wrapper.glow .avatar-container {
          box-shadow: 0 0 calc(var(--frame-size) * 0.15) rgba(var(--glow-color), var(--glow-intensity));
        }

        .avatar-frame-wrapper.glow .avatar-container,
        .avatar-frame-wrapper.glow .frame-decoration {
          animation: avatar-glow 2s ease-in-out infinite;
        }

        @keyframes avatar-glow {
          0%, 100% { 
            filter: drop-shadow(0 0 4px var(--glow-color));
          }
          50% { 
            filter: drop-shadow(0 0 12px var(--glow-color));
          }
        }

        /* Pulse 动画 */
        .avatar-frame-wrapper.pulse .avatar-container {
          animation: avatar-pulse 2s ease-in-out infinite;
        }

        @keyframes avatar-pulse {
          0%, 100% { 
            transform: scale(1);
            box-shadow: 0 0 0 0 var(--border-color);
          }
          50% { 
            transform: scale(1.02);
            box-shadow: 0 0 15px var(--border-color);
          }
        }

        /* Rotate 动画 */
        .avatar-frame-wrapper.rotate .frame-decoration {
          animation: avatar-rotate 4s linear infinite;
        }

        .avatar-frame-wrapper.rotate .frame-decoration::before {
          content: '';
          position: absolute;
          inset: 0;
          border-radius: 50%;
          border: 2px dashed var(--border-color);
          animation: avatar-rotate-reverse 6s linear infinite;
        }

        @keyframes avatar-rotate {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }

        @keyframes avatar-rotate-reverse {
          from { transform: rotate(360deg); }
          to { transform: rotate(0deg); }
        }

        /* 粒子效果 */
        .particle-container {
          position: absolute;
          inset: 0;
          pointer-events: none;
        }

        .particle {
          position: absolute;
          width: 4px;
          height: 4px;
          background: var(--border-color);
          border-radius: 50%;
          top: 50%;
          left: 50%;
          animation: particle-orbit 3s linear infinite;
          animation-delay: calc(var(--i) * -0.375s);
        }

        @keyframes particle-orbit {
          0% {
            transform: rotate(calc(var(--i) * 45deg)) translateX(calc(var(--frame-size) * 0.6)) translateY(0);
            opacity: 1;
          }
          50% {
            opacity: 0.5;
          }
          100% {
            transform: rotate(calc(var(--i) * 45deg + 360deg)) translateX(calc(var(--frame-size) * 0.6)) translateY(0);
            opacity: 1;
          }
        }

        /* 稀有度徽章 */
        .rarity-badge {
          position: absolute;
          bottom: -2px;
          right: -2px;
          padding: 2px 6px;
          border-radius: 8px;
          font-size: 9px;
          font-weight: 700;
          z-index: 2;
        }

        .rarity-badge.vip {
          background: linear-gradient(135deg, #FFD700, #FFA500);
          color: #000;
        }

        .rarity-badge.nft {
          background: linear-gradient(135deg, #A267FF, #FF2E93);
          color: #fff;
        }

        .rarity-badge.legendary {
          background: linear-gradient(135deg, #00F5D4, #4D61FC);
          color: #fff;
          animation: badge-glow 2s ease-in-out infinite;
        }

        @keyframes badge-glow {
          0%, 100% { box-shadow: 0 0 5px rgba(0, 245, 212, 0.5); }
          50% { box-shadow: 0 0 15px rgba(0, 245, 212, 0.8); }
        }

        /* Hover 效果 */
        .avatar-frame-wrapper:hover .avatar-container {
          transform: scale(1.05);
        }
      `}</style>
        </>
    );
};

export default AvatarFrame;
