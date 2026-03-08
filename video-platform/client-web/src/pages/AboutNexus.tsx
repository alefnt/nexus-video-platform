/**
 * 🚀 NEXUS About Page - Enhanced Interactive Edition
 * 
 * Features:
 * - 3D Particle Starfield Background
 * - Mouse-Following Glow Effect
 * - Matrix-Style Data Stream
 * - 3D Flip Cards
 * - Typewriter Text Effect
 * - Animated Counter Statistics
 * - Scroll Parallax
 * - Interactive Sound Effects (optional)
 */

import React, { useRef, useState, useEffect } from 'react';
import { motion, useScroll, useTransform, useSpring, useMotionValue, useVelocity, useMotionTemplate, useInView, useAnimation } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Send, Play, Users, Database, Layers, Globe, Crown, Zap, Shield, Sparkles, Box, Cpu, Rocket, TrendingUp, Award, Heart, GitCommit, Terminal, User } from 'lucide-react';
import ScreenEffects, { EffectType } from '../components/ScreenEffects';

// ==================== PARTICLE STARFIELD ====================
const ParticleStarfield = () => {
    const canvasRef = useRef<HTMLCanvasElement>(null);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;

        const prefersReducedMotion = typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        const particleCount = prefersReducedMotion ? 30 : 200;
        const particles: Array<{ x: number, y: number, z: number, size: number }> = [];

        for (let i = 0; i < particleCount; i++) {
            particles.push({
                x: Math.random() * canvas.width - canvas.width / 2,
                y: Math.random() * canvas.height - canvas.height / 2,
                z: Math.random() * 1000,
                size: Math.random() * 2
            });
        }

        let animationId: number;
        const animate = () => {
            ctx.fillStyle = 'rgba(5, 5, 16, 0.1)';
            ctx.fillRect(0, 0, canvas.width, canvas.height);

            particles.forEach(p => {
                p.z -= 2;
                if (p.z <= 0) p.z = 1000;

                const x = (p.x / p.z) * 200 + canvas.width / 2;
                const y = (p.y / p.z) * 200 + canvas.height / 2;
                const size = (1 - p.z / 1000) * p.size * 3;

                const brightness = 1 - p.z / 1000;
                ctx.fillStyle = `rgba(0, 245, 255, ${brightness})`;
                ctx.beginPath();
                ctx.arc(x, y, size, 0, Math.PI * 2);
                ctx.fill();
            });

            animationId = requestAnimationFrame(animate);
        };

        animate();

        const handleResize = () => {
            canvas.width = window.innerWidth;
            canvas.height = window.innerHeight;
        };

        window.addEventListener('resize', handleResize);

        return () => {
            cancelAnimationFrame(animationId);
            window.removeEventListener('resize', handleResize);
        };
    }, []);

    return <canvas ref={canvasRef} className="fixed inset-0 pointer-events-none z-0" />;
};

// ==================== MOUSE GLOW (throttled) ====================
const MouseGlow = () => {
    const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
    const rafRef = useRef<number | null>(null);
    const lastRef = useRef({ x: 0, y: 0 });

    useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => {
            lastRef.current = { x: e.clientX, y: e.clientY };
            if (rafRef.current !== null) return;
            rafRef.current = requestAnimationFrame(() => {
                setMousePosition(lastRef.current);
                rafRef.current = null;
            });
        };

        window.addEventListener('mousemove', handleMouseMove, { passive: true });
        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
        };
    }, []);

    return (
        <div
            className="fixed pointer-events-none z-10 w-96 h-96 rounded-full blur-3xl opacity-20"
            style={{
                background: 'radial-gradient(circle, rgba(0,245,255,0.4) 0%, transparent 70%)',
                left: mousePosition.x - 192,
                top: mousePosition.y - 192,
                transition: 'left 0.15s ease-out, top 0.15s ease-out'
            }}
        />
    );
};

// ==================== MATRIX DATA STREAM ====================
const DataStream = () => {
    const canvasRef = useRef<HTMLCanvasElement>(null);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;

        const chars = '01アイウエオカキクケコサシスセソタチツテトナニヌネノハヒフヘホマミムメモヤユヨラリルレロワヲン';
        const fontSize = 14;
        const columns = canvas.width / fontSize;
        const drops: number[] = Array(Math.floor(columns)).fill(1);

        let animationId: number;
        const draw = () => {
            ctx.fillStyle = 'rgba(5, 5, 16, 0.05)';
            ctx.fillRect(0, 0, canvas.width, canvas.height);

            ctx.fillStyle = '#00f5ff';
            ctx.font = fontSize + 'px monospace';

            for (let i = 0; i < drops.length; i++) {
                const text = chars[Math.floor(Math.random() * chars.length)];
                ctx.fillText(text, i * fontSize, drops[i] * fontSize);

                if (drops[i] * fontSize > canvas.height && Math.random() > 0.975) {
                    drops[i] = 0;
                }
                drops[i]++;
            }

            animationId = requestAnimationFrame(draw);
        };

        draw();

        return () => cancelAnimationFrame(animationId);
    }, []);

    return <canvas ref={canvasRef} className="fixed inset-0 pointer-events-none z-0 opacity-10" />;
};

