// FILE: /video-platform/client-web/src/contexts/GlobalMusicContext.tsx
/**
 * GlobalMusicContext — Provides persistent music playback across pages.
 * 
 * Business Logic:
 * 1. Mini-player only appears AFTER user explicitly presses Play
 * 2. Mini-player is hidden on the /music page (which has its own full player UI)
 * 3. loadTrack() prepares a track without starting playback
 * 4. playTrack() starts playback AND shows the mini-player
 * 5. close() stops playback and hides the mini-player
 * 6. Music persists across page navigation (articles, explore, etc.)
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
    /** Currently loaded track, or null */
    currentTrack: GlobalTrack | null;
    /** Full playlist */
    playlist: GlobalTrack[];
    /** Is audio currently playing */
    isPlaying: boolean;
    /** Current playback position (seconds) */
    currentTime: number;
    /** Total duration (seconds) */
    duration: number;
    /** Has the user explicitly activated the player (played at least once)? */
    activated: boolean;

    // Actions
    /** Load a track into the player WITHOUT starting playback */
    loadTrack: (track: GlobalTrack, playlist?: GlobalTrack[]) => void;
    /** Start playback of the current track (or load + play a new one) */
    playTrack: (track?: GlobalTrack, playlist?: GlobalTrack[]) => void;
    /** Toggle play/pause */
    togglePlay: () => void;
    nextTrack: () => void;
    prevTrack: () => void;
    seekTo: (time: number) => void;
    /** Stop playback and hide the mini-player */
    close: () => void;
    /** Set playlist without affecting playback */
    setPlaylist: (tracks: GlobalTrack[]) => void;
}

const noop = () => { };
const GlobalMusicContext = createContext<GlobalMusicState>({
    currentTrack: null,
    playlist: [],
    isPlaying: false,
    currentTime: 0,
    duration: 0,
    activated: false,
    loadTrack: noop,
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
    /** activated = user has explicitly pressed Play at least once in this session */
    const [activated, setActivated] = useState(false);

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

    /** Load a track into the player WITHOUT starting playback or showing mini-player */
    const loadTrack = useCallback((track: GlobalTrack, newPlaylist?: GlobalTrack[]) => {
        if (newPlaylist) setPlaylistState(newPlaylist);
        setCurrentTrack(track);
        // Prepare the audio source but don't play
        if (audioRef.current) {
            audioRef.current.src = track.audioUrl;
        }
    }, []);

    /** Start playback (shows mini-player, marks as activated) */
    const playTrack = useCallback((track?: GlobalTrack, newPlaylist?: GlobalTrack[]) => {
        if (newPlaylist) setPlaylistState(newPlaylist);
        if (track) {
            setCurrentTrack(track);
            if (audioRef.current) {
                audioRef.current.src = track.audioUrl;
            }
        }
        setActivated(true);
        if (audioRef.current) {
            audioRef.current.play().catch(() => { });
        }
    }, []);

    const togglePlay = useCallback(() => {
        if (!audioRef.current || !currentTrack) return;
        if (isPlaying) {
            audioRef.current.pause();
        } else {
            setActivated(true); // First play activates the mini-player
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
        setActivated(false);
    }, []);

    const setPlaylist = useCallback((tracks: GlobalTrack[]) => {
        setPlaylistState(tracks);
    }, []);

    return (
        <GlobalMusicContext.Provider value={{
            currentTrack, playlist, isPlaying, currentTime, duration, activated,
            loadTrack, playTrack, togglePlay, nextTrack, prevTrack, seekTo, close, setPlaylist,
        }}>
            {children}
        </GlobalMusicContext.Provider>
    );
}

export default GlobalMusicContext;
