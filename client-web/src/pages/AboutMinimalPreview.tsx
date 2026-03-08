import React from 'react';
import { motion, useScroll, useTransform } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import TopNav from '../components/TopNav';
import { ArrowRight, Globe, Layers, Zap, Shield, ChevronDown } from 'lucide-react';

// ==================== MINIMAL HERO ====================
const HeroSection = () => {
    return (
        <section className="min-h-[90vh] flex flex-col items-center justify-center relative px-6 w-full max-w-7xl mx-auto pt-20">
            {/* Extremely subtle ambient glow */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-white/[0.02] rounded-full blur-[120px] pointer-events-none" />

            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
                className="text-center z-10 max-w-4xl"
            >
                <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-white/10 bg-white/5 backdrop-blur-md mb-8">
                    <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
                    <span className="text-xs font-medium tracking-widest uppercase text-gray-300">Nexus Protocol V2.0</span>
                </div>

                <h1 className="text-6xl md:text-8xl font-light tracking-tight text-white mb-8 leading-[1.1]">
                    Decentralizing the <br />
                    <span className="font-semibold bg-clip-text text-transparent bg-gradient-to-r from-gray-100 to-gray-500">Future of Media</span>
                </h1>

                <p className="text-xl md:text-2xl text-gray-400 font-light mb-12 max-w-2xl mx-auto leading-relaxed">
                    A frictionless, sovereign content ecosystem powered by Nervos CKB. Own your audience, monetize instantly.
                </p>

                <div className="flex flex-col sm:flex-row items-center justify-center gap-6">
                    <button className="px-8 py-4 bg-white text-black rounded-full font-medium flex items-center gap-2 hover:bg-gray-200 transition-colors">
                        Read Whitepaper <ArrowRight className="w-4 h-4" />
                    </button>
                    <button className="px-8 py-4 border border-white/20 text-white rounded-full font-medium hover:bg-white/5 transition-colors">
                        Explore Ecosystem
                    </button>
                </div>
            </motion.div>

            <motion.div
                className="absolute bottom-12 text-gray-500"
                animate={{ y: [0, 8, 0] }}
                transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
            >
                <ChevronDown className="w-6 h-6 opacity-50" />
            </motion.div>
        </section>
    );
};

// ==================== MANIFESTO / PHILOSOPHY ====================
const PhilosophySection = () => {
    return (
        <section className="py-32 px-6 w-full max-w-7xl mx-auto border-t border-white/5">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-20 items-center">
                <motion.div
                    initial={{ opacity: 0, x: -30 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true, margin: "-100px" }}
                    transition={{ duration: 0.8 }}
                >
                    <h2 className="text-4xl md:text-5xl font-light tracking-tight mb-8">
                        The medium is <br />
                        <span className="font-semibold">no longer the master.</span>
                    </h2>
                    <div className="space-y-6 text-lg text-gray-400 font-light leading-relaxed">
                        <p>
                            For decades, central platforms have dictated the rules of engagement, extracting disproportionate value from creators while commoditizing audiences.
                        </p>
                        <p>
                            Nexus Protocol reconstructs this dynamic from the protocol layer up. By leveraging Cell Model architecture and Universal Revenue Sharing, we ensure value flows directly from consumer to creator, mathmatically guaranteed.
                        </p>
                    </div>
                </motion.div>

                <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    whileInView={{ opacity: 1, scale: 1 }}
                    viewport={{ once: true, margin: "-100px" }}
                    transition={{ duration: 0.8 }}
                    className="aspect-square rounded-3xl bg-gradient-to-br from-white/5 to-transparent border border-white/10 p-12 relative overflow-hidden flex flex-col justify-end"
                >
                    <div className="absolute top-0 right-0 w-[300px] h-[300px] bg-white/5 blur-[80px] rounded-full" />

                    <div className="relative z-10 space-y-8">
                        <div className="w-16 h-16 rounded-full bg-white/10 flex items-center justify-center backdrop-blur-md border border-white/20">
                            <Layers className="w-8 h-8 text-white" />
                        </div>
                        <div>
                            <div className="text-4xl font-light mb-2">99.8%</div>
                            <div className="text-sm text-gray-400 font-medium tracking-wide uppercase">Revenue straight to creators</div>
                        </div>
                    </div>
                </motion.div>
            </div>
        </section>
    );
};

// ==================== TOKENOMICS DATA VIZ ====================
const TokenomicsSection = () => {
    return (
        <section className="py-32 px-6 w-full max-w-7xl mx-auto border-t border-white/5">
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                className="mb-20 text-center"
            >
                <h2 className="text-4xl font-light mb-4">Value Distribution</h2>
                <p className="text-gray-400">Transparent, immutable, and coded into the protocol.</p>
            </motion.div>

            <div className="max-w-4xl mx-auto">
                <div className="space-y-8">
                    {[
                        { label: "Creator Earnings", percent: 80, color: "bg-white" },
                        { label: "Co-Creation / Collaborators", percent: 15, color: "bg-gray-400" },
                        { label: "Protocol Fee", percent: 5, color: "bg-gray-700" }
                    ].map((item, i) => (
                        <motion.div
                            key={i}
                            initial={{ opacity: 0, x: -20 }}
                            whileInView={{ opacity: 1, x: 0 }}
                            viewport={{ once: true }}
                            transition={{ delay: i * 0.1 }}
                        >
                            <div className="flex justify-between items-end mb-2">
                                <span className="text-lg font-light text-gray-200">{item.label}</span>
                                <span className="text-2xl font-medium">{item.percent}%</span>
                            </div>
                            <div className="h-1 w-full bg-white/5 rounded-full overflow-hidden">
                                <motion.div
                                    className={`h-full ${item.color}`}
                                    initial={{ width: 0 }}
                                    whileInView={{ width: `${item.percent}%` }}
                                    viewport={{ once: true }}
                                    transition={{ duration: 1, delay: 0.2 + (i * 0.1), ease: "easeOut" }}
                                />
                            </div>
                        </motion.div>
                    ))}
                </div>
            </div>
        </section>
    );
};

// ==================== CORE TEAM ====================
const TeamSection = () => {
    const team = [
        { name: "Alex R.", role: "Architecture", img: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&q=80" },
        { name: "Sarah K.", role: "Cryptography", img: "https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&q=80" },
        { name: "David M.", role: "Design", img: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&q=80" },
        { name: "Elena V.", role: "Operations", img: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80" }
    ];

    return (
        <section className="py-32 px-6 w-full max-w-7xl mx-auto border-t border-white/5">
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                className="mb-20"
            >
                <h2 className="text-4xl font-light mb-4">The Architects</h2>
                <p className="text-gray-400">Built by protocol engineers and interface designers.</p>
            </motion.div>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
                {team.map((member, i) => (
                    <motion.div
                        key={i}
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        transition={{ delay: i * 0.1 }}
                        className="group cursor-pointer"
                    >
                        <div className="aspect-[3/4] rounded-2xl overflow-hidden mb-4 bg-white/5">
                            <img
                                src={member.img}
                                alt={member.name}
                                className="w-full h-full object-cover grayscale opacity-70 group-hover:grayscale-0 group-hover:opacity-100 transition-all duration-700 group-hover:scale-105"
                            />
                        </div>
                        <h3 className="text-xl font-medium">{member.name}</h3>
                        <p className="text-gray-500 font-light">{member.role}</p>
                    </motion.div>
                ))}
            </div>
        </section>
    );
};

// ==================== FOOTER ====================
const MinimalFooter = () => {
    return (
        <footer className="py-20 px-6 w-full border-t border-white/10 bg-black">
            <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-8">
                <div className="text-2xl font-semibold tracking-tighter">NEXUS</div>
                <div className="flex gap-8 text-sm text-gray-500 font-light">
                    <span className="hover:text-white cursor-pointer transition-colors">Manifesto</span>
                    <span className="hover:text-white cursor-pointer transition-colors">Documentation</span>
                    <span className="hover:text-white cursor-pointer transition-colors">GitHub</span>
                    <span className="hover:text-white cursor-pointer transition-colors">Twitter</span>
                </div>
            </div>
        </footer>
    );
}

// ==================== MAIN PAGE COMPONENT ====================
export default function AboutMinimalPreview() {
    return (
        <div className="bg-[#020202] min-h-screen text-gray-100 w-full overflow-x-hidden font-sans selection:bg-white selection:text-black">
            <TopNav />

            <main>
                <HeroSection />
                <PhilosophySection />
                <TokenomicsSection />
                <TeamSection />
            </main>

            <MinimalFooter />
        </div>
    );
}