// ==================== TYPEWRITER EFFECT ====================
const TypewriterText = ({ text, className = "", delay = 0 }: { text: string, className?: string, delay?: number }) => {
    const [displayText, setDisplayText] = useState('');
    const [currentIndex, setCurrentIndex] = useState(0);

    useEffect(() => {
        const timeout = setTimeout(() => {
            if (currentIndex < text.length) {
                setDisplayText(prev => prev + text[currentIndex]);
                setCurrentIndex(prev => prev + 1);
            }
        }, delay + currentIndex * 50);

        return () => clearTimeout(timeout);
    }, [currentIndex, text, delay]);

    return (
        <span className={className}>
            {displayText}
            <span className="animate-pulse">|</span>
        </span>
    );
};

// ==================== ANIMATED COUNTER ====================
const AnimatedCounter = ({ end, duration = 2000, suffix = "" }: { end: number, duration?: number, suffix?: string }) => {
    const [count, setCount] = useState(0);
    const ref = useRef<HTMLDivElement>(null);
    const isInView = useInView(ref, { once: true });

    useEffect(() => {
        if (!isInView) return;

        let startTime: number;
        const animate = (currentTime: number) => {
            if (!startTime) startTime = currentTime;
            const progress = Math.min((currentTime - startTime) / duration, 1);

            setCount(Math.floor(progress * end));

            if (progress < 1) {
                requestAnimationFrame(animate);
            }
        };

        requestAnimationFrame(animate);
    }, [isInView, end, duration]);

    return <div ref={ref}>{count.toLocaleString()}{suffix}</div>;
};

// ==================== 3D FLIP CARD ====================
const FlipCard = ({ front, back, color = "cyan" }: { front: React.ReactNode, back: React.ReactNode, color?: string }) => {
    const [isFlipped, setIsFlipped] = useState(false);

    return (
        <div
            className="relative w-full h-full cursor-pointer perspective-1000"
            onMouseEnter={() => setIsFlipped(true)}
            onMouseLeave={() => setIsFlipped(false)}
        >
            <motion.div
                className="relative w-full h-full preserve-3d"
                animate={{ rotateY: isFlipped ? 180 : 0 }}
                transition={{ duration: 0.6, type: "spring" }}
            >
                {/* Front */}
                <div className="absolute inset-0 backface-hidden">
                    {front}
                </div>

                {/* Back */}
                <div className="absolute inset-0 backface-hidden" style={{ transform: 'rotateY(180deg)' }}>
                    {back}
                </div>
            </motion.div>
        </div>
    );
};

// ==================== HERO SECTION ====================
const EnhancedHeroSection = () => {
    const navigate = useNavigate();
    const { t } = useTranslation();

    return (
        <div className="relative min-h-screen flex flex-col items-center justify-center z-10 w-full px-4 overflow-hidden">
            {/* Animated Rings */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-10">
                <motion.div
                    className="absolute w-[80vw] h-[80vw] border-2 border-cyan-500/30 rounded-full"
                    animate={{ rotate: 360, scale: [1, 1.1, 1] }}
                    transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
                />
                <motion.div
                    className="absolute w-[60vw] h-[60vw] border-2 border-nexusPurple/30 rounded-full"
                    animate={{ rotate: -360, scale: [1, 0.9, 1] }}
                    transition={{ duration: 15, repeat: Infinity, ease: "linear" }}
                />
            </div>

            <motion.div
                initial={{ opacity: 0, y: 50 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 1 }}
                className="z-20 text-center flex flex-col items-center"
            >
                {/* Status Badge */}
                <motion.div
                    className="mb-8 inline-flex items-center gap-3 px-6 py-3 rounded-full bg-white/5 border border-cyan-500/30 backdrop-blur-md"
                    animate={{ boxShadow: ["0 0 20px rgba(0,245,255,0.2)", "0 0 40px rgba(0,245,255,0.4)", "0 0 20px rgba(0,245,255,0.2)"] }}
                    transition={{ duration: 2, repeat: Infinity }}
                >
                    <motion.span
                        className="w-3 h-3 rounded-full bg-green-500"
                        animate={{ scale: [1, 1.2, 1], opacity: [1, 0.7, 1] }}
                        transition={{ duration: 1.5, repeat: Infinity }}
                    />
                    <span className="text-sm font-mono text-nexusCyan tracking-widest font-bold">{t('about.hero.systemOnline')}</span>
                </motion.div>

                {/* Main Title with Glitch */}
                <motion.h1
                    className="text-7xl md:text-9xl font-black mb-6 relative"
                    initial={{ scale: 0.5, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ duration: 0.8, type: "spring" }}
                >
                    <span className="relative inline-block">
                        <span className="text-transparent bg-clip-text bg-gradient-to-r from-nexusCyan via-white to-purple-500 drop-shadow-[0_0_80px_rgba(0,245,255,0.8)]">
                            NEXUS
                        </span>
                        {/* Glitch layers */}
                        <span className="absolute top-0 left-0 -ml-1 text-red-500 opacity-50 animate-glitch-1">NEXUS</span>
                        <span className="absolute top-0 left-0 ml-1 text-cyan-500 opacity-50 animate-glitch-2">NEXUS</span>
                    </span>
                </motion.h1>

                {/* Subtitle with Typewriter */}
                <div className="text-2xl md:text-4xl font-bold text-gray-300 tracking-[0.3em] uppercase mb-16 h-16">
                    <TypewriterText text={t('about.hero.subtitle')} delay={500} className="text-nexusCyan" />
                </div>

                {/* CTA Buttons */}
                <div className="flex flex-col md:flex-row gap-6">
                    <motion.button
                        className="group relative px-10 py-5 bg-gradient-to-r from-nexusCyan to-blue-600 text-black font-black text-lg rounded-xl overflow-hidden"
                        whileHover={{ scale: 1.05, boxShadow: "0 0 40px rgba(0,245,255,0.6)" }}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => navigate('/')}
                    >
                        <span className="relative z-10 flex items-center gap-2">
                            <Rocket size={24} />
                            {t('about.hero.startExploring')}
                        </span>
                        <motion.div
                            className="absolute inset-0 bg-gradient-to-r from-nexusPurple to-nexusPink"
                            initial={{ x: "-100%" }}
                            whileHover={{ x: 0 }}
                            transition={{ duration: 0.3 }}
                        />
                    </motion.button>

                    <motion.button
                        className="px-10 py-5 border-2 border-cyan-500/50 text-nexusCyan font-bold text-lg rounded-xl backdrop-blur-sm hover:bg-cyan-500/10 transition-colors relative overflow-hidden group"
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => navigate('/whitepaper')}
                    >
                        <span className="relative z-10">{t('about.hero.readWhitepaper')}</span>
                        <div className="absolute inset-0 bg-gradient-to-r from-nexusCyan/0 via-cyan-500/20 to-cyan-500/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700" />
                    </motion.button>
                </div>
            </motion.div>

            {/* Scroll Indicator */}
            <motion.div
                className="absolute bottom-10 left-1/2 -translate-x-1/2"
                animate={{ y: [0, 10, 0] }}
                transition={{ duration: 1.5, repeat: Infinity }}
            >
                <div className="w-6 h-10 border-2 border-cyan-500/50 rounded-full flex justify-center pt-2">
                    <motion.div
                        className="w-1.5 h-1.5 bg-cyan-500 rounded-full"
                        animate={{ y: [0, 16, 0] }}
                        transition={{ duration: 1.5, repeat: Infinity }}
                    />
                </div>
            </motion.div>
        </div>
    );
};

