import React, { useState } from 'react';
import { ToggleRight, ToggleLeft, Settings, CheckCircle2, ChevronRight, Hash, Shield, ShieldCheck } from 'lucide-react';

interface Platform {
    id: string;
    name: string;
    iconUrl: string;
    color: string;
    connected: boolean;
    username?: string;
    followers?: string;
    avatar?: string;
}

export default function PlatformBindings() {
    const [platforms, setPlatforms] = useState<Platform[]>([
        {
            id: 'tiktok',
            name: 'TikTok',
            iconUrl: 'https://cdn.iconscout.com/icon/free/png-256/free-tiktok-2270636-1891163.png',
            color: 'from-cyan-500 to-pink-500',
            connected: true,
            username: '@nexus_creator',
            followers: '124K',
            avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=tiktok'
        },
        {
            id: 'youtube',
            name: 'YouTube',
            iconUrl: 'https://cdn.iconscout.com/icon/free/png-256/free-youtube-85-226402.png',
            color: 'from-red-600 to-red-500',
            connected: false
        },
        {
            id: 'douyin',
            name: '抖音 (Douyin)',
            iconUrl: 'https://cdn-icons-png.flaticon.com/512/3046/3046124.png',
            color: 'from-gray-900 to-black',
            connected: false
        },
        {
            id: 'instagram',
            name: 'Instagram',
            iconUrl: 'https://cdn-icons-png.flaticon.com/512/174/174855.png',
            color: 'from-purple-500 via-pink-500 to-orange-500',
            connected: true,
            username: 'nexus.official',
            followers: '45K',
            avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=insta'
        },
        {
            id: 'bilibili',
            name: 'Bilibili',
            iconUrl: 'https://i.pinimg.com/originals/a0/eb/bb/a0ebbb0975dd59f518e3881ca7ab15ed.png',
            color: 'from-blue-400 to-pink-400',
            connected: false
        },
        {
            id: 'twitter',
            name: 'X (Twitter)',
            iconUrl: 'https://cdn-icons-png.flaticon.com/512/5969/5969020.png',
            color: 'from-gray-800 to-black',
            connected: true,
            username: '@nexusWeb3',
            followers: '12K',
            avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=twit'
        }
    ]);

    const [settings, setSettings] = useState({
        privacy: 'public',
        autoHashtags: true,
        watermark: false,
        complianceMode: true
    });

    const toggleConnection = (id: string) => {
        setPlatforms(platforms.map(p => {
            if (p.id === id) {
                if (p.connected) {
                    return { ...p, connected: false, username: undefined, followers: undefined, avatar: undefined };
                } else {
                    return { ...p, connected: true, username: '@new_connection', followers: '0', avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${id}` };
                }
            }
            return p;
        }));
    };

    return (
        <div className="min-h-screen bg-[#0a0a12] text-white p-8 md:p-12 font-sans">
            <div className="max-w-[1600px] mx-auto">
                {/* Header */}
                <header className="mb-12">
                    <h1 className="text-4xl font-black tracking-tight mb-2 flex items-center gap-4">
                        <span className="bg-gradient-to-r from-nexusCyan to-nexusPurple text-transparent bg-clip-text">
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
                                    className="relative glass-panel rounded-2xl p-6 border border-white/5 overflow-hidden group hover:border-white/10 transition-colors"
                                >
                                    {/* Subtly colored top border accent */}
                                    <div className={`absolute top-0 left-0 right-0 h-1 bg-gradient-to-r ${platform.color} opacity-70`} />

                                    <div className="flex justify-between items-start mb-6">
                                        <div className="flex items-center gap-4">
                                            <div className="w-12 h-12 rounded-xl bg-white/5 p-2 flex items-center justify-center backdrop-blur-md">
                                                <img src={platform.iconUrl} alt={platform.name} className="w-full h-full object-contain filter brightness-110 drop-shadow-md" />
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

                                    {platform.connected ? (
                                        <div className="flex flex-col gap-4">
                                            <div className="flex items-center justify-between bg-black/30 rounded-xl p-3 border border-white/5">
                                                <div className="flex items-center gap-3">
                                                    <img src={platform.avatar} alt="avatar" className="w-8 h-8 rounded-full bg-white/10" />
                                                    <div>
                                                        <p className="text-sm font-bold text-white/90">{platform.username}</p>
                                                        <p className="text-xs text-gray-500 font-mono">{platform.followers} Followers</p>
                                                    </div>
                                                </div>
                                            </div>
                                            <button
                                                onClick={() => toggleConnection(platform.id)}
                                                className="w-full py-2.5 rounded-lg border border-red-500/30 text-red-400 hover:bg-red-500/10 font-bold text-sm transition-colors uppercase tracking-wider"
                                            >
                                                Disconnect
                                            </button>
                                        </div>
                                    ) : (
                                        <div className="flex flex-col gap-4 mt-auto h-full justify-end">
                                            <div className="bg-white/[0.02] border border-white/5 border-dashed rounded-xl p-4 text-center">
                                                <p className="text-xs text-gray-500 font-mono">Unlock cross-posting for {platform.name}</p>
                                            </div>
                                            <button
                                                onClick={() => toggleConnection(platform.id)}
                                                className={`w-full py-2.5 rounded-lg font-bold text-sm text-black transition-all shadow-lg uppercase tracking-wider bg-gradient-to-r ${platform.color} hover:brightness-110`}
                                            >
                                                Connect Account
                                            </button>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Right: Settings Sidebar */}
                    <div className="w-full lg:w-96 flex-shrink-0">
                        <div className="glass-panel rounded-2xl p-6 border border-white/5 sticky top-24">
                            <h3 className="text-xl font-bold mb-6 flex items-center gap-3 border-b border-white/10 pb-4">
                                <Settings className="text-nexusCyan" size={20} />
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
                                                className={`py-2 text-xs font-bold uppercase tracking-wider rounded-lg border transition-all ${settings.privacy === p.toLowerCase() ? 'bg-nexusCyan/20 text-nexusCyan border-nexusCyan' : 'bg-transparent text-gray-500 border-white/10 hover:border-white/20 hover:text-white'}`}
                                            >
                                                {p}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                <div className="h-px bg-white/5 w-full my-6" />

                                <div className="flex items-center justify-between cursor-pointer" onClick={() => setSettings({ ...settings, autoHashtags: !settings.autoHashtags })}>
                                    <div>
                                        <p className="font-bold text-sm text-white/90 flex items-center gap-2"><Hash size={14} className="text-nexusPurple" /> Auto-Hashtags</p>
                                        <p className="text-xs text-gray-500 font-mono mt-1 w-4/5">AI automatically extracts & appends optimal tags.</p>
                                    </div>
                                    {settings.autoHashtags ? <ToggleRight className="text-nexusCyan w-10 h-10" /> : <ToggleLeft className="text-gray-600 w-10 h-10" />}
                                </div>

                                <div className="flex items-center justify-between cursor-pointer" onClick={() => setSettings({ ...settings, watermark: !settings.watermark })}>
                                    <div>
                                        <p className="font-bold text-sm text-white/90 flex items-center gap-2"><Shield size={14} className="text-nexusCyan" /> Content Watermark</p>
                                        <p className="text-xs text-gray-500 font-mono mt-1 w-4/5">Add Nexus ID watermark to exported cross-posts.</p>
                                    </div>
                                    {settings.watermark ? <ToggleRight className="text-nexusCyan w-10 h-10" /> : <ToggleLeft className="text-gray-600 w-10 h-10" />}
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
