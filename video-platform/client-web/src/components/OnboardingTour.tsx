// FILE: /video-platform/client-web/src/components/OnboardingTour.tsx
/**
 * Onboarding Tour — Interactive welcome experience for new users
 * 
 * Shows on first visit. Explains JoyID, Points, Fiber, streaming payments.
 * Steps through key features with spotlight overlays.
 */

import React, { useState, useEffect } from 'react';

interface TourStep {
    title: string;
    description: string;
    icon: string;
    highlight?: string;
}

const TOUR_STEPS: TourStep[] = [
    {
        title: 'Welcome to Nexus! 🚀',
        description: 'The next-generation decentralized video platform with Web3 payments and creator monetization.',
        icon: '🌐',
    },
    {
        title: 'Login with JoyID 🔐',
        description: 'Use Passkey authentication — no passwords, no seed phrases. Your biometrics are your keys. Click the Login button to get started.',
        icon: '🔑',
        highlight: 'login',
    },
    {
        title: 'Earn & Spend Points 💎',
        description: 'Complete tasks, watch content, and earn Points. Use them to unlock premium videos, music, and articles. Check your balance in the Points Center.',
        icon: '💰',
    },
    {
        title: 'Stream Pay ⚡',
        description: 'Pay only for what you watch. Videos charge per-second, articles per-chapter. Stop anytime — you only pay for what you consume.',
        icon: '⏱',
    },
    {
        title: 'Fiber Network 🌊',
        description: 'When Fiber is connected, you can settle payments on-chain via CKB Layer 2 payment channels — instant, near-zero fees, Bitcoin-level security.',
        icon: '🔗',
    },
    {
        title: 'AI Tools & Creation 🤖',
        description: 'Generate videos, music, and articles with AI. Browse the AI Tool Marketplace for prompts, skills, and plugins.',
        icon: '🎨',
    },
    {
        title: 'Creator Economy 🎬',
        description: 'Upload content, mint NFTs, set pricing, and earn royalties. RGB++ smart contracts automatically split revenue 70/20/10.',
        icon: '📊',
    },
    {
        title: "You're all set! 🎉",
        description: 'Explore the platform, earn points, and enjoy premium content. Your Web3 journey starts now.',
        icon: '✨',
    },
];

const STORAGE_KEY = 'nexus.onboarding_completed';

