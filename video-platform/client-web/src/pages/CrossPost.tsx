/**
 * 多平台分发页面
 * 生成社交分享卡片、嵌入代码、一键分享到社交平台
 */

import React, { useState, useCallback, useEffect } from "react";
import { getApiClient } from "../lib/apiClient";
import { useAuthStore } from "../stores";
import { setPageSEO } from "../utils/seo";

interface VideoInfo {
    id: string;
    title: string;
    description: string | null;
    coverUrl: string | null;
    videoUrl: string;
    duration: number;
    views: number;
    tags: string[];
}

const CrossPost: React.FC = () => {
    const user = useAuthStore((s) => s.user);
    const api = getApiClient();

    const [videos, setVideos] = useState<VideoInfo[]>([]);
    const [selected, setSelected] = useState<VideoInfo | null>(null);
    const [loading, setLoading] = useState(true);
    const [copied, setCopied] = useState<string | null>(null);

    useEffect(() => {
        setPageSEO({ title: "多平台分发" });
    }, []);

    // 加载我的视频列表
    useEffect(() => {
        if (!user?.id) return;
        api.get<{ videos: VideoInfo[] }>(`/api/content/my-videos?userId=${user.id}&limit=50`)
            .then((data) => setVideos(data.videos))
            .catch(() => { })
            .finally(() => setLoading(false));
    }, [user?.id]);

    const baseUrl = typeof window !== "undefined" ? window.location.origin : "";

    const shareUrl = selected ? `${baseUrl}/video/${selected.id}` : "";
    const embedCode = selected
        ? `<iframe src="${baseUrl}/embed/${selected.id}" width="640" height="360" frameborder="0" allowfullscreen></iframe>`
        : "";

    const twitterShareUrl = selected
        ? `https://twitter.com/intent/tweet?text=${encodeURIComponent(selected.title)}&url=${encodeURIComponent(shareUrl)}`
        : "";

    const copyToClipboard = useCallback(
        async (text: string, label: string) => {
            try {
                await navigator.clipboard.writeText(text);
                setCopied(label);
                setTimeout(() => setCopied(null), 2000);
            } catch { }
        },
        []
    );

    return (
        <div style={styles.container}>
            <h1 style={styles.title}>🌐 多平台分发</h1>

            <div style={styles.layout}>
                {/* 左: 视频列表 */}
                <div style={styles.videoList}>
                    <h3 style={styles.listTitle}>选择要分发的视频</h3>
                    {loading ? (
                        <div style={styles.empty}>加载中...</div>
                    ) : videos.length === 0 ? (
                        <div style={styles.empty}>暂无视频</div>
                    ) : (
                        videos.map((v) => (
                            <div
                                key={v.id}
                                onClick={() => setSelected(v)}
                                style={{
                                    ...styles.videoItem,
                                    ...(selected?.id === v.id ? styles.videoItemActive : {}),
                                }}
                            >
                                <img
                                    src={v.coverUrl || "/placeholder.jpg"}
                                    alt=""
                                    style={styles.thumb}
                                />
                                <div style={styles.videoMeta}>
                                    <div style={styles.videoTitle}>{v.title}</div>
                                    <div style={styles.videoViews}>
                                        👁️ {v.views} 次播放
                                    </div>
                                </div>
                            </div>
                        ))
                    )}
                </div>

                {/* 右: 分发工具 */}
                <div style={styles.tools}>
                    {!selected ? (
                        <div style={styles.placeholder}>
                            <div style={{ fontSize: 48, marginBottom: 12 }}>📤</div>
                            <div>选择一个视频开始分发</div>
                        </div>
                    ) : (
                        <>
                            {/* 预览卡片 */}
                            <div style={styles.previewCard}>
                                <img
                                    src={selected.coverUrl || "/placeholder.jpg"}
                                    alt=""
                                    style={styles.previewImg}
                                />
                                <div style={styles.previewInfo}>
                                    <div style={styles.previewTitle}>{selected.title}</div>
                                    <div style={styles.previewDesc}>
                                        {selected.description || "暂无描述"}
                                    </div>
                                </div>
                            </div>

                            {/* 分享链接 */}
                            <div style={styles.section}>
                                <div style={styles.sectionTitle}>🔗 分享链接</div>
                                <div style={styles.copyRow}>
                                    <input
                                        type="text"
                                        readOnly
                                        value={shareUrl}
                                        style={styles.copyInput}
                                    />
                                    <button
                                        onClick={() => copyToClipboard(shareUrl, "link")}
                                        style={styles.copyBtn}
                                    >
                                        {copied === "link" ? "✅" : "📋"}
                                    </button>
                                </div>
                            </div>

                            {/* 嵌入代码 */}
                            <div style={styles.section}>
                                <div style={styles.sectionTitle}>📐 嵌入代码</div>
                                <div style={styles.copyRow}>
                                    <input
                                        type="text"
                                        readOnly
                                        value={embedCode}
                                        style={styles.copyInput}
                                    />
                                    <button
                                        onClick={() => copyToClipboard(embedCode, "embed")}
                                        style={styles.copyBtn}
                                    >
                                        {copied === "embed" ? "✅" : "📋"}
                                    </button>
                                </div>
                            </div>

                            {/* 平台分享 */}
                            <div style={styles.section}>
                                <div style={styles.sectionTitle}>📱 一键分享</div>
                                <div style={styles.platformGrid}>
                                    <a href={twitterShareUrl} target="_blank" rel="noopener" style={styles.platformBtn}>
                                        𝕏 Twitter
                                    </a>
                                    <a href={`https://t.me/share/url?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent(selected.title)}`} target="_blank" rel="noopener" style={styles.platformBtn}>
                                        ✈️ Telegram
                                    </a>
                                    <a href={`https://www.reddit.com/submit?url=${encodeURIComponent(shareUrl)}&title=${encodeURIComponent(selected.title)}`} target="_blank" rel="noopener" style={styles.platformBtn}>
                                        🟠 Reddit
                                    </a>
                                    <a href={`https://wa.me/?text=${encodeURIComponent(selected.title + ' ' + shareUrl)}`} target="_blank" rel="noopener" style={styles.platformBtn}>
                                        💬 WhatsApp
                                    </a>
                                    <a href={`https://social-plugins.line.me/lineit/share?url=${encodeURIComponent(shareUrl)}`} target="_blank" rel="noopener" style={styles.platformBtn}>
                                        🟢 LINE
                                    </a>
                                    <a href={`http://service.weibo.com/share/share.php?url=${encodeURIComponent(shareUrl)}&title=${encodeURIComponent(selected.title)}`} target="_blank" rel="noopener" style={styles.platformBtn}>
                                        🔴 微博
                                    </a>
                                    <button
                                        onClick={() => {
                                            if (navigator.share) {
                                                navigator.share({
                                                    title: selected.title,
                                                    url: shareUrl,
                                                });
                                            }
                                        }}
                                        style={styles.platformBtn}
                                    >
                                        📤 系统分享
                                    </button>
                                </div>
                            </div>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};

const styles: Record<string, React.CSSProperties> = {
    container: {
        maxWidth: 1100,
        margin: "0 auto",
        padding: "24px 16px 64px",
        color: "#fff",
    },
    title: { fontSize: 24, fontWeight: 700, marginBottom: 24 },
    layout: {
        display: "grid",
        gridTemplateColumns: "300px 1fr",
        gap: 24,
    },
    videoList: {
        maxHeight: "calc(100vh - 120px)",
        overflowY: "auto" as const,
    },
    listTitle: {
        fontSize: 14,
        fontWeight: 600,
        marginBottom: 12,
        color: "rgba(255,255,255,0.6)",
    },
    videoItem: {
        display: "flex",
        gap: 10,
        padding: "8px 10px",
        borderRadius: 10,
        cursor: "pointer",
        transition: "background 0.2s",
        marginBottom: 4,
    },
    videoItemActive: {
        background: "rgba(139, 92, 246, 0.15)",
    },
    thumb: {
        width: 80,
        height: 45,
        borderRadius: 6,
        objectFit: "cover" as const,
        flexShrink: 0,
        background: "#1a1a2e",
    },
    videoMeta: { flex: 1, overflow: "hidden" },
    videoTitle: {
        fontSize: 12,
        fontWeight: 600,
        overflow: "hidden",
        textOverflow: "ellipsis",
        whiteSpace: "nowrap" as const,
    },
    videoViews: { fontSize: 11, color: "rgba(255,255,255,0.4)", marginTop: 2 },
    tools: { minHeight: 400 },
    placeholder: {
        display: "flex",
        flexDirection: "column" as const,
        alignItems: "center",
        justifyContent: "center",
        height: "100%",
        color: "rgba(255,255,255,0.3)",
    },
    previewCard: {
        borderRadius: 14,
        overflow: "hidden",
        background: "rgba(255,255,255,0.04)",
        border: "1px solid rgba(255,255,255,0.08)",
        marginBottom: 20,
    },
    previewImg: {
        width: "100%",
        height: 200,
        objectFit: "cover" as const,
    },
    previewInfo: { padding: 16 },
    previewTitle: { fontSize: 16, fontWeight: 700, marginBottom: 6 },
    previewDesc: { fontSize: 13, color: "rgba(255,255,255,0.5)", lineHeight: 1.6 },
    section: { marginBottom: 20 },
    sectionTitle: {
        fontSize: 13,
        fontWeight: 600,
        marginBottom: 8,
        color: "rgba(255,255,255,0.7)",
    },
    copyRow: { display: "flex", gap: 6 },
    copyInput: {
        flex: 1,
        padding: "8px 12px",
        borderRadius: 8,
        border: "1px solid rgba(255,255,255,0.1)",
        background: "rgba(255,255,255,0.04)",
        color: "rgba(255,255,255,0.7)",
        fontSize: 12,
        fontFamily: "monospace",
    },
    copyBtn: {
        padding: "8px 14px",
        borderRadius: 8,
        border: "none",
        background: "rgba(139, 92, 246, 0.3)",
        cursor: "pointer",
        fontSize: 16,
    },
    platformGrid: {
        display: "flex",
        gap: 8,
        flexWrap: "wrap" as const,
    },
    platformBtn: {
        padding: "10px 20px",
        borderRadius: 10,
        border: "1px solid rgba(255,255,255,0.12)",
        background: "rgba(255,255,255,0.05)",
        color: "#fff",
        fontSize: 13,
        cursor: "pointer",
        transition: "background 0.2s",
        textDecoration: "none",
    },
    empty: {
        padding: 24,
        textAlign: "center" as const,
        color: "rgba(255,255,255,0.3)",
    },
};

export default CrossPost;
