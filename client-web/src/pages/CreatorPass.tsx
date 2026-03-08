/**
 * Creator Pass — Launch Creator Pass / NFT Membership
 *
 * Sections: Sidebar nav, Form (Pass Details, Tokenomics, Utility Engine), NFT Preview Card
 */
import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { setPageSEO } from "../utils/seo";

const UTILITIES = [
    { id: "gate", label: "Gate Premium VODs & Articles", desc: "Viewers without this pass must pay the per-video price. Pass holders get free access to all content marked \"Pass Gated\".", defaultChecked: true },
    { id: "adfree", label: "Ad-Free Viewing", desc: "Platform ads are bypassed on your channel for pass holders.", defaultChecked: true },
    { id: "vip", label: "Live Stream VIP Badge & Priorities", desc: "Distinct chat badge. Questions get pinned to top of queue for AMA streams.", defaultChecked: false },
];

export default function CreatorPass() {
    const navigate = useNavigate();
    const [name, setName] = useState("Cosmic VIP Access Pass");
    const [symbol, setSymbol] = useState("CVIP");
    const [description, setDescription] = useState("Official VIP pass yielding exclusive backstage content, ad-free viewing, and private community access for Cosmic Studios.");
    const [mintPrice, setMintPrice] = useState(15);
    const [totalSupply, setTotalSupply] = useState(1000);
    const [unlimited, setUnlimited] = useState(false);
    const [royalty, setRoyalty] = useState(5);
    const [utilities, setUtilities] = useState<Record<string, boolean>>({ gate: true, adfree: true, vip: false });

    useEffect(() => { setPageSEO?.({ title: "Launch Creator Pass | Nexus Video" }); }, []);

    const activeUtils = Object.values(utilities).filter(Boolean).length;

    return (
        <div className="flex h-full overflow-hidden">
            {/* Left sidebar */}
            <aside className="w-64 glass-panel border-r border-white/5 flex flex-col justify-between h-full z-20 relative !rounded-none !border-y-0 !border-l-0 hidden lg:flex">
                <div>
                    <div className="h-20 flex items-center px-8 cursor-pointer border-b border-white/5" onClick={() => navigate("/home")}>
                        <svg className="w-8 h-8 mr-3 text-nexusCyan drop-shadow-[0_0_8px_rgba(34,211,238,0.8)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
                        </svg>
                        <span className="text-xl font-black tracking-widest text-white">STUDIO</span>
                    </div>

                    <nav className="mt-8 flex flex-col gap-2 px-4">
                        <p className="px-4 text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Creator Suite</p>
                        <button onClick={() => navigate("/creator/dashboard")} className="flex items-center gap-4 px-4 py-3 rounded-xl text-gray-400 hover:text-white hover:bg-white/5 transition-all">
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" /></svg>
                            <span className="font-bold text-sm">Dashboard</span>
                        </button>
                        <div className="flex items-center gap-4 px-4 py-3 rounded-xl bg-gradient-to-r from-nexusPurple/20 to-transparent text-nexusPurple border-l-2 border-nexusPurple">
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>
                            <span className="font-bold text-sm">Pass Issuance</span>
                        </div>
                        <button onClick={() => navigate("/creator/upload")} className="flex items-center gap-4 px-4 py-3 rounded-xl text-gray-400 hover:text-white hover:bg-white/5 transition-all">
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" /></svg>
                            <span className="font-bold text-sm">Upload</span>
                        </button>
                    </nav>
                </div>
            </aside>

            {/* Main */}
            <main className="flex-1 flex flex-col h-full bg-[#050510] relative overflow-y-auto">
                {/* Topbar */}
                <header className="h-20 flex-shrink-0 flex items-center justify-between px-10 sticky top-0 z-50 bg-[#050510]/90 backdrop-blur-md border-b border-white/5">
                    <h1 className="text-xl font-bold text-white tracking-widest uppercase">Contract Deployment</h1>
                    <div className="flex items-center gap-2 text-xs font-mono">
                        <span className="text-nexusPurple">Setup</span>
                        <span className="text-gray-600">-</span>
                        <span className="text-gray-400">Preview</span>
                        <span className="text-gray-600">-</span>
                        <span className="text-gray-400">Sign</span>
                    </div>
                </header>

                <div className="p-10 pb-32 max-w-5xl mx-auto w-full">
                    <div className="mb-10 text-center">
                        <h1 className="text-4xl font-black text-white mb-4 drop-shadow-[0_0_15px_rgba(168,85,247,0.4)]">Launch Creator Pass</h1>
                        <p className="text-gray-400 max-w-2xl mx-auto">Create a smart contract to issue membership passes to your community. This NFT acts as a verifiable key granting holders exclusive access to your content, communities, and live streams.</p>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
                        {/* Left: Form */}
                        <div className="lg:col-span-2 space-y-8">
                            {/* Pass Details */}
                            <div className="glass-panel p-8 rounded-2xl">
                                <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
                                    <span className="w-6 h-6 rounded-full bg-nexusCyan/20 text-nexusCyan flex items-center justify-center text-xs font-bold border border-nexusCyan/50">1</span>
                                    Pass Details
                                </h2>
                                <div className="space-y-5">
                                    <div>
                                        <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Collection Name</label>
                                        <input type="text" value={name} onChange={e => setName(e.target.value)} className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-nexusPurple transition-colors" />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Symbol (Ticker)</label>
                                        <input type="text" value={symbol} onChange={e => setSymbol(e.target.value)} className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-sm font-mono text-white focus:outline-none focus:border-nexusPurple transition-colors" />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Description</label>
                                        <textarea rows={3} value={description} onChange={e => setDescription(e.target.value)} className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-nexusPurple transition-colors resize-none" />
                                    </div>
                                </div>
                            </div>

                            {/* Tokenomics */}
                            <div className="glass-panel p-8 rounded-2xl">
                                <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
                                    <span className="w-6 h-6 rounded-full bg-nexusPurple/20 text-nexusPurple flex items-center justify-center text-xs font-bold border border-nexusPurple/50">2</span>
                                    Tokenomics
                                </h2>
                                <div className="grid grid-cols-2 gap-5 mb-5">
                                    <div>
                                        <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Mint Price (USDC)</label>
                                        <div className="relative">
                                            <input type="number" value={mintPrice} onChange={e => setMintPrice(Number(e.target.value))} className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-sm font-mono text-white pl-10 focus:outline-none focus:border-nexusPurple transition-colors" />
                                            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 font-bold">$</span>
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Total Supply</label>
                                        <input type="number" value={totalSupply} onChange={e => setTotalSupply(Number(e.target.value))} disabled={unlimited} className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-sm font-mono text-white focus:outline-none focus:border-nexusPurple transition-colors disabled:opacity-50" />
                                        <label className="flex items-center gap-2 mt-2 cursor-pointer">
                                            <input type="checkbox" checked={unlimited} onChange={e => setUnlimited(e.target.checked)} className="w-4 h-4 rounded border-2 border-white/20 bg-transparent accent-nexusPurple" />
                                            <span className="text-xs text-gray-500">Unlimited Supply</span>
                                        </label>
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Secondary Market Royalty (%)</label>
                                    <input type="range" min="0" max="15" value={royalty} onChange={e => setRoyalty(Number(e.target.value))} className="w-full accent-nexusPurple" />
                                    <div className="flex justify-between text-xs mt-2 font-mono text-gray-500">
                                        <span>0%</span>
                                        <span className="text-nexusPurple font-bold">{royalty}%</span>
                                        <span>15%</span>
                                    </div>
                                </div>
                            </div>

                            {/* Utility Engine */}
                            <div className="glass-panel p-8 rounded-2xl border-nexusCyan/30 relative overflow-hidden">
                                <div className="absolute inset-0 bg-gradient-to-r from-nexusCyan/5 to-transparent" />
                                <div className="relative z-10">
                                    <h2 className="text-xl font-bold text-white mb-2 flex items-center gap-2">
                                        <span className="w-6 h-6 rounded-full bg-nexusCyan/20 text-nexusCyan flex items-center justify-center text-xs font-bold border border-nexusCyan/50">3</span>
                                        Utility Engine
                                    </h2>
                                    <p className="text-xs text-gray-400 mb-6">Bind native platform perks to this smart contract.</p>
                                    <div className="space-y-4">
                                        {UTILITIES.map(u => (
                                            <label key={u.id} className="flex items-start gap-4 p-4 bg-black/40 border border-white/5 rounded-xl cursor-pointer hover:border-nexusCyan/50 transition-colors">
                                                <input type="checkbox" checked={utilities[u.id] ?? false}
                                                    onChange={e => setUtilities(p => ({ ...p, [u.id]: e.target.checked }))}
                                                    className="w-5 h-5 mt-1 rounded border-2 border-white/20 bg-transparent accent-nexusPurple" />
                                                <div>
                                                    <div className="font-bold text-white text-sm">{u.label}</div>
                                                    <div className="text-[10px] text-gray-500 mt-1 leading-relaxed">{u.desc}</div>
                                                </div>
                                            </label>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            <button className="w-full py-5 rounded-xl bg-gradient-to-r from-nexusPurple to-pink-500 text-white font-bold tracking-widest uppercase shadow-[0_0_20px_rgba(168,85,247,0.4)] hover:shadow-[0_0_30px_rgba(236,72,153,0.6)] hover:scale-[1.01] transition-all text-sm flex items-center justify-center gap-3">
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                                </svg>
                                Deploy to Blockchain
                            </button>
                            <p className="text-center text-[10px] text-gray-500 font-mono">Estimated Gas Fee: ~0.001 CKB | Target Network: CKB Mainnet</p>
                        </div>

                        {/* Right: Preview */}
                        <div>
                            <div className="sticky top-28 glass-panel p-6 rounded-2xl border-nexusPurple/30">
                                <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-6">NFT Card Preview</h3>
                                <div className="relative aspect-[3/4] rounded-2xl overflow-hidden shadow-2xl group cursor-pointer mb-6 border border-white/10 bg-black">
                                    <img src="https://images.unsplash.com/photo-1620121692029-d088224ddc74?q=80&w=1000&auto=format&fit=crop" className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" alt="NFT" />
                                    <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent opacity-80" />
                                    <div className="absolute top-4 right-4 bg-nexusPurple/80 backdrop-blur text-white text-[10px] font-bold px-2 py-1 rounded">ERC-1155</div>
                                    <div className="absolute top-4 left-4 bg-black/60 backdrop-blur border border-white/20 text-white text-[10px] font-mono px-2 py-1 rounded">
                                        Supply: {unlimited ? "∞" : totalSupply}
                                    </div>
                                    <div className="absolute bottom-0 w-full p-5 backdrop-blur-md bg-black/30 border-t border-white/10">
                                        <div className="text-[10px] text-nexusCyan uppercase font-bold tracking-widest mb-1">{symbol || "PASS"}</div>
                                        <h4 className="text-xl font-black text-white truncate mb-2">{name || "Creator Pass"}</h4>
                                        <div className="flex justify-between items-end mt-4">
                                            <div>
                                                <div className="text-[10px] text-gray-400">Mint Price</div>
                                                <div className="text-lg font-mono font-bold text-white">$ {mintPrice.toFixed(2)}</div>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div className="bg-black/40 p-4 rounded-xl border border-white/5 space-y-3">
                                    <div className="flex justify-between text-xs"><span className="text-gray-500">Network</span><span className="font-mono text-white">CKB (Fiber)</span></div>
                                    <div className="flex justify-between text-xs"><span className="text-gray-500">Royalties</span><span className="font-mono text-white">{royalty}%</span></div>
                                    <div className="flex justify-between text-xs border-t border-white/10 pt-3"><span className="text-gray-500">Utilities</span><span className="text-nexusCyan font-bold">{activeUtils} Active</span></div>
                                </div>

                                <button className="w-full mt-6 py-2 bg-white/5 text-gray-400 text-xs hover:text-white rounded border border-white/10 transition-colors">
                                    Replace Artwork
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
}
