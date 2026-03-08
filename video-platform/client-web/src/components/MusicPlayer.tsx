/**
 * MusicPlayer — Global floating music player
 * Provides playlist queue, play/pause/next/prev, shuffle, loop,
 * progress bar with seek, and volume control
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';

export interface MusicTrack {
    id: string;
    title: string;
    artist: string;
    coverUrl?: string;
    audioUrl: string;
    duration?: number;
}

interface MusicPlayerProps {
    tracks: MusicTrack[];
    initialTrackIndex?: number;
    onClose?: () => void;
}

export const MusicPlayer: React.FC<MusicPlayerProps> = ({ tracks, initialTrackIndex = 0, onClose }) => {
    const audioRef = useRef<HTMLAudioElement>(null);
    const [currentIndex, setCurrentIndex] = useState(initialTrackIndex);
    const [isPlaying, setIsPlaying] = useState(false);
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);
    const [volume, setVolume] = useState(0.8);
    const [shuffle, setShuffle] = useState(false);
    const [loop, setLoop] = useState<'none' | 'all' | 'one'>('none');
    const [minimized, setMinimized] = useState(false);

    const currentTrack = tracks[currentIndex];

    // Sync audio element
    useEffect(() => {
        const audio = audioRef.current;
        if (!audio || !currentTrack) return;
        audio.src = currentTrack.audioUrl;
        audio.volume = volume;
        if (isPlaying) audio.play().catch(() => { });
    }, [currentIndex, currentTrack?.audioUrl]);

    useEffect(() => {
        const audio = audioRef.current;
        if (audio) audio.volume = volume;
    }, [volume]);

    const togglePlay = useCallback(() => {
        const audio = audioRef.current;
        if (!audio) return;
        if (isPlaying) {
            audio.pause();
        } else {
            audio.play().catch(() => { });
        }
        setIsPlaying(!isPlaying);
    }, [isPlaying]);

    const playNext = useCallback(() => {
        if (tracks.length <= 1) return;
        if (shuffle) {
            let next = Math.floor(Math.random() * tracks.length);
            while (next === currentIndex && tracks.length > 1) next = Math.floor(Math.random() * tracks.length);
            setCurrentIndex(next);
        } else {
            setCurrentIndex(prev => (prev + 1) % tracks.length);
        }
        setIsPlaying(true);
    }, [shuffle, currentIndex, tracks.length]);

    const playPrev = useCallback(() => {
        const audio = audioRef.current;
        if (audio && audio.currentTime > 3) {
            audio.currentTime = 0;
            return;
        }
        setCurrentIndex(prev => (prev - 1 + tracks.length) % tracks.length);
        setIsPlaying(true);
    }, [tracks.length]);

    const handleEnded = useCallback(() => {
        if (loop === 'one') {
            const audio = audioRef.current;
            if (audio) { audio.currentTime = 0; audio.play(); }
        } else if (loop === 'all' || currentIndex < tracks.length - 1) {
            playNext();
        } else {
            setIsPlaying(false);
        }
    }, [loop, currentIndex, tracks.length, playNext]);

    const handleSeek = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
        const audio = audioRef.current;
        if (!audio || !duration) return;
        const rect = e.currentTarget.getBoundingClientRect();
        const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
        audio.currentTime = ratio * duration;
    }, [duration]);

    const formatTime = (s: number) => {
        const m = Math.floor(s / 60);
        const sec = Math.floor(s % 60);
        return `${m}:${sec.toString().padStart(2, '0')}`;
    };

    const cycleLoop = () => {
        setLoop(prev => prev === 'none' ? 'all' : prev === 'all' ? 'one' : 'none');
    };

    if (!currentTrack || tracks.length === 0) return null;

    const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

    return (
        <>
            <audio
                ref={audioRef}
                onTimeUpdate={() => setCurrentTime(audioRef.current?.currentTime || 0)}
                onLoadedMetadata={() => setDuration(audioRef.current?.duration || 0)}
                onEnded={handleEnded}
                onPlay={() => setIsPlaying(true)}
                onPause={() => setIsPlaying(false)}
            />

            <div style={{
                position: 'fixed',
                bottom: 0,
                left: 0,
                right: 0,
                zIndex: 9990,
                background: 'rgba(10, 10, 20, 0.95)',
                backdropFilter: 'blur(20px)',
                borderTop: '1px solid rgba(139,92,246,0.2)',
                transition: 'all 0.3s ease',
                height: minimized ? 54 : 80,
            }}>
                {/* Progress bar (clickable) */}
                <div
                    style={{ height: 3, background: 'rgba(255,255,255,0.06)', cursor: 'pointer', position: 'relative' }}
                    onClick={handleSeek}
                >
                    <div style={{
                        height: '100%',
                        width: `${progress}%`,
                        background: 'linear-gradient(90deg, #8b5cf6, #06b6d4)',
                        borderRadius: 2,
                        transition: 'width 0.1s linear',
                    }} />
                </div>

                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 16,
                    padding: minimized ? '8px 20px' : '10px 24px',
                    height: minimized ? 51 : 77,
                }}>
                    {/* Track Info */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1, minWidth: 0 }}>
                        {currentTrack.coverUrl && !minimized && (
                            <img
                                src={currentTrack.coverUrl}
                                alt=""
                                style={{ width: 48, height: 48, borderRadius: 8, objectFit: 'cover', flexShrink: 0 }}
                            />
                        )}
                        <div style={{ minWidth: 0 }}>
                            <div style={{ color: '#fff', fontSize: 14, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {currentTrack.title}
                            </div>
                            {!minimized && (
                                <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 12 }}>{currentTrack.artist}</div>
                            )}
                        </div>
                    </div>

                    {/* Controls */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <button onClick={() => setShuffle(!shuffle)} style={ctrlBtn(shuffle)} title="Shuffle">🔀</button>
                        <button onClick={playPrev} style={ctrlBtn(false)} title="Previous">⏮</button>
                        <button onClick={togglePlay} style={{
                            ...ctrlBtn(false),
                            width: 40,
                            height: 40,
                            borderRadius: 20,
                            background: 'linear-gradient(135deg, #8b5cf6, #6d28d9)',
                            fontSize: 16,
                            boxShadow: '0 0 15px rgba(139,92,246,0.3)',
                        }} title={isPlaying ? 'Pause' : 'Play'}>
                            {isPlaying ? '⏸' : '▶️'}
                        </button>
                        <button onClick={playNext} style={ctrlBtn(false)} title="Next">⏭</button>
                        <button onClick={cycleLoop} style={ctrlBtn(loop !== 'none')} title={`Loop: ${loop}`}>
                            {loop === 'one' ? '🔂' : '🔁'}
                        </button>
                    </div>

                    {/* Time + Volume */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1, justifyContent: 'flex-end' }}>
                        {!minimized && (
                            <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', fontFamily: 'monospace' }}>
                                {formatTime(currentTime)} / {formatTime(duration)}
                            </span>
                        )}
                        {!minimized && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                <span style={{ fontSize: 12 }}>🔊</span>
                                <input
                                    type="range"
                                    min={0}
                                    max={1}
                                    step={0.01}
                                    value={volume}
                                    onChange={e => setVolume(Number(e.target.value))}
                                    style={{ width: 70, accentColor: '#8b5cf6' }}
                                />
                            </div>
                        )}
                        <button onClick={() => setMinimized(!minimized)} style={ctrlBtn(false)} title={minimized ? 'Expand' : 'Minimize'}>
                            {minimized ? '⬆' : '⬇'}
                        </button>
                        {onClose && (
                            <button onClick={onClose} style={ctrlBtn(false)} title="Close">✕</button>
                        )}
                    </div>
                </div>
            </div>
        </>
    );
};

// Shared control button style
const ctrlBtn = (active: boolean): React.CSSProperties => ({
    background: active ? 'rgba(139,92,246,0.2)' : 'transparent',
    border: 'none',
    color: active ? '#c4b5fd' : 'rgba(255,255,255,0.6)',
    fontSize: 14,
    cursor: 'pointer',
    padding: 6,
    borderRadius: 8,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
});

export default MusicPlayer;
