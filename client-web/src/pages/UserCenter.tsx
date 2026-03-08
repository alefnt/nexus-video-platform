// FILE: /video-platform/client-web/src/pages/UserCenter.tsx
/**
 * User Profile / Dashboard — matches nexus_profile_concept.html reference design.
 * Two-column layout: main content (hero, quick actions, library, invite) + sidebar (account, cache, dev tools).
 */

import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ApiClient } from "@video-platform/shared/api/client";
import { listCachedVideoIds, clearCachedVideo } from "../lib/offlineCache";
import type { VideoMeta, PointsBalance } from "@video-platform/shared/types";
import { useAuthStore, usePointsStore } from "../stores";

const client = new ApiClient();

export default function UserCenter() {
  const navigate = useNavigate();
  const jwt = typeof window !== "undefined" ? sessionStorage.getItem("vp.jwt") : null;
  const userRaw = typeof window !== "undefined" ? sessionStorage.getItem("vp.user") : null;
  const user = userRaw ? JSON.parse(userRaw) as { bitDomain?: string; ckbAddress?: string; nickname?: string; avatar?: string; id?: string } : null;

  const [playId, setPlayId] = useState<string>("");
  const [purchasedMetas, setPurchasedMetas] = useState<VideoMeta[]>([]);
  const [offlineMetas, setOfflineMetas] = useState<VideoMeta[]>([]);
  const [loadingPurchased, setLoadingPurchased] = useState(false);
  const storeBalance = usePointsStore((s) => s.balance);

  const userCkb = user?.ckbAddress || "";

  useEffect(() => {
    if (jwt) client.setJWT(jwt);
  }, [jwt]);

  useEffect(() => {
    async function fetchPurchasedMetas() {
      try {
        setLoadingPurchased(true);
        const metas = await client.get<VideoMeta[]>("/payment/purchases");
        setPurchasedMetas(metas || []);
      } catch { setPurchasedMetas([]); }
      finally { setLoadingPurchased(false); }
    }
    async function fetchOfflineMetas() {
      try {
        const ids = listCachedVideoIds();
        const metas: VideoMeta[] = [];
        for (const id of ids) {
          try { const m = await client.get<VideoMeta>(`/metadata/${id}`); if (m) metas.push(m); } catch { }
        }
        setOfflineMetas(metas);
      } catch { setOfflineMetas([]); }
    }
    // Fetch points balance
    if (jwt) {
      client.get<{ balance?: number; points?: number }>('/payment/points/balance')
        .then(res => { const bal = res?.balance ?? res?.points ?? 0; usePointsStore.getState().setBalance(bal); })
        .catch(() => { });
    }
    fetchPurchasedMetas();
    fetchOfflineMetas();
  }, [jwt]);

  function shorten(addr: string) {
    if (!addr) return "";
    return addr.length > 16 ? `${addr.slice(0, 8)}...${addr.slice(-6)}` : addr;
  }

  const formatPts = (n: number) => n >= 1000 ? `${(n / 1000).toFixed(1)}K` : String(n);

  const displayName = user?.bitDomain || user?.nickname || shorten(userCkb) || "Anonymous";
  const displayAddr = shorten(userCkb);

  if (!jwt || !user) {
    return (
      <div className="min-h-screen bg-[#050510] flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-white mb-4 font-display tracking-wide">Connect Your Wallet</h1>
          <p className="text-gray-400 mb-8">Login to access your profile and library</p>
          <button onClick={() => navigate("/login")} className="px-8 py-3 bg-[#22d3ee] text-black font-bold rounded-xl text-sm uppercase tracking-widest hover:bg-white transition-all">
            Connect Wallet
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="relative bg-[#050510] text-gray-200 font-sans pb-8">
        {/* Purple Hero Glow */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[80vw] h-[30vh] pointer-events-none z-0" style={{ background: 'radial-gradient(ellipse at top, rgba(168,85,247,0.15) 0%, transparent 70%)', filter: 'blur(60px)' }} />

        {/* Main Content */}
        <main className="max-w-6xl mx-auto w-full px-4 pt-8 relative z-10 flex flex-col gap-8">

          {/* Profile Header */}
          <div className="glass-profile-panel p-8 flex flex-col md:flex-row items-center gap-8 relative overflow-hidden group" style={{ background: 'rgba(10,10,20,0.6)', backdropFilter: 'blur(16px)', border: '1px solid rgba(255,255,255,0.05)', borderTop: '1px solid rgba(168,85,247,0.3)', borderRadius: 16 }}>
            <div className="absolute inset-0 bg-gradient-to-r from-purple-500/10 to-transparent opacity-50 pointer-events-none" />

            {/* Avatar with glow */}
            <div className="relative z-10">
              <div className="absolute -inset-[5px] rounded-full z-[-1]" style={{ background: 'conic-gradient(from 0deg, #22d3ee, #a855f7, #ec4899, #22d3ee)', filter: 'blur(10px)', opacity: 0.5, animation: 'spin 4s linear infinite' }} />
              <div className="w-32 h-32 rounded-full border-2 border-purple-500/50 bg-cover bg-center" style={{ backgroundImage: `url(${user?.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user?.id || 'nexus'}`})` }} />
            </div>

            {/* User Info */}
            <div className="flex-1 text-center md:text-left z-10">
              <h1 className="text-4xl font-bold mb-2 text-white tracking-wide flex items-center gap-3 justify-center md:justify-start" style={{ fontFamily: 'Outfit, system-ui, sans-serif' }}>
                {displayName}
                <span className="text-[10px] bg-[#22d3ee]/20 text-[#22d3ee] border border-[#22d3ee]/40 px-2 py-0.5 rounded uppercase tracking-widest font-sans">Verified</span>
              </h1>
              <div className="flex items-center justify-center md:justify-start gap-4 text-sm text-gray-400 font-mono mb-4">
                <span className="bg-white/5 px-3 py-1 rounded border border-white/10 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-[#22d3ee]" />
                  {displayAddr}
                </span>
                <span>Joined 2024</span>
              </div>
              <div className="flex gap-6 justify-center md:justify-start text-sm">
                <div><span className="font-bold text-white text-lg">12.5K</span> <span className="text-gray-500 uppercase tracking-widest text-[10px]">Followers</span></div>
                <div><span className="font-bold text-white text-lg">48</span> <span className="text-gray-500 uppercase tracking-widest text-[10px]">Streams</span></div>
                <div><span className="font-bold text-white text-lg">142</span> <span className="text-gray-500 uppercase tracking-widest text-[10px]">NFTs</span></div>
              </div>
            </div>

            {/* Points Card */}
            <div className="z-10 bg-black/40 p-5 rounded-2xl border border-white/10 text-center md:text-right min-w-[200px]">
              <div className="text-xs text-gray-500 mb-1 uppercase tracking-widest font-bold">Total Points</div>
              <div className="text-4xl font-black font-mono drop-shadow-[0_0_15px_rgba(234,179,8,0.3)]" style={{ color: '#eab308' }}>
                {storeBalance >= 1000 ? storeBalance.toLocaleString() : storeBalance}
              </div>
              <button onClick={() => navigate('/points')} className="w-full text-xs text-black font-bold px-4 py-2 mt-3 rounded-lg transition-colors uppercase tracking-widest hover:bg-yellow-400" style={{ background: '#eab308' }}>
                + Top Up Points
              </button>
            </div>
          </div>

          {/* Grid Layout: 2/3 main + 1/3 sidebar */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

            {/* Left Column */}
            <div className="lg:col-span-2 flex flex-col gap-8">

              {/* Quick Actions */}
              <div style={{ background: 'rgba(10,10,20,0.6)', backdropFilter: 'blur(16px)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: 16 }} className="p-6">
                <h2 className="text-sm font-bold text-white uppercase tracking-widest mb-4 flex items-center gap-2">
                  <span className="text-[#22d3ee]">⚡</span> Quick Actions
                </h2>
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                  <button onClick={() => navigate('/videos')} className="bg-[#22d3ee]/10 hover:bg-[#22d3ee]/20 border border-[#22d3ee]/30 text-[#22d3ee] rounded-xl p-4 flex flex-col items-center justify-center gap-2 transition-all group">
                    <span className="text-2xl group-hover:scale-110 transition-transform">📺</span>
                    <span className="text-xs font-bold uppercase tracking-wider">Browse</span>
                  </button>
                  <button onClick={() => navigate('/creator/dashboard')} className="bg-[#a855f7]/10 hover:bg-[#a855f7]/20 border border-[#a855f7]/30 text-[#a855f7] rounded-xl p-4 flex flex-col items-center justify-center gap-2 transition-all group">
                    <span className="text-2xl group-hover:scale-110 transition-transform">🚀</span>
                    <span className="text-xs font-bold uppercase tracking-wider">Creator Studio</span>
                  </button>
                  <button onClick={() => navigate('/tasks')} className="bg-[#eab308]/10 hover:bg-[#eab308]/20 border border-[#eab308]/30 text-[#eab308] rounded-xl p-4 flex flex-col items-center justify-center gap-2 transition-all group">
                    <span className="text-2xl group-hover:scale-110 transition-transform">🎯</span>
                    <span className="text-xs font-bold uppercase tracking-wider">Daily Quests</span>
                  </button>
                  <button onClick={() => navigate('/marketplace')} className="bg-[#ec4899]/10 hover:bg-[#ec4899]/20 border border-[#ec4899]/30 text-[#ec4899] rounded-xl p-4 flex flex-col items-center justify-center gap-2 transition-all group">
                    <span className="text-2xl group-hover:scale-110 transition-transform">🧩</span>
                    <span className="text-xs font-bold uppercase tracking-wider">Fragments</span>
                  </button>
                </div>
              </div>

              {/* My Library */}
              <div style={{ background: 'rgba(10,10,20,0.6)', backdropFilter: 'blur(16px)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: 16 }} className="p-6">
                <div className="flex justify-between items-end mb-6">
                  <h2 className="text-sm font-bold text-white uppercase tracking-widest flex items-center gap-2">🎬 My Library</h2>
                  <span className="text-xs text-gray-500 font-mono">{purchasedMetas.length} Items</span>
                </div>
                <div className="flex gap-4 overflow-x-auto pb-4 snap-x">
                  {purchasedMetas.length > 0 ? purchasedMetas.map((v) => (
                    <div key={v.videoId} className="min-w-[200px] snap-start group cursor-pointer" onClick={() => navigate(`/player/${v.videoId}`)}>
                      <div className="w-full aspect-video bg-gray-800 rounded-xl mb-3 overflow-hidden border border-white/5 group-hover:border-[#22d3ee]/50 transition-colors relative">
                        <img src={v.thumbnailUrl || `https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=400&h=225&fit=crop`} className="w-full h-full object-cover" alt={v.title} />
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                          <span className="w-10 h-10 rounded-full bg-[#22d3ee] text-black flex items-center justify-center font-bold">▶</span>
                        </div>
                      </div>
                      <h3 className="text-sm font-bold text-white truncate group-hover:text-[#22d3ee] transition-colors">{v.title}</h3>
                      <p className="text-[10px] text-gray-500 font-mono mt-1">Purchased via Stream</p>
                    </div>
                  )) : (
                    <>
                      {/* Fallback demo cards when no purchases */}
                      <div className="min-w-[200px] snap-start group cursor-pointer" onClick={() => navigate('/videos')}>
                        <div className="w-full aspect-video bg-gray-800 rounded-xl mb-3 overflow-hidden border border-white/5 group-hover:border-[#22d3ee]/50 transition-colors relative">
                          <img src="https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=400&h=225&fit=crop" className="w-full h-full object-cover" alt="Neon Genesis Runtime" />
                          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                            <span className="w-10 h-10 rounded-full bg-[#22d3ee] text-black flex items-center justify-center font-bold">▶</span>
                          </div>
                        </div>
                        <h3 className="text-sm font-bold text-white truncate group-hover:text-[#22d3ee] transition-colors">Neon Genesis Runtime</h3>
                        <p className="text-[10px] text-gray-500 font-mono mt-1">Purchased via Stream</p>
                      </div>
                      <div className="min-w-[200px] snap-start group cursor-pointer" onClick={() => navigate('/videos')}>
                        <div className="w-full aspect-video bg-gray-800 rounded-xl mb-3 overflow-hidden border border-white/5 group-hover:border-[#22d3ee]/50 transition-colors relative">
                          <img src="https://images.unsplash.com/photo-1550745165-9bc0b252726f?w=400&h=225&fit=crop" className="w-full h-full object-cover" alt="Cyberpunk Logic" />
                        </div>
                        <h3 className="text-sm font-bold text-white truncate group-hover:text-[#22d3ee] transition-colors">Cyberpunk Logic</h3>
                        <p className="text-[10px] text-gray-500 font-mono mt-1">Purchased: Buy Once</p>
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* Invite & Earn */}
              <div style={{ background: 'rgba(234,179,8,0.02)', backdropFilter: 'blur(16px)', border: '1px solid rgba(234,179,8,0.2)', borderRadius: 16 }} className="p-6">
                <div className="flex justify-between items-center mb-2">
                  <h2 className="text-sm font-bold uppercase tracking-widest flex items-center gap-2" style={{ color: '#eab308' }}>🎁 Invite & Earn</h2>
                  <span className="bg-[#eab308]/20 text-[#eab308] text-[10px] px-2 py-0.5 rounded font-bold uppercase tracking-widest">Beta</span>
                </div>
                <p className="text-xs text-gray-400 mb-4">Invite friends. You earn 100 PTS, they earn 50 PTS.</p>
                <div className="flex gap-2">
                  <div className="flex-1 bg-black/50 border border-white/10 rounded-lg px-4 flex items-center text-xs text-gray-400 font-mono truncate h-10">
                    https://nexus.video/?invite={shorten(userCkb)}
                  </div>
                  <button onClick={() => navigator.clipboard.writeText(`https://nexus.video/?invite=${userCkb}`)} className="bg-white/5 hover:bg-white/10 border border-white/10 text-white font-bold text-xs px-4 rounded-lg transition-colors uppercase tracking-widest">Copy</button>
                </div>
              </div>

            </div>

            {/* Right Column (Sidebar) */}
            <div className="flex flex-col gap-8">

              {/* Account Status */}
              <div style={{ background: 'rgba(10,10,20,0.6)', backdropFilter: 'blur(16px)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: 16 }} className="p-6">
                <h3 className="text-sm font-bold text-white uppercase tracking-widest mb-4">Account Status</h3>
                <div className="space-y-4 text-sm bg-black/40 rounded-xl p-4 border border-white/5">
                  <div className="flex justify-between items-center">
                    <span className="text-gray-500 font-bold uppercase text-[10px] tracking-widest">Network</span>
                    <span className="text-[#22d3ee] font-mono">CKB Testnet</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-500 font-bold uppercase text-[10px] tracking-widest">Identity</span>
                    <span className="text-green-400 font-bold">Verified JoyID</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-500 font-bold uppercase text-[10px] tracking-widest">Access Tier</span>
                    <span className="text-white font-bold">Creator Tier 1</span>
                  </div>
                </div>
                <button onClick={() => { useAuthStore.getState().logout(); navigate('/login'); }} className="w-full mt-4 border border-white/10 hover:bg-white/5 text-xs font-bold text-gray-400 uppercase tracking-widest py-3 rounded-xl transition-colors">
                  Disconnect Wallet
                </button>
              </div>

              {/* Offline Cache */}
              <div style={{ background: 'rgba(10,10,20,0.6)', backdropFilter: 'blur(16px)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: 16 }} className="p-6">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-sm font-bold text-white uppercase tracking-widest">Offline Cache</h3>
                  <button onClick={() => { const ids = listCachedVideoIds(); for (const id of ids) clearCachedVideo(id); setOfflineMetas([]); }} className="text-[10px] text-red-400 hover:text-red-300 uppercase tracking-widest font-bold">Clear All</button>
                </div>
                <div className="space-y-3">
                  {offlineMetas.length > 0 ? offlineMetas.map((m) => (
                    <div key={m.videoId} className="flex gap-3 bg-black/40 p-2 rounded-lg border border-white/5 items-center">
                      <div className="w-16 h-10 bg-gray-800 rounded overflow-hidden relative">
                        <img src={m.thumbnailUrl || 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=100&h=60&fit=crop'} className="w-full h-full object-cover" alt={m.title} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-bold text-white truncate">{m.title}</div>
                        <div className="text-[10px] text-gray-500 font-mono">245 MB</div>
                      </div>
                      <button onClick={() => { clearCachedVideo(m.videoId); setOfflineMetas(prev => prev.filter(x => x.videoId !== m.videoId)); }} className="text-gray-500 hover:text-white px-2">×</button>
                    </div>
                  )) : (
                    <div className="flex gap-3 bg-black/40 p-2 rounded-lg border border-white/5 items-center">
                      <div className="w-16 h-10 bg-gray-800 rounded overflow-hidden">
                        <img src="https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=100&h=60&fit=crop" className="w-full h-full object-cover" alt="Neon Genesis Runtime" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-bold text-white truncate">Neon Genesis Runtime</div>
                        <div className="text-[10px] text-gray-500 font-mono">245 MB</div>
                      </div>
                      <button className="text-gray-500 hover:text-white px-2">×</button>
                    </div>
                  )}
                </div>
              </div>

              {/* Developer Tools */}
              <div style={{ background: 'rgba(10,10,20,0.6)', backdropFilter: 'blur(16px)', border: '1px dashed rgba(255,255,255,0.2)', borderRadius: 16 }} className="p-6">
                <h3 className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-4">Developer Tools</h3>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Video ID"
                    value={playId}
                    onChange={(e) => setPlayId(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter' && playId.trim()) navigate(`/player/${playId.trim()}`); }}
                    className="flex-1 rounded-lg h-10 px-3 font-mono text-xs bg-white/5 border border-white/10 text-white focus:outline-none focus:border-[#22d3ee]/50"
                  />
                  <button onClick={() => { if (playId.trim()) navigate(`/player/${playId.trim()}`); }} className="bg-white/10 text-white font-bold text-xs px-4 rounded-lg uppercase tracking-widest hover:bg-white/20">Go</button>
                </div>
              </div>

            </div>
          </div>
        </main>
      </div>

      {/* Keyframes */}
      <style>{`
        @keyframes spin { 100% { transform: rotate(360deg); } }
      `}</style>
    </>
  );
}