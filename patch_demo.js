const fs = require('fs');
const file = 'd:/111new_sp/new_sp/video-platform/client-web/src/pages/PreAbout.tsx';
let content = fs.readFileSync(file, 'utf8');

const newComponent = `// ==================== INTERACTIVE PRODUCT DEMO (4-SCENE STORYBOARD) ====================
const InteractiveStoryboarding = () => {
    const [scene, React_setScene] = React.useState<'discover' | 'play' | 'split' | 'earn'>('discover');
    const [contentType, React_setContentType] = React.useState<'video' | 'music' | 'article' | null>(null);
    const [progress, React_setProgress] = React.useState(0);
    const [spent, React_setSpent] = React.useState(0);

    // Scene 2: Simulate playback and stream payment
    React.useEffect(() => {
        let interval: any;
        if (scene === 'play') {
            interval = setInterval(() => {
                React_setProgress(p => {
                    if (p >= 100) {
                        React_setScene('split');
                        return 100;
                    }
                    return p + 1;
                });
                React_setSpent(s => s + 0.005); // Simulated $0.005 per tick
            }, 50);
        } else if (scene === 'discover') {
            React_setProgress(0);
            React_setSpent(0);
        }
        return () => clearInterval(interval);
    }, [scene]);

    // Scene 3: Auto-transition to Earn dashboard after displaying split
    React.useEffect(() => {
        if (scene === 'split') {
            const timer = setTimeout(() => {
                React_setScene('earn');
            }, 4000); // 4 seconds for user to read the split logic
            return () => clearTimeout(timer);
        }
    }, [scene]);

    // Handlers
    const selectContent = (type: 'video' | 'music' | 'article') => {
        React_setContentType(type);
        React_setScene('play');
    };
    const haltPayment = () => React_setScene('split');
    const resetStory = () => {
        React_setScene('discover');
        React_setContentType(null);
    };

    return (
        <div className="w-full max-w-5xl mx-auto mb-32 px-6">
            <div className="text-center mb-12">
                <div className="inline-flex items-center gap-2 mb-4">
                    <span className="flex h-3 w-3 relative">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-nexus-cyan opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-3 w-3 bg-cyan-400"></span>
                    </span>
                    <span className="text-nexus-cyan font-mono text-sm tracking-widest uppercase">Interactive Simulator</span>
                </div>
                <h2 className="text-3xl md:text-5xl font-light mb-4 text-white">The <span className="font-semibold text-nexus-cyan">Web5</span> Lifecycle</h2>
                <p className="text-gray-400 text-lg mb-8">Follow the journey of a single interaction. Click below to begin.</p>
            </div>

            {/* Viewport Screen */}
            <div className="relative aspect-[16/20] md:aspect-[21/9] bg-[#0A0A0A] rounded-3xl overflow-hidden border border-white/10 shadow-[0_0_50px_rgba(0,0,0,0.5)] group">
                
                {/* ---------- SCENE 1: DISCOVER ---------- */}
                <AnimatePresence>
                    {scene === 'discover' && (
                        <motion.div 
                            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, scale: 0.95 }}
                            className="absolute inset-0 p-8 flex flex-col z-20"
                        >
                            <h3 className="text-2xl font-bold mb-6 text-center text-white">Step 1: Discover & Select</h3>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 h-full items-center">
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
                                <motion.div whileHover={{ scale: 1.05 }} onClick={() => selectContent('music')} className="cursor-pointer group/card h-64 rounded-2xl bg-gradient-to-br from-purple-900/50 to-black border border-purple-500/20 hover:border-purple-500/60 p-6 flex flex-col justify-between relative overflow-hidden">
                                    <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1514525253161-7a46d19cd819?auto=format&fit=crop&q=80')] bg-cover opacity-20 group-hover/card:opacity-40 transition-opacity" />
                                    <Headphones className="w-10 h-10 text-purple-400 relative z-10" />
                                    <div className="relative z-10">
                                        <h4 className="text-xl font-bold text-white mb-1">Lo-Fi Beats 2026</h4>
                                        <p className="text-sm font-mono text-purple-400 bg-purple-500/10 px-2 py-1 rounded inline-block">Stream: $0.01/min</p>
                                    </div>
                                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-purple-500 text-white rounded-full p-4 opacity-0 group-hover/card:opacity-100 transition-all scale-50 group-hover/card:scale-100 z-20 shadow-[0_0_20px_rgba(168,85,247,0.5)]">
                                        <Play className="w-6 h-6 ml-1" />
                                    </div>
                                </motion.div>

                                {/* Article Option */}
                                <motion.div whileHover={{ scale: 1.05 }} onClick={() => selectContent('article')} className="cursor-pointer group/card h-64 rounded-2xl bg-gradient-to-br from-pink-900/50 to-black border border-pink-500/20 hover:border-pink-500/60 p-6 flex flex-col justify-between relative overflow-hidden">
                                    <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1499750310107-5fef28a66643?auto=format&fit=crop&q=80')] bg-cover opacity-20 group-hover/card:opacity-40 transition-opacity" />
                                    <FileText className="w-10 h-10 text-pink-400 relative z-10" />
                                    <div className="relative z-10">
                                        <h4 className="text-xl font-bold text-white mb-1">State of Web5 Crypto</h4>
                                        <p className="text-sm font-mono text-pink-400 bg-pink-500/10 px-2 py-1 rounded inline-block">Buy: $0.15 flat</p>
                                    </div>
                                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-pink-500 text-white rounded-full p-4 opacity-0 group-hover/card:opacity-100 transition-all scale-50 group-hover/card:scale-100 z-20 shadow-[0_0_20px_rgba(236,72,153,0.5)]">
                                        <Play className="w-6 h-6 ml-1" />
                                    </div>
                                </motion.div>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* ---------- SCENE 2: PLAY & CONSUME ---------- */}
                <AnimatePresence>
                    {scene === 'play' && (
                        <motion.div 
                            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                            className="absolute inset-0 z-20"
                        >
                            {/* Generic Playing Background */}
                            <motion.div 
                                className="absolute inset-0 bg-neutral-900 bg-[url('https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&q=80')] bg-cover bg-center opacity-40 transition-transform duration-[10s]"
                                animate={{ scale: 1.1 }}
                            />
                            <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-black/80" />
                            
                            {/* Top Bar */}
                            <div className="absolute top-6 left-6 right-6 flex justify-between items-start pointer-events-none">
                                <div className="text-white hidden md:block">
                                    <h3 className="text-2xl font-bold tracking-tight">Step 2: Consumption</h3>
                                    <p className="text-gray-400 text-sm">You are now consuming content. Payment is dripping.</p>
                                </div>
                                <div className="bg-black/60 backdrop-blur-xl border border-nexus-cyan/50 p-4 rounded-2xl flex items-center gap-6 shadow-[0_0_30px_rgba(34,211,238,0.2)] pointer-events-auto mx-auto md:mx-0">
                                    <div className="flex flex-col">
                                        <span className="text-xs text-gray-400 font-mono mb-1 uppercase tracking-wider">Stream Payment Active</span>
                                        <div className="flex items-baseline gap-1 font-mono justify-end">
                                            <span className="text-3xl font-black text-nexus-cyan">\${spent.toFixed(4)}</span>
                                            <span className="text-xs text-cyan-500">USDC</span>
                                        </div>
                                    </div>
                                    <div className="w-10 h-10 rounded-full bg-cyan-500/20 flex items-center justify-center relative">
                                        <div className="absolute inset-0 border-2 border-cyan-500/50 rounded-full animate-ping opacity-50" />
                                        <FastForward className="w-5 h-5 text-nexus-cyan" />
                                    </div>
                                </div>
                            </div>

                            {/* Center Status */}
                            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none text-center">
                                <div className="w-24 h-24 border-4 border-r-nexus-cyan border-b-cyan-500 border-t-transparent border-l-transparent rounded-full animate-spin mx-auto mb-4" />
                            </div>
                            
                            {/* Bottom Controls */}
                            <div className="absolute bottom-0 left-0 w-full p-8 bg-gradient-to-t from-black to-transparent flex flex-col items-center">
                                <div className="w-full max-w-2xl h-1 bg-white/20 rounded-full mb-6 overflow-hidden">
                                    <div className="h-full bg-nexus-cyan" style={{ width: \`\${progress}%\` }} />
                                </div>
                                <motion.button 
                                    onClick={haltPayment} 
                                    whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
                                    className="px-8 py-3 bg-red-600/90 text-white font-bold rounded-full border border-red-400/50 hover:bg-red-500 transition-colors shadow-[0_0_20px_rgba(220,38,38,0.4)] z-50 flex items-center gap-2 pointer-events-auto"
                                >
                                    <div className="w-3 h-3 bg-white rounded-sm" /> Stop & Finalize Payment
                                </motion.button>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* ---------- SCENE 3: THE SPLIT ---------- */}
                <AnimatePresence>
                    {scene === 'split' && (
                        <motion.div 
                            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, y: -50 }}
                            className="absolute inset-0 bg-[#0A0A0A] z-30 flex flex-col items-center justify-center p-8"
                        >
                            <h3 className="text-3xl font-bold text-white mb-2">Step 3: Trustless Split</h3>
                            <p className="text-gray-400 font-mono mb-12 text-center text-sm md:text-base">Total paid: \${spent.toFixed(4)} USDC via Fiber Network</p>

                            <div className="w-full max-w-4xl flex justify-between items-end relative h-48">
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
                                    <div className="w-12 h-12 md:w-16 md:h-16 rounded-full bg-cyan-500/20 border border-cyan-500 flex items-center justify-center mb-3 text-cyan-400 font-bold text-lg md:text-xl shadow-[0_0_20px_rgba(34,211,238,0.3)]">80%</div>
                                    <div className="text-white font-bold text-center text-sm md:text-base">Creator</div>
                                    <div className="font-mono text-cyan-400 text-xs md:text-sm mt-1">+\${(spent * 0.8).toFixed(4)}</div>
                                </motion.div>

                                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 1.2 }} className="flex flex-col items-center z-10 w-[30%]">
                                    <div className="w-12 h-12 md:w-16 md:h-16 rounded-full bg-pink-500/20 border border-pink-500 flex items-center justify-center mb-3 text-pink-400 font-bold text-lg md:text-xl shadow-[0_0_20px_rgba(236,72,153,0.3)]">15%</div>
                                    <div className="text-white font-bold text-center text-sm md:text-base">Co-creators</div>
                                    <div className="font-mono text-pink-400 text-xs md:text-sm mt-1">+\${(spent * 0.15).toFixed(4)}</div>
                                </motion.div>

                                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 1.4 }} className="flex flex-col items-center z-10 w-[30%]">
                                    <div className="w-12 h-12 md:w-16 md:h-16 rounded-full bg-yellow-500/20 border border-yellow-500 flex items-center justify-center mb-3 text-yellow-400 font-bold text-lg md:text-xl shadow-[0_0_20px_rgba(234,179,8,0.3)]">5%</div>
                                    <div className="text-white font-bold text-center text-sm md:text-base">Treasury</div>
                                    <div className="font-mono text-yellow-400 text-xs md:text-sm mt-1">+\${(spent * 0.05).toFixed(4)}</div>
                                </motion.div>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* ---------- SCENE 4: CREATOR EARN ---------- */}
                <AnimatePresence>
                    {scene === 'earn' && (
                        <motion.div 
                            initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}
                            className="absolute inset-0 bg-[#0A0A0A] z-40 p-8 flex flex-col justify-between items-center"
                        >
                            <div className="text-center mt-6 w-full hidden md:block">
                                <h3 className="text-3xl font-bold text-white tracking-tight">Step 4: Instant Settlement</h3>
                                <p className="text-gray-400 mt-2">The creator's dashboard updates in milliseconds. No 30-day holds.</p>
                            </div>

                            <motion.div 
                                initial={{ y: 50, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.3 }}
                                className="w-full max-w-lg mx-auto bg-[#0F0F1A] border border-blue-500/20 rounded-3xl p-6 md:p-8 shadow-[0_0_40px_rgba(59,130,246,0.1)] relative"
                            >
                                <div className="flex items-center justify-between mb-8">
                                    <div className="flex items-center gap-4">
                                        <div className="w-12 h-12 rounded-full bg-gradient-to-tr from-cyan-400 to-blue-500 flex items-center justify-center">
                                            <Wallet className="w-6 h-6 text-white" />
                                        </div>
                                        <div>
                                            <div className="text-white font-bold">Creator Studio</div>
                                            <div className="text-gray-500 text-sm">Real-time Revenue</div>
                                        </div>
                                    </div>
                                    <div className="px-3 py-1 bg-green-500/10 text-green-400 rounded-full text-xs font-bold font-mono">ONLINE</div>
                                </div>
                                
                                <div className="mb-2 text-gray-400 text-sm">Total Balance</div>
                                <div className="flex items-baseline gap-2 mb-8 border-b border-white/5 pb-8">
                                    <span className="text-5xl font-black text-white">$42,069.</span><span className="text-3xl text-gray-500">80</span>
                                </div>

                                <div className="bg-green-500/10 border border-green-500/30 rounded-2xl p-4 flex items-center justify-between relative overflow-hidden">
                                    <motion.div 
                                        initial={{ opacity: 0, x: '-100%' }} animate={{ opacity: [0, 1, 0], x: ['-100%', '100%', '200%'] }} transition={{ duration: 1.5 }}
                                        className="absolute inset-0 w-1/2 bg-gradient-to-r from-transparent via-cyan-400/20 to-transparent skew-x-12 pointer-events-none"
                                    />
                                    <div className="flex items-center gap-4 relative z-10">
                                        <div className="w-10 h-10 rounded-full bg-green-500/20 text-green-400 flex items-center justify-center">
                                            <ArrowUpRight className="w-5 h-5" />
                                        </div>
                                        <div>
                                            <div className="text-white font-medium text-sm md:text-base">Stream Settlement (Fiber)</div>
                                            <div className="text-green-500 font-mono text-sm leading-none mt-1">+\${(spent * 0.8).toFixed(4)} USDC</div>
                                        </div>
                                    </div>
                                    <span className="text-gray-500 text-xs relative z-10 hidden md:block">Just now</span>
                                </div>
                            </motion.div>

                            <div className="text-center md:pb-6 w-full pointer-events-auto">
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
            <div className="flex justify-center mt-8 gap-4">
                {['discover', 'play', 'split', 'earn'].map((s) => (
                    <div key={s} className="flex items-center">
                        <div className={\`h-2 rounded-full transition-all duration-500 \${scene === s ? 'w-12 bg-nexus-cyan' : 'w-4 bg-white/20'}\`} />
                    </div>
                ))}
            </div>
            <p className="text-center text-sm font-mono text-gray-500 mt-6 mt-4">
                * The visual above simulates a complete 4-step lifecycle powered by Nervos CKB Fiber Network.
            </p>
        </div>
    );
};
\`;

content = content.replace(/\\/\\/ ==================== INTERACTIVE PRODUCT DEMO ====================\\n[\\s\\S]*?\\/\\/ ==================== CONSUMER BENEFITS ====================/, newComponent + '\\n\\n// ==================== CONSUMER BENEFITS ====================');

content = content.replace('<ProductDemoAnimation />', '<InteractiveStoryboarding />');
content = content.replace("import { ArrowRight, Coins, Zap, Users, Play, Shield, Database, Cpu, PieChart, MousePointerClick, MonitorPlay, Wallet, Video, Music, BookText, FastForward, CheckCircle2 } from 'lucide-react';", "import { ArrowRight, Coins, Zap, Users, Play, Shield, Database, Cpu, PieChart, MousePointerClick, MonitorPlay, Wallet, Video, Music, BookText, FastForward, CheckCircle2, Headphones, FileText, ArrowUpRight } from 'lucide-react';");
content = content.replace("const [demoState, setDemoState] = useState<'browse' | 'play' | 'paid'>('browse');", "");
content = content.replace("const [progress, setProgress] = useState(0);", "");
content = content.replace("const [spent, setSpent] = useState(0);", "");

fs.writeFileSync(file, content);
console.log('Patched');
