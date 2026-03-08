import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowRight, Coins, Zap, Users, Play, Shield, Database, Cpu, PieChart, MousePointerClick, MonitorPlay, Wallet, Video, Music, BookText, FastForward, CheckCircle2, Headphones, FileText, ArrowUpRight, Trophy, Radio, Gift } from 'lucide-react';
import TopNav from '../components/TopNav';
import InteractiveStoryboarding from '../components/InteractiveStoryboarding';

// --- DATA TYPES ---
type FlowNode = {
    id: string;
    label: string;
    icon: any;
    color: string;
    glowColor: string;
    position: 'top' | 'center' | 'bottom-left' | 'bottom-right' | 'bottom-center';
    desc: string;
    value?: string;
};

const NODES: FlowNode[] = [
    { id: 'user', label: 'Consumer', icon: Users, color: 'bg-blue-500', glowColor: 'rgba(59,130,246,0.6)', position: 'top', desc: 'Streams content or sends tips', value: '100% Volume' },
    { id: 'contract', label: 'Fiber Smart Contract', icon: Cpu, color: 'bg-nexusPurple', glowColor: 'rgba(168,85,247,0.6)', position: 'center', desc: 'Trustless splitting & routing Engine', value: 'Execution Layer' },
    { id: 'creator', label: 'Creator', icon: Play, color: 'bg-nexus-cyan', glowColor: 'rgba(34,211,238,0.6)', position: 'bottom-left', desc: 'Receives direct payout', value: '80% Share' },
    { id: 'co-creator', label: 'Co-Creators', icon: Users, color: 'bg-nexusPink', glowColor: 'rgba(236,72,153,0.6)', position: 'bottom-center', desc: 'Automated splits to collaborators', value: '15% Share' },
    { id: 'platform', label: 'Protocol Treasury', icon: Shield, color: 'bg-yellow-500', glowColor: 'rgba(234,179,8,0.6)', position: 'bottom-right', desc: 'Network maintenance & DAO', value: '5% Fee' },
];

// --- COMPONENTS ---

const FlowParticle = ({ startX, startY, endX, endY, color, delay = 0, duration = 2 }: any) => {
    return (
        <motion.div
            className="absolute w-2 h-2 rounded-full z-10"
            style={{
                backgroundColor: color,
                boxShadow: `0 0 10px ${color}, 0 0 20px ${color}`
            }}
            initial={{ x: startX, y: startY, opacity: 0, scale: 0 }}
            animate={{
                x: [startX, endX],
                y: [startY, endY],
                opacity: [0, 1, 1, 0],
                scale: [0.5, 1.5, 1, 0.5]
            }}
            transition={{
                duration,
                delay,
                repeat: Infinity,
                ease: "easeInOut"
            }}
        />
    );
};

const NodeConnection = ({ path, color, isActive }: { path: string, color: string, isActive: boolean }) => (
    <svg className="absolute inset-0 w-full h-full pointer-events-none z-0" style={{ overflow: 'visible' }}>
        <motion.path
            d={path}
            fill="none"
            stroke={color}
            strokeWidth="3"
            strokeDasharray="8 8"
            initial={{ opacity: 0.2, strokeDashoffset: 0 }}
            animate={{
                opacity: isActive ? 0.8 : 0.2,
                strokeDashoffset: isActive ? -100 : 0
            }}
            transition={{
                strokeDashoffset: { duration: 3, repeat: Infinity, ease: "linear" },
                opacity: { duration: 0.5 }
            }}
            style={{ filter: `drop-shadow(0 0 5px ${color})` }}
        />
    </svg>
);

