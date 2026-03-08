import React, { useRef, useEffect } from 'react';
import videojs from 'video.js';
import 'video.js/dist/video-js.css';

interface VideoJSProps {
    options: any; // Using any to be flexible with video.js options
    onReady?: (player: any) => void;
}

export const VideoJS = (props: VideoJSProps) => {
    const videoRef = useRef<HTMLDivElement>(null);
    const playerRef = useRef<any>(null);
    const { options, onReady } = props;

    useEffect(() => {
        // Make sure Video.js player is only initialized once
        if (!playerRef.current) {
            if (!videoRef.current) return;

            const videoElement = document.createElement("video-js");
            videoElement.classList.add('vjs-big-play-centered');
            videoRef.current.appendChild(videoElement);

            const player = playerRef.current = videojs(videoElement, options, () => {
                videojs.log('player is ready');
                onReady && onReady(player);
            });

        } else {
            const player = playerRef.current;
            player.autoplay(options.autoplay);
            player.src(options.sources);
        }
    }, [options, videoRef]);

    // Dispose the player on unmount
    useEffect(() => {
        const player = playerRef.current;

        return () => {
            if (player && !player.isDisposed()) {
                player.dispose();
                playerRef.current = null;
            }
        };
    }, [playerRef]);

    return (
        <div data-vjs-player>
            <div ref={videoRef} />
        </div>
    );
}

export default VideoJS;
