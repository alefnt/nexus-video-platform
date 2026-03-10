/**
 * VideoPlayer Sub-Components
 *
 * Extracted from VideoPlayer.tsx (57KB → split into reusable parts)
 * Import: import { VideoControls, VideoSidebar, VideoComments } from '../components/video';
 */

import React, { useState, useRef, useCallback, useEffect } from "react";

// ═══ Video Controls Bar ═══

interface VideoControlsProps {
    isPlaying: boolean;
    currentTime: number;
    duration: number;
    volume: number;
    isMuted: boolean;
    isFullscreen: boolean;
    quality: string;
    playbackRate: number;
    onPlayPause: () => void;
    onSeek: (time: number) => void;
    onVolumeChange: (vol: number) => void;
    onMute: () => void;
    onFullscreen: () => void;
    onQualityChange: (q: string) => void;
    onPlaybackRateChange: (r: number) => void;
}

export function VideoControls({
    isPlaying, currentTime, duration, volume, isMuted,
    isFullscreen, quality, playbackRate,
    onPlayPause, onSeek, onVolumeChange, onMute,
    onFullscreen, onQualityChange, onPlaybackRateChange,
}: VideoControlsProps) {
    const formatTime = (s: number) => {
        const m = Math.floor(s / 60);
        const sec = Math.floor(s % 60);
        return `${m}:${sec.toString().padStart(2, "0")}`;
    };

    const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

    return (
        <div className="video-controls" style={{
            display: "flex", alignItems: "center", gap: "12px",
            padding: "8px 16px", background: "rgba(0,0,0,0.85)",
            borderRadius: "8px", backdropFilter: "blur(10px)",
        }}>
            <button onClick={onPlayPause} style={{ background: "none", border: "none", color: "#fff", fontSize: "20px", cursor: "pointer" }}>
                {isPlaying ? "⏸" : "▶️"}
            </button>

            <span style={{ color: "#aaa", fontSize: "13px", minWidth: "80px" }}>
                {formatTime(currentTime)} / {formatTime(duration)}
            </span>

            <div style={{ flex: 1, height: "4px", background: "#333", borderRadius: "2px", cursor: "pointer", position: "relative" }}
                onClick={(e) => {
                    const rect = e.currentTarget.getBoundingClientRect();
                    const pct = (e.clientX - rect.left) / rect.width;
                    onSeek(pct * duration);
                }}>
                <div style={{ width: `${progress}%`, height: "100%", background: "linear-gradient(90deg, #6c5ce7, #a29bfe)", borderRadius: "2px" }} />
            </div>

            <button onClick={onMute} style={{ background: "none", border: "none", color: "#fff", cursor: "pointer" }}>
                {isMuted ? "🔇" : volume > 0.5 ? "🔊" : "🔉"}
            </button>

            <select value={quality} onChange={(e) => onQualityChange(e.target.value)}
                style={{ background: "#333", color: "#fff", border: "none", borderRadius: "4px", padding: "2px 6px", fontSize: "12px" }}>
                <option value="auto">Auto</option>
                <option value="1080p">1080p</option>
                <option value="720p">720p</option>
                <option value="480p">480p</option>
            </select>

            <select value={playbackRate} onChange={(e) => onPlaybackRateChange(parseFloat(e.target.value))}
                style={{ background: "#333", color: "#fff", border: "none", borderRadius: "4px", padding: "2px 6px", fontSize: "12px" }}>
                <option value="0.5">0.5x</option>
                <option value="1">1x</option>
                <option value="1.5">1.5x</option>
                <option value="2">2x</option>
            </select>

            <button onClick={onFullscreen} style={{ background: "none", border: "none", color: "#fff", cursor: "pointer" }}>
                {isFullscreen ? "⛶" : "⛶"}
            </button>
        </div>
    );
}

// ═══ Video Sidebar (Recommendations) ═══

interface VideoSidebarProps {
    videos: Array<{ id: string; title: string; thumbnail?: string; views?: number; creator?: string }>;
    onSelect: (id: string) => void;
}

export function VideoSidebar({ videos, onSelect }: VideoSidebarProps) {
    return (
        <div className="video-sidebar" style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            <h3 style={{ fontSize: "16px", fontWeight: 600, color: "#fff", margin: 0 }}>推荐视频</h3>
            {videos.map((v) => (
                <div key={v.id} onClick={() => onSelect(v.id)}
                    style={{
                        display: "flex", gap: "10px", cursor: "pointer", padding: "8px",
                        borderRadius: "8px", transition: "background 0.2s",
                    }}
                    onMouseOver={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.05)")}
                    onMouseOut={(e) => (e.currentTarget.style.background = "transparent")}>
                    <div style={{
                        width: "160px", height: "90px", borderRadius: "6px",
                        background: v.thumbnail ? `url(${v.thumbnail}) center/cover` : "#333",
                        flexShrink: 0,
                    }} />
                    <div>
                        <div style={{ fontSize: "13px", fontWeight: 500, color: "#eee", lineHeight: 1.3 }}>
                            {v.title?.substring(0, 60)}
                        </div>
                        {v.creator && <div style={{ fontSize: "12px", color: "#888", marginTop: "4px" }}>{v.creator}</div>}
                        {v.views !== undefined && <div style={{ fontSize: "11px", color: "#666", marginTop: "2px" }}>{v.views.toLocaleString()} 次观看</div>}
                    </div>
                </div>
            ))}
        </div>
    );
}

