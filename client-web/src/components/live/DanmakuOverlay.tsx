
import React, { useEffect, useState, useRef, useCallback } from 'react';

interface DanmakuItem {
    id: string;
    content: string;
    color: string;
    top: number;
    duration: number;
    isTip?: boolean;
    avatar?: string;
}

import { ChatMessage } from './LiveChat';

interface DanmakuOverlayProps {
    messages: ChatMessage[];
    className?: string;
}

const DANMAKU_COLORS = [
    '#ffffff', // White
    '#00d5ff', // Cyan
    '#ff00ff', // Magenta
    '#00ff9d', // Green
    '#ffe600', // Yellow
];

export default function DanmakuOverlay({ messages, className = '' }: DanmakuOverlayProps) {
    const [danmakus, setDanmakus] = useState<DanmakuItem[]>([]);
    const containerRef = useRef<HTMLDivElement>(null);
    const usedTracks = useRef<Set<number>>(new Set());
    const lastMessageIdRef = useRef<string | null>(null);

    // Process new messages
    useEffect(() => {
        const latestMsg = messages[messages.length - 1];
        if (!latestMsg || latestMsg.id === lastMessageIdRef.current) return;

        lastMessageIdRef.current = latestMsg.id;

        // Add danmaku
        addDanmaku(latestMsg);
    }, [messages]);

    const addDanmaku = useCallback((msg: any) => {
        if (!containerRef.current) return;

        const containerHeight = containerRef.current.clientHeight;
        const trackHeight = 40; // Height of each track
        const maxTracks = Math.floor(containerHeight / trackHeight);

        // Find available track
        let track = -1;
        const attempts = 5; // Try 5 times to find a random empty track, then just pick one

        for (let i = 0; i < attempts; i++) {
            const t = Math.floor(Math.random() * maxTracks);
            if (!usedTracks.current.has(t)) {
                track = t;
                break;
            }
        }
        if (track === -1) track = Math.floor(Math.random() * maxTracks);

        usedTracks.current.add(track);

        const isTip = msg.type === 'tip' || msg.type === 'gift';

        const newItem: DanmakuItem = {
            id: msg.id + Math.random().toString(), // Ensure unique for animation key
            content: msg.content,
            color: isTip ? '#FFD700' : DANMAKU_COLORS[Math.floor(Math.random() * DANMAKU_COLORS.length)],
            top: track * trackHeight + 10,
            duration: 8 + Math.random() * 4, // 8-12s duration
            isTip
        };

        setDanmakus(prev => [...prev, newItem]);

        // Cleanup after animation
        setTimeout(() => {
            setDanmakus(prev => prev.filter(d => d.id !== newItem.id));
            usedTracks.current.delete(track);
        }, newItem.duration * 1000);
    }, []);

    return (
        <div ref={containerRef} className={`absolute inset-0 pointer-events-none overflow-hidden z-20 ${className}`}>
            <style>{`
                @keyframes danmaku-slide {
                    from { transform: translateX(100%); }
                    to { transform: translateX(-150%); } /* Move further left to ensure full exit */
                }
            `}</style>
            {danmakus.map(item => (
                <div
                    key={item.id}
                    className={`absolute whitespace-nowrap px-4 py-1.5 rounded-full text-base font-bold shadow-[2px_2px_4px_rgba(0,0,0,0.8)] flex items-center gap-2 ${item.isTip ? 'bg-accent-yellow/20 border border-accent-yellow text-accent-yellow' : ''}`}
                    style={{
                        top: item.top,
                        left: 0, // We animate transform, but start needs to be right edge. 
                        // Actually easier to set left: 100% and animate to -100%?
                        // Using animation defined below
                        width: '100%', // Container for the item to slide within? No. 
                        // Let's use left: 100% and allow animation to move it
                        transform: 'translateX(100%)', // Start off-screen right
                        animation: `danmaku-slide ${item.duration}s linear forwards`,
                        color: item.color,
                        textShadow: '0 0 5px rgba(0,0,0,0.5), 0 0 10px currentColor'
                    }}
                >
                    {item.isTip && <span>💰</span>}
                    {item.content}
                </div>
            ))}
        </div>
    );
}
