// FILE: /video-platform/client-web/src/components/GlobalMiniPlayer.tsx
/**
 * GlobalMiniPlayer — Persistent floating mini player that appears at the bottom
 * of the screen when music is playing. Survives page navigation.
 * Uses the GlobalMusicContext for state management.
 */

import React from 'react';
import { useGlobalMusic } from '../contexts/GlobalMusicContext';
import { Play, Pause, SkipBack, SkipForward, X, Music } from 'lucide-react';

export default function GlobalMiniPlayer() {
    const {
        currentTrack, isPlaying, currentTime, duration, visible,
        togglePlay, nextTrack, prevTrack, seekTo, close,
    } = useGlobalMusic();

    if (!visible || !currentTrack) return null;

    const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

    const fmt = (s: number) => {
        const m = Math.floor(s / 60);
        const sec = Math.floor(s % 60);
        return `${m}:${String(sec).padStart(2, '0')}`;
    };

    return (
        <div
            id="global-mini-player"
            style={{
                position: 'fixed',
                bottom: 0,
                left: 0,
                right: 0,
                height: 64,
                background: 'rgba(10, 10, 18, 0.95)',
                backdropFilter: 'blur(20px)',
                borderTop: '1px solid rgba(168, 85, 247, 0.3)',
                zIndex: 9999,
                display: 'flex',
                alignItems: 'center',
                padding: '0 16px',
                gap: 12,
                boxShadow: '0 -4px 30px rgba(0,0,0,0.5)',
            }}
        >
            {/* Progress bar at top */}
            <div
                style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    height: 3,
                    background: 'rgba(255,255,255,0.1)',
                    cursor: 'pointer',
                }}
                onClick={(e) => {
                    const rect = e.currentTarget.getBoundingClientRect();
                    const ratio = (e.clientX - rect.left) / rect.width;
                    seekTo(ratio * duration);
                }}
            >
                <div
                    style={{
                        height: '100%',
                        width: `${progress}%`,
                        background: 'linear-gradient(90deg, #a855f7, #ec4899)',
                        transition: 'width 0.3s linear',
                        position: 'relative',
                    }}
                >
                    <div style={{
                        position: 'absolute',
                        right: -4,
                        top: -3,
                        width: 8,
                        height: 8,
                        borderRadius: '50%',
                        background: '#fff',
                        boxShadow: '0 0 8px rgba(168,85,247,0.8)',
                    }} />
                </div>
            </div>

            {/* Cover Art */}
            <div style={{
                width: 44,
                height: 44,
                borderRadius: 8,
                overflow: 'hidden',
                flexShrink: 0,
                background: '#1a1a2e',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                border: '1px solid rgba(168,85,247,0.3)',
            }}>
                {currentTrack.coverUrl ? (
                    <img
                        src={currentTrack.coverUrl}
                        alt={currentTrack.title}
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    />
                ) : (
                    <Music size={20} style={{ color: '#a855f7' }} />
                )}
            </div>

            {/* Track Info */}
            <div style={{ flex: 1, minWidth: 0, overflow: 'hidden' }}>
                <div style={{
                    color: '#fff',
                    fontSize: 13,
                    fontWeight: 700,
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                }}>
                    {currentTrack.title}
                </div>
                <div style={{
                    color: '#a855f7',
                    fontSize: 11,
                    fontFamily: 'monospace',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                }}>
                    {currentTrack.artist}
                    <span style={{ color: 'rgba(255,255,255,0.3)', marginLeft: 8 }}>
                        {fmt(currentTime)} / {fmt(duration)}
                    </span>
                </div>
            </div>

            {/* Controls */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                <button
                    onClick={prevTrack}
                    style={{ background: 'none', border: 'none', color: '#888', cursor: 'pointer', padding: 4 }}
                    title="Previous"
                >
                    <SkipBack size={16} />
                </button>
                <button
                    onClick={togglePlay}
                    style={{
                        background: '#fff',
                        border: 'none',
                        color: '#000',
                        width: 36,
                        height: 36,
                        borderRadius: '50%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: 'pointer',
                        boxShadow: '0 0 12px rgba(255,255,255,0.2)',
                        transition: 'transform 0.15s',
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.transform = 'scale(1.1)')}
                    onMouseLeave={(e) => (e.currentTarget.style.transform = 'scale(1)')}
                    title={isPlaying ? 'Pause' : 'Play'}
                >
                    {isPlaying ? <Pause size={16} /> : <Play size={16} style={{ marginLeft: 2 }} />}
                </button>
                <button
                    onClick={nextTrack}
                    style={{ background: 'none', border: 'none', color: '#888', cursor: 'pointer', padding: 4 }}
                    title="Next"
                >
                    <SkipForward size={16} />
                </button>
            </div>

            {/* Close */}
            <button
                onClick={close}
                style={{
                    background: 'none',
                    border: 'none',
                    color: '#555',
                    cursor: 'pointer',
                    padding: 4,
                    marginLeft: 4,
                }}
                title="Close player"
            >
                <X size={16} />
            </button>
        </div>
    );
}