// ==================== STATS SECTION ====================
const StatsSection = () => {
    const { t } = useTranslation();
    const stats = [
        { icon: Users, value: 50000, suffix: "+", label: t('about.stats.activeUsers'), color: "cyan" },
        { icon: Play, value: 1000000, suffix: "+", label: t('about.stats.videoViews'), color: "purple" },
        { icon: Award, value: 10000, suffix: "+", label: t('about.stats.nftMinted'), color: "yellow" },
        { icon: Heart, value: 99, suffix: "%", label: t('about.stats.satisfaction'), color: "pink" }
    ];

    return (
        <div className="py-32 relative z-10 w-full flex flex-col items-center">
            <motion.div
                className="grid grid-cols-2 md:grid-cols-4 gap-8 max-w-6xl px-4 w-full mx-auto"
                initial={{ opacity: 0, y: 50 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.8 }}
            >
                {stats.map((stat, i) => (
                    <motion.div
                        key={i}
                        className="relative group"
                        initial={{ opacity: 0, scale: 0.5 }}
                        whileInView={{ opacity: 1, scale: 1 }}
                        viewport={{ once: true }}
                        transition={{ delay: i * 0.1, duration: 0.5 }}
                        whileHover={{ scale: 1.05, y: -10 }}
                    >
                        <div className="relative bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl p-8 text-center overflow-hidden group-hover:border-cyan-500/50 transition-colors">
                            {/* Glow effect */}
                            <div className="absolute inset-0 bg-gradient-to-br from-nexusCyan/0 via-cyan-500/10 to-purple-500/0 opacity-0 group-hover:opacity-100 transition-opacity" />

                            <div className="relative z-10">
                                <stat.icon className="w-12 h-12 mx-auto mb-4 text-nexusCyan" />
                                <div className="text-4xl md:text-5xl font-black text-white mb-2">
                                    <AnimatedCounter end={stat.value} suffix={stat.suffix} />
                                </div>
                                <div className="text-gray-400 text-sm font-medium">{stat.label}</div>
                            </div>
                        </div>
                    </motion.div>
                ))}
            </motion.div>
        </div>
    );
};

