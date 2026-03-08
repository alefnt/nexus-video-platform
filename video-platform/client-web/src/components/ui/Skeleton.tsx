/**
 * 统一骨架屏组件
 * 提供 VideoCardSkeleton, ProfileSkeleton 等
 */

import React from "react";

interface SkeletonProps {
    className?: string;
    width?: string | number;
    height?: string | number;
    borderRadius?: string | number;
}

export const Skeleton: React.FC<SkeletonProps> = ({
    className = "",
    width = "100%",
    height = 16,
    borderRadius = 4,
}) => (
    <div
        className={`skeleton-pulse ${className}`}
        style={{
            width: typeof width === "number" ? `${width}px` : width,
            height: typeof height === "number" ? `${height}px` : height,
            borderRadius: typeof borderRadius === "number" ? `${borderRadius}px` : borderRadius,
            background: "linear-gradient(90deg, var(--skeleton-from, #1a1a2e) 25%, var(--skeleton-to, #252545) 50%, var(--skeleton-from, #1a1a2e) 75%)",
            backgroundSize: "200% 100%",
            animation: "skeleton-shimmer 1.5s ease-in-out infinite",
        }}
    />
);

/** 视频卡片骨架屏 */
export const VideoCardSkeleton: React.FC<{ count?: number }> = ({ count = 1 }) => (
    <>
        {Array.from({ length: count }).map((_, i) => (
            <div key={i} style={{ marginBottom: 16 }}>
                {/* 封面 */}
                <Skeleton height={180} borderRadius={12} />
                {/* 标题 */}
                <div style={{ display: "flex", gap: 10, marginTop: 10, alignItems: "flex-start" }}>
                    <Skeleton width={36} height={36} borderRadius="50%" />
                    <div style={{ flex: 1 }}>
                        <Skeleton height={16} width="85%" />
                        <Skeleton height={12} width="60%" className="mt-6" />
                    </div>
                </div>
            </div>
        ))}
    </>
);

/** 个人资料骨架屏 */
export const ProfileSkeleton: React.FC = () => (
    <div style={{ display: "flex", alignItems: "center", gap: 16, padding: 16 }}>
        <Skeleton width={64} height={64} borderRadius="50%" />
        <div style={{ flex: 1 }}>
            <Skeleton height={20} width="40%" />
            <Skeleton height={14} width="70%" className="mt-8" />
        </div>
    </div>
);

/** 列表项骨架屏 */
export const ListItemSkeleton: React.FC<{ count?: number }> = ({ count = 5 }) => (
    <>
        {Array.from({ length: count }).map((_, i) => (
            <div key={i} style={{ display: "flex", gap: 12, padding: "12px 0", alignItems: "center" }}>
                <Skeleton width={48} height={48} borderRadius={8} />
                <div style={{ flex: 1 }}>
                    <Skeleton height={14} width="60%" />
                    <Skeleton height={12} width="40%" className="mt-6" />
                </div>
            </div>
        ))}
    </>
);

/** Feed 骨架屏 (全屏视频流) */
export const FeedSkeleton: React.FC = () => (
    <div style={{ width: "100%", maxWidth: 480, margin: "0 auto" }}>
        <Skeleton height="70vh" borderRadius={0} />
        <div style={{ padding: "12px 16px", display: "flex", gap: 12, alignItems: "center" }}>
            <Skeleton width={40} height={40} borderRadius="50%" />
            <div style={{ flex: 1 }}>
                <Skeleton height={16} width="50%" />
                <Skeleton height={12} width="80%" className="mt-6" />
            </div>
        </div>
    </div>
);

// 全局样式注入 (仅注入一次)
if (typeof document !== "undefined") {
    const styleId = "skeleton-styles";
    if (!document.getElementById(styleId)) {
        const style = document.createElement("style");
        style.id = styleId;
        style.textContent = `
            @keyframes skeleton-shimmer {
                0% { background-position: -200% 0; }
                100% { background-position: 200% 0; }
            }
            .skeleton-pulse.mt-6 { margin-top: 6px; }
            .skeleton-pulse.mt-8 { margin-top: 8px; }
        `;
        document.head.appendChild(style);
    }
}
