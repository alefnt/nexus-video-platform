// FILE: /video-platform/client-web/src/components/live/LivePlayer.tsx
/**
 * LiveKit Video Player Component
 * 
 * Renders video/audio tracks.
 * Assumes to be rendered inside a LiveKitRoom context.
 */

import React, { useCallback, useEffect, useState, useRef } from 'react';
import {
    VideoTrack,
    AudioTrack,
    useTracks,
    useParticipants,
    useConnectionState,
    useRemoteParticipant,
    useRoomContext,
} from '@livekit/components-react';
import { Track, ConnectionState, RoomEvent } from 'livekit-client';
import '@livekit/components-styles';
import { TrackReference } from '@livekit/components-core';

interface LivePlayerProps {
    roomId: string;
    token: string;
    serverUrl: string;
    hostIdentity: string;
    onConnectionChange?: (state: ConnectionState) => void;
    onParticipantCountChange?: (count: number) => void;
    onDataReceived?: (data: string) => void;
    className?: string;
    children?: React.ReactNode;
}

export default function LivePlayer({
    hostIdentity,
    onConnectionChange,
    onParticipantCountChange,
    onDataReceived,
    className = '',
    children,
}: LivePlayerProps) {
    const room = useRoomContext();
    const participants = useParticipants();
    const connectionState = useConnectionState();
    const [isFullscreen, setIsFullscreen] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    // Get Host Tracks
    const tracks = useTracks(
        [
            { source: Track.Source.Camera, withPlaceholder: true },
            { source: Track.Source.Microphone, withPlaceholder: true },
            { source: Track.Source.ScreenShare, withPlaceholder: false },
        ],
        { onlySubscribed: false }
    );

    // Filter Host Tracks
    let hostTracks = tracks.filter(
        (trackRef) => trackRef.participant.identity === hostIdentity
    );

    // Fallback: If no host tracks, use any camera track (for testing/loose mode)
    if (hostTracks.length === 0 || !hostTracks.some(t => t.publication.track)) {
        const anyVideoTrack = tracks.find(t =>
            t.source === Track.Source.Camera && t.publication.track
        );
        if (anyVideoTrack) {
            const publisherId = anyVideoTrack.participant.identity;
            hostTracks = tracks.filter(t => t.participant.identity === publisherId);
        }
    }

    const screenTrack = hostTracks.find(
        (t) => t.source === Track.Source.ScreenShare && t.publication.track
    );
    const cameraTrack = hostTracks.find(
        (t) => t.source === Track.Source.Camera && t.publication.track
    );
    const videoTrack = screenTrack || cameraTrack;
    const audioTrack = hostTracks.find(
        (t) => t.source === Track.Source.Microphone && t.publication.track
    );

    // Callbacks
    useEffect(() => {
        onConnectionChange?.(connectionState);
    }, [connectionState, onConnectionChange]);

    useEffect(() => {
        onParticipantCountChange?.(participants.length);
    }, [participants.length, onParticipantCountChange]);

    // Data Channel Listener
    useEffect(() => {
        if (!room) return;
        const handleData = (payload: Uint8Array, participant?: any) => {
            const message = new TextDecoder().decode(payload);
            onDataReceived?.(message);
        };
        room.on(RoomEvent.DataReceived, handleData);
        return () => {
            room.off(RoomEvent.DataReceived, handleData);
        };
    }, [room, onDataReceived]);

    // Fullscreen Toggle
    const toggleFullscreen = useCallback(() => {
        if (!containerRef.current) return;
        if (!document.fullscreenElement) {
            containerRef.current.requestFullscreen().then(() => setIsFullscreen(true));
        } else {
            document.exitFullscreen().then(() => setIsFullscreen(false));
        }
    }, []);

    // Render States
    if (connectionState === ConnectionState.Connecting) {
        return (
            <div className={`w-full aspect-video bg-black rounded-xl flex flex-col items-center justify-center text-white ${className}`}>
                <div className="w-10 h-10 border-4 border-white/20 border-t-accent-cyan rounded-full animate-spin mb-4" />
                <p className="animate-pulse">ESTABLISHING LINK...</p>
            </div>
        );
    }

    if (connectionState === ConnectionState.Disconnected) {
        return (
            <div className={`w-full aspect-video bg-black rounded-xl flex flex-col items-center justify-center text-text-muted ${className}`}>
                <p>SIGNAL LOST</p>
            </div>
        );
    }

    if (!videoTrack?.publication?.track) {
        return (
            <div className={`w-full aspect-video bg-black rounded-xl flex flex-col items-center justify-center text-white relative overflow-hidden ${className}`}>
                {/* Background Noise Effect */}
                <div className="absolute inset-0 opacity-20" style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg"%3E%3Cfilter id="noise"%3E%3CfeTurbulence type="fractalNoise" baseFrequency="0.65" numOctaves="3" stitchTiles="stitch"/%3E%3C/filter%3E%3Crect width="100%25" height="100%25" filter="url(%23noise)" opacity="1"/%3E%3C/svg%3E")' }}></div>

                <div className="z-10 text-center">
                    <div className="text-4xl mb-4 animate-bounce">📡</div>
                    <p className="font-display font-bold tracking-widest text-xl">WAITING FOR HOST</p>
                    <div className="mt-4 text-xs font-mono text-accent-cyan bg-accent-cyan/10 px-3 py-1 rounded border border-accent-cyan/30">
                        STATUS: STANDBY
                    </div>
                    <p className="mt-2 text-[10px] text-white/40">
                        {participants.length} Active Nodes
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div
            ref={containerRef}
            className={`relative w-full aspect-video bg-black rounded-xl overflow-hidden group ${isFullscreen ? 'rounded-none h-screen w-screen' : ''} ${className}`}
        >
            {/* Main Video */}
            {videoTrack?.publication?.track && (
                <VideoTrack
                    trackRef={videoTrack as TrackReference}
                    className="w-full h-full object-contain"
                />
            )}

            {/* PIP (Camera when Screen Sharing) */}
            {screenTrack && cameraTrack?.publication?.track && (
                <div className="absolute bottom-4 right-4 w-48 aspect-video rounded-lg overflow-hidden border-2 border-white/20 shadow-lg z-10 transition-transform hover:scale-105">
                    <VideoTrack
                        trackRef={cameraTrack as TrackReference}
                        className="w-full h-full object-cover"
                    />
                </div>
            )}

            {/* Audio */}
            {audioTrack?.publication?.track && (
                <AudioTrack trackRef={audioTrack as TrackReference} />
            )}

            {/* Overlays / Children (Danmaku, etc) */}
            {children}

            {/* Controls Overlay (Hover) */}
            <div className="absolute inset-0 pointers-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                {/* Viewer Count Badge */}
                <div className="absolute top-4 left-4 flex items-center gap-2 bg-black/60 backdrop-blur-sm px-3 py-1.5 rounded-full border border-white/10">
                    <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse shadow-[0_0_8px_red]" />
                    <span className="text-xs font-bold text-white tracking-wide">LIVE</span>
                    <span className="text-[10px] text-white/70 border-l border-white/20 pl-2 ml-1">
                        {participants.length} VIEWERS
                    </span>
                </div>

                {/* Fullscreen Button */}
                <button
                    onClick={toggleFullscreen}
                    className="absolute bottom-4 right-4 p-2 bg-black/60 backdrop-blur-sm rounded-lg border border-white/10 text-white hover:bg-white/10 transition-colors pointer-events-auto"
                >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        {isFullscreen ? (
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /> // Actually exit icon should be different
                        ) : (
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 4l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
                        )}
                    </svg>
                </button>
            </div>
        </div>
    );
}