export default function OnboardingTour() {
    const [show, setShow] = useState(false);
    const [step, setStep] = useState(0);
    const [animating, setAnimating] = useState(false);

    useEffect(() => {
        const completed = localStorage.getItem(STORAGE_KEY);
        if (!completed) {
            // Delay show to let page load
            const timer = setTimeout(() => setShow(true), 1500);
            return () => clearTimeout(timer);
        }
    }, []);

    if (!show) return null;

    const currentStep = TOUR_STEPS[step];
    const isLast = step === TOUR_STEPS.length - 1;
    const progress = ((step + 1) / TOUR_STEPS.length) * 100;

    const handleNext = () => {
        if (isLast) {
            handleComplete();
            return;
        }
        setAnimating(true);
        setTimeout(() => {
            setStep(s => s + 1);
            setAnimating(false);
        }, 200);
    };

    const handleBack = () => {
        if (step > 0) {
            setAnimating(true);
            setTimeout(() => {
                setStep(s => s - 1);
                setAnimating(false);
            }, 200);
        }
    };

    const handleComplete = () => {
        localStorage.setItem(STORAGE_KEY, Date.now().toString());
        setShow(false);
    };

    return (
        <div style={{
            position: 'fixed', inset: 0, zIndex: 10000,
            background: 'rgba(0,0,0,0.85)',
            backdropFilter: 'blur(12px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            animation: 'fadeIn 0.3s ease',
        }}>
            <style>{`
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes slideUp { from { transform: translateY(20px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
        @keyframes pulse { 0%,100% { transform: scale(1); } 50% { transform: scale(1.1); } }
      `}</style>

            <div style={{
                maxWidth: 480, width: '90%',
                background: 'rgba(15, 15, 25, 0.95)',
                border: '1px solid rgba(162, 103, 255, 0.3)',
                borderRadius: 24,
                padding: 32,
                animation: 'slideUp 0.4s ease',
                position: 'relative',
            }}>
                {/* Progress bar */}
                <div style={{
                    position: 'absolute', top: 0, left: 16, right: 16, height: 3,
                    background: 'rgba(255,255,255,0.06)', borderRadius: 3,
                }}>
                    <div style={{
                        height: '100%', borderRadius: 3,
                        background: 'linear-gradient(90deg, #a267ff, #00f5d4)',
                        width: `${progress}%`,
                        transition: 'width 0.3s ease',
                    }} />
                </div>

                {/* Step counter */}
                <div style={{
                    textAlign: 'right', fontSize: 12, color: 'rgba(255,255,255,0.3)',
                    marginBottom: 16,
                }}>
                    {step + 1} / {TOUR_STEPS.length}
                </div>

                {/* Icon */}
                <div style={{
                    fontSize: 56, textAlign: 'center', marginBottom: 20,
                    animation: animating ? 'none' : 'pulse 2s ease-in-out infinite',
                }}>
                    {currentStep.icon}
                </div>

                {/* Title */}
                <h2 style={{
                    fontSize: 22, fontWeight: 700, textAlign: 'center',
                    marginBottom: 12,
                    opacity: animating ? 0 : 1,
                    transition: 'opacity 0.2s',
                }}>
                    {currentStep.title}
                </h2>

                {/* Description */}
                <p style={{
                    fontSize: 14, lineHeight: 1.6, textAlign: 'center',
                    color: 'rgba(255,255,255,0.7)',
                    marginBottom: 32, minHeight: 60,
                    opacity: animating ? 0 : 1,
                    transition: 'opacity 0.2s',
                }}>
                    {currentStep.description}
                </p>

                {/* Buttons */}
                <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
                    {step > 0 && (
                        <button
                            onClick={handleBack}
                            style={{
                                padding: '10px 24px', borderRadius: 10,
                                background: 'rgba(255,255,255,0.06)',
                                border: '1px solid rgba(255,255,255,0.1)',
                                color: 'rgba(255,255,255,0.6)', fontSize: 14,
                                fontWeight: 600, cursor: 'pointer',
                            }}
                        >
                            Back
                        </button>
                    )}

                    <button
                        onClick={handleNext}
                        style={{
                            padding: '10px 32px', borderRadius: 10,
                            background: 'linear-gradient(135deg, #a267ff, #00f5d4)',
                            border: 'none', color: '#000', fontSize: 14,
                            fontWeight: 700, cursor: 'pointer',
                            boxShadow: '0 4px 20px rgba(162, 103, 255, 0.3)',
                        }}
                    >
                        {isLast ? '🎉 Get Started' : 'Next →'}
                    </button>
                </div>

                {/* Skip */}
                {!isLast && (
                    <button
                        onClick={handleComplete}
                        style={{
                            display: 'block', margin: '16px auto 0',
                            background: 'none', border: 'none',
                            color: 'rgba(255,255,255,0.3)', fontSize: 12,
                            cursor: 'pointer', textDecoration: 'underline',
                        }}
                    >
                        Skip tour
                    </button>
                )}

                {/* Step dots */}
                <div style={{
                    display: 'flex', gap: 6, justifyContent: 'center', marginTop: 20,
                }}>
                    {TOUR_STEPS.map((_, i) => (
                        <div key={i} style={{
                            width: i === step ? 20 : 6, height: 6,
                            borderRadius: 3,
                            background: i === step
                                ? 'linear-gradient(90deg, #a267ff, #00f5d4)'
                                : i < step ? '#a267ff' : 'rgba(255,255,255,0.15)',
                            transition: 'all 0.3s ease',
                        }} />
                    ))}
                </div>
            </div>
        </div>
    );
}
