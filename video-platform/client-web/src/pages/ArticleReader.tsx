import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { getApiClient } from "../lib/apiClient";
import type { VideoMeta } from "@video-platform/shared/types";
import { X, BookOpen, Search, Bookmark, Share2, MessageSquare, Highlighter, Settings, Type, Heart } from 'lucide-react';
import PaymentModeSelector from '../components/PaymentModeSelector';
import { usePayment } from '../hooks/usePayment';

import { FRANKENSTEIN_TEXT, ALICE_TEXT, THE_PROPHET_TEXT_CN, PRIDE_AND_PREJUDICE_TEXT, SHERLOCK_HOLMES_TEXT, TOM_SAWYER_TEXT } from '../data/mock_literature';

const client = getApiClient();

// --- Mock Data Cloned to preserve existing logic without touching original files ---
const MOCK_ARTICLES: any[] = [
    {
        id: "pd-7", title: "Frankenstein", description: "Mary Shelley. The story of Victor Frankenstein.", creatorBitDomain: "shelley.bit",
        priceUSDI: "0", genre: "Sci-Fi", contentType: 'article', posterUrl: "https://www.gutenberg.org/cache/epub/84/pg84.cover.medium.jpg",
        streamPricePerMinute: 2, priceMode: 'both', textContent: FRANKENSTEIN_TEXT, views: 854300
    },
    {
        id: "pd-12", title: "Alice in Wonderland", description: "Lewis Carroll. Alice falls down a rabbit hole.", creatorBitDomain: "carroll.bit",
        priceUSDI: "0", genre: "Fantasy", contentType: 'article', posterUrl: "https://www.gutenberg.org/cache/epub/11/pg11.cover.medium.jpg",
        streamPricePerMinute: 3, priceMode: 'both', textContent: ALICE_TEXT, views: 1240500
    },
    {
        id: "pd-13", title: "Pride and Prejudice", description: "Jane Austen. A romantic novel of manners.", creatorBitDomain: "austen.bit",
        priceUSDI: "0", genre: "Romance", contentType: 'article', posterUrl: "https://www.gutenberg.org/cache/epub/1342/pg1342.cover.medium.jpg",
        streamPricePerMinute: 2, priceMode: 'both', textContent: PRIDE_AND_PREJUDICE_TEXT, views: 3500000
    },
    {
        id: "pd-14", title: "The Adventures of Sherlock Holmes", description: "Arthur Conan Doyle. A collection of twelve short stories.", creatorBitDomain: "doyle.bit",
        priceUSDI: "0", genre: "Mystery", contentType: 'article', posterUrl: "https://www.gutenberg.org/cache/epub/1661/pg1661.cover.medium.jpg",
        streamPricePerMinute: 4, priceMode: 'both', textContent: SHERLOCK_HOLMES_TEXT, views: 4200000
    },
    {
        id: "pd-15", title: "The Adventures of Tom Sawyer", description: "Mark Twain. An 1876 novel.", creatorBitDomain: "twain.bit",
        priceUSDI: "0", genre: "Adventure", contentType: 'article', posterUrl: "https://www.gutenberg.org/cache/epub/74/pg74.cover.medium.jpg",
        streamPricePerMinute: 3, priceMode: 'both', textContent: TOM_SAWYER_TEXT, views: 2800000
    }
];

class TextReaderPlayer {
    private currentTimeVal = 0;
    private timer: any = null;
    private eventHandlers: Record<string, Function[]> = {};

    currentTime(val?: number) {
        if (typeof val === 'number') { this.currentTimeVal = val; return; }
        return this.currentTimeVal;
    }
    pause() { if (this.timer) clearInterval(this.timer); this.timer = null; }
    play() {
        if (this.timer) return;
        this.timer = setInterval(() => { this.currentTimeVal += 1; }, 1000);
    }
    on(event: string, cb: Function) {
        if (!this.eventHandlers[event]) this.eventHandlers[event] = [];
        this.eventHandlers[event].push(cb);
    }
    trigger(event: string) {
        if (this.eventHandlers[event]) this.eventHandlers[event].forEach(cb => cb());
    }
    dispose() { this.pause(); this.eventHandlers = {}; this.trigger('dispose'); }
}

