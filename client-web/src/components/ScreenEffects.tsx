/**
 * ❄️ 全屏特效组件
 * Screen Effects - 雪花/烟花/爱心粒子效果
 */

import React, { useEffect, useRef, useState, useCallback, useImperativeHandle, forwardRef } from 'react';

export type EffectType = 'snow' | 'firework' | 'hearts' | 'stars' | 'confetti' | 'gold';

export interface ScreenEffectsRef {
    trigger: (effect: EffectType) => void;
}

interface Particle {
    id: number;
    x: number;
    y: number;
    vx: number;
    vy: number;
    size: number;
    opacity: number;
    color: string;
    rotation: number;
    rotationSpeed: number;
    life: number;
    maxLife: number;
}

interface ScreenEffectsProps {
    effect?: EffectType | null;
    duration?: number; // ms, 0 = infinite
    intensity?: 'low' | 'medium' | 'high';
    onComplete?: () => void;
}

const EFFECT_CONFIGS: Record<EffectType, {
    particleCount: { low: number; medium: number; high: number };
    colors: string[];
    createParticle: (width: number, height: number, colors: string[]) => Partial<Particle>;
    updateParticle: (p: Particle, width: number, height: number) => Particle;
}> = {
    snow: {
        particleCount: { low: 30, medium: 60, high: 100 },
        colors: ['#fff', '#e0e0ff', '#c0c0ff'],
        createParticle: (w, h, colors) => ({
            x: Math.random() * w,
            y: -10,
            vx: (Math.random() - 0.5) * 1,
            vy: 1 + Math.random() * 2,
            size: 3 + Math.random() * 5,
            color: colors[Math.floor(Math.random() * colors.length)],
            rotation: 0,
            rotationSpeed: (Math.random() - 0.5) * 2,
            opacity: 0.6 + Math.random() * 0.4,
            life: 0,
            maxLife: -1 // 无限
        }),
        updateParticle: (p, w, h) => {
            p.x += p.vx + Math.sin(p.y * 0.02) * 0.5;
            p.y += p.vy;
            p.rotation += p.rotationSpeed;
            if (p.y > h + 10) {
                p.y = -10;
                p.x = Math.random() * w;
            }
            return p;
        }
    },
    firework: {
        particleCount: { low: 50, medium: 100, high: 200 },
        colors: ['#ff0', '#f0f', '#0ff', '#f00', '#0f0', '#00f', '#ff6600'],
        createParticle: (w, h, colors) => {
            const centerX = w / 2 + (Math.random() - 0.5) * w * 0.6;
            const centerY = h / 2 + (Math.random() - 0.5) * h * 0.4;
            const angle = Math.random() * Math.PI * 2;
            const speed = 2 + Math.random() * 6;
            return {
                x: centerX,
                y: centerY,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                size: 2 + Math.random() * 4,
                color: colors[Math.floor(Math.random() * colors.length)],
                rotation: 0,
                rotationSpeed: 0,
                opacity: 1,
                life: 0,
                maxLife: 60 + Math.random() * 40
            };
        },
        updateParticle: (p, w, h) => {
            p.x += p.vx;
            p.y += p.vy;
            p.vy += 0.05; // 重力
            p.vx *= 0.98;
            p.vy *= 0.98;
            p.life++;
            p.opacity = Math.max(0, 1 - p.life / p.maxLife);
            return p;
        }
    },
    hearts: {
        particleCount: { low: 15, medium: 30, high: 50 },
        colors: ['#ff2e93', '#ff6b9d', '#ff9ec4', '#ffb6c1'],
        createParticle: (w, h, colors) => ({
            x: Math.random() * w,
            y: h + 20,
            vx: (Math.random() - 0.5) * 2,
            vy: -(2 + Math.random() * 3),
            size: 15 + Math.random() * 15,
            color: colors[Math.floor(Math.random() * colors.length)],
            rotation: Math.random() * 30 - 15,
            rotationSpeed: (Math.random() - 0.5) * 3,
            opacity: 0.8 + Math.random() * 0.2,
            life: 0,
            maxLife: 150
        }),
        updateParticle: (p, w, h) => {
            p.x += p.vx + Math.sin(p.life * 0.1) * 0.5;
            p.y += p.vy;
            p.vy += 0.02; // 轻微重力
            p.rotation += p.rotationSpeed;
            p.life++;
            if (p.life > p.maxLife * 0.7) {
                p.opacity = Math.max(0, 1 - (p.life - p.maxLife * 0.7) / (p.maxLife * 0.3));
            }
            return p;
        }
    },
    stars: {
        particleCount: { low: 20, medium: 40, high: 80 },
        colors: ['#ffd700', '#fff', '#00f5d4'],
        createParticle: (w, h, colors) => ({
            x: Math.random() * w,
            y: Math.random() * h,
            vx: 0,
            vy: 0,
            size: 3 + Math.random() * 8,
            color: colors[Math.floor(Math.random() * colors.length)],
            rotation: Math.random() * 360,
            rotationSpeed: 2 + Math.random() * 3,
            opacity: 0,
            life: Math.random() * 60,
            maxLife: 120
        }),
        updateParticle: (p, w, h) => {
            p.rotation += p.rotationSpeed;
            p.life++;
            // 闪烁效果
            p.opacity = Math.abs(Math.sin(p.life * 0.1)) * 0.8 + 0.2;
            if (p.life > p.maxLife) {
                p.life = 0;
                p.x = Math.random() * w;
                p.y = Math.random() * h;
            }
            return p;
        }
    },
    confetti: {
        particleCount: { low: 40, medium: 80, high: 150 },
        colors: ['#ff0', '#f0f', '#0ff', '#f00', '#0f0', '#00f', '#ff6600', '#a267ff'],
        createParticle: (w, h, colors) => ({
            x: Math.random() * w,
            y: -20,
            vx: (Math.random() - 0.5) * 4,
            vy: 2 + Math.random() * 4,
            size: 8 + Math.random() * 8,
            color: colors[Math.floor(Math.random() * colors.length)],
            rotation: Math.random() * 360,
            rotationSpeed: 5 + Math.random() * 10,
            opacity: 1,
            life: 0,
            maxLife: -1
        }),
        updateParticle: (p, w, h) => {
            p.x += p.vx + Math.sin(p.y * 0.05) * 0.5;
            p.y += p.vy;
            p.rotation += p.rotationSpeed;
            p.vx *= 0.99;
            if (p.y > h + 20) {
                p.y = -20;
                p.x = Math.random() * w;
            }
            return p;
        }
    },
    gold: {
        particleCount: { low: 20, medium: 40, high: 60 },
        colors: ['#ffd700', '#ffb700', '#ff9500', '#fff8dc'],
        createParticle: (w, h, colors) => ({
            x: Math.random() * w,
            y: -10,
            vx: (Math.random() - 0.5) * 3,
            vy: 3 + Math.random() * 2,
            size: 15 + Math.random() * 10,
            color: colors[Math.floor(Math.random() * colors.length)],
            rotation: Math.random() * 360,
            rotationSpeed: 3 + Math.random() * 5,
            opacity: 1,
            life: 0,
            maxLife: -1
        }),
        updateParticle: (p, w, h) => {
            p.x += p.vx;
            p.y += p.vy;
            p.rotation += p.rotationSpeed;
            if (p.y > h + 20) {
                p.y = -10;
                p.x = Math.random() * w;
            }
            return p;
        }
    }
};

