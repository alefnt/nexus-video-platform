// FILE: /video-platform/client-web/src/pages/VideoFeed.tsx
/**
 * Full-screen TikTok-style video feed with swipe navigation,
 * auto-play, preloading, like/follow, share-to-earn, and danmaku.
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import videojs from 'video.js';
import 'video.js/dist/video-js.css';

import "videojs-contrib-quality-levels";
import "videojs-hls-quality-selector";
import '../styles/video-feed.css';
import { getApiClient } from "../lib/apiClient";
import type { VideoMeta } from "@video-platform/shared/types";
import PaymentModeSelector from "../components/PaymentModeSelector";

const client = getApiClient();

// Helper to check if a video requires payment
function isPaidVideo(video: VideoMeta): boolean {
  const mode = video.priceMode || 'free';
  if (mode === 'free') return false;
  const hasBuyPrice = (video.buyOncePrice || video.pointsPrice || 0) > 0;
  const hasStreamPrice = (video.streamPricePerSecond || video.streamPricePerMinute || 0) > 0;
  return hasBuyPrice || hasStreamPrice;
}

// Safari detection & VHS config
function isSafariUA() {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent || "";
  return /Safari/i.test(ua) && !/Chrome/i.test(ua);
}
function getVhsOptionsFor(srcUrl?: string) {
  const isHls = srcUrl ? (srcUrl.includes("videodelivery.net") || /\.m3u8(\?|$)/.test(srcUrl)) : false;
  const isSafari = isSafariUA();
  const conn: any = typeof navigator !== "undefined" ? (navigator as any).connection : undefined;
  const downlinkMbps = Number(conn?.downlink || 0);
  const effective: string = String(conn?.effectiveType || "unknown");
  let maxInitialBitrate = 800_000;
  if (effective.includes("2g")) maxInitialBitrate = 300_000;
  else if (effective.includes("3g")) maxInitialBitrate = 800_000;
  else if (effective.includes("4g")) maxInitialBitrate = 2_500_000;
  const bandwidth = downlinkMbps > 0 ? Math.round(downlinkMbps * 1024 * 1024) : undefined;
  return {
    overrideNative: isSafari && isHls,
    maxInitialBitrate,
    bandwidth,
    limitRenditionByPlayerDimensions: true,
    experimentalBufferBasedABR: true,
  } as any;
}

interface VideoItem extends VideoMeta {
  player?: ReturnType<typeof videojs>;
  videoElement?: HTMLVideoElement;
  isLoaded?: boolean;
  streamUrl?: string;
}

export default function VideoFeed() {
  const navigate = useNavigate();
  const containerRef = useRef<HTMLDivElement>(null);
  const [videos, setVideos] = useState<VideoItem[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const touchStartY = useRef(0);
  const touchEndY = useRef(0);
  const isScrolling = useRef(false);
  const SWIPE_SWITCH_THRESHOLD = 100;
  const SWIPE_TOGGLE_THRESHOLD = 25;
  const playersRef = useRef<Map<string, ReturnType<typeof videojs>>>(new Map());
  const videoElsRef = useRef<Map<string, HTMLVideoElement>>(new Map());
  const swipeActionRef = useRef<'none' | 'togglePlay' | 'togglePause' | 'switchNext' | 'switchPrev'>('none');

  // Like/follow state
  const [likeCounts, setLikeCounts] = useState<Record<string, number>>({});
  const [likedMap, setLikedMap] = useState<Record<string, boolean>>({});
  const [showPurchase, setShowPurchase] = useState<string | null>(null); // video id to show purchase for
  const [purchasedIds, setPurchasedIds] = useState<Set<string>>(new Set());

  const jwt = typeof window !== "undefined" ? sessionStorage.getItem("vp.jwt") : null;
  if (jwt) client.setJWT(jwt);

  // Load guest likes from localStorage
  useEffect(() => {
    try {
      const raw = localStorage.getItem("vp.guest_likes");
      if (raw) setLikedMap(prev => ({ ...prev, ...JSON.parse(raw) }));
    } catch { }
  }, []);

  // Follow handler
  const handleFollow = (creatorAddress: string) => {
    if (!creatorAddress) return;
    if (jwt) {
      client.post("/metadata/follow", { targetAddress: creatorAddress })
        .then(() => alert("Followed successfully!"))
        .catch(console.error);
    } else {
      sessionStorage.setItem("vp.pending_action", JSON.stringify({ type: "follow", target: creatorAddress }));
      navigate("/login");
    }
  };

  // Like toggle handler
  const handleToggleLike = (video: VideoItem) => {
    const liked = !!likedMap[video.id];
    const nextLiked = !liked;
    setLikedMap(prev => ({ ...prev, [video.id]: nextLiked }));
    setLikeCounts(prev => ({ ...prev, [video.id]: Math.max(0, (prev[video.id] || 0) + (nextLiked ? 1 : -1)) }));
    if (!jwt) {
      const newMap = { ...likedMap, [video.id]: nextLiked };
      setLikedMap(newMap);
      localStorage.setItem("vp.guest_likes", JSON.stringify(newMap));
      return;
    }
    const path = nextLiked ? "/metadata/like" : "/metadata/unlike";
    client.post(path, { videoId: video.id }).catch(console.warn);
  };

  // Load videos with recommendations/trending fallback
  const loadFreeVideos = useCallback(async () => {
    try {
      setLoading(true);
      let remoteVideos: VideoMeta[] = [];
      // Try recommendations first, then trending, then raw list
      try { remoteVideos = await client.get<VideoMeta[]>("/metadata/recommendations"); } catch { }
      if (!remoteVideos || remoteVideos.length === 0) {
        try { remoteVideos = await client.get<VideoMeta[]>("/metadata/trending"); } catch { }
      }
      if (!remoteVideos || remoteVideos.length === 0) {
        remoteVideos = await client.get<VideoMeta[]>("/metadata/list");
      }
      let finalVideos = remoteVideos || [];
      // Add demo video as fallback
      if (finalVideos.length === 0) {
        finalVideos = [{
          id: "demo-bbb",
          title: "Big Buck Bunny (Demo)",
          description: "Open-source animation demo",
          creatorCkbAddress: "demo",
          creatorBitDomain: "demo.bit",
          durationSeconds: 600,
          priceUSDI: "0",
          cdnUrl: "/videos/BigBuckBunny.mp4",
          posterUrl: "https://peach.blender.org/wp-content/uploads/title_anouncement.jpg?x11217",
          createdAt: new Date().toISOString()
        }];
      }
      setVideos(finalVideos.slice(0, 20));
      setError(null);
    } catch (e: any) {
      console.warn("[VideoFeed] Failed to load videos:", e);
      setError("Failed to load videos. Please check your connection.");
      setVideos([{
        id: "demo-1",
        title: "Demo Video",
        description: "Network error. Showing demo content.",
        creatorCkbAddress: "demo",
        durationSeconds: 60,
        priceUSDI: "0",
        createdAt: new Date().toISOString()
      } as VideoMeta]);
    } finally {
      setLoading(false);
    }
  }, []);

  // 预加载视频流URL
  const preloadVideo = useCallback(async (video: VideoItem, index: number) => {
    if (video.isLoaded || video.streamUrl) return;

    // 如果是示例视频或已提供CDN地址，直接使用，无需请求服务端凭证
    if (video.cdnUrl) {
      setVideos(prev => prev.map((v, i) => i === index ? { ...v, streamUrl: video.cdnUrl, isLoaded: true } : v));
      return;
    }

    try {
      // 获取播放凭证
      await client.post("/content/ticket", { videoId: video.id });

      // 获取流URL
      const stream = await client.get<{ url: string }>(`/content/stream/${video.id}`);

      // 更新视频信息
      setVideos(prev => prev.map((v, i) =>
        i === index ? { ...v, streamUrl: stream.url, isLoaded: true } : v
      ));
    } catch (e: any) {
      console.warn(`[VideoFeed] Failed to preload video ${video.id}:`, e);
      // 对于免费视频，如果获取失败，可能是需要登录
      if (e?.error?.includes("未授权") || e?.error?.includes("登录")) {
        // 标记为需要登录的视频
        setVideos(prev => prev.map((v, i) =>
          i === index ? { ...v, streamUrl: "login_required", isLoaded: true } : v
        ));
      }
    }
  }, []);

  // 初始化视频播放器
  const initializePlayer = useCallback((video: VideoItem, element: HTMLVideoElement) => {
    // 如已有旧实例，先释放
    const existing = playersRef.current.get(video.id);
    if (existing) {
      try { existing.dispose(); } catch { }
      playersRef.current.delete(video.id);
    }

    const srcCandidate = video.streamUrl && video.streamUrl !== 'login_required'
      ? video.streamUrl : (video.cdnUrl || undefined);
    const vhsOpts = getVhsOptionsFor(srcCandidate);
    const player = videojs(element, {
      controls: true,
      autoplay: 'muted',
      muted: true,
      loop: true,
      fluid: false,
      responsive: false,
      fill: true,
      preload: 'auto',
      bigPlayButton: true,
      poster: (video as any).posterUrl || undefined,
      html5: { vhs: vhsOpts } as any,
    });
    // Quality selector plugin
    try { (player as any).qualityLevels && (player as any).qualityLevels(); } catch { }
    try { (player as any).hlsQualitySelector && (player as any).hlsQualitySelector({ displayCurrentQuality: true, default: 'auto' }); } catch { }

    try { player.muted(true); } catch { }
    if (srcCandidate) {
      const srcType = /\.m3u8(\?|$)/.test(srcCandidate) ? 'application/x-mpegURL' : 'video/mp4';
      try { player.src({ src: srcCandidate, type: srcType }); } catch { }
    }

    // 媒体就绪后强制播放（静音），消除竞态
    player.on('loadeddata', () => {
      try { player.muted(true); } catch { }
      void player.play()?.catch(console.warn);
    });
    player.on('canplay', () => {
      try { player.muted(true); } catch { }
      if (player.paused()) player.play().catch(console.warn);
    });
    player.on('error', () => {
      const err = player.error();
      console.warn('[video.js] error', err);
    });

    return player;
  }, []);

  // 切换到指定视频
  const switchToVideo = useCallback((index: number) => {
    if (index < 0 || index >= videos.length) return;
    setCurrentIndex(index);

    // 暂停其他视频
    videos.forEach((v, i) => {
      const p = playersRef.current.get(v.id);
      if (i !== index && p) {
        try { p.pause(); } catch { }
      }
    });

    // 播放当前视频（若有实例则直接播放，不再依赖 streamUrl）
    const currentVideo = videos[index];
    const currentPlayer = currentVideo ? playersRef.current.get(currentVideo.id) : undefined;
    if (currentPlayer) {
      try { currentPlayer?.muted(true); } catch { }
      currentPlayer?.play().catch(console.warn);
    }

    // 预加载前后视频
    const preloadIndexes = [index - 1, index + 1].filter(i => i >= 0 && i < videos.length);
    preloadIndexes.forEach(i => preloadVideo(videos[i], i));
  }, [videos, preloadVideo]);

  // 组件卸载时清理所有video.js实例，避免DOM结构被修改导致React删除节点报错
  useEffect(() => {
    return () => {
      try {
        playersRef.current.forEach(p => { try { p.dispose(); } catch { } });
        playersRef.current.clear();
        videoElsRef.current.clear();
      } catch { }
    };
  }, []);

  // 处理触摸事件
  const getCurrentPlayer = (): ReturnType<typeof videojs> | null => {
    const currentVideo = videos[currentIndex];
    if (!currentVideo) return null;
    return playersRef.current.get(currentVideo.id) || null;
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartY.current = e.touches[0].clientY;
    isScrolling.current = false;
    swipeActionRef.current = 'none';
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    touchEndY.current = e.touches[0].clientY;
    const deltaY = touchStartY.current - touchEndY.current;
    const absDelta = Math.abs(deltaY);

    // 大幅滑动：切换视频（只触发一次）
    if (!isScrolling.current && absDelta > SWIPE_SWITCH_THRESHOLD) {
      isScrolling.current = true;
      swipeActionRef.current = deltaY > 0 ? 'switchNext' : 'switchPrev';
      switchToVideo(deltaY > 0 ? currentIndex + 1 : currentIndex - 1);
      return;
    }

    // 小幅滑动：记录播放/暂停意图，触摸结束时执行
    if (!isScrolling.current && absDelta > SWIPE_TOGGLE_THRESHOLD) {
      swipeActionRef.current = deltaY > 0 ? 'togglePause' : 'togglePlay';
    }
  };

  const handleTouchEnd = () => {
    if (isScrolling.current) {
      isScrolling.current = false;
      swipeActionRef.current = 'none';
      return;
    }

    const player = getCurrentPlayer();
    if (!player) return;

    if (swipeActionRef.current === 'togglePlay') {
      try { player?.muted(true); } catch { }
      player?.play().catch(() => { });
    } else if (swipeActionRef.current === 'togglePause') {
      try { player?.pause(); } catch { }
    }
    swipeActionRef.current = 'none';
  };

  // 点击视频切换播放/暂停
  const handleVideoClick = (video: VideoItem) => {
    const player = playersRef.current.get(video.id);
    if (!player) return;
    if (player?.paused()) {
      player?.play().catch(console.warn);
    } else {
      player?.pause();
    }
  };

  // 鼠标滚轮：仅用于切换视频（下一个/上一个）
  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    if (isScrolling.current) return;
    const deltaY = e.deltaY;
    if (deltaY === 0) return;
    isScrolling.current = true;
    switchToVideo(deltaY > 0 ? currentIndex + 1 : currentIndex - 1);
    setTimeout(() => { isScrolling.current = false; }, 250);
  };

  // 键盘快捷键：Space/K 切换播放；↑ 上一个视频；↓ 下一个视频
  const toggleCurrentPlayback = () => {
    const player = playersRef.current.get(videos[currentIndex]?.id || '');
    if (!player) return;
    if (player?.paused()) {
      try { player?.muted(true); } catch { }
      player?.play().catch(() => { });
    } else {
      try { player?.pause(); } catch { }
    }
  };

  useEffect(() => {
    const keyHandler = (e: KeyboardEvent) => {
      if (e.key === ' ' || e.key.toLowerCase() === 'k') {
        e.preventDefault();
        toggleCurrentPlayback();
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        switchToVideo(currentIndex - 1);
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        switchToVideo(currentIndex + 1);
      }
    };
    window.addEventListener('keydown', keyHandler);
    return () => window.removeEventListener('keydown', keyHandler);
  }, [currentIndex, videos]);

  // 初始化
  useEffect(() => {
    loadFreeVideos();
  }, [loadFreeVideos]);

  // 当视频列表加载完成后，预加载第一个视频
  useEffect(() => {
    if (videos.length > 0 && !loading) {
      preloadVideo(videos[0], 0);
      if (videos.length > 1) {
        preloadVideo(videos[1], 1);
      }
    }
  }, [videos, loading, preloadVideo]);

  // 当streamUrl更新后，为已初始化的播放器设置来源并在当前项上播放
  useEffect(() => {
    videos.forEach((v, i) => {
      const p = playersRef.current.get(v.id);
      if (p && v.streamUrl && v.streamUrl !== "login_required") {
        const current = (p.currentSource() as any)?.src || p.currentSrc();
        if (!current || current !== v.streamUrl) {
          const srcType = /\.m3u8(\?|$)/.test(v.streamUrl) ? "application/x-mpegURL" : "video/mp4";
          try {
            p?.src({ src: v.streamUrl, type: srcType });
            if (i === currentIndex) p?.play().catch(console.warn);
          } catch (e) {
            console.warn("set player src failed", e);
          }
        }
      }
    });
  }, [videos, currentIndex]);

  // Load like counts when video changes
  useEffect(() => {
    const v = videos[currentIndex];
    if (!v) return;
    client.get(`/metadata/likes/${v.id}`).then((r: any) => {
      setLikeCounts(prev => ({ ...prev, [v.id]: Number(r?.count || 0) }));
      if (typeof r?.liked !== "undefined") setLikedMap(prev => ({ ...prev, [v.id]: !!r.liked }));
    }).catch(console.warn);
  }, [currentIndex, videos]);

  // Player cleanup: only keep current ±1 players
  useEffect(() => {
    const keep = new Set(videos.filter((_, i) => i >= currentIndex - 1 && i <= currentIndex + 1).map(v => v.id));
    playersRef.current.forEach((player, id) => {
      if (!keep.has(id)) {
        try { player.dispose(); } catch { }
        playersRef.current.delete(id);
        videoElsRef.current.delete(id);
      }
    });
  }, [currentIndex, videos]);

  // Share-to-Earn: check for referrer ID in URL
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const ref = params.get("ref");
    if (!ref) return;
    const videoId = videos[0]?.id || "feed-view";
    if (ref && videoId) {
      const paymentUrl = (import.meta as any).env?.VITE_PAYMENT_URL || "http://localhost:8091";
      fetch(`${paymentUrl}/growth/share/reward`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ referrerId: ref, videoId, platform: "direct_link" })
      }).then(res => res.json()).then(res => {
        if (res.rewarded) console.log("Share-to-Earn: Referrer rewarded!");
      }).catch(console.warn);
    }
  }, [videos]);

  if (loading) {
    return (
      <div className="video-feed-container">
        <div className="video-feed-loading">
          <div className="spinner"></div>
          <p>Loading videos...</p>
        </div>
      </div>
    );
  }

  if (videos.length === 0) {
    return (
      <div className="video-feed-container">
        <div className="video-feed-empty">
          <p>No videos available</p>
          <button className="button" onClick={() => navigate("/videos")}>
            Browse all videos
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      className="video-feed-container"
      ref={containerRef}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onWheel={handleWheel}
    >
      {/* Header */}
      <div className="video-feed-header">
        <button className="video-feed-back" onClick={() => navigate("/home")}>
          ←
        </button>
        <div className="video-feed-title">Nexus Feed</div>
        <button className="video-feed-search" onClick={() => navigate("/videos")}>
          Search
        </button>
      </div>

      {/* 视频播放区域 */}
      <div className="video-feed-content">
        {videos.map((video, index) => (
          <div
            key={video.id}
            className={`video-feed-item ${index === currentIndex ? 'active' : ''}`}
            style={{
              transform: `translateY(${(index - currentIndex) * 100}vh)`,
              transition: isScrolling.current ? 'none' : 'transform 0.3s ease'
            }}
          >
            {video.streamUrl === "login_required" ? (
              <div className="video-feed-login-required">
                <p>Login required to watch this video</p>
                <button className="button" onClick={() => navigate("/login")}>
                  Login
                </button>
              </div>
            ) : (
              <>
                <div data-vjs-player className="video-js-container" onClick={(e) => {
                  // 如果点击在 video.js 控件区域，则不触发容器切换播放
                  const target = e.target as HTMLElement;
                  if (target && (target.closest('.vjs-control-bar') || target.closest('.vjs-button') || target.closest('.vjs-menu'))) {
                    return;
                  }
                  const player = playersRef.current.get(video.id);
                  if (!player) return;
                  if (player?.paused()) {
                    try { player?.muted(true); } catch { }
                    player?.play().catch(() => { });
                  } else {
                    try { player?.pause(); } catch { }
                  }
                }}>
                  <video
                    ref={(el) => {
                      if (el) {
                        // 仅在没有已存在播放器时初始化，避免重复 dispose/重建导致加载中止
                        const existing = playersRef.current.get(video.id);
                        if (!existing) {
                          const player = initializePlayer(video, el);
                          if (player) {
                            playersRef.current.set(video.id, player);
                            videoElsRef.current.set(video.id, el);
                            if (index === currentIndex && video.streamUrl !== 'login_required') {
                              try { player.muted(true); } catch { }
                              void player.play()?.catch(console.warn);
                            }
                          }
                        } else {
                          // 更新元素引用即可，保持现有播放器实例
                          videoElsRef.current.set(video.id, el);
                        }
                      }
                    }}
                    className="video-feed-video video-js vjs-default-skin vjs-big-play-centered"
                    playsInline
                    webkit-playsinline="true"
                    muted
                    crossOrigin="anonymous"
                  />
                </div>
                {/* Video info overlay */}
                <div className="video-feed-overlay">
                  <div className="video-feed-info">
                    <div style={{ display: "inline-flex", alignItems: 'center', gap: 4, padding: "2px 8px", borderRadius: 4, background: isPaidVideo(video) ? "rgba(255,68,102,0.3)" : "rgba(162,103,255,0.3)", fontSize: 10, marginBottom: 8, border: isPaidVideo(video) ? "1px solid rgba(255,68,102,0.5)" : "1px solid rgba(162,103,255,0.5)" }}>
                      {isPaidVideo(video) ? '💎 PREMIUM' : '🆓 FREE ACCESS'}
                    </div>
                    <h3 className="video-feed-video-title">{video.title}</h3>
                    <p className="video-feed-video-desc">{video.description}</p>
                    <div className="video-feed-creator" style={{ display: "inline-flex", alignItems: "center", gap: 10, marginTop: 8 }}>
                      <span>{video.creatorCkbAddress?.slice(0, 8)}...</span>
                      <button
                        className="video-feed-action-btn"
                        style={{ padding: "2px 10px", fontSize: 10 }}
                        onClick={() => handleFollow(video.creatorCkbAddress)}
                      >
                        Follow
                      </button>
                    </div>
                  </div>
                  {/* Action buttons */}
                  <div className="video-feed-actions">
                    <button
                      className="video-feed-action-btn"
                      onClick={() => navigate(`/player/${video.id}`)}
                    >
                      📺
                    </button>
                    <button
                      className="video-feed-action-btn"
                      onClick={() => handleToggleLike(video)}
                      style={{ color: likedMap[video.id] ? '#ff4466' : 'white' }}
                    >
                      {likedMap[video.id] ? '❤️' : '🩶'}
                      <span style={{ fontSize: 10, display: 'block' }}>{likeCounts[video.id] || 0}</span>
                    </button>
                    <button
                      className="video-feed-action-btn"
                      onClick={() => {
                        const userRaw = typeof window !== "undefined" ? sessionStorage.getItem("vp.user") : null;
                        const userData = userRaw ? JSON.parse(userRaw) : null;
                        const shareUrl = `${window.location.origin}/#/player/${video.id}?ref=${userData?.ckbAddress || 'anon'}`;
                        if (navigator.share) {
                          navigator.share({ title: video.title, text: video.description, url: shareUrl }).catch(console.warn);
                        } else {
                          navigator.clipboard.writeText(shareUrl).then(() => alert('Link copied!')).catch(console.warn);
                        }
                      }}
                    >
                      📤
                    </button>
                    {/* Purchase button for paid content */}
                    {isPaidVideo(video) && !purchasedIds.has(video.id) && (
                      <button
                        className="video-feed-action-btn"
                        onClick={() => setShowPurchase(video.id)}
                        style={{ color: '#FFD93D' }}
                      >
                        💰
                        <span style={{ fontSize: 9, display: 'block' }}>BUY</span>
                      </button>
                    )}
                  </div>
                </div>
              </>
            )}
          </div>
        ))}
      </div>

      {/* 底部指示器 */}
      <div className="video-feed-indicators">
        {videos.map((_, index) => (
          <div
            key={index}
            className={`video-feed-indicator ${index === currentIndex ? 'active' : ''}`}
            onClick={() => switchToVideo(index)}
          />
        ))}
      </div>

      {/* 错误提示 */}
      {error && (
        <div className="video-feed-error">
          {error}
        </div>
      )}

      {/* Purchase Modal for paid videos */}
      {showPurchase && (() => {
        const video = videos.find(v => v.id === showPurchase);
        if (!video) return null;
        return (
          <PaymentModeSelector
            video={{
              ...video,
              buyOncePrice: video.pointsPrice || video.buyOncePrice || 0,
              streamPricePerSecond: video.streamPricePerSecond ?? ((video.streamPricePerMinute || 0) / 60),
              priceMode: video.priceMode || 'buy_once',
            } as any}
            onSelect={(mode) => {
              if (mode === 'buy_once') {
                setPurchasedIds(prev => new Set([...prev, showPurchase]));
                setShowPurchase(null);
                // Navigate to full player for the purchased video
                navigate(`/player/${showPurchase}`);
              } else if (mode === 'stream') {
                setShowPurchase(null);
                navigate(`/player/${showPurchase}?mode=stream`);
              }
            }}
            onClose={() => setShowPurchase(null)}
          />
        );
      })()}
    </div>
  );
}