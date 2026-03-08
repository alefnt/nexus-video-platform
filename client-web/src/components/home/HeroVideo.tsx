import React from "react";
import { Button } from "../ui";
import { Play, Volume2, VolumeX, Sparkles } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface HeroVideoProps {
    videoId: string;
    title: string;
    description: string;
    videoUrl?: string;
}

export const HeroVideo: React.FC<HeroVideoProps> = ({ videoId, title, description, videoUrl }) => {
    const navigate = useNavigate();
    const [muted, setMuted] = React.useState(true);

    return (
        <div className="relative h-full w-full group overflow-hidden rounded-xl">
            {/* Animated Border Gradient */}
            <div className="absolute -inset-[1px] bg-gradient-to-r from-nexus-purple via-nexus-cyan to-nexus-pink rounded-xl opacity-60 group-hover:opacity-100 blur-[2px] transition-opacity duration-500 animate-pulse" />

            <div className="relative h-full w-full bg-black rounded-xl overflow-hidden">
                {/* Video Background with Parallax Effect */}
                <div
                    className="absolute inset-0 bg-cover bg-center transition-all duration-700 group-hover:scale-110 group-hover:blur-[1px]"
                    style={{ backgroundImage: `url(https://picsum.photos/seed/${videoId}/800/600)` }}
                />

                {/* Multi-layer Gradient Overlay */}
                <div className="absolute inset-0 bg-gradient-to-t from-black via-black/50 to-transparent" />
                <div className="absolute inset-0 bg-gradient-to-r from-black/40 via-transparent to-transparent" />

                {/* Animated Particles Overlay */}
                <div className="absolute inset-0 opacity-30">
                    <div className="absolute top-1/4 left-1/4 w-2 h-2 bg-nexus-cyan rounded-full animate-ping" />
                    <div className="absolute top-1/3 right-1/3 w-1 h-1 bg-nexus-purple rounded-full animate-ping delay-300" />
                    <div className="absolute bottom-1/3 right-1/4 w-1.5 h-1.5 bg-nexus-pink rounded-full animate-ping delay-700" />
                </div>

                {/* Content Overlay */}
                <div className="absolute bottom-0 left-0 right-0 p-8 z-10 flex flex-col justify-end h-full">
                    {/* Badges */}
                    <div className="mb-4 inline-flex items-center gap-2 flex-wrap">
                        <span className="px-3 py-1 rounded-full text-[10px] font-bold bg-gradient-to-r from-nexus-cyan to-nexus-cyan/80 text-black tracking-wider uppercase shadow-[0_0_15px_rgba(0,245,212,0.5)] flex items-center gap-1">
                            <Sparkles className="w-3 h-3" />
                            Premiere
                        </span>
                        <span className="px-3 py-1 rounded-full text-[10px] font-bold bg-black/50 text-white border border-white/20 backdrop-blur-md uppercase tracking-wider flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse" />
                            Live Now
                        </span>
                    </div>

                    {/* Title with Glow Effect */}
                    <h2 className="text-3xl md:text-4xl font-black text-white mb-3 leading-tight tracking-tight drop-shadow-[0_2px_10px_rgba(0,0,0,0.8)] line-clamp-2">
                        {title}
                    </h2>

                    <p className="text-sm text-gray-300/90 mb-6 line-clamp-2 max-w-lg leading-relaxed">
                        {description}
                    </p>

                    {/* Action Buttons */}
                    <div className="flex items-center gap-4">
                        <Button
                            variant="secondary"
                            size="lg"
                            className="shadow-[0_0_25px_rgba(0,245,212,0.4)] hover:shadow-[0_0_35px_rgba(0,245,212,0.6)] px-8 font-bold"
                            onClick={() => navigate(`/player/${videoId}`)}
                        >
                            <Play className="w-5 h-5 mr-2 fill-current" />
                            Watch Now
                        </Button>

                        <button
                            onClick={() => setMuted(!muted)}
                            className="p-3 rounded-full bg-white/10 border border-white/20 hover:bg-white/20 hover:border-nexus-cyan/50 transition-all duration-300 backdrop-blur-md group/mute"
                        >
                            {muted ? (
                                <VolumeX className="w-5 h-5 text-white/70 group-hover/mute:text-white transition-colors" />
                            ) : (
                                <Volume2 className="w-5 h-5 text-nexus-cyan" />
                            )}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};
