// FILE: /video-platform/client-web/src/contexts/GlobalMusicContext.tsx
/**
 * GlobalMusicContext — Provides persistent music playback across pages.
 * 
 * This context holds a shared audio element and playlist state that survives
 * page navigation, so users can listen to music while reading articles,
 * browsing videos, or doing anything else in the app.
 */

import React, { createContext, useContext, useState, useRef, useCallback, useEffect } from 'react';

export interface GlobalTrack {
    id: string;
    title: string;
    artist: string;
    coverUrl?: string;
    audioUrl: string;
}

interface GlobalMusicState {
    /** Currently playing track, or null */
    currentTrack: GlobalTrack | null;
    /** Full playlist */
    playlist: GlobalTrack[];
    /** Is audio currently playing */
    isPlaying: boolean;
    /** Current playback position (seconds) */
    currentTime: number;
    /** Total duration (seconds) */
    duration: number;
    /** Is the mini-player visible */
    visible: boolean;

    // Actions
    playTrack: (track: GlobalTrack, playlist?: GlobalTrack[]) => void;
    togglePlay: () => void;
    nextTrack: () => void;
    prevTrack: () => void;
    seekTo: (time: number) => void;
    close: () => void;
    /** Set playlist without starting playback */
    setPlaylist: (tracks: GlobalTrack[]) => void;
}

const noop = () => { };
const GlobalMusicContext = createContext<GlobalMusicState>({
    currentTrack: null,
    playlist: [],
    isPlaying: false,
    currentTime: 0,
    duration: 0,
    visible: false,
    playTrack: noop,
    togglePlay: noop,
    nextTrack: noop,
    prevTrack: noop,
    seekTo: noop,
    close: noop,
    setPlaylist: noop,
});

export function useGlobalMusic() {
    return useContext(GlobalMusicContext);
}

export function GlobalMusicProvider({ children }: { children: React.ReactNode }) {
    const audioRef = useRef<HTMLAudioElement | null>(null);
    const [currentTrack, setCurrentTrack] = useState<GlobalTrack | null>(null);
    const [playlist, setPlaylistState] = useState<GlobalTrack[]>([]);
    const [isPlaying, setIsPlaying] = useState(false);
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);
    const [visible, setVisible] = useState(false);

    // Ensure audio element exists
    useEffect(() => {
        if (!audioRef.current) {
            audioRef.current = new Audio();
            audioRef.current.addEventListener('timeupdate', () => {
                setCurrentTime(audioRef.current?.currentTime || 0);
            });
            audioRef.current.addEventListener('durationchange', () => {
                setDuration(audioRef.current?.duration || 0);
            });
            audioRef.current.addEventListener('ended', () => {
                // Auto-next
                handleNext();
            });
            audioRef.current.addEventListener('play', () => setIsPlaying(true));
            audioRef.current.addEventListener('pause', () => setIsPlaying(false));
        }
        return () => {
            if (audioRef.current) {
                audioRef.current.pause();
                audioRef.current.src = '';
            }
        };
    }, []);

    const handleNext = useCallback(() => {
        setPlaylistState(prev => {
            setCurrentTrack(curr => {
                if (!curr || prev.length === 0) return curr;
                const idx = prev.findIndex(t => t.id === curr.id);
                const next = prev[(idx + 1) % prev.length];
                if (audioRef.current && next) {
                    audioRef.current.src = next.audioUrl;
                    audioRef.current.play().catch(() => { });
                }
                return next;
            });
            return prev;
        });
    }, []);

    const playTrack = useCallback((track: GlobalTrack, newPlaylist?: GlobalTrack[]) => {
        if (newPlaylist) setPlaylistState(newPlaylist);
        setCurrentTrack(track);
        setVisible(true);
        if (audioRef.current) {
            audioRef.current.src = track.audioUrl;
            audioRef.current.play().catch(() => { });
        }
    }, []);

    const togglePlay = useCallback(() => {
        if (!audioRef.current || !currentTrack) return;
        if (isPlaying) {
            audioRef.current.pause();
        } else {
            audioRef.current.play().catch(() => { });
        }
    }, [isPlaying, currentTrack]);

    const nextTrack = useCallback(() => {
        if (!currentTrack || playlist.length === 0) return;
        const idx = playlist.findIndex(t => t.id === currentTrack.id);
        const next = playlist[(idx + 1) % playlist.length];
        playTrack(next);
    }, [currentTrack, playlist, playTrack]);

    const prevTrack = useCallback(() => {
        if (!currentTrack || playlist.length === 0) return;
        const idx = playlist.findIndex(t => t.id === currentTrack.id);
        const prev = playlist[(idx - 1 + playlist.length) % playlist.length];
        playTrack(prev);
    }, [currentTrack, playlist, playTrack]);

    const seekTo = useCallback((time: number) => {
        if (audioRef.current) audioRef.current.currentTime = time;
    }, []);

    const close = useCallback(() => {
        if (audioRef.current) {
            audioRef.current.pause();
            audioRef.current.src = '';
        }
        setCurrentTrack(null);
        setIsPlaying(false);
        setVisible(false);
    }, []);

    const setPlaylist = useCallback((tracks: GlobalTrack[]) => {
        setPlaylistState(tracks);
    }, []);

    return (
        <GlobalMusicContext.Provider value={{
            currentTrack, playlist, isPlaying, currentTime, duration, visible,
            playTrack, togglePlay, nextTrack, prevTrack, seekTo, close, setPlaylist,
        }}>
            {children}
        </GlobalMusicContext.Provider>
    );
}

export default GlobalMusicContext;
