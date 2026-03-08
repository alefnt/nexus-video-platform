// FILE: /video-platform/client-web/src/components/live/LiveChat.tsx
/**
 * Live Chat Component (Nexus Prime UI)
 * 
 * Displays chat history list.
 * Pure UI component - data is passed via props.
 */

import React, { useState, useEffect, useRef } from 'react';

export interface ChatMessage {
    id: string;
    type: 'chat' | 'tip' | 'system' | 'join';
    fromName: string;
    content: string;
    timestamp: number;
    tipAmount?: number;
    giftIcon?: string;
    giftName?: string;
    animation?: string;
}

interface LiveChatProps {
    messages: ChatMessage[];
    onSendMessage?: (message: string) => void;
    className?: string;
    showDanmaku?: boolean;
    onToggleDanmaku?: (show: boolean) => void;
}

export default function LiveChat({
    messages,
    onSendMessage,
    className = '',
    showDanmaku = true,
    onToggleDanmaku
}: LiveChatProps) {
    const [inputValue, setInputValue] = useState('');
    const messagesEndRef = useRef<HTMLDivElement>(null);

    // Auto-scroll to bottom
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    const handleSend = () => {
        if (!inputValue.trim()) return;
        onSendMessage?.(inputValue.trim());
        setInputValue('');
    };

    return (
        <div className={`glass-panel flex flex-col h-full relative overflow-hidden flex-1 ${className}`}>
            {/* Header */}
            <div className="p-3 border-b border-white/10 flex justify-between items-center bg-black/20">
                <h4 className="text-sm font-bold text-accent-cyan flex items-center gap-2">
                    <span>💬</span> COMMS
                </h4>
                {onToggleDanmaku && (
                    <button
                        onClick={() => onToggleDanmaku(!showDanmaku)}
                        className={`text-xs px-2 py-1 rounded transition-colors ${showDanmaku ? 'bg-accent-cyan/20 text-accent-cyan border border-accent-cyan/30' : 'text-text-muted hover:bg-white/5'}`}
                    >
                        DANMAKU: {showDanmaku ? 'ON' : 'OFF'}
                    </button>
                )}
            </div>

            {/* Messages List */}
            <div className="flex-1 overflow-y-auto p-3 space-y-3 custom-scrollbar">
                {messages.length === 0 && (
                    <div className="h-full flex flex-col items-center justify-center text-text-muted opacity-30 text-xs">
                        <div>No signals detected...</div>
                    </div>
                )}
                {messages.map(msg => (
                    <div key={msg.id} className={`text-sm animate-fade-in break-words ${msg.type === 'tip' ? 'bg-accent-yellow/5 border-l-2 border-accent-yellow p-2 rounded' : ''}`}>
                        <div className="flex items-baseline gap-2 mb-1">
                            {msg.giftIcon && <span className="text-lg">{msg.giftIcon}</span>}
                            <span className={`font-bold text-xs ${msg.type === 'tip' ? 'text-accent-yellow' : 'text-accent-cyan'}`}>
                                {msg.fromName}
                            </span>
                            <span className="text-[10px] text-white/20 ml-auto">
                                {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                        </div>
                        <div className={`text-gray-300 ${msg.type === 'tip' ? 'font-bold text-accent-yellow' : ''}`}>
                            {msg.content}
                        </div>
                    </div>
                ))}
                <div ref={messagesEndRef} />
            </div>

            {/* Input Area */}
            <div className="p-3 border-t border-white/10 flex gap-2 bg-black/40 backdrop-blur-md">
                <input
                    type="text"
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                    placeholder="Transmitting message..."
                    maxLength={100}
                    className="flex-1 bg-white/5 border border-white/10 rounded-full px-4 py-2 text-sm text-white focus:outline-none focus:border-accent-cyan focus:bg-accent-cyan/5 transition-all placeholder:text-white/20"
                />
                <button
                    onClick={handleSend}
                    className="bg-accent-cyan hover:bg-accent-cyan/80 text-black font-bold rounded-full px-4 py-2 text-sm transition-all shadow-[0_0_10px_rgba(0,213,255,0.3)] hover:shadow-[0_0_15px_rgba(0,213,255,0.5)] active:scale-95"
                >
                    SEND
                </button>
            </div>
        </div>
    );
}
