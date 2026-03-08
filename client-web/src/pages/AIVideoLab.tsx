import React, { useState, useEffect, useCallback } from 'react';
import { Film, Sparkles, Loader2, Settings, ChevronRight, Upload, Camera, Image, SlidersHorizontal, Clock, AlertTriangle, RotateCcw, Play, Maximize, Ratio, Trash2, HardDrive, Check } from 'lucide-react';
import { getApiClient } from '../lib/apiClient';
import { useAuthStore } from '../stores';
import { useNavigate } from 'react-router-dom';
import { saveGeneration, getGenerationsByType, downloadToLocal, getBlobUrl, markPublished, deleteGeneration, type LocalGeneration } from '../lib/aiLocalStorage';

const STYLES = ['Cinematic', 'Anime', 'Photorealistic', 'Abstract', '3D Render', 'Watercolor', 'Pixel Art', 'Noir', 'Sci-Fi', 'Fantasy'];
const RESOLUTIONS = ['720p', '1080p', '4K'];
const RATIOS = [
    { label: '16:9', desc: 'Landscape' },
    { label: '9:16', desc: 'Portrait' },
    { label: '1:1', desc: 'Square' },
    { label: '4:3', desc: 'Classic' },
];
const CAMERAS = ['Static', 'Pan Left', 'Pan Right', 'Zoom In', 'Zoom Out', 'Tracking', 'Orbit', 'Dolly'];