// ==================== FEATURES WITH FLIP CARDS ====================
const FeaturesSection = () => {
    const { t } = useTranslation();
    const features = [
        {
            icon: Play,
            title: t('about.features.watchToEarn.title'),
            desc: t('about.features.watchToEarn.desc'),
            detail: t('about.features.watchToEarn.detail'),
            color: "cyan"
        },
        {
            icon: Sparkles,
            title: t('about.features.interactiveLive.title'),
            desc: t('about.features.interactiveLive.desc'),
            detail: t('about.features.interactiveLive.detail'),
            color: "purple"
        },
        {
            icon: Box,
            title: t('about.features.gamefi.title'),
            desc: t('about.features.gamefi.desc'),
            detail: t('about.features.gamefi.detail'),
            color: "yellow"
        },
        {
            icon: Users,
            title: t('about.features.dao.title'),
            desc: t('about.features.dao.desc'),
            detail: t('about.features.dao.detail'),
            color: "pink"
        }
    ];

    const COLORS: Record<string, string> = {
        cyan: "from-nexusCyan/20 to-cyan-500/5",
        purple: "from-nexusPurple/20 to-purple-500/5",
        yellow: "from-yellow-500/20 to-yellow-500/5",
        pink: "from-pink-500/20 to-nexusPink/5"
    };

    return (
        <div className="py-32 relative z-10 w-full flex flex-col items-center">
            <motion.div
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                className="text-center mb-20 max-w-3xl px-6"
            >
                <h2 className="text-5xl md:text-6xl font-black mb-6 text-white">
                    {t('about.features.title')}
                </h2>
                <p className="text-gray-400 text-xl leading-relaxed">
                    {t('about.features.subtitle')}
                </p>
            </motion.div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-6xl px-6 w-full mx-auto">
                {features.map((feature, i) => (
                    <motion.div
                        key={i}
                        className="h-80"
                        initial={{ opacity: 0, y: 50 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        transition={{ delay: i * 0.1 }}
                    >
                        <FlipCard
                            color={feature.color}
                            front={
                                <div className={`h-full bg-gradient-to-br ${COLORS[feature.color]} backdrop-blur-md border border-white/10 rounded-3xl p-8 flex flex-col items-center justify-center text-center`}>
                                    <div className="p-6 rounded-2xl bg-white/5 mb-6">
                                        <feature.icon className="w-16 h-16 text-nexusCyan" />
                                    </div>
                                    <h3 className="text-3xl font-black mb-4 text-white">{feature.title}</h3>
                                    <p className="text-gray-300 text-lg">{feature.desc}</p>
                                    <p className="text-nexusCyan text-sm mt-6 font-medium">{t('about.features.hoverDetail')}</p>
                                </div>
                            }
                            back={
                                <div className={`h-full bg-gradient-to-br ${COLORS[feature.color]} backdrop-blur-md border border-cyan-500/50 rounded-3xl p-8 flex flex-col items-center justify-center text-center`}>
                                    <feature.icon className="w-12 h-12 text-nexusCyan mb-6" />
                                    <h3 className="text-2xl font-bold mb-4 text-white">{feature.title}</h3>
                                    <p className="text-gray-200 leading-relaxed">{feature.detail}</p>
                                </div>
                            }
                        />
                    </motion.div>
                ))}
            </div>
        </div>
    );
};

// ==================== INTERACTIVE DEMO ====================
const InteractiveDemoSection = () => {
    const { t } = useTranslation();
    const [input, setInput] = useState("");
    const [activeEffect, setActiveEffect] = useState<EffectType | null>(null);
    const [comments, setComments] = useState<string[]>([t('about.demo.welcome'), t('about.demo.tryFire')]);
    const [isPlaying, setIsPlaying] = useState(false);

    // Auto-generate comments when playing
    useEffect(() => {
        if (!isPlaying) return;

        const interval = setInterval(() => {
            const mockComments = ["666", "Cool!", "Fire!!", "To the moon 🚀", "CKB YES", "RGB++", "Amazing UI"];
            const randomComment = mockComments[Math.floor(Math.random() * mockComments.length)];
            setComments(p => [...p.slice(-5), randomComment]);

            // Randomly trigger effects
            if (Math.random() > 0.8) {
                const effects: EffectType[] = ["firework", "stars", "gold"];
                const randomEffect = effects[Math.floor(Math.random() * effects.length)];
                setActiveEffect(randomEffect);
                setTimeout(() => setActiveEffect(null), 2000);
            }
        }, 2000);

        return () => clearInterval(interval);
    }, [isPlaying]);

    const handleSend = () => {
        if (!input.trim()) return;
        setComments(p => [...p.slice(-5), input]);
        const lower = input.toLowerCase();

        let effect: EffectType | null = null;
        if (lower.includes("snow") || lower.includes("winter")) effect = "snow";
        else if (lower.includes("fire") || lower.includes("boom") || lower.includes("666")) effect = "firework";
        else if (lower.includes("love") || lower.includes("heart")) effect = "hearts";

        if (effect) {
            setActiveEffect(effect);
            setTimeout(() => setActiveEffect(null), 3000);
        }
        setInput("");
        if (!isPlaying) setIsPlaying(true); // Auto play on interaction
    };

    return (
        <div className="py-32 relative z-20 w-full flex flex-col items-center">
            {/* Effects Layer */}
            <div className="fixed inset-0 pointer-events-none z-50">
                {activeEffect && <ScreenEffects effect={activeEffect} duration={3000} />}
            </div>

            <motion.div
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                className="text-center mb-16 w-full max-w-4xl px-4"
            >
                <h2 className="text-5xl md:text-6xl font-black mb-6">
                    <span className="text-nexusPurple">{t('about.demo.sectionTitle')}</span>
                </h2>
                <p className="text-gray-400 text-lg">{t('about.demo.tryHint')}</p>
            </motion.div>

            <motion.div
                className="relative z-40 bg-gradient-to-br from-purple-900/20 to-blue-900/20 border border-nexusPurple/30 rounded-3xl p-4 w-[95%] max-w-4xl backdrop-blur-xl shadow-[0_0_80px_rgba(168,85,247,0.3)]"
                initial={{ opacity: 0, scale: 0.9 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5 }}
            >
                {/* Mock Video Window */}
                <div className="bg-black/50 rounded-2xl aspect-[16/9] flex items-center justify-center relative overflow-hidden group border border-white/5">

                    {!isPlaying ? (
                        <>
                            <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1542204165-65bf26472b9b?auto=format&fit=crop&q=80')] bg-cover bg-center opacity-40 group-hover:opacity-60 transition-opacity" />
                            <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent z-10" />

                            <motion.div
                                whileHover={{ scale: 1.1 }}
                                className="relative z-20"
                                onClick={() => setIsPlaying(true)}
                            >
                                <Play size={100} className="text-white/80 group-hover:text-nexus-cyan transition-colors drop-shadow-2xl cursor-pointer" />
                            </motion.div>
                        </>
                    ) : (
                        <>
                            {/* Simulated Video Content */}
                            <video
                                className="absolute inset-0 w-full h-full object-cover opacity-80"
                                autoPlay
                                loop
                                muted
                                playsInline
                                src="https://assets.mixkit.co/videos/preview/mixkit-cyberpunk-city-and-cars-13009-large.mp4"
                            />

                            {/* Live Badge */}
                            <div className="absolute top-4 left-4 z-20 flex items-center gap-2 bg-black/60 backdrop-blur px-3 py-1 rounded-full border border-red-500/50">
                                <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                                <span className="text-xs font-bold text-white">{t('about.demo.liveBadge')}</span>
                            </div>

                            {/* Viewer Count */}
                            <div className="absolute top-4 right-4 z-20 flex items-center gap-2 bg-black/60 backdrop-blur px-3 py-1 rounded-full border border-white/10">
                                <Users size={12} className="text-nexus-cyan" />
                                <span className="text-xs font-bold text-white">12.5k</span>
                            </div>
                        </>
                    )}

                    {/* Danmaku Overlay */}
                    <div className="absolute bottom-6 left-6 right-6 z-20 space-y-3 font-mono text-sm h-[200px] overflow-hidden flex flex-col justify-end mask-image-gradient-to-t">
                        <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent pointer-events-none" />
                        <div className="relative z-10 flex flex-col gap-2">
                            {comments.map((c, i) => (
                                <motion.div
                                    key={i}
                                    initial={{ opacity: 0, x: -30 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    className="flex gap-2 items-center bg-black/40 w-fit px-3 py-1.5 rounded-full backdrop-blur-md border border-white/10"
                                >
                                    <span className="text-nexus-cyan font-bold text-xs">User{Math.floor(Math.random() * 99)}:</span>
                                    <span className="text-white text-xs">{c}</span>
                                </motion.div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Input Bar */}
                <div className="mt-6 p-3 flex gap-4">
                    <input
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                        className="flex-1 bg-black/50 border border-nexusPurple/30 rounded-xl px-6 py-4 text-white focus:outline-none focus:border-nexusPurple transition-colors font-mono placeholder:text-gray-500"
                        placeholder={t('about.demo.inputPlaceholder')}
                    />
                    <motion.button
                        onClick={handleSend}
                        className="px-8 bg-gradient-to-r from-nexusPurple to-nexusPink rounded-xl text-white font-bold transition-all shadow-lg shadow-purple-900/50"
                        whileHover={{ scale: 1.05, boxShadow: "0 0 30px rgba(168,85,247,0.6)" }}
                        whileTap={{ scale: 0.95 }}
                    >
                        {t('about.demo.send')}
                    </motion.button>
                </div>
            </motion.div>
        </div>
    );
};

// ==================== TECH STACK ====================
const TechStackSection = () => {
    const { t } = useTranslation();
    const techs = [
        { icon: Globe, title: t('about.tech.forceBridge.title'), desc: t('about.tech.forceBridge.desc'), color: "blue" },
        { icon: Zap, title: t('about.tech.fiber.title'), desc: t('about.tech.fiber.desc'), color: "yellow" },
        { icon: Database, title: t('about.tech.ipfs.title'), desc: t('about.tech.ipfs.desc'), color: "pink" },
        { icon: Shield, title: t('about.tech.zk.title'), desc: t('about.tech.zk.desc'), color: "cyan" }
    ];

    return (
        <div className="py-32 relative z-10 w-full flex flex-col items-center bg-gradient-to-b from-transparent via-black/40 to-transparent">
            <motion.div
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                className="text-center mb-20 w-full max-w-4xl px-4"
            >
                <div className="flex items-center justify-center gap-4 mb-6">
                    <Cpu className="w-12 h-12 text-nexusCyan" />
                    <h2 className="text-5xl font-black text-white">{t('about.tech.title')}</h2>
                </div>
                <p className="text-gray-400 text-lg">{t('about.tech.subtitle')}</p>
            </motion.div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-7xl px-6 w-full mx-auto">
                {techs.map((tech, i) => (
                    <motion.div
                        key={i}
                        className="relative group"
                        initial={{ opacity: 0, y: 50 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        transition={{ delay: i * 0.1 }}
                        whileHover={{ y: -10 }}
                    >
                        <div className="relative bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl p-8 text-center overflow-hidden group-hover:border-cyan-500/50 transition-all">
                            {/* Animated background */}
                            <motion.div
                                className="absolute inset-0 bg-gradient-to-br from-nexusCyan/0 via-cyan-500/10 to-purple-500/0"
                                initial={{ opacity: 0 }}
                                whileHover={{ opacity: 1 }}
                            />

                            <div className="relative z-10">
                                <motion.div
                                    className="p-5 rounded-2xl bg-white/5 mb-6 inline-block"
                                    whileHover={{ rotate: 360 }}
                                    transition={{ duration: 0.6 }}
                                >
                                    <tech.icon className="w-10 h-10 text-nexusCyan" />
                                </motion.div>
                                <h3 className="text-xl font-bold mb-3 text-white">{tech.title}</h3>
                                <p className="text-gray-400 text-sm leading-relaxed">{tech.desc}</p>
                            </div>
                        </div>
                    </motion.div>
                ))}
            </div>
        </div>
    );
};

// ==================== HOLO CARD ====================
const HoloCardSection = () => {
    const { t } = useTranslation();
    const ref = useRef<HTMLDivElement>(null);
    const x = useMotionValue(0);
    const y = useMotionValue(0);
    const rotateX = useTransform(y, [-300, 300], [15, -15]);
    const rotateY = useTransform(x, [-300, 300], [-15, 15]);
    const glareX = useTransform(x, [-300, 300], [0, 100]);

    function handleMouseMove(event: React.MouseEvent) {
        if (!ref.current) return;
        const rect = ref.current.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;
        x.set(event.clientX - centerX);
        y.set(event.clientY - centerY);
    }

    return (
        <div className="py-32 relative z-10 w-full flex flex-col items-center" onMouseMove={handleMouseMove} onMouseLeave={() => { x.set(0); y.set(0); }}>
            <motion.div
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                className="text-center mb-20 w-full max-w-4xl px-4"
            >
                <h2 className="text-6xl md:text-7xl font-black mb-4 bg-clip-text text-transparent bg-gradient-to-br from-yellow-300 via-yellow-500 to-yellow-700">
                    {t('about.holo.title')}
                </h2>
                <p className="text-yellow-500/60 font-mono tracking-widest text-lg uppercase">{t('about.holo.subtitle')}</p>
            </motion.div>

            <motion.div
                ref={ref}
                className="w-[350px] h-[520px] rounded-3xl relative cursor-pointer"
                style={{ rotateX, rotateY, transformStyle: "preserve-3d" }}
                whileHover={{ scale: 1.05 }}
            >
                <div className="absolute inset-0 bg-gradient-to-br from-yellow-900/50 via-black to-purple-900/50 rounded-3xl border-2 border-yellow-500/30 shadow-[0_0_100px_rgba(234,179,8,0.4)] overflow-hidden" style={{ transformStyle: 'preserve-3d' }}>
                    {/* Holographic pattern */}
                    <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZGVmcz48cGF0dGVybiBpZD0iZ3JpZCIgd2lkdGg9IjQwIiBoZWlnaHQ9IjQwIiBwYXR0ZXJuVW5pdHM9InVzZXJTcGFjZU9uVXNlIj48cGF0aCBkPSJNIDQwIDAgTCAwIDAgMCA0MCIgZmlsbD0ibm9uZSIgc3Ryb2tlPSJyZ2JhKDI1NSwyNTUsMjU1LDAuMSkiIHN0cm9rZS13aWR0aD0iMSIvPjwvcGF0dGVybj48L2RlZnM+PHJlY3Qgd2lkdGg9IjEwMCUiIGhlaWdodD0iMTAwJSIgZmlsbD0idXJsKCNncmlkKSIvPjwvc3ZnPg==')] opacity-20" />

                    {/* Card Content */}
                    <div className="relative z-10 p-10 h-full flex flex-col justify-between" style={{ transform: 'translateZ(50px)' }}>
                        <div className="flex justify-between items-start">
                            <motion.div
                                animate={{ rotate: [0, 360] }}
                                transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
                            >
                                <Crown size={56} className="text-yellow-400 drop-shadow-[0_0_20px_rgba(250,204,21,0.8)]" />
                            </motion.div>
                            <div className="bg-yellow-500/20 text-yellow-400 px-4 py-2 rounded-full text-sm font-bold font-mono border border-yellow-500/40">{t('about.holo.genesis')}</div>
                        </div>

                        <div className="space-y-6">
                            <div>
                                <div className="text-xs font-mono text-gray-500 mb-2">{t('about.holo.holder')}</div>
                                <div className="font-mono text-2xl text-white tracking-widest">0x71...8A9</div>
                            </div>
                            <div>
                                <h3 className="text-4xl font-black text-white italic leading-tight mb-2">
                                    DIAMOND<br />
                                    <span className="text-transparent bg-clip-text bg-gradient-to-r from-nexusCyan to-purple-500">ACCESS</span>
                                </h3>
                                <p className="text-sm text-gray-400">{t('about.holo.benefits')}</p>
                            </div>
                        </div>
                    </div>

                    {/* Glare Effect */}
                    <motion.div
                        className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/40 to-transparent z-20 pointer-events-none"
                        style={{ x: glareX, opacity: useTransform(x, [-150, 150], [0, 0.9]) }}
                    />
                </div>
            </motion.div>
        </div>
    );
};

// ==================== TEAM SECTION ====================
const TeamSection = () => {
    const { t } = useTranslation();
    const team = [
        {
            name: "Cipher",
            role: "Lead Protocol Architect",
            avatar: "https://images.unsplash.com/photo-1543610892-0b1f7e6d8ac1?auto=format&fit=crop&q=80",
            color: "cyan",
            commits: 1420
        },
        {
            name: "Nova",
            role: "ZK-Rollup Engineer",
            avatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80",
            color: "purple",
            commits: 890
        },
        {
            name: "Zero",
            role: "Economic Model Designer",
            avatar: "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&q=80",
            color: "yellow",
            commits: 654
        },
        {
            name: "Mute",
            role: "Creative Director",
            avatar: "https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?auto=format&fit=crop&q=80",
            color: "pink",
            commits: 1120
        }
    ];

    const COLORS: Record<string, { bg: string, text: string, border: string, shadow: string }> = {
        cyan: { bg: "bg-cyan-500/10", text: "text-nexusCyan", border: "border-cyan-500/30", shadow: "hover:shadow-[0_0_30px_rgba(34,211,238,0.2)]" },
        purple: { bg: "bg-nexusPurple/10", text: "text-nexusPurple", border: "border-nexusPurple/30", shadow: "hover:shadow-[0_0_30px_rgba(168,85,247,0.2)]" },
        yellow: { bg: "bg-yellow-500/10", text: "text-yellow-400", border: "border-yellow-500/30", shadow: "hover:shadow-[0_0_30px_rgba(234,179,8,0.2)]" },
        pink: { bg: "bg-nexusPink/10", text: "text-nexusPink", border: "border-pink-500/30", shadow: "hover:shadow-[0_0_30px_rgba(236,72,153,0.2)]" }
    };

    return (
        <div className="py-32 relative z-10 w-full flex flex-col items-center">
            <motion.div
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                className="text-center mb-20 max-w-4xl px-4"
            >
                <div className="flex items-center justify-center gap-4 mb-6">
                    <User className="w-12 h-12 text-nexusPurple" />
                    <h2 className="text-5xl md:text-6xl font-black text-white">Core Protocol Hackers</h2>
                </div>
                <p className="text-gray-400 text-lg">The syndicate building the decentralized future of media.</p>
            </motion.div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 max-w-7xl px-6 w-full mx-auto">
                {team.map((member, i) => (
                    <motion.div
                        key={i}
                        initial={{ opacity: 0, y: 50 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        transition={{ delay: i * 0.15 }}
                        whileHover={{ y: -10 }}
                        className="group relative"
                    >
                        <div className={`relative bg-black/60 backdrop-blur-xl border ${COLORS[member.color].border} rounded-2xl p-6 overflow-hidden transition-all duration-500 ${COLORS[member.color].shadow}`}>
                            {/* Glitch Overlay */}
                            <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent opacity-80 z-10 pointer-events-none" />
                            <div className="absolute top-0 left-0 w-full h-1 bg-white/10 overflow-hidden hidden group-hover:block z-20">
                                <motion.div
                                    className={`h-full ${COLORS[member.color].bg.replace('/10', '')}`}
                                    animate={{ x: ['-100%', '100%'] }}
                                    transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                                />
                            </div>

                            {/* Avatar */}
                            <div className="relative w-full aspect-square mb-6 rounded-xl overflow-hidden border border-white/10 group-hover:border-white/30 transition-colors z-0 grayscale group-hover:grayscale-0">
                                <img src={member.avatar} alt={member.name} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" />
                                {/* Cyberpunk eye scan line */}
                                <motion.div
                                    className={`absolute top-0 left-0 w-full h-8 bg-gradient-to-b from-transparent ${COLORS[member.color].bg} to-transparent opacity-0 group-hover:opacity-100`}
                                    animate={{ y: [0, 300, 0] }}
                                    transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
                                />
                            </div>

                            {/* Info */}
                            <div className="relative z-20">
                                <h3 className={`text-2xl font-black font-mono tracking-wider mb-1 ${COLORS[member.color].text}`}>{member.name}</h3>
                                <p className="text-white text-sm font-bold mb-4">{member.role}</p>

                                {/* Stats */}
                                <div className="flex items-center gap-4 text-xs font-mono text-gray-500 border-t border-white/10 pt-4 mt-4">
                                    <div className="flex items-center gap-1">
                                        <GitCommit className="w-3 h-3" />
                                        <span>{member.commits} commits</span>
                                    </div>
                                    <div className="flex items-center gap-1">
                                        <Terminal className="w-3 h-3" />
                                        <span>Online</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </motion.div>
                ))}
            </div>
        </div>
    );
};

// ==================== ROADMAP SECTION ====================
const RoadmapSection = () => {
    const { t } = useTranslation();
    const phases = [
        {
            phase: "Phase 1",
            title: t('about.roadmap.phase1.title'),
            time: "Q1 2026",
            status: "completed",
            items: t('about.roadmap.phase1.items', { returnObjects: true }) as string[],
            color: "cyan"
        },
        {
            phase: "Phase 2",
            title: t('about.roadmap.phase2.title'),
            time: "Q2 2026",
            status: "active",
            items: t('about.roadmap.phase2.items', { returnObjects: true }) as string[],
            color: "purple"
        },
        {
            phase: "Phase 3",
            title: t('about.roadmap.phase3.title'),
            time: "Q3 2026",
            status: "upcoming",
            items: t('about.roadmap.phase3.items', { returnObjects: true }) as string[],
            color: "pink"
        },
        {
            phase: "Phase 4",
            title: t('about.roadmap.phase4.title'),
            time: "2027+",
            status: "upcoming",
            items: t('about.roadmap.phase4.items', { returnObjects: true }) as string[],
            color: "yellow"
        }
    ];

    return (
        <div className="py-32 relative z-10 w-full flex flex-col items-center">
            <motion.div
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                className="text-center mb-20 max-w-4xl px-4"
            >
                <h2 className="text-5xl md:text-6xl font-black mb-6 text-white">
                    {t('about.roadmap.title')}
                </h2>
                <p className="text-gray-400 text-lg">{t('about.roadmap.subtitle')}</p>
            </motion.div>

            <div className="relative max-w-6xl mx-auto px-4 w-full">
                {/* Connection Line */}
                <div className="absolute top-1/2 left-0 w-full h-1 bg-white/10 -translate-y-1/2 hidden md:block" />

                <div className="grid grid-cols-1 md:grid-cols-4 gap-8 relative z-10">
                    {phases.map((phase, i) => (
                        <motion.div
                            key={i}
                            initial={{ opacity: 0, y: 50 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true }}
                            transition={{ delay: i * 0.2 }}
                            className="relative group"
                        >
                            {/* Node Point */}
                            <div className={`w-8 h-8 rounded-full border-4 border-[#050510] absolute left-1/2 -translate-x-1/2 top-1/2 -translate-y-1/2 hidden md:block z-20 ${phase.status === 'completed' ? 'bg-nexusCyan shadow-[0_0_20px_rgba(34,211,238,0.8)]' : phase.status === 'active' ? 'bg-nexusPurple shadow-[0_0_20px_rgba(168,85,247,0.8)] animate-pulse' : 'bg-gray-700'}`} />

                            <div className={`p-6 rounded-2xl border backdrop-blur-md transition-all h-full flex flex-col ${phase.status === 'active' ? 'bg-white/10 border-nexusPurple/50 shadow-[0_0_30px_rgba(168,85,247,0.2)]' : 'bg-white/5 border-white/10 hover:border-white/30'}`}>
                                <div className="mb-4">
                                    <span className={`text-xs font-mono font-bold px-2 py-1 rounded ${phase.status === 'completed' ? 'bg-cyan-500/20 text-nexusCyan' : phase.status === 'active' ? 'bg-nexusPurple/20 text-nexusPurple' : 'bg-gray-700/50 text-gray-400'}`}>
                                        {phase.time}
                                    </span>
                                </div>
                                <h3 className={`text-2xl font-black mb-1 ${phase.status === 'completed' ? 'text-nexusCyan' : phase.status === 'active' ? 'text-nexusPurple' : 'text-white'}`}>{phase.title}</h3>
                                <div className="text-sm font-bold text-gray-500 mb-4">{phase.phase}</div>

                                <ul className="space-y-2 mt-auto">
                                    {phase.items.map((item, j) => (
                                        <li key={j} className="flex items-start gap-2 text-sm text-gray-300">
                                            <span className={`mt-1.5 w-1.5 h-1.5 rounded-full ${phase.status === 'completed' ? 'bg-cyan-500' : phase.color === 'purple' ? 'bg-nexusPurple' : 'bg-gray-600'}`} />
                                            {item}
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        </motion.div>
                    ))}
                </div>
            </div>
        </div>
    );
};

// ==================== FOOTER CTA ====================
const FooterCTA = () => {
    const navigate = useNavigate();
    const { t } = useTranslation();
    return (
        <div className="py-40 flex flex-col items-center justify-center w-full relative z-10 border-t border-white/10 bg-gradient-to-b from-black/60 to-black backdrop-blur-xl">
            <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                className="text-center"
            >
                <h2 className="text-4xl md:text-6xl font-black mb-6 text-white">{t('about.footer.title')}</h2>
                <p className="text-xl text-gray-400 mb-10">{t('about.footer.subtitle')}</p>

                <div className="flex justify-center">
                    <motion.button
                        className="group relative px-14 py-6 bg-gradient-to-r from-nexusCyan to-purple-600 text-white font-black text-xl rounded-xl overflow-hidden"
                        whileHover={{ scale: 1.05, boxShadow: "0 0 50px rgba(0,245,255,0.6)" }}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => navigate('/')}
                    >
                        <span className="relative z-10 flex items-center gap-3">
                            <Rocket size={24} />
                            {t('about.footer.cta')}
                        </span>
                        <motion.div
                            className="absolute inset-0 bg-white/20"
                            initial={{ x: "-100%" }}
                            whileHover={{ x: "100%" }}
                            transition={{ duration: 0.5 }}
                        />
                    </motion.button>
                </div>

                <p className="text-gray-600 text-sm font-mono tracking-wider">© 2026 NEXUS PROTOCOL · POWERED BY CKB NETWORK</p>
            </motion.div>
        </div>
    );
};

// ==================== MAIN COMPONENT ====================
export default function AboutNexus() {
    return (
        <div className="min-h-full text-white w-full overflow-x-hidden relative font-sans selection:bg-cyan-500 selection:text-black">

            {/* Background Effects */}
            <ParticleStarfield />
            <DataStream />
            <MouseGlow />

            {/* Main Content */}
            <div className="relative pt-16 w-full flex flex-col items-center mx-auto max-w-[100vw] px-4 sm:px-6 lg:px-8">
                <EnhancedHeroSection />
                <StatsSection />
                <FeaturesSection />
                <InteractiveDemoSection />
                <TechStackSection />
                <HoloCardSection />
                <TeamSection />
                <RoadmapSection />
                <FooterCTA />
            </div>

            {/* Custom Styles */}
            <style>{`
                @keyframes glitch-1 {
                    0%, 100% { transform: translate(0); }
                    33% { transform: translate(-2px, 2px); }
                    66% { transform: translate(2px, -2px); }
                }
                
                @keyframes glitch-2 {
                    0%, 100% { transform: translate(0); }
                    33% { transform: translate(2px, -2px); }
                    66% { transform: translate(-2px, 2px); }
                }
                
                .animate-glitch-1 {
                    animation: glitch-1 0.3s infinite;
                }
                
                .animate-glitch-2 {
                    animation: glitch-2 0.3s infinite 0.15s;
                }
                
                .perspective-1000 {
                    perspective: 1000px;
                }
                
                .preserve-3d {
                    transform-style: preserve-3d;
                }
                
                .backface-hidden {
                    backface-visibility: hidden;
                }
                
                .rotate-y-180 {
                    transform: rotateY(180deg);
                }
                
                /* Responsive Container */
                .container-responsive {
                    width: 100%;
                    max-width: 100vw;
                    margin: 0 auto;
                }
                
                @media (min-width: 640px) {
                    .container-responsive {
                        max-width: 640px;
                    }
                }
                
                @media (min-width: 768px) {
                    .container-responsive {
                        max-width: 768px;
                    }
                }
                
                @media (min-width: 1024px) {
                    .container-responsive {
                        max-width: 1024px;
                    }
                }
                
                @media (min-width: 1280px) {
                    .container-responsive {
                        max-width: 1280px;
                    }
                }
            `}</style>
        </div>
    );
}