export default function ArticleReader() {
    const navigate = useNavigate();
    const [articles, setArticles] = useState<VideoMeta[]>([]);
    const [loading, setLoading] = useState(true);
    const [readingArticle, setReadingArticle] = useState<VideoMeta | null>(null);
    const [selectedArticle, setSelectedArticle] = useState<VideoMeta | null>(null);

    // Immersive Reader State
    const [scrollProgress, setScrollProgress] = useState(0);
    const [toc, setToc] = useState<{ level: number, text: string, id: string }[]>([]);
    const [activeHeadingId, setActiveHeadingId] = useState<string>('');
    const contentRef = useRef<HTMLDivElement>(null);
    const [selectionRect, setSelectionRect] = useState<DOMRect | null>(null);
    const [showToolbar, setShowToolbar] = useState(false);

    // Payment State
    const [showPaymentOverlay, setShowPaymentOverlay] = useState(false);
    const textPlayerRef = useRef<TextReaderPlayer | null>(null);
    const streamHandlerRef = useRef<any>(null);

    const payment = usePayment({
        contentId: selectedArticle?.id || '',
        contentType: 'article',
        buyOncePrice: (selectedArticle as any)?.pointsPrice || 100,
        streamPricePerMinute: selectedArticle?.streamPricePerMinute || 1,
        priceMode: 'both',
        durationSeconds: (() => {
            const wordCount = (selectedArticle?.textContent || "").split(/\s+/).length;
            return Math.max(1, Math.ceil(wordCount / 200)) * 60;
        })(),
        onBuyOnceSuccess: () => {
            setReadingArticle(selectedArticle);
            setSelectedArticle(null);
            setShowPaymentOverlay(false);
        },
        onStreamStarted: (handler) => {
            streamHandlerRef.current = handler;
            const player = new TextReaderPlayer();
            textPlayerRef.current = player;
            handler.setPlayer(player);
            player.play();
            setReadingArticle(selectedArticle);
            setSelectedArticle(null);
            setShowPaymentOverlay(false);
        },
        onStreamPause: () => { if (textPlayerRef.current) textPlayerRef.current.pause(); },
        onStatusChange: () => { },
        enabled: !!selectedArticle,
    });

    useEffect(() => {
        setLoading(true);
        client.get<VideoMeta[]>(`/metadata/list?type=article`)
            .then(res => {
                let fetched = Array.isArray(res) ? res : [];
                let final: VideoMeta[];
                if (fetched.length > 0) {
                    const apiIds = new Set(fetched.map(a => a.id));
                    const extraMocks = MOCK_ARTICLES.filter(m => !apiIds.has(m.id));
                    final = [...fetched, ...extraMocks];
                } else {
                    final = MOCK_ARTICLES as any;
                }
                setArticles(final);
            })
            .catch(() => setArticles(MOCK_ARTICLES as any))
            .finally(() => setLoading(false));

        return () => {
            if (streamHandlerRef.current) streamHandlerRef.current.cleanup();
            if (textPlayerRef.current) textPlayerRef.current.dispose();
        };
    }, []);

    // Extract TOC from markdown text
    useEffect(() => {
        if (readingArticle && readingArticle.textContent) {
            const matches = [...readingArticle.textContent.matchAll(/^(#{1,3})\s+(.+)$/gm)];
            const newToc = matches.map((m, i) => ({
                level: m[1].length,
                text: m[2],
                id: `heading-${i}`
            }));
            setToc(newToc);
        } else {
            setToc([]);
        }
    }, [readingArticle]);

    // Handle scroll progress & active TOC heading
    useEffect(() => {
        if (!readingArticle) return;
        const mainScrollArea = document.querySelector('.nexus-main-scroll');
        if (!mainScrollArea) return;

        const handleScroll = () => {
            const { scrollTop, scrollHeight, clientHeight } = mainScrollArea;
            const max = scrollHeight - clientHeight;
            const progress = max > 0 ? (scrollTop / max) * 100 : 0;
            setScrollProgress(progress);

            // Active heading logic (basic)
            const headings = Array.from(document.querySelectorAll('.article-heading'));
            for (let i = headings.length - 1; i >= 0; i--) {
                const h = headings[i] as HTMLElement;
                if (h.offsetTop <= scrollTop + 100) {
                    setActiveHeadingId(h.id);
                    break;
                }
            }
        };

        mainScrollArea.addEventListener('scroll', handleScroll);
        return () => mainScrollArea.removeEventListener('scroll', handleScroll);
    }, [readingArticle]);

    // Handle Text Selection for Highlighting Toolbar
    useEffect(() => {
        const handleSelection = () => {
            const sel = window.getSelection();
            if (sel && sel.rangeCount > 0 && !sel.isCollapsed && contentRef.current?.contains(sel.anchorNode)) {
                const range = sel.getRangeAt(0);
                const rect = range.getBoundingClientRect();
                setSelectionRect(rect);
                setShowToolbar(true);
            } else {
                setShowToolbar(false);
            }
        };
        document.addEventListener('selectionchange', handleSelection);
        return () => document.removeEventListener('selectionchange', handleSelection);
    }, []);

    const renderMarkdownContent = (text: string) => {
        let headingCounter = 0;
        const lines = text.split('\n');
        return lines.map((line, idx) => {
            const headingMatch = line.match(/^(#{1,3})\s+(.+)$/);
            if (headingMatch) {
                const level = headingMatch[1].length;
                const content = headingMatch[2];
                const id = `heading-${headingCounter++}`;
                const Tag = `h${level}` as keyof JSX.IntrinsicElements;
                const classes = level === 1 ? 'text-4xl font-black mt-12 mb-6' : level === 2 ? 'text-2xl font-bold mt-8 mb-4' : 'text-xl font-bold mt-6 mb-3';
                return <Tag key={idx} id={id} className={`article-heading text-white ${classes}`}>{content}</Tag>;
            }
            if (line.trim() === '') return <br key={idx} />;
            return <p key={idx} className="mb-6">{line}</p>;
        });
    };

    return (
        <div className="relative min-h-screen bg-[#0a0a12] text-[#e5e5e5] pb-32 font-sans overflow-x-hidden">
            {/* Ambient Backgrounds */}
            <div className="fixed top-0 left-0 w-full h-[50vh] bg-gradient-to-b from-nexusPurple/5 to-transparent pointer-events-none" />

            {!readingArticle ? (
                // --- GRID VIEW ---
                <div className="p-8 md:p-12 max-w-[1600px] mx-auto z-10 relative">
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-16 gap-4 border-b border-white/5 pb-8">
                        <div>
                            <h1 className="text-4xl font-['Playfair_Display',Georgia,serif] italic text-white mb-2">Nexus Review</h1>
                            <p className="font-mono text-nexusCyan text-sm tracking-widest uppercase">Premium Literary Collection</p>
                        </div>
                        <div className="relative w-72">
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" size={16} />
                            <input type="text" placeholder="Search archive..." className="w-full bg-white/5 border border-white/10 rounded-full py-2.5 pl-11 pr-4 text-sm text-white focus:border-nexusCyan/50 outline-none transition-all focus:bg-white/10" />
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
                        {articles.map((article) => {
                            const isPaid = (article as any).pointsPrice > 0 || article.streamPricePerMinute > 0;
                            return (
                                <div key={article.id} className="group cursor-pointer flex flex-col" onClick={() => {
                                    if (isPaid) {
                                        setSelectedArticle(article);
                                        setShowPaymentOverlay(true);
                                    } else {
                                        setReadingArticle(article);
                                    }
                                }}>
                                    <div className="aspect-[3/4] rounded-lg overflow-hidden relative shadow-2xl mb-4 border border-white/10">
                                        <img src={article.posterUrl || `https://images.unsplash.com/photo-1451187580459-43490279c0fa?q=80&w=600`} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" alt="" />
                                        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
                                        {isPaid && (
                                            <div className="absolute top-3 right-3 bg-nexusPurple/90 backdrop-blur text-white text-[10px] font-bold px-2 py-1 rounded uppercase tracking-wider">
                                                Premium
                                            </div>
                                        )}
                                        <div className="absolute bottom-0 left-0 right-0 p-4 relative z-10">
                                            <div className="w-10 h-10 bg-nexusCyan text-black rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transform translate-y-4 group-hover:translate-y-0 transition-all shadow-[0_0_20px_rgba(34,211,238,0.5)] mx-auto mb-2">
                                                <BookOpen size={18} />
                                            </div>
                                        </div>
                                    </div>
                                    <h3 className="font-serif text-xl font-bold text-white group-hover:text-nexusCyan transition-colors line-clamp-2">{article.title}</h3>
                                    <p className="text-gray-400 text-sm mt-1 mb-2 font-mono">By {article.creatorBitDomain}</p>
                                    <p className="text-gray-500 text-sm line-clamp-3">{article.description}</p>
                                </div>
                            )
                        })}
                    </div>
                </div>
            ) : (
                // --- IMMERSIVE READER VIEW ---
                <div className="relative pt-20">
                    {/* Top Progress Bar */}
                    <div className="fixed top-0 left-0 w-full h-1 bg-white/5 z-50">
                        <div className="h-full bg-gradient-to-r from-nexusCyan to-nexusPurple transition-all duration-150" style={{ width: `${scrollProgress}%` }} />
                    </div>

                    {/* Top Fixed Reader Nav */}
                    <div className="fixed top-0 left-0 w-full md:left-64 md:w-[calc(100%-256px)] h-16 bg-[#0a0a12]/90 backdrop-blur-md border-b border-white/5 z-40 flex items-center justify-between px-8">
                        <div className="flex gap-4 items-center">
                            <button onClick={() => setReadingArticle(null)} className="text-gray-400 hover:text-white flex items-center gap-2 text-sm font-bold uppercase tracking-widest transition-colors font-mono">
                                <X size={16} /> Exit
                            </button>
                            <div className="h-4 w-px bg-white/10" />
                            <span className="font-serif text-sm text-gray-400 truncate max-wxs">{readingArticle.title}</span>
                        </div>
                        <div className="flex gap-4 items-center text-gray-400">
                            <span className="font-mono text-xs hidden sm:block">{(readingArticle.textContent || "").split(/\s+/).length} Words</span>
                            <button className="hover:text-nexusCyan transition-colors"><Bookmark size={18} /></button>
                            <button className="hover:text-nexusCyan transition-colors"><Settings size={18} /></button>
                        </div>
                    </div>

                    <div className="max-w-[1400px] mx-auto px-6 lg:px-12 flex relative pt-6">
                        {/* Left Floating TOC (Desktop) */}
                        <div className="hidden lg:block w-64 flex-shrink-0 relative">
                            <div className="sticky top-32 max-h-[calc(100vh-200px)] overflow-y-auto hide-scrollbar pr-4">
                                <h4 className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-6 font-mono">Contents</h4>
                                <ul className="space-y-3">
                                    {toc.map((item) => (
                                        <li key={item.id} style={{ paddingLeft: `${(item.level - 1) * 12}px` }}>
                                            <button
                                                onClick={() => {
                                                    const el = document.getElementById(item.id);
                                                    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
                                                }}
                                                className={`text-sm text-left transition-colors font-serif block ${activeHeadingId === item.id ? 'text-nexusCyan font-bold drop-shadow-[0_0_8px_rgba(34,211,238,0.3)]' : 'text-gray-400 hover:text-white'}`}
                                            >
                                                {item.text}
                                            </button>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        </div>

                        {/* Center Article Content */}
                        <div className="flex-1 w-full flex justify-center pb-32">
                            <div className="w-full max-w-[680px]" ref={contentRef}>
                                <header className="mb-16 text-center">
                                    <h1 className="text-5xl md:text-6xl font-['Playfair_Display',Georgia,serif] text-white font-black leading-tight mb-6 italic">{readingArticle.title}</h1>
                                    <div className="flex items-center justify-center gap-4 text-sm font-mono text-gray-400 mb-8">
                                        <span className="flex items-center gap-2"><div className="w-6 h-6 rounded-full bg-nexusPurple" /> {readingArticle.creatorBitDomain}</span>
                                        <span>•</span>
                                        <span>{Math.ceil(((readingArticle.textContent || "").split(/\s+/).length) / 200)} min read</span>
                                    </div>
                                    <div className="w-full h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />
                                </header>

                                <div className="prose prose-invert prose-lg max-w-none prose-p:text-[#d1d5db] prose-p:leading-[1.8] prose-p:font-['Georgia',serif] prose-p:text-[19px] selection:bg-nexusCyan/30 selection:text-white">
                                    {renderMarkdownContent(readingArticle.textContent || "Content is empty.")}
                                </div>

                                <footer className="mt-24 pt-8 border-t border-white/10 flex flex-col items-center">
                                    <div className="text-center mb-8">
                                        <p className="font-serif italic text-gray-400 mb-4">Enjoyed the read?</p>
                                        <div className="flex gap-4">
                                            <button className="w-12 h-12 rounded-full border border-white/20 hover:border-nexusCyan hover:text-nexusCyan flex items-center justify-center transition-all"><Heart size={20} /></button>
                                            <button className="w-12 h-12 rounded-full border border-white/20 hover:border-nexusPurple hover:text-nexusPurple flex items-center justify-center transition-all"><Share2 size={20} /></button>
                                            <button className="w-12 h-12 rounded-full border border-white/20 hover:border-nexusCyan hover:text-nexusCyan flex items-center justify-center transition-all"><MessageSquare size={20} /></button>
                                        </div>
                                    </div>
                                </footer>
                            </div>
                        </div>

                        {/* Right Area (padding/margin for centering) */}
                        <div className="hidden lg:block w-32 flex-shrink-0" />
                    </div>
                </div>
            )}

            {/* Floating Highlight Toolbar */}
            {showToolbar && selectionRect && (
                <div
                    className="fixed z-50 bg-[#1f1f2e] border border-white/10 rounded-lg shadow-2xl flex items-center p-1 gap-1 transform -translate-x-1/2 -translate-y-full"
                    style={{
                        left: selectionRect.left + (selectionRect.width / 2),
                        top: selectionRect.top - 10
                    }}
                >
                    <button className="p-2 hover:bg-white/10 rounded text-gray-300 hover:text-nexusCyan transition-colors"><Highlighter size={16} /></button>
                    <button className="p-2 hover:bg-white/10 rounded text-gray-300 hover:text-nexusPurple transition-colors"><MessageSquare size={16} /></button>
                    <button className="p-2 hover:bg-white/10 rounded text-gray-300 hover:text-white transition-colors"><Share2 size={16} /></button>
                </div>
            )}

            {/* Payment Modal */}
            {showPaymentOverlay && selectedArticle && (
                <PaymentModeSelector
                    video={{ ...selectedArticle, buyOncePrice: (selectedArticle as any).pointsPrice || 100 }}
                    onSelect={async (mode) => {
                        if (mode === 'buy_once') await payment.handleBuyOnce();
                        else if (mode === 'stream') await payment.handleStartStream();
                        else { setShowPaymentOverlay(false); setSelectedArticle(null); }
                    }}
                    onClose={() => { setShowPaymentOverlay(false); setSelectedArticle(null); }}
                />
            )}
        </div>
    );
}
