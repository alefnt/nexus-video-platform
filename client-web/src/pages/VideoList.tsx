// FILE: /video-platform/client-web/src/pages/VideoList.tsx
/**
 * 功能说明：
 * - 展示视频列表（来自元数据服务或本地缓存）。
 * - 支持进入播放器页与发起支付。
 */

import React, { useEffect, useState } from "react";
import { ApiClient } from "@video-platform/shared/api/client";
import type { VideoMeta, PaymentIntent, PointsBalance } from "@video-platform/shared/types";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { encryptAndCacheVideo, checkCacheExists, clearCachedVideo } from "../lib/offlineCache";
import { connect, signChallenge } from "@joyid/ckb";
import PaymentModeSelector from "../components/PaymentModeSelector";

const client = new ApiClient();

// 新增：统一类型枚举（用于下拉与 Chips）
const GENRES: string[] = [
  "All",
  "Technology",
  "Gaming",
  "Music",
  "Education",
  "Crypto & Web3",
  "Vlogs",
  "Short Films"
];

// 错误边界：避免渲染阶段异常导致整页崩溃
class PageErrorBoundary extends React.Component<{ fallback?: React.ReactNode; children?: React.ReactNode }, { hasError: boolean; msg?: string }> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false, msg: undefined };
  }
  static getDerivedStateFromError(error: any) {
    return { hasError: true, msg: String(error?.message || error) };
  }
  componentDidCatch(error: any, _info: any) {
    try { console.error("[VideoList] render error:", error); } catch { }
  }
  render() {
    if (this.state.hasError) {
      return this.props.fallback || (
        <div className="min-h-screen bg-bgMain text-white flex items-center justify-center">
          <div className="glass-panel p-8 max-w-md text-center rounded-2xl border border-red-500/20">
            <div className="text-red-400 mb-4 text-xl font-bold">页面发生错误，已安全降级。</div>
            <p className="text-red-200 text-sm mb-4 truncate">{this.state.msg || "未知错误"}</p>
            <p className="text-gray-400 text-xs">提示：可尝试刷新或稍后重试。</p>
          </div>
        </div>
      );
    }
    return this.props.children as any;
  }
}

// 新增：本地示例数据（当 /metadata/list 失败时作为降级展示）
function getDemoVideos(): VideoMeta[] {
  const now = new Date().toISOString();
  return [
    {
      id: "demo-bbb",
      title: "Big Buck Bunny",
      description: "Blender Foundation open-source animated short film. A giant rabbit takes revenge on three bullying rodents.",
      creatorBitDomain: "alice-creator.bit",
      creatorCkbAddress: "ckt1qzda0cr08m85hc8jlnfp3zer7xulejywt49kt2rr0vthywaa50xwsq2qf8kezy2p3elx0x04kgtz2yzqmfc7aacl0001",
      priceUSDI: "5",
      priceMode: "both",
      pointsPrice: 50,
      buyOncePrice: 50,
      streamPricePerMinute: 1,
      cdnUrl: "/videos/BigBuckBunny.mp4",
      createdAt: now,
      genre: "Short Films",
      durationSeconds: 600,
      posterUrl: "https://peach.blender.org/wp-content/uploads/title_anouncement.jpg?x11217"
    } as any,
    {
      id: "demo-sintel",
      title: "Sintel",
      description: "Blender Foundation's stunning open-source animated short. A young woman searches for her lost dragon companion.",
      creatorBitDomain: "bob-studio.bit",
      creatorCkbAddress: "ckt1qzda0cr08m85hc8jlnfp3zer7xulejywt49kt2rr0vthywaa50xwsq2qf8kezy2p3elx0x04kgtz2yzqmfc7aacl0002",
      priceUSDI: "5",
      priceMode: "both",
      pointsPrice: 50,
      buyOncePrice: 50,
      streamPricePerMinute: 1,
      cdnUrl: "/videos/Sintel.mp4",
      createdAt: now,
      genre: "Short Films",
      durationSeconds: 888,
      posterUrl: "https://upload.wikimedia.org/wikipedia/commons/3/3a/Sintel_poster.jpg"
    } as any,
    {
      id: "demo-tears",
      title: "Tears of Steel",
      description: "Blender Foundation sci-fi short film. A group of warriors and their sentient robot fight in a dystopian Amsterdam.",
      creatorBitDomain: "charlie-media.bit",
      creatorCkbAddress: "ckt1qzda0cr08m85hc8jlnfp3zer7xulejywt49kt2rr0vthywaa50xwsq2qf8kezy2p3elx0x04kgtz2yzqmfc7aacl0003",
      priceUSDI: "6",
      priceMode: "both",
      pointsPrice: 60,
      buyOncePrice: 60,
      streamPricePerMinute: 1,
      cdnUrl: "/videos/TearsOfSteel.mp4",
      createdAt: now,
      genre: "Crypto & Web3",
      durationSeconds: 734,
      posterUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/e/e0/Tears_of_Steel_poster.jpg/800px-Tears_of_Steel_poster.jpg"
    } as any,
    {
      id: "demo-fun",
      title: "For Bigger Fun",
      description: "Google Chromecast sample short clip — fun festival moments.",
      creatorBitDomain: "nexus-creator.bit",
      creatorCkbAddress: "ckt1qzda0cr08m85hc8jlnfp3zer7xulejywt49kt2rr0vthywaa50xwsqwgx292hnvmn68xf779vmzrshpmm6epn4c0cgwga",
      priceUSDI: "1",
      priceMode: "both",
      pointsPrice: 10,
      buyOncePrice: 10,
      streamPricePerMinute: 1,
      cdnUrl: "/videos/ForBiggerFun.mp4",
      createdAt: now,
      genre: "Gaming",
      durationSeconds: 60,
      posterUrl: "https://images.unsplash.com/photo-1489710437720-ebb67ec84dd2?w=400&q=80"
    } as any,
  ];
}

