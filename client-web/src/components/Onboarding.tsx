/**
 * Onboarding — New user welcome flow
 * 3 steps: Select interests → Set profile → Claim welcome bonus
 */

import React, { useState } from 'react';
import { getApiClient } from '../lib/apiClient';

const client = getApiClient();

const INTERESTS = [
    { id: 'gaming', emoji: '🎮', label: 'Gaming' },
    { id: 'music', emoji: '🎵', label: 'Music' },
    { id: 'art', emoji: '🎨', label: 'Art & Design' },
    { id: 'tech', emoji: '💻', label: 'Technology' },
    { id: 'film', emoji: '🎬', label: 'Film & TV' },
    { id: 'crypto', emoji: '🔗', label: 'Web3 & Crypto' },
    { id: 'education', emoji: '📚', label: 'Education' },
    { id: 'fitness', emoji: '💪', label: 'Fitness' },
    { id: 'food', emoji: '🍳', label: 'Food & Cooking' },
    { id: 'travel', emoji: '✈️', label: 'Travel' },
    { id: 'sports', emoji: '⚽', label: 'Sports' },
    { id: 'science', emoji: '🔬', label: 'Science' },
];

interface OnboardingProps {
    onComplete: () => void;
}

export default function Onboarding({ onComplete }: OnboardingProps) {
    const [step, setStep] = useState(0);
    const [selectedInterests, setSelectedInterests] = useState<string[]>([]);
    const [displayName, setDisplayName] = useState('');
    const [bio, setBio] = useState('');
    const [bonusClaimed, setBonusClaimed] = useState(false);

    const toggleInterest = (id: string) => {
        setSelectedInterests(prev =>
            prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
        );
    };

    const submitProfile = async () => {
        try {
            const jwt = sessionStorage.getItem('vp.jwt');
            if (jwt) client.setJWT(jwt);
            await client.post('/user/onboarding', {
                interests: selectedInterests,
                displayName: displayName || undefined,
                bio: bio || undefined,
            });
        } catch { /* non-critical */ }
        setStep(2);
    };

    const claimBonus = async () => {
        try {
            const jwt = sessionStorage.getItem('vp.jwt');
            if (jwt) client.setJWT(jwt);
            await client.post('/payment/points/earn', { amount: 100, reason: 'welcome_bonus' });
            setBonusClaimed(true);
        } catch { /* non-critical */ }
        setTimeout(onComplete, 1500);
    };

    return (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 backdrop-blur-xl">
            <div className="w-full max-w-lg mx-4 bg-[#0A0A14] border border-white/10 rounded-3xl overflow-hidden shadow-[0_0_80px_rgba(34,211,238,0.15)]">
                {/* Progress Bar */}
                <div className="h-1 bg-white/5">
                    <div className="h-full bg-gradient-to-r from-[#22d3ee] to-[#a855f7] transition-all duration-500" style={{ width: `${((step + 1) / 3) * 100}%` }} />
                </div>

                <div className="p-8">
                    {/* Step 0: Interests */}
                    {step === 0 && (
                        <div className="space-y-6">
                            <div className="text-center">
                                <h2 className="text-2xl font-black tracking-widest mb-2">WELCOME TO NEXUS</h2>
                                <p className="text-gray-400 text-sm">What are you interested in?</p>
                            </div>
                            <div className="grid grid-cols-3 gap-3">
                                {INTERESTS.map(({ id, emoji, label }) => (
                                    <button key={id} onClick={() => toggleInterest(id)}
                                        className={`p-3 rounded-xl border text-center transition-all text-sm ${selectedInterests.includes(id)
                                            ? 'bg-[#22d3ee]/15 border-[#22d3ee]/50 text-white scale-105'
                                            : 'bg-white/3 border-white/10 text-gray-400 hover:border-white/20'}`}>
                                        <div className="text-xl mb-1">{emoji}</div>
                                        <div className="text-[10px] font-bold uppercase tracking-wider">{label}</div>
                                    </button>
                                ))}
                            </div>
                            <button onClick={() => setStep(1)} disabled={selectedInterests.length === 0}
                                className="w-full bg-gradient-to-r from-[#22d3ee] to-[#a855f7] text-black font-black py-3 rounded-xl uppercase tracking-widest disabled:opacity-30 transition-all hover:opacity-90">
                                Continue →
                            </button>
                        </div>
                    )}

                    {/* Step 1: Profile */}
                    {step === 1 && (
                        <div className="space-y-6">
                            <div className="text-center">
                                <h2 className="text-2xl font-black tracking-widest mb-2">YOUR IDENTITY</h2>
                                <p className="text-gray-400 text-sm">Set up your profile</p>
                            </div>
                            <div className="space-y-4">
                                <div>
                                    <label className="text-[10px] font-mono text-gray-400 uppercase tracking-widest mb-2 block">Display Name</label>
                                    <input type="text" value={displayName} onChange={e => setDisplayName(e.target.value)}
                                        className="w-full bg-black/50 border border-white/10 rounded-lg py-3 px-4 text-sm text-white focus:border-[#22d3ee] outline-none"
                                        placeholder="Enter your name..." />
                                </div>
                                <div>
                                    <label className="text-[10px] font-mono text-gray-400 uppercase tracking-widest mb-2 block">Bio (optional)</label>
                                    <textarea value={bio} onChange={e => setBio(e.target.value)} rows={2}
                                        className="w-full bg-black/50 border border-white/10 rounded-lg py-3 px-4 text-sm text-white focus:border-[#22d3ee] outline-none resize-none"
                                        placeholder="Tell us about yourself..." />
                                </div>
                            </div>
                            <div className="flex gap-3">
                                <button onClick={() => setStep(0)} className="flex-1 bg-white/5 border border-white/10 text-gray-400 font-bold py-3 rounded-xl uppercase tracking-wider text-sm hover:text-white">← Back</button>
                                <button onClick={submitProfile}
                                    className="flex-1 bg-gradient-to-r from-[#22d3ee] to-[#a855f7] text-black font-black py-3 rounded-xl uppercase tracking-widest hover:opacity-90">
                                    Continue →
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Step 2: Welcome Bonus */}
                    {step === 2 && (
                        <div className="space-y-6 text-center">
                            <div className="text-6xl animate-bounce">🎁</div>
                            <h2 className="text-2xl font-black tracking-widest">WELCOME BONUS</h2>
                            <p className="text-gray-400">Claim your 100 PTS to get started!</p>
                            <div className="bg-gradient-to-r from-[#22d3ee]/10 to-[#a855f7]/10 border border-white/10 rounded-2xl p-6">
                                <div className="text-4xl font-black text-[#22d3ee]">100 PTS</div>
                                <div className="text-[10px] font-mono text-gray-500 mt-1">ONE-TIME WELCOME GIFT</div>
                            </div>
                            {!bonusClaimed ? (
                                <button onClick={claimBonus}
                                    className="w-full bg-gradient-to-r from-[#22d3ee] to-[#a855f7] text-black font-black py-4 rounded-xl uppercase tracking-widest hover:opacity-90 shadow-[0_0_30px_rgba(34,211,238,0.3)]">
                                    Claim Now 🎉
                                </button>
                            ) : (
                                <div className="text-green-400 font-bold text-lg animate-pulse">✓ Bonus Claimed! Entering Nexus...</div>
                            )}
                            <button onClick={onComplete} className="text-gray-600 text-xs hover:text-gray-400 transition-colors">
                                Skip for now →
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
