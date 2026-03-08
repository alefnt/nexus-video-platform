// FILE: /video-platform/client-web/src/components/TipDanmaku.tsx
/**
 * 打赏弹幕动画组件
 * 功能：显示打赏弹幕动画，金色特效，从右向左飘过
 */

import React, { useEffect, useState, useRef } from "react";
import type { TipRecord } from "@video-platform/shared/types";

interface TipDanmakuProps {
    videoId: string;
    className?: string;
}

interface DanmakuItem extends TipRecord {
    top: number;
    animationDuration: number;
}

export default function TipDanmaku({ videoId, className = "" }: TipDanmakuProps) {
    const [danmakus, setDanmakus] = useState<DanmakuItem[]>([]);
    const containerRef = useRef<HTMLDivElement>(null);
    const usedTracks = useRef<Set<number>>(new Set());

    // 添加新弹幕
    const addDanmaku = (tip: TipRecord) => {
        if (!containerRef.current) return;

        const containerHeight = containerRef.current.clientHeight;
        const trackHeight = 40;
        const maxTracks = Math.floor(containerHeight / trackHeight);

        // 找一个空闲轨道
        let track = 0;
        for (let i = 0; i < maxTracks; i++) {
            if (!usedTracks.current.has(i)) {
                track = i;
                break;
            }
            track = Math.floor(Math.random() * maxTracks);
        }

        usedTracks.current.add(track);

        const danmaku: DanmakuItem = {
            ...tip,
            top: track * trackHeight + 10,
            animationDuration: 6 + Math.random() * 2, // 6-8秒
        };

        setDanmakus((prev) => [...prev, danmaku]);

        // 动画结束后移除
        setTimeout(() => {
            usedTracks.current.delete(track);
            setDanmakus((prev) => prev.filter((d) => d.id !== danmaku.id));
        }, danmaku.animationDuration * 1000);
    };

    // 暴露给外部调用的方法
    useEffect(() => {
        // 将 addDanmaku 方法挂载到 window 上，供外部调用
        (window as any).__tipDanmakuAdd = addDanmaku;
        return () => {
            delete (window as any).__tipDanmakuAdd;
        };
    }, []);

    return (
        <div
            ref={containerRef}
            className={`tip-danmaku-container ${className}`}
            style={{
                position: "absolute",
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                overflow: "hidden",
                pointerEvents: "none",
                zIndex: 100,
            }}
        >
            <style>{`
        @keyframes tipDanmakuSlide {
          from { transform: translateX(100%); }
          to { transform: translateX(-100%); }
        }
        
        @keyframes tipGlow {
          0%, 100% { text-shadow: 0 0 10px rgba(255, 215, 0, 0.5); }
          50% { text-shadow: 0 0 20px rgba(255, 215, 0, 0.8), 0 0 30px rgba(255, 165, 0, 0.6); }
        }
      `}</style>

            {danmakus.map((danmaku) => (
                <div
                    key={danmaku.id}
                    style={{
                        position: "absolute",
                        top: danmaku.top,
                        right: 0,
                        whiteSpace: "nowrap",
                        animation: `tipDanmakuSlide ${danmaku.animationDuration}s linear forwards, tipGlow 1s ease-in-out infinite`,
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        padding: "6px 16px",
                        borderRadius: 20,
                        background: "linear-gradient(90deg, rgba(255, 215, 0, 0.2), rgba(255, 165, 0, 0.3))",
                        border: "1px solid rgba(255, 215, 0, 0.5)",
                        backdropFilter: "blur(4px)",
                    }}
                >
                    {/* 打赏图标 */}
                    <span style={{ fontSize: 16 }}>🎁</span>

                    {/* 用户信息 */}
                    <span
                        style={{
                            color: "#FFD700",
                            fontSize: 14,
                            fontWeight: 600,
                        }}
                    >
                        {danmaku.fromAddress
                            ? `${danmaku.fromAddress.slice(0, 4)}...${danmaku.fromAddress.slice(-4)}`
                            : "匿名"}
                    </span>

                    {/* 打赏内容 */}
                    <span style={{ color: "#fff", fontSize: 14 }}>
                        打赏了 <strong style={{ color: "#FFD700" }}>{danmaku.amount}</strong> 积分
                    </span>

                    {/* 留言 */}
                    {danmaku.message && (
                        <span
                            style={{
                                color: "rgba(255, 255, 255, 0.9)",
                                fontSize: 13,
                                maxWidth: 200,
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                            }}
                        >
                            "{danmaku.message}"
                        </span>
                    )}
                </div>
            ))}
        </div>
    );
}

// 辅助函数：触发打赏弹幕
export function triggerTipDanmaku(tip: TipRecord) {
    const addFn = (window as any).__tipDanmakuAdd;
    if (typeof addFn === "function") {
        addFn(tip);
    }
}
