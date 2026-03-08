/**
 * 💎 碎片卡片组件
 * Fragment Card - 展示单个碎片，支持多种稀有度
 */

import { motion, useMotionValue, useSpring, useTransform } from 'framer-motion';
import React from 'react';
import { Sparkles, Lock } from 'lucide-react';

export type FragmentRarity = 'common' | 'rare' | 'epic' | 'legendary';

export interface Fragment {
  id: string;
  name: string;
  description: string;
  rarity: FragmentRarity;
  imageUrl?: string;
  icon?: string;
  collected: boolean;
  collectedAt?: string;
  count: number;
  maxCount: number; // 合成所需数量
}

const RARITY_CONFIG: Record<FragmentRarity, {
  name: string;
  color: string;
  bgColor: string;
  glow: string;
  borderColor: string;
}> = {
  common: {
    name: '普通',
    color: '#A0A0A0',
    bgColor: 'rgba(160, 160, 160, 0.1)',
    glow: 'rgba(160, 160, 160, 0.3)',
    borderColor: 'rgba(160, 160, 160, 0.3)'
  },
  rare: {
    name: '稀有',
    color: '#4D61FC',
    bgColor: 'rgba(77, 97, 252, 0.1)',
    glow: 'rgba(77, 97, 252, 0.4)',
    borderColor: 'rgba(77, 97, 252, 0.4)'
  },
  epic: {
    name: '史诗',
    color: '#A267FF',
    bgColor: 'rgba(162, 103, 255, 0.1)',
    glow: 'rgba(162, 103, 255, 0.5)',
    borderColor: 'rgba(162, 103, 255, 0.5)'
  },
  legendary: {
    name: '传说',
    color: '#FFD700',
    bgColor: 'rgba(255, 215, 0, 0.1)',
    glow: 'rgba(255, 215, 0, 0.5)',
    borderColor: 'rgba(255, 215, 0, 0.5)'
  }
};

interface FragmentCardProps {
  fragment: Fragment;
  size?: 'sm' | 'md' | 'lg';
  onClick?: (fragment: Fragment) => void;
  showCount?: boolean;
}

