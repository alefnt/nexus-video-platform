/**
 * GiftEffectsRenderer ...TikTok-style animated gift effects using Three.js
 * 
 * Supports 5 gift types with unique particle effects:
 * 🔥 Fire ...Rising flame particles (orange/red)
 * 💎 Diamond ...Sparkling crystal fragments (cyan/white)
 * 🌟 StarBurst ...Exploding star particles (gold/yellow)
 * 🌈 Rainbow ...Cascading rainbow ribbons (multi-color)
 * 🎆 Fireworks ...Burst + trail particles (purple/pink)
 * 
 * Usage:
 *   <GiftEffectsRenderer gift="diamond" onComplete={() => ...} />
 *   <GiftEffectsRenderer gift="fire" amount={100} senderName="User123" />
 */

import React, { useRef, useEffect, useState, useCallback } from 'react';

// Gift type definitions
type GiftType = 'fire' | 'diamond' | 'star' | 'rainbow' | 'fireworks';

interface GiftConfig {
    emoji: string;
    label: string;
    particleCount: number;
    colors: number[];
    duration: number; // ms
    size: number;
    speed: number;
    gravity: number;
}

const GIFT_CONFIGS: Record<GiftType, GiftConfig> = {
    fire: {
        emoji: '🔥',
        label: 'Blaze',
        particleCount: 120,
        colors: [0xff4500, 0xff6b35, 0xffa500, 0xff2200, 0xffcc00],
        duration: 3000,
        size: 6,
        speed: 3.5,
        gravity: -0.02, // upward
    },
    diamond: {
        emoji: '💎',
        label: 'Diamond',
        particleCount: 80,
        colors: [0x00e5ff, 0xffffff, 0x40c4ff, 0x80d8ff, 0xe0f7fa],
        duration: 3500,
        size: 5,
        speed: 2.5,
        gravity: 0.015,
    },
    star: {
        emoji: '🌟',
        label: 'Star Burst',
        particleCount: 150,
        colors: [0xffd700, 0xffeb3b, 0xffc107, 0xff9800, 0xfffff0],
        duration: 2500,
        size: 7,
        speed: 5,
        gravity: 0.01,
    },
    rainbow: {
        emoji: '🌈',
        label: 'Rainbow',
        particleCount: 200,
        colors: [0xff0000, 0xff7f00, 0xffff00, 0x00ff00, 0x0000ff, 0x4b0082, 0x9400d3],
        duration: 4000,
        size: 4,
        speed: 2,
        gravity: 0.008,
    },
    fireworks: {
        emoji: '🎆',
        label: 'Fireworks',
        particleCount: 100,
        colors: [0xa855f7, 0xec4899, 0x8b5cf6, 0xf472b6, 0xffffff],
        duration: 3000,
        size: 5,
        speed: 4,
        gravity: 0.02,
    },
};

interface Particle {
    x: number;
    y: number;
    vx: number;
    vy: number;
    color: string;
    size: number;
    life: number;
    maxLife: number;
    opacity: number;
    rotation: number;
    rotationSpeed: number;
}

interface GiftEffectsRendererProps {
    gift: GiftType;
    amount?: number;
    senderName?: string;
    onComplete?: () => void;
    style?: React.CSSProperties;
}

