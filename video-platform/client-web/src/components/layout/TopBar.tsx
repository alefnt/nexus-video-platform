// FILE: /video-platform/client-web/src/components/layout/TopBar.tsx
import React, { useState, useEffect, useCallback } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { getApiClient } from "../../lib/apiClient";
import { changeLanguage, getCurrentLanguage } from "../../i18n";
import { usePointsStore } from "../../stores";
import LiveFollowingNotification from "../live/LiveFollowingNotification";

const client = getApiClient();

export default function TopBar() {
    const navigate = useNavigate();
    const loc = useLocation();
    const { t } = useTranslation();
    const [searchQ, setSearchQ] = useState("");
    const [points, setPoints] = useState<number | null>(null);
    const [lang, setLang] = useState<"zh" | "en">(getCurrentLanguage());
    const storeBalance = usePointsStore((s) => s.balance);

    const jwt = typeof window !== "undefined" ? sessionStorage.getItem("vp.jwt") : null;
    const userRaw = typeof window !== "undefined" ? sessionStorage.getItem("vp.user") : null;
    const user = userRaw ? JSON.parse(userRaw) : null;

    const toggleLanguage = () => {
        const newLang = lang === "zh" ? "en" : "zh";
        changeLanguage(newLang);
        setLang(newLang);
    };

    useEffect(() => {
        if (jwt) {
            client.setJWT(jwt);
            client
                .get<{ balance?: number; points?: number }>(
                    '/payment/points/balance'
                )
                .then((res) => {
                    const bal = res?.balance ?? res?.points ?? 0;
                    usePointsStore.getState().setBalance(bal);
                })
                .catch(() => { });
        }
    }, [jwt]);

    const handleSearch = useCallback((e: React.FormEvent) => {
        e.preventDefault();
        const q = searchQ.trim();
        if (q) {
            navigate(`/search?q=${encodeURIComponent(q)}`);
        }
    }, [searchQ, navigate]);

    const formatPoints = (p: number) => {
        if (p >= 1000000) return `${(p / 1000000).toFixed(1)}M`;
        if (p >= 1000) return `${(p / 1000).toFixed(1)}K`;
        return p.toLocaleString();
    };

    const isPathActive = (path: string) => {
        if (path === "/home") return loc.pathname === "/home" || loc.pathname === "/";
        return loc.pathname.startsWith(path);
    };

    return (
        <header className="h-20 flex-shrink-0 flex items-center justify-between px-10 sticky top-0 z-50 bg-bgDarker/80 backdrop-blur-md border-b border-white/5">
            <div className="relative w-96">
                <form onSubmit={handleSearch}>
                    <svg className="w-5 h-5 absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path>
                    </svg>
                    <input
                        type="text"
                        value={searchQ}
                        onChange={(e) => setSearchQ(e.target.value)}
                        placeholder={t("search.placeholder", "Search movies, creators, tags...")}
                        className="w-full bg-white/5 border border-white/10 rounded-full py-2.5 pl-12 pr-4 text-sm text-white focus:outline-none focus:border-nexusCyan/50 focus:bg-white/10 transition-colors"
                    />
                </form>
            </div>

            <div className="flex items-center gap-6">
                {/* Dual Economy Header Info */}
                <div className="flex items-center gap-4 bg-white/5 border border-white/10 rounded-full py-1.5 px-4 hidden xl:flex">
                    {/* USDI Stablecoin Balance (left) */}
                    <div
                        className="flex items-center gap-1.5 cursor-pointer hover:text-white transition-colors group"
                        onClick={() => navigate("/points")}
                    >
                        <svg className="w-4 h-4 text-nexusCyan group-hover:drop-shadow-[0_0_5px_rgba(34,211,238,0.8)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                        </svg>
                        <span className="text-white font-bold text-sm">0.00</span>
                    </div>
                    <div className="w-px h-4 bg-white/20"></div>
                    {/* Points Balance (right) */}
                    <div
                        className="flex items-center gap-1.5 cursor-pointer hover:text-white transition-colors group"
                        onClick={() => navigate("/points")}
                    >
                        <svg className="w-4 h-4 text-yellow-400 group-hover:drop-shadow-[0_0_5px_rgba(250,204,21,0.8)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                        </svg>
                        <span className="text-white font-bold text-sm">{formatPoints(storeBalance)}</span>
                    </div>
                </div>

                <div className="relative flex items-center">
                    <LiveFollowingNotification />
                </div>

                <button className="relative text-gray-400 hover:text-white transition-colors">
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"></path>
                    </svg>
                    <span className="absolute top-0 right-0 w-2 h-2 bg-nexusPink rounded-full animate-pulse"></span>
                </button>

                {jwt ? (
                    <div
                        className="w-10 h-10 rounded-full bg-cover bg-center border border-white/20 cursor-pointer hover:border-nexusCyan transition-colors overflow-hidden"
                        style={{ backgroundImage: `url(${user?.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user?.id || 'nexus'}`})` }}
                        onClick={() => navigate("/user")}
                    ></div>
                ) : (
                    <button
                        onClick={() => navigate("/login")}
                        className="px-6 py-2 rounded-full bg-nexusCyan text-black font-black text-sm uppercase tracking-widest hover:bg-white transition-all"
                    >
                        Connect
                    </button>
                )}
            </div>
        </header>
    );
}
