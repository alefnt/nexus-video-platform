import React, { useState, useEffect } from 'react';
import { Key, Settings, Check, X, Loader2, Eye, EyeOff, ChevronRight, Sparkles, Music, Film, FileText, AlertTriangle, ExternalLink, Zap, Server } from 'lucide-react';
import { getApiClient } from '../lib/apiClient';
import { useAuthStore } from '../stores';

// ── Provider Definitions ──────────────────────────────

interface ProviderOption {
    id: string;
    name: string;
    baseUrl: string;
    models?: string[];
    docs?: string;
}

const TEXT_PROVIDERS: ProviderOption[] = [
    { id: 'openai', name: 'OpenAI', baseUrl: 'https://api.openai.com/v1', models: ['gpt-4o', 'gpt-4o-mini', 'gpt-3.5-turbo'], docs: 'https://platform.openai.com/api-keys' },
    { id: 'deepseek', name: 'DeepSeek', baseUrl: 'https://api.deepseek.com', models: ['deepseek-chat', 'deepseek-reasoner'], docs: 'https://platform.deepseek.com/api-keys' },
    { id: 'anthropic', name: 'Claude (Anthropic)', baseUrl: 'https://api.anthropic.com/v1', models: ['claude-sonnet-4-20250514', 'claude-haiku-4-20250414'], docs: 'https://console.anthropic.com/settings/keys' },
    { id: 'google', name: 'Google Gemini', baseUrl: 'https://generativelanguage.googleapis.com/v1beta', models: ['gemini-2.5-flash', 'gemini-2.5-pro'], docs: 'https://aistudio.google.com/apikey' },
    { id: 'ollama', name: 'Ollama (Self-hosted)', baseUrl: 'http://localhost:11434/v1', models: ['llama3', 'mistral', 'qwen2.5'], docs: 'https://ollama.ai' },
    { id: 'custom', name: 'Custom (OpenAI-compatible)', baseUrl: '', models: [], docs: '' },
];

const MUSIC_PROVIDERS: ProviderOption[] = [
    { id: 'suno_comet', name: 'Suno V5 (CometAPI)', baseUrl: 'https://api.cometapi.com', docs: 'https://cometapi.com' },
    { id: 'suno_evolink', name: 'Suno (EvoLink)', baseUrl: 'https://api.evolink.ai', docs: 'https://evolink.ai' },
    { id: 'custom_music', name: 'Custom Music API', baseUrl: '', docs: '' },
];

const VIDEO_PROVIDERS: ProviderOption[] = [
    { id: 'runway', name: 'Runway Gen-4.5', baseUrl: 'https://api.dev.runwayml.com/v1', models: ['gen4', 'gen4-turbo'], docs: 'https://dev.runwayml.com' },
    { id: 'kling', name: 'Kling 3.0', baseUrl: 'https://api.klingai.com/v1', models: ['kling-video-v3'], docs: 'https://klingai.com' },
    { id: 'kling_fal', name: 'Kling (via fal.ai)', baseUrl: 'https://fal.run', docs: 'https://fal.ai' },
    { id: 'pika', name: 'Pika Labs', baseUrl: 'https://api.pika.art/v1', docs: 'https://pika.art' },
    { id: 'custom_video', name: 'Custom Video API', baseUrl: '', docs: '' },
];

// ── Types ──────────────────────────────

interface ProviderConfig {
    enabled: boolean;
    providerId: string;
    apiKey: string;
    baseUrl: string;
    model: string;
    testStatus: 'idle' | 'testing' | 'success' | 'error';
    testError?: string;
}

// ── Component ──────────────────────────

