import React from "react";
import "../styles/fun.css";
import TopNav from "../components/TopNav";
import { Button, Card, Input, Heading, TiltCard } from "../components/ui";
import ParticleBackground from "../components/ParticleBackground";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { getApiClient } from "../lib/apiClient";
import { useRecommendations, useTrending, usePointsBalance, useContinueWatching, useWatchlist, usePurchases, useCreatorStats, useCreatorUploads, useNotifications, useRefreshCache } from "../hooks/useApi";
import type { VideoMeta, PointsBalance } from "@video-platform/shared/types";
import { AnimatePresence, motion } from "framer-motion";
import { HeroCarousel, HeroSlide } from "../components/ui/HeroCarousel";
import { VideoCard } from "../components/ui/VideoCard";
import { SkeletonCardRow } from "../components/ui/SkeletonCard";
import { BentoGrid, BentoItem } from "../components/home/BentoGrid";
import { StatsTicker } from "../components/home/StatsTicker";
import { GamificationWidget } from "../components/home/GamificationWidget";
import { LiveWidget } from "../components/home/LiveWidget";
import { MusicWidget } from "../components/home/MusicWidget";
import { ArticleWidget } from "../components/home/ArticleWidget";
import { Play } from "lucide-react";

// Types
type Banner = { id: string; title: string; imageUrl?: string; link?: string };
type ContinueItem = { id: string; title?: string; progress?: number; positionSec?: number };

// Premium Section Header Component
function SectionHeader({
    title,
    subtitle,
    colorVar,
    actionLabel,
    onAction
}: {
    title: string,
    subtitle?: string,
    colorVar: string, // e.g., 'nexus-cyan', 'nexus-pink'
    actionLabel?: string,
    onAction?: () => void
}) {
    return (
        <div className="flex flex-col md:flex-row md:items-end justify-between mb-8 px-2 gap-4">
            <div>
                {subtitle && (
                    <div className="flex items-center gap-2 mb-2">
                        <div className={`w-1.5 h-1.5 rounded-full bg-${colorVar} shadow-[0_0_8px_var(--tw-colors-${colorVar})]`} />
                        <span className={`text-xs font-bold tracking-[0.2em] uppercase text-${colorVar}/80`}>{subtitle}</span>
                    </div>
                )}
                <h2 className="text-3xl md:text-4xl font-display font-bold text-white tracking-tight drop-shadow-lg">
                    {title}
                </h2>
            </div>

            {actionLabel && onAction && (
                <button
                    className={`group flex items-center gap-2 text-sm font-bold uppercase tracking-widest text-white/50 hover:text-${colorVar} transition-all`}
                    onClick={onAction}
                >
                    {actionLabel}
                    <span className="opacity-0 -ml-4 group-hover:opacity-100 group-hover:ml-0 transition-all duration-300">→</span>
                </button>
            )}
        </div>
    );
}

// Re-designed Swimlane (Added internal padding and better scroll snappings)
function SwimlaneSection({
    title,
    subtitle,
    accentColor,
    items,
    visibleCount,
    onLoadMore,
    loading,
    viewAllHref,
    viewAllLabel,
    loadMoreLabel,
}: {
    title: string;
    subtitle?: string;
    accentColor: "cyan" | "pink" | "purple";
    items: VideoMeta[];
    visibleCount: number;
    onLoadMore: () => void;
    loading: boolean;
    viewAllHref?: string;
    viewAllLabel?: string;
    loadMoreLabel: string;
}) {
    const navigate = useNavigate();
    const slice = items.slice(0, visibleCount);
    const hasMore = items.length > visibleCount;

    const colorMap = {
        cyan: 'nexus-cyan',
        pink: 'nexus-pink',
        purple: 'nexus-purple',
    };

    return (
        <section className="relative z-10 w-full py-8">
            <SectionHeader
                title={title}
                subtitle={subtitle}
                colorVar={colorMap[accentColor]}
                actionLabel={viewAllLabel}
                onAction={viewAllHref ? () => navigate(viewAllHref) : undefined}
            />

            <div className="relative w-full overflow-visible">
                {loading ? (
                    <SkeletonCardRow count={4} />
                ) : (
                    <>
                        <div className="flex gap-6 overflow-x-auto pb-10 pt-4 px-2 scrollbar-none snap-x snap-mandatory mask-fade-right">
                            {slice.map((v) => (
                                <div key={v.id} className="min-w-[280px] md:min-w-[340px] snap-center transition-all duration-500 hover:-translate-y-2 hover:z-20">
                                    <VideoCard
                                        id={v.id}
                                        title={v.title}
                                        thumbnailUrl={v.thumbnailUrl || v.posterUrl || v.poster || `https://picsum.photos/seed/${v.id}/400/225`}
                                        creatorName={v.creatorBitDomain || "Unknown Creator"}
                                        views={v.currentViews || 0}
                                        duration={v.durationSeconds ? `${Math.floor(v.durationSeconds / 60)}:${(v.durationSeconds % 60).toString().padStart(2, "0")}` : undefined}
                                    />
                                </div>
                            ))}
                        </div>
                        {hasMore && (
                            <div className="flex justify-center mt-4">
                                <button
                                    type="button"
                                    className={`px-8 py-3 rounded-full border border-white/10 text-white/70 hover:bg-white/5 hover:border-transparent hover:text-white text-sm font-bold tracking-widest uppercase transition-all shadow-xl`}
                                    onClick={onLoadMore}
                                >
                                    {loadMoreLabel}
                                </button>
                            </div>
                        )}
                    </>
                )}
            </div>
        </section>
    );
}

