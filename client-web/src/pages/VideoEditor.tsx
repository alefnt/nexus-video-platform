/**
 * 在线视频编辑器 (基础版)
 *
 * 功能:
 * - 时间线裁剪 (选择起止点)
 * - 封面帧选择 (从视频中抽帧)
 * - 字幕添加 (时间轴标注)
 *
 * 技术: Canvas 预览 + 导出时提交到 transcode 服务处理
 * (浏览器端预览, 服务端执行, 避免 WASM 兼容性问题)
 */

import React, { useState, useRef, useEffect, useCallback } from "react";
import { getApiClient } from "../lib/apiClient";
import { useAuthStore } from "../stores";
import { setPageSEO } from "../utils/seo";

interface SubtitleEntry {
    id: string;
    startTime: number;
    endTime: number;
    text: string;
}

const VideoEditor: React.FC = () => {
    const user = useAuthStore((s) => s.user);
    const api = getApiClient();

    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);

    // 视频状态
    const [videoSrc, setVideoSrc] = useState<string>("");
    const [videoFile, setVideoFile] = useState<File | null>(null);
    const [duration, setDuration] = useState(0);
    const [currentTime, setCurrentTime] = useState(0);
    const [playing, setPlaying] = useState(false);

    // 裁剪
    const [trimStart, setTrimStart] = useState(0);
    const [trimEnd, setTrimEnd] = useState(0);

    // 封面
    const [coverFrame, setCoverFrame] = useState<string | null>(null);
    const [coverTime, setCoverTime] = useState(0);

    // 字幕
    const [subtitles, setSubtitles] = useState<SubtitleEntry[]>([]);
    const [editingSub, setEditingSub] = useState<SubtitleEntry | null>(null);

    // 导出
    const [exporting, setExporting] = useState(false);
    const [exportProgress, setExportProgress] = useState(0);

    useEffect(() => {
        setPageSEO({ title: "视频编辑器" });
    }, []);

    // 文件选择
    const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setVideoFile(file);
        const url = URL.createObjectURL(file);
        setVideoSrc(url);
    }, []);

    // 视频加载完成
    const handleLoadedMetadata = useCallback(() => {
        const video = videoRef.current;
        if (!video) return;
        setDuration(video.duration);
        setTrimEnd(video.duration);
    }, []);

    // 时间更新
    const handleTimeUpdate = useCallback(() => {
        const video = videoRef.current;
        if (!video) return;
        setCurrentTime(video.currentTime);
    }, []);

    // 播放/暂停
    const togglePlay = useCallback(() => {
        const video = videoRef.current;
        if (!video) return;
        if (video.paused) {
            video.play();
            setPlaying(true);
        } else {
            video.pause();
            setPlaying(false);
        }
    }, []);

    // 跳转
    const seekTo = useCallback((time: number) => {
        const video = videoRef.current;
        if (!video) return;
        video.currentTime = time;
        setCurrentTime(time);
    }, []);

    // 抓取封面帧
    const captureCover = useCallback(() => {
        const video = videoRef.current;
        const canvas = canvasRef.current;
        if (!video || !canvas) return;

        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        ctx.drawImage(video, 0, 0);
        const dataUrl = canvas.toDataURL("image/jpeg", 0.9);
        setCoverFrame(dataUrl);
        setCoverTime(video.currentTime);
    }, []);

    // 添加字幕
    const addSubtitle = useCallback(() => {
        const newSub: SubtitleEntry = {
            id: Date.now().toString(),
            startTime: currentTime,
            endTime: Math.min(currentTime + 3, duration),
            text: "",
        };
        setSubtitles((prev) => [...prev, newSub]);
        setEditingSub(newSub);
    }, [currentTime, duration]);

    // 更新字幕
    const updateSubtitle = useCallback((id: string, field: Partial<SubtitleEntry>) => {
        setSubtitles((prev) =>
            prev.map((s) => (s.id === id ? { ...s, ...field } : s))
        );
    }, []);

    // 删除字幕
    const deleteSubtitle = useCallback((id: string) => {
        setSubtitles((prev) => prev.filter((s) => s.id !== id));
        if (editingSub?.id === id) setEditingSub(null);
    }, [editingSub]);

    // 导出 (提交到服务端)
    const handleExport = useCallback(async () => {
        if (!videoFile || !user?.id) return;
        setExporting(true);
        setExportProgress(0);

        try {
            const formData = new FormData();
            formData.append("video", videoFile);
            formData.append("trimStart", trimStart.toString());
            formData.append("trimEnd", trimEnd.toString());
            formData.append("subtitles", JSON.stringify(subtitles));
            if (coverFrame) {
                formData.append("coverDataUrl", coverFrame);
            }

            // 进度模拟 (真实实现用 SSE 或 WebSocket)
            const interval = setInterval(() => {
                setExportProgress((p) => Math.min(p + 5, 90));
            }, 500);

            await api.post("/api/transcode/edit", formData);

            clearInterval(interval);
            setExportProgress(100);
        } catch (err) {
            console.error("Export failed:", err);
        } finally {
            setExporting(false);
        }
    }, [videoFile, trimStart, trimEnd, subtitles, coverFrame, user?.id]);

    const formatTime = (s: number) => {
        const m = Math.floor(s / 60);
        const sec = Math.floor(s % 60);
        return `${m}:${sec.toString().padStart(2, "0")}`;
    };

    return (
        <div style={styles.container}>
            <h1 style={styles.title}>🎬 视频编辑器</h1>

            {/* 文件选择 */}
            {!videoSrc && (
                <label style={styles.dropZone}>
                    <input type="file" accept="video/*" onChange={handleFileSelect} style={{ display: "none" }} />
                    <div style={{ fontSize: 48, marginBottom: 12 }}>📁</div>
                    <div>点击或拖放选择视频文件</div>
                    <div style={styles.hint}>支持 MP4, WebM, MOV</div>
                </label>
            )}

            {videoSrc && (
                <>
                    {/* 视频预览 */}
                    <div style={styles.previewArea}>
                        <video
                            ref={videoRef}
                            src={videoSrc}
                            style={styles.video}
                            onLoadedMetadata={handleLoadedMetadata}
                            onTimeUpdate={handleTimeUpdate}
                            onClick={togglePlay}
                        />
                        <canvas ref={canvasRef} style={{ display: "none" }} />

                        {/* 播放控制 */}
                        <div style={styles.controls}>
                            <button onClick={togglePlay} style={styles.playBtn}>
                                {playing ? "⏸" : "▶️"}
                            </button>
                            <span style={styles.timeDisplay}>
                                {formatTime(currentTime)} / {formatTime(duration)}
                            </span>
                        </div>
                    </div>

                    {/* 时间线 */}
                    <div style={styles.timeline}>
                        <div style={styles.timelineLabel}>裁剪范围</div>
                        <div style={styles.rangeContainer}>
                            <input
                                type="range"
                                min={0}
                                max={duration}
                                step={0.1}
                                value={trimStart}
                                onChange={(e) => {
                                    const v = parseFloat(e.target.value);
                                    setTrimStart(Math.min(v, trimEnd - 1));
                                    seekTo(v);
                                }}
                                style={styles.range}
                            />
                            <input
                                type="range"
                                min={0}
                                max={duration}
                                step={0.1}
                                value={trimEnd}
                                onChange={(e) => {
                                    const v = parseFloat(e.target.value);
                                    setTrimEnd(Math.max(v, trimStart + 1));
                                    seekTo(v);
                                }}
                                style={styles.range}
                            />
                            <div style={styles.trimInfo}>
                                {formatTime(trimStart)} → {formatTime(trimEnd)} (
                                {formatTime(trimEnd - trimStart)})
                            </div>
                        </div>
                    </div>

                    {/* 工具栏 */}
                    <div style={styles.toolbar}>
                        <button onClick={captureCover} style={styles.toolBtn}>
                            📸 设为封面
                        </button>
                        <button onClick={addSubtitle} style={styles.toolBtn}>
                            📝 添加字幕
                        </button>
                    </div>

                    {/* 封面预览 */}
                    {coverFrame && (
                        <div style={styles.coverPreview}>
                            <div style={styles.sectionLabel}>封面预览 ({formatTime(coverTime)})</div>
                            <img src={coverFrame} alt="cover" style={styles.coverImg} />
                        </div>
                    )}

                    {/* 字幕列表 */}
                    {subtitles.length > 0 && (
                        <div style={styles.subtitleSection}>
                            <div style={styles.sectionLabel}>字幕列表</div>
                            {subtitles.map((sub) => (
                                <div key={sub.id} style={styles.subtitleRow}>
                                    <span style={styles.subTime}>
                                        {formatTime(sub.startTime)} - {formatTime(sub.endTime)}
                                    </span>
                                    <input
                                        type="text"
                                        value={sub.text}
                                        placeholder="输入字幕文字..."
                                        onChange={(e) => updateSubtitle(sub.id, { text: e.target.value })}
                                        style={styles.subInput}
                                    />
                                    <button
                                        onClick={() => deleteSubtitle(sub.id)}
                                        style={styles.subDelete}
                                    >
                                        ✕
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* 导出 */}
                    <div style={styles.exportSection}>
                        <button
                            onClick={handleExport}
                            disabled={exporting}
                            style={{
                                ...styles.exportBtn,
                                opacity: exporting ? 0.6 : 1,
                            }}
                        >
                            {exporting ? `导出中 ${exportProgress}%...` : "🚀 导出视频"}
                        </button>
                        {exporting && (
                            <div style={styles.progressBar}>
                                <div
                                    style={{
                                        ...styles.progressFill,
                                        width: `${exportProgress}%`,
                                    }}
                                />
                            </div>
                        )}
                    </div>
                </>
            )}
        </div>
    );
};

const styles: Record<string, React.CSSProperties> = {
    container: {
        maxWidth: 900,
        margin: "0 auto",
        padding: "24px 16px 80px",
        color: "#fff",
    },
    title: { fontSize: 24, fontWeight: 700, marginBottom: 24 },
    dropZone: {
        display: "flex",
        flexDirection: "column" as const,
        alignItems: "center",
        justifyContent: "center",
        height: 300,
        border: "2px dashed rgba(255,255,255,0.15)",
        borderRadius: 16,
        cursor: "pointer",
        color: "rgba(255,255,255,0.5)",
        transition: "border-color 0.3s",
    },
    hint: { fontSize: 12, marginTop: 6, color: "rgba(255,255,255,0.3)" },
    previewArea: {
        position: "relative" as const,
        borderRadius: 12,
        overflow: "hidden",
        background: "#000",
        marginBottom: 16,
    },
    video: {
        width: "100%",
        maxHeight: 480,
        display: "block",
        cursor: "pointer",
    },
    controls: {
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: "8px 16px",
        background: "rgba(0,0,0,0.7)",
    },
    playBtn: {
        background: "none",
        border: "none",
        fontSize: 20,
        cursor: "pointer",
        padding: 4,
    },
    timeDisplay: {
        fontSize: 13,
        color: "rgba(255,255,255,0.7)",
        fontFamily: "monospace",
    },
    timeline: {
        background: "rgba(255,255,255,0.04)",
        borderRadius: 12,
        padding: 16,
        marginBottom: 16,
    },
    timelineLabel: {
        fontSize: 12,
        color: "rgba(255,255,255,0.5)",
        marginBottom: 8,
    },
    rangeContainer: { display: "flex", flexDirection: "column" as const, gap: 6 },
    range: { width: "100%", accentColor: "#8b5cf6" },
    trimInfo: {
        fontSize: 13,
        color: "#a78bfa",
        fontFamily: "monospace",
        textAlign: "center" as const,
    },
    toolbar: {
        display: "flex",
        gap: 8,
        marginBottom: 16,
    },
    toolBtn: {
        flex: 1,
        padding: "10px 16px",
        borderRadius: 10,
        border: "1px solid rgba(255,255,255,0.12)",
        background: "rgba(255,255,255,0.05)",
        color: "#fff",
        fontSize: 13,
        cursor: "pointer",
        transition: "background 0.2s",
    },
    coverPreview: { marginBottom: 16 },
    sectionLabel: {
        fontSize: 13,
        fontWeight: 600,
        marginBottom: 8,
        color: "rgba(255,255,255,0.7)",
    },
    coverImg: {
        width: "100%",
        maxWidth: 320,
        borderRadius: 8,
        border: "2px solid rgba(139, 92, 246, 0.4)",
    },
    subtitleSection: { marginBottom: 16 },
    subtitleRow: {
        display: "flex",
        alignItems: "center",
        gap: 8,
        marginBottom: 8,
    },
    subTime: {
        fontSize: 12,
        color: "rgba(255,255,255,0.4)",
        fontFamily: "monospace",
        whiteSpace: "nowrap" as const,
        minWidth: 100,
    },
    subInput: {
        flex: 1,
        padding: "6px 12px",
        borderRadius: 6,
        border: "1px solid rgba(255,255,255,0.12)",
        background: "rgba(255,255,255,0.05)",
        color: "#fff",
        fontSize: 13,
    },
    subDelete: {
        background: "rgba(239, 68, 68, 0.2)",
        border: "none",
        color: "#ef4444",
        borderRadius: 6,
        padding: "4px 8px",
        cursor: "pointer",
        fontSize: 12,
    },
    exportSection: { marginTop: 24 },
    exportBtn: {
        width: "100%",
        padding: "14px 20px",
        borderRadius: 12,
        border: "none",
        background: "linear-gradient(135deg, #8b5cf6, #6d28d9)",
        color: "#fff",
        fontSize: 16,
        fontWeight: 700,
        cursor: "pointer",
    },
    progressBar: {
        height: 4,
        borderRadius: 2,
        background: "rgba(255,255,255,0.1)",
        marginTop: 8,
        overflow: "hidden",
    },
    progressFill: {
        height: "100%",
        background: "linear-gradient(90deg, #8b5cf6, #22c55e)",
        borderRadius: 2,
        transition: "width 0.3s",
    },
};

export default VideoEditor;
