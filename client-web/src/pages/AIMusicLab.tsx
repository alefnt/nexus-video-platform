import React, { useState } from 'react';
import { Play, Pause, Download, Share2, Music, Settings2, Sparkles, Mic, Type, Clock, Check, Volume2 } from 'lucide-react';
import { useGlobalMusic } from '../contexts/GlobalMusicContext';

export default function AIMusicLab() {
    const { playTrack } = useGlobalMusic();
    const [prompt, setPrompt] = useState("");
    const [style, setStyle] = useState("Pop");
    const [bpm, setBpm] = useState(120);
    const [duration, setDuration] = useState("2min");
    const [language, setLanguage] = useState("English");
    const [includeVocals, setIncludeVocals] = useState(true);
    const [generating, setGenerating] = useState(false);

    const [generatedTracks, setGeneratedTracks] = useState<any[]>([
        {
            id: 'mock-1',
            title: 'Neon Nights (Generated)',
            date: 'Just now',
            durationStr: '2:15',
            style: 'Cyberpunk Synthwave',
            playing: false,
            audioUrl: 'https://cdn.pixabay.com/download/audio/2022/10/18/audio_31c2730e64.mp3'
        },
        {
            id: 'mock-2',
            title: 'Ethereal Dawn (Generated)',
            date: '2 hours ago',
            durationStr: '3:05',
            style: 'Ambient Lo-Fi',
            playing: false,
            audioUrl: 'https://cdn.pixabay.com/download/audio/2022/11/22/audio_1eebb61ffc.mp3'
        }
    ]);

    const styles = ["Pop", "Rock", "Lo-Fi", "Jazz", "Electronic", "Hip Hop", "Classical", "R&B", "Ambient", "Cyberpunk", "Cinematic"];
    const durations = ["30s", "1min", "2min", "3min", "4min"];
    const languages = ["English", "中文", "日本語", "한국어", "Instrumental"];

    const handleGenerate = () => {
        if (!prompt) {
            alert("Please describe the music you want to generate.");
            return;
        }
        setGenerating(true);
        setTimeout(() => {
            setGenerating(false);
            setGeneratedTracks([{
                id: `gen-${Date.now()}`,
                title: `${style} Horizon (Generated)`,
                date: 'Just now',
                durationStr: duration,
                style: style,
                playing: false,
                audioUrl: 'https://cdn.pixabay.com/download/audio/2022/10/25/audio_24f605a5a1.mp3'
            }, ...generatedTracks]);
            setPrompt("");
        }, 3000);
    };

    const handlePlay = (track: any) => {
        playTrack({
            id: track.id,
            title: track.title,
            artist: "AI Music Labs",
            coverUrl: 'https://images.unsplash.com/photo-1614613535308-eb5fbd3d2c17?q=80&w=2000',
            audioUrl: track.audioUrl
        });
    };

    return (
        <div className="min-h-screen bg-[#0a0a12] text-white p-6 md:p-8 font-sans pb-32">
            {/* Background effects */}
            <div className="fixed top-0 left-0 w-full h-full bg-gradient-to-br from-nexusPurple/5 via-transparent to-nexusCyan/5 pointer-events-none" />

            <div className="max-w-[1800px] mx-auto relative z-10 flex flex-col md:flex-row gap-8 h-[calc(100vh-120px)]">

                {/* Left Panel: Generation Inputs */}
                <div className="w-full md:w-[32%] lg:w-[28%] flex flex-col gap-6 overflow-y-auto hide-scrollbar pb-8 pr-2">
                    <div className="mb-2">
                        <div className="flex items-center gap-2 text-nexusPurple mb-2">
                            <Sparkles size={18} />
                            <span className="font-mono text-xs uppercase tracking-widest font-bold">Creator Studio &gt; AI Lab</span>
                        </div>
                        <h1 className="text-4xl font-black tracking-tight">AI Music <span className="text-transparent bg-clip-text bg-gradient-to-r from-nexusCyan to-nexusPurple">Lab</span></h1>
                    </div>

                    {/* Prompt Box */}
                    <div className="glass-panel p-5 rounded-2xl border border-white/5 shadow-2xl relative overflow-hidden group focus-within:border-nexusPurple/50 transition-colors">
                        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-nexusPurple to-nexusCyan opacity-50" />
                        <label className="flex items-center gap-2 text-sm font-bold text-gray-300 mb-3">
                            <Type size={16} className="text-nexusCyan" /> 1. Describe Your Vision
                        </label>
                        <textarea
                            className="w-full bg-black/40 text-white placeholder-gray-600 rounded-xl p-4 border border-white/10 focus:border-nexusPurple focus:ring-1 focus:ring-nexusPurple outline-none resize-none transition-all font-sans text-sm h-32"
                            placeholder="Describe the musical style, mood, lyrical theme, or instrumentation... e.g., 'An upbeat synthwave track with heavy bass and dreamy female vocals about neon city lights'."
                            value={prompt}
                            onChange={(e) => setPrompt(e.target.value)}
                        />
                    </div>

                    {/* Controls */}
                    <div className="glass-panel p-5 rounded-2xl border border-white/5 space-y-6">
                        <div>
                            <label className="flex items-center gap-2 text-sm font-bold text-gray-300 mb-3">
                                <Music size={16} className="text-nexusPurple" /> 2. Core Style
                            </label>
                            <div className="flex flex-wrap gap-2">
                                {styles.map(s => (
                                    <button
                                        key={s}
                                        onClick={() => setStyle(s)}
                                        className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all border ${style === s ? 'bg-nexusPurple/20 text-nexusPurple border-nexusPurple shadow-[0_0_10px_rgba(168,85,247,0.3)]' : 'bg-transparent border-white/10 text-gray-400 hover:text-white hover:border-white/20'}`}
                                    >
                                        {s}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="h-px bg-white/5 w-full my-4" />

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="flex items-center gap-2 text-xs font-bold text-gray-400 mb-2">
                                    <Clock size={14} /> Duration
                                </label>
                                <select
                                    className="w-full bg-black/50 border border-white/10 rounded-lg p-2 text-sm text-white focus:border-nexusCyan outline-none"
                                    value={duration}
                                    onChange={(e) => setDuration(e.target.value)}
                                >
                                    {durations.map(d => <option key={d} value={d}>{d}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="flex items-center gap-2 text-xs font-bold text-gray-400 mb-2">
                                    <Volume2 size={14} /> BPM ({bpm})
                                </label>
                                <input
                                    type="range"
                                    min="60" max="200"
                                    value={bpm}
                                    onChange={(e) => setBpm(Number(e.target.value))}
                                    className="w-full accent-nexusCyan"
                                />
                            </div>
                        </div>

                        <div className="h-px bg-white/5 w-full my-4" />

                        <div>
                            <label className="flex items-center gap-2 text-xs font-bold text-gray-400 mb-2">
                                <Mic size={14} /> 3. Vocals & Lyrics
                            </label>
                            <div className="flex items-center gap-3 mb-3">
                                <button
                                    onClick={() => setIncludeVocals(!includeVocals)}
                                    className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg border text-sm font-bold transition-all ${includeVocals ? 'bg-nexusCyan/20 border-nexusCyan text-nexusCyan' : 'border-white/10 text-gray-500'}`}
                                >
                                    {includeVocals ? <><Check size={16} /> Vocals On</> : "Vocals Off"}
                                </button>
                                <select
                                    className={`flex-1 bg-black/50 border rounded-lg p-2 text-sm outline-none transition-colors ${!includeVocals ? 'opacity-50 cursor-not-allowed border-white/5 text-gray-600' : 'border-white/10 text-white focus:border-nexusCyan'}`}
                                    value={language}
                                    onChange={(e) => setLanguage(e.target.value)}
                                    disabled={!includeVocals}
                                >
                                    {languages.map(l => <option key={l} value={l}>{l}</option>)}
                                </select>
                            </div>
                        </div>
                    </div>

                    <button
                        onClick={handleGenerate}
                        disabled={generating || !prompt}
                        className={`w-full py-4 rounded-xl font-black text-lg flex items-center justify-center gap-2 transition-all shadow-xl mt-auto ${generating ? 'bg-gray-800 text-gray-500 cursor-not-allowed border border-white/10' : !prompt ? 'bg-nexusPurple/50 text-white/50 cursor-not-allowed' : 'bg-gradient-to-r from-nexusPurple to-pink-500 text-white hover:scale-[1.02] hover:shadow-[0_0_30px_rgba(168,85,247,0.5)]'}`}
                    >
                        {generating ? (
                            <><Sparkles className="animate-spin" /> Composing AI Magic...</>
                        ) : (
                            <><Music /> Generate Track</>
                        )}
                    </button>
                    <p className="text-center text-[10px] text-gray-500 font-mono mt-1">Cost: 15 Nexus Points per generation</p>
                </div>

                {/* Right Panel: Workspace */}
                <div className="flex-1 flex flex-col h-full overflow-hidden bg-black/20 rounded-3xl border border-white/5 backdrop-blur-md relative p-6">
                    <div className="flex justify-between items-center mb-6">
                        <h2 className="text-xl font-bold font-serif flex items-center gap-2"><Settings2 className="text-nexusCyan" /> Workspace & Library</h2>
                        <div className="text-xs text-gray-500 font-mono uppercase tracking-widest bg-white/5 px-3 py-1 rounded-full border border-white/5">
                            Daily Limit: {generatedTracks.length}/20
                        </div>
                    </div>

                    <div className="flex-1 overflow-y-auto hide-scrollbar space-y-4 pr-2">
                        {generating && (
                            <div className="w-full glass-panel rounded-2xl p-6 border-2 border-dashed border-nexusPurple/30 flex flex-col items-center justify-center py-12 animate-pulse">
                                <Sparkles className="w-12 h-12 text-nexusPurple mb-4 animate-bounce" />
                                <h3 className="text-lg font-bold text-white mb-2">Neural Engine Processing...</h3>
                                <p className="text-sm text-gray-400 font-mono">Synthesizing waveforms based on your prompt</p>
                                <div className="w-64 h-2 bg-white/10 rounded-full mt-6 overflow-hidden">
                                    <div className="h-full bg-gradient-to-r from-nexusCyan to-nexusPurple w-full origin-left animate-[scale-x_2s_ease-in-out_infinite]" />
                                </div>
                            </div>
                        )}

                        {generatedTracks.map(track => (
                            <div key={track.id} className="glass-panel rounded-2xl p-5 border border-white/10 hover:border-nexusCyan/50 transition-all group flex flex-col sm:flex-row gap-6 relative overflow-hidden">
                                {/* Decor */}
                                <div className="absolute top-0 right-0 w-32 h-32 bg-nexusPurple/10 blur-[50px] rounded-full group-hover:bg-nexusCyan/20 transition-colors pointer-events-none" />

                                <div className="flex items-center justify-center flex-shrink-0">
                                    <button
                                        onClick={() => handlePlay(track)}
                                        className="w-16 h-16 rounded-full bg-black border border-white/20 flex items-center justify-center text-white hover:text-nexusCyan hover:border-nexusCyan hover:shadow-[0_0_20px_rgba(34,211,238,0.4)] transition-all z-10"
                                    >
                                        <Play size={24} className="ml-1" />
                                    </button>
                                </div>

                                <div className="flex-1 min-w-0 z-10 flex flex-col justify-center">
                                    <div className="flex justify-between items-start mb-1">
                                        <h3 className="font-bold text-lg truncate pr-4">{track.title}</h3>
                                        <span className="text-xs font-mono text-gray-500 whitespace-nowrap">{track.date}</span>
                                    </div>
                                    <div className="flex items-center gap-3 mb-3">
                                        <span className="text-xs font-bold uppercase tracking-widest text-[#a855f7] bg-[#a855f7]/10 px-2 py-0.5 rounded border border-[#a855f7]/20">
                                            {track.style}
                                        </span>
                                        <span className="text-xs font-mono text-gray-400">{track.durationStr}</span>
                                    </div>

                                    {/* Mock Waveform */}
                                    <div className="h-8 flex items-end gap-1 w-full opacity-60 group-hover:opacity-100 transition-opacity">
                                        {[...Array(40)].map((_, i) => (
                                            <div
                                                key={i}
                                                className="w-1.5 bg-gradient-to-t from-nexusPurple to-nexusCyan rounded-t-sm"
                                                style={{ height: `${Math.max(20, Math.random() * 100)}%` }}
                                            />
                                        ))}
                                    </div>
                                </div>

                                <div className="flex sm:flex-col items-center justify-center gap-2 flex-shrink-0 z-10 border-t sm:border-t-0 sm:border-l border-white/10 pt-4 sm:pt-0 sm:pl-6 mt-4 sm:mt-0">
                                    <button className="w-full bg-white text-black font-bold text-xs uppercase tracking-widest py-2 px-4 rounded-xl hover:bg-nexusCyan hover:shadow-[0_0_15px_rgba(34,211,238,0.5)] transition-all">
                                        Publish
                                    </button>
                                    <button className="w-full bg-nexusPurple text-white font-bold text-xs uppercase tracking-widest py-2 px-4 rounded-xl hover:bg-pink-500 hover:shadow-[0_0_15px_rgba(168,85,247,0.5)] transition-all">
                                        Mint NFT
                                    </button>
                                    <div className="flex gap-2 w-full mt-1">
                                        <button className="flex-1 flex justify-center p-2 rounded-lg border border-white/10 hover:bg-white/10 text-gray-400 hover:text-white transition-colors">
                                            <Download size={16} />
                                        </button>
                                        <button className="flex-1 flex justify-center p-2 rounded-lg border border-white/10 hover:bg-white/10 text-gray-400 hover:text-white transition-colors">
                                            <Share2 size={16} />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))}

                        {generatedTracks.length === 0 && !generating && (
                            <div className="flex flex-col items-center justify-center h-full text-gray-500">
                                <Music size={48} className="mb-4 opacity-20" />
                                <p className="font-mono text-sm uppercase tracking-widest">No tracks generated yet</p>
                            </div>
                        )}
                    </div>
                </div>

            </div>
        </div>
    );
}
