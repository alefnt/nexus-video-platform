// FILE: /video-platform/client-web/src/components/DanmakuLayer.tsx
/**
 * Nexus Video - 弹幕系统
 * 
 * 功能说明：
 * - P2P 实时弹幕广播（基于 GunDB）
 * - 本地缓存（IndexedDB）
 * - 霓虹风格渲染
 * - 防刷限制
 * 
 * 依赖：gun
 */

import React, { useEffect, useState, useRef, useCallback } from "react";
import { ScreenEffects, EffectType } from "./ScreenEffects";
import { useSound } from "../hooks/useSound";

// GunDB 类型声明
declare const Gun: any;

// 弹幕数据结构
export interface Danmaku {
    id: string;
    text: string;
    color: string;
    position: "top" | "middle" | "bottom";
    timestamp: number; // 视频时间点（秒）
    createdAt: number; // 创建时间戳
    sender?: string;   // 发送者地址（可选）
    senderName?: string; // 发送者显示名（可选）
}

// 弹幕颜色池（霓虹风格）
const NEON_COLORS = [
    "#A267FF", // 电光紫
    "#00F5D4", // 能量青
    "#FF6B9D", // 霓虹粉
    "#FFD93D", // 金黄
    "#00D9FF", // 天蓝
    "#FF9F43", // 橙色
];

// 弹幕位置层级
const POSITION_STYLES: Record<string, React.CSSProperties> = {
    top: { top: "10%", animationDuration: "10s" },
    middle: { top: "40%", animationDuration: "8s" },
    bottom: { top: "70%", animationDuration: "10s" },
};

// 特效关键词映射
const EFFECT_KEYWORDS: { pattern: RegExp; effect: EffectType; duration?: number }[] = [
    { pattern: /下雪|snow|❄️|雪花/i, effect: 'snow', duration: 8000 },
    { pattern: /烟花|firework|🎆|🎇|放烟花/i, effect: 'firework', duration: 5000 },
    { pattern: /爱你|love|❤️|💕|💖|❣️|比心|爱心/i, effect: 'hearts', duration: 5000 },
    { pattern: /666|牛|厉害|nb|大佬|🐂|tql|太强了/i, effect: 'gold', duration: 4000 },
    { pattern: /发财|恭喜|🎉|💰|红包|新年快乐/i, effect: 'confetti', duration: 5000 },
    { pattern: /✨|⭐|星星|流星|许愿/i, effect: 'stars', duration: 6000 },
];

interface DanmakuLayerProps {
    videoId: string;
    currentTime: number;
    enabled: boolean;
    gunPeers?: string[];
    onSend?: (text: string) => void;
    externalDanmakus?: Danmaku[]; // Support loading from backend/history
}

