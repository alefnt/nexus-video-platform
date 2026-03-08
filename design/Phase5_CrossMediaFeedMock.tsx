import React from 'react';
import { Play, Heart, MessageSquare, Share2, MoreHorizontal, FastForward, Maximize2, X, Disc, BookOpen, Music, Fingerprint, Coins, Zap, Activity } from 'lucide-react';

export default function Phase5_CrossMediaFeedMock() {
    return (
        <div className="min-h-screen bg-black text-white font-sans flex items-center justify-center p-8 relative overflow-hidden">

            {/* Background ambiance */}
            <div className="absolute top-0 right-0 w-[800px] h-[800px] bg-purple-500/10 blur-[150px] rounded-full mix-blend-screen pointer-events-none" />
            <div className="absolute bottom-0 left-0 w-[600px] h-[600px] bg-cyan-500/10 blur-[150px] rounded-full mix-blend-screen pointer-events-none" />

            <div className="w-full max-w-[420px] h-[850px] bg-[#08080c] rounded-[40px] border-[8px] border-gray-900 shadow-[0_0_50px_rgba(168,85,247,0.15)] relative overflow-hidden flex flex-col">

                {/* 顶部隐形状态栏 (仿 Web2 App, 带有 Web3 安全标识) */}
                <div className="h-12 w-full flex justify-between items-center px-8 z-50 text-xs font-bold font-mono absolute top-0 pointer-events-none">
                    <span className="opacity-50">14:38</span>
                    <div className="flex items-center gap-1 opacity-80">
                        {/* JoyID Session active indicator */}
                        <Fingerprint size={12} className="text-green-400" /> <span className="text-green-400">Passkey Active</span>
                    </div>
                </div>

                {/* 顶部导航 (分类过滤 + 资产状态) */}
                <div className="absolute top-12 left-0 right-0 z-40 px-6 flex justify-between items-center bg-gradient-to-b from-black/80 to-transparent pb-4 pt-2 mix-blend-screen">
                    <div className="flex gap-4 font-bold text-lg drop-shadow-md">
                        <span className="text-white border-b-2 border-white pb-1">For You</span>
                        <span className="text-gray-500">Following</span>
                    </div>
                    {/* Fiber Network Balance / Channel Status */}
                    <div className="flex items-center gap-1.5 bg-black/40 backdrop-blur-md px-3 py-1.5 rounded-full border border-white/10">
                        <Zap size={14} className="text-amber-400" />
                        <span className="text-xs font-mono font-bold text-amber-400">12.5 CKB</span>
                    </div>
                </div>

                {/* 主信息流 (全屏沉浸式) */}
                <div className="flex-1 overflow-hidden relative">

                    <div className="absolute inset-0 bg-gray-900">
                        {/* 模拟背景视频/图像 */}
                        <img
                            src="https://images.unsplash.com/photo-1618336753174-c5cb35be8571?q=80&w=800"
                            className="w-full h-full object-cover opacity-80 mix-blend-luminosity"
                            alt="Background Content"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent" />
                    </div>

                    {/* 右侧互动按钮区 (仿 TikTok/Reels) */}
                    <div className="absolute right-4 bottom-32 flex flex-col items-center gap-6 z-30">
                        <div className="relative group">
                            <div className="w-12 h-12 rounded-full border-2 border-white overflow-hidden mb-1 ring-2 ring-transparent group-hover:ring-pink-500 transition-all">
                                <img src="https://i.pravatar.cc/100?img=1" alt="avatar" />
                            </div>
                            <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 bg-pink-500 rounded-full w-5 h-5 flex items-center justify-center text-xs font-bold border border-white">
                                +
                            </div>
                        </div>

                        <div className="flex flex-col items-center gap-1">
                            <div className="w-10 h-10 rounded-full bg-black/40 backdrop-blur flex items-center justify-center text-white/90 hover:bg-white/10 transition-colors cursor-pointer">
                                <Heart size={24} fill="currentColor" className="text-red-500" />
                            </div>
                            <span className="text-xs font-bold shadow-black drop-shadow-md">24.5K</span>
                        </div>

                        <div className="flex flex-col items-center gap-1">
                            <div className="w-10 h-10 rounded-full bg-black/40 backdrop-blur flex items-center justify-center text-white/90 hover:bg-white/10 transition-colors cursor-pointer">
                                <MessageSquare size={22} fill="currentColor" />
                            </div>
                            <span className="text-xs font-bold shadow-black drop-shadow-md">1,204</span>
                        </div>

                        <div className="flex flex-col items-center gap-1">
                            <div className="w-10 h-10 rounded-full bg-black/40 backdrop-blur flex items-center justify-center text-white/90 hover:bg-white/10 transition-colors cursor-pointer">
                                <Share2 size={22} />
                            </div>
                            <span className="text-xs font-bold shadow-black drop-shadow-md">Share</span>
                        </div>

                        {/* Web3 特色操作: Mint NFT / Collect */}
                        <div className="flex flex-col items-center gap-1 mt-4">
                            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-cyan-400 to-blue-600 shadow-[0_0_15px_rgba(34,211,238,0.5)] flex items-center justify-center text-white cursor-pointer hover:scale-110 transition-transform relative overflow-hidden group">
                                <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-20 mix-blend-overlay"></div>
                                <Activity size={24} className="group-hover:animate-pulse" />
                            </div>
                            <span className="text-[10px] uppercase font-black tracking-wider text-cyan-400 drop-shadow-md">Collect</span>
                        </div>
                    </div>

                    {/* 左下角信息区 */}
                    <div className="absolute bottom-28 left-4 right-16 z-30 pointer-events-none">

                        {/* 跨媒体标签 (表明当前是何种内容) */}
                        <div className="flex gap-2 mb-2">
                            <span className="bg-purple-500/80 backdrop-blur-md px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide flex items-center gap-1">
                                <Music size={10} /> AI Music Track
                            </span>
                            {/* Web3 资产信息标识 */}
                            <span className="bg-blue-500/20 text-blue-300 border border-blue-500/30 px-2 py-0.5 rounded text-[10px] font-mono font-bold flex items-center gap-1">
                                <Disc size={10} /> Spore Protocol
                            </span>
                        </div>

                        <h2 className="text-xl font-bold leading-tight mb-2 drop-shadow-lg">Cybernetic Dreams Vol.1 (Official Audio)</h2>
                        <p className="text-sm text-gray-200 line-clamp-2 drop-shadow-md mb-3">
                            Generated entirely using our new AI Music Lab. The beat was trained on 90s trance stems. Fully on-chain via Arweave. #AI #Cyberpunk
                        </p>

                        {/* Fiber Network 流支付实时展示 (Web2的无感 + Web3的透明) */}
                        <div className="bg-black/40 backdrop-blur-md border border-amber-500/30 rounded-xl p-2.5 flex items-center gap-3 w-max">
                            <div className="relative">
                                <Zap size={16} className="text-amber-500" />
                                <div className="absolute inset-0 bg-amber-500 blur-sm mix-blend-screen opacity-50 animate-pulse"></div>
                            </div>
                            <div>
                                <div className="text-[10px] text-gray-400 font-bold uppercase tracking-wider mb-0.5">Streaming Payment</div>
                                <div className="font-mono text-xs text-amber-400 font-bold flex items-center gap-2">
                                    <span>-0.005 CKB/s</span>
                                    <div className="flex gap-0.5 h-2">
                                        <div className="w-1 bg-amber-500 animate-[bounce_1s_infinite_0ms]"></div>
                                        <div className="w-1 bg-amber-500 animate-[bounce_1s_infinite_100ms]"></div>
                                        <div className="w-1 bg-amber-500 animate-[bounce_1s_infinite_200ms]"></div>
                                    </div>
                                </div>
                            </div>
                            <div className="ml-2 border-l border-white/10 pl-3">
                                <div className="text-[9px] text-gray-400 mb-0.5">Creators get:</div>
                                <div className="text-[10px] text-pink-400 font-bold font-mono">92% RGB++</div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* 底部进度条 (跨媒体适用) */}
                <div className="absolute bottom-20 left-0 w-full h-1 bg-gray-800 z-50">
                    <div className="h-full bg-white relative w-1/3">
                        <div className="absolute right-0 top-1/2 -translate-y-1/2 w-2 h-2 bg-white rounded-full"></div>
                    </div>
                </div>

                {/* Bottom Navigation (Web2 标配) */}
                <div className="absolute bottom-0 w-full h-20 bg-black flex justify-around items-center px-4 z-50 border-t border-white/5">
                    <div className="flex flex-col items-center text-white cursor-pointer">
                        <div className="w-6 h-6 rounded flex items-center justify-center"><Maximize2 size={24} /></div>
                        <span className="text-[9px] font-bold mt-1">Explore</span>
                    </div>
                    <div className="flex flex-col items-center opacity-50 cursor-pointer hover:opacity-100 transition-opacity">
                        <div className="w-6 h-6 rounded flex items-center justify-center"><BookOpen size={24} /></div>
                        <span className="text-[9px] font-bold mt-1">Read</span>
                    </div>
                    <div className="flex flex-col items-center cursor-pointer -mt-4">
                        <div className="w-12 h-12 bg-gradient-to-br from-pink-500 to-purple-600 rounded-xl flex items-center justify-center shadow-[0_0_15px_rgba(236,72,153,0.3)] text-white">
                            <span className="text-2xl font-black">+</span>
                        </div>
                    </div>
                    <div className="flex flex-col items-center opacity-50 cursor-pointer hover:opacity-100 transition-opacity">
                        <div className="w-6 h-6 rounded flex items-center justify-center"><MessageSquare size={24} /></div>
                        <span className="text-[9px] font-bold mt-1">Inbox</span>
                    </div>
                    <div className="flex flex-col items-center opacity-50 cursor-pointer hover:opacity-100 transition-opacity">
                        <div className="w-6 h-6 rounded flex items-center justify-center overflow-hidden border border-white/30">
                            <img src="https://i.pravatar.cc/100?img=33" alt="profile" />
                        </div>
                        <span className="text-[9px] font-bold mt-1">Profile</span>
                    </div>
                </div>
            </div>

            {/* 背后说明面板 */}
            <div className="ml-12 max-w-xl">
                <h1 className="text-4xl font-black mb-4 tracking-tight leading-tight">
                    <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-cyan-400">Deep Integration:</span><br />
                    Web2 UX × Web3 Logic
                </h1>
                <h2 className="text-xl font-bold text-gray-300 mb-6">Phase 5: The Cross-Media Feed Engine</h2>

                <p className="text-gray-400 text-base leading-relaxed mb-6">
                    This is what sets the platform apart. The user experiences a frictionless, TikTok-like immersive feed containing Videos, Music, and Articles. But under the hood, every interaction triggers decentralized protocols.
                </p>

                <div className="space-y-4">
                    <div className="bg-[#121016] p-4 rounded-xl border border-white/5 shadow-lg flex gap-4 items-start">
                        <div className="bg-amber-500/10 p-2 rounded-lg text-amber-500"><Zap size={20} /></div>
                        <div>
                            <h3 className="font-bold text-white mb-1">Fiber Network (Stream Pay)</h3>
                            <p className="text-xs text-gray-400 leading-relaxed">
                                The user isn't clicking "Approve Transaction". JoyID established a session passkey. As the content plays, the Fiber L2 channel silently streams CKB micro-payments (-0.005 CKB/s). Web2 convenience, Web3 settlement.
                            </p>
                        </div>
                    </div>

                    <div className="bg-[#121016] p-4 rounded-xl border border-white/5 shadow-lg flex gap-4 items-start">
                        <div className="bg-pink-500/10 p-2 rounded-lg text-pink-400"><Activity size={20} /></div>
                        <div>
                            <h3 className="font-bold text-white mb-1">RGB++ Smart Royalties</h3>
                            <p className="text-xs text-gray-400 leading-relaxed">
                                The streamed CKB doesn't just go to a platform wallet. It's automatically split on-chain via RGB++ bindings. 92% routes directly to the creator's wallet, instantly. The UI surfaces this transparency.
                            </p>
                        </div>
                    </div>

                    <div className="bg-[#121016] p-4 rounded-xl border border-white/5 shadow-lg flex gap-4 items-start">
                        <div className="bg-cyan-500/10 p-2 rounded-lg text-cyan-400"><Disc size={20} /></div>
                        <div>
                            <h3 className="font-bold text-white mb-1">Spore Protocol (Collect / Mint)</h3>
                            <p className="text-xs text-gray-400 leading-relaxed">
                                The "Collect" button replaces a traditional "Mint NFT" flow. Content hosted on Arweave is minted as a Spore Protocol DOB. It's an emotional fandom action backed by real asset ownership.
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
