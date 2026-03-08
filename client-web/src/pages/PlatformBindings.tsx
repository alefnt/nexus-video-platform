import React, { useState, useEffect, useCallback } from 'react';
import { ToggleRight, ToggleLeft, Settings, ChevronRight, Hash, Shield, ShieldCheck, Loader2, ExternalLink, Fingerprint, Wallet } from 'lucide-react';
import { getApiClient } from '../lib/apiClient';
import { useAuthStore } from '../stores';

// ── Types ──────────────────────────────────────────────────

interface Platform {
    id: string;
    name: string;
    iconUrl: string;
    color: string;
    connected: boolean;
    username?: string;
    followers?: string;
    avatar?: string;
    connectUrl?: string;
}

// ── Component ──────────────────────────────────────────────

export default function PlatformBindings() {
    const api = getApiClient();
    const { user, isLoggedIn } = useAuthStore();

    const [platforms, setPlatforms] = useState<Platform[]>([]);
    const [loading, setLoading] = useState(true);

    const [settings, setSettings] = useState({
        privacy: 'public',
        autoHashtags: true,
        watermark: false,
        complianceMode: true
    });

    // ── Build platform list from user profile ──────────────

    const refreshPlatforms = useCallback(async () => {
        setLoading(true);
        try {
            // Fetch fresh user profile from server to get binding status
            let profile: any = null;
            try {
                profile = await api.get<any>('/auth/profile');
            } catch {
                // Fall back to local store data
            }

            const u = profile || user;

            const list: Platform[] = [
                {
                    id: 'joyid',
                    name: 'JoyID (Passkey)',
                    iconUrl: 'https://cdn-icons-png.flaticon.com/128/7764/7764202.png',
                    color: 'from-green-400 to-emerald-600',
                    connected: !!(u?.ckbAddress),
                    username: u?.ckbAddress ? `${u.ckbAddress.slice(0, 8)}...${u.ckbAddress.slice(-6)}` : undefined,
                    avatar: u?.avatar || `https://api.dicebear.com/7.x/shapes/svg?seed=joyid`,
                },
                {
                    id: 'twitter',
                    name: 'X (Twitter)',
                    iconUrl: 'https://cdn-icons-png.flaticon.com/512/5969/5969020.png',
                    color: 'from-gray-800 to-black',
                    connected: !!(u?.twitterId || u?.twitterHandle),
                    username: u?.twitterHandle ? `@${u.twitterHandle}` : undefined,
                    avatar: u?.twitterAvatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=twit`,
                    connectUrl: '/auth/twitter',
                },
                {
                    id: 'google',
                    name: 'Google',
                    iconUrl: 'https://cdn-icons-png.flaticon.com/512/2991/2991148.png',
                    color: 'from-blue-500 via-red-500 to-yellow-500',
                    connected: !!(u?.googleId || u?.email),
                    username: u?.email || undefined,
                    avatar: u?.googleAvatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=google`,
                    connectUrl: '/auth/google',
                },
                {
                    id: 'tiktok',
                    name: 'TikTok',
                    iconUrl: 'https://cdn.iconscout.com/icon/free/png-256/free-tiktok-2270636-1891163.png',
                    color: 'from-cyan-500 to-pink-500',
                    connected: !!(u?.tiktokId),
                    username: u?.tiktokHandle ? `@${u.tiktokHandle}` : undefined,
                    connectUrl: '/auth/tiktok',
                },
                {
                    id: 'youtube',
                    name: 'YouTube',
                    iconUrl: 'https://cdn.iconscout.com/icon/free/png-256/free-youtube-85-226402.png',
                    color: 'from-red-600 to-red-500',
                    connected: !!(u?.youtubeChannelId),
                    username: u?.youtubeChannelName || undefined,
                    connectUrl: '/auth/youtube',
                },
                {
                    id: 'bilibili',
                    name: 'Bilibili',
                    iconUrl: 'https://i.pinimg.com/originals/a0/eb/bb/a0ebbb0975dd59f518e3881ca7ab15ed.png',
                    color: 'from-blue-400 to-pink-400',
                    connected: !!(u?.bilibiliMid),
                    username: u?.bilibiliName || undefined,
                    connectUrl: '/auth/bilibili',
                },
            ];

            setPlatforms(list);
        } finally {
            setLoading(false);
        }
    }, [user]);

    useEffect(() => { refreshPlatforms(); }, [refreshPlatforms]);

    // ── Connect handler ────────────────────────────────────

    const handleConnect = async (platform: Platform) => {
        if (platform.id === 'joyid') {
            window.location.href = '/login?method=joyid&redirect=/settings/platforms';
            return;
        }
        if (platform.connectUrl) {
            try {
                // Call the OAuth start endpoint to get the auth URL
                const res = await api.get<{ authUrl: string; state: string }>(`${platform.connectUrl}/start?dfp=browser`);
                if (res?.authUrl) {
                    window.location.href = res.authUrl;
                    return;
                }
                alert(`Failed to start ${platform.name} OAuth: no auth URL returned`);
            } catch (err: any) {
                alert(err?.error || `Failed to connect ${platform.name}`);
            }
            return;
        }
        alert(`${platform.name} integration coming soon!`);
    };

    // ── Disconnect handler ─────────────────────────────────

    const handleDisconnect = async (platform: Platform) => {
        if (!confirm(`Are you sure you want to disconnect ${platform.name}?`)) return;

        try {
            await api.post('/auth/unbind', { provider: platform.id });
            await refreshPlatforms();
        } catch (err: any) {
            alert(err?.error || 'Failed to disconnect');
        }
    };

    // ── Loading ────────────────────────────────────────────

    if (loading) {
        return (
            <div className="min-h-screen bg-[#0a0a12] text-white p-8 flex items-center justify-center">
                <Loader2 size={40} className="animate-spin text-cyan-400" />
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[#0a0a12] text-white p-8 md:p-12 font-sans">
            <div className="max-w-[1600px] mx-auto">
                {/* Header */}
                <header className="mb-12">
                    <h1 className="text-4xl font-black tracking-tight mb-2 flex items-center gap-4">
                        <span className="bg-gradient-to-r from-cyan-400 to-purple-500 text-transparent bg-clip-text">
                            Platform Connections
                        </span>
                    </h1>
                    <p className="text-gray-400 font-mono text-sm max-w-xl">
                        🔗 Connect third-party platforms for one-click cross-posting. Automate your multi-channel distribution workflow.
                    </p>
                </header>

                <div className="flex flex-col lg:flex-row gap-8">
                    {/* Left: Platform Grid */}
                    <div className="flex-1">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {platforms.map(platform => (
                                <div
                                    key={platform.id}
                                    className="relative bg-[#12121e] rounded-2xl p-6 border border-white/5 overflow-hidden group hover:border-white/10 transition-colors flex flex-col min-h-[200px]"
                                >
                                    {/* Top border accent */}
                                    <div className={`absolute top-0 left-0 right-0 h-1 bg-gradient-to-r ${platform.color} opacity-70`} />

                                    <div className="flex justify-between items-start mb-4">
                                        <div className="flex items-center gap-4">
                                            <div className="w-12 h-12 rounded-xl bg-white/5 p-2 flex items-center justify-center backdrop-blur-md">
                                                <img src={platform.iconUrl} alt={platform.name} className="w-full h-full object-contain filter brightness-110 drop-shadow-md" onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                                            </div>
                                            <div>
                                                <h3 className="font-bold text-lg">{platform.name}</h3>
                                                <div className="flex items-center gap-2 mt-1">
                                                    <span className={`w-2 h-2 rounded-full ${platform.connected ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]' : 'bg-gray-600'}`} />
                                                    <span className="text-xs font-mono text-gray-400 uppercase tracking-widest">
                                                        {platform.connected ? 'Connected' : 'Not Connected'}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Always push action to bottom */}
                                    <div className="flex-1" />

                                    {platform.connected ? (
                                        <div className="flex flex-col gap-3">
                                            <div className="flex items-center justify-between bg-black/30 rounded-xl p-3 border border-white/5">
                                                <div className="flex items-center gap-3">
                                                    {platform.avatar && <img src={platform.avatar} alt="avatar" className="w-8 h-8 rounded-full bg-white/10" />}
                                                    <div>
                                                        <p className="text-sm font-bold text-white/90">{platform.username || 'Connected'}</p>
                                                        {platform.followers && <p className="text-xs text-gray-500 font-mono">{platform.followers} Followers</p>}
                                                    </div>
                                                </div>
                                            </div>
                                            {platform.id === 'joyid' ? (
                                                <div className="w-full py-2.5 rounded-lg bg-green-500/10 border border-green-500/20 text-green-400 text-center font-bold text-sm uppercase tracking-wider flex items-center justify-center gap-2">
                                                    <Wallet size={14} /> Primary Wallet
                                                </div>
                                            ) : (
                                                <button
                                                    onClick={() => handleDisconnect(platform)}
                                                    className="w-full py-3 rounded-xl border-2 border-red-500/40 text-red-400 hover:bg-red-500/10 font-bold text-sm transition-colors uppercase tracking-wider"
                                                >
                                                    ✕ Disconnect
                                                </button>
                                            )}
                                        </div>
                                    ) : (
                                        <div className="flex flex-col gap-3">
                                            <p className="text-xs text-gray-500 font-mono text-center">
                                                Connect to unlock cross-posting
                                            </p>
                                            <button
                                                onClick={() => handleConnect(platform)}
                                                className={`w-full py-3 rounded-xl font-bold text-sm text-white transition-all shadow-lg uppercase tracking-wider bg-gradient-to-r ${platform.color} hover:brightness-110 hover:scale-[1.02] flex items-center justify-center gap-2`}
                                            >
                                                <ExternalLink size={14} />
                                                Connect {platform.name}
                                            </button>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Right: Settings Sidebar */}
                    <div className="w-full lg:w-96 flex-shrink-0">
                        <div className="bg-[#12121e] rounded-2xl p-6 border border-white/5 sticky top-24">
                            <h3 className="text-xl font-bold mb-6 flex items-center gap-3 border-b border-white/10 pb-4">
                                <Settings className="text-cyan-400" size={20} />
                                Cross-Post Settings
                            </h3>

                            <div className="space-y-6">
                                <div>
                                    <label className="block text-sm font-bold text-gray-300 mb-3">Default Privacy</label>
                                    <div className="grid grid-cols-3 gap-2">
                                        {['Public', 'Private', 'Unlisted'].map(p => (
                                            <button
                                                key={p}
                                                onClick={() => setSettings({ ...settings, privacy: p.toLowerCase() })}
                                                className={`py-2 text-xs font-bold uppercase tracking-wider rounded-lg border transition-all ${settings.privacy === p.toLowerCase() ? 'bg-cyan-400/20 text-cyan-400 border-cyan-400' : 'bg-transparent text-gray-500 border-white/10 hover:border-white/20 hover:text-white'}`}
                                            >
                                                {p}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                <div className="h-px bg-white/5 w-full my-6" />

                                <div className="flex items-center justify-between cursor-pointer" onClick={() => setSettings({ ...settings, autoHashtags: !settings.autoHashtags })}>
                                    <div>
                                        <p className="font-bold text-sm text-white/90 flex items-center gap-2"><Hash size={14} className="text-purple-400" /> Auto-Hashtags</p>
                                        <p className="text-xs text-gray-500 font-mono mt-1 w-4/5">AI automatically extracts & appends optimal tags.</p>
                                    </div>
                                    {settings.autoHashtags ? <ToggleRight className="text-cyan-400 w-10 h-10" /> : <ToggleLeft className="text-gray-600 w-10 h-10" />}
                                </div>

                                <div className="flex items-center justify-between cursor-pointer" onClick={() => setSettings({ ...settings, watermark: !settings.watermark })}>
                                    <div>
                                        <p className="font-bold text-sm text-white/90 flex items-center gap-2"><Shield size={14} className="text-cyan-400" /> Content Watermark</p>
                                        <p className="text-xs text-gray-500 font-mono mt-1 w-4/5">Add Nexus ID watermark to exported cross-posts.</p>
                                    </div>
                                    {settings.watermark ? <ToggleRight className="text-cyan-400 w-10 h-10" /> : <ToggleLeft className="text-gray-600 w-10 h-10" />}
                                </div>

                                <div className="flex items-center justify-between cursor-pointer" onClick={() => setSettings({ ...settings, complianceMode: !settings.complianceMode })}>
                                    <div>
                                        <p className="font-bold text-sm text-white/90 flex items-center gap-2"><ShieldCheck size={14} className="text-green-400" /> Compliance Mode</p>
                                        <p className="text-xs text-gray-500 font-mono mt-1 w-4/5">Pre-check content against each platform's guidelines to prevent bans.</p>
                                    </div>
                                    {settings.complianceMode ? <ToggleRight className="text-green-400 w-10 h-10" /> : <ToggleLeft className="text-gray-600 w-10 h-10" />}
                                </div>
                            </div>

                            <button className="w-full mt-8 bg-white/5 hover:bg-white/10 text-white font-bold py-3 rounded-xl transition-colors border border-white/5 flex items-center justify-center gap-2 group">
                                Save Preferences
                                <ChevronRight size={16} className="group-hover:translate-x-1 transition-transform" />
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