const TokenomicsFlow = () => {
    const [activePath, setActivePath] = useState<number>(0);
    const [hoveredNode, setHoveredNode] = useState<string | null>(null);

    // Auto-cycle through flow states
    useEffect(() => {
        const interval = setInterval(() => {
            setActivePath(p => (p + 1) % 4);
        }, 3000);
        return () => clearInterval(interval);
    }, []);

    const isPathActive = (pathIndex: number) => activePath === pathIndex || activePath === 0;

    return (
        <div className="relative w-full max-w-5xl mx-auto h-[700px] flex items-center justify-center -mt-10">
            {/* Background glowing grid */}
            <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxwYXRoIGQ9Ik02MCAwaC0ydjYwaDJWMHptLTYwIDYwaDYwdi0yaC02MHYyeiIgZmlsbD0iIzMzMyIgZmlsbC1vcGFjaXR5PSIwLjEiLz4KPC9zdmc+')] opacity-50" />

            <div className="relative w-full h-[600px]">
                {/* CONNECTIONS (Hardcoded SVG paths for typical desktop layout) */}
                {/* User to Contract */}
                <NodeConnection path="M 500 120 C 500 200, 500 250, 500 300" color="#3B82F6" isActive={isPathActive(0)} />
                {/* Contract to Creator */}
                <NodeConnection path="M 450 350 C 300 400, 250 450, 200 500" color="#22D3EE" isActive={isPathActive(1)} />
                {/* Contract to Co-Creator */}
                <NodeConnection path="M 500 350 C 500 420, 500 450, 500 500" color="#EC4899" isActive={isPathActive(2)} />
                {/* Contract to Platform */}
                <NodeConnection path="M 550 350 C 700 400, 750 450, 800 500" color="#EAB308" isActive={isPathActive(3)} />

                {/* PARTICLES */}
                {isPathActive(0) && <FlowParticle startX={500} startY={120} endX={500} endY={300} color="#3B82F6" />}
                {isPathActive(1) && <FlowParticle startX={480} startY={350} endX={200} endY={500} color="#22D3EE" delay={0.2} />}
                {isPathActive(2) && <FlowParticle startX={500} startY={350} endX={500} endY={500} color="#EC4899" delay={0.4} />}
                {isPathActive(3) && <FlowParticle startX={520} startY={350} endX={800} endY={500} color="#EAB308" delay={0.6} />}

                {/* NODES */}
                {NODES.map((node) => {
                    let posClass = "";
                    if (node.position === 'top') posClass = "left-1/2 -translate-x-1/2 top-4";
                    if (node.position === 'center') posClass = "left-1/2 -translate-x-1/2 top-[280px]";
                    if (node.position === 'bottom-left') posClass = "left-[10%] top-[480px]";
                    if (node.position === 'bottom-center') posClass = "left-1/2 -translate-x-1/2 top-[480px]";
                    if (node.position === 'bottom-right') posClass = "right-[10%] top-[480px]";

                    const isHovered = hoveredNode === node.id;
                    const Icon = node.icon;

                    return (
                        <div
                            key={node.id}
                            className={`absolute ${posClass} z-20 flex flex-col items-center group`}
                            onMouseEnter={() => setHoveredNode(node.id)}
                            onMouseLeave={() => setHoveredNode(null)}
                        >
                            <motion.div
                                className={`w-24 h-24 rounded-2xl bg-black border-2 border-white/10 flex items-center justify-center relative overflow-hidden backdrop-blur-xl transition-all duration-300`}
                                animate={{
                                    boxShadow: isHovered ? `0 0 40px ${node.glowColor}` : `0 0 15px ${node.glowColor.replace('0.6', '0.2')}`,
                                    borderColor: isHovered ? node.color.replace('bg-', '') : 'rgba(255,255,255,0.1)',
                                    scale: isHovered ? 1.1 : 1
                                }}
                            >
                                <div className={`absolute inset-0 opacity-20 ${node.color}`} />
                                <Icon className={`w-10 h-10 ${isHovered ? 'text-white' : 'text-gray-400'}`} />
                            </motion.div>

                            <div className="mt-4 text-center w-48">
                                <h3 className="text-xl font-black text-white">{node.label}</h3>
                                {node.value && (
                                    <div className={`mt-1 font-mono text-sm font-bold ${node.color.replace('bg-', 'text-')}`}>
                                        {node.value}
                                    </div>
                                )}
                                <AnimatePresence>
                                    {isHovered && (
                                        <motion.div
                                            initial={{ opacity: 0, y: -10 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            exit={{ opacity: 0, y: -10 }}
                                            className="absolute top-32 left-1/2 -translate-x-1/2 bg-white/10 backdrop-blur-md border border-white/20 p-3 rounded-xl shadow-2xl w-64 pointer-events-none z-50 text-sm text-gray-300"
                                        >
                                            {node.desc}
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

// ==================== METRICS BAR ====================
const InteractivePieChart = () => {
    return (
        <div className="w-full max-w-4xl mx-auto mt-20 p-8 rounded-3xl bg-white/5 border border-white/10 backdrop-blur-md">
            <h3 className="text-2xl font-light mb-8 flex items-center gap-3">
                <PieChart className="text-nexus-cyan" />
                Default Revenue Split Architecture
            </h3>

            <div className="flex bg-black/50 h-12 rounded-full overflow-hidden border border-white/10 shadow-inner">
                <motion.div
                    initial={{ width: 0 }} whileInView={{ width: '80%' }} transition={{ duration: 1, ease: 'easeOut' }}
                    className="h-full bg-nexus-cyan relative group flex items-center px-4 cursor-pointer hover:bg-cyan-300 transition-colors"
                >
                    <span className="font-bold text-black border-none text-sm hidden sm:block truncate">Creator (80%)</span>
                    <div className="absolute top-full left-0 mt-4 bg-black border border-nexus-cyan/50 p-4 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity z-50 w-64 shadow-[0_0_30px_rgba(34,211,238,0.2)]">
                        <div className="text-nexus-cyan font-bold mb-1">Direct Creator Payout</div>
                        <p className="text-sm text-gray-400">Instantly settled via Fiber Network to the main creator's wallet with zero delay.</p>
                    </div>
                </motion.div>

                <motion.div
                    initial={{ width: 0 }} whileInView={{ width: '15%' }} transition={{ duration: 1, delay: 0.2, ease: 'easeOut' }}
                    className="h-full bg-nexusPink relative group flex items-center px-2 cursor-pointer hover:bg-pink-400 transition-colors"
                >
                    <span className="font-bold text-white text-xs hidden sm:block truncate">Co (15%)</span>
                    <div className="absolute top-full left-1/2 -translate-x-1/2 mt-4 bg-black border border-pink-500/50 p-4 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity z-50 w-64 shadow-[0_0_30px_rgba(236,72,153,0.2)]">
                        <div className="text-nexusPink font-bold mb-1">Collaborator Split</div>
                        <p className="text-sm text-gray-400">Automatically distributed to smart contract registered co-creators based on predefined percentages.</p>
                    </div>
                </motion.div>

                <motion.div
                    initial={{ width: 0 }} whileInView={{ width: '5%' }} transition={{ duration: 1, delay: 0.4, ease: 'easeOut' }}
                    className="h-full bg-yellow-500 relative group flex items-center justify-center cursor-pointer hover:bg-yellow-400 transition-colors"
                >
                    <div className="absolute top-full right-0 mt-4 bg-black border border-yellow-500/50 p-4 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity z-50 w-64 shadow-[0_0_30px_rgba(234,179,8,0.2)]">
                        <div className="text-yellow-400 font-bold mb-1">Protocol Fee (5%)</div>
                        <p className="text-sm text-gray-400">Directed to the DAO treasury for server costs, validator rewards, and ecosystem grants.</p>
                    </div>
                </motion.div>
            </div>

            <div className="mt-8 grid grid-cols-1 sm:grid-cols-3 gap-6">
                <div className="p-4 rounded-2xl bg-cyan-500/10 border border-cyan-500/20">
                    <div className="text-nexusCyan font-black text-3xl mb-1">0%</div>
                    <div className="text-sm text-gray-400">Middleman Cuts</div>
                </div>
                <div className="p-4 rounded-2xl bg-nexusPurple/10 border border-nexusPurple/20">
                    <div className="text-nexusPurple font-black text-3xl mb-1">&lt;1s</div>
                    <div className="text-sm text-gray-400">Settlement Time</div>
                </div>
                <div className="p-4 rounded-2xl bg-yellow-500/10 border border-yellow-500/20">
                    <div className="text-yellow-400 font-black text-3xl mb-1">100%</div>
                    <div className="text-sm text-gray-400">On-Chain Transparency</div>
                </div>
            </div>
        </div>
    );
}

// ==================== CONSUMER BENEFITS ====================
const ConsumerBenefits = () => {
    const benefits = [
        {
            icon: Video,
            title: "Premium Videos",
            desc: "Watch long-form movies or short clips. Don't want to buy the whole movie? Use Stream Payment to pay-by-the-second. Stop watching, stop paying.",
            color: "from-blue-500/20 to-blue-500/5",
            accent: "text-blue-400"
        },
        {
            icon: Music,
            title: "Exclusive Music",
            desc: "Listen to high-fidelity audio tracks. Unlock a single song with a micro-transaction, without needing a $15/month bundled subscription.",
            color: "from-nexusPurple/20 to-purple-500/5",
            accent: "text-nexusPurple"
        },
        {
            icon: BookText,
            title: "Paid Articles",
            desc: "Read premium research, stories, and news. Pay a few cents per article to reward writers directly, unfiltered by corporate paywalls.",
            color: "from-pink-500/20 to-nexusPink/5",
            accent: "text-nexusPink"
        },
        {
            icon: Trophy,
            title: "Watch-to-Earn Rewards",
            desc: "Earn Platform Points just for engaging. Spin the Daily Wheel, complete watch tasks, and unlock exclusive platform perks.",
            color: "from-yellow-500/20 to-yellow-500/5",
            accent: "text-yellow-400"
        },
        {
            icon: Radio,
            title: "Live Interactive Hub",
            desc: "Join live streams and connect directly with creators and community. Send Super Tips that settle instantly with zero middleman delays.",
            color: "from-green-500/20 to-green-500/5",
            accent: "text-green-400"
        }
    ];

    return (
        <div className="w-full max-w-6xl mx-auto mb-32 px-6">
            <div className="mb-12 text-center flex flex-col items-center">
                <h2 className="text-3xl md:text-5xl font-light mb-4 text-center">What's in it for the <span className="font-semibold text-blue-400">Audience?</span></h2>
                <p className="text-gray-400 text-lg text-center">A fairer, more flexible way to experience premium entertainment.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {benefits.map((benefit, i) => (
                    <motion.div
                        key={i}
                        initial={{ opacity: 0, y: 30 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        transition={{ delay: i * 0.15 }}
                        className={`p-8 rounded-3xl bg-gradient-to-br ${benefit.color} border border-white/10 backdrop-blur-sm hover:border-white/30 transition-colors group`}
                    >
                        <div className="w-14 h-14 rounded-2xl bg-white/5 flex items-center justify-center mb-6 border border-white/10 group-hover:scale-110 transition-transform">
                            <benefit.icon className={`w-7 h-7 ${benefit.accent}`} />
                        </div>
                        <h3 className="text-2xl font-bold text-white mb-3">{benefit.title}</h3>
                        <p className="text-gray-400 leading-relaxed">{benefit.desc}</p>
                    </motion.div>
                ))}
            </div>
        </div>
    );
};

// ==================== DUAL ECONOMY ENGINE ====================
const DualEconomyEngine = () => {
    return (
        <div className="w-full max-w-6xl mx-auto mb-32 px-6">
            <div className="mb-12 text-center flex flex-col items-center">
                <h2 className="text-3xl md:text-5xl font-light mb-4 text-center">The <span className="font-semibold text-nexus-cyan">Dual-Economy</span> Engine</h2>
                <p className="text-gray-400 text-lg text-center mx-auto max-w-2xl">Two tokens working in harmony to power instant value transfer and long-term engagement.</p>
            </div>
            <div className="flex flex-col md:flex-row gap-8">
                {/* USDC Side */}
                <div className="flex-1 p-8 rounded-3xl bg-[#0F0F1A] border border-blue-500/20 relative overflow-hidden group">
                    <div className="absolute inset-0 bg-blue-500/5 opacity-0 group-hover:opacity-100 transition-opacity" />
                    <div className="w-16 h-16 rounded-2xl bg-blue-500/10 flex items-center justify-center border border-blue-500/30 mb-6">
                        <Wallet className="w-8 h-8 text-blue-400" />
                    </div>
                    <h3 className="text-2xl font-bold text-white mb-2 flex items-center gap-2">USDC <span className="text-xs font-mono bg-blue-500/20 text-blue-400 px-2 py-1 rounded">Stablecoin</span></h3>
                    <p className="text-gray-400 mb-6">The medium of exchange. Borderless, price-stable, and settled instantly via the CKB Fiber Network.</p>
                    <ul className="space-y-3 text-sm text-gray-300 relative z-10">
                        <li className="flex gap-2 items-center"><CheckCircle2 className="w-4 h-4 text-blue-400" /> Stream Payments</li>
                        <li className="flex gap-2 items-center"><CheckCircle2 className="w-4 h-4 text-blue-400" /> Super Tips</li>
                        <li className="flex gap-2 items-center"><CheckCircle2 className="w-4 h-4 text-blue-400" /> Content Unlocks</li>
                    </ul>
                </div>
                {/* Points Side */}
                <div className="flex-1 p-8 rounded-3xl bg-[#0F0F1A] border border-yellow-500/20 relative overflow-hidden group">
                    <div className="absolute inset-0 bg-yellow-500/5 opacity-0 group-hover:opacity-100 transition-opacity" />
                    <div className="w-16 h-16 rounded-2xl bg-yellow-500/10 flex items-center justify-center border border-yellow-500/30 mb-6">
                        <Trophy className="w-8 h-8 text-yellow-400" />
                    </div>
                    <h3 className="text-2xl font-bold text-white mb-2 flex items-center gap-2">Points <span className="text-xs font-mono bg-yellow-500/20 text-yellow-400 px-2 py-1 rounded">Utility</span></h3>
                    <p className="text-gray-400 mb-6">The engagement layer. Earned by active participation and used to unlock platform-specific privileges.</p>
                    <ul className="space-y-3 text-sm text-gray-300 relative z-10">
                        <li className="flex gap-2 items-center"><CheckCircle2 className="w-4 h-4 text-yellow-400" /> Watch-to-Earn Rewards</li>
                        <li className="flex gap-2 items-center"><CheckCircle2 className="w-4 h-4 text-yellow-400" /> Daily Spin & Tasks</li>
                        <li className="flex gap-2 items-center"><CheckCircle2 className="w-4 h-4 text-yellow-400" /> Exclusive Discs / Badges</li>
                    </ul>
                </div>
            </div>
        </div>
    );
};

// ==================== APP INTERACTIVE FLOW ====================
const AppInteractiveFlow = () => {
    const [activeStep, setActiveStep] = useState(0);

    const steps = [
        {
            icon: MousePointerClick,
            title: "1. Discover & Pick",
            desc: "Browse a frictionless feed of pure content. No paywalls blocking your view. Click exactly what you want to experience.",
            color: "from-blue-500 to-cyan-500",
            glow: "rgba(59, 130, 246, 0.5)"
        },
        {
            icon: MonitorPlay,
            title: "2. Consume Instantly",
            desc: "Start watching or reading immediately. Whether it's a 10-second preview or a 2-hour movie, you're in control of your time.",
            color: "from-nexusPurple to-nexusPink",
            glow: "rgba(168, 85, 247, 0.5)"
        },
        {
            icon: Wallet,
            title: "3. Stream Payment",
            desc: "Your Web3 wallet handles micro-payments in the background. You only pay for the exact seconds you consume. Stop anytime.",
            color: "from-orange-500 to-yellow-500",
            glow: "rgba(249, 115, 22, 0.5)"
        },
        {
            icon: Trophy,
            title: "4. Engage & Earn",
            desc: "Every minute spent engaging earns you Platform Points. Tip creators, leave comments, and level up your account passively.",
            color: "from-green-500 to-emerald-400",
            glow: "rgba(34, 197, 94, 0.5)"
        }
    ];

    useEffect(() => {
        const interval = setInterval(() => {
            setActiveStep((prev) => (prev + 1) % steps.length);
        }, 4000);
        return () => clearInterval(interval);
    }, [steps.length]);

    return (
        <div className="w-full max-w-6xl mx-auto mb-32 px-6">
            <div className="mb-16 text-center flex flex-col items-center">
                <h2 className="text-3xl md:text-5xl font-light mb-4 text-center">The <span className="font-semibold text-nexusPurple">Zero-Friction</span> User Journey</h2>
                <p className="text-gray-400 text-lg text-center max-w-2xl mx-auto">How to use Nexus: No monthly subscriptions, no commitments. Just pure entertainment.</p>
            </div>

            <div className="flex flex-col md:flex-row items-center justify-between relative">
                {/* Connecting Line */}
                <div className="absolute top-1/2 left-0 w-full h-1 bg-white/10 -translate-y-1/2 hidden md:block z-0" />
                <motion.div
                    className="absolute top-1/2 left-0 h-1 bg-gradient-to-r from-blue-500 via-purple-500 to-yellow-500 -translate-y-1/2 hidden md:block z-0"
                    initial={{ width: '0%' }}
                    animate={{ width: `${(activeStep / (steps.length - 1)) * 100}%` }}
                    transition={{ duration: 0.8, ease: "easeInOut" }}
                />

                {steps.map((step, i) => {
                    const isActive = i === activeStep;
                    const isPassed = i < activeStep;

                    return (
                        <div key={i} className="relative z-10 flex flex-col items-center flex-1 mb-8 md:mb-0" onClick={() => setActiveStep(i)}>
                            <motion.div
                                className={`w-20 h-20 rounded-full flex items-center justify-center cursor-pointer mb-6 border-4 transition-all duration-500 ${isActive || isPassed ? 'border-transparent bg-gradient-to-br ' + step.color : 'border-white/20 bg-black'}`}
                                animate={{
                                    scale: isActive ? 1.15 : 1,
                                    boxShadow: isActive ? `0 0 40px ${step.glow}, inset 0 0 20px rgba(255,255,255,0.5)` : 'none'
                                }}
                            >
                                <step.icon className={`w-8 h-8 ${isActive || isPassed ? 'text-white' : 'text-gray-500'}`} />
                            </motion.div>

                            <div className={`text-center transition-opacity duration-500 ${isActive ? 'opacity-100' : 'opacity-40'}`}>
                                <h3 className="text-xl font-bold text-white mb-2">{step.title}</h3>
                                <p className="text-sm text-gray-400 max-w-[250px] mx-auto hidden md:block">{step.desc}</p>
                            </div>

                            {/* Mobile description (only shows when active) */}
                            <AnimatePresence>
                                {isActive && (
                                    <motion.p
                                        initial={{ opacity: 0, height: 0 }}
                                        animate={{ opacity: 1, height: 'auto' }}
                                        exit={{ opacity: 0, height: 0 }}
                                        className="text-sm text-gray-400 mt-4 md:hidden text-center max-w-[280px]"
                                    >
                                        {step.desc}
                                    </motion.p>
                                )}
                            </AnimatePresence>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

export default function PreAbout() {
    return (
        <div className="min-h-screen bg-[#050510] font-sans text-white overflow-x-hidden selection:bg-nexusPurple pb-32">
            <TopNav />

            {/* HEADER */}
            <div className="pt-32 px-6 max-w-7xl mx-auto text-center flex flex-col items-center mb-24">
                <motion.div
                    initial={{ opacity: 0, y: 30 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-blue-500/30 bg-blue-500/10 mb-8"
                >
                    <Zap className="w-4 h-4 text-blue-400" />
                    <span className="text-sm font-bold tracking-widest text-blue-400 uppercase">Web5 Entertainment Platform</span>
                </motion.div>

                <motion.h1
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="text-5xl md:text-7xl font-black mb-6 bg-clip-text text-transparent bg-gradient-to-br from-white via-gray-200 to-gray-600 text-center"
                >
                    The Future of Content
                </motion.h1>
                <motion.p
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.2 }}
                    className="text-xl text-gray-400 max-w-2xl text-center mx-auto"
                >
                    Nexus bridges the gap between creators and audiences. Experience frictionless consumption and instantaneous revenue sharing on the Fiber Network.
                </motion.p>
            </div>

            <InteractiveStoryboarding />
            <ConsumerBenefits />
            <DualEconomyEngine />
            <AppInteractiveFlow />

            <div className="text-center flex flex-col items-center mb-16 pt-16 border-t border-white/5 max-w-5xl mx-auto px-6">
                <h2 className="text-3xl md:text-5xl font-light mb-4 text-white text-center">Behind the Scenes: <span className="font-semibold text-nexusPurple">Value Flow</span></h2>
                <p className="text-gray-400 text-lg text-center max-w-2xl mx-auto">See exactly how your payments are distributed under the hood, instantly and trustlessly.</p>
            </div>

            <TokenomicsFlow />
            <InteractivePieChart />
        </div>
    );
}
