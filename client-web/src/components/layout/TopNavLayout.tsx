import React, { useState, useEffect } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Bell, MessageSquare, Search, Zap } from 'lucide-react';
import { useAuthStore, usePointsStore } from '../../stores';
import { getApiClient } from '../../lib/apiClient';

const client = getApiClient();

export default function TopNavLayout() {
    const navigate = useNavigate();
    const location = useLocation();
    const { t } = useTranslation();
    const storeUser = useAuthStore((s) => s.user);
    const [showUserMenu, setShowUserMenu] = useState(false);

    // Fallback: if Zustand store doesn't have user, check sessionStorage directly
    const user = storeUser || (() => {
        try {
            const jwt = sessionStorage.getItem('vp.jwt');
            const raw = sessionStorage.getItem('vp.user');
            if (jwt && raw) {
                const parsed = JSON.parse(raw);
                // Sync back to Zustand store for future renders
                useAuthStore.getState().login(jwt, parsed);
                return parsed;
            }
        } catch { }
        return null;
    })();

    const handleNav = (path: string) => {
        navigate(path);
    };

    const currentPath = location.pathname;

    const storeBalance = usePointsStore((s) => s.balance);
    useEffect(() => {
        const jwt = sessionStorage.getItem('vp.jwt');
        if (jwt) {
            const client = getApiClient();
            client.setJWT(jwt);
            client.get<{ balance?: number; points?: number }>('/payment/points/balance')
                .then(res => {
                    const bal = res?.balance ?? res?.points ?? 0;
                    usePointsStore.getState().setBalance(bal);
                })
                .catch(() => { });
        }
    }, []);

    const formatPts = (n: number) => n >= 1000 ? `${(n / 1000).toFixed(1)}K` : String(n);

    return (
        <div className="min-h-screen bg-[#030308] text-white flex flex-col font-sans">
            {/* Top Navigation Bar */}
            <header className="h-[80px] bg-black/40 backdrop-blur-xl border-b border-white/5 sticky top-0 z-50 flex items-center justify-between px-6 lg:px-8">

                {/* Left: Logo & Main Nav */}
                <div className="flex items-center gap-8 lg:gap-12">
                    {/* Logo */}
                    <div
                        className="flex items-center gap-3 cursor-pointer group"
                        onClick={() => handleNav('/home')}
                    >
                        <div className="w-8 h-8 rounded-lg bg-nexusCyan/20 flex items-center justify-center border border-nexusCyan/30 group-hover:bg-nexusCyan/30 transition-colors">
                            <Zap className="w-5 h-5 text-nexusCyan" />
                        </div>
                        <span className="text-xl font-display font-black tracking-widest text-white group-hover:text-nexusCyan transition-colors">
                            NEXUS
                        </span>
                    </div>

                    {/* Navigation Links */}
                    <nav className="hidden md:flex items-center gap-1">
                        <button
                            onClick={() => handleNav('/home')}
                            className={`px-4 py-2 text-sm font-bold uppercase tracking-widest transition-colors ${currentPath === '/home' ? 'text-nexusCyan' : 'text-gray-400 hover:text-white'}`}
                        >
                            Home
                        </button>
                        <button
                            onClick={() => handleNav('/videos')}
                            className={`px-4 py-2 text-sm font-bold uppercase tracking-widest transition-colors ${currentPath.startsWith('/videos') || currentPath === '/explore' ? 'text-nexusCyan' : 'text-gray-400 hover:text-white'}`}
                        >
                            Explore
                        </button>
                        <button
                            onClick={() => handleNav('/live')}
                            className={`px-4 py-2 text-sm font-bold uppercase tracking-widest transition-colors flex items-center gap-2 ${currentPath.startsWith('/live') ? 'text-nexusPink' : 'text-gray-400 hover:text-white'}`}
                        >
                            <div className="w-2 h-2 rounded-full bg-nexusPink animate-pulse"></div>
                            Live
                        </button>
                        <button
                            onClick={() => handleNav('/articles')}
                            className={`px-4 py-2 text-sm font-bold uppercase tracking-widest transition-colors ${currentPath.startsWith('/articles') ? 'text-nexusCyan' : 'text-gray-400 hover:text-white'}`}
                        >
                            Read
                        </button>
                        <button
                            onClick={() => handleNav('/music')}
                            className={`px-4 py-2 text-sm font-bold uppercase tracking-widest transition-colors ${currentPath.startsWith('/music') ? 'text-nexusPurple' : 'text-gray-400 hover:text-white'}`}
                        >
                            Audio
                        </button>
                        <button
                            onClick={() => handleNav('/creator/dashboard')}
                            className={`px-4 py-2 text-sm font-bold uppercase tracking-widest transition-colors ${currentPath.startsWith('/creator') ? 'text-nexusCyan' : 'text-gray-400 hover:text-white'}`}
                        >
                            Studio
                        </button>
                    </nav>
                </div>

                {/* Right: Search, Economy, Profile */}
                <div className="flex items-center gap-4 lg:gap-6">
                    {/* Search Bar */}
                    <div className="hidden lg:flex items-center bg-black/40 border border-white/10 rounded-full px-4 py-2 w-80 focus-within:border-nexusCyan/50 focus-within:bg-black transition-all">
                        <Search className="w-4 h-4 text-gray-400" />
                        <input
                            type="text"
                            placeholder="Search title, genre, creator..."
                            className="bg-transparent border-none outline-none text-sm text-white ml-3 w-full placeholder-gray-600"
                        />
                    </div>

                    {/* Dual Economy: USDI (left) | Points (right) */}
                    <div className="hidden sm:flex items-center gap-3 bg-white/5 border border-white/10 rounded-full py-1.5 px-4">
                        <div className="flex items-center gap-1.5 cursor-pointer hover:text-white transition-colors" onClick={() => handleNav('/points')}>
                            <div className="w-5 h-5 rounded-full bg-nexusCyan text-black flex items-center justify-center text-[10px] font-black">$</div>
                            <span className="text-sm font-mono font-bold text-nexusCyan">0.00</span>
                        </div>
                        <div className="w-px h-4 bg-white/20"></div>
                        <div className="flex items-center gap-1.5 cursor-pointer hover:text-white transition-colors" onClick={() => handleNav('/points')}>
                            <div className="w-5 h-5 rounded-full bg-nexusYellow text-black flex items-center justify-center text-[10px] font-black">N</div>
                            <span className="text-sm font-mono font-bold text-nexusYellow">{formatPts(storeBalance)}</span>
                        </div>
                    </div>

                    <div className="w-px h-6 bg-white/10 hidden sm:block"></div>

                    {/* Notifications & Messages */}
                    <div className="flex items-center gap-2">
                        <button className="w-10 h-10 rounded-full flex items-center justify-center hover:bg-white/10 text-gray-400 hover:text-white transition-colors relative" onClick={() => handleNav('/notifications')}>
                            <Bell className="w-5 h-5" />
                        </button>
                        <button className="w-10 h-10 rounded-full flex items-center justify-center hover:bg-white/10 text-gray-400 hover:text-white transition-colors relative" onClick={() => handleNav('/messages')}>
                            <MessageSquare className="w-5 h-5" />
                            <div className="absolute top-2 right-2 w-2 h-2 rounded-full bg-nexusPink border-2 border-[#030308]"></div>
                        </button>
                    </div>

                    {/* User Profile */}
                    {user ? (
                        <div className="relative">
                            <button
                                className="w-10 h-10 rounded-full overflow-hidden border-2 border-white/10 hover:border-nexusCyan transition-colors"
                                onClick={() => setShowUserMenu(!showUserMenu)}
                            >
                                <img src={user.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.id}`} alt="User Avatar" className="w-full h-full object-cover" />
                            </button>
                            {showUserMenu && (
                                <>
                                    <div className="fixed inset-0 z-40" onClick={() => setShowUserMenu(false)} />
                                    <div className="absolute right-0 top-12 w-48 bg-[#0A0A14] border border-white/10 rounded-xl shadow-2xl z-50 py-2 overflow-hidden">
                                        <button
                                            onClick={() => { handleNav('/user'); setShowUserMenu(false); }}
                                            className="w-full px-4 py-2.5 text-sm text-gray-300 hover:bg-white/5 hover:text-white flex items-center gap-3 transition-colors"
                                        >
                                            <span>👤</span> Profile
                                        </button>
                                        <button
                                            onClick={() => { handleNav('/points'); setShowUserMenu(false); }}
                                            className="w-full px-4 py-2.5 text-sm text-gray-300 hover:bg-white/5 hover:text-white flex items-center gap-3 transition-colors"
                                        >
                                            <span>💰</span> Wallet & Points
                                        </button>
                                        <button
                                            onClick={() => { handleNav('/tasks'); setShowUserMenu(false); }}
                                            className="w-full px-4 py-2.5 text-sm text-gray-300 hover:bg-white/5 hover:text-white flex items-center gap-3 transition-colors"
                                        >
                                            <span>🎯</span> Daily Quests
                                        </button>
                                        <div className="border-t border-white/10 my-1" />
                                        <button
                                            onClick={() => {
                                                useAuthStore.getState().logout();
                                                handleNav('/login');
                                                setShowUserMenu(false);
                                            }}
                                            className="w-full px-4 py-2.5 text-sm text-red-400 hover:bg-red-500/10 flex items-center gap-3 transition-colors"
                                        >
                                            <span>🚪</span> Sign Out
                                        </button>
                                    </div>
                                </>
                            )}
                        </div>
                    ) : (
                        <button
                            className="px-5 py-2 rounded-full bg-nexusCyan text-black font-bold text-sm uppercase tracking-widest hover:bg-white transition-all"
                            onClick={() => handleNav('/login')}
                        >
                            Connect
                        </button>
                    )}
                </div>
            </header>

            {/* Main Content Area */}
            <main className="flex-1 flex flex-col relative">
                <Outlet />
            </main>
        </div>
    );
}