export default function VideoList() {
  const [videos, setVideos] = useState<VideoMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [cachedMap, setCachedMap] = useState<Record<string, boolean>>({});

  const [points, setPoints] = useState<PointsBalance | null>(null);
  // 搜索/筛选/排序与收藏
  const [query, setQuery] = useState<string>("");
  const [type, setType] = useState<string>("All");
  const [minPrice, setMinPrice] = useState<string>("");
  const [maxPrice, setMaxPrice] = useState<string>("");
  const [sortBy, setSortBy] = useState<"热度" | "销量" | "价格" | "最新">("热度");

  // 视图模式：列表 / 合集分组
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");

  const [favorites, setFavorites] = useState<string[]>(() => {
    try {
      const raw = typeof window !== "undefined" ? localStorage.getItem("vp.favs") : null;
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  });

  const [showPaymentSelector, setShowPaymentSelector] = useState<{ video: VideoMeta } | null>(null);
  const [userEntitlements, setUserEntitlements] = useState<string[]>([]);
  const PAGE_SIZE = 12;
  const [page, setPage] = useState(1);
  const navigate = useNavigate();
  const { t } = useTranslation();
  const jwt = typeof window !== "undefined" ? sessionStorage.getItem("vp.jwt") : null;
  if (jwt) client.setJWT(jwt);

  // Styling for the new UI concepts
  useEffect(() => {
    const applyStyles = () => {
      document.body.classList.add('bg-bgMain', 'text-white', 'antialiased', 'font-sans');
      const root = document.getElementById('root');
      if (root) {
        root.classList.add('flex', 'flex-col', 'min-h-screen');
      }
    };
    applyStyles();
    return () => {
      document.body.classList.remove('bg-bgMain', 'text-white', 'antialiased', 'font-sans');
      const root = document.getElementById('root');
      if (root) {
        root.classList.remove('flex', 'flex-col', 'min-h-screen');
      }
    };
  }, []);


  // 新增：加载本地 samples.json 并与远端列表合并
  async function loadLocalSamples(): Promise<VideoMeta[]> {
    try {
      const resp = await fetch("/videos/samples.json");
      if (!resp.ok) return [];
      const arr = await resp.json();
      if (Array.isArray(arr)) return arr as VideoMeta[];
      return [];
    } catch {
      return [];
    }
  }


  useEffect(() => {
    (async () => {
      try {
        const list = await client.get<VideoMeta[]>("/metadata/list");
        // 合并本地样例清单（去重，以远端 ID 优先）
        const samples = await loadLocalSamples();
        const exists = new Set((list || []).map((x) => String(x.id)));
        const merged = (list || []).concat(samples.filter((s) => !exists.has(String(s.id))));
        if (Array.isArray(merged)) {
          setVideos(merged);
          setError(null);
        } else {
          setVideos([]);
          setError("暂无视频数据");
        }
        // 尝试获取积分余额（忽略未登录/网关不可用错误）
        try {
          const bal = await client.get<PointsBalance>("/payment/points/balance");
          setPoints(bal);
        } catch { }
        // 新增：获取用户已购买的视频ID列表
        try {
          const entRes = await client.get<{ videoIds: string[] }>("/content/entitlements/by-user/me");
          if (entRes?.videoIds && Array.isArray(entRes.videoIds)) {
            setUserEntitlements(entRes.videoIds);
          }
        } catch { }
      } catch (e: any) {
        try { console.warn("[VideoList] /metadata/list failed:", e); } catch { }
        // 新增：降级到本地示例数据，避免页面空白
        const fallback = getDemoVideos();
        // 合并 samples.json
        const samples = await loadLocalSamples();
        const exists = new Set(fallback.map((x) => String(x.id)));
        const merged = fallback.concat(samples.filter((s) => !exists.has(String(s.id))));
        setVideos(merged);
        setError(null);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  function inferCategory(v: VideoMeta): string {
    const anyV: any = v as any;
    const genre = String(anyV.genre || "").trim();
    if (GENRES.includes(genre)) return genre;
    const title = (v.title || "").toLowerCase();
    const desc = (v.description || "").toLowerCase();
    const text = `${title} ${desc}`;
    // 关键字映射到类别
    const pairs: Array<{ keys: string[]; val: string }> = [
      { keys: ["纪录", "纪实", "documentary"], val: "Technology" },
      { keys: ["游戏", "电竞", "实况", "直播", "game"], val: "Gaming" },
      { keys: ["音乐", "演唱", "乐队", "mv", "music"], val: "Music" },
      { keys: ["科技", "技术", "编程", "代码", "ai", "tech"], val: "Technology" },
      { keys: ["教育", "教程", "课堂", "课", "course", "lesson"], val: "Education" },
      { keys: ["web3", "crypto", "blockchain"], val: "Crypto & Web3" },
      { keys: ["vlog"], val: "Vlogs" },
      { keys: ["short", "film"], val: "Short Films" },
    ];
    for (const p of pairs) {
      if (p.keys.some((k) => text.includes(k))) return p.val;
    }
    return "Technology"; // default fallback for UI
  }

  function getHeat(v: VideoMeta): number {
    const anyV: any = v as any;
    const favoritesCount = Number(anyV.favorites || 0);
    const score = favoritesCount * 10 + (Date.parse(v.createdAt || "") || 0) / 1_000_000_000;
    return score;
  }

  function formatDuration(sec: number): string {
    if (!sec || isNaN(sec)) return "00:00";
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  }

  function getSales(v: VideoMeta): number {
    const anyV: any = v as any;
    if (typeof anyV.sales === "number") return anyV.sales;
    // 无销量字段时，用创建时间近似
    return Date.parse(v.createdAt || "") || 0;
  }

  function getPointsCost(v: VideoMeta): number {
    const pp = (v as any)?.pointsPrice;
    if (typeof pp === "number" && !Number.isNaN(pp)) return pp;
    const usdi = parseFloat(v.priceUSDI || "0");
    const ratio = points?.pointsPerUSDI ?? 10000; // 默认：1 USDI ≈ 10000 积分
    const cost = (!isNaN(usdi) ? usdi : 0) * ratio;
    return Math.round(cost);
  }

  // 刷新积分余额
  async function refreshPoints() {
    try {
      const bal = await client.get<PointsBalance>("/payment/points/balance");
      setPoints(bal);
    } catch { }
  }

  function applyFilters(list: VideoMeta[]): VideoMeta[] {
    const q = query.trim().toLowerCase();
    const max = parseFloat(maxPrice || "");
    return list
      .filter((v) => {
        const titleOk = !q || (v.title || "").toLowerCase().includes(q) || (v.description || "").toLowerCase().includes(q);
        const catOk = type === "All" || inferCategory(v) === type;
        const p = getPointsCost(v);
        const maxOk = isNaN(max) ? true : p <= max;
        // Access Gate mapping
        const anyV: any = v as any;
        const passReq = !!anyV.passRequired;
        const isFree = p === 0 && !passReq;
        let accessOk = true;

        if (minPrice === "1" && maxPrice === "") {
          // Pass Gated only
          accessOk = passReq;
        } else if (maxPrice === "0" && minPrice === "") {
          // Free View only
          accessOk = isFree;
        }

        return titleOk && catOk && maxOk && accessOk;
      })
      .sort((a, b) => {
        switch (sortBy) {
          case "热度":
            return getHeat(b) - getHeat(a);
          case "销量": // approximated as Most Viewed in UI
            return getSales(b) - getSales(a);
          case "价格": {
            const pa = getPointsCost(a);
            const pb = getPointsCost(b);
            return pb - pa;
          }
          case "最新":
          default:
            return (Date.parse(b.createdAt || "") || 0) - (Date.parse(a.createdAt || "") || 0);
        }
      });
  }

  // 将本地模拟上传的视频合并进列表
  function mergeWithDemoUploads(list: VideoMeta[]): VideoMeta[] {
    try {
      const raw = typeof window !== "undefined" ? localStorage.getItem("vp.demo.uploads") : null;
      const uploads: VideoMeta[] = raw ? JSON.parse(raw) : [];
      const exists = new Set(list.map((x) => String(x.id)));
      const merged = list.slice();
      for (const u of uploads) {
        if (!exists.has(String(u.id))) merged.push(u);
      }
      return merged;
    } catch {
      return list;
    }
  }

  function toggleFavorite(id: string) {
    setFavorites((prev) => {
      const next = prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id];
      try { localStorage.setItem("vp.favs", JSON.stringify(next)); } catch { }
      return next;
    });
  }

  async function payAndPlay(v: VideoMeta) {
    try {
      const jwt = typeof window !== "undefined" ? sessionStorage.getItem("vp.jwt") : null;
      const userRaw = typeof window !== "undefined" ? sessionStorage.getItem("vp.user") : null;
      if (!jwt || !userRaw) { alert(t('player.loginRequired', "请先登录后再购买")); navigate("/login"); return; }

      client.setJWT(jwt);
      const user = JSON.parse(userRaw || "{}");
      const priceNum = parseFloat(String((v as any)?.priceUSDI || "0"));
      const isPaid = !isNaN(priceNum) && priceNum > 0;
      if (!user?.ckbAddress && isPaid) { alert(t('player.joyIdRequired', "付费内容需要 JoyID 登录。")); return; }

      // 余额检查
      const requiredPoints = getPointsCost(v);
      try {
        const balanceRes = await client.get<{ balance: number }>("/payment/points/balance");
        const currentBalance = balanceRes?.balance || 0;

        if (currentBalance < requiredPoints) {
          const goTopUp = confirm(
            `余额不足！\n当前余额: ${currentBalance} 积分\n需要: ${requiredPoints} 积分\n\n是否前往积分中心充值？`
          );
          if (goTopUp) {
            navigate("/points");
          }
          return;
        }
      } catch (e) {
        console.warn("Failed to check balance:", e);
      }

      const intent = await client.post<PaymentIntent>("/payment/create", {
        videoId: v.id,
        amountUSDI: v.priceUSDI,
      });
      let streamUrlFromRedeem: string | undefined;
      if (intent.status === "htlc_locked") {
        const redeemRes = await client.post<{ status: string; streamUrl?: string }>("/payment/redeem", { intentId: intent.intentId });
        streamUrlFromRedeem = redeemRes?.streamUrl;
      }
      await refreshPoints().catch(() => { });
      navigate(`/player/${v.id}`, { state: streamUrlFromRedeem ? { streamUrl: streamUrlFromRedeem } : undefined });
    } catch (e: any) {
      alert(e?.error || e?.message || t('player.paymentFailed', "支付失败"));
    }
  }

  async function redeemWithPoints(v: VideoMeta) {
    try {
      const jwt = typeof window !== "undefined" ? sessionStorage.getItem("vp.jwt") : null;
      const userRaw = typeof window !== "undefined" ? sessionStorage.getItem("vp.user") : null;
      if (!jwt || !userRaw) { alert(t('player.loginRequired', "请先登录后再购买")); navigate("/login"); return; }
      client.setJWT(jwt);
      const user = JSON.parse(userRaw || "{}");
      const priceNum = parseFloat(String((v as any)?.priceUSDI || "0"));
      const isPaid = !isNaN(priceNum) && priceNum > 0;
      if (!user?.ckbAddress && isPaid) { alert(t('player.joyIdRequired', "付费内容需要 JoyID 登录。")); return; }

      const { challenge } = await client.get<{ nonceId: string; challenge: string; expiresInMs: number }>(`/payment/points/redeem_nonce?videoId=${encodeURIComponent(v.id)}`);
      let address = user?.ckbAddress || "";
      if (!address) {
        const info = await connect();
        address = (info as any)?.address || "";
      }
      if (!address) { alert("未检测到 JoyID 地址，请重试登录"); return; }
      const desc = `${getPointsCost(v)}积分购买视频确认`;
      const challengeWithMsg = `${challenge}|msg=${desc}`;
      const signatureData = await signChallenge(challengeWithMsg, address);
      await client.post("/payment/points/redeem", { videoId: v.id, signatureData: { ...(signatureData as any), challenge: challengeWithMsg }, address });
      await refreshPoints().catch(() => { });
      navigate(`/player/${v.id}`);
    } catch (e: any) {
      alert(e?.error || e?.message || "积分兑换失败");
    }
  }

  async function downloadAndCache(v: VideoMeta) {
    if (!v?.cdnUrl) { alert("缺少视频播放地址"); return; }
    try {
      setDownloadingId(v.id);
      await encryptAndCacheVideo(v.id, v.cdnUrl, (v as any).creatorCkbAddress || "");
      const ok = await checkCacheExists(v.id);
      setCachedMap((prev) => ({ ...prev, [v.id]: ok }));
    } catch (e: any) {
      alert(e?.message || "缓存失败");
    } finally {
      setDownloadingId(null);
    }
  }

  async function clearCache(v: VideoMeta) {
    try {
      await clearCachedVideo(v.id);
      setCachedMap((prev) => ({ ...prev, [v.id]: false }));
    } catch { }
  }

  if (loading)
    return (
      <div className="min-h-screen bg-bgMain text-white flex flex-col items-center justify-center">
        <div className="w-12 h-12 border-4 border-nexusCyan border-t-transparent rounded-full animate-spin"></div>
        <div className="mt-4 text-nexusCyan font-bold tracking-widest">{t('common.loading', 'Loading Database...')}</div>
      </div>
    );

  const filtered = applyFilters(mergeWithDemoUploads(videos));
  const heroVideo = filtered[0] || null;

  function getTimeAgo(createdAt: string): string {
    const diff = Date.now() - new Date(createdAt).getTime();
    const days = Math.floor(diff / 86400000);
    if (days < 1) return "12 hours ago"; // Hardcoded for aesthetics
    if (days < 7) return `${days} days ago`;
    if (days < 30) return `${Math.floor(days / 7)} weeks ago`;
    return `${Math.floor(days / 30)} months ago`;
  }

  function getViewCount(id: string): string {
    const seed = id.split("").reduce((a, c) => a + c.charCodeAt(0), 0);
    const views = ((seed * 137) % 50000) + 100;
    if (views >= 1000) return `${(views / 1000).toFixed(1)}K views`;
    return `${views} views`;
  }

  return (
    <PageErrorBoundary>

      {/* Global Cyber Grid Background */}
      <div className="fixed inset-0 bg-cyber-grid bg-[length:40px_40px] opacity-[0.15] pointer-events-none z-0"></div>



      <main className="flex-1 flex flex-col z-10 w-full max-w-[1800px] mx-auto pt-8 px-4 sm:px-8 pb-32">

        {/* Top Trending Highlight (Hero Banner) */}
        {heroVideo && (
          <div className="mb-12 relative rounded-2xl overflow-hidden glass-panel border border-white/10 group cursor-pointer h-[400px]"
            onClick={() => {
              const pCost = getPointsCost(heroVideo);
              const isPaidHero = pCost > 0;
              if (isPaidHero) {
                const jwt = typeof window !== 'undefined' ? sessionStorage.getItem('vp.jwt') : null;
                if (!jwt) {
                  alert('Please login first to access paid content.');
                  navigate('/login');
                  return;
                }
                setShowPaymentSelector({ video: heroVideo });
              } else {
                navigate(`/player/${heroVideo.id}`);
              }
            }}>
            <div className="absolute inset-0 bg-gradient-to-r from-black via-black/80 to-transparent z-10"></div>
            <img src={(heroVideo as any).posterUrl || "https://images.unsplash.com/photo-1605810230434-7631ac76ec81?q=80&w=2000&auto=format&fit=crop"}
              className="absolute inset-0 w-full h-full object-cover opacity-60 mix-blend-screen group-hover:scale-105 transition-transform duration-1000" alt="" />

            <div className="relative z-20 p-8 md:p-12 flex flex-col justify-center min-h-[300px] w-full max-w-2xl h-full">
              <div className="flex items-center gap-2 mb-4">
                <span className="bg-nexusCyan/20 text-nexusCyan border border-nexusCyan/30 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-widest flex items-center gap-1">
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"></path>
                  </svg>
                  Trending #1
                </span>
                {heroVideo.genre && (
                  <span className="bg-nexusPurple/20 text-nexusPurple border border-nexusPurple/30 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-widest">
                    {heroVideo.genre}
                  </span>
                )}
              </div>
              <h1 className="text-4xl md:text-5xl font-display font-black text-white mb-4 leading-tight drop-shadow-2xl">
                {heroVideo.title}
              </h1>
              <p className="text-gray-400 text-sm mb-6 line-clamp-2 max-w-xl">
                {heroVideo.description || "The future of interactive media."}
              </p>
              <div className="flex items-center gap-4">
                <button className="bg-white text-black hover:bg-gray-200 px-6 py-2.5 rounded-full text-sm font-bold transition-colors flex items-center gap-2 shadow-[0_0_20px_rgba(255,255,255,0.3)]">
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M4 4l12 6-12 6z"></path>
                  </svg>
                  Watch Now
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); toggleFavorite(heroVideo.id); }}
                  className="bg-white/10 hover:bg-white/20 text-white backdrop-blur border border-white/20 px-4 py-2.5 rounded-full text-sm font-bold transition-colors">
                  {favorites.includes(heroVideo.id) ? "★ Saved" : "Add to List"}
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="flex flex-col xl:flex-row gap-8 items-start">

          {/* Premium Left Sidebar Filters */}
          <aside className="w-full xl:w-64 flex-shrink-0 sticky top-28 z-20">
            <div className="space-y-8">

              {/* View Modes */}
              <div className="glass-panel p-1 rounded-lg flex border border-white/5 bg-black/40">
                <button className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-md text-xs font-bold transition-colors ${viewMode === 'grid' ? 'bg-white/10 text-white border border-white/10 shadow-lg' : 'text-gray-500 hover:text-white'}`} onClick={() => setViewMode('grid')}>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z"></path></svg>
                  Grid
                </button>
                <button className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-md text-xs font-bold transition-colors ${viewMode === 'list' ? 'bg-white/10 text-white border border-white/10 shadow-lg' : 'text-gray-500 hover:text-white'}`} onClick={() => setViewMode('list')}>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16"></path></svg>
                  List
                </button>
              </div>

              {/* Categories */}
              <div>
                <h3 className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-3 flex items-center gap-2">
                  <svg className="w-3 h-3 text-nexusCyan" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z"></path></svg>
                  Categories
                </h3>
                <div className="flex flex-wrap gap-2">
                  {GENRES.map((g) => (
                    <button key={g} onClick={() => setType(g)} className={`cyber-filter ${type === g ? 'active' : ''}`}>{g}</button>
                  ))}
                </div>
              </div>

              {/* Access Type */}
              <div>
                <h3 className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-3 flex items-center gap-2">
                  <svg className="w-3 h-3 text-nexusYellow" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"></path></svg>
                  Access Gate
                </h3>
                <div className="flex flex-col gap-2">
                  <label className="flex items-center gap-3 cursor-pointer group" onClick={() => { setMinPrice(""); setMaxPrice(""); }}>
                    <input type="radio" name="access" className="hidden" readOnly checked={!minPrice && !maxPrice} />
                    <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${(!minPrice && !maxPrice) ? 'border-nexusCyan bg-nexusCyan/20' : 'border-white/20'}`}>
                      <div className={`w-2 h-2 rounded-full bg-nexusCyan opacity-0 transition-opacity ${(!minPrice && !maxPrice) ? 'opacity-100' : ''}`}></div>
                    </div>
                    <span className={`text-xs font-bold transition-colors ${(!minPrice && !maxPrice) ? 'text-white' : 'text-gray-400 group-hover:text-white'}`}>Any Access</span>
                  </label>
                  <label className="flex items-center gap-3 cursor-pointer group" onClick={() => { setMinPrice(""); setMaxPrice("0"); }}>
                    <input type="radio" name="access" className="hidden" readOnly checked={maxPrice === "0"} />
                    <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${(maxPrice === "0") ? 'border-nexusYellow bg-nexusYellow/20' : 'border-white/20'}`}>
                      <div className={`w-2 h-2 rounded-full bg-nexusYellow opacity-0 transition-opacity ${(maxPrice === "0") ? 'opacity-100' : ''}`}></div>
                    </div>
                    <span className={`text-xs font-bold transition-colors ${(maxPrice === "0") ? 'text-white' : 'text-gray-400 group-hover:text-white'}`}>Free View</span>
                  </label>
                  <label className="flex items-center gap-3 cursor-pointer group" onClick={() => { setMinPrice("1"); setMaxPrice(""); }}>
                    <input type="radio" name="access" className="hidden" readOnly checked={minPrice === "1"} />
                    <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${(minPrice === "1") ? 'border-nexusPurple bg-nexusPurple/20' : 'border-white/20'}`}>
                      <div className={`w-2 h-2 rounded-full bg-nexusPurple opacity-0 transition-opacity ${(minPrice === "1") ? 'opacity-100' : ''}`}></div>
                    </div>
                    <span className={`text-xs font-bold transition-colors ${(minPrice === "1") ? 'text-white' : 'text-gray-400 group-hover:text-white'}`}>Pass Gated / Paid</span>
                  </label>
                </div>
              </div>

              {/* Price Filter */}
              <div className="bg-black/30 p-4 rounded-xl border border-white/5">
                <div className="flex justify-between items-center mb-3">
                  <h3 className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Max Price (PTS)</h3>
                  <span className="text-xs font-mono font-bold text-nexusCyan">
                    {maxPrice ? `${maxPrice}` : "∞"}
                  </span>
                </div>
                <input type="range" min="0" max="1000" step="50" value={maxPrice || 1000} onChange={e => {
                  const val = e.target.value;
                  if (val === "1000") setMaxPrice(""); else setMaxPrice(val);
                }} className="w-full h-1 bg-white/10 rounded-lg appearance-none cursor-pointer" />
              </div>
            </div>
          </aside>

          {/* Video Grid Area */}
          <div className="flex-1 min-w-0">
            {/* Sorting Bar */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6 border-b border-white/5 pb-4">
              <p className="text-sm font-bold text-white">Showing <span className="text-nexusCyan font-mono">1-{Math.min(page * PAGE_SIZE, filtered.length)}</span> of {filtered.length} Results</p>

              <div className="flex items-center gap-3">
                <span className="text-[10px] text-gray-500 uppercase tracking-widest font-bold">Sort By</span>
                <select
                  className="bg-black/50 border border-white/10 rounded-lg py-1.5 px-3 text-xs text-white focus:outline-none focus:border-nexusCyan cursor-pointer"
                  value={sortBy} onChange={(e) => setSortBy(e.target.value as any)}
                >
                  <option value="最新">Most Recent</option>
                  <option value="热度">Trending</option>
                  <option value="销量">Most Viewed</option>
                  <option value="价格">Price</option>
                </select>
              </div>
            </div>

            {filtered.length === 0 && (
              <div className="glass-panel p-10 text-center rounded-2xl border border-white/5">
                <p className="text-gray-400">No results found matching your filters.</p>
              </div>
            )}

            {/* Immersive Grid */}
            <div className={`grid gap-6 ${viewMode === 'list' ? 'grid-cols-1' : 'grid-cols-1 md:grid-cols-2 xl:grid-cols-3'}`}>
              {filtered.slice(0, page * PAGE_SIZE).map((v) => {
                const pCost = getPointsCost(v);
                const anyV = v as any;
                const isPaid = pCost > 0;
                const isPass = anyV.passRequired;

                return (
                  <div key={v.id} className="video-card bg-bgCard rounded-2xl border border-white/10 p-1 cursor-pointer" onClick={() => {
                    if (isPaid) {
                      const jwt = typeof window !== 'undefined' ? sessionStorage.getItem('vp.jwt') : null;
                      if (!jwt) {
                        alert('Please login first to access paid content.');
                        navigate('/login');
                        return;
                      }
                      setShowPaymentSelector({ video: v });
                    } else {
                      navigate(`/player/${v.id}`);
                    }
                  }}>
                    <div className={`thumbnail-container rounded-xl bg-gray-900 border border-white/5 ${viewMode === 'list' ? 'h-[180px] w-full md:w-[320px] md:float-left md:mr-6' : 'aspect-video'}`}>
                      <img src={anyV.posterUrl || anyV.thumbUrl || "https://images.unsplash.com/photo-1620641788421-7a1c342ea42e?q=80&w=1000"} className="w-full h-full object-cover thumbnail-img opacity-80 mix-blend-screen" alt="" />

                      {/* Badges */}
                      {isPaid || isPass ? (
                        <div className="absolute top-2 left-2 px-2 py-1 bg-gradient-to-r from-nexusCyan/20 to-transparent backdrop-blur-md border border-nexusCyan/30 rounded flex items-center gap-1 z-10">
                          <svg className="w-3 h-3 text-nexusCyan" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                          <span className="text-[10px] font-mono font-bold text-nexusCyan">{isPass ? 'PASS' : `${pCost} PTS`}</span>
                        </div>
                      ) : (
                        <div className="absolute top-2 left-2 px-2 py-1 bg-white/10 backdrop-blur-md border border-white/20 rounded flex items-center gap-1 z-10">
                          <span className="text-[10px] font-bold text-white uppercase tracking-wider">Free Access</span>
                        </div>
                      )}

                      {cachedMap[v.id] && (
                        <div className="absolute top-2 right-2 px-2 py-1 bg-nexusPurple/80 backdrop-blur-md rounded border border-nexusPurple z-10">
                          <span className="text-[10px] font-bold text-white uppercase tracking-wider">Cached</span>
                        </div>
                      )}

                      <div className="absolute bottom-2 right-2 bg-black/80 backdrop-blur px-1.5 rounded text-[10px] font-mono text-white font-bold border border-white/10 z-10">
                        {formatDuration(anyV.durationSeconds) || "HD"}
                      </div>

                      {/* Animated Play Overlay */}
                      <div className="absolute inset-0 bg-black/40 play-overlay flex items-center justify-center">
                        <div className={`w-12 h-12 rounded-full shadow-[0_0_20px_rgba(255,255,255,0.2)] flex items-center justify-center play-btn-inner border ${isPaid ? 'bg-nexusCyan/80 border-nexusCyan/50' : 'bg-white/20 backdrop-blur border-white/40'}`}>
                          <svg className={`w-5 h-5 ml-1 ${isPaid ? 'text-black' : 'text-white'}`} fill="currentColor" viewBox="0 0 20 20"><path d="M4 4l12 6-12 6z"></path></svg>
                        </div>
                      </div>
                    </div>

                    <div className="p-4">
                      <div className="flex gap-3 items-start">
                        <div className="w-8 h-8 rounded-full bg-nexusPurple/20 flex-shrink-0 border border-nexusPurple/30 flex items-center justify-center mt-1 text-xs font-bold text-nexusPurple">
                          {((v?.creatorBitDomain || "U").charAt(0) || "U").toUpperCase()}
                        </div>
                        <div>
                          <h3 className="text-sm font-bold text-white leading-tight mb-1 group-hover:text-nexusCyan transition-colors line-clamp-2">
                            {v.title}
                          </h3>
                          <p className="text-[10px] text-gray-500 font-mono mb-2">
                            {(v.creatorBitDomain || "Unknown").replace(".bit", "")} • {getViewCount(v.id)} • {getTimeAgo(v.createdAt)}
                          </p>

                          {/* Meta Footer */}
                          <div className="flex items-center gap-2 mt-3">
                            {v.genre && <span className="text-[10px] font-bold text-gray-400 bg-white/5 border border-white/10 px-2 py-0.5 rounded">{v.genre}</span>}
                            {v.region && <span className="text-[10px] font-bold text-gray-400 bg-white/5 border border-white/10 px-2 py-0.5 rounded">{v.region}</span>}
                          </div>

                          <div className="flex gap-2 mt-4" onClick={e => e.stopPropagation()}>
                            <button className="flex-1 text-[10px] font-bold text-gray-400 bg-white/5 border border-white/10 py-1.5 rounded hover:text-white hover:bg-white/10 transition-colors"
                              onClick={(e) => { e.stopPropagation(); toggleFavorite(v.id); }}>
                              {favorites.includes(v.id) ? "★ Saved" : "Save"}
                            </button>
                            {userEntitlements.includes(v.id) ? (
                              <button className="flex-1 text-[10px] font-bold text-green-400 bg-green-500/10 border border-green-500/30 py-1.5 rounded"
                                onClick={(e) => { e.stopPropagation(); navigate(`/player/${v.id}`); }}>
                                ✓ Owned
                              </button>
                            ) : isPaid ? (
                              <button className="flex-1 text-[10px] font-bold text-black bg-nexusCyan py-1.5 rounded hover:bg-cyan-400 transition-colors"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  const jwt = typeof window !== 'undefined' ? sessionStorage.getItem('vp.jwt') : null;
                                  if (!jwt) {
                                    alert('Please login first to purchase content.');
                                    navigate('/login');
                                    return;
                                  }
                                  setShowPaymentSelector({ video: v });
                                }}>
                                Buy - {pCost} PTS
                              </button>
                            ) : (
                              <button className="flex-1 text-[10px] font-bold text-white bg-white/10 border border-nexusPurple/50 py-1.5 rounded hover:bg-nexusPurple/20 transition-colors"
                                onClick={(e) => { e.stopPropagation(); navigate(`/player/${v.id}`); }}>
                                Play Free
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                    {viewMode === 'list' && <div className="clear-both"></div>}
                  </div>
                );
              })}
            </div>

            {/* Load More */}
            {filtered.length > page * PAGE_SIZE && (
              <div className="mt-12 text-center pb-8 border-b border-white/5">
                <button
                  onClick={() => setPage((p) => p + 1)}
                  className="bg-black border border-nexusCyan text-nexusCyan hover:bg-nexusCyan hover:text-black font-bold uppercase tracking-widest px-8 py-3 rounded-full text-xs transition-all shadow-[0_0_15px_rgba(34,211,238,0.2)] hover:shadow-[0_0_25px_rgba(34,211,238,0.5)]">
                  Load More Entries
                </button>
              </div>
            )}

          </div>
        </div>
      </main>

      {/* 支付方式选择弹窗 */}
      {showPaymentSelector && (
        <PaymentModeSelector
          video={showPaymentSelector.video}
          onSelect={(mode) => {
            setShowPaymentSelector(null);
            if (mode === 'buy_once') {
              refreshPoints().catch(() => { });
              navigate(`/player/${showPaymentSelector.video.id}`);
            } else if (mode === 'stream') {
              navigate(`/player/${showPaymentSelector.video.id}?mode=stream`);
            }
          }}
          onClose={() => setShowPaymentSelector(null)}
        />
      )}
    </PageErrorBoundary>
  );
}

// Ensure style injection for missing classes if any
const style = document.createElement('style');
style.innerHTML = `
    .cyber-filter { display: inline-flex; align-items: center; padding: 0.35rem 1rem; background: rgba(255, 255, 255, 0.03); border: 1px solid rgba(255, 255, 255, 0.05); border-radius: 6px; font-size: 0.75rem; font-weight: 600; color: #9ca3af; transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1); cursor: pointer; letter-spacing: 0.05em; }
    .cyber-filter:hover { background: rgba(255, 255, 255, 0.1); color: white; border-color: rgba(255, 255, 255, 0.2); }
    .cyber-filter.active { background: rgba(34, 211, 238, 0.1); color: #22d3ee; border-color: #22d3ee; text-shadow: 0 0 10px rgba(34, 211, 238, 0.5); box-shadow: inset 0 0 10px rgba(34, 211, 238, 0.2); }
    .video-card { transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1); position: relative; }
    .video-card:hover { transform: translateY(-4px); z-index: 20; }
    .video-card::before { content: ''; position: absolute; inset: -1px; background: linear-gradient(to bottom right, #22d3ee, #a855f7); border-radius: 17px; z-index: -1; opacity: 0; transition: opacity 0.3s ease; }
    .video-card:hover::before { opacity: 0.5; }
    .thumbnail-container { overflow: hidden; position: relative; }
    .thumbnail-img { transition: transform 0.7s cubic-bezier(0.4, 0, 0.2, 1); }
    .video-card:hover .thumbnail-img { transform: scale(1.05); }
    .play-overlay { opacity: 0; transition: all 0.3s ease; backdrop-filter: blur(4px); }
    .video-card:hover .play-overlay { opacity: 1; }
    .play-btn-inner { transform: scale(0.8) translateY(10px); transition: all 0.4s cubic-bezier(0.34, 1.56, 0.64, 1); }
    .video-card:hover .play-btn-inner { transform: scale(1) translateY(0); }
`;
document.head.appendChild(style);