export function DanmakuLayer({
    videoId,
    currentTime,
    enabled,
    gunPeers = [],
    externalDanmakus = [],
}: DanmakuLayerProps) {
    const [danmakus, setDanmakus] = useState<Danmaku[]>([]);

    const lastTimeRef = useRef(currentTime);
    const processedIds = useRef(new Set<string>());

    // Sync external timeline: Reset processed IDs when video changes
    useEffect(() => {
        processedIds.current.clear();
        setDanmakus([]);
    }, [videoId]);

    // Timeline playback scheduler
    useEffect(() => {
        if (!enabled || externalDanmakus.length === 0) return;

        // Detect seek (large jump)
        if (Math.abs(currentTime - lastTimeRef.current) > 2) {
            setDanmakus([]); // Clear screen on seek
            processedIds.current.clear(); // Reset processed to allow re-showing if seek back
        }

        // Find items to emit
        const emitWindow = 1.0; // Look ahead 1s
        const toEmit = externalDanmakus.filter(d =>
            d.timestamp >= currentTime &&
            d.timestamp < currentTime + emitWindow &&
            !processedIds.current.has(d.id)
        );

        if (toEmit.length > 0) {
            toEmit.forEach(d => {
                processedIds.current.add(d.id);
                // Check effects
                checkAndTriggerEffect(d.text);
            });

            setDanmakus(prev => [
                ...prev.slice(-49),
                ...toEmit.map(d => ({
                    ...d,
                    createdAt: Date.now() // Update createdAt for animation timing
                }))
            ]);
        }

        lastTimeRef.current = currentTime;
    }, [currentTime, externalDanmakus, enabled]);
    const [inputText, setInputText] = useState("");
    const [showInput, setShowInput] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);
    const gunRef = useRef<any>(null);
    const lastSendTime = useRef<number>(0);
    const lastEffectTime = useRef<number>(0);

    // 屏幕特效状态
    const [currentEffect, setCurrentEffect] = useState<EffectType | null>(null);
    const [effectDuration, setEffectDuration] = useState(5000);
    const { play: playSound } = useSound();

    // 初始化 GunDB
    useEffect(() => {
        if (!enabled || typeof window === "undefined") return;

        // 动态加载 GunDB
        const initGun = async () => {
            try {
                // @ts-ignore
                if (!window.Gun) {
                    // 如果没有全局 Gun，尝试动态导入
                    const GunModule = await import("gun");
                    gunRef.current = (GunModule.default || GunModule)({
                        peers: gunPeers.length > 0 ? gunPeers : undefined,
                        localStorage: false,
                    });
                } else {
                    // @ts-ignore
                    gunRef.current = window.Gun({
                        peers: gunPeers.length > 0 ? gunPeers : undefined,
                        localStorage: false,
                    });
                }
            } catch (e) {
                console.warn("GunDB initialization failed, using local-only mode:", e);
                // 回退到本地模式
                gunRef.current = null;
            }
        };

        initGun();

        return () => {
            if (gunRef.current?.off) {
                gunRef.current.off();
            }
        };
    }, [enabled, gunPeers]);

    // 订阅弹幕
    useEffect(() => {
        if (!enabled || !gunRef.current) return;

        const node = gunRef.current.get(`danmaku/${videoId}`);

        const handler = (data: any, key: string) => {
            if (!data || typeof data !== "object") return;

            // 只显示当前时间 ±5 秒的弹幕
            const timeDiff = Math.abs((data.timestamp || 0) - currentTime);
            if (timeDiff > 5) return;

            setDanmakus((prev) => {
                // 避免重复
                if (prev.some((d) => d.id === key)) return prev;

                // 最多保留 50 条
                const newDanmakus = [
                    ...prev.slice(-49),
                    {
                        id: key,
                        text: String(data.text || ""),
                        color: data.color || NEON_COLORS[0],
                        position: data.position || "middle",
                        timestamp: data.timestamp || 0,
                        createdAt: data.createdAt || Date.now(),
                        sender: data.sender,
                    },
                ];
                return newDanmakus;
            });

            // 检测特效关键词
            const text = String(data.text || "");
            checkAndTriggerEffect(text);
        };

        node.map().on(handler);

        return () => {
            node.off();
        };
    }, [videoId, currentTime, enabled]);

    // 清理过期弹幕
    useEffect(() => {
        const interval = setInterval(() => {
            setDanmakus((prev) =>
                prev.filter((d) => Date.now() - d.createdAt < 15000)
            );
        }, 3000);

        return () => clearInterval(interval);
    }, []);

    // 发送弹幕
    const sendDanmaku = useCallback((text: string, position: Danmaku["position"] = "middle") => {
        if (!text.trim() || !enabled) return;

        // 防刷：每秒最多 1 条
        const now = Date.now();
        if (now - lastSendTime.current < 1000) {
            console.warn("发送太频繁，请稍后再试");
            return;
        }
        lastSendTime.current = now;

        const color = NEON_COLORS[Math.floor(Math.random() * NEON_COLORS.length)];
        const danmaku: Danmaku = {
            id: `${now}_${Math.random().toString(36).slice(2, 8)}`,
            text: text.slice(0, 50), // 限制长度
            color,
            position,
            timestamp: currentTime,
            createdAt: now,
        };

        // 本地立即显示
        setDanmakus((prev) => [...prev.slice(-49), danmaku]);

        // 广播到 GunDB
        if (gunRef.current) {
            gunRef.current.get(`danmaku/${videoId}`).set(danmaku);
        }

        setInputText("");
        setShowInput(false);
    }, [videoId, currentTime, enabled]);

    // 检测并触发特效
    const checkAndTriggerEffect = useCallback((text: string) => {
        // 防止特效过于频繁（每5秒最多一次）
        const now = Date.now();
        if (now - lastEffectTime.current < 5000) return;

        for (const { pattern, effect, duration } of EFFECT_KEYWORDS) {
            if (pattern.test(text)) {
                lastEffectTime.current = now;
                setCurrentEffect(effect);
                setEffectDuration(duration || 5000);
                playSound('success');

                // 自动清除特效
                setTimeout(() => {
                    setCurrentEffect(null);
                }, duration || 5000);

                break; // 只触发第一个匹配的特效
            }
        }
    }, [playSound]);

    // 键盘快捷键
    useEffect(() => {
        if (!enabled) return;

        const handleKeyDown = (e: KeyboardEvent) => {
            // T 键打开输入框
            if (e.key.toLowerCase() === "t" && !showInput) {
                e.preventDefault();
                setShowInput(true);
            }
            // Escape 关闭输入框
            if (e.key === "Escape" && showInput) {
                setShowInput(false);
                setInputText("");
            }
        };

        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [enabled, showInput]);

    if (!enabled) return null;

    return (
        <>
            {/* 全屏特效 */}
            <ScreenEffects
                effect={currentEffect}
                duration={effectDuration}
                intensity="medium"
                onComplete={() => setCurrentEffect(null)}
            />

            {/* 弹幕容器 */}
            <div ref={containerRef} className="danmaku-container">
                {danmakus.map((d) => (
                    <span
                        key={d.id}
                        className="danmaku-item"
                        style={{
                            color: d.color,
                            textShadow: `2px 2px 0px rgba(0,0,0,0.8), 0 0 10px ${d.color}, 0 0 20px ${d.color}`,
                            fontFamily: "var(--font-display)",
                            fontWeight: 700,
                            ...POSITION_STYLES[d.position],
                        }}
                    >
                        {d.text}
                    </span>
                ))}
            </div>

            {/* 弹幕输入框 */}
            {showInput && (
                <div
                    style={{
                        position: "absolute",
                        bottom: 80,
                        left: "50%",
                        transform: "translateX(-50%)",
                        zIndex: 100,
                        display: "flex",
                        gap: 8,
                    }}
                >
                    <input
                        type="text"
                        className="input"
                        value={inputText}
                        onChange={(e) => setInputText(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === "Enter") {
                                sendDanmaku(inputText);
                            }
                        }}
                        placeholder="输入弹幕，按 Enter 发送"
                        autoFocus
                        style={{
                            width: 300,
                            background: "rgba(0, 0, 0, 0.7)",
                            backdropFilter: "blur(10px)",
                        }}
                        maxLength={50}
                    />
                    <button
                        className="btn-neon"
                        onClick={() => sendDanmaku(inputText)}
                        style={{ padding: "8px 16px" }}
                    >
                        发送
                    </button>
                </div>
            )}

            {/* 弹幕提示 */}
            {!showInput && (
                <div
                    style={{
                        position: "absolute",
                        bottom: 80,
                        right: 20,
                        zIndex: 50,
                        fontSize: 12,
                        color: "var(--text-muted)",
                        opacity: 0.6,
                    }}
                >
                    按 T 发送弹幕
                </div>
            )}
        </>
    );
}

export default DanmakuLayer;
