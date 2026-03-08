// FILE: /video-platform/client-web/src/components/live/LiveGiftEffect.tsx
/**
 * 直播礼物特效组件 (TikTok Style & Cyberpunk Enhanced)
 * 
 * Features:
 * - High-impact CSS Animations
 * - Particle Systems
 * - Screen Shake Effects
 * - Holographic Overlays
 */

import React, { useEffect, useState, useRef } from 'react';
import { AnimatePresence, motion } from 'framer-motion';

export interface GiftEffect {
    id: string;
    type: string;
    animation: string;
    fromName: string;
    amount: number;
    giftIcon: string; // Emoji or URL
    giftName: string;
}

interface LiveGiftEffectProps {
    className?: string;
}

// Global Event for triggering effects
declare global {
    interface WindowEventMap {
        'live-gift-effect': CustomEvent<GiftEffect>;
    }
}

export function triggerGiftEffect(effect: GiftEffect) {
    window.dispatchEvent(new CustomEvent('live-gift-effect', { detail: effect }));
}

// --- Particle Components ---

const Sparkle = ({ delay, x, y, color }: { delay: number, x: number, y: number, color: string }) => (
    <motion.div
        initial={{ opacity: 0, scale: 0, x, y }}
        animate={{
            opacity: [0, 1, 0],
            scale: [0, 1.5, 0],
            y: y - 100, // Float up
            rotate: 180
        }}
        transition={{ duration: 1.5, delay, ease: "easeOut" }}
        className="absolute w-4 h-4 rounded-full blur-[1px]"
        style={{ backgroundColor: color, boxShadow: `0 0 10px ${color}` }}
    />
);

const RocketSmoke = ({ delay, x }: { delay: number, x: number }) => (
    <motion.div
        initial={{ opacity: 0, scale: 0.5, y: 0, x }}
        animate={{ opacity: [0, 0.8, 0], scale: [0.5, 2, 3], y: 200 }}
        transition={{ duration: 2, delay }}
        className="absolute bottom-0 w-12 h-12 bg-gray-500/50 rounded-full blur-xl"
    />
);

// --- Main Component ---