export const FragmentCard: React.FC<FragmentCardProps> = ({
  fragment,
  size = 'md',
  onClick,
  showCount = true
}) => {
  const config = RARITY_CONFIG[fragment.rarity];
  const isLocked = !fragment.collected || fragment.count === 0;

  const sizes = {
    sm: { card: 80, icon: 32, font: 10 },
    md: { card: 120, icon: 48, font: 12 },
    lg: { card: 160, icon: 64, font: 14 }
  };

  const s = sizes[size];

  // Motion Values for 3D Tilt
  const x = useMotionValue(0);
  const y = useMotionValue(0);

  const mouseX = useSpring(x, { stiffness: 500, damping: 30 });
  const mouseY = useSpring(y, { stiffness: 500, damping: 30 });

  const rotateX = useTransform(mouseY, [-0.5, 0.5], ["15deg", "-15deg"]);
  const rotateY = useTransform(mouseX, [-0.5, 0.5], ["-15deg", "15deg"]);
  const glareX = useTransform(mouseX, [-0.5, 0.5], ["0%", "100%"]);
  const glareY = useTransform(mouseY, [-0.5, 0.5], ["0%", "100%"]);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (isLocked) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const width = rect.width;
    const height = rect.height;
    const mouseXVal = e.clientX - rect.left;
    const mouseYVal = e.clientY - rect.top;
    const xPct = mouseXVal / width - 0.5;
    const yPct = mouseYVal / height - 0.5;
    x.set(xPct);
    y.set(yPct);
  };

  const handleMouseLeave = () => {
    x.set(0);
    y.set(0);
  };

  return (
    <motion.div
      className={`fragment-card ${fragment.rarity} ${isLocked ? 'locked' : ''}`}
      onClick={() => !isLocked && onClick?.(fragment)}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      style={{
        '--rarity-color': config.color,
        '--rarity-bg': config.bgColor,
        '--rarity-glow': config.glow,
        '--rarity-border': config.borderColor,
        width: s.card,
        height: s.card + 30,
        rotateX: isLocked ? 0 : rotateX,
        rotateY: isLocked ? 0 : rotateY,
        transformStyle: "preserve-3d",
        perspective: 1000,
      } as any}
      whileHover={!isLocked ? { scale: 1.05 } : {}}
      whileTap={!isLocked ? { scale: 0.95 } : {}}
    >
      <div className="fragment-icon-wrapper" style={{ transform: "translateZ(20px)" }}>
        {isLocked ? (
          <div className="locked-overlay">
            <Lock size={s.icon * 0.5} />
          </div>
        ) : (
          <>
            {fragment.icon ? (
              <span className="fragment-emoji" style={{ fontSize: s.icon }}>{fragment.icon}</span>
            ) : fragment.imageUrl ? (
              <img src={fragment.imageUrl} alt={fragment.name} className="fragment-image" />
            ) : (
              <Sparkles size={s.icon} />
            )}
          </>
        )}

        {/* 稀有度光芒 */}
        {!isLocked && (fragment.rarity === 'epic' || fragment.rarity === 'legendary') && (
          <div className="rarity-glow" />
        )}
      </div>

      <div className="fragment-info" style={{ transform: "translateZ(10px)" }}>
        <span className="fragment-name" style={{ fontSize: s.font }}>{fragment.name}</span>
        {showCount && (
          <span className="fragment-count">
            {fragment.count}/{fragment.maxCount}
          </span>
        )}
      </div>

      {/* 稀有度标签 */}
      <span className="rarity-badge" style={{ transform: "translateZ(15px)" }}>{config.name}</span>

      {/* Glare Effect */}
      {!isLocked && (
        <motion.div
          className="card-glare"
          style={{
            position: 'absolute',
            top: 0, left: 0, right: 0, bottom: 0,
            background: `radial-gradient(circle at ${glareX} ${glareY}, rgba(255,255,255,0.3) 0%, transparent 80%)`,
            opacity: 0, // Default hidden, show on hover (can use CSS or motion state)
            zIndex: 10,
            pointerEvents: "none"
          }}
          whileHover={{ opacity: 1 }}
        />
      )}

      <style>{`
        .fragment-card {
            display: flex;
            flex-direction: column;
            align-items: center;
            background: var(--rarity-bg);
            border: 1px solid var(--rarity-border);
            border-radius: 12px;
            padding: 12px 8px 8px;
            cursor: pointer;
            /* transition removed for motion control */
            position: relative;
            /* overflow: hidden; Removed to allow 3D popping out */
        }
        
        .fragment-card:hover:not(.locked) {
            border-color: var(--rarity-color);
            box-shadow: 0 8px 25px var(--rarity-glow);
        }

        .fragment-card.locked {
            opacity: 0.5;
            cursor: not-allowed;
            filter: grayscale(0.8);
        }

        .fragment-icon-wrapper {
            position: relative;
            display: flex;
            align-items: center;
            justify-content: center;
            flex: 1;
        }

        .fragment-emoji {
            line-height: 1;
        }

        .fragment-image {
            width: 100%;
            height: 100%;
            object-fit: contain;
            border-radius: 8px;
        }

        .locked-overlay {
            display: flex;
            align-items: center;
            justify-content: center;
            color: var(--text-muted);
        }

        .rarity-glow {
            position: absolute;
            inset: -10px;
            background: radial-gradient(circle, var(--rarity-glow) 0%, transparent 70%);
            animation: pulse 2s ease-in-out infinite;
            pointer-events: none;
        }

        .fragment-info {
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 2px;
            margin-top: 6px;
        }

        .fragment-name {
            color: var(--text-primary);
            font-weight: 500;
            text-align: center;
            line-height: 1.2;
        }

        .fragment-count {
            font-size: 10px;
            color: var(--rarity-color);
            font-weight: 600;
        }

        .rarity-badge {
            position: absolute;
            top: 4px;
            right: 4px;
            font-size: 9px;
            padding: 2px 6px;
            background: var(--rarity-color);
            color: #000;
            border-radius: 4px;
            font-weight: 600;
        }

        .fragment-card.legendary .rarity-badge {
            animation: glow-border 2s ease-in-out infinite;
        }

        @keyframes pulse {
            0%, 100% { opacity: 0.5; }
            50% { opacity: 1; }
        }
    `}</style>
    </motion.div>
  );
};

export default FragmentCard;
