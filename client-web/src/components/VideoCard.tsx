// FILE: /video-platform/client-web/src/components/VideoCard.tsx
/**
 * Nexus Video - 响应式视频卡片
 * 
 * 功能增强：
 * - 响应式布局（手机/平板/桌面）
 * - 悬停预览效果优化
 * - 价格标签动画
 * - 点赞心形动画增强
 * - 缩略图加载骨架屏
 * - 平滑过渡动画
 */

import React, { useState, useRef, useEffect } from "react";
import type { VideoMeta } from "@video-platform/shared/types";
import { Play, Heart, Clock, Sparkles, Eye } from "lucide-react";

interface VideoCardProps {
    video: VideoMeta;
    onClick?: () => void;
    onDoubleTap?: () => void;
    showPreview?: boolean;
    compact?: boolean;
    index?: number;
}

export function VideoCard({
    video,
    onClick,
    onDoubleTap,
    showPreview = true,
    compact = false,
    index = 0,
}: VideoCardProps) {
    const [isHovered, setIsHovered] = useState(false);
    const [showLikeAnim, setShowLikeAnim] = useState(false);
    const [imageLoaded, setImageLoaded] = useState(false);
    const [isLiked, setIsLiked] = useState(false);
    const lastTap = useRef<number>(0);
    const cardRef = useRef<HTMLDivElement>(null);

    const isFree =
        (video as any).isFree ||
        !video.priceUSDI ||
        parseFloat(video.priceUSDI) === 0;

    const thumbnailUrl =
        (video as any).thumbnailUrl ||
        (video as any).poster ||
        `https://picsum.photos/seed/${video.id}/640/360`;

    // 预加载图片
    useEffect(() => {
        const img = new Image();
        img.onload = () => setImageLoaded(true);
        img.src = thumbnailUrl;
    }, [thumbnailUrl]);

    // 双击检测
    const handleClick = () => {
        const now = Date.now();
        if (now - lastTap.current < 300 && onDoubleTap) {
            // 双击 - 点赞
            setShowLikeAnim(true);
            setIsLiked(true);
            setTimeout(() => setShowLikeAnim(false), 1000);
            onDoubleTap();
        } else if (onClick) {
            onClick();
        }
        lastTap.current = now;
    };

    const formatDuration = (seconds?: number): string => {
        if (!seconds) return "";
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, "0")}`;
    };

    const formatViews = (views?: number): string => {
        if (!views) return "0";
        if (views >= 1000000) return `${(views / 1000000).toFixed(1)}M`;
        if (views >= 1000) return `${(views / 1000).toFixed(1)}K`;
        return views.toString();
    };

    return (
        <>
            <div
                ref={cardRef}
                className={`video-card-enhanced ${compact ? "compact" : ""} ${isHovered ? "hovered" : ""}`}
                onClick={handleClick}
                onMouseEnter={() => setIsHovered(true)}
                onMouseLeave={() => setIsHovered(false)}
                style={{
                    animationDelay: `${index * 60}ms`,
                }}
            >
                {/* 缩略图容器 */}
                <div className={`thumb-container ${!imageLoaded ? 'loading' : ''}`}>
                    {/* Skeleton */}
                    {!imageLoaded && <div className="thumb-skeleton skeleton" />}

                    {/* 缩略图 */}
                    <div
                        className="thumb-image"
                        style={{
                            backgroundImage: imageLoaded ? `url(${thumbnailUrl})` : 'none',
                            opacity: imageLoaded ? 1 : 0,
                        }}
                    />

                    {/* 悬停播放按钮 */}
                    <div className={`play-overlay ${isHovered ? 'visible' : ''}`}>
                        <div className="play-btn">
                            <Play size={24} fill="white" />
                        </div>
                    </div>

                    {/* 角标容器 */}
                    <div className="thumb-badges">
                        {/* Premiere Badge */}
                        {video.premiereTime && video.premiereTime > Date.now() && (
                            <span className="badge premiere" style={{ background: "linear-gradient(90deg, #ff00cc, #333399)", color: "#fff", border: "1px solid #ff00cc" }}>
                                <Clock size={12} />
                                PREMIERE
                            </span>
                        )}

                        {/* 价格标签 */}
                        <span className={`badge ${isFree ? "free" : "paid"}`}>
                            {isFree ? (
                                <>
                                    <Sparkles size={12} />
                                    免费
                                </>
                            ) : (
                                <>
                                    💎 ${video.priceUSDI}
                                </>
                            )}
                        </span>

                        {/* 时长 */}
                        {video.durationSeconds && (
                            <span className="badge duration">
                                <Clock size={10} />
                                {formatDuration(video.durationSeconds)}
                            </span>
                        )}
                    </div>

                    {/* 试看提示 */}
                    {isHovered && showPreview && !isFree && (
                        <div className="preview-hint">
                            试看前 10 秒
                        </div>
                    )}

                    {/* 底部渐变 */}
                    <div className="thumb-gradient" />
                </div>

                {/* 卡片内容 */}
                <div className="card-body">
                    <h3 className="card-title">{video.title || "未命名视频"}</h3>
                    <div className="card-meta">
                        <span className="creator">
                            {video.creatorCkbAddress
                                ? `${video.creatorCkbAddress.slice(0, 6)}...${video.creatorCkbAddress.slice(-4)}`
                                : "未知创作者"}
                        </span>
                        {(video as any).viewCount && (
                            <span className="views">
                                <Eye size={12} />
                                {formatViews((video as any).viewCount)}
                            </span>
                        )}
                    </div>

                    {/* 标签 */}
                    {video.tags && video.tags.length > 0 && !compact && (
                        <div className="card-tags">
                            {video.tags.slice(0, 3).map((tag) => (
                                <span key={tag} className="tag">#{tag}</span>
                            ))}
                        </div>
                    )}
                </div>

                {/* 点赞动画 */}
                {showLikeAnim && (
                    <div className="like-animation">
                        <Heart size={64} fill="#ff4d6d" color="#ff4d6d" className="heart-icon" />
                        {/* 粒子效果 */}
                        <div className="heart-particles">
                            {[...Array(8)].map((_, i) => (
                                <span key={i} className="particle" style={{ '--i': i } as React.CSSProperties} />
                            ))}
                        </div>
                    </div>
                )}
            </div>

            <style>{`
                .video-card-enhanced {
                    position: relative;
                    background: rgba(255, 255, 255, 0.03);
                    border: 1px solid var(--border-subtle);
                    border-radius: var(--radius-md);
                    overflow: hidden;
                    cursor: pointer;
                    transition: all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1);
                    animation: fadeInUp 0.5s ease-out forwards;
                    opacity: 0;
                }

                .video-card-enhanced:hover {
                    transform: translateY(-6px);
                    border-color: rgba(162, 103, 255, 0.3);
                    box-shadow: 0 20px 40px rgba(0, 0, 0, 0.3),
                                0 0 30px rgba(162, 103, 255, 0.1);
                }

                .video-card-enhanced:active {
                    transform: translateY(-3px);
                }

                .video-card-enhanced.compact {
                    display: flex;
                    gap: 12px;
                    padding: 12px;
                    background: transparent;
                }

                .video-card-enhanced.compact .thumb-container {
                    width: 140px;
                    height: 80px;
                    flex-shrink: 0;
                }

                /* 缩略图容器 */
                .thumb-container {
                    position: relative;
                    width: 100%;
                    padding-top: 56.25%; /* 16:9 */
                    overflow: hidden;
                }

                .thumb-skeleton {
                    position: absolute;
                    inset: 0;
                }

                .thumb-image {
                    position: absolute;
                    inset: 0;
                    background-size: cover;
                    background-position: center;
                    transition: transform 0.5s ease, opacity 0.3s;
                }

                .video-card-enhanced:hover .thumb-image {
                    transform: scale(1.08);
                }

                /* 播放按钮覆盖层 */
                .play-overlay {
                    position: absolute;
                    inset: 0;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    background: rgba(0, 0, 0, 0.3);
                    opacity: 0;
                    transition: opacity 0.3s;
                }

                .play-overlay.visible {
                    opacity: 1;
                }

                .play-btn {
                    width: 56px;
                    height: 56px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    background: linear-gradient(135deg, var(--accent-purple), var(--accent-cyan));
                    border-radius: 50%;
                    box-shadow: 0 0 30px rgba(162, 103, 255, 0.6);
                    transform: scale(0.8);
                    transition: transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
                }

                .play-overlay.visible .play-btn {
                    transform: scale(1);
                }

                .play-btn svg {
                    margin-left: 3px;
                }

                /* 角标 */
                .thumb-badges {
                    position: absolute;
                    top: 10px;
                    left: 10px;
                    right: 10px;
                    display: flex;
                    justify-content: space-between;
                    align-items: flex-start;
                    z-index: 2;
                }

                .badge {
                    display: inline-flex;
                    align-items: center;
                    gap: 4px;
                    padding: 4px 10px;
                    border-radius: var(--radius-full);
                    font-size: 11px;
                    font-weight: 600;
                    backdrop-filter: blur(8px);
                    transition: transform 0.2s;
                }

                .badge.free {
                    background: rgba(0, 245, 212, 0.9);
                    color: #000;
                }

                .badge.paid {
                    background: rgba(162, 103, 255, 0.9);
                    color: white;
                }

                .badge.duration {
                    background: rgba(0, 0, 0, 0.7);
                    color: white;
                }

                /* 试看提示 */
                .preview-hint {
                    position: absolute;
                    bottom: 40px;
                    left: 50%;
                    transform: translateX(-50%);
                    padding: 6px 14px;
                    background: rgba(162, 103, 255, 0.9);
                    border-radius: var(--radius-full);
                    font-size: 12px;
                    font-weight: 500;
                    color: white;
                    white-space: nowrap;
                    animation: pulse-glow 2s infinite;
                    z-index: 3;
                }

                /* 底部渐变 */
                .thumb-gradient {
                    position: absolute;
                    bottom: 0;
                    left: 0;
                    right: 0;
                    height: 60px;
                    background: linear-gradient(to top, rgba(10, 10, 16, 0.9), transparent);
                    pointer-events: none;
                }

                /* 卡片内容 */
                .card-body {
                    padding: 16px;
                }

                .compact .card-body {
                    padding: 0;
                    display: flex;
                    flex-direction: column;
                    justify-content: center;
                }

                .card-title {
                    font-size: 15px;
                    font-weight: 600;
                    line-height: 1.4;
                    margin: 0 0 8px;
                    display: -webkit-box;
                    -webkit-line-clamp: 2;
                    -webkit-box-orient: vertical;
                    overflow: hidden;
                    color: var(--text-primary);
                }

                .compact .card-title {
                    font-size: 14px;
                    margin-bottom: 4px;
                    -webkit-line-clamp: 1;
                }

                .card-meta {
                    display: flex;
                    align-items: center;
                    gap: 12px;
                    font-size: 12px;
                    color: var(--text-muted);
                }

                .views {
                    display: flex;
                    align-items: center;
                    gap: 4px;
                }

                .card-tags {
                    display: flex;
                    flex-wrap: wrap;
                    gap: 6px;
                    margin-top: 10px;
                }

                .tag {
                    padding: 3px 8px;
                    background: rgba(162, 103, 255, 0.1);
                    border-radius: 4px;
                    font-size: 11px;
                    color: var(--accent-purple);
                }

                /* 点赞动画 */
                .like-animation {
                    position: absolute;
                    inset: 0;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    pointer-events: none;
                    z-index: 20;
                }

                .heart-icon {
                    animation: heart-pop 0.6s cubic-bezier(0.175, 0.885, 0.32, 1.275);
                    filter: drop-shadow(0 0 20px rgba(255, 77, 109, 0.6));
                }

                @keyframes heart-pop {
                    0% {
                        transform: scale(0);
                        opacity: 0;
                    }
                    50% {
                        transform: scale(1.3);
                        opacity: 1;
                    }
                    100% {
                        transform: scale(1);
                        opacity: 0;
                    }
                }

                .heart-particles {
                    position: absolute;
                    top: 50%;
                    left: 50%;
                }

                .heart-particles .particle {
                    position: absolute;
                    width: 8px;
                    height: 8px;
                    background: #ff4d6d;
                    border-radius: 50%;
                    animation: particle-burst 0.8s ease-out forwards;
                    animation-delay: calc(var(--i) * 30ms);
                }

                @keyframes particle-burst {
                    0% {
                        transform: translate(-50%, -50%) rotate(calc(var(--i) * 45deg)) translateX(0);
                        opacity: 1;
                    }
                    100% {
                        transform: translate(-50%, -50%) rotate(calc(var(--i) * 45deg)) translateX(60px);
                        opacity: 0;
                    }
                }

                /* 移动端适配 */
                @media (max-width: 480px) {
                    .video-card-enhanced:hover {
                        transform: none;
                    }

                    .card-body {
                        padding: 12px;
                    }

                    .card-title {
                        font-size: 14px;
                    }
                }
            `}</style>
        </>
    );
}

export default VideoCard;
