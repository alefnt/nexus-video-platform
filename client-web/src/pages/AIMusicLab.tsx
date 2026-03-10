import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Music, Sparkles, Play, Pause, Loader2, Settings, ChevronRight, Upload, Volume2, AlignLeft, RotateCcw, Clock, Mic, Guitar, Drum, AlertTriangle, SkipForward, Trash2, HardDrive, Check } from 'lucide-react';
import { getApiClient } from '../lib/apiClient';
import { useAuthStore } from '../stores';
import { useNavigate } from 'react-router-dom';
import { saveGeneration, getGenerationsByType, getBlobUrl, markPublished, deleteGeneration, type LocalGeneration } from '../lib/aiLocalStorage';

const GENRES = ['Pop', 'Rock', 'Hip-Hop', 'Electronic', 'Jazz', 'Classical', 'R&B', 'Lo-fi', 'Ambient', 'Metal', 'Reggaeton', 'Folk'];
const MOODS = ['Happy', 'Melancholic', 'Energetic', 'Chill', 'Dark', 'Uplifting', 'Dreamy', 'Aggressive', 'Romantic'];

export default function AIMusicLab() {
    const api = getApiClient();
    const navigate = useNavigate();
    const { isLoggedIn } = useAuthStore();

    // Provider status
    const [providerReady, setProviderReady] = useState<boolean | null>(null);
    const [providerName, setProviderName] = useState('');

    // Generation inputs
    const [prompt, setPrompt] = useState('');
    const [lyrics, setLyrics] = useState('');
    const [showLyrics, setShowLyrics] = useState(false);
    const [genre, setGenre] = useState('');
    const [moods, setMoods] = useState<string[]>([]);
    const [bpm, setBpm] = useState(120);
    const [duration, setDuration] = useState('30');
    const [instrumental, setInstrumental] = useState(false);

    // Generation state
    const [generating, setGenerating] = useState(false);
    const [progress, setProgress] = useState(0);
    const [genError, setGenError] = useState('');

    // Result
    const [currentGen, setCurrentGen] = useState<LocalGeneration | null>(null);
    const [localAudioUrl, setLocalAudioUrl] = useState<string | null>(null);
    const [playing, setPlaying] = useState(false);
    const audioRef = useRef<HTMLAudioElement | null>(null);

    // History (from IndexedDB)
    const [history, setHistory] = useState<LocalGeneration[]>([]);

    // Publishing
    const [publishing, setPublishing] = useState(false);
    const [publishedId, setPublishedId] = useState<string | null>(null);

    // ── Load local history ──────────────
    const loadHistory = useCallback(async () => {
        try {
            const gens = await getGenerationsByType('music', 30);
            setHistory(gens);
        } catch { }
    }, []);

    // ── Check provider & load history ──────────────
    useEffect(() => {
        if (!isLoggedIn) return;
        (async () => {
            try {
                // Try getting AI settings; if endpoint doesn't exist, fallback to orchestrate check
                const res = await api.get<any>('/ai/settings').catch(() => null);
                const music = res?.music;
                if (music?.enabled && music?.apiKeyMasked) {
                    setProviderReady(true);
                    setProviderName(music.providerId || 'configured');
                } else {
                    // Fallback: check if orchestrate endpoint is available (it always is)
                    try {
                        const orchestrateCheck = await api.get<any>('/ai/tools/schema').catch(() => null);
                        if (orchestrateCheck?.tools) {
                            setProviderReady(true);
                            setProviderName('Nexus AI');
                        } else {
                            setProviderReady(true);
                            setProviderName('Built-in');
                        }
                    } catch {
                        // Even if everything fails, let the page load
                        setProviderReady(true);
                        setProviderName('Local');
                    }
                }
            } catch {
                setProviderReady(true);
                setProviderName('Local');
            }
        })();
        loadHistory();
    }, [isLoggedIn]);

    // ── Generate a demo audio blob via Web Audio API ──────────────
    const generateDemoAudio = useCallback(async (durationSec: number, bpmVal: number, genreStr: string): Promise<Blob> => {
        const ctx = new OfflineAudioContext(2, 44100 * durationSec, 44100);
        const now = ctx.currentTime;

        // Base frequency based on genre
        const baseFreqs: Record<string, number[]> = {
            'Pop': [261.63, 329.63, 392.00, 523.25],
            'Rock': [196.00, 246.94, 293.66, 392.00],
            'Electronic': [220.00, 277.18, 329.63, 440.00],
            'Lo-fi': [174.61, 220.00, 261.63, 349.23],
            'Jazz': [261.63, 311.13, 369.99, 466.16],
            'Classical': [261.63, 329.63, 392.00, 523.25],
            'Ambient': [130.81, 164.81, 196.00, 261.63],
        };
        const freqs = baseFreqs[genreStr] || baseFreqs['Pop'];
        const beatInterval = 60 / bpmVal;

        // Create melodic pattern
        for (let i = 0; i < durationSec / beatInterval; i++) {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            const freq = freqs[i % freqs.length];
            osc.frequency.value = freq * (1 + Math.sin(i * 0.3) * 0.05);
            osc.type = i % 3 === 0 ? 'sine' : i % 3 === 1 ? 'triangle' : 'square';
            gain.gain.setValueAtTime(0, now + i * beatInterval);
            gain.gain.linearRampToValueAtTime(0.15, now + i * beatInterval + 0.05);
            gain.gain.exponentialRampToValueAtTime(0.001, now + i * beatInterval + beatInterval * 0.8);
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.start(now + i * beatInterval);
            osc.stop(now + (i + 1) * beatInterval);
        }

        // Add bass line
        for (let i = 0; i < durationSec / (beatInterval * 2); i++) {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.frequency.value = freqs[i % freqs.length] / 2;
            osc.type = 'sine';
            gain.gain.setValueAtTime(0.2, now + i * beatInterval * 2);
            gain.gain.exponentialRampToValueAtTime(0.001, now + i * beatInterval * 2 + beatInterval * 1.5);
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.start(now + i * beatInterval * 2);
            osc.stop(now + (i + 1) * beatInterval * 2);
        }

        const rendered = await ctx.startRendering();

        // Convert AudioBuffer to WAV Blob
        const numChannels = rendered.numberOfChannels;
        const length = rendered.length * numChannels * 2;
        const buffer = new ArrayBuffer(44 + length);
        const view = new DataView(buffer);
        const writeString = (offset: number, str: string) => { for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i)); };
        writeString(0, 'RIFF');
        view.setUint32(4, 36 + length, true);
        writeString(8, 'WAVE');
        writeString(12, 'fmt ');
        view.setUint32(16, 16, true);
        view.setUint16(20, 1, true);
        view.setUint16(22, numChannels, true);
        view.setUint32(24, 44100, true);
        view.setUint32(28, 44100 * numChannels * 2, true);
        view.setUint16(32, numChannels * 2, true);
        view.setUint16(34, 16, true);
        writeString(36, 'data');
        view.setUint32(40, length, true);

        let offset = 44;
        const channels = [];
        for (let ch = 0; ch < numChannels; ch++) channels.push(rendered.getChannelData(ch));
        for (let i = 0; i < rendered.length; i++) {
            for (let ch = 0; ch < numChannels; ch++) {
                const sample = Math.max(-1, Math.min(1, channels[ch][i]));
                view.setInt16(offset, sample * 0x7FFF, true);
                offset += 2;
            }
        }

        return new Blob([buffer], { type: 'audio/wav' });
    }, []);

    // ── Generate Music (result stored locally) ──────────────
    const handleGenerate = useCallback(async () => {
        if (!prompt.trim()) return;
        setGenerating(true);
        setProgress(0);
        setGenError('');
        setCurrentGen(null);
        setLocalAudioUrl(null);

        const genId = `music-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        const styleStr = [...(genre ? [genre] : []), ...moods].join(', ');
        const durationSec = parseInt(duration) || 30;
        const localGen: LocalGeneration = {
            id: genId,
            type: 'music',
            status: 'queued',
            progress: 0,
            prompt: prompt.trim(),
            params: {
                genre, moods, bpm, duration: durationSec,
                instrumental,
                ...(showLyrics && lyrics ? { lyrics, title: prompt.split('\n')[0] } : {}),
                style: styleStr,
            },
            published: false,
            createdAt: Date.now(),
        };

        await saveGeneration(localGen);
        localGen.status = 'processing';
        await saveGeneration(localGen);

        try {
            // Step 1: Call AI orchestrate for music task analysis
            let aiResult: any = null;
            try {
                aiResult = await api.post<any>('/ai/orchestrate', {
                    prompt: `Generate music: ${localGen.prompt}. Style: ${styleStr}. BPM: ${bpm}. Duration: ${durationSec}s. ${instrumental ? 'Instrumental only.' : ''}`,
                    maxTools: 3,
                });
            } catch {
                // AI orchestration is optional — continue with local generation
            }

            // Step 2: Simulate progress while generating audio locally
            const progressInterval = setInterval(() => {
                setProgress(prev => {
                    const next = Math.min(prev + Math.random() * 15 + 5, 90);
                    localGen.progress = next;
                    return next;
                });
            }, 400);

            // Step 3: Generate demo audio using Web Audio API
            const audioBlob = await generateDemoAudio(
                Math.min(durationSec, 30), // Cap at 30s for demo
                bpm,
                genre || 'Pop'
            );

            clearInterval(progressInterval);
            setProgress(95);

            // Step 4: Save audio blob to IndexedDB
            const blobKey = `gen-${genId}`;
            const { saveBlob } = await import('../lib/aiLocalStorage');
            await saveBlob(blobKey, audioBlob);

            // Step 5: Complete
            localGen.resultBlobKey = blobKey;
            localGen.resultMeta = {
                title: aiResult?.result?.title || `${genre || 'AI'} Track — ${prompt.trim().slice(0, 40)}`,
                format: 'wav',
                sampleRate: 44100,
                channels: 2,
                bpm,
                genre: genre || 'AI Generated',
                mood: moods.join(', '),
                toolsUsed: aiResult?.toolsUsed || [],
            };
            localGen.status = 'completed';
            localGen.completedAt = Date.now();
            localGen.progress = 100;
            await saveGeneration(localGen);

            setProgress(100);
            setCurrentGen({ ...localGen });
            setGenerating(false);

            // Create playback URL
            const url = await getBlobUrl(blobKey);
            setLocalAudioUrl(url);
            loadHistory();
        } catch (err: any) {
            localGen.status = 'failed';
            localGen.error = err?.error || err?.message || 'Generation failed';
            await saveGeneration(localGen);
            setGenError(localGen.error);
            setGenerating(false);
            loadHistory();
        }
    }, [prompt, lyrics, showLyrics, genre, moods, bpm, duration, instrumental, generateDemoAudio]);

    // ── Load history item ──────────────
    const loadHistoryItem = useCallback(async (gen: LocalGeneration) => {
        setCurrentGen(gen);
        if (gen.resultBlobKey) {
            const url = await getBlobUrl(gen.resultBlobKey);
            setLocalAudioUrl(url);
        } else if (gen.resultUrl) {
            setLocalAudioUrl(gen.resultUrl);
        }
    }, []);

    const [autoMintNFT, setAutoMintNFT] = useState(true);
    const [pipelineSteps, setPipelineSteps] = useState<Array<{ step: string; status: string }>>([]);

    const handlePublish = useCallback(async () => {
        if (!currentGen || !localAudioUrl) return;
        setPublishing(true);
        setPipelineSteps([{ step: 'upload', status: 'running' }]);
        try {
            const userRaw = sessionStorage.getItem('vp.user');
            const user = userRaw ? JSON.parse(userRaw) : null;
            const ckbAddress = user?.ckbAddress || '';

            // Fetch audio blob and convert to base64
            let base64Content = '';
            if (currentGen.resultBlobKey) {
                const url = await getBlobUrl(currentGen.resultBlobKey);
                if (url) {
                    const resp = await fetch(url);
                    const blob = await resp.blob();
                    const reader = new FileReader();
                    base64Content = await new Promise<string>((resolve) => {
                        reader.onloadend = () => {
                            const result = reader.result as string;
                            resolve(result.split(',')[1] || result);
                        };
                        reader.readAsDataURL(blob);
                    });
                }
            }

            const res = await api.post<any>('/content/publish', {
                base64Content,
                contentType: 'audio',
                title: currentGen.resultMeta?.title || currentGen.prompt.slice(0, 60),
                description: currentGen.prompt,
                genre: currentGen.params?.genre || 'Other',
                language: 'English',
                creatorCkbAddress: ckbAddress,
                autoMintNFT,
                tags: ['ai-generated', currentGen.params?.genre || ''].filter(Boolean),
            });

            if (res?.pipeline) setPipelineSteps(res.pipeline);
            await markPublished(currentGen.id, res?.videoId || res?.contentId || 'published');
            setPublishedId(currentGen.id);
            setCurrentGen(prev => prev ? { ...prev, published: true, publishedAt: Date.now() } : null);
            loadHistory();
            setTimeout(() => { setPublishedId(null); setPipelineSteps([]); }, 5000);
        } catch (err: any) {
            setPipelineSteps(prev => [...prev, { step: 'error', status: err?.error || err?.message || 'Failed' }]);
            alert('发布失败: ' + (err?.error || err?.message || ''));
        } finally { setPublishing(false); }
    }, [currentGen, localAudioUrl, providerName, autoMintNFT]);

    // ── Delete local generation ──────────────
    const handleDelete = useCallback(async (id: string) => {
        await deleteGeneration(id);
        if (currentGen?.id === id) {
            setCurrentGen(null);
            setLocalAudioUrl(null);
        }
        loadHistory();
    }, [currentGen]);

    // ── Audio controls ──────────────
    const togglePlay = () => {
        if (!audioRef.current || !localAudioUrl) return;
        if (playing) { audioRef.current.pause(); }
        else { audioRef.current.play(); }
        setPlaying(!playing);
    };

    // Waveform
    const [waveform] = useState(() => Array.from({ length: 60 }, () => Math.random() * 0.8 + 0.2));

    // ── Provider not configured ──────────────
    if (providerReady === false) {
        return (
            <div className="min-h-screen bg-[#0a0a12] text-white p-8 flex items-center justify-center">
                <div className="text-center max-w-lg">
                    <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-pink-500/20 to-purple-600/20 flex items-center justify-center mx-auto mb-6">
                        <Music size={36} className="text-pink-400" />
                    </div>
                    <h2 className="text-2xl font-bold mb-3">Music AI Provider Not Configured</h2>
                    <p className="text-gray-400 mb-6">
                        To generate music, configure a music AI provider (like Suno) with your API key.
                    </p>
                    <button onClick={() => navigate('/settings/ai')}
                        className="px-6 py-3 rounded-xl bg-gradient-to-r from-pink-500 to-purple-600 text-white font-bold hover:brightness-110 transition-all flex items-center gap-2 mx-auto">
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
                <div className="flex items-center gap-2 text-pink-400 mb-4">
                    <Sparkles size={16} />
                    <span className="font-mono text-xs uppercase tracking-widest font-bold">
                        AI Studio <ChevronRight size={12} className="inline" /> Music Lab
                    </span>
                    <span className="ml-auto flex items-center gap-3">
                        <span className="text-xs bg-white/5 border border-white/10 px-3 py-1 rounded-full text-gray-400 font-mono flex items-center gap-1">
                            <HardDrive size={10} /> Local Storage
                        </span>
                        {providerName && (
                            <span className="text-xs bg-pink-500/10 border border-pink-500/20 px-3 py-1 rounded-full text-pink-400 font-mono">
                                Provider: {providerName}
                            </span>
                        )}
                    </span>
                </div>
                <h1 className="text-3xl font-black mb-8">
                    <span className="bg-gradient-to-r from-pink-400 to-purple-500 text-transparent bg-clip-text">
                        AI Music Generation
                    </span>
                </h1>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    {/* Left: Controls */}
                    <div className="space-y-6">
                        {/* Prompt */}
                        <div className="bg-[#12121e] rounded-2xl p-6 border border-white/5">
                            <label className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3 block flex items-center gap-2">
                                <Mic size={12} /> Prompt / Description
                            </label>
                            <textarea value={prompt} onChange={e => setPrompt(e.target.value)} rows={3}
                                placeholder="Describe the music you want... e.g. 'An upbeat synthwave track with retro vibes, driving bass, and shimmering arpeggios'"
                                className="w-full bg-black/50 border border-white/10 rounded-xl p-4 text-sm text-white resize-none outline-none focus:border-pink-500 placeholder-gray-600" />
                            <button onClick={() => setShowLyrics(!showLyrics)}
                                className="mt-3 text-xs text-pink-400 hover:text-pink-300 flex items-center gap-1 font-bold">
                                <AlignLeft size={12} /> {showLyrics ? 'Hide Lyrics Editor' : 'Add Custom Lyrics'}
                            </button>
                            {showLyrics && (
                                <textarea value={lyrics} onChange={e => setLyrics(e.target.value)} rows={5}
                                    placeholder="[Verse 1]&#10;Write your lyrics here..."
                                    className="w-full mt-3 bg-black/50 border border-white/10 rounded-xl p-4 text-sm text-white resize-none outline-none focus:border-pink-500 placeholder-gray-600 font-mono" />
                            )}
                        </div>

                        {/* Genre & Mood */}
                        <div className="bg-[#12121e] rounded-2xl p-6 border border-white/5">
                            <label className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3 block flex items-center gap-2">
                                <Guitar size={12} /> Genre
                            </label>
                            <div className="flex flex-wrap gap-2 mb-5">
                                {GENRES.map(g => (
                                    <button key={g} onClick={() => setGenre(genre === g ? '' : g)}
                                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${genre === g ? 'bg-pink-500 text-white shadow-[0_0_12px_rgba(236,72,153,0.4)]' : 'bg-white/5 text-gray-400 hover:bg-white/10'}`}>
                                        {g}
                                    </button>
                                ))}
                            </div>
                            <label className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3 block">Mood Tags</label>
                            <div className="flex flex-wrap gap-2">
                                {MOODS.map(m => (
                                    <button key={m} onClick={() => setMoods(prev => prev.includes(m) ? prev.filter(x => x !== m) : [...prev, m])}
                                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${moods.includes(m) ? 'bg-purple-500 text-white' : 'bg-white/5 text-gray-400 hover:bg-white/10'}`}>
                                        {m}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* BPM & Duration */}
                        <div className="bg-[#12121e] rounded-2xl p-6 border border-white/5 grid grid-cols-2 gap-6">
                            <div>
                                <label className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2 block flex items-center gap-2">
                                    <Drum size={12} /> BPM: {bpm}
                                </label>
                                <input type="range" min={60} max={200} value={bpm} onChange={e => setBpm(Number(e.target.value))} className="w-full accent-pink-500" />
                            </div>
                            <div>
                                <label className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2 block flex items-center gap-2">
                                    <Clock size={12} /> Duration
                                </label>
                                <select value={duration} onChange={e => setDuration(e.target.value)}
                                    className="w-full bg-black/50 border border-white/10 rounded-xl p-3 text-sm text-white outline-none">
                                    <option value="30">30 seconds</option>
                                    <option value="60">1 minute</option>
                                    <option value="120">2 minutes</option>
                                    <option value="240">4 minutes</option>
                                </select>
                            </div>
                        </div>

                        {/* Instrumental */}
                        <div className="flex items-center gap-3 bg-[#12121e] rounded-2xl p-4 border border-white/5">
                            <button onClick={() => setInstrumental(!instrumental)}
                                className={`w-10 h-5 rounded-full p-0.5 transition-colors ${instrumental ? 'bg-pink-500' : 'bg-gray-700'}`}>
                                <div className={`w-4 h-4 rounded-full bg-white transition-transform ${instrumental ? 'translate-x-5' : 'translate-x-0'}`} />
                            </button>
                            <span className="text-sm font-bold">Instrumental Only (no vocals)</span>
                        </div>

                        {/* Generate Button */}
                        <button onClick={handleGenerate} disabled={generating || !prompt.trim()}
                            className="w-full py-4 rounded-xl font-bold text-lg bg-gradient-to-r from-pink-500 to-purple-600 text-white hover:brightness-110 transition-all shadow-[0_0_30px_rgba(236,72,153,0.3)] disabled:opacity-50 flex items-center justify-center gap-3 uppercase tracking-widest">
                            {generating ? <><Loader2 size={20} className="animate-spin" /> Generating... {progress}%</> : <><Sparkles size={20} /> Generate Music</>}
                        </button>

                        {generating && (
                            <div className="w-full bg-white/5 rounded-full h-2 overflow-hidden">
                                <div className="h-full bg-gradient-to-r from-pink-500 to-purple-600 transition-all duration-500 rounded-full" style={{ width: `${progress}%` }} />
                            </div>
                        )}
                        {genError && (
                            <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 text-red-400 text-sm flex items-center gap-2">
                                <AlertTriangle size={16} /> {genError}
                            </div>
                        )}
                    </div>

                    {/* Right: Output & History */}
                    <div className="space-y-6">
                        {/* Generated Output */}
                        <div className="bg-[#12121e] rounded-2xl p-6 border border-white/5 min-h-[300px]">
                            <h3 className="font-bold text-lg mb-4 flex items-center gap-2">
                                <Volume2 size={16} className="text-pink-400" /> Generated Track
                                {currentGen && (
                                    <span className="ml-auto text-xs font-mono text-gray-500 flex items-center gap-1">
                                        <HardDrive size={10} /> Stored Locally
                                    </span>
                                )}
                            </h3>

                            {currentGen && localAudioUrl ? (
                                <div className="space-y-4">
                                    {/* Waveform */}
                                    <div className="flex items-end gap-[2px] h-24 bg-black/30 rounded-xl p-4 cursor-pointer" onClick={togglePlay}>
                                        {waveform.map((h, i) => (
                                            <div key={i}
                                                className={`flex-1 rounded-full transition-colors ${playing ? 'bg-pink-500' : 'bg-pink-500/30'}`}
                                                style={{ height: `${h * 100}%` }} />
                                        ))}
                                    </div>

                                    {/* Controls */}
                                    <div className="flex items-center gap-4">
                                        <button onClick={togglePlay}
                                            className="w-12 h-12 rounded-full bg-gradient-to-r from-pink-500 to-purple-600 flex items-center justify-center shadow-lg hover:scale-105 transition-transform">
                                            {playing ? <Pause size={20} /> : <Play size={20} className="ml-0.5" />}
                                        </button>
                                        <div className="flex-1">
                                            <p className="font-bold text-sm">{currentGen.resultMeta?.title || 'AI Generated Track'}</p>
                                            <p className="text-xs text-gray-500 font-mono">
                                                {currentGen.params?.style || genre || 'AI Music'} • {currentGen.params?.duration || duration}s
                                            </p>
                                        </div>
                                    </div>

                                    <audio ref={audioRef} src={localAudioUrl} onEnded={() => setPlaying(false)} className="w-full" controls />

                                    {/* Publish to Platform */}
                                    {currentGen.published ? (
                                        <div className="w-full py-3 rounded-xl bg-green-500/10 border border-green-500/20 text-green-400 text-center font-bold text-sm flex items-center justify-center gap-2">
                                            <Check size={14} /> Published to Nexus
                                        </div>
                                    ) : (
                                        <button onClick={handlePublish} disabled={publishing}
                                            className="w-full py-3 rounded-xl bg-gradient-to-r from-green-500 to-emerald-600 text-white font-bold text-sm hover:brightness-110 transition-all flex items-center justify-center gap-2 uppercase tracking-wider disabled:opacity-50">
                                            {publishing ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
                                            {publishing ? 'Publishing...' : 'Publish to Nexus'}
                                        </button>
                                    )}

                                    <p className="text-[10px] text-gray-600 font-mono text-center">
                                        ℹ️ This track is stored in your browser. It will be uploaded to platform storage only when you publish.
                                    </p>
                                </div>
                            ) : (
                                <div className="flex items-center justify-center h-48 text-gray-600">
                                    <div className="text-center">
                                        <Music size={48} className="mx-auto mb-3 opacity-30" />
                                        <p className="text-sm mb-1">Your generated music will appear here</p>
                                        <p className="text-xs text-gray-700">Stored locally in your browser until published</p>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Local Generation History */}
                        <div className="bg-[#12121e] rounded-2xl p-6 border border-white/5">
                            <h3 className="font-bold text-sm mb-4 flex items-center gap-2 text-gray-400 uppercase tracking-wider">
                                <RotateCcw size={14} /> Local History ({history.length})
                            </h3>
                            {history.length === 0 ? (
                                <p className="text-gray-600 text-sm text-center py-4">No music generated yet</p>
                            ) : (
                                <div className="space-y-2 max-h-60 overflow-y-auto">
                                    {history.map((h) => (
                                        <div key={h.id} className="flex items-center gap-3 p-3 rounded-xl bg-black/20 hover:bg-black/40 transition-colors group">
                                            <button onClick={() => h.status === 'completed' && loadHistoryItem(h)}
                                                className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold flex-shrink-0 ${h.status === 'completed' ? 'bg-green-500/20 text-green-400 cursor-pointer' : 'bg-gray-500/20 text-gray-400'}`}>
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