export default function LiveGiftEffect({ className = '' }: LiveGiftEffectProps) {
    const [effects, setEffects] = useState<GiftEffect[]>([]);
    const [shake, setShake] = useState(false);

    useEffect(() => {
        const handleEffect = (event: CustomEvent<GiftEffect>) => {
            const effect = event.detail;
            const uniqueId = effect.id || `gift-${Date.now()}-${Math.random()}`;
            setEffects(prev => [...prev, { ...effect, id: uniqueId }]);

            // Trigger Screen Shake for big gifts
            if (['rocket-launch', 'spaceship-fly', 'castle-build'].includes(effect.animation)) {
                setShake(true);
                setTimeout(() => setShake(false), 500);
            }

            // Auto-remove after animation
            setTimeout(() => {
                setEffects(prev => prev.filter(e => e.id !== uniqueId));
            }, 6000); // 6s to allow full animation
        };

        window.addEventListener('live-gift-effect', handleEffect as EventListener);
        return () => window.removeEventListener('live-gift-effect', handleEffect as EventListener);
    }, []);

    return (
        <div className={`live-gift-effect-container ${className} ${shake ? 'shake-screen' : ''}`}>
            <style>{`
                .live-gift-effect-container {
                    position: absolute;
                    inset: 0;
                    overflow: hidden;
                    pointer-events: none;
                    z-index: 100;
                    font-family: 'Orbitron', sans-serif; /* Cyberpunk Font preference */
                }

                .shake-screen {
                    animation: screenShake 0.5s cubic-bezier(.36,.07,.19,.97) both;
                }

                @keyframes screenShake {
                    10%, 90% { transform: translate3d(-1px, 0, 0); }
                    20%, 80% { transform: translate3d(2px, 0, 0); }
                    30%, 50%, 70% { transform: translate3d(-4px, 0, 0); }
                    40%, 60% { transform: translate3d(4px, 0, 0); }
                }

                .combo-text {
                    text-shadow: 0 0 10px rgba(0,0,0,0.8), 0 0 20px currentColor;
                    font-style: italic;
                }
            `}</style>

            <AnimatePresence>
                {effects.map(effect => (
                    <motion.div
                        key={effect.id}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="absolute inset-0 flex items-center justify-center"
                    >
                        {/* --- Gift Notification Banner --- */}
                        <motion.div
                            initial={{ x: '-100%', opacity: 0 }}
                            animate={{ x: 0, opacity: 1 }}
                            exit={{ x: '100%', opacity: 0 }}
                            transition={{ type: "spring", stiffness: 100, damping: 20 }}
                            className="absolute top-[15%] left-4 bg-black/60 backdrop-blur-md border border-accent-cyan/30 rounded-full pl-2 pr-6 py-2 flex items-center gap-3 shadow-[0_0_20px_rgba(0,255,255,0.2)] z-50"
                        >
                            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-accent-cyan to-blue-600 flex items-center justify-center text-2xl border border-white/20">
                                {effect.giftIcon}
                            </div>
                            <div className="flex flex-col">
                                <span className="text-xs text-accent-cyan font-bold leading-none mb-1">{effect.fromName}</span>
                                <span className="text-white text-sm font-bold leading-none">Sent {effect.giftName}</span>
                            </div>
                            <div className="ml-2 text-xl font-black italic text-accent-yellow combo-text">x1</div>
                        </motion.div>

                        {/* --- ROCKET LAUNCH --- */}
                        {effect.animation === 'rocket-launch' && (
                            <div className="absolute inset-0 flex items-center justify-center">
                                {/* Smoke Particles */}
                                {Array.from({ length: 15 }).map((_, i) => (
                                    <RocketSmoke key={i} delay={i * 0.1} x={(Math.random() - 0.5) * 50} />
                                ))}

                                {/* Rocket Body */}
                                <motion.div
                                    initial={{ y: '100vh', scale: 0.5, rotate: 0 }}
                                    animate={{
                                        y: ['100vh', '0vh', '-150vh'],
                                        scale: [0.5, 1.2, 0.8],
                                        rotate: [0, -5, 5, 0] // Wiggle
                                    }}
                                    transition={{ duration: 4, times: [0, 0.3, 1], ease: "anticipate" }}
                                    className="relative z-10 text-[150px] filter drop-shadow-[0_0_30px_rgba(255,100,0,0.8)]"
                                >
                                    🚀
                                    {/* Engine Flame */}
                                    <motion.div
                                        animate={{ scale: [1, 1.2, 0.8, 1] }}
                                        transition={{ repeat: Infinity, duration: 0.1 }}
                                        className="absolute -bottom-10 left-1/2 -translate-x-1/2 w-10 h-32 bg-gradient-to-t from-transparent via-orange-500 to-yellow-300 blur-md rounded-full"
                                    />
                                </motion.div>

                                {/* Impact Text */}
                                <motion.div
                                    initial={{ opacity: 0, scale: 0 }}
                                    animate={{ opacity: [0, 1, 0], scale: [0, 2, 3] }}
                                    transition={{ delay: 0.5, duration: 2 }}
                                    className="absolute text-6xl font-black text-orange-500 uppercase tracking-widest combo-text"
                                >
                                    LIFT OFF!
                                </motion.div>
                            </div>
                        )}

                        {/* --- CROWN RAIN --- */}
                        {effect.animation === 'crown-rain' && (
                            <div className="absolute inset-0">
                                {Array.from({ length: 30 }).map((_, i) => (
                                    <motion.div
                                        key={i}
                                        initial={{ y: -100, x: Math.random() * window.innerWidth, rotateY: 0, opacity: 0 }}
                                        animate={{
                                            y: window.innerHeight + 100,
                                            rotateY: 720,
                                            opacity: [0, 1, 1, 0]
                                        }}
                                        transition={{ duration: 3 + Math.random(), delay: Math.random() * 2, ease: "linear" }}
                                        className="absolute text-5xl filter drop-shadow-[0_0_10px_rgba(255,215,0,0.6)]"
                                    >
                                        👑
                                    </motion.div>
                                ))}
                                {/* Centerpiece */}
                                <motion.div
                                    initial={{ scale: 0, rotate: -180 }}
                                    animate={{ scale: [0, 1.5, 1.2], rotate: 0 }}
                                    exit={{ scale: 0, opacity: 0 }}
                                    transition={{ duration: 1, type: "spring" }}
                                    className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-[120px] filter drop-shadow-[0_0_50px_rgba(255,215,0,0.8)] z-20"
                                >
                                    👑
                                    <motion.div
                                        animate={{ rotate: 360 }}
                                        transition={{ duration: 10, repeat: Infinity, ease: "linear" }}
                                        className="absolute inset-[-50%] border-[2px] border-dashed border-yellow-400/30 rounded-full"
                                    />
                                </motion.div>
                            </div>
                        )}

                        {/* --- DIAMOND BURST --- */}
                        {effect.animation === 'diamond-burst' && (
                            <div className="absolute inset-0 flex items-center justify-center">
                                {/* Shockwave */}
                                <motion.div
                                    initial={{ scale: 0, opacity: 0.8, borderWidth: '50px' }}
                                    animate={{ scale: 2, opacity: 0, borderWidth: '0px' }}
                                    transition={{ duration: 1, ease: "easeOut" }}
                                    className="absolute w-[300px] h-[300px] rounded-full border-nexusCyan border-solid"
                                />

                                {/* Particles */}
                                {Array.from({ length: 20 }).map((_, i) => {
                                    const angle = (i / 20) * Math.PI * 2;
                                    const r = 200 + Math.random() * 100;
                                    return (
                                        <motion.div
                                            key={i}
                                            initial={{ x: 0, y: 0, scale: 0, opacity: 1 }}
                                            animate={{
                                                x: Math.cos(angle) * r,
                                                y: Math.sin(angle) * r,
                                                scale: [0, 1, 0],
                                                opacity: 0
                                            }}
                                            transition={{ duration: 1.5, ease: "easeOut" }}
                                            className="absolute text-3xl"
                                        >
                                            💎
                                        </motion.div>
                                    );
                                })}

                                {/* Main Diamond */}
                                <motion.div
                                    initial={{ scale: 0 }}
                                    animate={{
                                        scale: [0, 1.5, 1],
                                        rotate: [0, 0, 10, -10, 0], // Shake
                                        filter: ["hue-rotate(0deg)", "hue-rotate(90deg)", "hue-rotate(0deg)"]
                                    }}
                                    transition={{ duration: 1.5 }}
                                    className="relative text-[100px] z-20 filter drop-shadow-[0_0_40px_rgba(0,255,255,0.8)]"
                                >
                                    💎
                                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-full bg-nexusCyan/20 blur-xl rounded-full animate-pulse" />
                                </motion.div>
                            </div>
                        )}

                        {/* --- SPACESHIP FLYBY --- */}
                        {effect.animation === 'spaceship-fly' && (
                            <div className="absolute inset-0 pointer-events-none">
                                <motion.div
                                    initial={{ x: '-20vw', y: '20vh', scale: 0.5 }}
                                    animate={{
                                        x: ['-20vw', '120vw'],
                                        y: ['20vh', '-20vh'],
                                        scale: [0.5, 1.5]
                                    }}
                                    transition={{ duration: 2.5, ease: "easeInOut" }}
                                    className="absolute text-[120px] filter drop-shadow-[0_0_20px_rgba(0,255,100,0.8)] z-30"
                                >
                                    🛸
                                    {/* Warp Trail */}
                                    <div className="absolute top-1/2 right-full w-[50vw] h-[10px] bg-gradient-to-l from-green-400/80 to-transparent blur-sm transform -translate-y-1/2" />
                                </motion.div>
                                <motion.div
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: [0, 0.5, 0] }}
                                    transition={{ duration: 1, delay: 0.5 }}
                                    className="absolute inset-0 bg-green-500/10 mix-blend-overlay"
                                />
                            </div>
                        )}

                        {/* --- CASTLE BUILD --- */}
                        {effect.animation === 'castle-build' && (
                            <div className="absolute inset-0 flex items-center justify-center">
                                {/* Base glow */}
                                <motion.div
                                    initial={{ scaleX: 0 }}
                                    animate={{ scaleX: 1 }}
                                    transition={{ duration: 0.5 }}
                                    className="absolute bottom-[20%] w-[80%] h-[20px] bg-nexusPurple/50 blur-xl"
                                />

                                {/* Castle rising */}
                                <motion.div
                                    initial={{ y: 200, opacity: 0, clipPath: 'inset(100% 0 0 0)' }}
                                    animate={{ y: 0, opacity: 1, clipPath: 'inset(0% 0 0 0)' }}
                                    transition={{ duration: 2, ease: "easeOut" }}
                                    className="relative text-[180px] filter drop-shadow-[0_0_60px_rgba(147,51,234,0.6)]"
                                >
                                    🏰
                                    {/* Construction Grid Effect */}
                                    <motion.div
                                        initial={{ opacity: 1 }}
                                        animate={{ opacity: 0 }}
                                        transition={{ duration: 2.5 }}
                                        className="absolute inset-0 bg-[url('https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExaGZ4eHByaHByaHByaHByaHByaHByaHByaHByaHByaHBy/3o7aD2saalBwwftBIY/giphy.gif')] bg-cover mix-blend-overlay opacity-50"
                                        style={{ maskImage: 'linear-gradient(to top, black, transparent)' }}
                                    />
                                </motion.div>

                                {/* Fireworks */}
                                {Array.from({ length: 5 }).map((_, i) => (
                                    <Sparkle key={i} delay={2 + i * 0.2} x={(Math.random() - 0.5) * 300} y={-100} color={['#FFD700', '#FF00FF', '#00FFFF'][i % 3]} />
                                ))}
                            </div>
                        )}
                    </motion.div>
                ))}
            </AnimatePresence>
        </div>
    );
}