export const ScreenEffects = forwardRef<ScreenEffectsRef, ScreenEffectsProps>(({
    effect: propEffect,
    duration = 5000,
    intensity = 'medium',
    onComplete
}, ref) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const particlesRef = useRef<Particle[]>([]);
    const animationRef = useRef<number | null>(null);
    const startTimeRef = useRef<number>(0);
    const [activeEffect, setActiveEffect] = useState<EffectType | null>(null);
    const [isActive, setIsActive] = useState(false);

    // Determines the current effect to show: imperative trigger > prop
    const currentEffect = activeEffect || propEffect;

    useImperativeHandle(ref, () => ({
        trigger: (effect: EffectType) => {
            setActiveEffect(effect);
            // Reset active state to restart animation if needed
            setIsActive(false);
            setTimeout(() => {
                startTimeRef.current = Date.now();
                setIsActive(true);
            }, 0);
        }
    }));

    const renderParticle = useCallback((ctx: CanvasRenderingContext2D, p: Particle, effectType: EffectType) => {
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate((p.rotation * Math.PI) / 180);
        ctx.globalAlpha = p.opacity;

        if (effectType === 'hearts') {
            // 绘制爱心
            ctx.fillStyle = p.color;
            ctx.beginPath();
            const s = p.size / 10;
            ctx.moveTo(0, s * 3);
            ctx.bezierCurveTo(-s * 5, -s * 2, -s * 2, -s * 6, 0, -s * 2);
            ctx.bezierCurveTo(s * 2, -s * 6, s * 5, -s * 2, 0, s * 3);
            ctx.fill();
        } else if (effectType === 'stars') {
            // 绘制星星
            ctx.fillStyle = p.color;
            ctx.beginPath();
            const spikes = 5;
            const outerRadius = p.size;
            const innerRadius = p.size / 2;
            for (let i = 0; i < spikes * 2; i++) {
                const radius = i % 2 === 0 ? outerRadius : innerRadius;
                const angle = (i * Math.PI) / spikes - Math.PI / 2;
                const x = Math.cos(angle) * radius;
                const y = Math.sin(angle) * radius;
                if (i === 0) ctx.moveTo(x, y);
                else ctx.lineTo(x, y);
            }
            ctx.closePath();
            ctx.fill();
        } else if (effectType === 'gold') {
            // 绘制金币
            ctx.fillStyle = p.color;
            ctx.strokeStyle = '#8B6914';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.ellipse(0, 0, p.size / 2, p.size / 2 * Math.abs(Math.cos(p.rotation * 0.05)), 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();
            // 金币图案
            ctx.fillStyle = '#8B6914';
            ctx.font = `${p.size * 0.5}px Arial`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('$', 0, 0);
        } else if (effectType === 'confetti') {
            // 绘制纸屑
            ctx.fillStyle = p.color;
            ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
        } else {
            // 绘制圆形（雪花、烟花）
            ctx.fillStyle = p.color;
            ctx.beginPath();
            ctx.arc(0, 0, p.size / 2, 0, Math.PI * 2);
            ctx.fill();

            if (effectType === 'snow') {
                // 雪花光晕
                ctx.shadowColor = '#fff';
                ctx.shadowBlur = 5;
            }
        }

        ctx.restore();
    }, []);

    useEffect(() => {
        if (!currentEffect) {
            setIsActive(false);
            if (animationRef.current) {
                cancelAnimationFrame(animationRef.current);
            }
            return;
        }

        const canvas = canvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        // 设置画布大小
        const resize = () => {
            canvas.width = window.innerWidth;
            canvas.height = window.innerHeight;
        };
        resize();
        window.addEventListener('resize', resize);

        // 初始化粒子
        const config = EFFECT_CONFIGS[currentEffect];
        // Safety check if effect name is typo
        if (!config) return;

        const particleCount = config.particleCount[intensity];
        particlesRef.current = [];

        for (let i = 0; i < particleCount; i++) {
            particlesRef.current.push({
                id: i,
                ...config.createParticle(canvas.width, canvas.height, config.colors)
            } as Particle);
        }

        if (!isActive) {
            startTimeRef.current = Date.now();
            setIsActive(true);
        }

        // 动画循环
        const animate = () => {
            if (!canvas || !ctx) return;

            ctx.clearRect(0, 0, canvas.width, canvas.height);

            // 更新和渲染粒子
            particlesRef.current = particlesRef.current.map(p =>
                config.updateParticle(p, canvas.width, canvas.height)
            ).filter(p => p.maxLife < 0 || p.life < p.maxLife);

            // 烟花效果需要持续生成新粒子
            if (currentEffect === 'firework' && particlesRef.current.length < particleCount / 2) {
                for (let i = 0; i < 10; i++) {
                    particlesRef.current.push({
                        id: Date.now() + i,
                        ...config.createParticle(canvas.width, canvas.height, config.colors)
                    } as Particle);
                }
            }

            particlesRef.current.forEach(p => renderParticle(ctx, p, currentEffect));

            // 检查持续时间
            if (duration > 0 && Date.now() - startTimeRef.current > duration) {
                setIsActive(false);
                setActiveEffect(null); // Clear active effect
                onComplete?.();
                return;
            }

            animationRef.current = requestAnimationFrame(animate);
        };

        animate();

        return () => {
            window.removeEventListener('resize', resize);
            if (animationRef.current) {
                cancelAnimationFrame(animationRef.current);
            }
        };
    }, [currentEffect, duration, intensity, onComplete, renderParticle, isActive]);

    if (!currentEffect || !isActive) return null;

    return (
        <canvas
            ref={canvasRef}
            style={{
                position: 'fixed',
                inset: 0,
                pointerEvents: 'none',
                zIndex: 9999,
            }}
        />
    );
});
ScreenEffects.displayName = 'ScreenEffects';

// 便捷触发函数
let globalEffectSetter: ((effect: EffectType | null) => void) | null = null;

export function registerEffectSetter(setter: (effect: EffectType | null) => void) {
    globalEffectSetter = setter;
}

export function triggerEffect(effect: EffectType, duration = 5000) {
    if (globalEffectSetter) {
        globalEffectSetter(effect);
        if (duration > 0) {
            setTimeout(() => globalEffectSetter?.(null), duration);
        }
    }
}

export default ScreenEffects;
