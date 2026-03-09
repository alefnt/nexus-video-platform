import React, { useState, useEffect, useRef, useCallback } from 'react';
import { FileText, Sparkles, Loader2, Settings, ChevronRight, Upload, Send, Bot, User, RotateCcw, Copy, AlertTriangle, Wand2, HardDrive, Save, Check, Trash2, Clock } from 'lucide-react';
import { getApiClient } from '../lib/apiClient';
import { useAuthStore } from '../stores';
import { useNavigate } from 'react-router-dom';
import { saveGeneration, getGenerationsByType, markPublished, deleteGeneration, type LocalGeneration } from '../lib/aiLocalStorage';

const TONES = ['Professional', 'Casual', 'Academic', 'Conversational', 'Humorous', 'Formal', 'Technical', 'Creative'];
const LANGUAGES_LIST = ['English', '中文', '日本語', '한국어', 'Español', 'Français', 'Deutsch'];

interface ChatMessage {
    role: 'user' | 'assistant';
    content: string;
    timestamp?: number;
}

export default function AIArticleLab() {
    const api = getApiClient();
    const navigate = useNavigate();
    const { isLoggedIn } = useAuthStore();
    const chatEndRef = useRef<HTMLDivElement>(null);

    // Provider
    const [providerReady, setProviderReady] = useState<boolean | null>(null);
    const [providerName, setProviderName] = useState('');

    // Chat
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [input, setInput] = useState('');
    const [streaming, setStreaming] = useState(false);

    // Editor (local content)
    const [editorContent, setEditorContent] = useState('');
    const [title, setTitle] = useState('');

    // Generation params
    const [tone, setTone] = useState('Professional');
    const [language, setLanguage] = useState('English');
    const [targetLength, setTargetLength] = useState(1500);

    // Local drafts (IndexedDB)
    const [localDrafts, setLocalDrafts] = useState<LocalGeneration[]>([]);
    const [currentDraftId, setCurrentDraftId] = useState<string | null>(null);

    // Publishing state
    const [publishing, setPublishing] = useState(false);
    const [published, setPublished] = useState(false);

    // ── Load provider & local drafts ──────────────
    const loadDrafts = useCallback(async () => {
        try {
            const gens = await getGenerationsByType('text', 30);
            setLocalDrafts(gens);
        } catch { }
    }, []);

    useEffect(() => {
        if (!isLoggedIn) return;
        (async () => {
            try {
                const res = await api.get<any>('/ai/settings');
                const text = res?.text;
                if (text?.enabled && text?.apiKeyMasked) {
                    setProviderReady(true);
                    setProviderName(text.providerId || 'configured');
                } else {
                    setProviderReady(false);
                }
            } catch { setProviderReady(false); }
        })();
        loadDrafts();
    }, [isLoggedIn]);

    useEffect(() => {
        chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    // ── Send Chat Message (Streaming SSE) ──────────────
    const handleSend = useCallback(async () => {
        if (!input.trim() || streaming) return;
        const userMsg: ChatMessage = { role: 'user', content: input.trim(), timestamp: Date.now() };
        setMessages(prev => [...prev, userMsg]);
        setInput('');
        setStreaming(true);

        const assistantMsg: ChatMessage = { role: 'assistant', content: '', timestamp: Date.now() };
        setMessages(prev => [...prev, assistantMsg]);

        try {
            const apiBase = (import.meta as any).env?.VITE_API_GATEWAY_URL || 'http://localhost:8080';
            const jwt = useAuthStore.getState().jwt;

            const res = await fetch(`${apiBase}/ai/chat`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${jwt}` },
                body: JSON.stringify({
                    messages: [...messages, userMsg].map(m => ({ role: m.role, content: m.content })),
                    systemPrompt: `You are a professional content writer for Nexus, a Web3 entertainment platform. Help the user create engaging articles. Write in ${language}. Use a ${tone.toLowerCase()} tone. Target approximately ${targetLength} words when generating full articles. Format articles with proper markdown structure. Respond in the same language the user writes in.`,
                }),
            });

            if (!res.ok) {
                const err = await res.json().catch(() => ({ error: 'Failed' }));
                setMessages(prev => {
                    const updated = [...prev];
                    updated[updated.length - 1] = { ...updated[updated.length - 1], content: `❌ Error: ${err.error || 'Request failed'}` };
                    return updated;
                });
                setStreaming(false);
                return;
            }

            const reader = res.body?.getReader();
            if (!reader) { setStreaming(false); return; }

            const decoder = new TextDecoder();
            let buffer = '';
            let fullContent = '';

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split('\n');
                buffer = lines.pop() || '';

                for (const line of lines) {
                    const trimmed = line.trim();
                    if (trimmed === 'data: [DONE]') continue;
                    if (trimmed.startsWith('data: ')) {
                        try {
                            const data = JSON.parse(trimmed.slice(6));
                            if (data.content) {
                                fullContent += data.content;
                                setMessages(prev => {
                                    const updated = [...prev];
                                    updated[updated.length - 1] = { ...updated[updated.length - 1], content: fullContent };
                                    return updated;
                                });
                            }
                            if (data.error) {
                                fullContent += `\n❌ ${data.error}`;
                                setMessages(prev => {
                                    const updated = [...prev];
                                    updated[updated.length - 1] = { ...updated[updated.length - 1], content: fullContent };
                                    return updated;
                                });
                            }
                        } catch { }
                    }
                }
            }
        } catch (err: any) {
            setMessages(prev => {
                const updated = [...prev];
                updated[updated.length - 1] = { ...updated[updated.length - 1], content: `❌ ${err?.message || 'Failed'}` };
                return updated;
            });
        } finally { setStreaming(false); }
    }, [input, messages, streaming, tone, language, targetLength]);

    // ── Insert AI content to local editor ──────────────
    const insertToEditor = (content: string) => {
        setEditorContent(prev => prev ? `${prev}\n\n${content}` : content);
        if (!title && content) {
            const firstLine = content.split('\n').find(l => l.trim());
            if (firstLine) setTitle(firstLine.replace(/^#+\s*/, '').slice(0, 80));
        }
    };

    // ── Save Draft Locally (IndexedDB) ──────────────
    const handleSaveLocal = useCallback(async () => {
        if (!editorContent.trim()) return;

        const draftId = currentDraftId || `article-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        const draft: LocalGeneration = {
            id: draftId,
            type: 'text',
            status: 'completed',
            progress: 100,
            prompt: title || 'Untitled Draft',
            params: { tone, language, targetLength },
            resultContent: editorContent,
            resultMeta: {
                title: title || 'Untitled',
                wordCount: editorContent.split(/\s+/).filter(Boolean).length,
                language, tone,
            },
            published: false,
            createdAt: currentDraftId ? (localDrafts.find(d => d.id === currentDraftId)?.createdAt || Date.now()) : Date.now(),
            completedAt: Date.now(),
        };

        await saveGeneration(draft);
        setCurrentDraftId(draftId);
        loadDrafts();
    }, [editorContent, title, tone, language, targetLength, currentDraftId, localDrafts]);

    // ── Load a draft ──────────────
    const loadDraft = (draft: LocalGeneration) => {
        setCurrentDraftId(draft.id);
        setEditorContent(draft.resultContent || '');
        setTitle(draft.resultMeta?.title || draft.prompt || '');
        if (draft.params?.tone) setTone(draft.params.tone);
        if (draft.params?.language) setLanguage(draft.params.language);
    };

    // ── Publish to Platform (Pipeline: Upload → Metadata → NFT → Royalty) ──────────────
    const [autoMintNFT, setAutoMintNFT] = useState(true);
    const [pipelineSteps, setPipelineSteps] = useState<Array<{ step: string; status: string }>>([]);

    const handlePublish = useCallback(async () => {
        if (!editorContent.trim()) return;
        setPublishing(true);
        setPipelineSteps([{ step: 'upload', status: 'running' }]);
        try {
            // Save final version locally first
            await handleSaveLocal();

            // Get user info for CKB address
            const userRaw = sessionStorage.getItem('vp.user');
            const user = userRaw ? JSON.parse(userRaw) : null;
            const ckbAddress = user?.ckbAddress || '';

            // Convert content to base64
            const base64Content = btoa(unescape(encodeURIComponent(editorContent)));

            // Call unified publish pipeline
            const res = await api.post<any>('/content/publish', {
                base64Content,
                contentType: 'article',
                title: title || 'Untitled AI Article',
                description: editorContent.slice(0, 200),
                genre: 'Technology',
                language,
                creatorCkbAddress: ckbAddress,
                autoMintNFT,
                tags: ['ai-generated', tone.toLowerCase()],
            });

            // Update pipeline steps from response
            if (res?.pipeline) {
                setPipelineSteps(res.pipeline);
            }

            // Mark as published in local DB
            if (currentDraftId) {
                await markPublished(currentDraftId, res?.videoId || 'published');
            }
            setPublished(true);
            loadDrafts();
            setTimeout(() => { setPublished(false); setPipelineSteps([]); }, 5000);
        } catch (err: any) {
            setPipelineSteps(prev => [...prev, { step: 'error', status: err?.error || err?.message || 'Failed' }]);
            alert('发布失败: ' + (err?.error || err?.message || ''));
        } finally { setPublishing(false); }
    }, [editorContent, title, language, tone, providerName, currentDraftId, handleSaveLocal, autoMintNFT]);

    // ── Delete draft ──────────────
    const handleDeleteDraft = useCallback(async (id: string) => {
        await deleteGeneration(id);
        if (currentDraftId === id) {
            setCurrentDraftId(null);
            setEditorContent('');
            setTitle('');
        }
        loadDrafts();
    }, [currentDraftId]);

    // ── Generate full article ──────────────
    const generateArticle = () => {
        const topic = title || input || 'Write an engaging article';
        setInput(`Generate a complete ${targetLength}-word article about: ${topic}\n\nTone: ${tone}\nLanguage: ${language}\n\nPlease provide the full article with proper structure including title, introduction, body sections, and conclusion.`);
    };

    // ── New draft ──────────────
    const handleNewDraft = () => {
        setCurrentDraftId(null);
        setEditorContent('');
        setTitle('');
        setMessages([]);
    };

    // ── Provider not configured ──────────────
    if (providerReady === false) {
        return (
            <div className="min-h-screen bg-[#0a0a12] text-white p-8 flex items-center justify-center">
                <div className="text-center max-w-lg">
                    <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-purple-500/20 to-violet-600/20 flex items-center justify-center mx-auto mb-6">
                        <FileText size={36} className="text-purple-400" />
                    </div>
                    <h2 className="text-2xl font-bold mb-3">Text AI Provider Not Configured</h2>
                    <p className="text-gray-400 mb-6">Configure a text AI provider (like DeepSeek, OpenAI, or Claude) with your API key.</p>
                    <button onClick={() => navigate('/settings/ai')}
                        className="px-6 py-3 rounded-xl bg-gradient-to-r from-purple-500 to-violet-600 text-white font-bold hover:brightness-110 flex items-center gap-2 mx-auto">
                        <Settings size={16} /> Configure AI Provider
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[#0a0a12] text-white font-sans flex flex-col" style={{ height: '100vh' }}>
            {/* Header */}
            <div className="px-6 pt-6 pb-4 flex-shrink-0">
                <div className="flex items-center gap-2 text-purple-400 mb-2">
                    <Sparkles size={16} />
                    <span className="font-mono text-xs uppercase tracking-widest font-bold">
                        AI Studio <ChevronRight size={12} className="inline" /> Article Lab
                    </span>
                    <span className="ml-auto flex items-center gap-3">
                        <span className="text-xs bg-white/5 border border-white/10 px-3 py-1 rounded-full text-gray-400 font-mono flex items-center gap-1">
                            <HardDrive size={10} /> Local Storage
                        </span>
                        {providerName && (
                            <span className="text-xs bg-purple-500/10 border border-purple-500/20 px-3 py-1 rounded-full text-purple-400 font-mono">
                                Provider: {providerName}
                            </span>
                        )}
                    </span>
                </div>
                <h1 className="text-2xl font-black">
                    <span className="bg-gradient-to-r from-purple-400 to-violet-500 text-transparent bg-clip-text">AI Article Lab</span>
                </h1>
            </div>

            <div className="flex-1 flex overflow-hidden px-6 pb-6 gap-6">
                {/* Left: Chat */}
                <div className="w-1/2 flex flex-col">
                    {/* Settings Bar */}
                    <div className="flex items-center gap-3 mb-4 flex-wrap">
                        <select value={tone} onChange={e => setTone(e.target.value)}
                            className="bg-black/50 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white outline-none">
                            {TONES.map(t => <option key={t} value={t} className="bg-gray-900">{t}</option>)}
                        </select>
                        <select value={language} onChange={e => setLanguage(e.target.value)}
                            className="bg-black/50 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white outline-none">
                            {LANGUAGES_LIST.map(l => <option key={l} value={l} className="bg-gray-900">{l}</option>)}
                        </select>
                        <div className="flex items-center gap-2 text-xs text-gray-500">
                            <span>~{targetLength} words</span>
                            <input type="range" min={500} max={5000} step={100} value={targetLength}
                                onChange={e => setTargetLength(Number(e.target.value))} className="w-20 accent-purple-500" />
                        </div>
                        <button onClick={generateArticle} disabled={streaming}
                            className="ml-auto px-3 py-1.5 rounded-lg bg-purple-500/20 border border-purple-500/30 text-purple-400 text-xs font-bold hover:bg-purple-500/30 flex items-center gap-1 disabled:opacity-50">
                            <Wand2 size={12} /> Generate Article
                        </button>
                    </div>

                    {/* Chat Messages */}
                    <div className="flex-1 overflow-y-auto space-y-4 pr-2 mb-4 border border-white/5 rounded-2xl bg-[#12121e] p-4">
                        {messages.length === 0 && (
                            <div className="flex items-center justify-center h-full text-gray-600">
                                <div className="text-center">
                                    <Bot size={40} className="mx-auto mb-3 opacity-30" />
                                    <p className="text-sm font-bold mb-1">AI Article Assistant</p>
                                    <p className="text-xs max-w-xs">Ask me to help write, edit, or brainstorm. Content stays in your browser until you publish.</p>
                                </div>
                            </div>
                        )}
                        {messages.map((msg, i) => (
                            <div key={i} className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : ''}`}>
                                {msg.role === 'assistant' && (
                                    <div className="w-7 h-7 rounded-lg bg-purple-500/20 flex items-center justify-center flex-shrink-0">
                                        <Bot size={14} className="text-purple-400" />
                                    </div>
                                )}
                                <div className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${msg.role === 'user' ? 'bg-purple-500/20 border border-purple-500/20' : 'bg-black/30 border border-white/5'
                                    }`}>
                                    <div className="whitespace-pre-wrap">{msg.content}{streaming && i === messages.length - 1 && msg.role === 'assistant' ? '▊' : ''}</div>
                                    {msg.role === 'assistant' && msg.content && !streaming && (
                                        <div className="flex gap-2 mt-2 pt-2 border-t border-white/5">
                                            <button onClick={() => insertToEditor(msg.content)}
                                                className="text-xs text-purple-400 hover:text-purple-300 flex items-center gap-1">
                                                <Upload size={10} /> Insert to Editor
                                            </button>
                                            <button onClick={() => navigator.clipboard.writeText(msg.content)}
                                                className="text-xs text-gray-500 hover:text-white flex items-center gap-1">
                                                <Copy size={10} /> Copy
                                            </button>
                                        </div>
                                    )}
                                </div>
                                {msg.role === 'user' && (
                                    <div className="w-7 h-7 rounded-lg bg-cyan-500/20 flex items-center justify-center flex-shrink-0">
                                        <User size={14} className="text-cyan-400" />
                                    </div>
                                )}
                            </div>
                        ))}
                        <div ref={chatEndRef} />
                    </div>

                    {/* Input */}
                    <div className="flex gap-3">
                        <input value={input} onChange={e => setInput(e.target.value)}
                            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
                            placeholder="Ask AI to write, edit, or brainstorm..." disabled={streaming}
                            className="flex-1 bg-[#12121e] border border-white/10 rounded-xl px-4 py-3 text-sm text-white outline-none focus:border-purple-500 placeholder-gray-600 disabled:opacity-50" />
                        <button onClick={handleSend} disabled={streaming || !input.trim()}
                            className="px-4 py-3 rounded-xl bg-gradient-to-r from-purple-500 to-violet-600 text-white font-bold hover:brightness-110 disabled:opacity-50 flex items-center gap-2">
                            {streaming ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                        </button>
                    </div>
                </div>

                {/* Right: Editor + Local Drafts */}
                <div className="w-1/2 flex flex-col">
                    {/* Title */}
                    <div className="flex items-center gap-3 mb-3">
                        <input value={title} onChange={e => setTitle(e.target.value)}
                            placeholder="Article Title..."
                            className="flex-1 bg-transparent text-xl font-bold text-white outline-none placeholder-gray-600 border-b border-white/10 pb-2" />
                        <button onClick={handleNewDraft} className="text-xs text-gray-500 hover:text-white transition-colors px-2 py-1 rounded-lg hover:bg-white/5">+ New</button>
                    </div>

                    {/* Editor */}
                    <textarea value={editorContent} onChange={e => setEditorContent(e.target.value)}
                        placeholder="Your article content goes here...&#10;&#10;Content stays in your browser (IndexedDB). Only published articles go to platform storage."
                        className="flex-1 bg-[#12121e] border border-white/5 rounded-2xl p-6 text-sm text-white/90 resize-none outline-none focus:border-purple-500/30 placeholder-gray-600 leading-relaxed" />

                    {/* Word count & Actions */}
                    <div className="flex items-center justify-between mt-4 gap-3">
                        <div className="flex items-center gap-3 text-xs text-gray-500 font-mono">
                            <span>{editorContent.split(/\s+/).filter(Boolean).length} words</span>
                            <span className="flex items-center gap-1"><HardDrive size={10} /> Local</span>
                            {currentDraftId && <span className="text-purple-400/50">Draft: {currentDraftId.slice(0, 12)}...</span>}
                        </div>
                        <div className="flex gap-3">
                            <button onClick={handleSaveLocal} disabled={!editorContent.trim()}
                                className="px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-white text-sm font-bold hover:bg-white/10 disabled:opacity-50 flex items-center gap-2">
                                <Save size={14} /> Save Local
                            </button>
                            <button onClick={handlePublish} disabled={publishing || !editorContent.trim()}
                                className="px-4 py-2 rounded-xl bg-gradient-to-r from-green-500 to-emerald-600 text-white text-sm font-bold hover:brightness-110 disabled:opacity-50 flex items-center gap-2">
                                {publishing ? <Loader2 size={14} className="animate-spin" /> : published ? <><Check size={14} /> Published!</> : <><Upload size={14} /> Publish to Nexus</>}
                            </button>
                        </div>
                    </div>

                    {/* Local Drafts */}
                    {localDrafts.length > 0 && (
                        <div className="mt-4 border-t border-white/5 pt-4">
                            <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-1">
                                <RotateCcw size={12} /> Local Drafts ({localDrafts.length})
                            </h4>
                            <div className="space-y-1 max-h-32 overflow-y-auto">
                                {localDrafts.map(d => (
                                    <div key={d.id} className="flex items-center gap-2 p-2 rounded-lg hover:bg-white/5 transition-colors group">
                                        <button onClick={() => loadDraft(d)} className="flex-1 text-left min-w-0">
                                            <p className="text-xs font-bold truncate">{d.resultMeta?.title || d.prompt}</p>
                                            <p className="text-[10px] text-gray-600 font-mono flex items-center gap-2">
                                                <span>{d.resultMeta?.wordCount || 0} words</span>
                                                <span>{new Date(d.createdAt).toLocaleDateString()}</span>
                                                {d.published && <span className="text-green-500">Published</span>}
                                            </p>
                                        </button>
                                        <button onClick={() => handleDeleteDraft(d.id)}
                                            className="opacity-0 group-hover:opacity-100 text-gray-600 hover:text-red-400 p-1">
                                            <Trash2 size={10} />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