export default function AIVideoLab() {
    const api = getApiClient();
    const navigate = useNavigate();
    const { isLoggedIn } = useAuthStore();

    // Provider
    const [providerReady, setProviderReady] = useState<boolean | null>(null);
    const [providerName, setProviderName] = useState('');

    // Inputs
    const [prompt, setPrompt] = useState('');
    const [negPrompt, setNegPrompt] = useState('');
    const [showAdvanced, setShowAdvanced] = useState(false);
    const [style, setStyle] = useState('');
    const [duration, setDuration] = useState(5);
    const [resolution, setResolution] = useState('1080p');
    const [ratio, setRatio] = useState('16:9');
    const [camera, setCamera] = useState('Static');
    const [seed, setSeed] = useState('');
    const [referenceImage, setReferenceImage] = useState<string | null>(null);

    // Generation
    const [generating, setGenerating] = useState(false);
    const [progress, setProgress] = useState(0);
    const [genError, setGenError] = useState('');

    // Result (local)
    const [currentGen, setCurrentGen] = useState<LocalGeneration | null>(null);
    const [localVideoUrl, setLocalVideoUrl] = useState<string | null>(null);

    // History (IndexedDB)
    const [history, setHistory] = useState<LocalGeneration[]>([]);

    // Publishing
    const [publishing, setPublishing] = useState(false);

    // ── Load local history ──────────────
    const loadHistory = useCallback(async () => {
        try {
            const gens = await getGenerationsByType('video', 30);
            setHistory(gens);
        } catch { }
    }, []);

    // ── Check provider & load history ──────────────
    useEffect(() => {
        if (!isLoggedIn) return;
        (async () => {
            try {
                const res = await api.get<any>('/ai/settings');
                const video = res?.video;
                if (video?.enabled && video?.apiKeyMasked) {
                    setProviderReady(true);
                    setProviderName(video.providerId || 'configured');
                } else {
                    setProviderReady(false);
                }
            } catch { setProviderReady(false); }
        })();
        loadHistory();
    }, [isLoggedIn]);

    const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = () => setReferenceImage(reader.result as string);
        reader.readAsDataURL(file);
    };

    // ── Generate Video (local-first) ──────────────
    const handleGenerate = useCallback(async () => {
        if (!prompt.trim()) return;
        setGenerating(true);
        setProgress(0);
        setGenError('');
        setCurrentGen(null);
        setLocalVideoUrl(null);

        const genId = `video-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        const localGen: LocalGeneration = {
            id: genId,
            type: 'video',
            status: 'processing',
            progress: 0,
            prompt: prompt.trim(),
            params: { style, duration, resolution, aspectRatio: ratio, camera, seed, negativePrompt: negPrompt },
            published: false,
            createdAt: Date.now(),
        };
        await saveGeneration(localGen);

        try {
            const res = await api.post<any>('/ai/generate', {
                type: 'video',
                prompt: `${localGen.prompt}${style ? `, ${style} style` : ''}${camera !== 'Static' ? `, camera: ${camera}` : ''}`,
                params: localGen.params,
            });

            const apiBase = (import.meta as any).env?.VITE_API_GATEWAY_URL || 'http://localhost:8080';
            const es = new EventSource(`${apiBase}/ai/task/${res.taskId}/stream`);

            es.onmessage = async (e) => {
                if (e.data === '[DONE]') { es.close(); return; }
                try {
                    const data = JSON.parse(e.data);
                    setProgress(data.progress || 0);
                    localGen.progress = data.progress || 0;

                    if (data.status === 'completed') {
                        es.close();
                        localGen.resultUrl = data.resultUrl;
                        localGen.resultMeta = data.resultMeta || {};
                        if (data.resultUrl) {
                            const blobKey = await downloadToLocal(data.resultUrl, genId, 'video/mp4');
                            if (blobKey) localGen.resultBlobKey = blobKey;
                        }
                        localGen.status = 'completed';
                        localGen.completedAt = Date.now();
                        await saveGeneration(localGen);
                        setCurrentGen({ ...localGen });
                        setGenerating(false);

                        if (localGen.resultBlobKey) {
                            setLocalVideoUrl(await getBlobUrl(localGen.resultBlobKey));
                        } else if (data.resultUrl) {
                            setLocalVideoUrl(data.resultUrl);
                        }
                        loadHistory();
                    } else if (data.status === 'failed') {
                        localGen.status = 'failed';
                        localGen.error = data.error || 'Failed';
                        await saveGeneration(localGen);
                        setGenError(localGen.error);
                        setGenerating(false);
                        loadHistory();
                        es.close();
                    }
                } catch { }
            };

            es.onerror = () => {
                const poll = setInterval(async () => {
                    try {
                        const status = await api.get<any>(`/ai/task/${res.taskId}`);
                        setProgress(status.progress || 0);
                        if (status.status === 'completed') {
                            clearInterval(poll);
                            localGen.resultUrl = status.resultUrl;
                            localGen.resultMeta = status.resultMeta || {};
                            if (status.resultUrl) {
                                const blobKey = await downloadToLocal(status.resultUrl, genId, 'video/mp4');
                                if (blobKey) localGen.resultBlobKey = blobKey;
                            }
                            localGen.status = 'completed';
                            localGen.completedAt = Date.now();
                            await saveGeneration(localGen);
                            setCurrentGen({ ...localGen });
                            setGenerating(false);
                            if (localGen.resultBlobKey) {
                                setLocalVideoUrl(await getBlobUrl(localGen.resultBlobKey));
                            } else if (status.resultUrl) {
                                setLocalVideoUrl(status.resultUrl);
                            }
                            loadHistory();
                        } else if (status.status === 'failed') {
                            clearInterval(poll);
                            localGen.status = 'failed';
                            localGen.error = status.error || 'Failed';
                            await saveGeneration(localGen);
                            setGenError(localGen.error);
                            setGenerating(false);
                            loadHistory();
                        }
                    } catch { }
                }, 5000);
                es.close();
            };
        } catch (err: any) {
            localGen.status = 'failed';
            localGen.error = err?.error || err?.message || 'Failed';
            await saveGeneration(localGen);
            setGenError(localGen.error);
            setGenerating(false);
            loadHistory();
        }
    }, [prompt, negPrompt, style, duration, resolution, ratio, camera, seed, referenceImage]);

    const loadHistoryItem = useCallback(async (gen: LocalGeneration) => {
        setCurrentGen(gen);
        if (gen.resultBlobKey) {
            setLocalVideoUrl(await getBlobUrl(gen.resultBlobKey));
        } else if (gen.resultUrl) {
            setLocalVideoUrl(gen.resultUrl);
        }
    }, []);

    const handlePublish = useCallback(async () => {
        if (!currentGen) return;
        setPublishing(true);
        try {
            const res = await api.post<any>('/content/upload', {
                type: 'video', title: currentGen.prompt.slice(0, 60),
                description: currentGen.prompt,
                sourceUrl: currentGen.resultUrl || '',
                style: currentGen.params?.style || '',
                resolution: currentGen.params?.resolution || '1080p',
                aiGenerated: true, aiProvider: providerName,
            });
            await markPublished(currentGen.id, res?.id || 'published');
            setCurrentGen(prev => prev ? { ...prev, published: true, publishedAt: Date.now() } : null);
            loadHistory();
        } catch (err: any) {
            alert('发布失败: ' + (err?.error || err?.message || ''));
        } finally { setPublishing(false); }
    }, [currentGen, providerName]);

    const handleDelete = useCallback(async (id: string) => {
        await deleteGeneration(id);
        if (currentGen?.id === id) { setCurrentGen(null); setLocalVideoUrl(null); }
        loadHistory();
    }, [currentGen]);

    // ── Provider not configured ──────────────
    if (providerReady === false) {
        return (
            <div className="min-h-screen bg-[#0a0a12] text-white p-8 flex items-center justify-center">
                <div className="text-center max-w-lg">
                    <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-cyan-500/20 to-blue-600/20 flex items-center justify-center mx-auto mb-6">
                        <Film size={36} className="text-cyan-400" />
                    </div>
                    <h2 className="text-2xl font-bold mb-3">Video AI Provider Not Configured</h2>
                    <p className="text-gray-400 mb-6">Configure a video AI provider (like Runway or Kling) with your API key.</p>
                    <button onClick={() => navigate('/settings/ai')}
                        className="px-6 py-3 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-bold hover:brightness-110 flex items-center gap-2 mx-auto">
                        <Settings size={16} /> Configure AI Provider
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[#0a0a12] text-white p-6 md:p-10 font-sans pb-32">
            <div className="max-w-[1600px] mx-auto">
                {/* Header */}
                <div className="flex items-center gap-2 text-cyan-400 mb-4">
                    <Sparkles size={16} />
                    <span className="font-mono text-xs uppercase tracking-widest font-bold">
                        AI Studio <ChevronRight size={12} className="inline" /> Video Lab
                    </span>
                    <span className="ml-auto flex items-center gap-3">
                        <span className="text-xs bg-white/5 border border-white/10 px-3 py-1 rounded-full text-gray-400 font-mono flex items-center gap-1">
                            <HardDrive size={10} /> Local Storage
                        </span>
                        {providerName && (
                            <span className="text-xs bg-cyan-500/10 border border-cyan-500/20 px-3 py-1 rounded-full text-cyan-400 font-mono">
                                Provider: {providerName}
                            </span>
                        )}
                    </span>
                </div>
                <h1 className="text-3xl font-black mb-8">
                    <span className="bg-gradient-to-r from-cyan-400 to-blue-500 text-transparent bg-clip-text">AI Video Generation</span>
                </h1>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    {/* Left: Controls */}
                    <div className="space-y-6">
                        {/* Prompt */}
                        <div className="bg-[#12121e] rounded-2xl p-6 border border-white/5">
                            <label className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3 block flex items-center gap-2">
                                <Camera size={12} /> Scene Description
                            </label>
                            <textarea value={prompt} onChange={e => setPrompt(e.target.value)} rows={4}
                                placeholder="Describe the video scene... e.g. 'A futuristic city at night with neon lights reflecting on wet streets'"
                                className="w-full bg-black/50 border border-white/10 rounded-xl p-4 text-sm text-white resize-none outline-none focus:border-cyan-500 placeholder-gray-600" />
                        </div>

                        {/* Reference Image */}
                        <div className="bg-[#12121e] rounded-2xl p-6 border border-white/5">
                            <label className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3 block flex items-center gap-2">
                                <Image size={12} /> Reference Image (Optional)
                            </label>
                            {referenceImage ? (
                                <div className="relative">
                                    <img src={referenceImage} alt="ref" className="w-full h-32 object-cover rounded-xl" />
                                    <button onClick={() => setReferenceImage(null)} className="absolute top-2 right-2 bg-red-500 rounded-full w-6 h-6 flex items-center justify-center text-xs">✕</button>
                                </div>
                            ) : (
                                <label className="flex flex-col items-center gap-2 border-2 border-dashed border-white/10 rounded-xl p-8 cursor-pointer hover:border-cyan-500/30 transition-colors">
                                    <Image size={24} className="text-gray-600" />
                                    <span className="text-xs text-gray-500">Drop image or click to upload</span>
                                    <input type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
                                </label>
                            )}
                        </div>

                        {/* Style */}
                        <div className="bg-[#12121e] rounded-2xl p-6 border border-white/5">
                            <label className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3 block">Visual Style</label>
                            <div className="flex flex-wrap gap-2">
                                {STYLES.map(s => (
                                    <button key={s} onClick={() => setStyle(style === s ? '' : s)}
                                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${style === s ? 'bg-cyan-500 text-white shadow-[0_0_12px_rgba(6,182,212,0.4)]' : 'bg-white/5 text-gray-400 hover:bg-white/10'}`}>
                                        {s}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Duration / Resolution / Ratio / Camera */}
                        <div className="bg-[#12121e] rounded-2xl p-6 border border-white/5 grid grid-cols-2 gap-6">
                            <div>
                                <label className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2 block flex items-center gap-1">
                                    <Clock size={12} /> Duration: {duration}s
                                </label>
                                <input type="range" min={5} max={60} step={5} value={duration}
                                    onChange={e => setDuration(Number(e.target.value))} className="w-full accent-cyan-500" />
                            </div>
                            <div>
                                <label className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2 block flex items-center gap-1">
                                    <Maximize size={12} /> Resolution
                                </label>
                                <div className="flex gap-2">
                                    {RESOLUTIONS.map(r => (
                                        <button key={r} onClick={() => setResolution(r)}
                                            className={`px-3 py-1.5 rounded-lg text-xs font-bold flex-1 transition-all ${resolution === r ? 'bg-cyan-500 text-white' : 'bg-white/5 text-gray-400'}`}>{r}</button>
                                    ))}
                                </div>
                            </div>
                            <div>
                                <label className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2 block flex items-center gap-1">
                                    <Ratio size={12} /> Aspect Ratio
                                </label>
                                <div className="flex gap-2">
                                    {RATIOS.map(r => (
                                        <button key={r.label} onClick={() => setRatio(r.label)}
                                            className={`px-2 py-1.5 rounded-lg text-xs font-bold flex-1 transition-all ${ratio === r.label ? 'bg-cyan-500 text-white' : 'bg-white/5 text-gray-400'}`}>{r.label}</button>
                                    ))}
                                </div>
                            </div>
                            <div>
                                <label className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2 block">Camera Motion</label>
                                <select value={camera} onChange={e => setCamera(e.target.value)}
                                    className="w-full bg-black/50 border border-white/10 rounded-xl p-2.5 text-sm text-white outline-none">
                                    {CAMERAS.map(c => <option key={c} value={c} className="bg-gray-900">{c}</option>)}
                                </select>
                            </div>
                        </div>

                        {/* Advanced */}
                        <button onClick={() => setShowAdvanced(!showAdvanced)}
                            className="text-xs text-cyan-400 hover:text-cyan-300 flex items-center gap-1 font-bold">
                            <SlidersHorizontal size={12} /> {showAdvanced ? 'Hide' : 'Show'} Advanced
                        </button>
                        {showAdvanced && (
                            <div className="bg-[#12121e] rounded-2xl p-6 border border-white/5 space-y-4">
                                <div>
                                    <label className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2 block">Negative Prompt</label>
                                    <textarea value={negPrompt} onChange={e => setNegPrompt(e.target.value)} rows={2} placeholder="What to avoid..."
                                        className="w-full bg-black/50 border border-white/10 rounded-xl p-3 text-sm text-white resize-none outline-none focus:border-cyan-500 placeholder-gray-600" />
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2 block">Seed</label>
                                    <input type="number" value={seed} onChange={e => setSeed(e.target.value)} placeholder="Random"
                                        className="w-full bg-black/50 border border-white/10 rounded-xl p-3 text-sm text-white outline-none" />
                                </div>
                            </div>
                        )}

                        {/* Generate */}
                        <button onClick={handleGenerate} disabled={generating || !prompt.trim()}
                            className="w-full py-4 rounded-xl font-bold text-lg bg-gradient-to-r from-cyan-500 to-blue-600 text-white hover:brightness-110 transition-all shadow-[0_0_30px_rgba(6,182,212,0.3)] disabled:opacity-50 flex items-center justify-center gap-3 uppercase tracking-widest">
                            {generating ? <><Loader2 size={20} className="animate-spin" /> Generating... {progress}%</> : <><Sparkles size={20} /> Generate Video</>}
                        </button>
                        {generating && (
                            <div className="w-full bg-white/5 rounded-full h-2 overflow-hidden">
                                <div className="h-full bg-gradient-to-r from-cyan-500 to-blue-600 transition-all duration-500 rounded-full" style={{ width: `${progress}%` }} />
                            </div>
                        )}
                        {genError && (
                            <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 text-red-400 text-sm flex items-center gap-2">
                                <AlertTriangle size={16} /> {genError}
                            </div>
                        )}
                    </div>

                    {/* Right: Output */}
                    <div className="space-y-6">
                        <div className="bg-[#12121e] rounded-2xl p-6 border border-white/5 min-h-[400px]">
                            <h3 className="font-bold text-lg mb-4 flex items-center gap-2">
                                <Film size={16} className="text-cyan-400" /> Generated Video
                                {currentGen && (
                                    <span className="ml-auto text-xs font-mono text-gray-500 flex items-center gap-1">
                                        <HardDrive size={10} /> Stored Locally
                                    </span>
                                )}
                            </h3>

                            {currentGen && localVideoUrl ? (
                                <div className="space-y-4">
                                    <video src={localVideoUrl} controls autoPlay
                                        className="w-full rounded-xl bg-black"
                                        style={{ aspectRatio: ratio.replace(':', '/') }} />
                                    <div className="flex items-center justify-between text-xs text-gray-500 font-mono">
                                        <span>{currentGen.params?.resolution || '1080p'}</span>
                                        <span>{currentGen.params?.aspectRatio || '16:9'}</span>
                                        <span>{currentGen.params?.duration || 5}s</span>
                                    </div>

                                    {currentGen.published ? (
                                        <div className="w-full py-3 rounded-xl bg-green-500/10 border border-green-500/20 text-green-400 text-center font-bold text-sm flex items-center justify-center gap-2">
                                            <Check size={14} /> Published to Nexus
                                        </div>
                                    ) : (
                                        <button onClick={handlePublish} disabled={publishing}
                                            className="w-full py-3 rounded-xl bg-gradient-to-r from-green-500 to-emerald-600 text-white font-bold text-sm hover:brightness-110 flex items-center justify-center gap-2 uppercase tracking-wider disabled:opacity-50">
                                            {publishing ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
                                            {publishing ? 'Publishing...' : 'Publish to Nexus'}
                                        </button>
                                    )}

                                    <p className="text-[10px] text-gray-600 font-mono text-center">
                                        ℹ️ This video is stored in your browser. It will be uploaded to platform storage only when you publish.
                                    </p>
                                </div>
                            ) : (
                                <div className="flex items-center justify-center h-64 text-gray-600">
                                    <div className="text-center">
                                        <Film size={48} className="mx-auto mb-3 opacity-30" />
                                        <p className="text-sm mb-1">Your generated video will appear here</p>
                                        <p className="text-xs text-gray-700">Stored locally until published</p>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* History */}
                        <div className="bg-[#12121e] rounded-2xl p-6 border border-white/5">
                            <h3 className="font-bold text-sm mb-4 flex items-center gap-2 text-gray-400 uppercase tracking-wider">
                                <RotateCcw size={14} /> Local History ({history.length})
                            </h3>
                            {history.length === 0 ? (
                                <p className="text-gray-600 text-sm text-center py-4">No videos generated yet</p>
                            ) : (
                                <div className="space-y-2 max-h-48 overflow-y-auto">
                                    {history.map((h) => (
                                        <div key={h.id} className="flex items-center gap-3 p-3 rounded-xl bg-black/20 hover:bg-black/40 transition-colors group">
                                            <button onClick={() => h.status === 'completed' && loadHistoryItem(h)}
                                                className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs flex-shrink-0 ${h.status === 'completed' ? 'bg-green-500/20 text-green-400 cursor-pointer' : 'bg-gray-500/20 text-gray-400'}`}>
                                                {h.status === 'completed' ? <Play size={12} /> : <Clock size={12} />}
                                            </button>
                                            <div className="flex-1 min-w-0 cursor-pointer" onClick={() => h.status === 'completed' && loadHistoryItem(h)}>
                                                <p className="text-sm font-bold truncate">{h.prompt}</p>
                                                <div className="flex items-center gap-2 text-xs text-gray-500 font-mono">
                                                    <span>{new Date(h.createdAt).toLocaleDateString()}</span>
                                                    {h.published && <span className="text-green-500">• Published</span>}
                                                </div>
                                            </div>
                                            <button onClick={() => handleDelete(h.id)}
                                                className="opacity-0 group-hover:opacity-100 text-gray-600 hover:text-red-400 transition-all p-1">
                                                <Trash2 size={12} />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
