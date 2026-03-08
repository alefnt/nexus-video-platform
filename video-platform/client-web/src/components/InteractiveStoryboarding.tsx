import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Play, Zap, FastForward, CheckCircle2, Wallet, Video, Headphones, FileText, ArrowUpRight, ArrowRight, Fingerprint, Smartphone, Mail, UploadCloud, Image as ImageIcon, Sparkles, Radio, Gift, MessageCircle, Trophy } from 'lucide-react';

const InteractiveStoryboarding = () => {
    const [scene, setScene] = useState<'login' | 'mint' | 'discover' | 'payment_select' | 'play' | 'split' | 'earn'>('login');
    const [contentType, setContentType] = useState<'video' | 'music' | 'article' | 'live' | null>(null);
    const [paymentMode, setPaymentMode] = useState<'buy' | 'stream' | 'free' | 'vip' | null>(null);
    const [progress, setProgress] = useState(0);
    const [spent, setSpent] = useState(0);
    const [watchPartyActive, setWatchPartyActive] = useState(false);

    // Scene: Simulate playback and payment
    useEffect(() => {
        let interval: any;
        if (scene === 'play') {
            if (paymentMode === 'stream') {
                interval = setInterval(() => {
                    setProgress(p => {
                        if (p >= 100) {
                            setScene('split');
                            return 100;
                        }
                        return p + 0.5; // Changed from 1 to 0.5 to double the duration
                    });
                    setSpent(s => s + 0.005); // Simulated $0.005 per tick
                }, 100); // Changed from 50 to 100 to double the duration, total 4x longer (20 seconds)
            } else if (paymentMode === 'buy' || paymentMode === 'vip' || paymentMode === 'free') {
                // Fixed fee or free, just progress the bar
                interval = setInterval(() => {
                    setProgress(p => {
                        if (p >= 100) {
                            setScene('split');
                            return 100;
                        }
                        return p + 0.5; // 200 ticks = 20 seconds
                    });
                }, 100);
            }
        } else if (scene === 'login') {
            setProgress(0);
            setSpent(0);
            setPaymentMode(null);
            setWatchPartyActive(false);
        }
        return () => clearInterval(interval);
    }, [scene, paymentMode]);

    // Scene 3: Auto-transition to Earn dashboard after displaying split
    useEffect(() => {
        if (scene === 'split') {
            const timer = setTimeout(() => {
                setScene('earn');
            }, 4000); // 4 seconds for user to read the split logic
            return () => clearTimeout(timer);
        }
    }, [scene]);

    // Handlers
    const handleLogin = () => setScene('mint');
    const handleMint = () => setScene('discover');
    const selectContent = (type: 'video' | 'music' | 'article' | 'live') => {
        setContentType(type);
        setScene('payment_select');
    };
    const handlePaymentSelect = (mode: 'buy' | 'stream' | 'free' | 'vip') => {
        setPaymentMode(mode);
        if (mode === 'buy') setSpent(1.50);
        else if (mode === 'vip') setSpent(5.00);
        else setSpent(0); // stream or free start at 0
        setScene('play');
    };
    const haltPayment = () => setScene('split');
    const resetStory = () => {
        setScene('login');
        setContentType(null);
        setWatchPartyActive(false);
    };

    return (
        <div className="w-full max-w-5xl mx-auto mb-32 px-6">
            <div className="mb-12">
                <div className="inline-flex items-center gap-2 mb-4">
                    <span className="flex h-3 w-3 relative">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-nexus-cyan opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-3 w-3 bg-nexusCyan"></span>
                    </span>
                    <span className="text-nexus-cyan font-mono text-sm tracking-widest uppercase">Interactive Simulator</span>
                </div>
                <h2 className="text-3xl md:text-5xl font-light mb-4 text-white">The <span className="font-semibold text-nexus-cyan">Web5</span> Lifecycle</h2>
                <p className="text-gray-400 text-lg mb-8">Follow the journey of a single interaction. Click below to begin.</p>
            </div>

            {/* Viewport Screen */}
            <div className="relative aspect-[16/20] md:aspect-[21/9] bg-[#0A0A0A] rounded-3xl overflow-hidden border border-white/10 shadow-[0_0_50px_rgba(0,0,0,0.5)] group">

                {/* ---------- SCENE 0: LOGIN ---------- */}
                <AnimatePresence>
                    {scene === 'login' && (
                        <motion.div
                            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, x: -50 }}
                            className="absolute inset-0 p-8 flex flex-col items-center justify-center z-20 bg-[#0A0A0A]"
                        >
                            <h3 className="text-3xl font-bold mb-8 text-white">Step 1: Frictionless Onboarding</h3>
                            <div className="flex flex-col md:flex-row gap-6 w-full max-w-2xl">
                                {/* Web3 JoyID Login */}
                                <motion.div
                                    whileHover={{ scale: 1.05 }} onClick={handleLogin}
                                    className="cursor-pointer flex-1 rounded-2xl bg-gradient-to-br from-green-900/40 to-black border border-green-500/30 hover:border-green-400 p-6 flex flex-col items-center text-center shadow-[0_0_20px_rgba(34,197,94,0.1)] group/login"
                                >
                                    <div className="w-16 h-16 rounded-full bg-green-500/20 flex items-center justify-center mb-4 group-hover/login:scale-110 transition-transform shadow-[0_0_15px_rgba(34,197,94,0.4)]">
                                        <Fingerprint className="w-8 h-8 text-green-400" />
                                    </div>
                                    <h4 className="text-xl font-bold text-white mb-2">Web3 / JoyID</h4>
                                    <p className="text-gray-400 text-sm">Passkey login. No seed phrases. Biometric verified.</p>
                                    <div className="mt-4 text-green-400 opacity-0 group-hover/login:opacity-100 transition-opacity flex items-center gap-1 text-sm font-bold">
                                        Click to Login <ArrowRight className="w-4 h-4" />
                                    </div>
                                </motion.div>

                                {/* Web2 Login */}
                                <motion.div
                                    whileHover={{ scale: 1.05 }} onClick={handleLogin}
                                    className="cursor-pointer flex-1 rounded-2xl bg-gradient-to-br from-gray-900 to-black border border-white/10 hover:border-white/30 p-6 flex flex-col items-center text-center group/login"
                                >
                                    <div className="flex gap-2 mb-4 group-hover/login:scale-110 transition-transform">
                                        <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center border border-white/10">
                                            <Smartphone className="w-5 h-5 text-gray-300" />
                                        </div>
                                        <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center border border-white/10">
                                            <Mail className="w-5 h-5 text-gray-300" />
                                        </div>
                                    </div>
                                    <h4 className="text-xl font-bold text-white mb-2">Web2 / Social</h4>
                                    <p className="text-gray-400 text-sm">Email or Phone number. Auto-generates invisible wallet inside.</p>
                                    <div className="mt-4 text-white opacity-0 group-hover/login:opacity-100 transition-opacity flex items-center gap-1 text-sm font-bold">
                                        Click to Login <ArrowRight className="w-4 h-4" />
                                    </div>
                                </motion.div>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* ---------- SCENE 1: CREATOR MINT ---------- */}
                <AnimatePresence>
                    {scene === 'mint' && (
                        <motion.div
                            initial={{ opacity: 0, x: 50 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, scale: 0.95 }}
                            className="absolute inset-0 p-8 flex flex-col items-center justify-center z-20 bg-[#0A0A0A]"
                        >
                            <h3 className="text-3xl font-bold mb-2 text-white text-center">Step 2: Creator Upload & Mint</h3>
                            <p className="text-gray-400 mb-8 text-center max-w-xl">Creators upload fresh content. It instantly mints as an NFT on-chain, proving ownership and establishing a revenue split.</p>

                            <motion.div
                                className="w-full max-w-md bg-[#0F0F1A] border border-cyan-500/30 rounded-3xl p-6 shadow-[0_0_30px_rgba(34,211,238,0.15)] relative"
                            >
                                <div className="absolute -top-3 -right-3 bg-cyan-500 text-black text-xs font-bold px-3 py-1 rounded-full flex items-center gap-1 shadow-[0_0_10px_#22d3ee]">
                                    <Sparkles className="w-3 h-3" /> ON-CHAIN NFT
                                </div>
                                <div className="border-2 border-dashed border-gray-600 rounded-xl h-32 flex flex-col items-center justify-center mb-6 bg-white/5">
                                    <UploadCloud className="w-8 h-8 text-gray-400 mb-2" />
                                    <span className="text-gray-500 text-sm font-mono">&lt;drag & drop media&gt;</span>
                                </div>
                                <div className="space-y-3 mb-6">
                                    <div className="h-2 bg-white/10 rounded-full w-3/4"></div>
                                    <div className="h-2 bg-white/10 rounded-full w-1/2"></div>
                                </div>
                                <div className="border border-white/10 rounded-xl p-3 mb-6 bg-black/50">
                                    <div className="flex justify-between items-center mb-2">
                                        <span className="text-white text-sm font-bold">Revenue Split</span>
                                        <span className="text-nexusCyan text-xs px-2 py-0.5 rounded-full bg-cyan-500/10">Smart Contract</span>
                                    </div>
                                    <div className="flex items-center gap-2 text-sm text-gray-400">
                                        <div className="w-6 h-6 rounded-full bg-blue-500/20 text-blue-400 flex flex-col items-center justify-center text-xs">U</div> 80% You
                                        <span className="text-gray-600">|</span>
                                        <div className="w-6 h-6 rounded-full bg-nexusPurple/20 text-nexusPurple flex flex-col items-center justify-center text-xs">C</div> 20% Co-creator
                                    </div>
                                </div>
                                <motion.button
                                    onClick={handleMint}
                                    whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
                                    className="w-full py-3 bg-gradient-to-r from-nexus-cyan to-blue-500 text-black font-bold rounded-xl shadow-lg flex items-center justify-center gap-2"
                                >
                                    Mint Ownership NFT <ArrowRight className="w-4 h-4" />
                                </motion.button>
                            </motion.div>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* ---------- SCENE 2: DISCOVER ---------- */}
                <AnimatePresence>
                    {scene === 'discover' && (
                        <motion.div
                            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, scale: 0.95 }}
                            className="absolute inset-0 p-8 flex flex-col z-20"
                        >
                            <h3 className="text-2xl font-bold mb-6 text-center text-white">Step 3: Discover & Select</h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 h-full items-center px-4">
                                {/* Video Option */}
                                <motion.div whileHover={{ scale: 1.05 }} onClick={() => selectContent('video')} className="cursor-pointer group/card h-64 rounded-2xl bg-gradient-to-br from-blue-900/50 to-black border border-blue-500/20 hover:border-blue-500/60 p-6 flex flex-col justify-between relative overflow-hidden">
                                    <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1536440136628-849c177e76a1?auto=format&fit=crop&q=80')] bg-cover opacity-20 group-hover/card:opacity-40 transition-opacity" />
                                    <Video className="w-10 h-10 text-blue-400 relative z-10" />
                                    <div className="relative z-10">
                                        <h4 className="text-xl font-bold text-white mb-1">Sci-Fi Short: "The Edge"</h4>
                                        <p className="text-sm font-mono text-blue-400 bg-blue-500/10 px-2 py-1 rounded inline-block">Stream: $0.05/min</p>
                                    </div>
                                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-blue-500 text-white rounded-full p-4 opacity-0 group-hover/card:opacity-100 transition-all scale-50 group-hover/card:scale-100 z-20 shadow-[0_0_20px_rgba(59,130,246,0.5)]">
                                        <Play className="w-6 h-6 ml-1" />
                                    </div>
                                </motion.div>

                                {/* Music Option */}
                                <motion.div whileHover={{ scale: 1.05 }} onClick={() => selectContent('music')} className="cursor-pointer group/card h-64 rounded-2xl bg-gradient-to-br from-purple-900/50 to-black border border-nexusPurple/20 hover:border-nexusPurple/60 p-6 flex flex-col justify-between relative overflow-hidden">
                                    <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1514525253161-7a46d19cd819?auto=format&fit=crop&q=80')] bg-cover opacity-20 group-hover/card:opacity-40 transition-opacity" />
                                    <Headphones className="w-10 h-10 text-nexusPurple relative z-10" />
                                    <div className="relative z-10">
                                        <h4 className="text-xl font-bold text-white mb-1">Lo-Fi Beats 2026</h4>
                                        <p className="text-sm font-mono text-nexusPurple bg-nexusPurple/10 px-2 py-1 rounded inline-block">Stream: $0.01/min</p>
                                    </div>
                                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-nexusPurple text-white rounded-full p-4 opacity-0 group-hover/card:opacity-100 transition-all scale-50 group-hover/card:scale-100 z-20 shadow-[0_0_20px_rgba(168,85,247,0.5)]">
                                        <Play className="w-6 h-6 ml-1" />
                                    </div>
                                </motion.div>

                                {/* Article Option */}
                                <motion.div whileHover={{ scale: 1.05 }} onClick={() => selectContent('article')} className="cursor-pointer group/card h-64 rounded-2xl bg-gradient-to-br from-pink-900/50 to-black border border-pink-500/20 hover:border-pink-500/60 p-6 flex flex-col justify-between relative overflow-hidden">
                                    <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1499750310107-5fef28a66643?auto=format&fit=crop&q=80')] bg-cover opacity-20 group-hover/card:opacity-40 transition-opacity" />
                                    <FileText className="w-10 h-10 text-nexusPink relative z-10" />
                                    <div className="relative z-10">
                                        <h4 className="text-xl font-bold text-white mb-1">State of Web5 Crypto</h4>
                                        <p className="text-sm font-mono text-nexusPink bg-nexusPink/10 px-2 py-1 rounded inline-block">Buy: $0.15 flat</p>
                                    </div>
                                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-nexusPink text-white rounded-full p-4 opacity-0 group-hover/card:opacity-100 transition-all scale-50 group-hover/card:scale-100 z-20 shadow-[0_0_20px_rgba(236,72,153,0.5)]">
                                        <Play className="w-6 h-6 ml-1" />
                                    </div>
                                </motion.div>

                                {/* Live & Gamification Option */}
                                <motion.div whileHover={{ scale: 1.05 }} onClick={() => selectContent('live')} className="cursor-pointer group/card h-64 rounded-2xl bg-gradient-to-br from-yellow-900/50 to-black border border-yellow-500/20 hover:border-yellow-500/60 p-6 flex flex-col justify-between relative overflow-hidden">
                                    <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1511512578047-dfb367046420?auto=format&fit=crop&q=80')] bg-cover opacity-20 group-hover/card:opacity-40 transition-opacity" />
                                    <Radio className="w-10 h-10 text-yellow-400 relative z-10" />
                                    <div className="relative z-10">
                                        <h4 className="text-xl font-bold text-white mb-1">Live: Cyber Tournament</h4>
                                        <p className="text-sm font-mono text-yellow-400 bg-yellow-500/10 px-2 py-1 rounded inline-block flex items-center gap-1 w-max">
                                            <Trophy className="w-3 h-3" /> Earn +50 Pts/min
                                        </p>
                                    </div>
                                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-yellow-500 text-white rounded-full p-4 opacity-0 group-hover/card:opacity-100 transition-all scale-50 group-hover/card:scale-100 z-20 shadow-[0_0_20px_rgba(234,179,8,0.5)]">
                                        <Play className="w-6 h-6 ml-1" />
                                    </div>
                                </motion.div>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* ---------- SCENE 3.5: PAYMENT SELECTION ---------- */}
                <AnimatePresence>
                    {scene === 'payment_select' && (
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 1.05 }}
                            className="absolute inset-0 p-8 flex flex-col items-center justify-center z-20 bg-[#0A0A0A] bg-opacity-95"
                        >
                            <h3 className="text-3xl font-bold mb-2 text-white text-center">Step 4: Choose Payment Mode</h3>
                            <p className="text-gray-400 mb-8 text-center max-w-xl">How do you want to consume this content?</p>

                            {contentType === 'live' ? (
                                <div className="flex flex-col md:flex-row gap-6 w-full max-w-2xl">
                                    {/* VIP Access */}
                                    <motion.div
                                        whileHover={{ scale: 1.05 }} onClick={() => handlePaymentSelect('vip')}
                                        className="cursor-pointer flex-1 rounded-2xl bg-gradient-to-br from-yellow-900/40 to-black border border-yellow-500/30 hover:border-yellow-400 p-6 flex flex-col items-center text-center shadow-[0_0_20px_rgba(234,179,8,0.1)] group/pay"
                                    >
                                        <div className="w-16 h-16 rounded-full bg-yellow-500/20 flex items-center justify-center mb-4 group-hover/pay:scale-110 transition-transform">
                                            <Trophy className="w-8 h-8 text-yellow-400" />
                                        </div>
                                        <h4 className="text-xl font-bold text-white mb-2">VIP Backstage</h4>
                                        <p className="text-yellow-400 font-mono text-2xl font-black mb-2">$5.00</p>
                                        <p className="text-gray-400 text-sm">Ad-free. Exclusive chat badge. Front row seat.</p>
                                    </motion.div>

                                    {/* Free Access */}
                                    <motion.div
                                        whileHover={{ scale: 1.05 }} onClick={() => handlePaymentSelect('free')}
                                        className="cursor-pointer flex-1 rounded-2xl bg-gradient-to-br from-gray-900 to-black border border-gray-600 hover:border-gray-400 p-6 flex flex-col items-center text-center group/pay"
                                    >
                                        <div className="w-16 h-16 rounded-full bg-gray-800 flex items-center justify-center mb-4 group-hover/pay:scale-110 transition-transform border border-gray-600">
                                            <Play className="w-8 h-8 text-gray-400 ml-1" />
                                        </div>
                                        <h4 className="text-xl font-bold text-white mb-2">Free Access</h4>
                                        <p className="text-gray-400 font-mono text-xl font-bold mb-2 uppercase">Ad-Supported</p>
                                        <p className="text-gray-500 text-sm">Watch with ads. Support via Super Tips.</p>
                                    </motion.div>
                                </div>
                            ) : (
                                <div className="flex flex-col md:flex-row gap-6 w-full max-w-2xl">
                                    {/* One-Time Buy */}
                                    <motion.div
                                        whileHover={{ scale: 1.05 }} onClick={() => handlePaymentSelect('buy')}
                                        className="cursor-pointer flex-1 rounded-2xl bg-gradient-to-br from-purple-900/40 to-black border border-nexusPurple/30 hover:border-purple-400 p-6 flex flex-col items-center text-center shadow-[0_0_20px_rgba(168,85,247,0.1)] group/pay"
                                    >
                                        <div className="w-16 h-16 rounded-full bg-nexusPurple/20 flex items-center justify-center mb-4 group-hover/pay:scale-110 transition-transform">
                                            <Wallet className="w-8 h-8 text-nexusPurple" />
                                        </div>
                                        <h4 className="text-xl font-bold text-white mb-2">One-Time Buy</h4>
                                        <p className="text-nexusPurple font-mono text-2xl font-black mb-2">$1.50</p>
                                        <p className="text-gray-400 text-sm">Pay a flat fee upfront. Own access permanently.</p>
                                    </motion.div>

                                    {/* Stream Payment */}
                                    <motion.div
                                        whileHover={{ scale: 1.05 }} onClick={() => handlePaymentSelect('stream')}
                                        className="cursor-pointer flex-1 rounded-2xl bg-gradient-to-br from-nexus-cyan/20 to-black border border-nexus-cyan/30 hover:border-nexusCyan p-6 flex flex-col items-center text-center shadow-[0_0_20px_rgba(34,211,238,0.1)] group/pay"
                                    >
                                        <div className="w-16 h-16 rounded-full bg-cyan-500/20 flex items-center justify-center mb-4 group-hover/pay:scale-110 transition-transform">
                                            <FastForward className="w-8 h-8 text-nexus-cyan" />
                                        </div>
                                        <h4 className="text-xl font-bold text-white mb-2">Pay-Per-Second</h4>
                                        <p className="text-nexus-cyan font-mono text-2xl font-black mb-2">$0.05 <span className="text-sm">/ min</span></p>
                                        <p className="text-gray-400 text-sm">Micro-payments stream as you watch. Stop anytime.</p>
                                    </motion.div>
                                </div>
                            )}
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* ---------- SCENE 4: PLAY & CONSUME ---------- */}
                <AnimatePresence>
                    {scene === 'play' && (
                        <motion.div
                            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                            className="absolute inset-0 z-20 flex"
                        >
                            {/* MEDIA PLAYBACK AREA */}
                            <div className="absolute inset-0 z-0 bg-black flex items-center justify-center overflow-hidden">
                                {contentType === 'video' && (
                                    <video
                                        autoPlay loop controls playsInline
                                        className="w-full h-full object-cover opacity-80"
                                        src="https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4"
                                    />
                                )}
                                {contentType === 'live' && (
                                    <video
                                        autoPlay loop muted playsInline
                                        className="w-full h-full object-cover opacity-60 pointer-events-none"
                                        src="https://joy1.videvo.net/videvo_files/video/free/2014-12/large_watermarked/Metal_Bar_preview.mp4"
                                    />
                                )}
                                {contentType === 'music' && (
                                    <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-purple-900 to-black relative">
                                        <audio
                                            autoPlay loop controls
                                            className="absolute bottom-32 z-50 w-full max-w-md"
                                            src="https://cdn.pixabay.com/download/audio/2022/01/18/audio_d0a13f69d2.mp3"
                                        />
                                        <div className="w-48 h-48 rounded-full border-4 border-nexusPurple flex items-center justify-center bg-[url('https://images.unsplash.com/photo-1514525253161-7a46d19cd819?auto=format&fit=crop&q=80')] bg-cover relative animate-[spin_10s_linear_infinite] mb-8">
                                            <div className="w-8 h-8 bg-black rounded-full border-2 border-nexusPurple"></div>
                                        </div>
                                        {/* Visualization waves */}
                                        <div className="flex gap-2 items-end h-24 mb-16">
                                            {[...Array(20)].map((_, i) => (
                                                <motion.div
                                                    key={i}
                                                    className="w-3 bg-nexusPurple rounded-t-sm opacity-80 shadow-[0_0_10px_#a855f7]"
                                                    animate={{ height: [`20%`, `${Math.random() * 80 + 20}%`, `20%`] }}
                                                    transition={{ repeat: Infinity, duration: Math.random() * 0.5 + 0.5, ease: "easeInOut" }}
                                                />
                                            ))}
                                        </div>
                                    </div>
                                )}
                                {contentType === 'article' && (
                                    <div className="w-full h-full bg-[#f4f4f4] text-black overflow-hidden relative">
                                        <div className="w-full h-32 bg-gradient-to-b from-[#f4f4f4] to-transparent absolute top-0 z-10" />
                                        <div className="w-full h-32 bg-gradient-to-t from-[#f4f4f4] to-transparent absolute bottom-0 z-10" />
                                        <motion.div
                                            className="max-w-2xl mx-auto p-12 text-lg font-serif leading-relaxed opacity-80 pt-24"
                                            animate={{ y: [-50, -400] }}
                                            transition={{ duration: 40, ease: "linear" }}
                                        >
                                            <h1 className="text-4xl font-black mb-6">Bitcoin: A Peer-to-Peer Electronic Cash System</h1>
                                            <h2 className="text-xl font-bold mb-4">Satoshi Nakamoto</h2>
                                            <p className="mb-4 text-justify"><strong>Abstract.</strong> A purely peer-to-peer version of electronic cash would allow online payments to be sent directly from one party to another without going through a financial institution. Digital signatures provide part of the solution, but the main benefits are lost if a trusted third party is still required to prevent double-spending.</p>
                                            <p className="mb-4 text-justify">We propose a solution to the double-spending problem using a peer-to-peer network. The network timestamps transactions by hashing them into an ongoing chain of hash-based proof-of-work, forming a record that cannot be changed without redoing the proof-of-work.</p>
                                            <p className="mb-4 text-justify">The longest chain not only serves as proof of the sequence of events witnessed, but proof that it came from the largest pool of CPU power. As long as a majority of CPU power is controlled by nodes that are not cooperating to attack the network, they'll generate the longest chain and outpace attackers.</p>
                                            <p className="mb-4 text-justify">The network itself requires minimal structure. Messages are broadcast on a best effort basis, and nodes can leave and rejoin the network at will, accepting the longest proof-of-work chain as proof of what happened while they were gone.</p>
                                        </motion.div>
                                    </div>
                                )}
                            </div>

                            <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-black/80 z-10 pointer-events-none" />

                            {/* Top Bar */}
                            <div className="absolute top-6 left-6 right-6 flex justify-between items-start pointer-events-none z-20">
                                <div className="text-white hidden md:block drop-shadow-md">
                                    <h3 className="text-2xl font-bold tracking-tight">Step 5: Consumption</h3>
                                    <p className="text-gray-300 text-sm">{paymentMode === 'stream' ? "Payment is dripping per second." : "One-time payment confirmed."}</p>
                                </div>
                                <div className="bg-black/80 backdrop-blur-xl border border-nexus-cyan/50 p-4 rounded-2xl flex items-center gap-6 shadow-[0_0_30px_rgba(34,211,238,0.2)] pointer-events-auto mx-auto md:mx-0">
                                    <div className="flex flex-col">
                                        <span className="text-xs text-gray-400 font-mono mb-1 uppercase tracking-wider">{paymentMode === 'stream' ? 'Stream Active' : paymentMode === 'free' ? 'Free Access' : 'Paid in Full'}</span>
                                        <div className="flex items-baseline gap-1 font-mono justify-end">
                                            <span className="text-3xl font-black text-nexus-cyan">${spent.toFixed(4)}</span>
                                            <span className="text-xs text-cyan-500">USDC</span>
                                        </div>
                                    </div>
                                    <div className="w-10 h-10 rounded-full bg-cyan-500/20 flex items-center justify-center relative">
                                        {paymentMode === 'stream' && <div className="absolute inset-0 border-2 border-cyan-500/50 rounded-full animate-ping opacity-50" />}
                                        {(paymentMode === 'buy' || paymentMode === 'vip' || paymentMode === 'free') ? <CheckCircle2 className="w-5 h-5 text-nexus-cyan" /> : <FastForward className="w-5 h-5 text-nexus-cyan" />}
                                    </div>
                                </div>
                            </div>

                            {/* Watch Party Overlay */}
                            <AnimatePresence>
                                {watchPartyActive && (
                                    <motion.div
                                        initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}
                                        className="absolute top-28 left-1/2 -translate-x-1/2 z-30 bg-black/60 backdrop-blur-md border border-nexusPurple/50 rounded-full px-6 py-2 flex items-center gap-4 shadow-[0_0_20px_rgba(168,85,247,0.3)] pointer-events-auto"
                                    >
                                        <div className="flex -space-x-3">
                                            <div className="w-8 h-8 rounded-full bg-blue-500 border-2 border-black flex items-center justify-center text-xs font-bold text-white shadow-sm z-30">Me</div>
                                            <div className="w-8 h-8 rounded-full bg-nexusPink border-2 border-black flex items-center justify-center text-xs font-bold text-white shadow-sm z-20">AL</div>
                                            <div className="w-8 h-8 rounded-full bg-green-500 border-2 border-black flex items-center justify-center text-xs font-bold text-white shadow-sm z-10 animate-pulse">..</div>
                                        </div>
                                        <div className="w-px h-6 bg-white/20"></div>
                                        <span className="text-nexusPurple font-semibold text-sm">Watch Party Active</span>
                                        <button className="text-xs bg-nexusPurple/20 text-purple-300 px-3 py-1 rounded-full hover:bg-nexusPurple/40 transition-colors">Copy Invite</button>
                                    </motion.div>
                                )}
                            </AnimatePresence>

                            {/* Center Status */}
                            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none text-center z-20">
                                {paymentMode === 'stream' && (
                                    <div className="w-24 h-24 border-4 border-r-nexus-cyan border-b-cyan-500 border-t-transparent border-l-transparent rounded-full animate-spin mx-auto mb-4 opacity-50" />
                                )}
                            </div>

                            {/* Bottom Controls */}
                            <div className="absolute bottom-0 left-0 w-full p-8 bg-gradient-to-t from-black to-transparent flex flex-col items-center z-20">
                                <div className="w-full max-w-2xl h-1 bg-white/20 rounded-full mb-6 overflow-hidden">
                                    <div className="h-full bg-nexus-cyan" style={{ width: `${progress}%` }} />
                                </div>
                                <div className="flex gap-4">
                                    <motion.button
                                        onClick={haltPayment}
                                        whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
                                        className="px-8 py-3 bg-red-600/90 text-white font-bold rounded-full border border-red-400/50 hover:bg-red-500 transition-colors shadow-[0_0_20px_rgba(220,38,38,0.4)] z-50 flex items-center gap-2 pointer-events-auto"
                                    >
                                        <div className="w-3 h-3 bg-white rounded-sm" /> Stop & Finalize Payment
                                    </motion.button>
                                    <motion.button
                                        whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
                                        className="px-6 py-3 bg-yellow-500/80 text-black font-bold rounded-full border border-yellow-400 hover:bg-yellow-400 transition-colors shadow-[0_0_20px_rgba(234,179,8,0.4)] z-50 flex items-center gap-2 pointer-events-auto"
                                    >
                                        <Gift className="w-5 h-5" /> Send Super Tip
                                    </motion.button>
                                    <motion.button
                                        onClick={() => setWatchPartyActive(!watchPartyActive)}
                                        whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
                                        className={`px-6 py-3 font-bold rounded-full border transition-colors shadow-[0_0_20px_rgba(168,85,247,0.2)] z-50 flex items-center gap-2 pointer-events-auto ${watchPartyActive ? 'bg-nexusPurple text-white border-purple-400' : 'bg-purple-900/40 text-purple-300 border-nexusPurple/50 hover:bg-purple-800/60'}`}
                                    >
                                        <MessageCircle className="w-5 h-5" /> {watchPartyActive ? 'End Party' : 'Host Watch Party'}
                                    </motion.button>
                                </div>
                            </div>

                            {/* Live Chat Overlay (Decorative) */}
                            {contentType === 'live' && (
                                <div className="absolute right-6 bottom-32 w-64 h-48 bg-black/40 backdrop-blur-md border border-white/10 rounded-xl p-4 flex flex-col justify-end gap-2 overflow-hidden pointer-events-none z-20">
                                    <div className="text-white/70 text-sm"><span className="text-nexus-pink font-bold">User99:</span> Epic stream! 🔥</div>
                                    <div className="text-white/70 text-sm"><span className="text-nexus-cyan font-bold">Alice:</span> Wow that was crazy</div>
                                    <div className="text-white/70 text-sm flex items-center gap-1"><span className="text-yellow-400 font-bold">Bob42 sent $5 Tip!</span> <Gift className="w-3 h-3 text-yellow-400" /></div>
                                </div>
                            )}
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* ---------- SCENE 4: THE SPLIT ---------- */}
                <AnimatePresence>
                    {scene === 'split' && (
                        <motion.div
                            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, y: -50 }}
                            className="absolute inset-0 bg-[#0A0A0A] z-30 flex flex-col items-center justify-center p-8"
                        >
                            <h3 className="text-3xl font-bold text-white mb-2 text-center">Step 6: Trustless Split</h3>
                            <p className="text-gray-400 font-mono mb-12 text-center text-sm md:text-base">Total paid: ${spent.toFixed(4)} USDC via Fiber Network</p>

                            <div className="w-full max-w-4xl flex justify-between items-end relative h-48 self-center">
                                {/* Lines dropping from top center to the components */}
                                <svg className="absolute inset-0 w-full h-full z-0 pointer-events-none" style={{ overflow: 'visible' }}>
                                    <motion.path d="M 50% 0 C 50% 30%, 15% 40%, 15% 100%" fill="none" stroke="#22D3EE" strokeWidth="2" strokeDasharray="5 5" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 1 }} />
                                    <motion.path d="M 50% 0 C 50% 60%, 50% 80%, 50% 100%" fill="none" stroke="#EC4899" strokeWidth="2" strokeDasharray="5 5" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 1 }} />
                                    <motion.path d="M 50% 0 C 50% 30%, 85% 40%, 85% 100%" fill="none" stroke="#EAB308" strokeWidth="2" strokeDasharray="5 5" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 1 }} />

                                    {/* Moving Light Orbs */}
                                    <motion.circle r="4" fill="#22D3EE" initial={{ offsetDistance: "0%" }} animate={{ offsetDistance: "100%" }} transition={{ duration: 1.5, ease: "easeOut" }} style={{ offsetPath: 'path("M 50% 0 C 50% 30%, 15% 40%, 15% 100%")' }} />
                                    <motion.circle r="4" fill="#EC4899" initial={{ offsetDistance: "0%" }} animate={{ offsetDistance: "100%" }} transition={{ duration: 1.5, ease: "easeOut", delay: 0.2 }} style={{ offsetPath: 'path("M 50% 0 C 50% 60%, 50% 80%, 50% 100%")' }} />
                                    <motion.circle r="4" fill="#EAB308" initial={{ offsetDistance: "0%" }} animate={{ offsetDistance: "100%" }} transition={{ duration: 1.5, ease: "easeOut", delay: 0.4 }} style={{ offsetPath: 'path("M 50% 0 C 50% 30%, 85% 40%, 85% 100%")' }} />
                                </svg>

                                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 1 }} className="flex flex-col items-center z-10 w-[30%]">
                                    <div className="w-12 h-12 md:w-16 md:h-16 rounded-full bg-cyan-500/20 border border-cyan-500 flex items-center justify-center mb-3 text-nexusCyan font-bold text-lg md:text-xl shadow-[0_0_20px_rgba(34,211,238,0.3)]">80%</div>
                                    <div className="text-white font-bold text-center text-sm md:text-base">Creator</div>
                                    <div className="font-mono text-nexusCyan text-xs md:text-sm mt-1">+${(spent * 0.8).toFixed(4)}</div>
                                </motion.div>

                                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 1.2 }} className="flex flex-col items-center z-10 w-[30%]">
                                    <div className="w-12 h-12 md:w-16 md:h-16 rounded-full bg-nexusPink/20 border border-pink-500 flex items-center justify-center mb-3 text-nexusPink font-bold text-lg md:text-xl shadow-[0_0_20px_rgba(236,72,153,0.3)]">15%</div>
                                    <div className="text-white font-bold text-center text-sm md:text-base">Co-creators</div>
                                    <div className="font-mono text-nexusPink text-xs md:text-sm mt-1">+${(spent * 0.15).toFixed(4)}</div>
                                </motion.div>

                                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 1.4 }} className="flex flex-col items-center z-10 w-[30%]">
                                    <div className="w-12 h-12 md:w-16 md:h-16 rounded-full bg-yellow-500/20 border border-yellow-500 flex items-center justify-center mb-3 text-yellow-400 font-bold text-lg md:text-xl shadow-[0_0_20px_rgba(234,179,8,0.3)]">5%</div>
                                    <div className="text-white font-bold text-center text-sm md:text-base">Treasury</div>
                                    <div className="font-mono text-yellow-400 text-xs md:text-sm mt-1">+${(spent * 0.05).toFixed(4)}</div>
                                </motion.div>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* ---------- SCENE 5: CREATOR EARN ---------- */}
                <AnimatePresence>
                    {scene === 'earn' && (
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}
                            className="absolute inset-0 bg-[#0A0A0A] z-40 p-8 flex flex-col justify-between items-start"
                        >
                            <div className="mt-6 w-full hidden md:block text-left mb-6">
                                <h3 className="text-3xl font-bold text-white tracking-tight">Step 7: Dual Economy Settlement</h3>
                                <p className="text-gray-400 mt-2">Creator earns USDC instantly. Consumer earns Points for their engagement.</p>
                            </div>

                            <div className="w-full flex flex-col lg:flex-row gap-6 items-center justify-center self-center w-full max-w-5xl">
                                {/* Creator Earns (USDC) */}
                                <motion.div
                                    initial={{ x: -50, opacity: 0 }} animate={{ x: 0, opacity: 1 }} transition={{ delay: 0.3 }}
                                    className="flex-1 bg-[#0F0F1A] border border-blue-500/20 rounded-3xl p-6 shadow-[0_0_40px_rgba(59,130,246,0.1)] relative w-full max-w-sm"
                                >
                                    <div className="flex items-center justify-between mb-6">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-nexusCyan to-blue-500 flex items-center justify-center">
                                                <Wallet className="w-5 h-5 text-white" />
                                            </div>
                                            <div>
                                                <div className="text-white font-bold text-sm">Creator Studio</div>
                                                <div className="text-gray-500 text-xs">USDC Revenue</div>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="mb-1 text-gray-400 text-xs">Total Balance</div>
                                    <div className="flex items-baseline gap-1 mb-6 border-b border-white/5 pb-6">
                                        <span className="text-3xl font-black text-white">$42,069.</span><span className="text-xl text-gray-500">80</span>
                                    </div>

                                    <div className="bg-green-500/10 border border-green-500/30 rounded-xl p-3 flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 rounded-full bg-green-500/20 text-green-400 flex items-center justify-center">
                                                <ArrowUpRight className="w-4 h-4" />
                                            </div>
                                            <div>
                                                <div className="text-white font-medium text-xs">Fiber Income</div>
                                                <div className="text-green-500 font-mono text-xs">+${(spent * 0.8).toFixed(4)} USDC</div>
                                            </div>
                                        </div>
                                    </div>
                                </motion.div>

                                {/* Consumer Earns (Points) */}
                                <motion.div
                                    initial={{ x: 50, opacity: 0 }} animate={{ x: 0, opacity: 1 }} transition={{ delay: 0.5 }}
                                    className="flex-1 bg-[#0F0F1A] border border-yellow-500/20 rounded-3xl p-6 shadow-[0_0_40px_rgba(234,179,8,0.1)] relative w-full max-w-sm"
                                >
                                    <div className="flex items-center justify-between mb-6">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-yellow-400 to-orange-500 flex items-center justify-center">
                                                <Trophy className="w-5 h-5 text-black" />
                                            </div>
                                            <div>
                                                <div className="text-white font-bold text-sm">Consumer Wallet</div>
                                                <div className="text-gray-500 text-xs">Watch-to-Earn</div>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="mb-1 text-gray-400 text-xs">Total Points</div>
                                    <div className="flex items-baseline gap-1 mb-6 border-b border-white/5 pb-6">
                                        <span className="text-3xl font-black text-yellow-400">14,250</span><span className="text-xl text-yellow-600"> PTS</span>
                                    </div>

                                    <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-3 flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 rounded-full bg-yellow-500/20 text-yellow-400 flex items-center justify-center">
                                                <FastForward className="w-4 h-4" />
                                            </div>
                                            <div>
                                                <div className="text-white font-medium text-xs">Engagement Reward</div>
                                                <div className="text-yellow-400 font-mono text-xs">+150 PTS</div>
                                            </div>
                                        </div>
                                    </div>
                                </motion.div>
                            </div>

                            <div className="md:pb-6 w-full pointer-events-auto">
                                <motion.button
                                    onClick={resetStory}
                                    whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
                                    className="px-8 py-3 bg-white text-black font-bold rounded-full hover:bg-gray-200 transition-colors inline-flex items-center gap-2"
                                >
                                    Experience Again <ArrowRight className="w-4 h-4" />
                                </motion.button>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>

            </div>

            {/* Progress indicators below */}
            <div className="flex mt-8 gap-4 justify-center">
                {['login', 'mint', 'discover', 'payment_select', 'play', 'split', 'earn'].map((s) => (
                    <div key={s} className="flex items-center">
                        <div className={`h-2 rounded-full transition-all duration-500 ${scene === s ? 'w-12 bg-nexus-cyan' : 'w-4 bg-white/20'}`} />
                    </div>
                ))}
            </div>
            <p className="text-sm font-mono text-gray-500 mt-6 mt-4 text-center">
                * The visual above simulates a complete 7-step lifecycle powered by Nervos CKB Fiber Network.
            </p>
        </div>
    );
};

export default InteractiveStoryboarding;
