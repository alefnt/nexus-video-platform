import { useNavigate } from "react-router-dom";
import { Button } from "../ui";
import { Radio } from "lucide-react";
import { useLiveRooms } from "../../hooks/useApi";

export const LiveWidget = () => {
    const navigate = useNavigate();
    const { data: rawData, isLoading } = useLiveRooms();
    const rooms = (Array.isArray(rawData) ? rawData : (rawData as any)?.rooms || []) as any[];

    // Pick the first active room, or null if none
    const activeRoom = rooms.length > 0 ? rooms[0] : null;

    return (
        <div className="relative h-full w-full group overflow-hidden bg-black" onClick={() => activeRoom ? navigate(`/live/${activeRoom.id || activeRoom.roomId}`) : null}>
            {/* Background Image */}
            <div
                className={`absolute inset-0 bg-cover bg-center transition-transform duration-700 group-hover:scale-110 ${isLoading ? 'animate-pulse bg-white/5' : ''}`}
                style={{ backgroundImage: activeRoom ? `url(${activeRoom.coverUrl || 'https://picsum.photos/seed/live_gaming/400/800'})` : 'url(https://picsum.photos/seed/offline_stream/400/800)' }}
            />

            {/* Gradient Overlay */}
            <div className="absolute inset-0 bg-gradient-to-t from-black via-black/50 to-transparent" />

            {/* Live Badge */}
            {activeRoom && (
                <div className="absolute top-4 left-4 flex items-center gap-1.5 px-2 py-1 rounded-full bg-red-500/90 backdrop-blur-sm shadow-[0_0_15px_rgba(239,68,68,0.5)]">
                    <Radio className="w-3 h-3 text-white animate-pulse" />
                    <span className="text-[10px] font-bold text-white uppercase tracking-wider">Live</span>
                </div>
            )}

            {!activeRoom && !isLoading && (
                <div className="absolute top-4 left-4 flex items-center gap-1.5 px-2 py-1 rounded-full bg-white/20 backdrop-blur-sm">
                    <span className="text-[10px] font-bold text-white uppercase tracking-wider">Offline</span>
                </div>
            )}

            {/* Content */}
            <div className="absolute bottom-0 left-0 right-0 p-5 flex flex-col z-10 pointer-events-none">
                {/* Streamer Info */}
                <div className="flex items-center gap-2 mb-2">
                    <div className="w-8 h-8 rounded-full bg-nexus-cyan/20 border-2 border-nexus-cyan p-0.5 flex-shrink-0 overflow-hidden">
                        <img
                            src={activeRoom?.creatorAvatar || "https://picsum.photos/seed/avatar1/100/100"}
                            className="w-full h-full rounded-full object-cover"
                            alt="Streamer"
                        />
                    </div>
                    <span className="text-sm font-bold text-white drop-shadow-md truncate">
                        {isLoading ? "Loading..." : activeRoom ? (activeRoom.creatorName || "Nexus Streamer") : "No Active Streams"}
                    </span>
                </div>

                {/* Stream Title */}
                <h3 className="text-base font-black text-white leading-tight mb-4 drop-shadow-md line-clamp-2">
                    {activeRoom ? activeRoom.title : "Waiting for creators to go live..."}
                </h3>

                {/* Join Button */}
                <Button
                    variant={activeRoom ? "primary" : "ghost"}
                    size="sm"
                    className={`w-full pointer-events-auto ${!activeRoom ? 'border border-white/20 hover:bg-white/10' : ''}`}
                    onClick={(e) => {
                        e.stopPropagation();
                        navigate(activeRoom ? `/live/${activeRoom.id || activeRoom.roomId}` : '/explore')
                    }}
                >
                    {activeRoom && <Radio className="w-3.5 h-3.5 mr-2 animate-pulse" />}
                    {activeRoom ? "Join Stream" : "Browse Channels"}
                </Button>
            </div>
        </div>
    );
};
