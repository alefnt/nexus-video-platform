// FILE: /client-web/src/pages/StreamPaymentDemo.tsx
/**
 * 流支付演示页...
 * 完整实现分段支付、断点续看、真实Fiber RPC 集成
 */

import React, { useEffect, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import videojs from "video.js";
import "video.js/dist/video-js.css";
import "../styles/fun.css";
import { getApiClient } from "../lib/apiClient";
import type { VideoMeta } from "@video-platform/shared/types";
import { StreamPaymentHandler } from "../lib/streamPaymentHandler";
import TopNav from "../components/TopNav";

const client = getApiClient();

export default function StreamPaymentDemo() {
    const { id } = useParams();
    const navigate = useNavigate();
    const videoRef = useRef<HTMLVideoElement>(null);
    const playerRef = useRef<any>(null);
    const streamHandlerRef = useRef<StreamPaymentHandler | null>(null);

    const [meta, setMeta] = useState<VideoMeta | null>(null);
    const [status, setStatus] = useState<string>("加载.....");
    const [loading, setLoading] = useState<boolean>(true);
    const [sessionInfo, setSessionInfo] = useState<any>(null);

    // 获取 JWT
    const jwt = typeof window !== "undefined" ? sessionStorage.getItem("vp.jwt") : null;
    if (jwt) client.setJWT(jwt);

    // 初始化流支付处理...
    useEffect(() => {
        const handler = new StreamPaymentHandler(
            client,
            (newStatus: string) => {
                setStatus(newStatus);
                console.log('[Stream Payment]', newStatus);
            },
            () => {
                if (playerRef.current) {
                    playerRef.current.pause();
                }
            }
        );
        streamHandlerRef.current = handler;

        return () => {
            handler.cleanup();
        };
    }, []);

    // 加载视频元数...
    useEffect(() => {
        if (!id) return;

        async function loadMeta() {
            try {
                setStatus("正在加载视频信息...");
                const response = await client.get(`/metadata/${id}`);
                setMeta(response as VideoMeta);
                setStatus("视频信息加载完成");
                setLoading(false);
            } catch (err: any) {
                setStatus(`加载失败: ${err?.message || String(err)}`);
                setLoading(false);
            }
        }

        loadMeta();
    }, [id]);

    // 初始化播放器
    useEffect(() => {
        if (!videoRef.current || !meta) return;

        const player = videojs(videoRef.current, {
            controls: true,
            fluid: true,
            preload: "auto",
            html5: {
                vhs: {
                    overrideNative: true,
                },
            },
        });

        playerRef.current = player;

        // 设置流支付处理器的播放器引用
        if (streamHandlerRef.current) {
            streamHandlerRef.current.setPlayer(player);
        }

        // 监听播放器事...
        player.on("play", () => {
            console.log("[Player] Playing");
        });

        player.on("pause", () => {
            console.log("[Player] Paused");
        });

        player.on("ended", () => {
            console.log("[Player] Ended");
            setStatus("播放完成");
        });

        return () => {
            if (player) {
                player.dispose();
            }
        };
    }, [meta]);

    // 开始流支付
    async function handleStartStreamPayment() {
        if (!streamHandlerRef.current || !meta || !id) {
            setStatus("流支付功能未就绪");
            return;
        }

        try {
            setStatus("正在初始化流支付会话...");

            const success = await streamHandlerRef.current.initStreamPayment({
                videoId: id,
                videoDuration: meta.durationSeconds || 0,
                pricePerSecond: meta.streamPricePerSecond ?? ((meta.streamPricePerMinute || 1) / 60),
            });

            if (success) {
                setStatus("流支付会话已激活");
                setSessionInfo(streamHandlerRef.current.getSession());

                // 加载视频...
                if (playerRef.current && meta.streamUrl) {
                    playerRef.current.src({
                        src: meta.streamUrl,
                        type: meta.streamUrl.includes(".m3u8") ? "application/x-mpegURL" : "video/mp4",
                    });
                    playerRef.current.play();
                }
            } else {
                setStatus("流支付初始化失败");
            }
        } catch (err: any) {
            setStatus(`流支付错... ${err?.message || String(err)}`);
            console.error("Stream payment error:", err);
        }
    }

    // 手动暂停会话
    async function handlePauseSession() {
        if (!streamHandlerRef.current) return;

        try {
            await streamHandlerRef.current.pauseSession();
            setStatus("会话已暂停");
            setSessionInfo(streamHandlerRef.current.getSession());
        } catch (err: any) {
            setStatus(`暂停失败: ${err?.message || String(err)}`);
        }
    }

    // 手动关闭会话
    async function handleCloseSession() {
        if (!streamHandlerRef.current) return;

        try {
            await streamHandlerRef.current.closeSession();
            setStatus("会话已关闭");
            setSessionInfo(null);
        } catch (err: any) {
            setStatus(`关闭失败: ${err?.message || String(err)}`);
        }
    }

    if (loading) {
        return (
            <div className="page">
                <TopNav />
                <div className="container" style={{ padding: 20, textAlign: "center" }}>
                    <p>{status}</p>
                </div>
            </div>
        );
    }

    if (!meta) {
        return (
            <div className="page">
                <TopNav />
                <div className="container" style={{ padding: 20, textAlign: "center" }}>
                    <p>视频不存在</p>
                    <button className="button" onClick={() => navigate("/")}>
                        返回首页
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="page">
            <TopNav />
            <div className="container" style={{ padding: 20, maxWidth: 1200, margin: "0 auto" }}>
                <h1 style={{ marginBottom: 20 }}>流支付演示 - {meta.title}</h1>

                {/* 视频播放...*/}
                <div style={{ marginBottom: 20, backgroundColor: "#000", borderRadius: 8, overflow: "hidden" }}>
                    <video
                        ref={videoRef}
                        className="video-js vjs-big-play-centered"
                        style={{ width: "100%", height: "auto" }}
                    />
                </div>

                {/* 状态信...*/}
                <div style={{ marginBottom: 20, padding: 15, backgroundColor: "#f5f5f5", borderRadius: 8 }}>
                    <h3 style={{ marginBottom: 10 }}>状态</h3>
                    <p style={{ margin: 0, color: "#666" }}>{status}</p>
                </div>

                {/* 会话信息 */}
                {sessionInfo && (
                    <div style={{ marginBottom: 20, padding: 15, backgroundColor: "#e8f5e9", borderRadius: 8 }}>
                        <h3 style={{ marginBottom: 10 }}>会话信息</h3>
                        <div style={{ fontSize: 14, color: "#333" }}>
                            <p>会话 ID: {sessionInfo.sessionId}</p>
                            <p>当前段落: {sessionInfo.currentSegment} / {sessionInfo.totalSegments}</p>
                            <p>已支付段落: {sessionInfo.paidSegments.join(", ")}</p>
                            <p>分段时长: {sessionInfo.segmentMinutes} 分钟/段</p>
                            <p>每秒价格: {sessionInfo.pricePerSecond?.toFixed(4)} Points</p>
                            <p>已支付总额: {sessionInfo.totalPaid} Points</p>
                        </div>
                    </div>
                )}

                {/* 视频信息 */}
                <div style={{ marginBottom: 20, padding: 15, backgroundColor: "#fff3e0", borderRadius: 8 }}>
                    <h3 style={{ marginBottom: 10 }}>视频信息</h3>
                    <div style={{ fontSize: 14, color: "#333" }}>
                        <p>时长: {Math.floor((meta.durationSeconds || 0) / 60)} 分钟</p>
                        <p>支付模式: {meta.priceMode}</p>
                        <p>流支付价格: {meta.streamPricePerSecond ?? ((meta.streamPricePerMinute || 0) / 60)} PTS/SEC</p>
                        {meta.oneTimePrice && <p>一次性价格: {meta.oneTimePrice} Points</p>}
                    </div>
                </div>

                {/* 控制按钮 */}
                <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                    <button
                        className="button"
                        onClick={handleStartStreamPayment}
                        disabled={!!sessionInfo}
                        style={{ flex: 1, minWidth: 150 }}
                    >
                        {sessionInfo ? "会话已激活" : "开始流支付"}
                    </button>

                    <button
                        className="button"
                        onClick={handlePauseSession}
                        disabled={!sessionInfo}
                        style={{ flex: 1, minWidth: 150, backgroundColor: "#ff9800" }}
                    >
                        暂停会话
                    </button>

                    <button
                        className="button"
                        onClick={handleCloseSession}
                        disabled={!sessionInfo}
                        style={{ flex: 1, minWidth: 150, backgroundColor: "#f44336" }}
                    >
                        关闭会话
                    </button>

                    <button
                        className="button"
                        onClick={() => navigate("/")}
                        style={{ flex: 1, minWidth: 150, backgroundColor: "#9e9e9e" }}
                    >
                        返回首页
                    </button>
                </div>

                {/* 使用说明 */}
                <div style={{ marginTop: 30, padding: 15, backgroundColor: "#e3f2fd", borderRadius: 8 }}>
                    <h3 style={{ marginBottom: 10 }}>使用说明</h3>
                    <ol style={{ fontSize: 14, color: "#333", paddingLeft: 20 }}>
                        <li>点击"开始流支付"初始化会话</li>
                        <li>系统会根据视频时长自动计算分段策略</li>
                        <li>首次观看会显示支付说明，确认后支付第一段</li>
                        <li>视频开始播放，每 5 秒报告一次进度</li>
                        <li>到达段落边界时自动暂停，询问是否继续</li>
                        <li>确认后支付下一段并继续播放</li>
                        <li>下次观看时会检测到历史会话，支持断点续看</li>
                        <li>已支付的段落无需重复付费</li>
                    </ol>
                </div>
            </div>
        </div>
    );
}
