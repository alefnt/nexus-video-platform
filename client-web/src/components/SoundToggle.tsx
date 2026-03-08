/**
 * 🔊 Sound Toggle Component
 * 音效开关控件，可放置在设置或导航中
 */

import React from 'react';
import { Volume2, VolumeX } from 'lucide-react';
import { useSound } from '../hooks/useSound';

interface SoundToggleProps {
    showLabel?: boolean;
    size?: 'sm' | 'md' | 'lg';
    className?: string;
}

export const SoundToggle: React.FC<SoundToggleProps> = ({
    showLabel = false,
    size = 'md',
    className = ''
}) => {
    const { enabled, toggle, play } = useSound();

    const handleClick = () => {
        toggle();
        // 如果开启，播放一个确认音效
        if (!enabled) {
            setTimeout(() => play('click'), 50);
        }
    };

    const sizes = {
        sm: { icon: 16, padding: '6px' },
        md: { icon: 20, padding: '8px' },
        lg: { icon: 24, padding: '10px' }
    };

    const { icon: iconSize, padding } = sizes[size];

    return (
        <>
            <button
                onClick={handleClick}
                className={`sound-toggle ${enabled ? 'enabled' : 'disabled'} ${className}`}
                title={enabled ? '关闭音效' : '开启音效'}
                aria-label={enabled ? '关闭音效' : '开启音效'}
                style={{ padding }}
            >
                {enabled ? (
                    <Volume2 size={iconSize} />
                ) : (
                    <VolumeX size={iconSize} />
                )}
                {showLabel && (
                    <span className="sound-toggle-label">
                        {enabled ? '音效开' : '音效关'}
                    </span>
                )}
            </button>

            <style>{`
        .sound-toggle {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 8px;
          color: var(--text-secondary);
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .sound-toggle:hover {
          background: rgba(255, 255, 255, 0.1);
          border-color: rgba(255, 255, 255, 0.2);
          color: var(--text-primary);
        }

        .sound-toggle.enabled {
          color: var(--neon-cyan);
          border-color: rgba(0, 255, 255, 0.3);
        }

        .sound-toggle.enabled:hover {
          background: rgba(0, 255, 255, 0.1);
          box-shadow: 0 0 10px rgba(0, 255, 255, 0.2);
        }

        .sound-toggle.disabled {
          opacity: 0.7;
        }

        .sound-toggle:active {
          transform: scale(0.95);
        }

        .sound-toggle-label {
          font-size: 12px;
          font-weight: 500;
        }

        @media (prefers-reduced-motion: reduce) {
          .sound-toggle {
            transition: none;
          }
        }
      `}</style>
        </>
    );
};

export default SoundToggle;