// ═══ Video Comments Section ═══

interface Comment {
    id: string;
    userId: string;
    username: string;
    avatar?: string;
    content: string;
    createdAt: string;
    likes: number;
    replies?: Comment[];
}

interface VideoCommentsProps {
    comments: Comment[];
    onSubmit: (content: string) => void;
    onLike: (commentId: string) => void;
    isLoggedIn: boolean;
}

export function VideoComments({ comments, onSubmit, onLike, isLoggedIn }: VideoCommentsProps) {
    const [newComment, setNewComment] = useState("");

    const handleSubmit = () => {
        if (!newComment.trim()) return;
        onSubmit(newComment.trim());
        setNewComment("");
    };

    return (
        <div className="video-comments" style={{ marginTop: "24px" }}>
            <h3 style={{ fontSize: "16px", fontWeight: 600, color: "#fff", marginBottom: "16px" }}>
                评论 ({comments.length})
            </h3>

            {isLoggedIn && (
                <div style={{ display: "flex", gap: "12px", marginBottom: "24px" }}>
                    <input value={newComment} onChange={(e) => setNewComment(e.target.value)}
                        placeholder="发表评论..."
                        onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
                        style={{
                            flex: 1, padding: "10px 16px", background: "rgba(255,255,255,0.05)",
                            border: "1px solid rgba(255,255,255,0.1)", borderRadius: "8px",
                            color: "#fff", fontSize: "14px", outline: "none",
                        }} />
                    <button onClick={handleSubmit} style={{
                        padding: "10px 20px", background: "linear-gradient(135deg, #6c5ce7, #a29bfe)",
                        border: "none", borderRadius: "8px", color: "#fff", cursor: "pointer",
                        fontWeight: 500,
                    }}>
                        发送
                    </button>
                </div>
            )}

            {comments.map((c) => (
                <div key={c.id} style={{ display: "flex", gap: "12px", marginBottom: "16px", padding: "12px", borderRadius: "8px", background: "rgba(255,255,255,0.02)" }}>
                    <div style={{
                        width: "36px", height: "36px", borderRadius: "50%", flexShrink: 0,
                        background: c.avatar ? `url(${c.avatar}) center/cover` : `hsl(${c.username.charCodeAt(0) * 10}, 60%, 50%)`,
                    }} />
                    <div style={{ flex: 1 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
                            <span style={{ fontSize: "13px", fontWeight: 600, color: "#ddd" }}>{c.username}</span>
                            <span style={{ fontSize: "11px", color: "#666" }}>{new Date(c.createdAt).toLocaleDateString()}</span>
                        </div>
                        <p style={{ fontSize: "14px", color: "#bbb", lineHeight: 1.5, margin: 0 }}>{c.content}</p>
                        <button onClick={() => onLike(c.id)} style={{
                            background: "none", border: "none", color: "#888", cursor: "pointer",
                            fontSize: "12px", marginTop: "6px", padding: 0,
                        }}>
                            👍 {c.likes}
                        </button>
                    </div>
                </div>
            ))}
        </div>
    );
}

// ═══ Video Engagement Bar (Like/Share/Save) ═══

interface VideoEngagementProps {
    likes: number;
    isLiked: boolean;
    isSaved: boolean;
    shareCount: number;
    onLike: () => void;
    onSave: () => void;
    onShare: () => void;
    onTip: () => void;
}

export function VideoEngagement({ likes, isLiked, isSaved, shareCount, onLike, onSave, onShare, onTip }: VideoEngagementProps) {
    const btnStyle = (active: boolean): React.CSSProperties => ({
        display: "flex", alignItems: "center", gap: "6px",
        padding: "8px 16px", borderRadius: "20px",
        background: active ? "rgba(108, 92, 231, 0.2)" : "rgba(255,255,255,0.05)",
        border: active ? "1px solid rgba(108, 92, 231, 0.5)" : "1px solid rgba(255,255,255,0.1)",
        color: active ? "#a29bfe" : "#aaa",
        cursor: "pointer", fontSize: "13px", fontWeight: 500,
        transition: "all 0.2s",
    });

    return (
        <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
            <button onClick={onLike} style={btnStyle(isLiked)}>
                {isLiked ? "❤️" : "🤍"} {likes.toLocaleString()}
            </button>
            <button onClick={onSave} style={btnStyle(isSaved)}>
                {isSaved ? "⭐" : "☆"} 收藏
            </button>
            <button onClick={onShare} style={btnStyle(false)}>
                🔗 分享 {shareCount > 0 ? shareCount : ""}
            </button>
            <button onClick={onTip} style={btnStyle(false)}>
                🎁 打赏
            </button>
        </div>
    );
}