export default function AISettings() {
    const api = getApiClient();
    const { isLoggedIn } = useAuthStore();

    const [textConfig, setTextConfig] = useState<ProviderConfig>({
        enabled: false, providerId: 'deepseek', apiKey: '', baseUrl: 'https://api.deepseek.com',
        model: 'deepseek-chat', testStatus: 'idle',
    });
    const [musicConfig, setMusicConfig] = useState<ProviderConfig>({
        enabled: false, providerId: 'suno_comet', apiKey: '', baseUrl: 'https://api.cometapi.com',
        model: '', testStatus: 'idle',
    });
    const [videoConfig, setVideoConfig] = useState<ProviderConfig>({
        enabled: false, providerId: 'runway', apiKey: '', baseUrl: 'https://api.dev.runwayml.com/v1',
        model: 'gen4-turbo', testStatus: 'idle',
    });

    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);
    const [loading, setLoading] = useState(true);
    const [showKeys, setShowKeys] = useState<Record<string, boolean>>({ text: false, music: false, video: false });

    // ── Load saved settings ──────────────

    useEffect(() => {
        if (!isLoggedIn) { setLoading(false); return; }
        (async () => {
            try {
                const res = await api.get<any>('/ai/settings');
                if (res?.text) {
                    setTextConfig(prev => ({ ...prev, ...res.text, apiKey: res.text.apiKeyMasked || '', testStatus: 'idle' }));
                }
                if (res?.music) {
                    setMusicConfig(prev => ({ ...prev, ...res.music, apiKey: res.music.apiKeyMasked || '', testStatus: 'idle' }));
                }
                if (res?.video) {
                    setVideoConfig(prev => ({ ...prev, ...res.video, apiKey: res.video.apiKeyMasked || '', testStatus: 'idle' }));
                }
            } catch { /* No settings saved yet */ }
            finally { setLoading(false); }
        })();
    }, [isLoggedIn]);

    // ── Save settings ──────────────

    const handleSave = async () => {
        setSaving(true);
        try {
            await api.post('/ai/settings', {
                text: { ...textConfig, testStatus: undefined, testError: undefined },
                music: { ...musicConfig, testStatus: undefined, testError: undefined },
                video: { ...videoConfig, testStatus: undefined, testError: undefined },
            });
            setSaved(true);
            setTimeout(() => setSaved(false), 3000);
        } catch (err: any) {
            alert('Failed to save settings: ' + (err?.error || err?.message || 'Unknown error'));
        } finally { setSaving(false); }
    };

    // ── Test connection ──────────────

    const testConnection = async (type: 'text' | 'music' | 'video', config: ProviderConfig, setConfig: (fn: (prev: ProviderConfig) => ProviderConfig) => void) => {
        if (!config.apiKey.trim()) {
            setConfig(prev => ({ ...prev, testStatus: 'error', testError: 'API key is required' }));
            return;
        }
        setConfig(prev => ({ ...prev, testStatus: 'testing', testError: undefined }));
        try {
            await api.post('/ai/test-connection', {
                type, providerId: config.providerId, apiKey: config.apiKey,
                baseUrl: config.baseUrl, model: config.model,
            });
            setConfig(prev => ({ ...prev, testStatus: 'success' }));
        } catch (err: any) {
            setConfig(prev => ({ ...prev, testStatus: 'error', testError: err?.error || err?.message || 'Connection failed' }));
        }
    };

    // ── Provider Section Renderer ──────────────

    const renderProviderSection = (
        title: string,
        icon: React.ReactNode,
        iconColor: string,
        providers: ProviderOption[],
        config: ProviderConfig,
        setConfig: React.Dispatch<React.SetStateAction<ProviderConfig>>,
        type: 'text' | 'music' | 'video',
    ) => {
        const selectedProvider = providers.find(p => p.id === config.providerId);
        const showKey = showKeys[type] ?? false;
        const setShowKey = (v: boolean) => setShowKeys(prev => ({ ...prev, [type]: v }));

        return (
            <div className={`bg-[#12121e] rounded-2xl p-6 border transition-all ${config.enabled ? 'border-white/10' : 'border-white/5 opacity-60'}`}>
                {/* Header with toggle */}
                <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-xl ${iconColor} flex items-center justify-center`}>
                            {icon}
                        </div>
                        <div>
                            <h3 className="font-bold text-lg">{title}</h3>
                            <p className="text-xs text-gray-500 font-mono">
                                {config.enabled ? (selectedProvider?.name || 'Configured') : 'Not configured'}
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={() => setConfig(prev => ({ ...prev, enabled: !prev.enabled }))}
                        className={`w-12 h-6 rounded-full p-1 transition-colors ${config.enabled ? 'bg-cyan-500' : 'bg-gray-700'}`}
                    >
                        <div className={`w-4 h-4 rounded-full bg-white transition-transform ${config.enabled ? 'translate-x-6' : 'translate-x-0'}`} />
                    </button>
                </div>

                {config.enabled && (
                    <div className="space-y-4">
                        {/* Provider Select */}
                        <div>
                            <label className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2 block">Provider</label>
                            <select
                                value={config.providerId}
                                onChange={e => {
                                    const p = providers.find(pp => pp.id === e.target.value);
                                    setConfig(prev => ({
                                        ...prev,
                                        providerId: e.target.value,
                                        baseUrl: p?.baseUrl || prev.baseUrl,
                                        model: p?.models?.[0] || '',
                                        testStatus: 'idle',
                                    }));
                                }}
                                className="w-full bg-black/50 border border-white/10 rounded-xl p-3 text-sm text-white font-medium outline-none focus:border-cyan-500"
                            >
                                {providers.map(p => (
                                    <option key={p.id} value={p.id} className="bg-gray-900">{p.name}</option>
                                ))}
                            </select>
                        </div>

                        {/* API Key */}
                        <div>
                            <label className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2 block flex items-center gap-2">
                                <Key size={12} /> API Key
                                {selectedProvider?.docs && (
                                    <a href={selectedProvider.docs} target="_blank" rel="noopener noreferrer"
                                        className="text-cyan-400 hover:text-cyan-300 flex items-center gap-1 ml-auto font-normal normal-case">
                                        Get Key <ExternalLink size={10} />
                                    </a>
                                )}
                            </label>
                            <div className="relative">
                                <input
                                    type={showKey ? 'text' : 'password'}
                                    value={config.apiKey}
                                    onChange={e => setConfig(prev => ({ ...prev, apiKey: e.target.value, testStatus: 'idle' }))}
                                    placeholder="sk-... or your API key"
                                    className="w-full bg-black/50 border border-white/10 rounded-xl p-3 pr-20 text-sm text-white font-mono outline-none focus:border-cyan-500"
                                />
                                <button
                                    onClick={() => setShowKey(!showKey)}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white transition-colors"
                                >
                                    {showKey ? <EyeOff size={16} /> : <Eye size={16} />}
                                </button>
                            </div>
                        </div>

                        {/* Base URL (for custom / self-hosted) */}
                        {(config.providerId.includes('custom') || config.providerId === 'ollama') && (
                            <div>
                                <label className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2 block">
                                    <Server size={12} className="inline mr-1" /> Base URL
                                </label>
                                <input
                                    type="text"
                                    value={config.baseUrl}
                                    onChange={e => setConfig(prev => ({ ...prev, baseUrl: e.target.value }))}
                                    placeholder="https://api.example.com/v1"
                                    className="w-full bg-black/50 border border-white/10 rounded-xl p-3 text-sm text-white font-mono outline-none focus:border-cyan-500"
                                />
                            </div>
                        )}

                        {/* Model Select (for text/video) */}
                        {selectedProvider?.models && selectedProvider.models.length > 0 && (
                            <div>
                                <label className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2 block">Model</label>
                                <select
                                    value={config.model}
                                    onChange={e => setConfig(prev => ({ ...prev, model: e.target.value }))}
                                    className="w-full bg-black/50 border border-white/10 rounded-xl p-3 text-sm text-white font-medium outline-none focus:border-cyan-500"
                                >
                                    {selectedProvider.models.map(m => (
                                        <option key={m} value={m} className="bg-gray-900">{m}</option>
                                    ))}
                                </select>
                            </div>
                        )}

                        {/* Test Connection */}
                        <div className="flex items-center gap-3">
                            <button
                                onClick={() => testConnection(type, config, setConfig)}
                                disabled={config.testStatus === 'testing' || !config.apiKey.trim()}
                                className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 text-sm font-bold transition-colors disabled:opacity-50"
                            >
                                {config.testStatus === 'testing' ? (
                                    <><Loader2 size={14} className="animate-spin" /> Testing...</>
                                ) : (
                                    <><Zap size={14} /> Test Connection</>
                                )}
                            </button>
                            {config.testStatus === 'success' && (
                                <span className="text-green-400 flex items-center gap-1 text-sm font-bold"><Check size={16} /> Connected!</span>
                            )}
                            {config.testStatus === 'error' && (
                                <span className="text-red-400 flex items-center gap-1 text-sm"><AlertTriangle size={14} /> {config.testError}</span>
                            )}
                        </div>
                    </div>
                )}
            </div>
        );
    };

    // ── Not Logged In ──────────────

    if (!isLoggedIn) {
        return (
            <div className="min-h-screen bg-[#0a0a12] text-white p-8 flex items-center justify-center">
                <div className="text-center">
                    <AlertTriangle size={48} className="text-yellow-400 mx-auto mb-4" />
                    <h2 className="text-2xl font-bold mb-2">Login Required</h2>
                    <p className="text-gray-400">Please log in to configure your AI provider settings.</p>
                </div>
            </div>
        );
    }

    if (loading) {
        return (
            <div className="min-h-screen bg-[#0a0a12] text-white p-8 flex items-center justify-center">
                <Loader2 size={40} className="animate-spin text-cyan-400" />
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[#0a0a12] text-white p-8 md:p-12 font-sans pb-32">
            <div className="max-w-[1200px] mx-auto">
                {/* Header */}
                <header className="mb-12">
                    <div className="flex items-center gap-2 text-cyan-400 mb-4">
                        <Sparkles size={16} />
                        <span className="font-mono text-xs uppercase tracking-widest font-bold">
                            Settings <ChevronRight size={12} className="inline" /> AI Providers
                        </span>
                    </div>
                    <h1 className="text-4xl font-black tracking-tight mb-3">
                        <span className="bg-gradient-to-r from-cyan-400 to-purple-500 text-transparent bg-clip-text">
                            AI Provider Settings
                        </span>
                    </h1>
                    <p className="text-gray-400 text-sm max-w-2xl leading-relaxed">
                        🔑 Bring your own API keys from any AI provider. Your keys are encrypted and stored securely.
                        Configure providers for text, music, and video generation to unlock the full AI creation suite.
                    </p>
                </header>

                {/* Provider Sections */}
                <div className="space-y-6">
                    {renderProviderSection(
                        'Text / Article Generation',
                        <FileText size={20} className="text-white" />,
                        'bg-gradient-to-br from-purple-500/30 to-purple-700/30',
                        TEXT_PROVIDERS,
                        textConfig,
                        setTextConfig,
                        'text',
                    )}
                    {renderProviderSection(
                        'Music Generation',
                        <Music size={20} className="text-white" />,
                        'bg-gradient-to-br from-pink-500/30 to-pink-700/30',
                        MUSIC_PROVIDERS,
                        musicConfig,
                        setMusicConfig,
                        'music',
                    )}
                    {renderProviderSection(
                        'Video Generation',
                        <Film size={20} className="text-white" />,
                        'bg-gradient-to-br from-cyan-500/30 to-blue-700/30',
                        VIDEO_PROVIDERS,
                        videoConfig,
                        setVideoConfig,
                        'video',
                    )}
                </div>

                {/* Save Button */}
                <div className="mt-10 flex items-center gap-4">
                    <button
                        onClick={handleSave}
                        disabled={saving}
                        className="px-8 py-3.5 rounded-xl font-bold text-sm bg-gradient-to-r from-cyan-500 to-purple-600 text-white hover:brightness-110 transition-all shadow-[0_0_20px_rgba(34,211,238,0.3)] disabled:opacity-50 flex items-center gap-2 uppercase tracking-wider"
                    >
                        {saving ? <Loader2 size={16} className="animate-spin" /> : <Settings size={16} />}
                        Save All Settings
                    </button>
                    {saved && (
                        <span className="text-green-400 flex items-center gap-2 font-bold text-sm">
                            <Check size={16} /> Settings saved successfully!
                        </span>
                    )}
                </div>

                {/* 🚀 Start Creating — AI Lab Navigation */}
                <div className="mt-10">
                    <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                        <Zap size={18} className="text-yellow-400" />
                        Start Creating
                    </h3>
                    <p className="text-gray-500 text-xs mb-4">Configure your API keys above, then jump into any AI Lab to start generating content.</p>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <a
                            href="/studio/ai/article"
                            className="group p-6 rounded-2xl border border-white/10 bg-white/[0.02] hover:bg-purple-500/10 hover:border-purple-500/30 transition-all"
                        >
                            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500/30 to-purple-700/30 flex items-center justify-center mb-3">
                                <FileText size={20} className="text-purple-400" />
                            </div>
                            <h4 className="font-bold text-white text-sm mb-1 group-hover:text-purple-400 transition-colors">AI Article Lab</h4>
                            <p className="text-gray-500 text-xs leading-relaxed">Generate articles, blog posts, and long-form content with AI assistance.</p>
                            <span className="inline-flex items-center gap-1 text-purple-400 text-xs font-bold mt-3 opacity-0 group-hover:opacity-100 transition-opacity">
                                Open Lab <ChevronRight size={12} />
                            </span>
                        </a>
                        <a
                            href="/studio/ai/music"
                            className="group p-6 rounded-2xl border border-white/10 bg-white/[0.02] hover:bg-pink-500/10 hover:border-pink-500/30 transition-all"
                        >
                            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-pink-500/30 to-pink-700/30 flex items-center justify-center mb-3">
                                <Music size={20} className="text-pink-400" />
                            </div>
                            <h4 className="font-bold text-white text-sm mb-1 group-hover:text-pink-400 transition-colors">AI Music Lab</h4>
                            <p className="text-gray-500 text-xs leading-relaxed">Create original music tracks, sound effects, and audio content with AI.</p>
                            <span className="inline-flex items-center gap-1 text-pink-400 text-xs font-bold mt-3 opacity-0 group-hover:opacity-100 transition-opacity">
                                Open Lab <ChevronRight size={12} />
                            </span>
                        </a>
                        <a
                            href="/studio/ai/video"
                            className="group p-6 rounded-2xl border border-white/10 bg-white/[0.02] hover:bg-cyan-500/10 hover:border-cyan-500/30 transition-all"
                        >
                            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500/30 to-blue-700/30 flex items-center justify-center mb-3">
                                <Film size={20} className="text-cyan-400" />
                            </div>
                            <h4 className="font-bold text-white text-sm mb-1 group-hover:text-cyan-400 transition-colors">AI Video Lab</h4>
                            <p className="text-gray-500 text-xs leading-relaxed">Generate video clips, animations, and visual content powered by AI.</p>
                            <span className="inline-flex items-center gap-1 text-cyan-400 text-xs font-bold mt-3 opacity-0 group-hover:opacity-100 transition-opacity">
                                Open Lab <ChevronRight size={12} />
                            </span>
                        </a>
                    </div>
                </div>

                {/* Info Box */}
                <div className="mt-8 bg-white/[0.02] border border-white/5 rounded-2xl p-6">
                    <h4 className="font-bold text-sm mb-3 flex items-center gap-2"><Key size={14} className="text-cyan-400" /> Security & Privacy</h4>
                    <ul className="text-xs text-gray-400 space-y-1.5 font-mono">
                        <li>• API keys are encrypted with AES-256 before storage</li>
                        <li>• Keys are never exposed in API responses after saving (shown as masked)</li>
                        <li>• Keys are only used server-side to call the AI provider — never sent to the browser</li>
                        <li>• You can delete your keys at any time by clearing and saving</li>
                    </ul>
                </div>
            </div>
        </div>
    );
}
