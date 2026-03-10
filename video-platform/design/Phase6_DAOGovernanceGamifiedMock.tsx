import React from 'react';
import { Users, Flame, Trophy, Star, ChevronRight, Fingerprint, Lock, Shield, Sparkles, Zap, Gift } from 'lucide-react';

export default function GamifiedDAOMock() {
    return (
        <div className="min-h-screen bg-[#08080c] text-white font-sans flex items-center justify-center p-8 relative overflow-hidden">

            {/* Background ambiance - Fandom/Concert Vibe */}
            <div className="absolute top-0 right-0 w-[800px] h-[800px] bg-amber-500/10 blur-[150px] rounded-full mix-blend-screen pointer-events-none" />
            <div className="absolute bottom-0 left-0 w-[600px] h-[600px] bg-pink-500/10 blur-[150px] rounded-full mix-blend-screen pointer-events-none" />

            <div className="w-full max-w-[420px] h-[850px] bg-[#0c0a12] rounded-[40px] border-[8px] border-gray-900 shadow-[0_0_50px_rgba(245,158,11,0.15)] relative overflow-hidden flex flex-col">

                {/* Status Bar */}
                <div className="h-12 w-full flex justify-between items-center px-8 z-50 text-xs font-bold font-mono">
                    <span>14:31</span>
                    <div className="flex items-center gap-1">
                        <Shield size={12} className="text-amber-400" /> <span className="text-amber-400">Guild Secured</span>
                    </div>
                </div>

                {/* Main Scrollable Area */}
                <div className="flex-1 overflow-y-auto hide-scrollbar pb-20">

                    {/* Header: Cover Image & Guild Name */}
                    <div className="relative h-64 w-full">
                        <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: "url('https://images.unsplash.com/photo-1514525253161-7a46d19cd819?q=80&w=1000')" }}>
                            <div className="absolute inset-0 bg-gradient-to-t from-[#0c0a12] via-[#0c0a12]/50 to-transparent" />
                        </div>

                        <div className="absolute bottom-0 left-4 right-4 z-10">
                            <div className="flex justify-between items-end mb-2">
                                <div>
                                    <div className="bg-amber-500 text-black text-[9px] font-black px-2 py-0.5 rounded uppercase tracking-widest inline-block mb-1 shadow-[0_0_10px_rgba(245,158,11,0.5)]">
                                        Verified Faction
                                    </div>
                                    <h1 className="text-3xl font-black drop-shadow-lg leading-none">Neon<br />Syndicate</h1>
                                </div>
                                {/* Fan Level / Voting Power */}
                                <div className="bg-black/40 backdrop-blur-md border border-white/10 rounded-xl p-2 text-center group cursor-pointer hover:border-amber-500/50 transition-colors">
                                    <div className="text-[10px] text-gray-400 font-bold mb-1 uppercase tracking-wider">Your Fan Cred</div>
                                    <div className="flex items-center justify-center gap-1">
                                        <Star size={16} className="text-amber-400 drop-shadow-[0_0_8px_rgba(245,158,11,0.8)]" fill="currentColor" />
                                        <span className="text-xl font-black text-white">LVL.4</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* The "Treasury" -> Reframed as "Guild Vault & Stretch Goals" */}
                    <div className="px-4 mt-4">
                        <div className="bg-gradient-to-br from-[#1a1412] to-[#120a0a] rounded-2xl border border-amber-500/20 p-4 relative overflow-hidden shadow-lg">
                            <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/10 blur-[30px] rounded-full" />

                            <div className="flex justify-between items-center mb-3 text-sm">
                                <span className="font-bold text-gray-300 flex items-center gap-1">
                                    <Trophy size={16} className="text-amber-500" /> Guild Vault
                                </span>
                                <span className="font-mono font-bold text-amber-500">1.2M CKB</span>
                            </div>

                            {/* Gamified progress bar for next unlock */}
                            <div className="mb-2">
                                <div className="flex justify-between text-[10px] text-gray-400 mb-1 font-bold">
                                    <span>Next Unlock: Exclusive Live Set</span>
                                    <span>75%</span>
                                </div>
                                <div className="h-2 w-full bg-black rounded-full overflow-hidden border border-white/5">
                                    <div className="h-full bg-gradient-to-r from-amber-600 to-amber-400 shadow-[0_0_10px_rgba(245,158,11,0.5)] w-[75%]" />
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* The "Proposals" -> Reframed as "Live Quests / Co-Creations" */}
                    <div className="px-4 mt-8">
                        <h2 className="text-lg font-black mb-4 flex items-center gap-2">
                            <Flame size={20} className="text-pink-500" /> Active Quests
                        </h2>

                        {/* Proposal Card 1 */}
                        <div className="bg-[#16141e] rounded-2xl p-4 mb-4 border border-white/5 relative group cursor-pointer hover:border-pink-500/30 transition-all shadow-xl">
                            {/* JoyID Invisible Auth interaction hint */}
                            <div className="absolute top-4 right-4 opacity-30 group-hover:opacity-100 transition-opacity">
                                <Fingerprint size={16} className="text-pink-400" />
                            </div>

                            <div className="flex gap-3 mb-3">
                                <div className="w-12 h-12 bg-gray-800 rounded-xl overflow-hidden shadow-md">
                                    <img src="https://images.unsplash.com/photo-1618336753174-c5cb35be8571?q=80&w=200" alt="project" className="w-full h-full object-cover" />
                                </div>
                                <div className="flex-1">
                                    <h3 className="font-bold text-[15px] leading-tight mb-1">Fund the Next CGI Music Video</h3>
                                    <span className="text-[10px] bg-pink-500/20 text-pink-400 px-2 py-0.5 rounded font-bold uppercase tracking-wider">
                                        Epic Drop
                                    </span>
                                </div>
                            </div>

                            {/* Voting Bar -> Reframed as "Hype Meter" */}
                            <div className="mb-4 bg-black/50 p-3 rounded-xl border border-white/5">
                                <div className="flex justify-between text-[12px] font-bold mb-2">
                                    <span className="text-green-400">🔥 Make it Happen (82%)</span>
                                    <span className="text-gray-500">Pass (18%)</span>
                                </div>
                                <div className="h-2 w-full bg-gray-800 rounded-full flex overflow-hidden shadow-inner">
                                    <div className="h-full bg-gradient-to-r from-green-500 to-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.5)]" style={{ width: '82%' }}></div>
                                    <div className="h-full bg-gray-700" style={{ width: '18%' }}></div>
                                </div>
                                <div className="flex items-center gap-1 mt-3">
                                    <div className="flex -space-x-2">
                                        <img src="https://i.pravatar.cc/100?img=1" className="w-5 h-5 rounded-full border border-black" alt="" />
                                        <img src="https://i.pravatar.cc/100?img=2" className="w-5 h-5 rounded-full border border-black" alt="" />
                                        <img src="https://i.pravatar.cc/100?img=3" className="w-5 h-5 rounded-full border border-black" alt="" />
                                    </div>
                                    <span className="text-[10px] text-gray-400 ml-1">and 3,421 others pledged</span>
                                </div>
                            </div>

                            <button className="w-full bg-gradient-to-r from-pink-600 to-purple-600 text-white font-black py-2.5 rounded-xl shadow-[0_0_15px_rgba(236,72,153,0.4)] flex items-center justify-center gap-2 hover:scale-[1.02] transition-transform">
                                <Zap size={16} fill="white" /> Back this Project
                            </button>
                        </div>

                        {/* Proposal Card 2 */}
                        <div className="bg-[#16141e] rounded-2xl p-4 mb-4 border border-white/5 relative opacity-70">
                            <div className="flex gap-3 mb-3">
                                <div className="w-12 h-12 bg-gray-800 rounded-xl flex flex-col items-center justify-center shadow-md border border-cyan-500/20">
                                    <Gift size={20} className="text-cyan-400" />
                                </div>
                                <div className="flex-1">
                                    <h3 className="font-bold text-[15px] leading-tight mb-1">Increase Co-creator Royalties to 15%</h3>
                                    <span className="text-[10px] bg-cyan-500/20 text-cyan-400 px-2 py-0.5 rounded font-bold uppercase tracking-wider">
                                        Governance
                                    </span>
                                </div>
                            </div>

                            <div className="flex justify-between items-center pt-2 border-t border-white/5">
                                <span className="text-xs text-green-400 font-bold">✅ Passed</span>
                                <span className="text-[10px] text-gray-500 font-mono">Executed on RGB++</span>
                            </div>
                        </div>

                    </div>
                </div>

                {/* Bottom Sticky Tab Bar Mock (Web2 feel) */}
                <div className="absolute bottom-0 w-full h-20 bg-black/80 backdrop-blur-xl border-t border-white/10 flex justify-around items-center px-4">
                    <div className="flex flex-col items-center opacity-50 cursor-pointer">
                        <div className="w-6 h-6 rounded flex items-center justify-center"><Sparkles size={20} /></div>
                        <span className="text-[9px] font-bold mt-1">Feed</span>
                    </div>
                    <div className="flex flex-col items-center opacity-50 cursor-pointer">
                        <div className="w-6 h-6 rounded flex items-center justify-center"><Star size={20} /></div>
                        <span className="text-[9px] font-bold mt-1">Discover</span>
                    </div>
                    <div className="flex flex-col items-center cursor-pointer text-amber-500">
                        <div className="w-12 h-12 bg-amber-500/20 border border-amber-500/50 rounded-full flex items-center justify-center shadow-[0_0_15px_rgba(245,158,11,0.3)] -mt-6">
                            <Shield size={24} fill="currentColor" className="text-amber-400" />
                        </div>
                        <span className="text-[9px] font-bold mt-1">Guilds</span>
                    </div>
                    <div className="flex flex-col items-center opacity-50 cursor-pointer">
                        <div className="w-6 h-6 rounded flex items-center justify-center"><Lock size={20} /></div>
                        <span className="text-[9px] font-bold mt-1">Studio</span>
                    </div>
                </div>
            </div>

            <div className="ml-12 max-w-xl">
                <h1 className="text-5xl font-black mb-4 tracking-tight"><span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-400 to-pink-500">Fan Guilds</span></h1>
                <h2 className="text-2xl font-bold text-white mb-6">The "Pan-Entertainment" take on DAOs.</h2>

                <p className="text-gray-300 text-lg leading-relaxed mb-8">
                    If we want mainstream users, we must kill the word "Governance". Users don't want to "Govern a DAO Protocol". They want to be VIP members of their favorite creator's Fan Club, rank up, and co-own exclusive content.
                </p>

                <div className="space-y-6">
                    <div className="bg-[#121016] p-6 rounded-2xl border border-white/10 shadow-xl">
                        <h3 className="text-xl font-bold flex items-center gap-2 mb-3 text-amber-400">
                            <Star size={24} /> 1. Leveling up instead of "Voting Power"
                        </h3>
                        <p className="text-sm text-gray-400">
                            Instead of showing static NFT tokens and a "VP score", users see their "Fan Cred Level". Technically, this is derived entirely from their Spore NFT holdings, but visually, it's just a fun loyalty program.
                        </p>
                    </div>

                    <div className="bg-[#121016] p-6 rounded-2xl border border-white/10 shadow-xl">
                        <h3 className="text-xl font-bold flex items-center gap-2 mb-3 text-pink-400">
                            <Zap size={24} /> 2. "Back this Project" instead of "Vote on Proposal"
                        </h3>
                        <p className="text-sm text-gray-400">
                            Standard DAO proposals are dry text files. Here, they look like Kickstarter campaigns or hype drops. The underlying mechanic is still a decentralized vote via smart contracts, but the UX feels like backing a cool creative endeavor.
                        </p>
                    </div>

                    <div className="bg-[#121016] p-6 rounded-2xl border border-white/10 shadow-xl">
                        <h3 className="text-xl font-bold flex items-center gap-2 mb-3 text-cyan-400">
                            <Trophy size={24} /> 3. The "Vault" Stretch Goals
                        </h3>
                        <p className="text-sm text-gray-400">
                            The Treasury isn't just a bank account. It's tied to "Stretch Goals" (Unlock: Exclusive Live Set). This creates extreme community FOMO and engagement, driving users to stream more to fill the vault together.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}
