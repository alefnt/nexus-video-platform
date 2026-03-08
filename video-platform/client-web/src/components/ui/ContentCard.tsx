// FILE: /video-platform/client-web/src/components/ui/ContentCard.tsx
/**
 * ContentCard — 统一内容卡片组件
 *
 * 支持 video | live | audio | article 四种类型
 * 每种类型有不同颜色标签（蓝/红/紫/绿）
 * 悬浮显示播放按钮 + 定价信息
 * 参考 nexus_home_concept.html 卡片设计
 */

import React from "react";
import { useNavigate } from "react-router-dom";
import { Play } from "lucide-react";

export type ContentType = "video" | "live" | "audio" | "article";

export interface ContentCardProps {
    id: string;
    type: ContentType;
    title: string;
    thumbnailUrl?: string;
    /** e.g. "1.2M views", "85K watching", "Album • 8 Tracks", "12 Min Read" */
    subtitle?: string;
    /** e.g. "Stream: $0.05/m", "VIP: $5.00", "Buy: $1.20", "Read: $0.15" */
    priceLabel?: string;
    /** Extra info: "Earns Pts", "Watch Party On", "By TechEthic" */
    badge?: string;
    /** badge color class override */
    badgeClass?: string;
    /** link destination, defaults to /player/:id */
    href?: string;
    className?: string;
}

const TYPE_CONFIG: Record<ContentType, {
    label: string;
    bgClass: string;
    textClass: string;
    borderClass: string;
    playBg: string;
}> = {
    video: {
        label: "Video",
        bgClass: "bg-blue-500/20",
        textClass: "text-blue-400",
        borderClass: "border-blue-500/50",
        playBg: "bg-white",
    },
    live: {
        label: "LIVE",
        bgClass: "bg-red-500/20",
        textClass: "text-red-500",
        borderClass: "border-red-500/50",
        playBg: "bg-red-600",
    },
    audio: {
        label: "Audio",
        bgClass: "bg-nexusPurple/20",
        textClass: "text-nexusPurple",
        borderClass: "border-nexusPurple/50",
        playBg: "bg-nexusPurple",
    },
    article: {
        label: "Article",
        bgClass: "bg-green-500/20",
        textClass: "text-green-400",
        borderClass: "border-green-500/50",
        playBg: "bg-green-600",
    },
};

export function ContentCard({
    id,
    type,
    title,
    thumbnailUrl,
    subtitle,
    priceLabel,
    badge,
    badgeClass,
    href,
    className = "",
}: ContentCardProps) {
    const navigate = useNavigate();
    const config = TYPE_CONFIG[type];
    const destination = href || `/player/${id}`;

    const handleClick = () => navigate(destination);

    // Article type has a different layout (no image, gradient bg)
    if (type === "article") {
        return (
            <div
                className={`content-card relative rounded-xl overflow-hidden glass-panel group cursor-pointer aspect-video flex flex-col justify-between p-5 border-t-2 border-t-green-500/50 bg-gradient-to-br from-gray-900 to-black ${className}`}
                onClick={handleClick}
            >
                <div className="flex justify-between items-start z-10">
                    <div className={`${config.bgClass} ${config.textClass} border ${config.borderClass} backdrop-blur-md px-2 py-1 rounded text-[10px] uppercase font-bold tracking-wider`}>
                        {config.label}
                    </div>
                    {priceLabel && (
                        <div className="bg-black/60 backdrop-blur-md px-2 py-1 rounded text-[10px] font-mono text-white border border-white/10">
                            {priceLabel}
                        </div>
                    )}
                </div>
                <div className="z-10 mt-auto">
                    <h3 className="text-white font-bold text-lg mb-2 leading-tight">{title}</h3>
                    {subtitle && (
                        <div className="flex items-center text-xs text-gray-400 gap-2">
                            <span>{subtitle}</span>
                            {badge && (
                                <>
                                    <span>•</span>
                                    <span className={badgeClass || "text-nexusCyan"}>{badge}</span>
                                </>
                            )}
                        </div>
                    )}
                </div>
                {/* BG Decoration */}
                <div className="absolute top-1/2 right-1/4 text-white/5 group-hover:text-green-500/10 transition-colors pointer-events-none -translate-y-1/2 scale-150">
                    <svg className="w-32 h-32" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1"
                            d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9.5a2.5 2.5 0 00-2.5-2.5H15M9 11l3 3L22 4" />
                    </svg>
                </div>
            </div>
        );
    }

    return (
        <div
            className={`content-card relative rounded-xl overflow-hidden glass-panel group cursor-pointer aspect-video ${className}`}
            onClick={handleClick}
        >
            {/* Thumbnail */}
            {thumbnailUrl && (
                <img
                    src={thumbnailUrl}
                    alt={title}
                    className="absolute inset-0 w-full h-full object-cover"
                    loading="lazy"
                />
            )}

            {/* Gradient overlay */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-black/10 block group-hover:hidden transition-all" />
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm hidden group-hover:block transition-all" />

            {/* Type badge (top-left) */}
            <div className={`absolute top-3 left-3 ${config.bgClass} ${config.textClass} border ${config.borderClass} backdrop-blur-md px-2 py-1 rounded text-[10px] uppercase font-bold tracking-wider flex items-center gap-1.5 z-10`}>
                {type === "live" && (
                    <span className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse" />
                )}
                {config.label}
            </div>

            {/* Price label (top-right) */}
            {priceLabel && (
                <div className="absolute top-3 right-3 bg-black/60 backdrop-blur-md px-2 py-1 rounded text-[10px] font-mono text-white z-10">
                    {priceLabel}
                </div>
            )}

            {/* Play button on hover */}
            <div className="absolute inset-0 flex items-center justify-center play-btn-overlay z-10">
                {type === "audio" ? (
                    // Music bars for audio
                    <div className="flex items-center gap-1">
                        <div className="w-1.5 h-4 bg-nexusPurple rounded-full animate-[bounce_1s_infinite]" style={{ animationDelay: "0s" }} />
                        <div className="w-1.5 h-8 bg-nexusPurple rounded-full animate-[bounce_1s_infinite_0.2s]" />
                        <div className="w-1.5 h-6 bg-nexusPurple rounded-full animate-[bounce_1s_infinite_0.4s]" />
                        <div className="w-1.5 h-3 bg-nexusPurple rounded-full animate-[bounce_1s_infinite_0.6s]" />
                    </div>
                ) : (
                    <div className={`w-14 h-14 ${config.playBg} rounded-full flex items-center justify-center shadow-lg ${type === "live" ? "shadow-[0_0_20px_rgba(220,38,38,0.5)]" : ""}`}>
                        <Play size={24} className={`ml-1 ${type === "live" ? "text-white" : "text-black"}`} fill="currentColor" />
                    </div>
                )}
            </div>

            {/* Bottom info */}
            <div className="absolute bottom-0 left-0 right-0 p-4 z-10">
                <h3 className="text-white font-bold mb-1 truncate">{title}</h3>
                {subtitle && (
                    <div className="flex items-center text-xs text-gray-400 gap-2">
                        <span>{subtitle}</span>
                        {badge && (
                            <>
                                <span>•</span>
                                <span className={badgeClass || "text-nexusCyan font-bold"}>{badge}</span>
                            </>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}

export default ContentCard;
