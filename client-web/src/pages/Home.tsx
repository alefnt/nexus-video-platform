// FILE: /video-platform/client-web/src/pages/Home.tsx
import React from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { getApiClient } from "../lib/apiClient";
import { useTrending } from "../hooks/useApi";
import { useUIStore } from "../stores";
import { usePageTitle } from "../hooks/usePageTitle";
import type { VideoMeta } from "@video-platform/shared/types";

export default function Home() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  usePageTitle(t('home.title'));
  const { data: trending = [], isLoading: loadingTrending } = useTrending();

  // Fill with empty items if not enough data to show the 4 card variants
  const trendingItems = trending.length >= 4 ? trending.slice(0, 4) : [
    ...trending,
    ...Array.from({ length: Math.max(0, 4 - trending.length) }).map((_, i) => ({ id: `mock-${i}`, title: 'Loading...', currentViews: 0 }))
  ];

  const addToast = useUIStore((s) => s.addToast);
  const handleAddToList = (e: React.MouseEvent) => {
    e.stopPropagation();
    addToast?.({ type: 'info', message: t('home.addToList') });
  };

  return (
    <div className="p-10 pb-32">
      {/* Hero Banner */}
      <div
        className="relative w-full h-[450px] rounded-[2rem] overflow-hidden mb-12 border border-white/10 group cursor-pointer shadow-2xl"
        onClick={() => navigate('/videos')}
      >
        <div className="hero-glow"></div>
        <img src="https://images.unsplash.com/photo-1451187580459-43490279c0fa?auto=format&fit=crop&q=80&w=1600"
          alt="Earth"
          className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-1000 ease-in-out" />

        {/* Gradient Overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-bgDarker via-bgDarker/60 to-transparent"></div>
        <div className="absolute inset-0 bg-gradient-to-r from-bgDarker via-bgDarker/40 to-transparent"></div>

        {/* Hero Content */}
        <div className="absolute inset-0 p-12 flex flex-col justify-end z-10">
          <div className="flex items-center gap-3 mb-4">
            <span className="bg-nexusCyan/20 text-nexusCyan border border-nexusCyan/50 px-3 py-1 rounded-full text-xs font-bold tracking-widest uppercase backdrop-blur-md">
              {t('homeHero.exclusivePremiere')}
            </span>
            <span className="text-gray-300 text-sm font-medium">Science Fiction • 2h 15m</span>
          </div>
          <h1 className="text-6xl font-black text-white mb-4 drop-shadow-lg">
            ECLIPSE <span className="text-3xl font-light text-gray-400">PROTOCOL</span>
          </h1>
          <p className="text-lg text-gray-300 max-w-2xl mb-8 drop-shadow-md">
            When the global power grid fails due to a solar flare, a cybernetics engineer must manually reboot the decentralized fallback network before society collapses.
          </p>

          <div className="flex items-center gap-5">
            <button
              className="bg-white text-black px-8 py-3.5 rounded-full font-bold flex items-center gap-2 hover:bg-gray-200 transition-colors shadow-[0_0_20px_rgba(255,255,255,0.4)]"
              onClick={(e) => { e.stopPropagation(); navigate('/videos'); }}
            >
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                <path d="M4 4l12 6-12 6z"></path>
              </svg>
              {t('homeHero.playTrailer')}
            </button>
            <button
              className="bg-nexusCyan/20 border border-nexusCyan text-white px-8 py-3.5 rounded-full font-bold flex items-center gap-2 hover:bg-nexusCyan/30 transition-colors backdrop-blur-md"
              onClick={(e) => { e.stopPropagation(); navigate('/videos'); }}
            >
              {t('homeHero.streamMovie')} ($0.08/min)
            </button>
            <button
              className="w-12 h-12 rounded-full border border-white/20 flex items-center justify-center text-white hover:bg-white/10 transition-colors backdrop-blur-md"
              onClick={handleAddToList}
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6"></path>
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* Categories / Tags Horizontal Scroll */}
      <div className="flex items-center gap-3 mb-8 overflow-x-auto pb-4 hide-scrollbar">
        <button className="bg-white text-black px-5 py-2 rounded-full text-sm font-bold flex-shrink-0">{t('homeHero.allContent')}</button>
        <button
          onClick={() => navigate('/videos')}
          className="glass-panel text-white hover:bg-white/10 px-5 py-2 rounded-full text-sm font-medium flex-shrink-0 transition-colors"
        >
          {t('homeHero.cinematicVideos')}
        </button>
        <button
          onClick={() => navigate('/music')}
          className="glass-panel text-white hover:bg-white/10 px-5 py-2 rounded-full text-sm font-medium flex-shrink-0 transition-colors"
        >
          {t('homeHero.hiFiAudio')}
        </button>
        <button
          onClick={() => navigate('/live')}
          className="glass-panel text-white hover:bg-white/10 px-5 py-2 rounded-full text-sm font-medium flex-shrink-0 transition-colors"
        >
          {t('homeHero.liveWatchParties')}
        </button>
        <button
          onClick={() => navigate('/articles')}
          className="glass-panel text-white hover:bg-white/10 px-5 py-2 rounded-full text-sm font-medium flex-shrink-0 transition-colors"
        >
          {t('homeHero.web3Research')}
        </button>
        <button
          onClick={() => navigate('/explore')}
          className="glass-panel text-white hover:bg-white/10 px-5 py-2 rounded-full text-sm font-medium flex-shrink-0 border-nexusCyan/30 text-nexusCyan transition-colors"
        >
          {t('homeHero.trendingOnFiber')}
        </button>
      </div>

      {/* Trending Section */}
      <div className="mb-12">
        <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-2">
          <svg className="w-6 h-6 text-nexusPink" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z"></path>
          </svg>
          {t('homeHero.trendingThisWeek')}
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">

          {/* Card 1: Video */}
          <div
            className="content-card relative rounded-xl overflow-hidden glass-panel group cursor-pointer aspect-video"
            onClick={() => navigate(`/player/${trendingItems[0]?.id || '1'}`)}
          >
            <img src={trendingItems[0]?.thumbnailUrl || trendingItems[0]?.posterUrl || "https://images.unsplash.com/photo-1536440136628-849c177e76a1?auto=format&fit=crop&q=80"}
              alt="Thumb" className="absolute inset-0 w-full h-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-black/10"></div>
            <div className="absolute top-3 left-3 bg-blue-500/20 text-blue-400 border border-blue-500/50 backdrop-blur-md px-2 py-1 rounded text-[10px] uppercase font-bold tracking-wider">
              Video
            </div>
            <div className="absolute top-3 right-3 bg-black/60 backdrop-blur-md px-2 py-1 rounded text-[10px] font-mono text-white">
              Stream: $0.05/m
            </div>

            <div className="absolute inset-0 flex items-center justify-center play-btn-overlay">
              <div className="w-14 h-14 bg-white rounded-full flex items-center justify-center shadow-lg">
                <svg className="w-6 h-6 text-black ml-1" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M4 4l12 6-12 6z"></path>
                </svg>
              </div>
            </div>

            <div className="absolute bottom-0 left-0 right-0 p-4">
              <h3 className="text-white font-bold mb-1 truncate">{trendingItems[0]?.title || "Cybernetics & The Soul"}</h3>
              <div className="flex items-center text-xs text-gray-400 gap-2">
                <span>{trendingItems[0]?.currentViews ? `${(trendingItems[0].currentViews / 1000).toFixed(1)}K views` : '0 views'}</span>
                <span>•</span>
                <span className="text-nexusCyan font-bold">{t('homeHero.earnsPoints')}</span>
              </div>
            </div>
          </div>

          {/* Card 2: Live */}
          <div
            className="content-card relative rounded-xl overflow-hidden glass-panel group cursor-pointer aspect-video border-red-500/30"
            onClick={() => navigate('/live')}
          >
            <img src="https://images.unsplash.com/photo-1542204165-65bf26472b9b?auto=format&fit=crop&q=80"
              alt="Thumb" className="absolute inset-0 w-full h-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-black/10"></div>
            <div className="absolute top-3 left-3 bg-red-500/20 text-red-500 border border-red-500/50 backdrop-blur-md px-2 py-1 rounded text-[10px] uppercase font-bold tracking-wider flex items-center gap-1.5 z-10">
              <span className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse"></span>LIVE
            </div>
            <div className="absolute top-3 right-3 bg-black/60 backdrop-blur-md px-2 py-1 rounded text-[10px] font-mono text-white z-10">
              VIP: $5.00
            </div>

            <div className="absolute inset-0 flex items-center justify-center play-btn-overlay z-10">
              <div className="w-14 h-14 bg-red-600 rounded-full flex items-center justify-center shadow-[0_0_20px_rgba(220,38,38,0.5)]">
                <svg className="w-6 h-6 text-white ml-1" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M4 4l12 6-12 6z"></path>
                </svg>
              </div>
            </div>

            <div className="absolute bottom-0 left-0 right-0 p-4 z-10">
              <h3 className="text-white font-bold mb-1 truncate">{trendingItems[1]?.title || "Global Developer Keynote"}</h3>
              <div className="flex items-center text-xs text-gray-400 gap-2">
                <span className="text-red-400">{trendingItems[1]?.currentViews ? `${(trendingItems[1].currentViews / 1000).toFixed(1)}K watching` : 'Live'}</span>
                <span>•</span>
                <span className="text-nexusPurple font-bold">{t('homeHero.watchPartyOn')}</span>
              </div>
            </div>
          </div>

          {/* Card 3: Music */}
          <div
            className="content-card relative rounded-xl overflow-hidden glass-panel group cursor-pointer aspect-video"
            onClick={() => navigate('/music')}
          >
            <img src="https://images.unsplash.com/photo-1614613535308-eb5fbd3d2c17?auto=format&fit=crop&q=80"
              alt="Thumb" className="absolute inset-0 w-full h-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-black/10 block group-hover:hidden transition-all"></div>
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm hidden group-hover:block transition-all"></div>

            <div className="absolute top-3 left-3 bg-purple-500/20 text-purple-400 border border-purple-500/50 backdrop-blur-md px-2 py-1 rounded text-[10px] uppercase font-bold tracking-wider z-10">
              Audio
            </div>
            <div className="absolute top-3 right-3 bg-black/60 backdrop-blur-md px-2 py-1 rounded text-[10px] font-mono text-white z-10">
              Buy: $1.20
            </div>

            {/* Animated music bars on hover */}
            <div className="absolute inset-0 flex items-center justify-center play-btn-overlay gap-1 z-10">
              <div className="w-1.5 h-4 bg-nexusPurple rounded-full animate-[bounce_1s_infinite]"></div>
              <div className="w-1.5 h-8 bg-nexusPurple rounded-full animate-[bounce_1s_infinite_0.2s]"></div>
              <div className="w-1.5 h-6 bg-nexusPurple rounded-full animate-[bounce_1s_infinite_0.4s]"></div>
              <div className="w-1.5 h-3 bg-nexusPurple rounded-full animate-[bounce_1s_infinite_0.6s]"></div>
            </div>

            <div className="absolute bottom-0 left-0 right-0 p-4 z-10">
              <h3 className="text-white font-bold mb-1 truncate">{trendingItems[2]?.title || "Lo-Fi Coding Beats V2"}</h3>
              <div className="flex items-center text-xs text-gray-400 gap-2">
                <span>Album • 8 Tracks</span>
              </div>
            </div>
          </div>

          {/* Card 4: Article */}
          <div
            className="content-card relative rounded-xl overflow-hidden glass-panel group cursor-pointer aspect-video bg-gradient-to-br from-gray-900 to-black p-5 flex flex-col justify-between border-t-2 border-t-green-500/50"
            onClick={() => navigate('/articles')}
          >
            <div className="flex justify-between items-start z-10">
              <div className="bg-green-500/20 text-green-400 border border-green-500/50 backdrop-blur-md px-2 py-1 rounded text-[10px] uppercase font-bold tracking-wider">
                Article
              </div>
              <div className="bg-black/60 backdrop-blur-md px-2 py-1 rounded text-[10px] font-mono text-white border border-white/10">
                Read: $0.15
              </div>
            </div>

            <div className="z-10 mt-auto">
              <h3 className="text-white font-bold text-lg mb-2 leading-tight">{trendingItems[3]?.title || "The Decentralization of AI Compute"}</h3>
              <div className="flex items-center text-xs text-gray-400 gap-2">
                <span>12 Min Read</span>
                <span>•</span>
                <span>By TechEthic</span>
              </div>
            </div>

            {/* BG Decoration */}
            <div className="absolute top-1/2 right-1/4 text-white/5 group-hover:text-green-500/10 transition-colors pointer-events-none transform -translate-y-1/2 scale-150">
              <svg className="w-32 h-32" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1" d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9.5a2.5 2.5 0 00-2.5-2.5H15M9 11l3 3L22 4"></path>
              </svg>
            </div>
          </div>

        </div>
      </div>

      {/* Added spacing at the bottom to match concept */}
      <div className="h-20"></div>
    </div>
  );
}