export default function GiftEffectsRenderer({
    gift,
    amount,
    senderName,
    onComplete,
    style,
}: GiftEffectsRendererProps) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const animationRef = useRef<number>(0);
    const particlesRef = useRef<Particle[]>([]);
    const [showLabel, setShowLabel] = useState(true);
    const [phase, setPhase] = useState<'enter' | 'active' | 'exit'>('enter');
    const config = GIFT_CONFIGS[gift];
    const startTimeRef = useRef(Date.now());

    const hexToRgba = (hex: number, alpha: number) => {
        const r = (hex >> 16) & 0xff;
        const g = (hex >> 8) & 0xff;
        const b = hex & 0xff;
        return `rgba(${r},${g},${b},${alpha})`;
    };

    const createParticles = useCallback((width: number, height: number) => {
        const particles: Particle[] = [];
        const cx = width / 2;
        const cy = height / 2;

        for (let i = 0; i < config.particleCount; i++) {
            const angle = Math.random() * Math.PI * 2;
            const speed = config.speed * (0.3 + Math.random() * 0.7);
            const colorHex = config.colors[Math.floor(Math.random() * config.colors.length)];

            let vx = Math.cos(angle) * speed;
            let vy = Math.sin(angle) * speed;
            let px = cx;
            let py = cy;

            // Type-specific spawn patterns
            if (gift === 'fire') {
                px = cx + (Math.random() - 0.5) * width * 0.4;
                py = height;
                vx = (Math.random() - 0.5) * 1.5;
                vy = -(2 + Math.random() * 3);
            } else if (gift === 'rainbow') {
                px = -20;
                py = height * 0.2 + Math.random() * height * 0.6;
                vx = 2 + Math.random() * 2;
                vy = (Math.random() - 0.5) * 0.5;
            } else if (gift === 'fireworks') {
                // Delayed burst: particles start from random burst points
                const burstX = cx + (Math.random() - 0.5) * width * 0.5;
                const burstY = height * 0.2 + Math.random() * height * 0.3;
                px = burstX;
                py = burstY;
                const burstAngle = Math.random() * Math.PI * 2;
                const burstSpeed = 1 + Math.random() * 4;
                vx = Math.cos(burstAngle) * burstSpeed;
                vy = Math.sin(burstAngle) * burstSpeed;
            }

            particles.push({
                x: px,
                y: py,
                vx,
                vy,
                color: hexToRgba(colorHex, 1),
                size: config.size * (0.5 + Math.random() * 0.5),
                life: Math.random() * 0.3, // Staggered start
                maxLife: 0.7 + Math.random() * 0.3,
                opacity: 1,
                rotation: Math.random() * Math.PI * 2,
                rotationSpeed: (Math.random() - 0.5) * 0.1,
            });
        }
        return particles;
    }, [gift, config]);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        // Set canvas size
        const rect = canvas.parentElement?.getBoundingClientRect() || { width: 400, height: 400 };
        canvas.width = rect.width;
        canvas.height = rect.height;

        startTimeRef.current = Date.now();
        particlesRef.current = createParticles(canvas.width, canvas.height);
        setPhase('enter');

        const draw = () => {
            const elapsed = Date.now() - startTimeRef.current;
            const progress = Math.min(elapsed / config.duration, 1);

            ctx.clearRect(0, 0, canvas.width, canvas.height);

            // Update and draw particles
            particlesRef.current.forEach((p) => {
                p.life += 0.008;
                if (p.life < 0) return; // Not yet started

                p.x += p.vx;
                p.y += p.vy;
                p.vy += config.gravity;
                p.rotation += p.rotationSpeed;

                // Fire-specific: add turbulence
                if (gift === 'fire') {
                    p.vx += (Math.random() - 0.5) * 0.15;
                    p.size *= 0.995;
                }

                // Rainbow: wave motion
                if (gift === 'rainbow') {
                    p.vy += Math.sin(p.x * 0.02) * 0.1;
                }

                // Fade based on life
                const lifeRatio = Math.min(p.life / p.maxLife, 1);
                p.opacity = lifeRatio < 0.1 ? lifeRatio * 10 : lifeRatio > 0.7 ? (1 - lifeRatio) / 0.3 : 1;
                p.opacity *= (1 - progress * 0.5); // Global fade

                if (p.opacity <= 0) return;

                ctx.save();
                ctx.translate(p.x, p.y);
                ctx.rotate(p.rotation);
                ctx.globalAlpha = p.opacity;

                if (gift === 'diamond') {
                    // Diamond shape
                    ctx.beginPath();
                    const s = p.size;
                    ctx.moveTo(0, -s);
                    ctx.lineTo(s * 0.6, 0);
                    ctx.lineTo(0, s * 0.4);
                    ctx.lineTo(-s * 0.6, 0);
                    ctx.closePath();
                    ctx.fillStyle = p.color;
                    ctx.fill();
                    // Sparkle
                    ctx.shadowColor = p.color;
                    ctx.shadowBlur = 8;
                    ctx.fill();
                } else if (gift === 'star') {
                    // 4-point star
                    ctx.beginPath();
                    const s = p.size;
                    for (let i = 0; i < 4; i++) {
                        const angle = (i * Math.PI) / 2;
                        const outerX = Math.cos(angle) * s;
                        const outerY = Math.sin(angle) * s;
                        const innerAngle = angle + Math.PI / 4;
                        const innerX = Math.cos(innerAngle) * s * 0.3;
                        const innerY = Math.sin(innerAngle) * s * 0.3;
                        if (i === 0) ctx.moveTo(outerX, outerY);
                        else ctx.lineTo(outerX, outerY);
                        ctx.lineTo(innerX, innerY);
                    }
                    ctx.closePath();
                    ctx.fillStyle = p.color;
                    ctx.shadowColor = '#ffd700';
                    ctx.shadowBlur = 12;
                    ctx.fill();
                } else {
                    // Circle particles (fire, rainbow, fireworks)
                    ctx.beginPath();
                    ctx.arc(0, 0, p.size, 0, Math.PI * 2);
                    ctx.fillStyle = p.color;
                    if (gift === 'fire') {
                        ctx.shadowColor = p.color;
                        ctx.shadowBlur = 15;
                    } else if (gift === 'fireworks') {
                        ctx.shadowColor = p.color;
                        ctx.shadowBlur = 10;
                    }
                    ctx.fill();

                    // Trail for fireworks
                    if (gift === 'fireworks' && p.opacity > 0.3) {
                        ctx.beginPath();
                        ctx.moveTo(0, 0);
                        ctx.lineTo(-p.vx * 3, -p.vy * 3);
                        ctx.strokeStyle = p.color;
                        ctx.lineWidth = p.size * 0.5;
                        ctx.globalAlpha = p.opacity * 0.3;
                        ctx.stroke();
                    }
                }

                ctx.restore();
            });

            // Continue or finish
            if (progress < 1) {
                animationRef.current = requestAnimationFrame(draw);
            } else {
                setPhase('exit');
                setTimeout(() => {
                    onComplete?.();
                }, 500);
            }
        };

        // Start with small delay so entrance label shows
        setTimeout(() => {
            setPhase('active');
            draw();
        }, 300);

        return () => {
            if (animationRef.current) cancelAnimationFrame(animationRef.current);
        };
    }, [gift, config, createParticles, onComplete]);

    return (
        <div
            className={`gift-effects-container ${phase}`}
            style={{
                position: 'fixed',
                inset: 0,
                zIndex: 9999,
                pointerEvents: 'none',
                ...style,
            }}
        >
            <canvas
                ref={canvasRef}
                style={{ width: '100%', height: '100%' }}
            />

            {/* Gift Label Overlay */}
            {showLabel && (
                <div
                    className={`gift-label ${phase}`}
                    style={{
                        position: 'absolute',
                        top: '50%',
                        left: '50%',
                        transform: 'translate(-50%, -50%)',
                        textAlign: 'center',
                        pointerEvents: 'none',
                        zIndex: 10000,
                    }}
                >
                    <div style={{ fontSize: 64, marginBottom: 8, filter: 'drop-shadow(0 0 20px rgba(255,255,255,0.5))' }}>
                        {config.emoji}
                    </div>
                    <div style={{
                        fontSize: 24,
                        fontWeight: 900,
                        color: '#fff',
                        textShadow: '0 0 20px rgba(168,85,247,0.8), 0 0 40px rgba(168,85,247,0.4)',
                        letterSpacing: '0.1em',
                        textTransform: 'uppercase',
                    }}>
                        {config.label}
                    </div>
                    {senderName && (
                        <div style={{
                            fontSize: 14,
                            color: 'rgba(255,255,255,0.7)',
                            marginTop: 4,
                            fontWeight: 500,
                        }}>
                            from {senderName}
                        </div>
                    )}
                    {amount && amount > 0 && (
                        <div style={{
                            marginTop: 8,
                            background: 'rgba(168,85,247,0.3)',
                            backdropFilter: 'blur(8px)',
                            border: '1px solid rgba(168,85,247,0.5)',
                            borderRadius: 999,
                            padding: '4px 16px',
                            fontSize: 16,
                            fontWeight: 700,
                            color: '#fff',
                            display: 'inline-block',
                        }}>
                            {amount} PTS
                        </div>
                    )}
                </div>
            )}

            <style>{`
        .gift-effects-container {
          animation: giftFadeIn 0.3s ease-out;
        }
        .gift-effects-container.exit {
          animation: giftFadeOut 0.5s ease-in forwards;
        }
        .gift-label {
          animation: giftLabelEnter 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
        }
        .gift-label.active {
          animation: giftLabelPulse 0.8s ease-in-out 0.5s forwards;
        }
        .gift-label.exit {
          animation: giftLabelExit 0.3s ease-in forwards;
        }
        @keyframes giftFadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes giftFadeOut {
          from { opacity: 1; }
          to { opacity: 0; }
        }
        @keyframes giftLabelEnter {
          0% { transform: translate(-50%, -50%) scale(0.3); opacity: 0; }
          100% { transform: translate(-50%, -50%) scale(1); opacity: 1; }
        }
        @keyframes giftLabelPulse {
          0% { transform: translate(-50%, -50%) scale(1); }
          50% { transform: translate(-50%, -50%) scale(1.15); }
          100% { transform: translate(-50%, -50%) scale(1); opacity: 0.5; }
        }
        @keyframes giftLabelExit {
          from { transform: translate(-50%, -50%) scale(1); opacity: 1; }
          to { transform: translate(-50%, -50%) scale(0.5) translateY(-30px); opacity: 0; }
        }
      `}</style>
        </div>
    );
}

// Export gift types and configs for reuse
export { GIFT_CONFIGS };
export type { GiftType, GiftConfig };