// Re-designed Continue Watching Card (Horizontal, Large Thumbnail)
function ContinueWatchingCard({ item, onClick }: { item: ContinueItem, onClick: () => void }) {
    return (
        <div
            onClick={onClick}
            className="group relative flex flex-col min-w-[320px] h-[200px] rounded-[1.5rem] overflow-hidden cursor-pointer border border-white/5 bg-black/40 backdrop-blur-xl transition-all duration-700 hover:border-nexus-purple/40 hover:shadow-[0_10px_40px_rgba(157,78,221,0.25)] hover:-translate-y-2 snap-center"
        >
            {/* Background Image with Deep Overlay */}
            <div
                className="absolute inset-0 bg-cover bg-center transition-transform duration-1000 group-hover:scale-110 group-hover:rotate-1"
                style={{ backgroundImage: `url(https://picsum.photos/seed/${item.id}/600/300)` }}
            >
                <div className="absolute inset-0 bg-gradient-to-t from-[#050510] via-[#050510]/60 to-transparent"></div>
            </div>

            {/* Premium Floating Play Button */}
            <div className="absolute inset-0 flex items-center justify-center opacity-0 scale-50 group-hover:opacity-100 group-hover:scale-100 transition-all duration-500 z-10">
                <div className="w-16 h-16 rounded-full bg-nexus-purple/90 backdrop-blur-md border border-white/20 flex items-center justify-center text-white shadow-[0_0_30px_#9d4edd]">
                    <Play fill="currentColor" size={24} className="ml-1" />
                </div>
            </div>

            {/* Content */}
            <div className="absolute bottom-0 left-0 right-0 p-6 z-20">
                <h4 className="text-lg font-bold text-white mb-4 truncate group-hover:text-nexus-cyan transition-colors drop-shadow-md">
                    {item.title || `Video ${item.id}`}
                </h4>

                {/* Cyberpunk Progress Bar */}
                <div className="w-full h-1 bg-white/10 rounded-full overflow-hidden absolute bottom-0 left-0">
                    <div
                        className="h-full bg-gradient-to-r from-nexus-purple via-[#00F5D4] to-nexus-cyan shadow-[0_0_15px_rgba(0,245,212,1)] transition-all duration-1000 ease-out"
                        style={{ width: `${item.progress}%` }}
                    />
                </div>
            </div>
        </div>
    );
}


