import React from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { LazyImage } from './LazyImage';

export interface VideoCardProps {
    id: string;
    title: string;
    thumbnailUrl: string;
    creatorName: string;
    creatorAvatar?: string;
    views?: number;
    duration?: string;
    isLive?: boolean;
}

export const VideoCard: React.FC<VideoCardProps> = ({
    id,
    title,
    thumbnailUrl,
    creatorName,
    creatorAvatar,
    views,
    duration,
    isLive
}) => {
    const navigate = useNavigate();

    return (
        <motion.div
            whileHover={{ scale: 1.05, y: -5 }}
            whileTap={{ scale: 0.98 }}
            className="group relative w-full aspect-video rounded-xl overflow-hidden cursor-pointer"
            onClick={() => navigate(`/player/${id}`)}
        >
            {/* Thumbnail：懒加载 + 占位（P1 优化） */}
            <LazyImage
                src={thumbnailUrl}
                alt={title}
                className="absolute inset-0 w-full h-full transition-transform duration-500 group-hover:scale-110"
            />

            {/* Overlay Gradient */}
            <div className="absolute inset-0 bg-gradient-to-t from-nexus-space/90 via-transparent to-transparent opacity-60 group-hover:opacity-90 transition-opacity" />

            {/* Badges */}
            <div className="absolute top-2 left-2">
                {isLive && (
                    <span className="px-2 py-0.5 bg-nexus-pink text-white text-[10px] font-bold uppercase rounded animate-pulse">
                        Live
                    </span>
                )}
            </div>

            <div className="absolute top-2 right-2">
                {duration && (
                    <span className="px-2 py-0.5 bg-black/60 backdrop-blur text-white text-[10px] font-mono rounded">
                        {duration}
                    </span>
                )}
            </div>

            {/* Content info */}
            <div className="absolute bottom-0 left-0 right-0 p-3 transform translate-y-2 group-hover:translate-y-0 transition-transform">
                <h3 className="text-white font-bold text-sm line-clamp-2 mb-1 group-hover:text-nexus-cyan transition-colors">
                    {title}
                </h3>

                <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity delay-75">
                    <div className="w-5 h-5 rounded-full bg-nexus-elevated border border-white/10 overflow-hidden">
                        {creatorAvatar ? (
                            <LazyImage src={creatorAvatar} alt={creatorName} className="w-full h-full object-cover" />
                        ) : (
                            <div className="w-full h-full flex items-center justify-center text-[8px] text-white">
                                {creatorName[0]}
                            </div>
                        )}
                    </div>
                    <span className="text-xs text-text-muted truncate">
                        {creatorName}
                    </span>
                    {views !== undefined && (
                        <span className="text-[10px] text-text-muted ml-auto">
                            {Intl.NumberFormat('en', { notation: "compact" }).format(views)} views
                        </span>
                    )}
                </div>
            </div>

            {/* Hover Border Glow */}
            <div className="absolute inset-0 border-2 border-transparent group-hover:border-nexus-cyan/50 rounded-xl transition-colors pointer-events-none" />
        </motion.div>
    );
};
