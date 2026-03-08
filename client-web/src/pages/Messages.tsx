/**
 * 私信页面
 * 左侧: 对话列表
 * 右侧: 聊天窗口
 */

import React, { useState, useEffect, useCallback, useRef } from "react";
import { getApiClient } from "../lib/apiClient";
import { useAuthStore } from "../stores";
import { setPageSEO } from "../utils/seo";

interface Conversation {
    peerId: string;
    peerUsername: string | null;
    peerAvatar: string | null;
    lastMessage: string;
    lastMessageAt: string;
    unreadCount: number;
}

interface Message {
    id: string;
    fromUserId: string;
    toUserId: string;
    content: string;
    read: boolean;
    createdAt: string;
}

const Messages: React.FC = () => {
    const user = useAuthStore((s) => s.user);
    const api = getApiClient();
    const [conversations, setConversations] = useState<Conversation[]>([]);
    const [selectedPeer, setSelectedPeer] = useState<string | null>(null);
    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState("");
    const [loading, setLoading] = useState(true);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        setPageSEO({ title: "私信" });
    }, []);

    // 加载对话列表
    useEffect(() => {
        if (!user?.id) return;
        api.get<{ conversations: Conversation[] }>(`/api/messaging/conversations?userId=${user.id}`)
            .then((data) => setConversations(data.conversations))
            .catch(() => { })
            .finally(() => setLoading(false));
    }, [user?.id]);

    // 加载对话消息
    useEffect(() => {
        if (!user?.id || !selectedPeer) return;
        api.get<{ messages: Message[] }>(
            `/api/messaging/messages?userId=${user.id}&peerId=${selectedPeer}`
        )
            .then((data) => {
                setMessages(data.messages);
                // 标记已读
                api.post("/api/messaging/read", { userId: user.id, peerId: selectedPeer }).catch(() => { });
            })
            .catch(() => setMessages([]));
    }, [user?.id, selectedPeer]);

    // 自动滚动到底部
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages]);

    const sendMessage = useCallback(async () => {
        if (!input.trim() || !user?.id || !selectedPeer) return;
        try {
            const msg = await api.post<Message>("/api/messaging/send", {
                fromUserId: user.id,
                toUserId: selectedPeer,
                content: input.trim(),
            });
            setMessages((prev) => [...prev, msg]);
            setInput("");
            // 更新对话列表
            setConversations((prev) =>
                prev.map((c) =>
                    c.peerId === selectedPeer
                        ? { ...c, lastMessage: input.trim(), lastMessageAt: new Date().toISOString() }
                        : c
                )
            );
        } catch { }
    }, [input, user?.id, selectedPeer]);

    const selectedConv = conversations.find((c) => c.peerId === selectedPeer);

    return (
        <div className="flex flex-col h-full overflow-hidden text-gray-200 font-sans">

            {/* Main Container */}
            <main className="flex-1 max-w-7xl mx-auto w-full px-4 py-6 relative z-10 flex overflow-hidden">
                <div className="w-full h-full bg-[#0A0A14]/60 backdrop-blur-md rounded-2xl overflow-hidden flex border border-white/10 shadow-[0_0_30px_rgba(0,0,0,0.5)]">

                    {/* Left Sidebar: Conversations list */}
                    <div className="w-80 border-r border-white/5 bg-black/30 flex flex-col h-full flex-shrink-0">
                        <div className="p-6 border-b border-white/5 flex justify-between items-center shrink-0">
                            <h2 className="text-lg font-black text-white uppercase tracking-widest flex items-center gap-2">
                                <svg className="w-5 h-5 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"></path>
                                </svg>
                                Comms
                            </h2>
                            {conversations.reduce((acc, c) => acc + c.unreadCount, 0) > 0 && (
                                <span className="w-5 h-5 rounded-full bg-purple-500 text-white flex items-center justify-center text-[10px] font-bold">
                                    {conversations.reduce((acc, c) => acc + c.unreadCount, 0)}
                                </span>
                            )}
                        </div>

                        <div className="p-4 border-b border-white/5 shrink-0">
                            <div className="relative w-full">
                                <svg className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path>
                                </svg>
                                <input type="text" placeholder="Search signals..." className="bg-black/50 border border-white/10 text-white focus:outline-none focus:border-purple-500 focus:shadow-[0_0_10px_rgba(168,85,247,0.2)] transition-all w-full rounded-full py-2 pl-10 pr-4 text-xs" />
                            </div>
                        </div>

                        <div className="flex-1 overflow-y-auto custom-scrollbar">
                            {loading ? (
                                <div className="p-8 text-center text-gray-500 text-sm">Loading signals...</div>
                            ) : conversations.length === 0 ? (
                                <div className="p-8 text-center text-gray-500 text-sm">No active comms</div>
                            ) : (
                                conversations.map((conv) => {
                                    const isActive = selectedPeer === conv.peerId;
                                    return (
                                        <div
                                            key={conv.peerId}
                                            onClick={() => setSelectedPeer(conv.peerId)}
                                            className={`flex items-center gap-4 p-4 border-b border-white/5 cursor-pointer transition-colors relative block group ${isActive ? 'bg-purple-500/10 border-l-2 border-l-purple-500' : 'hover:bg-white/5 border-l-2 border-l-transparent'}`}
                                        >
                                            {isActive && <div className="absolute inset-0 bg-gradient-to-r from-purple-500/10 to-transparent pointer-events-none"></div>}
                                            <div className="relative shrink-0">
                                                {conv.peerAvatar ? (
                                                    <img src={conv.peerAvatar || undefined} className={`w-12 h-12 rounded-full object-cover border transition-colors ${isActive ? 'border-cyan-400/50' : 'border-white/10 group-hover:border-white/30 opacity-70'}`} />
                                                ) : (
                                                    <div className={`w-12 h-12 rounded-full border transition-colors flex items-center justify-center ${isActive ? 'border-cyan-400/50 bg-cyan-400/10 text-cyan-400' : 'border-white/10 group-hover:border-white/30 opacity-70 bg-gray-800 text-gray-400'}`}>
                                                        <span className="text-xs font-bold">{conv.peerUsername?.slice(0, 2).toUpperCase() || "U"}</span>
                                                    </div>
                                                )}
                                                {conv.unreadCount > 0 ? (
                                                    <div className="absolute bottom-0 right-0 w-3 h-3 bg-cyan-400 border-2 border-[#1a1a2e] rounded-full shadow-[0_0_5px_#22d3ee]"></div>
                                                ) : null}
                                            </div>
                                            <div className="flex-1 overflow-hidden">
                                                <div className="flex justify-between items-baseline mb-1">
                                                    <h3 className={`text-sm font-bold truncate transition-colors ${isActive ? 'text-white' : 'text-gray-300 group-hover:text-white'}`}>{conv.peerUsername || "User"}</h3>
                                                    {conv.lastMessageAt && <span className={`text-[10px] font-mono ${isActive ? 'text-cyan-400' : 'text-gray-500'}`}>{new Date(conv.lastMessageAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>}
                                                </div>
                                                <p className={`text-xs truncate ${isActive ? 'text-gray-300' : 'text-gray-500 group-hover:text-gray-400'}`}>{conv.lastMessage}</p>
                                            </div>
                                            {isActive && conv.unreadCount > 0 && <div className="w-2 h-2 rounded-full bg-cyan-400 shadow-[0_0_5px_#22d3ee]"></div>}
                                        </div>
                                    );
                                })
                            )}
                        </div>
                    </div>

                    {/* Right Area: Chat Window */}
                    <div className="flex-1 flex flex-col h-full bg-black/40 relative overflow-hidden">
                        {!selectedPeer ? (
                            <div className="flex-1 flex flex-col items-center justify-center text-gray-500 text-sm">
                                <svg className="w-16 h-16 text-gray-700 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"></path>
                                </svg>
                                <div>Select a signal to display comms</div>
                            </div>
                        ) : (
                            <>
                                {/* Chat Header */}
                                <div className="h-20 border-b border-white/5 bg-black/50 px-6 flex justify-between items-center shrink-0">
                                    <div className="flex items-center gap-4">
                                        <div className="relative">
                                            {selectedConv?.peerAvatar ? (
                                                <img src={selectedConv?.peerAvatar || undefined} className="w-10 h-10 rounded-full object-cover border border-cyan-400/50" />
                                            ) : (
                                                <div className="w-10 h-10 rounded-full border border-cyan-400/50 bg-cyan-400/10 text-cyan-400 flex items-center justify-center text-sm font-bold">
                                                    {selectedConv?.peerUsername?.slice(0, 2).toUpperCase() || "U"}
                                                </div>
                                            )}
                                            <div className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-cyan-400 border-2 border-[#0A0A14] rounded-full"></div>
                                        </div>
                                        <div>
                                            <h2 className="text-sm font-bold text-white flex items-center gap-2">
                                                {selectedConv?.peerUsername || "User"}
                                                <svg className="w-3 h-3 text-cyan-400" fill="currentColor" viewBox="0 0 20 20">
                                                    <path fillRule="evenodd" d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"></path>
                                                </svg>
                                            </h2>
                                            <span className="text-[10px] font-mono text-cyan-400">Online via Fiber Network</span>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <button className="w-8 h-8 rounded-full hover:bg-white/10 flex items-center justify-center text-gray-400 hover:text-white transition-colors">
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z"></path>
                                            </svg>
                                        </button>
                                    </div>
                                </div>

                                {/* Messages Area */}
                                <div className="flex-1 overflow-y-auto p-6 space-y-6 flex flex-col custom-scrollbar">
                                    <div className="flex justify-center">
                                        <span className="text-[10px] font-mono font-bold text-gray-500 uppercase tracking-widest bg-black/40 px-3 py-1 rounded-full border border-white/5">Start of Comms</span>
                                    </div>

                                    {messages.map((msg) => {
                                        const isMine = msg.fromUserId === user?.id;
                                        return (
                                            <div key={msg.id} className={`flex w-full ${isMine ? 'justify-end' : ''}`}>
                                                <div className={`px-4 py-3 rounded-2xl max-w-[70%] shadow-lg ${isMine ? 'bg-gradient-to-br from-purple-500 to-indigo-600 text-white rounded-tr-sm shadow-[0_5px_15px_rgba(168,85,247,0.2)]' : 'bg-white/5 border border-white/10 text-gray-200 rounded-tl-sm'}`}>
                                                    <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                                                    <span className={`text-[9px] font-mono mt-2 block text-right ${isMine ? 'text-purple-200' : 'text-gray-500'}`}>
                                                        {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                    </span>
                                                </div>
                                            </div>
                                        );
                                    })}
                                    <div ref={messagesEndRef} />
                                </div>

                                {/* Input Area */}
                                <div className="p-4 border-t border-white/5 bg-black/50 shrink-0">
                                    <div className="flex items-center gap-3">
                                        <button className="w-10 h-10 rounded-full bg-white/5 hover:bg-white/10 text-gray-400 flex items-center justify-center transition-colors shrink-0">
                                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13"></path>
                                            </svg>
                                        </button>
                                        <input
                                            type="text"
                                            placeholder="Transmit message..."
                                            value={input}
                                            onChange={(e) => setInput(e.target.value)}
                                            onKeyDown={(e) => e.key === "Enter" && sendMessage()}
                                            className="flex-1 rounded-full px-5 py-3 text-sm focus:border-purple-500 bg-black/40 border border-white/10 text-white focus:outline-none focus:shadow-[0_0_10px_rgba(168,85,247,0.2)] transition-all"
                                        />
                                        <button
                                            onClick={sendMessage}
                                            disabled={!input.trim()}
                                            className="px-6 py-3 rounded-full bg-purple-500 hover:bg-purple-400 text-white font-bold text-sm shadow-[0_0_15px_rgba(168,85,247,0.4)] transition-all shrink-0 uppercase tracking-widest disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                                        >
                                            Send
                                        </button>
                                    </div>
                                </div>
                            </>
                        )}
                    </div>

                </div>
            </main>

            <style>{`
                .custom-scrollbar::-webkit-scrollbar {
                    width: 6px;
                }
                .custom-scrollbar::-webkit-scrollbar-track {
                    background: transparent;
                }
                .custom-scrollbar::-webkit-scrollbar-thumb {
                    background: rgba(255, 255, 255, 0.1);
                    border-radius: 10px;
                }
                .custom-scrollbar::-webkit-scrollbar-thumb:hover {
                    background: rgba(255, 255, 255, 0.2);
                }
            `}</style>
        </div>
    );
};

export default Messages;
