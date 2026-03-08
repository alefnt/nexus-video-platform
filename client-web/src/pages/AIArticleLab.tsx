import React, { useState } from 'react';
import { Bot, Send, Type, Image as ImageIcon, Sparkles, Wand2, RefreshCw, Languages, LayoutTemplate, Save, Check, Globe, FileText, CheckCircle2 } from 'lucide-react';

interface ChatMessage {
    id: string;
    role: 'user' | 'assistant';
    content: string;
}

export default function AIArticleLab() {
    const [messages, setMessages] = useState<ChatMessage[]>([
        {
            id: '1',
            role: 'assistant',
            content: 'Hello! I am your Nexus AI Writing Assistant. Describe what you want to write about, or use the quick actions below to get started.'
        }
    ]);
    const [chatInput, setChatInput] = useState("");
    const [isThinking, setIsThinking] = useState(false);

    const [articleContent, setArticleContent] = useState("");
    const [wordCount, setWordCount] = useState(0);

    const [tone, setTone] = useState("Professional");
    const [language, setLanguage] = useState("English");

    const tones = ["Professional", "Casual", "Academic", "Creative", "Persuasive"];
    const languages = ["English", "中文", "日本語", "한국어", "Español"];

    const handleSendMessage = () => {
        if (!chatInput.trim()) return;

        const newMsg: ChatMessage = { id: Date.now().toString(), role: 'user', content: chatInput };
        setMessages([...messages, newMsg]);
        setChatInput("");
        setIsThinking(true);

        setTimeout(() => {
            setIsThinking(false);
            const responseMsg: ChatMessage = {
                id: (Date.now() + 1).toString(),
                role: 'assistant',
                content: `Here is a drafted section based on your prompt (Tone: ${tone}, Lang: ${language}):\n\nThe future of decentralized content creation lies at the intersection of blockchain verification and AI orchestration...`
            };
            setMessages(prev => [...prev, responseMsg]);

            if (!articleContent) {
                setArticleContent("# " + newMsg.content + "\n\n" + responseMsg.content);
                updateCounts("# " + newMsg.content + "\n\n" + responseMsg.content);
            }
        }, 1500);
    };

    const updateCounts = (text: string) => {
        setWordCount(text.trim() ? text.trim().split(/\s+/).length : 0);
    };

    const handleEditorChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        setArticleContent(e.target.value);
        updateCounts(e.target.value);
    };

    return (
        <div className="min-h-screen bg-[#0a0a12] text-white p-6 md:p-8 font-sans pb-32">
            {/* Background effects */}
            <div className="fixed top-0 left-0 w-full h-full bg-gradient-to-br from-nexusPurple/5 to-transparent pointer-events-none" />

            <div className="max-w-[1800px] mx-auto relative z-10 h-[calc(100vh-120px)] flex flex-col">

                {/* Header */}
                <div className="mb-6 flex items-center justify-between">
                    <div>
                        <div className="flex items-center gap-2 text-nexusPurple mb-2">
                            <Sparkles size={18} />
                            <span className="font-mono text-xs uppercase tracking-widest font-bold">Creator Studio &gt; AI Lab</span>
                        </div>
                        <h1 className="text-4xl font-black tracking-tight flex items-center gap-3">
                            AI Article <span className="text-transparent bg-clip-text bg-gradient-to-r from-nexusPurple to-nexusCyan">Writer</span>
                        </h1>
                    </div>
                </div>

                {/* Main Workspace */}
                <div className="flex-1 flex flex-col md:flex-row gap-6 min-h-0">

                    {/* Left Panel: AI Assistant (40%) */}
                    <div className="w-full md:w-[40%] lg:w-[35%] flex flex-col gap-4 h-full">

                        {/* Settings Bar */}
                        <div className="glass-panel p-4 rounded-2xl border border-white/5 flex gap-3">
                            <select
                                className="flex-1 bg-black/50 border border-white/10 rounded-lg p-2 text-xs font-bold text-white focus:border-nexusPurple outline-none"
                                value={tone} onChange={e => setTone(e.target.value)}
                            >
                                {tones.map(t => <option key={t} value={t}>{t} Tone</option>)}
                            </select>
                            <select
                                className="flex-1 bg-black/50 border border-white/10 rounded-lg p-2 text-xs font-bold text-white focus:border-nexusCyan outline-none"
                                value={language} onChange={e => setLanguage(e.target.value)}
                            >
                                {languages.map(l => <option key={l} value={l}>{l}</option>)}
                            </select>
                        </div>

                        {/* Quick Actions */}
                        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
                            {[
                                { icon: <LayoutTemplate size={14} />, label: 'Outline' },
                                { icon: <RefreshCw size={14} />, label: 'Rewrite' },
                                { icon: <Languages size={14} />, label: 'Translate' },
                                { icon: <ImageIcon size={14} />, label: 'Cover Art' }
                            ].map((action, i) => (
                                <button key={i} className="flex flex-col items-center justify-center gap-1 bg-white/[0.03] hover:bg-nexusPurple/20 hover:text-nexusPurple border border-white/5 hover:border-nexusPurple/50 transition-all rounded-xl py-3 text-gray-400 font-bold text-[10px] uppercase tracking-wider">
                                    {action.icon}
                                    {action.label}
                                </button>
                            ))}
                        </div>

                        {/* Chat Interface */}
                        <div className="flex-1 glass-panel rounded-2xl border border-white/5 flex flex-col overflow-hidden relative">
                            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-nexusPurple to-transparent opacity-50" />

                            <div className="flex-1 overflow-y-auto p-4 space-y-4">
                                {messages.map(msg => (
                                    <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                        <div className={`max-w-[85%] rounded-2xl p-4 text-sm leading-relaxed shadow-lg ${msg.role === 'user'
                                                ? 'bg-nexusPurple/20 border border-nexusPurple/30 text-white rounded-br-sm'
                                                : 'bg-black/40 border border-white/10 text-gray-300 rounded-bl-sm border-l-2 border-l-nexusPurple'
                                            }`}>
                                            {msg.role === 'assistant' && <div className="flex items-center gap-2 mb-2 text-nexusPurple"><Bot size={14} /><span className="text-[10px] font-bold uppercase tracking-widest">Nexus AI</span></div>}
                                            <div className="whitespace-pre-wrap font-sans">{msg.content}</div>

                                            {/* AI Suggestion Actions */}
                                            {msg.role === 'assistant' && msg.id !== '1' && (
                                                <div className="mt-3 flex gap-2 pt-3 border-t border-white/5">
                                                    <button
                                                        onClick={() => {
                                                            setArticleContent(prev => prev + (prev.endsWith('\n') ? '' : '\n\n') + msg.content.replace(/^Here is.+:\n\n/, ''));
                                                            updateCounts(articleContent + msg.content);
                                                        }}
                                                        className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider bg-black px-2 py-1 rounded text-white hover:text-nexusCyan hover:bg-white/10 transition-colors"
                                                    >
                                                        <Check size={12} /> Insert
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                ))}
                                {isThinking && (
                                    <div className="flex justify-start">
                                        <div className="bg-black/40 border border-white/10 rounded-2xl p-4 rounded-bl-sm border-l-2 border-l-nexusPurple flex gap-1">
                                            <span className="w-2 h-2 bg-nexusPurple rounded-full animate-bounce [animation-delay:-0.3s]"></span>
                                            <span className="w-2 h-2 bg-nexusPurple rounded-full animate-bounce [animation-delay:-0.15s]"></span>
                                            <span className="w-2 h-2 bg-nexusPurple rounded-full animate-bounce"></span>
                                        </div>
                                    </div>
                                )}
                            </div>

                            <div className="p-4 bg-black/20 border-t border-white/5">
                                <div className="relative flex items-center">
                                    <textarea
                                        className="w-full bg-black/40 border border-white/10 rounded-xl pl-4 pr-12 py-3 text-sm text-white focus:border-nexusPurple outline-none resize-none hide-scrollbar"
                                        placeholder="Ask AI to write, edit, or brainstorm..."
                                        rows={2}
                                        value={chatInput}
                                        onChange={e => setChatInput(e.target.value)}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter' && !e.shiftKey) {
                                                e.preventDefault();
                                                handleSendMessage();
                                            }
                                        }}
                                    />
                                    <button
                                        onClick={handleSendMessage}
                                        disabled={!chatInput.trim() || isThinking}
                                        className="absolute right-2 p-2 rounded-lg bg-nexusPurple/20 text-nexusPurple hover:bg-nexusPurple hover:text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                    >
                                        <Send size={16} />
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Right Panel: Editor (60%) */}
                    <div className="w-full md:w-[60%] lg:w-[65%] flex flex-col h-full glass-panel rounded-2xl border border-white/5 overflow-hidden relative">
                        {/* Editor Toolbar */}
                        <div className="h-14 border-b border-white/10 bg-black/40 flex items-center px-4 justify-between select-none">
                            <div className="flex gap-1 overflow-x-auto hide-scrollbar">
                                {['B', 'I', 'U', 'H1', 'H2', 'H3'].map(fmt => (
                                    <button key={fmt} className="w-8 h-8 rounded flex items-center justify-center text-gray-400 hover:text-white hover:bg-white/10 font-bold font-serif text-sm transition-colors">
                                        {fmt}
                                    </button>
                                ))}
                                <div className="w-px h-6 bg-white/10 mx-2 self-center" />
                                <button className="w-8 h-8 rounded flex items-center justify-center text-gray-400 hover:text-white hover:bg-white/10 transition-colors"><FileText size={16} /></button>
                                <button className="w-8 h-8 rounded flex items-center justify-center text-gray-400 hover:text-white hover:bg-white/10 transition-colors"><ImageIcon size={16} /></button>
                            </div>

                            <div className="flex items-center gap-4 text-xs font-mono text-gray-500">
                                <span>{wordCount} Words</span>
                                <span>~{Math.max(1, Math.ceil(wordCount / 200))} Min Read</span>
                            </div>
                        </div>

                        {/* Editor Area */}
                        <div className="flex-1 relative bg-[#0a0a0f] overflow-y-auto">
                            <textarea
                                value={articleContent}
                                onChange={handleEditorChange}
                                placeholder="Start writing your masterpiece here, or use the AI Assistant on the left..."
                                className="w-full h-full min-h-[500px] bg-transparent text-[#e5e5e5] p-8 md:p-12 outline-none resize-none font-serif text-lg leading-relaxed placeholder-gray-700 font-['Playfair_Display',Georgia,serif]"
                                spellCheck="false"
                            />
                        </div>

                        {/* Action Bar Bottom */}
                        <div className="h-16 border-t border-white/10 bg-black/60 flex items-center justify-between px-6 backdrop-blur-md z-10">
                            <button className="flex items-center gap-2 text-sm font-bold text-gray-400 hover:text-white transition-colors">
                                <Save size={16} /> Save Draft
                            </button>

                            <div className="flex items-center gap-3">
                                <button className="flex items-center gap-2 px-4 py-2 rounded-lg border border-nexusCyan/30 text-nexusCyan hover:bg-nexusCyan/10 text-sm font-bold uppercase tracking-wider transition-colors">
                                    <Globe size={16} /> Cross-Post
                                </button>
                                <button className="flex items-center gap-2 px-4 py-2 rounded-lg border border-nexusPurple text-white hover:bg-nexusPurple/20 text-sm font-bold uppercase tracking-wider transition-colors">
                                    <CheckCircle2 size={16} className="text-nexusPurple" /> Mint NFT
                                </button>
                                <button className="bg-white text-black hover:bg-gray-200 px-6 py-2 rounded-lg text-sm font-bold uppercase tracking-wider shadow-[0_0_15px_rgba(255,255,255,0.3)] hover:shadow-[0_0_25px_rgba(255,255,255,0.5)] transition-all">
                                    Publish
                                </button>
                            </div>
                        </div>
                    </div>

                </div>
            </div>
        </div>
    );
}
