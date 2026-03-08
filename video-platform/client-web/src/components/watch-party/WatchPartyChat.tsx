// FILE: /video-platform/client-web/src/components/watch-party/WatchPartyChat.tsx
/**
 * Watch Party 实时聊天面板
 * - 消息列表
 * - 发送输入框
 * - 支持普通聊天和弹幕
 */

import React, { useState, useRef, useEffect } from 'react';
import { Send, MessageCircle, Sparkles } from 'lucide-react';
import type { ChatMessage } from '../../hooks/useWatchPartySync';

interface WatchPartyChatProps {
    messages: ChatMessage[];
    onSend: (content: string, type: 'chat' | 'danmaku') => void;
    currentUserId: string;
}

export const WatchPartyChat: React.FC<WatchPartyChatProps> = ({
    messages,
    onSend,
    currentUserId
}) => {
    const [input, setInput] = useState('');
    const [sendAsDanmaku, setSendAsDanmaku] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    const handleSend = () => {
        if (!input.trim()) return;
        onSend(input.trim(), sendAsDanmaku ? 'danmaku' : 'chat');
        setInput('');
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    const formatTime = (timestamp: number) => {
        return new Date(timestamp).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
    };

    return (
        <div className="wp-chat-panel">
            <div className="wp-chat-header">
                <MessageCircle size={18} />
                <span>实时聊天</span>
                <span className="wp-chat-count">{messages.length}</span>
            </div>

            <div className="wp-chat-messages">
                {messages.map((msg) => (
                    <div
                        key={msg.id}
                        className={`wp-chat-message ${msg.type} ${msg.senderId === currentUserId ? 'self' : ''}`}
                    >
                        {msg.type === 'system' ? (
                            <div className="wp-system-msg">{msg.content}</div>
                        ) : (
                            <>
                                <div className="wp-msg-header">
                                    <span className="wp-msg-name">{msg.senderName}</span>
                                    <span className="wp-msg-time">{formatTime(msg.timestamp)}</span>
                                </div>
                                <div className="wp-msg-content">
                                    {msg.type === 'danmaku' && <Sparkles size={12} className="wp-danmaku-icon" />}
                                    {msg.content}
                                </div>
                            </>
                        )}
                    </div>
                ))}
                <div ref={messagesEndRef} />
            </div>

            <div className="wp-chat-input-area">
                <button
                    className={`wp-danmaku-toggle ${sendAsDanmaku ? 'active' : ''}`}
                    onClick={() => setSendAsDanmaku(!sendAsDanmaku)}
                    title={sendAsDanmaku ? '切换为普通消息' : '切换为弹幕'}
                >
                    <Sparkles size={16} />
                </button>
                <input
                    type="text"
                    className="wp-chat-input"
                    placeholder={sendAsDanmaku ? '发送弹幕...' : '发送消息...'}
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                />
                <button className="wp-send-btn" onClick={handleSend} disabled={!input.trim()}>
                    <Send size={18} />
                </button>
            </div>
        </div>
    );
};

export default WatchPartyChat;
