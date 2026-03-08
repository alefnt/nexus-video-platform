// FILE: /video-platform/client-web/src/components/layout/Sidebar.tsx
import React, { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";

export default function Sidebar() {
    const navigate = useNavigate();
    const loc = useLocation();
    const { t } = useTranslation();
    const [mobileOpen, setMobileOpen] = useState(false);

    const isActive = (paths: string[]) => {
        return paths.some(p =>
            p === "/home" ? (loc.pathname === "/home" || loc.pathname === "/") : loc.pathname.startsWith(p)
        );
    };

    const handleNav = (path: string) => {
        navigate(path);
        setMobileOpen(false);
    };

    const sidebarContent = (
        <div className="flex flex-col h-full bg-bgDarker/40 glass-panel border-r border-white/5 z-20 relative">
            {/* Logo */}
            <div
                className="h-20 flex items-center px-8 flex-shrink-0 cursor-pointer border-b border-white/5"
                onClick={() => handleNav("/home")}
            >
                <svg className="w-8 h-8 text-nexusCyan mr-3 drop-shadow-[0_0_8px_rgba(34,211,238,0.8)]" viewBox="0 0 24 24"
                    fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon>
                </svg>
                <span className="text-xl font-black tracking-widest text-white">NEXUS</span>
            </div>

            {/* Navigation */}
            <nav className="flex-1 overflow-y-auto mt-8 flex flex-col gap-2 px-4 hide-scrollbar">
                <p className="px-4 text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">
                    {t("sidebar.platform", "Platform")}
                </p>

                <button
                    onClick={() => handleNav("/home")}
                    className={`flex items-center gap-4 px-4 py-3 rounded-xl transition-all group w-full text-left ${isActive(["/home"])
                        ? "bg-gradient-to-r from-nexusCyan/20 to-transparent text-nexusCyan border-l-2 border-nexusCyan"
                        : "text-gray-500 hover:text-white hover:bg-white/5"
                        }`}
                >
                    <svg className={`w-5 h-5 flex-shrink-0 ${isActive(["/home"]) ? "" : "group-hover:text-nexusCyan transition-colors"}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"></path>
                    </svg>
                    <span className={`font-bold text-sm ${isActive(["/home"]) ? "" : "group-hover:translate-x-1 transition-transform"}`}>
                        {t("sidebar.discover", "Discover")}
                    </span>
                </button>

                <button
                    onClick={() => handleNav("/videos")}
                    className={`flex items-center gap-4 px-4 py-3 rounded-xl transition-all group w-full text-left ${isActive(["/videos", "/explore"])
                        ? "bg-gradient-to-r from-nexusCyan/20 to-transparent text-nexusCyan border-l-2 border-nexusCyan"
                        : "text-gray-500 hover:text-white hover:bg-white/5"
                        }`}
                >
                    <svg className={`w-5 h-5 flex-shrink-0 ${isActive(["/videos", "/explore"]) ? "" : "group-hover:text-nexusCyan transition-colors"}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"></path>
                    </svg>
                    <span className={`font-bold text-sm ${isActive(["/videos", "/explore"]) ? "" : "group-hover:translate-x-1 transition-transform"}`}>
                        {t("sidebar.movies", "Movies & TV")}
                    </span>
                </button>

                <button
                    onClick={() => handleNav("/music-v2")}
                    className={`flex items-center gap-4 px-4 py-3 rounded-xl transition-all group w-full text-left ${isActive(["/music-v2", "/music"])
                        ? "bg-gradient-to-r from-nexusCyan/20 to-transparent text-nexusCyan border-l-2 border-nexusCyan"
                        : "text-gray-500 hover:text-white hover:bg-white/5"
                        }`}
                >
                    <svg className={`w-5 h-5 flex-shrink-0 ${isActive(["/music-v2", "/music"]) ? "" : "group-hover:text-nexusCyan transition-colors"}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3"></path>
                    </svg>
                    <span className={`font-bold text-sm ${isActive(["/music-v2", "/music"]) ? "" : "group-hover:translate-x-1 transition-transform"}`}>
                        {t("sidebar.music", "Music")}
                    </span>
                </button>

                <button
                    onClick={() => handleNav("/articles")}
                    className={`flex items-center gap-4 px-4 py-3 rounded-xl transition-all group w-full text-left ${isActive(["/articles"])
                        ? "bg-gradient-to-r from-nexusCyan/20 to-transparent text-nexusCyan border-l-2 border-nexusCyan"
                        : "text-gray-500 hover:text-white hover:bg-white/5"
                        }`}
                >
                    <svg className={`w-5 h-5 flex-shrink-0 ${isActive(["/articles"]) ? "" : "group-hover:text-nexusCyan transition-colors"}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z"></path>
                    </svg>
                    <span className={`font-bold text-sm ${isActive(["/articles"]) ? "" : "group-hover:translate-x-1 transition-transform"}`}>
                        {t("sidebar.articles", "Articles")}
                    </span>
                </button>

                <p className="px-4 text-xs font-bold text-gray-500 uppercase tracking-wider mt-6 mb-2">
                    {t("sidebar.myAsset", "My Asset")}
                </p>

                <button
                    onClick={() => handleNav("/tasks")}
                    className={`flex items-center gap-4 px-4 py-3 rounded-xl transition-all group w-full text-left ${isActive(["/tasks"])
                        ? "bg-gradient-to-r from-nexusCyan/20 to-transparent text-nexusCyan border-l-2 border-nexusCyan"
                        : "text-gray-500 hover:text-white hover:bg-white/5"
                        }`}
                >
                    <svg className={`w-5 h-5 flex-shrink-0 ${isActive(["/tasks"]) ? "" : "group-hover:text-nexusCyan transition-colors"}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                    </svg>
                    <span className={`font-bold text-sm ${isActive(["/tasks"]) ? "" : "group-hover:translate-x-1 transition-transform"}`}>
                        {t("sidebar.quests", "Daily Quests")}
                    </span>
                </button>

                <button
                    onClick={() => handleNav("/points")}
                    className={`flex items-center gap-4 px-4 py-3 rounded-xl transition-all group w-full text-left ${isActive(["/points", "/wallet"])
                        ? "bg-gradient-to-r from-nexusCyan/20 to-transparent text-nexusCyan border-l-2 border-nexusCyan"
                        : "text-gray-500 hover:text-white hover:bg-white/5"
                        }`}
                >
                    <svg className={`w-5 h-5 flex-shrink-0 ${isActive(["/points", "/wallet"]) ? "" : "group-hover:text-nexusCyan transition-colors"}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"></path>
                    </svg>
                    <span className={`font-bold text-sm ${isActive(["/points", "/wallet"]) ? "" : "group-hover:translate-x-1 transition-transform"}`}>
                        {t("sidebar.wallet", "Wallet & Points")}
                    </span>
                </button>

                <button
                    onClick={() => handleNav("/fragments")}
                    className={`flex items-center gap-4 px-4 py-3 rounded-xl transition-all group w-full text-left ${isActive(["/fragments"])
                        ? "bg-gradient-to-r from-nexusCyan/20 to-transparent text-nexusCyan border-l-2 border-nexusCyan"
                        : "text-gray-500 hover:text-white hover:bg-white/5"
                        }`}
                >
                    <svg className={`w-5 h-5 flex-shrink-0 ${isActive(["/fragments"]) ? "" : "group-hover:text-nexusCyan transition-colors"}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z"></path>
                    </svg>
                    <span className={`font-bold text-sm ${isActive(["/fragments"]) ? "" : "group-hover:translate-x-1 transition-transform"}`}>
                        {t("sidebar.fragments", "My Fragments (NFTs)")}
                    </span>
                </button>

                <button
                    onClick={() => handleNav("/marketplace")}
                    className={`flex items-center gap-4 px-4 py-3 rounded-xl transition-all group w-full text-left ${isActive(["/marketplace"])
                        ? "bg-gradient-to-r from-nexusCyan/20 to-transparent text-nexusCyan border-l-2 border-nexusCyan"
                        : "text-gray-500 hover:text-white hover:bg-white/5"
                        }`}
                >
                    <svg className={`w-5 h-5 flex-shrink-0 ${isActive(["/marketplace"]) ? "" : "group-hover:text-nexusCyan transition-colors"}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z"></path>
                    </svg>
                    <span className={`font-bold text-sm ${isActive(["/marketplace"]) ? "" : "group-hover:translate-x-1 transition-transform"}`}>
                        {t("sidebar.marketplace", "NFT Marketplace")}
                    </span>
                </button>
            </nav>

            {/* Creator Studio Section */}
            <div className="p-4">
                <button
                    type="button"
                    onClick={() => handleNav("/creator/dashboard")}
                    className={`w-full bg-gradient-to-r from-nexusPurple to-pink-600 text-white font-black text-sm py-3.5 rounded-xl shadow-[0_0_20px_rgba(168,85,247,0.3)] hover:shadow-[0_0_30px_rgba(168,85,247,0.5)] transition-shadow flex justify-center items-center gap-2 group ${isActive(["/creator"]) ? 'ring-2 ring-nexusPurple/60' : ''}`}
                >
                    <svg className="w-4 h-4 group-hover:scale-125 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4"></path>
                    </svg>
                    {t("sidebar.creatorStudio", "Creator Studio")}
                </button>
                {/* Sub-links */}
                {isActive(["/creator"]) && (
                    <div className="mt-2 flex flex-col gap-0.5 pl-2">
                        {[
                            { path: '/creator/dashboard', icon: '⚙️', label: 'Dashboard' },
                            { path: '/creator/analytics', icon: '📊', label: 'Analytics' },
                            { path: '/creator/content', icon: '📁', label: 'Content' },
                            { path: '/creator/contracts', icon: '📝', label: 'Contracts' },
                            { path: '/creator/pass', icon: '🎫', label: 'Pass Issuance' },
                            { path: '/creator/upload', icon: '📤', label: 'Upload' },
                            { path: '/article/create', icon: '✏️', label: t('sidebar.articleEditor', 'Write Article') },
                            { path: '/creator/nft', icon: '🖼️', label: 'NFT Mint' },
                            { path: '/settings/platforms', icon: '🔗', label: 'Platform Connections' },
                            { path: '/studio/ai/music', icon: '🎼', label: 'AI Music Lab' },
                            { path: '/studio/ai/article', icon: '📝', label: 'AI Article Lab' },
                        ].map(item => (
                            <button
                                key={item.path}
                                onClick={() => handleNav(item.path)}
                                className={`flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-bold transition-all w-full text-left ${loc.pathname === item.path ? 'bg-nexusPurple/20 text-nexusPurple' : 'text-gray-500 hover:text-white hover:bg-white/5'}`}
                            >
                                <span className="text-sm">{item.icon}</span>
                                {item.label}
                            </button>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );

    return (
        <>
            {/* Desktop Sidebar */}
            <aside className="hidden md:flex w-64 flex-shrink-0 flex-col h-full bg-[#080811]">
                {sidebarContent}
            </aside>

            {/* Mobile Menu Toggle */}
            <button
                type="button"
                className="md:hidden fixed top-5 left-4 z-[60] w-10 h-10 rounded-xl bg-white/10 backdrop-blur-md border border-white/10 flex items-center justify-center text-white shadow-lg"
                onClick={() => setMobileOpen(!mobileOpen)}
                aria-label="Toggle menu"
            >
                {mobileOpen ? (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                ) : (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16"></path></svg>
                )}
            </button>

            {/* Mobile Sidebar Overlay */}
            {mobileOpen && (
                <>
                    <div
                        className="md:hidden fixed inset-0 bg-black/80 z-[50] backdrop-blur-md"
                        onClick={() => setMobileOpen(false)}
                    />
                    <aside className="md:hidden fixed left-0 top-0 bottom-0 w-72 z-[55] flex flex-col bg-[#080811] shadow-2xl">
                        {sidebarContent}
                    </aside>
                </>
            )}
        </>
    );
}