export default function HomePreview() {
    const { t } = useTranslation();
    const navigate = useNavigate();

    // Hooks...
    const { data: recommend = [], isLoading: loadingRecommend } = useRecommendations();
    const { data: trending = [], isLoading: loadingTrending } = useTrending();

    // Mapping dynamic banners from trending data
    const dynamicBanners: HeroSlide[] = (trending as any[]).slice(0, 3).map((item: any, index: number) => ({
        id: `hero-${item.id}`,
        title: item.title || "Untitled Masterpiece",
        description: item.description || "Experience the most popular content on Nexus Protocol right now.",
        imageUrl: item.posterUrl || item.thumbnailUrl || item.poster || `https://picsum.photos/seed/${item.id}/1600/900`,
        link: item.contentType === 'music' ? '/music' : item.contentType === 'article' ? `/articles` : `/player/${item.id}`,
        tags: [index === 0 ? "Top #1 Activity" : "Trending", item.contentType === 'music' ? "Audio" : item.contentType === 'article' ? "Read" : "Video"]
    }));

    const finalBanners = dynamicBanners.length > 0 ? dynamicBanners : [
        {
            id: "hero-1",
            title: "Nexus Protocol Premiere",
            description: "The first decentralized streaming platform powered by Nervos CKB. Mint your moments.",
            imageUrl: "https://images.unsplash.com/photo-1535498730771-e735b998cd64?q=80&w=2560&auto=format&fit=crop",
            link: "/explore",
            tags: ["Original", "Sci-Fi"]
        }
    ];

    // Dummy data for preview logic
    const recommendVisible = 8;
    const trendingVisible = 8;
    const continueList: ContinueItem[] = [
        { id: "1", title: "Cyberpunk Gameplay Part 4", progress: 65 },
        { id: "2", title: "Web3 Architecture Deep Dive", progress: 22 },
        { id: "3", title: "Lofi Beats to Code to", progress: 90 },
        { id: "4", title: "React Query Crash Course", progress: 15 },
    ];

    return (
        <div className="min-h-screen bg-bgDarker pb-32 relative overflow-hidden font-sans">

            {/* Deep Ambient Background Grid */}
            <div className="fixed inset-0 z-0 pointer-events-none">
                <ParticleBackground particleCount={60} colors={["rgba(0, 245, 212, 0.2)", "rgba(157, 78, 221, 0.2)"]} />
                {/* Subtle light sweeps */}
                <div className="absolute top-0 right-0 w-[800px] h-[800px] bg-nexus-purple/5 blur-[150px] mix-blend-screen rounded-full"></div>
                <div className="absolute top-[40%] left-[-200px] w-[600px] h-[600px] bg-nexus-cyan/5 blur-[120px] mix-blend-screen rounded-full"></div>
                <div className="absolute bg-bgDarker/90 inset-0 mix-blend-normal"></div>
            </div>

            {/* Top Navigation - Ultra Glassmorphism */}
            <div className="fixed top-0 left-0 right-0 z-50 bg-bgDarker/40 backdrop-blur-2xl border-b border-white/5 transition-all duration-500 shadow-[0_4px_30px_rgba(0,0,0,0.8)]">
                <div className="container mx-auto max-w-[1500px] px-6">
                    <TopNav />
                </div>
            </div>

            <main className="container mx-auto max-w-[1500px] px-4 sm:px-6 pt-32 relative z-10 space-y-12">

                {/* SECTION 1: HERO CAROUSEL */}
                <section className="relative w-full max-w-[1300px] mx-auto">
                    {/* Glowing Aura behind Hero */}
                    <div className="absolute -inset-8 bg-gradient-to-tr from-nexus-purple/20 via-transparent to-nexus-cyan/20 blur-3xl opacity-60 z-0"></div>
                    <div className="relative z-10 shadow-[0_30px_60px_rgba(0,0,0,0.8)] rounded-3xl overflow-hidden border border-white/10">
                        <HeroCarousel slides={finalBanners} />
                    </div>
                </section>

                {/* SECTION 2: BENTO WIDGETS (Stats, Live, Gamification) */}
                <section className="py-12">
                    <SectionHeader
                        title="Dashboard Overview"
                        subtitle="Live Metrics & Activities"
                        colorVar="nexus-purple"
                    />
                    <BentoGrid className="!grid-cols-1 md:!grid-cols-4 gap-6">
                        <BentoItem span="col-1" className="h-[220px] bg-gradient-to-br from-white/5 to-transparent backdrop-blur-xl p-0 overflow-hidden group border border-white/10 hover:border-nexus-cyan/40 transition-all duration-500 shadow-xl rounded-3xl">
                            <StatsTicker />
                        </BentoItem>
                        <BentoItem span="col-2" className="h-[220px] md:h-auto bg-gradient-to-b from-white/5 to-transparent backdrop-blur-xl p-0 overflow-hidden border border-white/10 hover:border-nexus-pink/40 hover:shadow-[0_0_40px_rgba(255,46,147,0.15)] transition-all duration-500 shadow-xl rounded-3xl">
                            <LiveWidget />
                        </BentoItem>
                        <BentoItem span="col-1" className="h-[220px] bg-gradient-to-bl from-white/5 to-transparent backdrop-blur-xl p-0 overflow-hidden border border-white/10 hover:border-nexus-purple/40 transition-all duration-500 shadow-xl rounded-3xl">
                            <GamificationWidget />
                        </BentoItem>
                    </BentoGrid>
                </section>

                <div className="w-full h-px bg-gradient-to-r from-transparent via-white/10 to-transparent my-8" />

                {/* SECTION 3: RE-DESIGNED CONTINUE WATCHING (Horizontal Lane) */}
                {continueList.length > 0 && (
                    <section className="relative py-8">
                        <SectionHeader
                            title="Jump Back In"
                            subtitle="Pick up where you left off"
                            colorVar="nexus-cyan"
                        />
                        <div className="flex gap-6 overflow-x-auto pb-12 pt-2 px-2 scrollbar-none snap-x snap-mandatory mask-fade-right">
                            {continueList.map(c => (
                                <ContinueWatchingCard
                                    key={c.id}
                                    item={c}
                                    onClick={() => navigate(`/player/${c.id}`)}
                                />
                            ))}
                        </div>
                    </section>
                )}

                {/* SECTION 4: SWIMLANES */}
                <div className="bg-gradient-to-b from-black/0 via-black/40 to-black/0 -mx-6 px-6 py-12 rounded-[3rem]">
                    <SwimlaneSection
                        title="Trending Now"
                        subtitle="Global Hot Content"
                        accentColor="pink"
                        items={trending as any[]}
                        visibleCount={trendingVisible}
                        onLoadMore={() => { }}
                        loading={loadingTrending}
                        loadMoreLabel="Explore More Trending"
                    />

                    <SwimlaneSection
                        title="Made For You"
                        subtitle="Algorithmic Picks"
                        accentColor="cyan"
                        items={recommend as any[]}
                        visibleCount={recommendVisible}
                        onLoadMore={() => { }}
                        loading={loadingRecommend}
                        viewAllHref="/videos"
                        viewAllLabel="View All Suggestions"
                        loadMoreLabel="Load More"
                    />
                </div>

                {/* SECTION 5: DISCOVERY DESTINATIONS (Music & Articles) */}
                <section className="pt-16 pb-12">
                    <SectionHeader
                        title="Discovery Hubs"
                        subtitle="Explore Formats"
                        colorVar="[#FFD93D]"
                    />

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8 lg:gap-12">
                        {/* MUSIC PLATFORM CARD */}
                        <div className="group relative bg-black/40 backdrop-blur-2xl rounded-[2.5rem] border border-white/10 hover:border-[#FFD93D]/40 transition-all duration-700 h-[400px] shadow-2xl hover:shadow-[0_20px_60px_rgba(255,217,61,0.1)] flex flex-col">
                            {/* Abstract glowing orb behind music */}
                            <div className="absolute -top-20 -right-20 w-[300px] h-[300px] bg-[#FFD93D]/20 blur-[100px] rounded-full group-hover:bg-[#FFD93D]/30 group-hover:scale-150 transition-all duration-1000 z-0 pointer-events-none"></div>

                            {/* Absolute floating Title Badge */}
                            <div className="absolute top-6 right-6 z-30 pointer-events-none">
                                <div className="px-4 py-1.5 rounded-full bg-black/60 backdrop-blur-md border border-white/10 text-[#FFD93D] font-bold text-sm tracking-wider uppercase shadow-lg">
                                    Nexus Audio
                                </div>
                            </div>

                            <div className="relative w-full h-full z-10 overflow-hidden rounded-[2.5rem]">
                                <MusicWidget />
                            </div>
                        </div>

                        {/* ARTICLE PLATFORM CARD */}
                        <div className="group relative bg-black/40 backdrop-blur-2xl rounded-[2.5rem] border border-white/10 hover:border-nexus-cyan/40 transition-all duration-700 h-[400px] shadow-2xl hover:shadow-[0_20px_60px_rgba(0,245,212,0.1)] flex flex-col">
                            {/* Abstract glowing orb behind articles */}
                            <div className="absolute -bottom-20 -left-20 w-[300px] h-[300px] bg-nexus-cyan/20 blur-[100px] rounded-full group-hover:bg-nexus-cyan/30 group-hover:scale-150 transition-all duration-1000 z-0 pointer-events-none"></div>

                            {/* Absolute floating Title Badge */}
                            <div className="absolute top-6 right-6 z-30 pointer-events-none">
                                <div className="px-4 py-1.5 rounded-full bg-black/60 backdrop-blur-md border border-white/10 text-nexus-cyan font-bold text-sm tracking-wider uppercase shadow-lg">
                                    Read & Learn
                                </div>
                            </div>

                            <div className="relative w-full h-full z-10 overflow-hidden rounded-[2.5rem]">
                                <ArticleWidget />
                            </div>
                        </div>
                    </div>
                </section>

            </main>
        </div>
    );
}
