// FILE: /video-platform/client-web/src/components/ParticleBackground.tsx
/**
 * Nexus Video - 粒子背景动画 (优化版)
 * 
 * 用于 Onboarding/Login 页面
 * 效果：深空黑背景 + 粒子连线 + 鼠标交互
 * 
 * 优化（借鉴 Fitting Pad 的 rAF 最佳实践）：
 *  - 空间网格哈希：连线计算从 O(n²) 降到 O(n)
 *  - 速度阻尼：粒子运动更有机感
 *  - Alpha 呼吸脉冲：粒子有"活"的感觉
 *  - 设备像素比适配：高分屏更清晰
 */

import React, { useEffect, useRef } from "react";

interface Particle {
    x: number;
    y: number;
    vx: number;
    vy: number;
    size: number;
    color: string;
    baseAlpha: number;
    alpha: number;
    phase: number; // 呼吸相位
}

interface ParticleBackgroundProps {
    particleCount?: number;
    colors?: string[];
    connectionDistance?: number;
}

const DEFAULT_COLORS = [
    "rgba(162, 103, 255, 0.8)", // 电光紫
    "rgba(0, 245, 212, 0.8)",   // 能量青
    "rgba(255, 107, 157, 0.6)", // 霓虹粉
];

const CELL_SIZE = 130; // 空间网格单元大小
const DAMPING = 0.998; // 速度阻尼系数

export function ParticleBackground({
    particleCount = 80,
    colors = DEFAULT_COLORS,
    connectionDistance = 120,
}: ParticleBackgroundProps) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const animationRef = useRef<number>();
    const particlesRef = useRef<Particle[]>([]);
    const mouseRef = useRef({ x: 0, y: 0 });

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        // 高分屏适配
        const dpr = window.devicePixelRatio || 1;

        const resize = () => {
            canvas.width = window.innerWidth * dpr;
            canvas.height = window.innerHeight * dpr;
            canvas.style.width = `${window.innerWidth}px`;
            canvas.style.height = `${window.innerHeight}px`;
            ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        };
        resize();
        window.addEventListener("resize", resize);

        // 初始化粒子
        const createParticle = (): Particle => ({
            x: Math.random() * window.innerWidth,
            y: Math.random() * window.innerHeight,
            vx: (Math.random() - 0.5) * 0.5,
            vy: (Math.random() - 0.5) * 0.5,
            size: Math.random() * 3 + 1,
            color: colors[Math.floor(Math.random() * colors.length)],
            baseAlpha: Math.random() * 0.5 + 0.3,
            alpha: 0,
            phase: Math.random() * Math.PI * 2,
        });

        particlesRef.current = Array(particleCount).fill(null).map(createParticle);

        // 鼠标跟踪
        const handleMouseMove = (e: MouseEvent) => {
            mouseRef.current = { x: e.clientX, y: e.clientY };
        };
        window.addEventListener("mousemove", handleMouseMove);

        // 空间网格：避免 O(n²) 连线检查
        const buildGrid = (particles: Particle[], w: number) => {
            const cols = Math.ceil(w / CELL_SIZE) + 1;
            const grid = new Map<number, Particle[]>();

            for (const p of particles) {
                const cx = Math.floor(p.x / CELL_SIZE);
                const cy = Math.floor(p.y / CELL_SIZE);
                const key = cy * cols + cx;
                const cell = grid.get(key);
                if (cell) cell.push(p);
                else grid.set(key, [p]);
            }

            return { grid, cols };
        };

        const getNeighbors = (
            p: Particle,
            grid: Map<number, Particle[]>,
            cols: number,
        ): Particle[] => {
            const cx = Math.floor(p.x / CELL_SIZE);
            const cy = Math.floor(p.y / CELL_SIZE);
            const result: Particle[] = [];

            for (let dy = -1; dy <= 1; dy++) {
                for (let dx = -1; dx <= 1; dx++) {
                    const key = (cy + dy) * cols + (cx + dx);
                    const cell = grid.get(key);
                    if (cell) {
                        for (const neighbor of cell) {
                            if (neighbor !== p) result.push(neighbor);
                        }
                    }
                }
            }
            return result;
        };

        let time = 0;

        // 动画循环
        const animate = () => {
            const w = window.innerWidth;
            const h = window.innerHeight;
            time += 0.016;

            ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
            ctx.fillStyle = "#0A0A10";
            ctx.fillRect(0, 0, w, h);

            const centerX = w / 2;
            const centerY = h / 2;
            const mouse = mouseRef.current;
            const particles = particlesRef.current;
            const connDist2 = connectionDistance * connectionDistance;

            // 构建空间网格
            const { grid, cols } = buildGrid(particles, w);

            for (const p of particles) {
                // 鼠标/中心吸引力
                const dx = (mouse.x || centerX) - p.x;
                const dy = (mouse.y || centerY) - p.y;
                const dist = Math.sqrt(dx * dx + dy * dy);

                if (dist < 300) {
                    p.vx += dx * 0.00005;
                    p.vy += dy * 0.00005;
                }

                // 速度阻尼
                p.vx *= DAMPING;
                p.vy *= DAMPING;

                // 移动
                p.x += p.vx;
                p.y += p.vy;

                // 边界环绕
                if (p.x < 0) p.x = w;
                if (p.x > w) p.x = 0;
                if (p.y < 0) p.y = h;
                if (p.y > h) p.y = 0;

                // Alpha 呼吸脉冲
                p.alpha = p.baseAlpha + Math.sin(time * 1.5 + p.phase) * 0.12;

                // 绘制粒子
                ctx.beginPath();
                ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
                ctx.fillStyle = p.color.replace(/[\d.]+\)$/, `${p.alpha})`);
                ctx.fill();

                // 空间网格连线（O(n) 替代原 O(n²)）
                const neighbors = getNeighbors(p, grid, cols);
                for (const p2 of neighbors) {
                    if (p2.phase <= p.phase) continue; // 避免重复

                    const ddx = p.x - p2.x;
                    const ddy = p.y - p2.y;
                    const d2 = ddx * ddx + ddy * ddy;

                    if (d2 < connDist2) {
                        const d = Math.sqrt(d2);
                        ctx.beginPath();
                        ctx.moveTo(p.x, p.y);
                        ctx.lineTo(p2.x, p2.y);
                        ctx.strokeStyle = `rgba(162, 103, 255, ${0.15 * (1 - d / connectionDistance)})`;
                        ctx.lineWidth = 0.5;
                        ctx.stroke();
                    }
                }
            }

            animationRef.current = requestAnimationFrame(animate);
        };

        animate();

        return () => {
            window.removeEventListener("resize", resize);
            window.removeEventListener("mousemove", handleMouseMove);
            if (animationRef.current) {
                cancelAnimationFrame(animationRef.current);
            }
        };
    }, [particleCount, colors, connectionDistance]);

    return (
        <canvas
            ref={canvasRef}
            style={{
                position: "fixed",
                top: 0,
                left: 0,
                width: "100%",
                height: "100%",
                zIndex: -1,
                pointerEvents: "none",
            }}
        />
    );
}

export default ParticleBackground;
