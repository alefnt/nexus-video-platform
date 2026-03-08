import React, { useState } from 'react';
import { Play, Pause, Maximize, UploadCloud, Film, Image as ImageIcon, Music, Type, Settings, Sparkles, Wand2, Download, Share2, Plus, Clock, SkipBack, SkipForward, ArrowRight } from 'lucide-react';

export default function AIVideoLab() {
    const [prompt, setPrompt] = useState("");
    const [style, setStyle] = useState("Cinematic");
    const [resolution, setResolution] = useState("1080p");
    const [duration, setDuration] = useState("15s");
    const [aspectRatio, setAspectRatio] = useState("16:9");
    const [generating, setGenerating] = useState(false);
    const [isPlaying, setIsPlaying] = useState(false);

    const [clips, setClips] = useState([
        { id: '1', name: 'Scene 1: Intro', duration: '5s', status: 'ready', selected: true },
        { id: '2', name: 'Scene 2: Action', duration: '10s', status: 'ready', selected: false }
    ]);

    const styles = ["Cinematic", "Anime", "Documentary", "Music Video", "Product Demo", "Vlog", "Abstract", "3D Render"];
    const resolutions = ["720p", "1080p", "4K"];
    const durations = ["5s", "10s", "15s", "30s"];
    const ratios = ["16:9", "9:16", "1:1"];

    const handleGenerate = () => {
        if (!prompt) return;
        setGenerating(true);
        setTimeout(() => {
            setGenerating(false);
            setClips([...clips.map(c => ({ ...c, selected: false })), { id: Date.now().toString(), name: `Scene ${clips.length + 1}: ${style}`, duration: duration, status: 'ready', selected: true }]);
            setPrompt("");
        }, 3000);
    };

    return (
        <div className="min-h-screen bg-[#08080c] text-white p-6 md:p-8 font-sans pb-24">
            <div className="max-w-[1800px] mx-auto h-[calc(100vh-100px)] flex flex-col gap-6">

                {/* Top Header */}
                <div className="flex items-center justify-between">
                    <div>
                        <div className="flex items-center gap-2 text-nexusCyan mb-1">
                            <Sparkles size={16} />
                            <span className="font-mono text-xs uppercase tracking-widest font-bold">Creator Studio &gt; AI Lab</span>
                        </div>
                        <h1 className="text-3xl font-black tracking-tight flex items-center gap-3">
                            AI Video <span className="text-transparent bg-clip-text bg-gradient-to-r from-nexusCyan to-blue-500">Director</span>
                        </h1>
                    </div>
                    <div className="flex gap-3">
                        <button className="px-4 py-2 font-bold text-sm bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg flex items-center gap-2 transition-colors">
                            <UploadCloud size={16} /> Save Project
                        </button>
                    </div>
                </div>

                <div className="flex-1 flex flex-col lg:flex-row gap-6 min-h-0">

                    {/* Left/Top: Prompt Zone & Player */}
                    <div className="flex-1 flex flex-col gap-6 min-w-0">

                        {/* Prompt Zone */}
                        <div className="glass-panel rounded-2xl border border-white/5 p-5 bg-gradient-to-br from-white/[0.02] to-transparent">
                            <div className="flex flex-col xl:flex-row gap-6">
                                {/* Prompt Input & Style */}
                                <div className="flex-1 flex flex-col gap-4">
                                    <textarea
                                        className="w-full bg-black/50 border border-white/10 rounded-xl p-4 text-sm text-white focus:border-nexusCyan focus:ring-1 focus:ring-nexusCyan outline-none resize-none h-24"
                                        placeholder="Describe your video scene in detail... (e.g., 'A cyberpunk city alleyway at night in pouring rain, neon reflections on the puddles, cinematic lighting, tracking shot forward')"
                                        value={prompt}
                                        onChange={(e) => setPrompt(e.target.value)}
                                    />
                                    <div className="flex items-center gap-2 overflow-x-auto hide-scrollbar pb-1">
                                        <span className="text-xs font-bold text-gray-500 uppercase tracking-widest mr-2 flex-shrink-0">Style:</span>
                                        {styles.map(s => (
                                            <button
                                                key={s} onClick={() => setStyle(s)}
                                                className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-bold transition-all border ${style === s ? 'bg-nexusCyan/20 text-nexusCyan border-nexusCyan' : 'bg-transparent text-gray-400 border-white/10 hover:border-white/20 hover:text-white'}`}
                                            >
                                                {s}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {/* Settings & Render */}
                                <div className="w-full xl:w-72 flex flex-col gap-4">
                                    <div className="grid grid-cols-2 gap-3">
                                        <select value={resolution} onChange={e => setResolution(e.target.value)} className="bg-black/50 border border-white/10 rounded-lg p-2 text-xs font-bold font-mono text-gray-300 outline-none focus:border-nexusCyan">
                                            {resolutions.map(r => <option key={r} value={r}>{r}</option>)}
                                        </select>
                                        <select value={duration} onChange={e => setDuration(e.target.value)} className="bg-black/50 border border-white/10 rounded-lg p-2 text-xs font-bold font-mono text-gray-300 outline-none focus:border-nexusCyan">
                                            {durations.map(r => <option key={r} value={r}>{r}</option>)}
                                        </select>
                                    </div>
                                    <div className="flex gap-2">
                                        {ratios.map(r => (
                                            <button key={r} onClick={() => setAspectRatio(r)} className={`flex-1 py-1.5 rounded border text-xs font-bold font-mono transition-colors ${aspectRatio === r ? 'bg-white/10 border-white/30 text-white' : 'border-white/5 text-gray-500 hover:text-gray-300'}`}>
                                                {r}
                                            </button>
                                        ))}
                                    </div>
                                    <button
                                        onClick={handleGenerate}
                                        disabled={generating || !prompt}
                                        className={`w-full py-3 rounded-xl font-black text-sm uppercase tracking-wider flex justify-center items-center gap-2 transition-all shadow-[0_0_15px_rgba(34,211,238,0.2)] ${generating ? 'bg-gray-800 text-gray-500 cursor-not-allowed border border-white/10' : !prompt ? 'bg-nexusCyan/30 text-white/50 cursor-not-allowed border border-nexusCyan/30' : 'bg-gradient-to-r from-nexusCyan to-blue-600 text-white hover:brightness-110'}`}
                                    >
                                        {generating ? <><Sparkles className="animate-spin" size={16} /> Rendering...</> : <><Film size={16} /> Generate Scene</>}
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* Video Player Workspace */}
                        <div className="flex-1 glass-panel rounded-2xl border border-white/5 overflow-hidden flex flex-col min-h-[300px] relative bg-black">
                            <div className="flex-1 relative flex items-center justify-center">
                                {/* Mock Video Area */}
                                {generating ? (
                                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 backdrop-blur-sm z-10">
                                        <div className="w-16 h-16 border-4 border-nexusCyan/20 border-t-nexusCyan rounded-full animate-spin mb-4" />
                                        <p className="font-mono text-nexusCyan text-sm font-bold tracking-widest uppercase animate-pulse">Synthesizing Pixels</p>
                                    </div>
                                ) : (
                                    <div className="w-full h-full bg-gradient-to-br from-[#1a1a24] to-black flex items-center justify-center relative group">
                                        <img src="https://images.unsplash.com/photo-1536440136628-849c177e76a1?q=80&w=2000" alt="Video Preview" className="absolute inset-0 w-full h-full object-cover opacity-60" />
                                        <div className="absolute inset-0 bg-black/20 group-hover:bg-black/40 transition-colors" />
                                        <button
                                            onClick={() => setIsPlaying(!isPlaying)}
                                            className="w-20 h-20 rounded-full bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center text-white hover:bg-nexusCyan hover:border-nexusCyan hover:scale-110 transition-all z-10 shadow-[0_0_30px_rgba(0,0,0,0.5)]"
                                        >
                                            {isPlaying ? <Pause size={32} /> : <Play size={32} className="ml-2" />}
                                        </button>
                                    </div>
                                )}
                            </div>

                            {/* Player Controls */}
                            <div className="h-12 bg-[#0c0c11] border-t border-white/5 px-4 flex items-center justify-between z-20">
                                <div className="flex items-center gap-4">
                                    <button className="text-gray-400 hover:text-white transition-colors"><SkipBack size={18} /></button>
                                    <button onClick={() => setIsPlaying(!isPlaying)} className="text-white hover:text-nexusCyan transition-colors">
                                        {isPlaying ? <Pause size={20} /> : <Play size={20} />}
                                    </button>
                                    <button className="text-gray-400 hover:text-white transition-colors"><SkipForward size={18} /></button>
                                    <span className="font-mono text-xs text-gray-500 ml-2">00:00:00 / 00:00:15</span>
                                </div>
                                <button className="text-gray-400 hover:text-white transition-colors"><Maximize size={18} /></button>
                            </div>
                        </div>

                        {/* Generated Clips Timeline */}
                        <div className="h-32 glass-panel rounded-2xl border border-white/5 p-3 flex flex-col">
                            <div className="flex justify-between items-center mb-2 px-1">
                                <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest flex items-center gap-2"><Clock size={12} /> Timeline Sequence</h3>
                                <button className="text-[10px] font-mono text-nexusCyan border border-nexusCyan/30 bg-nexusCyan/10 px-2 py-0.5 rounded leading-none flex items-center gap-1 hover:bg-nexusCyan hover:text-black transition-colors">
                                    <Plus size={10} /> Add Track
                                </button>
                            </div>
                            <div className="flex-1 flex gap-2 overflow-x-auto hide-scrollbar items-center pb-1">
                                {clips.map((clip, i) => (
                                    <div key={clip.id} className="flex items-center gap-2">
                                        <div className={`relative w-40 h-16 rounded-lg overflow-hidden border-2 cursor-pointer transition-all ${clip.selected ? 'border-nexusCyan brightness-110' : 'border-white/10 brightness-75 hover:brightness-100 hover:border-white/30'}`}>
                                            <div className="absolute inset-0 bg-gradient-to-r from-blue-900 to-purple-900 opacity-50" />
                                            <div className="absolute bottom-1 left-2 select-none">
                                                <p className="text-[10px] font-bold text-white shadow-black drop-shadow-md truncate w-32">{clip.name}</p>
                                            </div>
                                            <div className="absolute top-1 right-1 bg-black/60 backdrop-blur-md rounded px-1.5 py-0.5 text-[8px] font-mono text-gray-300">
                                                {clip.duration}
                                            </div>
                                        </div>
                                        {i < clips.length - 1 && <ArrowRight size={14} className="text-white/20 flex-shrink-0" />}
                                    </div>
                                ))}
                            </div>
                        </div>

                    </div>

                    {/* Right Panel: Post-Production */}
                    <div className="w-full lg:w-80 flex-shrink-0 flex flex-col gap-4">
                        <div className="glass-panel flex-1 rounded-2xl border border-white/5 p-5 flex flex-col relative overflow-hidden">
                            <div className="absolute top-0 right-0 w-32 h-32 bg-nexusCyan/5 blur-[50px] pointer-events-none" />

                            <h2 className="text-lg font-bold flex items-center gap-2 mb-6 border-b border-white/10 pb-4">
                                <Settings size={18} className="text-gray-400" /> Post-Production
                            </h2>

                            <div className="space-y-6 flex-1 overflow-y-auto hide-scrollbar">
                                {/* Tools */}
                                <div>
                                    <label className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-3 block">Enhance</label>
                                    <div className="grid grid-cols-2 gap-2">
                                        <button className="flex flex-col items-center justify-center gap-2 bg-white/5 hover:bg-white/10 border border-white/5 rounded-xl py-4 text-xs font-bold text-gray-300 transition-colors">
                                            <Type size={18} className="text-blue-400" /> Subtitles
                                        </button>
                                        <button className="flex flex-col items-center justify-center gap-2 bg-white/5 hover:bg-white/10 border border-white/5 rounded-xl py-4 text-xs font-bold text-gray-300 transition-colors">
                                            <Music size={18} className="text-purple-400" /> Audio
                                        </button>
                                        <button className="flex flex-col items-center justify-center gap-2 bg-white/5 hover:bg-white/10 border border-white/5 rounded-xl py-4 text-xs font-bold text-gray-300 transition-colors">
                                            <Sparkles size={18} className="text-nexusCyan" /> VFX
                                        </button>
                                        <button className="flex flex-col items-center justify-center gap-2 bg-white/5 hover:bg-white/10 border border-white/5 rounded-xl py-4 text-xs font-bold text-gray-300 transition-colors">
                                            <ImageIcon size={18} className="text-pink-400" /> Overlays
                                        </button>
                                    </div>
                                </div>

                                <div className="h-px bg-white/5 w-full" />

                                {/* Reference Image */}
                                <div>
                                    <label className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-3 block">Image Reference</label>
                                    <div className="w-full h-24 rounded-xl border border-dashed border-white/20 bg-black/30 flex flex-col items-center justify-center text-gray-500 hover:text-white hover:border-nexusCyan/50 hover:bg-nexusCyan/5 transition-all cursor-pointer group">
                                        <UploadCloud size={20} className="mb-2 group-hover:-translate-y-1 transition-transform" />
                                        <span className="text-xs font-mono">Drop image here</span>
                                    </div>
                                </div>
                            </div>

                            {/* Export Actions */}
                            <div className="pt-4 border-t border-white/10 mt-auto flex flex-col gap-2 relative z-10">
                                <button className="w-full bg-white text-black font-black text-sm uppercase tracking-wider py-3.5 rounded-xl hover:bg-gray-200 transition-colors flex items-center justify-center gap-2 shadow-[0_0_15px_rgba(255,255,255,0.2)]">
                                    <Share2 size={16} /> Publish to Nexus
                                </button>
                                <div className="grid grid-cols-2 gap-2">
                                    <button className="flex items-center justify-center gap-2 bg-blue-600/20 text-blue-400 border border-blue-600/30 hover:bg-blue-600/30 py-2 rounded-lg text-xs font-bold transition-colors">
                                        <Globe size={14} className="lucide-globe" /> Cross-Post
                                    </button>
                                    <button className="flex items-center justify-center gap-2 bg-white/5 text-gray-300 border border-white/10 hover:bg-white/10 py-2 rounded-lg text-xs font-bold transition-colors">
                                        <Download size={14} /> Export MP4
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

// Quick inline icon replacing Globe since it wasn't imported from lucide
function Globe(props: any) {
    return (
        <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" /><line x1="2" y1="12" x2="22" y2="12" /><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
        </svg>
    )
}
