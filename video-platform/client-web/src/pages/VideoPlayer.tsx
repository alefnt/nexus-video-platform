// FILE: /video-platform/client-web/src/pages/VideoPlayer.tsx
/**
 * 功能说明：
 * - 使用 video.js + hls.js 播放流。
 * - 支持离线下载与加密缓存（调用 offlineCache.ts）。
 */

import React, { useEffect, useRef, useState } from "react";
import "../styles/fun.css";
import videojs from "video.js";
import "video.js/dist/video-js.css";
import "videojs-contrib-quality-levels";
import "videojs-hls-quality-selector";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { getApiClient } from "../lib/apiClient";
import type { StreamTicket, VideoMeta, PaymentIntent } from "@video-platform/shared/types";
import { encryptAndCacheVideo, loadCachedVideo, checkCacheExists } from "../lib/offlineCache";
import TopNav from "../components/TopNav";
import PaymentModeSelector from "../components/PaymentModeSelector";
import { usePayment } from "../hooks/usePayment";
import { StreamPaymentHandler } from "../lib/streamPaymentHandler";
import { DanmakuLayer, Danmaku } from "../components/DanmakuLayer";
import ReportModal from "../components/ReportModal";

const client = getApiClient();

// Safari detection & VHS config
function isSafariUA() {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent || "";
  return /Safari/i.test(ua) && !/Chrome/i.test(ua);
}
function getVhsOptionsFor(srcUrl?: string) {
  const isHls = isHlsUrl(srcUrl);
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

function isLocalMp4Url(u?: string | null): boolean {
  if (!u) return false;
  const s = String(u);
  return s.startsWith("blob:") || s.startsWith("data:video/mp4") || /\.mp4(\?.*)?$/i.test(s);
}
function isHlsUrl(u?: string | null): boolean {
  if (!u) return false;
  const s = String(u);
  return s.includes("videodelivery.net") || s.endsWith(".m3u8") || /\.m3u8(\?.*)?$/i.test(s);
}

export default function VideoPlayer() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const videoRef = useRef<HTMLVideoElement>(null);
  const playerRef = useRef<any>(null);
  const [meta, setMeta] = useState<VideoMeta | null>(null);
  const [status, setStatus] = useState<string>("Preparing...");
  const [downloading, setDownloading] = useState<boolean>(false);
  const [showReport, setShowReport] = useState(false);
  const [progress, setProgress] = useState<number>(0);
  const [needPurchase, setNeedPurchase] = useState<boolean>(false);
  const [pendingStreamMode, setPendingStreamMode] = useState<boolean>(false);
  const [buying, setBuying] = useState<boolean>(false);
  const [hasOffline, setHasOffline] = useState<boolean>(false);

  // Stream payment handler
  const streamHandlerRef = useRef<StreamPaymentHandler | null>(null);

  // Danmaku state
  const [danmakuEnabled, setDanmakuEnabled] = useState<boolean>(true);
  const [externalDanmakus, setExternalDanmakus] = useState<Danmaku[]>([]);
  const [danmakuInput, setDanmakuInput] = useState("");
  const [sendingDanmaku, setSendingDanmaku] = useState(false);
  const [dmColor, setDmColor] = useState('#ffffff');

  // Show payment mode selector
  const [showPaymentSelector, setShowPaymentSelector] = useState(false);

  // Chat messages for sidebar
  interface ChatMsg { type: 'comment' | 'tip'; from: string; text: string; amount?: number; }
  const [chatMessages, setChatMessages] = useState<ChatMsg[]>([]);

  // 新增：继续观看进度上报与本地记录
  const progressPostRef = useRef<{ lastPost: number }>({ lastPost: 0 });
  function updateRecentLocal(positionSec: number, durationSec: number, title?: string) {
    try {
      const raw = typeof window !== "undefined" ? localStorage.getItem("vp.recent") : null;
      const list: Array<{ id: string; title?: string; ts: number; positionSec?: number; durationSec?: number }> = raw ? JSON.parse(raw) : [];
      const now = Date.now();
      const filtered = list.filter((x) => x.id !== String(id));
      filtered.unshift({ id: String(id), title, ts: now, positionSec, durationSec });
      const keep = filtered.slice(0, 20);
      if (typeof window !== "undefined") localStorage.setItem("vp.recent", JSON.stringify(keep));
    } catch { }
  }
  async function postProgress(positionSec: number, durationSec: number) {
    if (!jwt || !id) return;
    try {
      await client.post("/content/continue", { videoId: id, positionSec, durationSec });
    } catch { }
  }
  const userRaw = typeof window !== "undefined" ? sessionStorage.getItem("vp.user") : null;
  const jwt = typeof window !== "undefined" ? sessionStorage.getItem("vp.jwt") : null;
  if (jwt) client.setJWT(jwt);
  const user = userRaw ? JSON.parse(userRaw) : null;
  const isJoyUser = !!(user && user.ckbAddress);
  const isEmailUser = !!(user && !user.ckbAddress);

  // Unified Payment Hook
  const payment = usePayment({
    contentId: id || '',
    contentType: 'video',
    buyOncePrice: (meta as any)?.pointsPrice || 0,
    streamPricePerSecond: (meta as any)?.streamPricePerSecond ?? (((meta as any)?.streamPricePerMinute || 1) / 60),
    priceMode: (() => {
      const anyMeta = meta as any;
      if (!anyMeta) return 'free' as const;
      if (anyMeta.priceMode) return anyMeta.priceMode;
      const hasPoints = (anyMeta.pointsPrice || 0) > 0;
      const hasStream = (anyMeta.streamPricePerMinute || 0) > 0;
      if (hasPoints && hasStream) return 'both' as const;
      if (hasStream) return 'stream' as const;
      if (hasPoints) return 'buy_once' as const;
      return 'free' as const;
    })(),
    amountUSDI: meta?.priceUSDI,
    durationSeconds: (meta as any)?.durationSeconds || 600,
    onStatusChange: (msg) => setStatus(msg),
    onBuyOnceSuccess: (result) => {
      setNeedPurchase(false);
      setShowPaymentSelector(false);
      if (result.streamUrl && videoRef.current) {
        const vhsOpts = getVhsOptionsFor(result.streamUrl);
        const player = (playerRef.current = videojs(videoRef.current, {
          controls: true, autoplay: true, preload: "auto",
          html5: { vhs: vhsOpts } as any,
        }));
        player.src({ src: result.streamUrl, type: "application/x-mpegURL" });
      }
    },
    onStreamStarted: (handler) => {
      streamHandlerRef.current = handler;
      setNeedPurchase(false);
      setShowPaymentSelector(false);
      if (videoRef.current && meta) {
        const vhsOpts = getVhsOptionsFor(meta.cdnUrl);
        const player = (playerRef.current = videojs(videoRef.current, {
          controls: true, autoplay: true, preload: "auto",
          html5: { vhs: vhsOpts } as any,
        }));
        player.src({ src: meta.cdnUrl, type: "application/x-mpegURL" });
        handler.setPlayer(player);
        player.on('dispose', () => handler.cleanup());
      }
    },
    onStreamPause: () => {
      if (playerRef.current) playerRef.current.pause();
    },
    enabled: needPurchase,
  });

  // Load comments into chat sidebar
  useEffect(() => {
    if (!id) return;
    client.get<any>(`/metadata/comments/${id}?limit=50`).then(resp => {
      const arr = Array.isArray(resp?.comments) ? resp.comments : [];
      const msgs: ChatMsg[] = arr.map((c: any) => ({
        type: 'comment' as const,
        from: c.authorName || c.author?.slice(0, 8) || 'Anonymous',
        text: c.content || c.text || '',
      }));
      setChatMessages(msgs);
    }).catch(() => { });
  }, [id]);

  // Quick emoji/tip send
  function sendQuickEmoji(emoji: string, amount: number) {
    if (!jwt) { alert('Please login to tip'); return; }
    const username = (() => { try { return JSON.parse(userRaw || '{}').username || 'You'; } catch { return 'You'; } })();
    // Optimistic UI
    setChatMessages(prev => [...prev, { type: 'tip', from: username, text: `${emoji} Sent a tip!`, amount }]);
    // Scroll chat to bottom
    setTimeout(() => {
      const el = document.getElementById('vp-chat-area');
      if (el) el.scrollTop = el.scrollHeight;
    }, 100);
    // Send to payment service with proper TipRequestSchema fields
    client.post('/payment/tip', {
      videoId: id,
      creatorAddress: meta?.creatorCkbAddress || '',
      amount,
      message: `${emoji} tip`,
      showDanmaku: true,
    }).catch(() => { });
  }

  // Send danmaku
  async function sendDanmaku() {
    if (!danmakuInput.trim()) return;
    if (!jwt || !userRaw) {
      alert('Please login to send danmaku');
      navigate("/login");
      return;
    }
    const text = danmakuInput.trim();
    setSendingDanmaku(true);
    try {
      const nowSec = playerRef.current ? Number(playerRef.current.currentTime() || 0) : 0;
      const newDanmaku: Danmaku = {
        id: `local-${Date.now()}`,
        text,
        timestamp: nowSec,
        position: "middle",
        color: dmColor,
        createdAt: Date.now()
      };
      setExternalDanmakus(prev => [...prev, newDanmaku]);
      await client.post(`/content/video/${id}/comments`, { content: text });
      setDanmakuInput("");
    } catch (e: any) {
      alert("Send failed: " + (e?.message || e?.error));
    } finally {
      setSendingDanmaku(false);
    }
  }

  // Retry helpers
  async function sleep(ms: number) { return new Promise(res => setTimeout(res, ms)); }
  function shouldRetry(e: any, isPaymentRelated = false): boolean {
    const msg = String(e?.error || e?.message || "").toLowerCase();
    const code = String(e?.code || "").toLowerCase();
    const st = Number((e?.status ?? e?.httpStatus ?? 0) || 0);
    if (isPaymentRelated && (code.includes("http_403") || st === 403)) return true;
    if (msg.includes("method not found")) return true;
    if (code.includes("http_404") || st === 404) return true;
    if (code.includes("http_502") || st === 502) return true;
    if (code.includes("http_503") || st === 503) return true;
    if (code.includes("http_500") || st === 500) return true;
    if (msg.includes("failed") || msg.includes("network")) return true;
    return false;
  }
  async function withRetry<T>(fn: () => Promise<T>, attempts = 8, baseDelayMs = 1500, isPaymentRelated = false): Promise<T> {
    let lastErr: any;
    for (let i = 1; i <= attempts; i++) {
      try { return await fn(); } catch (e: any) {
        lastErr = e;
        if (!shouldRetry(e, isPaymentRelated) || i === attempts) throw e;
        const multiplier = isPaymentRelated ? 2.2 : 1.8;
        const delay = baseDelayMs * Math.pow(multiplier, i - 1);
        setStatus(isPaymentRelated ? `Processing order... (${i}/${attempts})` : `Waiting for service... retry (${i}/${attempts})`);
        await sleep(delay);
      }
    }
    throw lastErr;
  }

  // Prefetch manifest and first segment
  async function prefetchManifestAndSegments(streamUrl: string): Promise<void> {
    if (!streamUrl || !isHlsUrl(streamUrl)) return;
    try {
      const res = await fetch(streamUrl, { method: 'GET', cache: 'no-cache', credentials: 'omit' });
      if (res.ok) {
        const text = await res.text();
        const lines = text.split('\n');
        let firstSegmentUrl = '';
        for (const line of lines) {
          const trimmed = line.trim();
          if (trimmed && !trimmed.startsWith('#')) {
            firstSegmentUrl = trimmed.startsWith('http') ? trimmed : streamUrl.substring(0, streamUrl.lastIndexOf('/') + 1) + trimmed;
            break;
          }
        }
        if (firstSegmentUrl) {
          fetch(firstSegmentUrl, { method: 'GET', cache: 'no-cache', credentials: 'omit' }).catch(() => { });
        }
      }
    } catch { }
  }

  // Main initialization effect
  useEffect(() => {
    if (typeof document !== 'undefined' && !document.getElementById('vp-danmaku-style')) {
      const style = document.createElement('style');
      style.id = 'vp-danmaku-style';
      style.textContent = `@keyframes vp-danmaku-move { 0% { transform: translateX(120%); } 100% { transform: translateX(-120%); } }`;
      document.head.appendChild(style);
    }
    let disposed = false;
    (async () => {
      if (!id) return;
      setStatus("Acquiring play ticket...");
      try {
        const ticket = await withRetry(() => client.post<StreamTicket>("/content/ticket", { videoId: id }));
        // Fetch metadata with fallback to samples.json
        let m: VideoMeta | null = null;
        try {
          m = await client.get<VideoMeta>(`/metadata/${id}`);
        } catch (e: any) {
          const notFound = e?.code === "not_found" || String(e?.code || "").includes("http_404") || e?.status === 404;
          if (notFound) {
            try {
              const resp = await fetch("/videos/samples.json");
              if (resp.ok) {
                const arr = await resp.json();
                const hit = (Array.isArray(arr) ? arr : []).find((x: any) => String(x?.id) === String(id));
                if (hit) m = hit as VideoMeta;
              }
            } catch { }
          }
          if (!m) throw e;
        }
        setMeta(m);
        try { updateRecentLocal(0, Number(m?.durationSeconds || 0), m?.title); } catch { }
        // Load existing comments as danmaku
        try {
          const resp = await client.get<any>(`/metadata/comments/${id}?limit=100`);
          const arr = Array.isArray(resp?.comments) ? resp.comments : [];
          const durationSec = Number(m?.durationSeconds || 0);
          const loadedDanmakus: Danmaku[] = arr.slice(-100).map((c: any, idx: number) => ({
            id: `dm-${c.id}`,
            text: String(c.text || ""),
            timestamp: Number.isFinite((c as any)?.timestampSec) ? Number((c as any).timestampSec) : (durationSec > 0 ? Math.min(durationSec - 1, (idx + 1) * (durationSec / Math.min(arr.length + 1, 50))) : idx * 2),
            position: "middle",
            color: '#ffffff',
            createdAt: Date.now()
          }));
          setExternalDanmakus(loadedDanmakus);
        } catch { }
        setStatus("Checking offline cache...");
        const cached = await loadCachedVideo(id);
        let src: string;
        if (cached) {
          src = cached;
          setStatus("Playing from offline cache");
          setHasOffline(true);
        } else {
          // Determine free vs paid
          const priceNum = parseFloat(String(m?.priceUSDI || "0"));
          const isPaidUSDI = !isNaN(priceNum) && priceNum > 0;
          const pointsNum = Number((m as any)?.pointsPrice || 0);
          const isPaidPoints = !Number.isNaN(pointsNum) && pointsNum > 0;
          const priceMode = (m as any)?.priceMode || 'free';
          const buyOncePrice = Number((m as any)?.buyOncePrice || 0);
          const streamPrice = Number((m as any)?.streamPricePerMinute || 0);
          const isPaidByMode = priceMode !== 'free' && (buyOncePrice > 0 || streamPrice > 0);
          const isFree = !(isPaidUSDI || isPaidPoints || isPaidByMode);

          if (isFree) {
            const cdn = m?.cdnUrl || "";
            if (isLocalMp4Url(cdn)) {
              src = cdn;
              setStatus("Playing free MP4");
            } else if (/^https?:\/\/localhost:8080\/content\/hls\//.test(cdn)) {
              src = `http://localhost:8092/content/hls/${id}/index.m3u8`;
              setStatus("Playing free HLS (bypass)");
              prefetchManifestAndSegments(src).catch(() => { });
            } else if (isHlsUrl(cdn)) {
              src = cdn;
              setStatus(cdn.includes("videodelivery.net") ? "Playing Cloudflare HLS" : "Playing online HLS");
              prefetchManifestAndSegments(src).catch(() => { });
            } else {
              src = `http://localhost:8092/content/hls/${id}/index.m3u8`;
              setStatus("Playing free HLS");
              prefetchManifestAndSegments(src).catch(() => { });
            }
            try { setHasOffline(await checkCacheExists(id)); } catch { }
          } else {
            // Paid content: check preloaded streamUrl or fetch
            const preloaded = ((location as any)?.state?.streamUrl as string) || "";
            let streamUrl: string | null = null;
            if (preloaded) {
              streamUrl = preloaded;
            } else {
              try {
                const stream = await withRetry(() => client.get<{ url: string }>(`/content/stream/${id}`));
                streamUrl = stream.url;
              } catch (e: any) {
                const code = String(e?.code || "");
                const is403 = code.includes("http_403") || e?.error === "未授权播放，请先购买" || e?.error === "Unauthorized" || Number(e?.status || 0) === 403;
                if (is403) {
                  setNeedPurchase(true);
                  const urlParams = new URLSearchParams(window.location.search);
                  const paymentMode = urlParams.get('mode');
                  if (paymentMode === 'stream') {
                    setPendingStreamMode(true);
                    setStatus("Starting stream payment...");
                  } else {
                    setStatus("Unauthorized. Please purchase to unlock.");
                  }
                  return;
                }
                throw e;
              }
            }
            src = streamUrl!;
            setStatus(streamUrl!.includes("videodelivery.net") ? "Playing Cloudflare Stream HLS..." : "Playing online stream...");
            if (isHlsUrl(streamUrl!)) {
              prefetchManifestAndSegments(streamUrl!).catch(() => { });
            }
            try {
              const raw = await client.get<{ base64: string }>(`/content/raw/${id}`);
              await encryptAndCacheVideo(id, raw.base64, m.creatorCkbAddress);
              try { setHasOffline(await checkCacheExists(id)); } catch { }
            } catch { }
          }
        }
        if (videoRef.current) {
          const srcType = isLocalMp4Url(src) ? "video/mp4" : "application/x-mpegURL";
          const vhsOpts = getVhsOptionsFor(src);
          const player = (playerRef.current = videojs(videoRef.current, {
            controls: true,
            autoplay: "muted",
            preload: "auto",
            html5: { vhs: vhsOpts } as any,
          }));
          player.src({ src, type: srcType });
          // Quality selector plugin
          try { (player as any).qualityLevels && (player as any).qualityLevels(); } catch { }
          try { (player as any).hlsQualitySelector && (player as any).hlsQualitySelector({ displayCurrentQuality: true, default: "auto" }); } catch { }
          // Progress tracking
          player.on("timeupdate", () => {
            const pos = Number(player.currentTime() || 0);
            const dur = Number(player.duration() || 0);
            if (!isFinite(dur) || dur <= 0) return;
            updateRecentLocal(pos, dur, m?.title);
            const now = Date.now();
            if (now - progressPostRef.current.lastPost > 10000) {
              progressPostRef.current.lastPost = now;
              postProgress(pos, dur);
            }
          });
          player.on("ended", () => {
            const dur = Number(player.duration() || 0);
            if (isFinite(dur) && dur > 0) {
              updateRecentLocal(dur, dur, m?.title);
              postProgress(dur, dur);
            }
          });
          // Resume from timestamp
          const urlParams = new URLSearchParams(window.location.search);
          const resumeTime = Number(urlParams.get('t') || 0);
          if (resumeTime > 0) {
            player.one('loadeddata', () => { player.currentTime(resumeTime); });
          }
        }
      } catch (e: any) {
        setStatus(`Playback failed: ${e?.error || e?.message || "Unknown error"}`);
      }
    })();
    return () => {
      disposed = true;
      if (playerRef.current) {
        playerRef.current.dispose();
        playerRef.current = null;
      }
    };
  }, [id]);

  // Keyboard shortcuts
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable) return;
      const player = playerRef.current;
      if (!player) return;
      switch (e.key) {
        case " ": e.preventDefault(); if (player.paused()) player.play(); else player.pause(); break;
        case "m": case "M": e.preventDefault(); player.muted(!player.muted()); break;
        case "f": case "F": e.preventDefault(); if (player.isFullscreen()) player.exitFullscreen(); else player.requestFullscreen(); break;
        case "ArrowLeft": e.preventDefault(); player.currentTime(Math.max(0, (player.currentTime() || 0) - 10)); break;
        case "ArrowRight": e.preventDefault(); const dur = player.duration(); if (isFinite(dur)) player.currentTime(Math.min(dur, (player.currentTime() || 0) + 10)); break;
        default: break;
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  // Auto-trigger stream payment (from VideoList ?mode=stream)
  useEffect(() => {
    if (!pendingStreamMode || !meta || !needPurchase || buying) return;
    const triggerStreamPayment = async () => {
      if (!jwt || !userRaw) { alert('Please login first'); navigate("/login"); setPendingStreamMode(false); return; }
      const usr = JSON.parse(userRaw);
      if (!usr?.ckbAddress) { alert('JoyID login required for stream payment'); setPendingStreamMode(false); return; }
      const pricePerSecond = (meta as any).streamPricePerSecond ?? (((meta as any).streamPricePerMinute || 1) / 60);
      const videoDuration = (meta as any).durationSeconds || 600;
      // Import shared segment calculator for consistent sizing
      const { calculateSegmentDuration: calcSeg } = await import('@video-platform/shared/web3/fiber');
      const segmentSeconds = calcSeg(videoDuration);
      const firstSegmentCost = Math.ceil(pricePerSecond * segmentSeconds);
      try {
        const balanceRes = await client.get<{ balance: number }>("/payment/points/balance");
        const currentBalance = balanceRes?.balance ?? Number((balanceRes as any)?.points ?? 0);
        if (currentBalance < firstSegmentCost) {
          if (confirm(`Insufficient points!\nBalance: ${currentBalance} PTS\nFirst segment: ${firstSegmentCost} PTS\n\nTop up now?`)) navigate("/points");
          setPendingStreamMode(false); return;
        }
      } catch { }
      setBuying(true); setPendingStreamMode(false); setStatus("Initializing stream payment...");
      try {
        const streamHandler = new StreamPaymentHandler(client, (msg) => setStatus(msg), () => { if (playerRef.current) playerRef.current.pause(); });
        streamHandlerRef.current = streamHandler;
        const success = await streamHandler.initStreamPayment({ videoId: id!, videoDuration, pricePerSecond });
        if (!success) { setStatus("Stream payment initialization failed"); setBuying(false); return; }
        setNeedPurchase(false); setStatus("Stream payment channel established");
        if (videoRef.current) {
          const streamUrl = meta.cdnUrl;
          const vhsOpts = getVhsOptionsFor(streamUrl);
          const player = (playerRef.current = videojs(videoRef.current, { controls: true, autoplay: true, preload: "auto", html5: { vhs: vhsOpts } as any }));
          player.src({ src: streamUrl, type: "application/x-mpegURL" });
          streamHandler.setPlayer(player);
          player.on('dispose', () => { streamHandler.cleanup(); });
        }
      } catch (e: any) { console.error("Auto stream payment error:", e); setStatus("Stream payment failed"); } finally { setBuying(false); }
    };
    triggerStreamPayment();
  }, [pendingStreamMode, meta, needPurchase, buying, id, navigate]);

  // SSE real-time danmaku stream
  useEffect(() => {
    if (!id || !danmakuEnabled) return;
    const envUrl = (typeof import.meta !== "undefined" && (import.meta as any).env?.VITE_API_GATEWAY_URL) || "http://localhost:8080";
    const overrideUrl = (typeof window !== "undefined" && typeof window.localStorage !== "undefined") ? (window.localStorage.getItem("vp.apiBase") || undefined) : undefined;
    const apiBase = overrideUrl || envUrl;
    let es: EventSource | null = null;
    let heartbeatTimer: any = null;
    let reconnectTimer: any = null;
    let reconnectAttempts = 0;
    let isManualClose = false;
    const maxReconnectAttempts = 10;
    function connect() {
      if (isManualClose) return;
      try {
        es = new EventSource(`${apiBase.replace(/\/$/, "")}/metadata/danmaku/stream/${id}`);
        es.addEventListener("open", () => { reconnectAttempts = 0; });
        es.addEventListener("message", (ev: MessageEvent) => {
          try {
            if (ev.data === 'heartbeat') return;
            const data = JSON.parse(ev.data || "{}");
            const text = String(data?.text || "");
            if (!text) return;
            const nowSec = playerRef.current ? Number(playerRef.current.currentTime() || 0) : 0;
            const ts = Number.isFinite(data?.timestampSec) ? Number(data.timestampSec) : nowSec + 0.15;
            setExternalDanmakus(prev => [...prev, { id: `sse-${Date.now()}-${Math.random().toString(16).slice(2)}`, text, timestamp: ts, position: "middle", color: '#ffffff', createdAt: Date.now() }]);
          } catch { }
        });
        es.addEventListener("error", () => {
          if (isManualClose || reconnectAttempts >= maxReconnectAttempts) return;
          if (es) { try { es.close(); } catch { } es = null; }
          reconnectAttempts++;
          const delay = Math.min(1000 * Math.pow(2, reconnectAttempts - 1), 30000);
          reconnectTimer = setTimeout(() => { if (!isManualClose) connect(); }, delay);
        });
      } catch { }
    }
    connect();
    return () => {
      isManualClose = true;
      if (heartbeatTimer) clearInterval(heartbeatTimer);
      if (reconnectTimer) clearTimeout(reconnectTimer);
      if (es) { try { es.close(); } catch { } }
    };
  }, [id, danmakuEnabled]);

  return (
    <div className="flex flex-col h-screen text-white" style={{ backgroundColor: "#050510", overflow: "hidden" }}>
      {/* Top Navigation Mini */}
      <header className="h-16 flex-shrink-0 flex items-center justify-between px-6 bg-[#050510] border-b border-white/5 z-20">
        <div className="flex items-center gap-6">
          <button onClick={() => navigate(-1)} className="text-gray-400 hover:text-white transition-colors p-2 rounded-full hover:bg-white/5">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18"></path>
            </svg>
          </button>
          <div className="flex items-center gap-2 cursor-pointer" onClick={() => navigate("/home")}>
            <svg className="w-6 h-6 text-[#22d3ee]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon>
            </svg>
            <span className="text-lg font-black tracking-widest text-white">NEXUS</span>
          </div>
        </div>

        {/* Right Side: Status and Session Info */}
        <div className="flex items-center gap-3">
          <div className="hidden md:flex items-center gap-3 py-2 px-5 rounded-full border border-[#22d3ee]/20 bg-gradient-to-r from-[#22d3ee]/5 to-[#a855f7]/5">
            {/* Status indicator */}
            <div className="flex items-center gap-2 min-w-0">
              <span className="w-2 h-2 rounded-full bg-[#22d3ee] animate-pulse flex-shrink-0" />
              <span
                className="text-[#22d3ee] font-semibold text-sm truncate"
                style={{ maxWidth: '280px' }}
                title={status}
              >
                {status}
              </span>
            </div>
            {/* Divider */}
            <span className="w-px h-5 bg-white/10 flex-shrink-0" />
            {/* Price info */}
            {meta && (
              <div className="flex items-center gap-1.5 flex-shrink-0">
                {(() => {
                  const usdcPrice = parseFloat(String(meta.priceUSDI || '0'));
                  const pointsPrice = Number((meta as any)?.pointsPrice || (meta as any)?.buyOncePrice || 0);
                  const streamPrice = Number((meta as any)?.streamPricePerMinute || 0);
                  const priceMode = (meta as any)?.priceMode || 'free';
                  if (priceMode === 'stream' || streamPrice > 0) {
                    return (
                      <>
                        <span className="text-yellow-400 font-bold text-sm">{streamPrice.toFixed(1)}</span>
                        <span className="text-[10px] text-yellow-600 font-semibold">PTS/MIN</span>
                      </>
                    );
                  }
                  if (pointsPrice > 0) {
                    return (
                      <>
                        <span className="text-yellow-400 font-bold text-sm">{pointsPrice}</span>
                        <span className="text-[10px] text-yellow-600 font-semibold">PTS</span>
                      </>
                    );
                  }
                  if (usdcPrice > 0) {
                    return (
                      <>
                        <span className="text-yellow-400 font-bold text-sm">{usdcPrice}</span>
                        <span className="text-[10px] text-yellow-600 font-semibold">USDC</span>
                      </>
                    );
                  }
                  return <span className="text-emerald-400 font-bold text-sm">FREE</span>;
                })()}
              </div>
            )}
          </div>
          <button onClick={() => navigate('/watch-party')} className="bg-white/10 text-white px-4 py-2 rounded-full text-sm font-bold hover:bg-white/20 transition-colors flex items-center gap-2">
            <svg className="w-4 h-4 text-[#a855f7]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"></path>
            </svg>
            Watch Party
          </button>
        </div>
      </header>

      {/* Main Workspace */}
      <div className="flex-1 flex overflow-hidden">
        {/* Center: Video Player Area */}
        <main className="flex-1 flex flex-col p-6 overflow-y-auto relative">

          {/* Video Container */}
          <div className="w-full aspect-video rounded-2xl bg-black relative overflow-hidden group mx-auto max-w-6xl" style={{ boxShadow: "0 0 100px rgba(34, 211, 238, 0.1), inset 0 0 0 1px rgba(255, 255, 255, 0.1)" }}>
            <video ref={videoRef} className="video-js vjs-default-skin w-full h-full object-contain mix-blend-screen" style={{ width: "100%", height: "100%" }} />
            {/* Danmaku Layer */}
            {danmakuEnabled && (
              <DanmakuLayer
                videoId={id || 'unknown'}
                currentTime={playerRef.current?.currentTime() || 0}
                enabled={danmakuEnabled}
                externalDanmakus={externalDanmakus}
              />
            )}
            {/* Purchase Overlay — triggers PaymentModeSelector */}
            {needPurchase && (
              <div className="absolute inset-0 bg-black/80 flex flex-col items-center justify-center z-50 p-8 text-center backdrop-blur-sm">
                <svg className="w-16 h-16 text-[#22d3ee] mb-4 opacity-80 animate-pulse" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
                <h3 className="text-2xl font-black tracking-widest mb-2">ACCESS RESTRICTED</h3>
                <p className="text-gray-400 mb-6 max-w-md">This content requires payment to unlock. Choose your payment method below.</p>
                <button
                  disabled={buying}
                  onClick={() => {
                    if (!jwt || !userRaw) { alert("Please login first"); navigate("/login"); return; }
                    setShowPaymentSelector(true);
                  }}
                  className="bg-gradient-to-r from-[#22d3ee] to-[#a855f7] text-black font-black px-8 py-3 rounded-full hover:scale-105 transition-transform shadow-[0_0_20px_rgba(168,85,247,0.4)] disabled:opacity-50"
                >
                  {buying ? "PROCESSING..." : "UNLOCK CONTENT"}
                </button>
              </div>
            )}
            {/* PaymentModeSelector modal */}
            {showPaymentSelector && meta && (
              <PaymentModeSelector
                video={{
                  ...meta,
                  buyOncePrice: (meta as any).pointsPrice || (meta as any).buyOncePrice || 50,
                  streamPricePerSecond: (meta as any).streamPricePerSecond ?? (((meta as any).streamPricePerMinute || 1) / 60),
                  priceMode: (meta as any).priceMode || 'buy_once',
                }}
                onSelect={(mode) => {
                  if (mode === 'buy_once') {
                    // PaymentModeSelector already completed the purchase via /payment/points/redeem
                    // Just unlock the video and load the stream — do NOT call payment.handleBuyOnce() again
                    setNeedPurchase(false);
                    setShowPaymentSelector(false);
                    setStatus('Purchase complete! Loading video...');
                    // Re-fetch stream URL now that we're authorized
                    client.get<{ url: string }>(`/content/stream/${id}`)
                      .then(res => {
                        if (res.url && videoRef.current) {
                          const vhsOpts = getVhsOptionsFor(res.url);
                          const player = (playerRef.current = videojs(videoRef.current, {
                            controls: true, autoplay: true, preload: "auto",
                            html5: { vhs: vhsOpts } as any,
                          }));
                          player.src({ src: res.url, type: "application/x-mpegURL" });
                          setStatus('Playing...');
                        }
                      })
                      .catch(() => setStatus('Purchase succeeded. Please refresh to play.'));
                  } else if (mode === 'stream') {
                    setShowPaymentSelector(false);
                    setPendingStreamMode(true);
                  } else {
                    setShowPaymentSelector(false);
                  }
                }}
                onClose={() => setShowPaymentSelector(false)}
              />
            )}

            {/* Live Badge overlay — only for live-streaming content */}
            {(meta as any)?.isLive && (
            <div className="absolute top-6 left-6 flex items-center gap-3 z-10 pointer-events-none">
              <div className="bg-red-600 text-white px-3 py-1 rounded-md text-xs font-bold tracking-widest flex items-center gap-2 shadow-[0_0_10px_rgba(220,38,38,0.5)]">
                <span className="w-2 h-2 rounded-full bg-white animate-pulse"></span> LIVE
              </div>
            </div>
            )}
            {/* Watermark */}
            <div className="absolute top-6 right-6 opacity-30 flex items-center gap-2 z-10 pointer-events-none">
              <svg className="w-5 h-5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon>
              </svg>
              <span className="font-bold tracking-widest text-sm text-white">FIBER_CH01</span>
            </div>
          </div>

          {/* Video Metadata Area */}
          <div className="mt-8 max-w-6xl mx-auto w-full">
            <div className="flex items-start justify-between">
              <div>
                <h1 className="text-3xl font-bold text-white mb-2">{meta?.title || id}</h1>
                <div className="flex items-center gap-4 text-sm text-gray-400">
                  {meta?.category && <span className="text-blue-400 font-semibold cursor-pointer hover:underline">{(meta as any).category}</span>}
                  {meta?.category && <span>•</span>}
                  <span>{(meta as any)?.contentType || 'Video'}</span>
                  {meta?.duration && <><span>•</span><span>{Math.floor((meta as any).duration / 60)}:{String((meta as any).duration % 60).padStart(2, '0')}</span></>}
                </div>
              </div>

              <div className="flex items-center gap-6">
                <div className="flex gap-2">
                  {/* Play Offline Button */}
                  <button
                    disabled={!hasOffline}
                    onClick={async () => {
                      const offline = await loadCachedVideo(id!);
                      if (offline && playerRef.current) {
                        playerRef.current.src({ src: offline, type: "video/mp4" });
                        setStatus("Playing from offline cache");
                      } else {
                        setStatus("Offline cache not found. Please cache first.");
                      }
                    }}
                    className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition-all border ${
                      hasOffline
                        ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20 hover:shadow-[0_0_15px_rgba(16,185,129,0.2)]"
                        : "bg-white/5 border-white/10 text-gray-500 cursor-not-allowed"
                    }`}
                    title={hasOffline ? "Play from local cache" : "No cached version available"}
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    {hasOffline ? "Play Offline" : "No Cache"}
                    {hasOffline && <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />}
                  </button>

                  {/* Cache Offline Button */}
                  <button
                    disabled={downloading}
                    onClick={async () => {
                      if (!id) return;
                      setDownloading(true);
                      setProgress(5);
                      const timer = setInterval(() => {
                        setProgress((p) => (p < 90 ? Math.min(p + Math.random() * 8, 90) : p));
                      }, 300);
                      try {
                        const priceNum = meta ? parseFloat(String(meta.priceUSDI || "0")) : 0;
                        const isPaidContent = !isNaN(priceNum) && priceNum > 0;

                        if (!isPaidContent) {
                          // FREE content: download the current video stream directly
                          setStatus("Downloading video for offline cache...");
                          let videoUrl: string | undefined;
                          try {
                            const streamRes = await client.get<{ url?: string; streamUrl?: string }>(`/content/stream/${id}`);
                            videoUrl = streamRes?.url || streamRes?.streamUrl;
                          } catch { }
                          // Fallback: try samples.json
                          if (!videoUrl) {
                            try {
                              const resp = await fetch('/videos/samples.json');
                              if (resp.ok) {
                                const arr = await resp.json();
                                const hit = (Array.isArray(arr) ? arr : []).find((v: any) => String(v?.id) === String(id));
                                if (hit?.cdnUrl) videoUrl = hit.cdnUrl;
                              }
                            } catch { }
                          }
                          if (videoUrl) {
                            // Fetch as blob, convert to base64
                            const resp = await fetch(videoUrl);
                            const blob = await resp.blob();
                            const arrayBuf = await blob.arrayBuffer();
                            const base64 = btoa(String.fromCharCode(...new Uint8Array(arrayBuf)));
                            const addr = (() => { try { return JSON.parse(sessionStorage.getItem("vp.user") || "{}").ckbAddress || "free-user"; } catch { return "free-user"; } })();
                            await encryptAndCacheVideo(id, base64, addr);
                            setStatus("✅ Offline cache complete!");
                          } else {
                            setStatus("Could not find downloadable video source.");
                          }
                        } else {
                          // PAID content: use offline authorization flow
                          const jwt = sessionStorage.getItem("vp.jwt");
                          const userRaw = sessionStorage.getItem("vp.user");
                          if (!jwt || !userRaw) {
                            setStatus("Login required for offline download.");
                            alert("Please login first to download offline cache");
                            navigate("/login");
                            return;
                          }
                          const usr = JSON.parse(userRaw);
                          if (!usr?.ckbAddress) {
                            setStatus("JoyID login required for paid offline content");
                            alert("Please login with JoyID to download offline playback");
                            return;
                          }
                          setStatus("Requesting offline authorization...");
                          const dfp = sessionStorage.getItem("vp.offline.dfp") || (() => {
                            const v = btoa(`${navigator.userAgent}|${screen.width}x${screen.height}`);
                            sessionStorage.setItem("vp.offline.dfp", v);
                            return v;
                          })();
                          const grant = await client.post<{ video_id: string; offline_token: string; expires_in: number; cdn_urls: string[] }>("/content/play/offline", { videoId: id, deviceFingerprint: dfp });
                          sessionStorage.setItem("vp.offline.jwt", grant.offline_token);
                          setStatus(`Authorized, caching video...`);
                          const offlineClient = getApiClient();
                          offlineClient.setJWT(grant.offline_token);
                          const raw = await offlineClient.get<{ base64: string }>(`/content/raw/${id}`);
                          const m = meta || (await client.get<VideoMeta>(`/metadata/${id}`));
                          await encryptAndCacheVideo(id, raw.base64, m.creatorCkbAddress);
                          setStatus("✅ Offline cache complete!");
                        }
                        setProgress(100);
                        setTimeout(() => setProgress(0), 1200);
                        try { setHasOffline(await checkCacheExists(id)); } catch { }
                      } catch (e: any) {
                        setStatus(`Cache failed: ${e?.error || e?.message || "Unknown error"}`);
                      } finally {
                        clearInterval(timer);
                        setDownloading(false);
                        setTimeout(() => setProgress(0), 800);
                      }
                    }}
                    className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition-all border bg-[#22d3ee]/5 border-[#22d3ee]/20 text-[#22d3ee] hover:bg-[#22d3ee]/10 hover:border-[#22d3ee]/40 hover:shadow-[0_0_15px_rgba(34,211,238,0.15)] disabled:opacity-50 relative overflow-hidden"
                  >
                    {downloading ? (
                      <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                    ) : (
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                      </svg>
                    )}
                    {downloading ? `Caching ${Math.round(progress)}%` : "Cache Offline"}
                    {progress > 0 && (
                      <div className="absolute bottom-0 left-0 h-0.5 bg-[#22d3ee] transition-all duration-200" style={{ width: `${progress}%` }} />
                    )}
                  </button>
                  {/* Report */}
                  <button onClick={() => setShowReport(true)} className="flex items-center gap-1.5 px-3 py-2.5 rounded-xl text-xs font-bold transition-all border bg-white/5 border-white/10 text-gray-400 hover:bg-red-500/10 hover:text-red-400 hover:border-red-500/20">
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 21v-4m0 0V5a2 2 0 012-2h6.5l1 1H21l-3 6 3 6h-8.5l-1-1H5a2 2 0 00-2 2zm9-13.5V9" />
                    </svg>
                    Report
                  </button>
                </div>

                <div className="w-px h-8 bg-white/20 hidden md:block"></div>

                {/* Creator Badge */}
                <div
                  onClick={() => meta?.creatorCkbAddress && navigate(`/profile/${meta.creatorCkbAddress}`)}
                  className="flex items-center gap-4 bg-white/5 p-3 rounded-2xl border border-white/10 hover:bg-white/10 cursor-pointer transition-colors"
                >
                  <div className="w-12 h-12 rounded-full bg-cover shadow-lg" style={{ backgroundImage: `url(https://api.dicebear.com/7.x/avataaars/svg?seed=${meta?.creatorCkbAddress || "nexus"})` }}></div>
                  <div className="flex-1">
                    <div className="text-white font-bold flex items-center gap-1 hover:text-[#22d3ee] transition-colors">
                      {meta?.creatorCkbAddress ? `${meta.creatorCkbAddress.slice(0, 6)}...${meta.creatorCkbAddress.slice(-4)}` : "Cosmic Studios"}
                      <svg className="w-4 h-4 text-[#22d3ee]" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"></path>
                      </svg>
                    </div>
                    <div className="text-xs text-gray-400 font-mono mt-0.5">1.2M Followers</div>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      if (!jwt) { alert('Please login first'); navigate('/login'); return; }
                      client.post('/metadata/follow', { targetAddress: meta?.creatorCkbAddress }).catch(() => { });
                      const btn = e.currentTarget;
                      btn.textContent = 'Following';
                      btn.classList.replace('bg-white', 'bg-white/20');
                      btn.classList.replace('text-black', 'text-white');
                    }}
                    className="ml-2 bg-white text-black px-4 py-1.5 rounded-full text-sm font-bold hover:bg-gray-200 hover:scale-105 transition-all shadow-[0_0_15px_rgba(255,255,255,0.2)]"
                  >
                    Follow
                  </button>
                </div>
              </div>
            </div>

            <div className="mt-8 relative overflow-hidden p-6 rounded-2xl border border-white/5 bg-[#0A0A14]">
              <div className="absolute top-0 right-0 p-4 opacity-10 pointer-events-none">
                <svg className="w-32 h-32" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"></path>
                </svg>
              </div>
              <h3 className="text-lg font-bold text-white mb-2">Revenue Split Structure</h3>
              <p className="text-sm text-gray-400 max-w-2xl mb-6">This content utilizes an on-chain dual-economy smart contract on CKB Fiber Network. All streams and tips are routed instantly.</p>
              <div className="w-full bg-black h-8 rounded-full overflow-hidden flex shadow-inner border border-white/10 relative z-10">
                <div className="h-full bg-[#22d3ee] flex items-center px-4 font-bold text-black text-xs" style={{ width: "80%" }}>Creator 80%</div>
                <div className="h-full bg-[#a855f7] flex items-center px-2 font-bold text-white text-xs border-l border-black/20" style={{ width: "15%" }} >Platform 15%</div>
                <div className="h-full bg-gray-600 flex items-center justify-center font-bold text-xs border-l border-black/20" style={{ width: "5%" }}>Fee 5%</div>
              </div>
            </div>

            {/* On-Chain Proof */}
            {meta && (
              <div className="mt-6 p-5 rounded-2xl border border-cyan-500/20 bg-cyan-500/5">
                <h3 className="text-sm font-bold text-cyan-400 mb-3 flex items-center gap-2 uppercase tracking-wider">
                  🔗 On-Chain Proof
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs font-mono">
                  {/* Spore NFT */}
                  {(meta as any).sporeId && (
                    <a
                      href={`https://pudge.explorer.nervos.org/transaction/${(meta as any).sporeTxHash || ''}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 p-2.5 rounded-lg bg-black/30 border border-white/5 hover:border-cyan-500/50 transition-colors group"
                    >
                      <span className="text-purple-400">💎 Spore</span>
                      <span className="text-gray-400 truncate flex-1">{(meta as any).sporeId?.slice(0, 12)}...{(meta as any).sporeId?.slice(-6)}</span>
                      <span className="text-gray-600 group-hover:text-cyan-400 transition-colors">↗</span>
                    </a>
                  )}
                  {/* Arweave */}
                  {(meta as any).arweaveTxId && (
                    <a
                      href={`https://viewblock.io/arweave/tx/${(meta as any).arweaveTxId}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 p-2.5 rounded-lg bg-black/30 border border-white/5 hover:border-cyan-500/50 transition-colors group"
                    >
                      <span className="text-blue-400">🗄️ Arweave</span>
                      <span className="text-gray-400 truncate flex-1">{(meta as any).arweaveTxId?.slice(0, 12)}...{(meta as any).arweaveTxId?.slice(-6)}</span>
                      <span className="text-gray-600 group-hover:text-cyan-400 transition-colors">↗</span>
                    </a>
                  )}
                  {/* IPFS CID */}
                  {(meta as any).filecoinCid && (
                    <a
                      href={`https://w3s.link/ipfs/${(meta as any).filecoinCid}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 p-2.5 rounded-lg bg-black/30 border border-white/5 hover:border-cyan-500/50 transition-colors group"
                    >
                      <span className="text-green-400">📦 IPFS</span>
                      <span className="text-gray-400 truncate flex-1">{(meta as any).filecoinCid?.slice(0, 12)}...{(meta as any).filecoinCid?.slice(-6)}</span>
                      <span className="text-gray-600 group-hover:text-cyan-400 transition-colors">↗</span>
                    </a>
                  )}
                  {/* SHA-256 */}
                  {(meta as any).sha256 && (
                    <div className="flex items-center gap-2 p-2.5 rounded-lg bg-black/30 border border-white/5">
                      <span className="text-yellow-400">🔐 SHA-256</span>
                      <span className="text-gray-400 truncate flex-1">{(meta as any).sha256?.slice(0, 12)}...{(meta as any).sha256?.slice(-6)}</span>
                    </div>
                  )}
                </div>
                {/* No on-chain data fallback */}
                {!(meta as any).sporeId && !(meta as any).arweaveTxId && !(meta as any).filecoinCid && !(meta as any).sha256 && (
                  <div className="text-gray-500 text-xs">On-chain certification pending. Content stored locally.</div>
                )}
              </div>
            )}

            <p className="mt-8 text-gray-400 text-sm leading-relaxed max-w-4xl">{meta?.description || "No description provided."}</p>
          </div>
        </main>

        {/* Right Sidebar: Live Chat & Gamification */}
        <aside className="hidden lg:flex w-[380px] flex-shrink-0 flex-col h-full border-l border-white/5 shadow-2xl relative z-20" style={{ background: "rgba(10, 10, 15, 0.7)", backdropFilter: "blur(15px)" }}>
          <div className="h-16 border-b border-white/5 flex items-center justify-between px-6 bg-black/40">
            <h3 className="font-bold text-white flex items-center gap-2">
              <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"></path>
              </svg>
              Live Chat
            </h3>
            <span className="text-xs font-bold text-gray-500 bg-white/5 px-2 py-1 rounded">Top Chat</span>
          </div>

          <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4" id="vp-chat-area">
            {/* Dynamic comments from API */}
            {(chatMessages.length === 0) ? (
              <div className="text-center text-gray-500 text-sm py-8">No comments yet. Be the first!</div>
            ) : chatMessages.map((msg, i) => (
              msg.type === 'tip' ? (
                <div key={i} className="bg-gradient-to-r from-[#22d3ee]/20 to-blue-600/10 border-l-4 border-[#22d3ee] p-3 rounded-r-xl my-1 relative overflow-hidden">
                  <div className="flex items-center gap-2 mb-1">
                    <div className="w-6 h-6 rounded-full bg-[#22d3ee]/30 flex items-center justify-center text-[10px] font-bold text-[#22d3ee]">{(msg.from || '?')[0]}</div>
                    <span className="font-bold text-white text-sm">{msg.from}</span>
                    <span className="bg-[#22d3ee]/20 text-[#22d3ee] text-[10px] font-bold px-1.5 py-0.5 rounded ml-auto">TIP</span>
                    <span className="font-mono font-bold text-[#22d3ee] text-sm">+{msg.amount} PTS</span>
                  </div>
                  <p className="text-sm text-gray-200 mt-1 pl-8">{msg.text}</p>
                </div>
              ) : (
                <div key={i} className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-full bg-blue-500/20 text-blue-400 flex items-center justify-center font-bold text-xs flex-shrink-0 border border-blue-500/30">
                    {(msg.from || '?').slice(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <span className="text-sm font-bold text-gray-300 mr-2">{msg.from}</span>
                    <span className="text-sm text-gray-400">{msg.text}</span>
                  </div>
                </div>
              )
            ))}
          </div>

          <div className="p-4 bg-black/60 border-t border-white/5 backdrop-blur-xl">
            <div className="flex justify-between mb-3 px-1">
              <button className="w-10 h-10 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 flex items-center justify-center text-lg hover:scale-110 transition-transform cursor-pointer" onClick={() => sendQuickEmoji('👏', 1)}>👏</button>
              <button className="w-10 h-10 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 flex items-center justify-center text-lg hover:scale-110 transition-transform cursor-pointer" onClick={() => sendQuickEmoji('🔥', 5)}>🔥</button>
              <button className="w-10 h-10 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 flex items-center justify-center text-lg shadow-[0_0_15px_rgba(250,204,21,0.2)] hover:scale-110 transition-transform relative group cursor-pointer" onClick={() => sendQuickEmoji('💰', 10)}>💰</button>
              <button className="w-auto px-4 rounded-full bg-gradient-to-r from-[#22d3ee] to-blue-500 text-black font-bold text-sm shadow-[0_0_15px_rgba(34,211,238,0.3)] hover:scale-105 transition-transform flex items-center gap-1 cursor-pointer" onClick={() => sendQuickEmoji('⚡', 50)}>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z"></path>
                </svg>
                Super Tip
              </button>
            </div>

            <div className="relative">
              <input type="text" placeholder="Say something in the chat..." className="w-full bg-white/5 border border-white/10 rounded-xl py-3 pl-4 pr-12 text-sm text-white focus:outline-none focus:border-[#22d3ee]/50 focus:bg-white/10 transition-colors" onKeyDown={(e) => {
                if (e.key === 'Enter' && (e.target as HTMLInputElement).value.trim()) {
                  const text = (e.target as HTMLInputElement).value.trim();
                  if (!jwt) { alert('Please login to chat'); return; }
                  const username = (() => { try { return JSON.parse(userRaw || '{}').username || 'You'; } catch { return 'You'; } })();
                  // Add to chat messages for real-time display
                  setChatMessages(prev => [...prev, { type: 'comment', from: username, text }]);
                  // Post to both danmaku and comments API
                  client.post(`/content/video/${id}/comments`, { content: text }).catch(() => { });
                  client.post('/metadata/danmaku/send', { videoId: id, content: text, timestamp: 0 }).catch(() => { });
                  (e.target as HTMLInputElement).value = '';
                  // Auto-scroll
                  setTimeout(() => { const el = document.getElementById('vp-chat-area'); if (el) el.scrollTop = el.scrollHeight; }, 100);
                }
              }} />
              <button className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 flex items-center justify-center text-[#22d3ee] hover:text-white transition-colors cursor-pointer" onClick={(e) => {
                const input = (e.currentTarget.parentElement?.querySelector('input') as HTMLInputElement);
                if (input?.value.trim()) {
                  if (!jwt) { alert('Please login to chat'); return; }
                  const text = input.value.trim();
                  const username = (() => { try { return JSON.parse(userRaw || '{}').username || 'You'; } catch { return 'You'; } })();
                  setChatMessages(prev => [...prev, { type: 'comment', from: username, text }]);
                  client.post(`/content/video/${id}/comments`, { content: text }).catch(() => { });
                  client.post('/metadata/danmaku/send', { videoId: id, content: text, timestamp: 0 }).catch(() => { });
                  input.value = '';
                  setTimeout(() => { const el = document.getElementById('vp-chat-area'); if (el) el.scrollTop = el.scrollHeight; }, 100);
                }
              }}>
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"></path>
                </svg>
              </button>
            </div>
          </div>
        </aside>
      </div>
      {showReport && (
        <ReportModal contentId={id || ''} contentType="video" onClose={() => setShowReport(false)} />
      )}
    </div>
  );
}