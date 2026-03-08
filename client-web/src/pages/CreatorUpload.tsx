// FILE: /video-platform/client-web/src/pages/CreatorUpload.tsx
/**
 * 功能说明：
 * - 创作者上传页面：填写基本元数据与选择视频文件（mp4），登录后调用后端接口完成上传并写入元数据。
 * - 支持 Cloudflare TUS 断点续传、直传、本地 fallback
 * - 支持单集与多集合集(Series)
 * - 支持 Arweave 永久存储、所有权 NFT Auto-mint 等等
 */

import React, { useRef, useState, useEffect } from "react";
import { getApiClient } from "../lib/apiClient";
import type { MetadataWriteResponse, VideoMeta, DirectUploadInitResponse } from "@video-platform/shared/types";
import { useNavigate } from "react-router-dom";
import { connect, signChallenge, signTransaction } from "@joyid/ckb";

const client = getApiClient();

function readFileAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const b64 = result.startsWith("data:") ? result.split(",")[1] : result;
      resolve(b64);
    };
    reader.onerror = () => reject(reader.error || new Error("读取文件失败"));
    reader.readAsDataURL(file);
  });
}

const GENRES = ["Technology", "Gaming", "Music", "Education", "Crypto & Web3", "Vlogs", "Short Films", "Other"];

interface UploadProgress {
  name: string;
  status: string;
  done: boolean;
}

export default function CreatorUpload() {
  const navigate = useNavigate();
  const fileRef = useRef<HTMLInputElement>(null);

  // Basic Info
  const [title, setTitle] = useState("");
  const [desc, setDesc] = useState("");
  const [genre, setGenre] = useState("Technology");
  const [releaseYear, setReleaseYear] = useState(new Date().getFullYear().toString());
  const [language, setLanguage] = useState("English");
  const [quality, setQuality] = useState("1080p");

  // Payment config
  const [paymentMode, setPaymentMode] = useState<"free" | "buy_once" | "stream" | "both">("free");
  const [price, setPrice] = useState("0");
  const [streamPrice, setStreamPrice] = useState("0.1");

  // Advanced features
  const [arweaveStorage, setArweaveStorage] = useState(false);
  const [autoMint, setAutoMint] = useState(false);
  const [enableWatchParty, setEnableWatchParty] = useState(true);

  // Collab
  const [collaborators, setCollaborators] = useState([{ address: "", split: 10 }]);

  // Upload state
  const [status, setStatus] = useState<string>("Ready to start");
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState<boolean>(false);
  const [uploadProgressList, setUploadProgressList] = useState<UploadProgress[]>([]);
  const [showDoneModal, setShowDoneModal] = useState(false);
  const [earnedPointsTotal, setEarnedPointsTotal] = useState(0);
  const [lastVideoId, setLastVideoId] = useState<string | null>(null);

  // Auto Mint State
  const [mintStep, setMintStep] = useState<"uploading" | "processing" | "minting" | "done" | "error">("uploading");
  const [mintResult, setMintResult] = useState<{ sporeId: string; txHash: string } | null>(null);
  const [mintingSpore, setMintingSpore] = useState(false);
  const [mintError, setMintError] = useState<string | null>(null);

  // Mode selection
  const [mode, setMode] = useState<"single" | "series">("single");
  const [contentType, setContentType] = useState<"video" | "audio" | "article">("video");

  // Series state
  const [seriesTitle, setSeriesTitle] = useState("");
  interface EpisodeState {
    id: string;
    file: File;
    title: string;
    description: string;
    thumbnail?: File;
    isFreePreview: boolean;
  }
  const [episodes, setEpisodes] = useState<EpisodeState[]>([]);
  const [singleFile, setSingleFile] = useState<File | null>(null);
  const [allowRemix, setAllowRemix] = useState(false);
  const [limitType, setLimitType] = useState<"none" | "views" | "time">("none");
  const [limitValue, setLimitValue] = useState<number>(100);

  const userRaw = typeof window !== "undefined" ? sessionStorage.getItem("vp.user") : null;
  const jwt = typeof window !== "undefined" ? sessionStorage.getItem("vp.jwt") : null;
  const user = userRaw ? JSON.parse(userRaw) as { bitDomain: string; ckbAddress: string } : null;
  const notLoggedIn = !jwt || !user;

  // Add styles
  useEffect(() => {
    document.body.classList.add('bg-bgMain', 'text-white', 'antialiased', 'font-sans');
    const root = document.getElementById('root');
    if (root) root.classList.add('flex', 'flex-col', 'min-h-screen');
    return () => {
      document.body.classList.remove('bg-bgMain', 'text-white', 'antialiased', 'font-sans');
      if (root) root.classList.remove('flex', 'flex-col', 'min-h-screen');
    };
  }, []);

  function handleSingleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    if (e.target.files && e.target.files[0]) {
      setSingleFile(e.target.files[0]);
    }
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault();
  }

  function handleDropSingle(e: React.DragEvent) {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      setSingleFile(e.dataTransfer.files[0]);
    }
  }

  function handleAddEpisodes(files: File[]) {
    const newEps = files.map(f => ({
      id: crypto.randomUUID(),
      file: f,
      title: f.name.replace(/\.[^/.]+$/, ""), // remove extension
      description: "",
      isFreePreview: false
    }));
    setEpisodes(prev => [...prev, ...newEps]);
  }

  async function handleUpload() {
    setError(null);
    try {
      const isSeries = mode === "series";
      const files = isSeries ? episodes.map(e => e.file) : (singleFile ? [singleFile] : []);

      // Validators
      if (!jwt || !user) { setError("Please login with JoyID to upload"); return; }
      client.setJWT(jwt);
      if (!desc.trim()) { setError("Description is required"); return; }
      if (paymentMode === "buy_once" || paymentMode === "both") {
        if (!/^[0-9]+$/.test(price)) { setError("Invalid point price (must be integer)"); return; }
      }
      if (paymentMode === "stream" || paymentMode === "both") {
        if (isNaN(parseFloat(streamPrice))) { setError("Invalid stream price"); return; }
      }
      if (!isSeries) {
        if (!title.trim()) { setError("Title is required"); return; }
        if (files.length === 0) { setError("Please select a file to upload"); return; }
      } else {
        if (!seriesTitle.trim()) { setError("Series Title is required"); return; }
        if (files.length === 0) { setError("Please add at least one episode"); return; }
        for (let i = 0; i < episodes.length; i++) {
          if (!episodes[i].title.trim()) { setError(`Episode ${i + 1} title is empty`); return; }
        }
      }

      setUploading(true);
      setMintStep("uploading");
      setMintResult(null);
      setMintError(null);
      let earnedPTS = 0;
      let lastUploadedId = "";
      const total = isSeries ? files.length : 1;
      const seriesId = isSeries ? crypto.randomUUID() : undefined;

      const newProgress: UploadProgress[] = files.map(f => ({
        name: f.name,
        status: "Waiting",
        done: false
      }));
      setUploadProgressList(newProgress);

      const updateProgress = (idx: number, st: string, done: boolean = false) => {
        setUploadProgressList(prev => {
          const cp = [...prev];
          if (cp[idx]) {
            cp[idx].status = st;
            cp[idx].done = done;
          }
          return cp;
        });
        setStatus(`${st} (${idx + 1}/${total})`);
      };

      for (let i = 0; i < total; i++) {
        const file = files[i];
        const videoId = crypto.randomUUID();
        lastUploadedId = videoId;
        const useResumable = file.size >= 20 * 1024 * 1024;
        let cfStreamUid: string | undefined;

        // Force local upload (for dev/fallback)
        const forcedLocalUpload = (typeof window !== "undefined") && (
          localStorage.getItem("vp.uploadMode") === "local" ||
          localStorage.getItem("vp.upload.mode") === "local"
        );

        if (forcedLocalUpload) {
          updateProgress(i, "Local upload via base64...");
          const base64 = await readFileAsBase64(file);
          const up = await client.post<any>("/content/upload", {
            videoId,
            creatorCkbAddress: user.ckbAddress,
            base64Content: base64,
          });
          cfStreamUid = up?.record?.cfStreamUid;
        } else if (useResumable) {
          updateProgress(i, "Init resumable upload...");
          const init = await client.post<{ tusURL: string }>("/content/upload/resumable_init", {
            videoId,
            creatorCkbAddress: user.ckbAddress,
            uploadLength: file.size,
            name: file.name,
            filetype: file.type || "video/mp4",
          });
          cfStreamUid = await tusUpload(init.tusURL, file, (p) => updateProgress(i, `Uploading... ${p}%`));
        } else {
          try {
            updateProgress(i, "Init direct upload...");
            const init = await client.post<any>("/content/upload/direct_init", {
              videoId,
              creatorCkbAddress: user.ckbAddress,
            });
            const form = new FormData();
            form.set("file", file, file.name);
            updateProgress(i, "Uploading chunk...");
            const resp = await fetch(init?.uploadURL!, { method: "POST", body: form });
            if (!resp.ok) throw new Error(`Direct upload failed HTTP ${resp.status}`);
            cfStreamUid = init?.cfStreamUid;
          } catch (e) {
            updateProgress(i, "Direct upload failed, falling back to local...");
            const base64 = await readFileAsBase64(file);
            const up = await client.post<any>("/content/upload", {
              videoId,
              creatorCkbAddress: user.ckbAddress,
              base64Content: base64,
            });
            cfStreamUid = up?.record?.cfStreamUid;
          }
        }

        let cdnUrl = `${(import.meta as any).env?.VITE_API_GATEWAY_URL || ""}/content/hls/${videoId}/index.m3u8`;
        if (cfStreamUid) {
          updateProgress(i, "Waiting for cloud transcoding...");
          setMintStep(i === total - 1 ? "processing" : "uploading");
          const hls = await waitCloudflareReady(cfStreamUid, (st) => updateProgress(i, `Transcoding: ${st}`));
          if (hls) cdnUrl = hls;
        }

        // Determine price settings based on paymentMode
        let pointsPrice = paymentMode === 'buy_once' || paymentMode === 'both' ? parseInt(price, 10) : 0;
        let sPrice = paymentMode === 'stream' || paymentMode === 'both' ? parseFloat(streamPrice) : 0;

        let pUSDI = "0";
        if (pointsPrice > 0) {
          pUSDI = (pointsPrice / 1000).toString(); // Fallback estimation
        }

        const meta: VideoMeta = {
          id: videoId,
          title: isSeries ? `${seriesTitle.trim()} - ${episodes[i].title.trim()}` : title.trim(),
          description: isSeries ? (episodes[i].description.trim() || desc.trim()) : desc.trim(),
          creatorBitDomain: user.bitDomain || "",
          creatorCkbAddress: user.ckbAddress,
          priceUSDI: pUSDI,
          pointsPrice: pointsPrice,
          streamPricePerSecond: sPrice,
          streamPricePerMinute: sPrice * 60, // legacy compat
          cdnUrl,
          cfStreamUid,
          genre,
          // Convert string to number, fallback to current year
          releaseYear: parseInt(releaseYear, 10) || new Date().getFullYear(),
          language,
          ...(quality ? { quality } as any : {}),
          createdAt: new Date().toISOString(),
          ...(isSeries ? { seriesId, seriesTitle: seriesTitle.trim(), episodeIndex: i + 1, isFreePreview: episodes[i].isFreePreview } : {}),
          // Include collaborator revenue splits for commercial revenue sharing
          collaborators: collaborators.filter(c => c.address.trim()).map(c => ({
            userId: c.address.trim(),
            percentage: c.split,
            role: "collaborator"
          })),
        };

        updateProgress(i, "Writing metadata...");
        const metaRes = await client.post<MetadataWriteResponse & { earnedPoints?: number }>("/metadata/write", { meta });

        if (metaRes?.earnedPoints) {
          earnedPTS += metaRes.earnedPoints;
        }
        updateProgress(i, "Upload complete", true);
      }

      setEarnedPointsTotal(earnedPTS);
      setLastVideoId(lastUploadedId);

      // Auto-create RGB++ split contract if collaborators exist
      const validCollabs = collaborators.filter(c => c.address.trim());
      if (validCollabs.length > 0 && lastUploadedId) {
        setStatus("Creating RGB++ revenue split contract...");
        client.post("/payment/rgbpp/auto-split", {
          contentId: lastUploadedId,
          contentType,
          title: isSeries ? seriesTitle.trim() : title.trim(),
          collaborators: validCollabs.map(c => ({ address: c.address.trim(), percentage: c.split, role: "collaborator" })),
          creatorAddress: user.ckbAddress,
        }).then((res: any) => {
          if (res?.ok) console.log("RGB++ split contract created:", res.contractId);
        }).catch((err: any) => {
          console.warn("RGB++ auto-split failed (non-blocking):", err?.message);
        });
      }

      if (!isSeries && autoMint) {
        setMintStep("minting");
        await performMint(lastUploadedId);
      } else {
        setMintStep("done");
        setShowDoneModal(true);
      }

    } catch (e: any) {
      setError(e?.error || e?.message || "Upload Failed");
      setMintStep("error");
    } finally {
      if (!autoMint) {
        setUploading(false);
        setShowDoneModal(true);
      }
    }
  }

  async function performMint(vid: string) {
    if (!user?.ckbAddress) return;
    try {
      setMintingSpore(true);
      setStatus("Waiting for JoyID wallet connection...");
      const conn = await connect();
      const address = (conn as any)?.address || user.ckbAddress;

      setStatus("Generating Mint Transaction...");
      const prep = await client.post<{ rawTx: any, sporeId: string }>("/ownership/mint/prepare", {
        videoId: vid,
        ownerAddress: address
      });

      setStatus("Please sign transaction in JoyID...");
      const signedTx = await signTransaction(prep.rawTx, address);

      setStatus("Submitting to CKB blockchain...");
      const sub = await client.post<{ txHash: string, sporeId: string }>("/ownership/mint/submit", {
        videoId: vid,
        signedTx,
        sporeId: prep.sporeId
      });

      setMintResult({ sporeId: sub.sporeId, txHash: sub.txHash });
      setMintStep("done");
      setShowDoneModal(true);
    } catch (e: any) {
      setMintError(e?.message || "Minting failed. You can retry later.");
      setMintStep("error");
      setShowDoneModal(true);
    } finally {
      setMintingSpore(false);
      setUploading(false);
    }
  }

  async function handleMintOwnership() {
    if (lastVideoId) {
      setMintStep("minting");
      await performMint(lastVideoId);
    }
  }

  async function tusUpload(tusURL: string, file: File, onProgress?: (p: number) => void): Promise<string | undefined> {
    const chunkSize = 5 * 1024 * 1024;
    let offset = 0;
    try {
      const head = await fetch(tusURL, { method: "HEAD", headers: { "Tus-Resumable": "1.0.0" } });
      const serverOffset = Number(head.headers.get("Upload-Offset") || "0");
      if (!Number.isNaN(serverOffset)) offset = serverOffset;
    } catch { }
    let cfUid: string | undefined;
    while (offset < file.size) {
      const end = Math.min(offset + chunkSize, file.size);
      const chunk = await file.slice(offset, end).arrayBuffer();
      const body = new Uint8Array(chunk);
      const resp = await fetch(tusURL, {
        method: "PATCH",
        headers: {
          "Tus-Resumable": "1.0.0",
          "Content-Type": "application/offset+octet-stream",
          "Upload-Offset": String(offset),
        },
        body,
      });
      if (!resp.ok) throw new Error(`TUS chunk failed: ${resp.status}`);
      const newOffset = Number(resp.headers.get("Upload-Offset") || (offset + body.byteLength));
      offset = newOffset;
      const pct = Math.min(100, Math.round((offset / file.size) * 100));
      onProgress?.(pct);
      const mid = resp.headers.get("stream-media-id");
      if (mid) cfUid = mid;
    }
    return cfUid;
  }

  async function waitCloudflareReady(uid: string, onStatus?: (s: string) => void): Promise<string | undefined> {
    const toHls = (u: string) => `https://videodelivery.net/${u}/manifest/video.m3u8`;
    for (let i = 0; i < 30; i++) {
      const st = await client.get<{ uid: string; readyToStream?: boolean; status?: any }>(`/content/cf/status/${uid}`);
      onStatus?.((st.status?.state) || "processing");
      if (st.readyToStream) return toHls(uid);
      await new Promise((r) => setTimeout(r, 2000));
    }
    return undefined;
  }

  return (
    <div className="min-h-screen bg-bgMain text-white pb-32">
      {/* Background Gradients */}
      <div className="fixed top-[-20%] left-[-10%] w-[50%] h-[50%] bg-accent-purple/20 blur-[120px] rounded-full pointer-events-none z-0" />
      <div className="fixed bottom-[-20%] right-[-10%] w-[50%] h-[50%] bg-accent-cyan/10 blur-[120px] rounded-full pointer-events-none z-0" />

      {/* Top Navigation */}
      <header className="h-20 flex-shrink-0 flex items-center justify-between px-8 bg-black/60 backdrop-blur-xl border-b border-white/5 sticky top-0 z-50">
        <div className="flex items-center gap-8">
          <div className="flex items-center gap-3 cursor-pointer group" onClick={() => navigate("/")}>
            <div className="w-8 h-8 flex items-center justify-center">
              <svg className="w-full h-full text-accent-cyan group-hover:drop-shadow-[0_0_8px_rgba(34,211,238,0.8)] transition-all" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon>
              </svg>
            </div>
            <span className="text-xl font-display font-black tracking-widest text-white">NEXUS</span>
          </div>
          <nav className="hidden lg:flex gap-8 text-sm font-semibold tracking-wide items-center">
            <a href="/" onClick={(e) => { e.preventDefault(); navigate("/"); }} className="text-gray-400 hover:text-white transition-colors">HOME</a>
            <a href="/explorer" onClick={(e) => { e.preventDefault(); navigate("/explorer"); }} className="text-gray-400 hover:text-white transition-colors">EXPLORE</a>
            <a href="/creator" onClick={(e) => { e.preventDefault(); navigate("/creator"); }} className="text-accent-cyan font-bold drop-shadow-[0_0_8px_rgba(34,211,238,0.5)]">STUDIO</a>
          </nav>
        </div>
      </header>

      <div className="container mx-auto px-4 max-w-[1400px] mt-8 relative z-10">
        {/* Header Section */}
        <div className="flex justify-between items-end mb-8">
          <div>
            <h1 className="text-3xl font-display font-black tracking-tight mb-2">Creator <span className="text-transparent bg-clip-text bg-gradient-to-r from-accent-cyan to-accent-purple">Access Node</span></h1>
            <p className="text-text-muted text-sm">Deploy high-quality content to the decentralized web.</p>
          </div>
          <div className="flex gap-4">
            <button className="btn-ghost flex items-center gap-2">
              <span>📚</span> Content Guides
            </button>
          </div>
        </div>

        {notLoggedIn && (
          <div className="mb-6 p-4 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 flex items-center gap-3">
            <span>⚠️</span> You are not logged in. Login via JoyID is required to publish content.
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column: Form Forms */}
          <div className="lg:col-span-2 space-y-6">

            {/* Format Type */}
            <div className="nexus-card p-6">
              <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                Format
              </h3>
              <div className="grid grid-cols-3 gap-3 mb-6">
                {[
                  { id: 'video', icon: '🎬', label: 'Video', desc: 'Up to 4K / MP4' },
                  { id: 'audio', icon: '🎵', label: 'Audio', desc: 'Music or Podcast' },
                  { id: 'article', icon: '📄', label: 'Article', desc: 'Markdown or PDF' },
                ].map(ct => (
                  <button key={ct.id} onClick={() => setContentType(ct.id as any)} className={`p-4 rounded-xl border flex flex-col items-center justify-center gap-2 transition-all ${contentType === ct.id ? 'bg-white/10 border-accent-cyan shadow-[0_0_15px_rgba(0,213,255,0.15)] bg-gradient-to-br from-accent-cyan/10 to-transparent' : 'bg-white/5 border-white/5 hover:bg-white/10'}`}>
                    <span className="text-2xl">{ct.icon}</span>
                    <span className="font-bold text-sm tracking-wide">{ct.label}</span>
                  </button>
                ))}
              </div>

              <div className="grid grid-cols-2 gap-3 pb-6 border-b border-white/10">
                <button onClick={() => setMode('single')} className={`py-3 px-4 rounded-lg font-bold border flex items-center justify-center gap-2 transition-colors ${mode === 'single' ? 'bg-white text-black border-white' : 'bg-transparent text-gray-400 border-white/10 hover:border-white/30 hover:text-white'}`}>
                  Single Release
                </button>
                <button onClick={() => setMode('series')} className={`py-3 px-4 rounded-lg font-bold border flex items-center justify-center gap-2 transition-colors ${mode === 'series' ? 'bg-white text-black border-white' : 'bg-transparent text-gray-400 border-white/10 hover:border-white/30 hover:text-white'}`}>
                  Series / Album
                </button>
              </div>
            </div>

            {/* Basic Info */}
            <div className="nexus-card p-6">
              <h3 className="text-lg font-bold mb-4 flex items-center gap-2">Basic Info</h3>

              {mode === 'series' && (
                <div className="mb-4">
                  <label className="text-xs uppercase tracking-wider text-text-muted font-bold mb-2 block">Series Title <span className="text-red-400">*</span></label>
                  <input type="text" className="input-nexus w-full h-12 px-4 shadow-inner" placeholder="e.g. Cyberpunk Travel Vlog" value={seriesTitle} onChange={e => setSeriesTitle(e.target.value)} />
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                {mode === 'single' && (
                  <div className="md:col-span-2">
                    <label className="text-xs uppercase tracking-wider text-text-muted font-bold mb-2 block">Title <span className="text-red-400">*</span></label>
                    <input type="text" className="input-nexus w-full h-12 px-4 shadow-inner" placeholder="Neon Nights: Episode 1" value={title} onChange={e => setTitle(e.target.value)} />
                  </div>
                )}
                <div className="md:col-span-2">
                  <label className="text-xs uppercase tracking-wider text-text-muted font-bold mb-2 block">Description</label>
                  <textarea className="input-nexus w-full p-4 min-h-[120px] resize-none shadow-inner leading-relaxed" placeholder="Tell the viewers about this drop..." value={desc} onChange={e => setDesc(e.target.value)} />
                </div>
                <div>
                  <label className="text-xs uppercase tracking-wider text-text-muted font-bold mb-2 block">Genre</label>
                  <select className="input-nexus w-full h-12 px-4 cursor-pointer" value={genre} onChange={e => setGenre(e.target.value)}>
                    {GENRES.map(g => <option key={g} value={g}>{g}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs uppercase tracking-wider text-text-muted font-bold mb-2 block">Language</label>
                  <select className="input-nexus w-full h-12 px-4 cursor-pointer" value={language} onChange={e => setLanguage(e.target.value)}>
                    <option value="English">English</option>
                    <option value="Chinese">Chinese (中文)</option>
                    <option value="Japanese">Japanese (日本語)</option>
                    <option value="Korean">Korean (한국어)</option>
                    <option value="Spanish">Spanish</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs uppercase tracking-wider text-text-muted font-bold mb-2 block">Release Year</label>
                  <input type="number" className="input-nexus w-full h-12 px-4" value={releaseYear} onChange={e => setReleaseYear(e.target.value)} />
                </div>
                <div>
                  <label className="text-xs uppercase tracking-wider text-text-muted font-bold mb-2 block">Quality Tag</label>
                  <select className="input-nexus w-full h-12 px-4 cursor-pointer" value={quality} onChange={e => setQuality(e.target.value)}>
                    <option value="4K">4K UHD</option>
                    <option value="1080p">1080p HD</option>
                    <option value="720p">720p</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Monetization */}
            <div className="nexus-card p-0 overflow-hidden">
              <div className="bg-gradient-to-r from-accent-purple/20 to-transparent p-6 border-b border-accent-purple/20">
                <h3 className="text-lg font-bold flex items-center gap-2">Monetization Engine</h3>
                <p className="text-xs text-text-muted mt-1">Free content earns you passive Rewards PTS. Paid content earns direct income.</p>
              </div>
              <div className="p-6">

                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
                  {[
                    { id: 'free', icon: '🎁', label: 'Free (Earn Rewards)' },
                    { id: 'buy_once', icon: '💎', label: 'Buy Once' },
                    { id: 'stream', icon: '⚡', label: 'Stream Pay' },
                    { id: 'both', icon: '⚜️', label: 'Hybrid' }
                  ].map(pm => (
                    <button key={pm.id} onClick={() => setPaymentMode(pm.id as any)} className={`p-3 rounded-lg border flex flex-col items-center justify-center gap-1 transition-all ${paymentMode === pm.id ? 'bg-white/10 border-accent-purple text-white' : 'bg-transparent border-white/5 text-gray-500 hover:text-white'}`}>
                      <span className="text-xl">{pm.icon}</span>
                      <span className="text-[10px] uppercase font-bold tracking-wider">{pm.label}</span>
                    </button>
                  ))}
                </div>

                {/* Pricing Inputs */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-4 rounded-xl bg-black/40 border border-white/5">
                  <div className={`transition-opacity ${(paymentMode === 'buy_once' || paymentMode === 'both') ? 'opacity-100' : 'opacity-30 pointer-events-none'}`}>
                    <label className="text-xs uppercase tracking-wider text-accent-purple font-bold mb-2 flex items-center gap-2">Unlock Price <span>💎</span></label>
                    <div className="relative">
                      <input type="text" className="input-nexus w-full h-12 pl-4 pr-16 font-mono text-lg font-bold text-white placeholder-white/20" value={price} onChange={e => setPrice(e.target.value)} placeholder="0" />
                      <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-bold text-gray-500">PTS</span>
                    </div>
                    <p className="text-[10px] text-text-muted mt-2 mt-1">One-time payment for permanent access.</p>
                  </div>

                  <div className={`transition-opacity ${(paymentMode === 'stream' || paymentMode === 'both') ? 'opacity-100' : 'opacity-30 pointer-events-none'}`}>
                    <label className="text-xs uppercase tracking-wider text-accent-cyan font-bold mb-2 flex items-center gap-2">Stream Rate <span>⚡</span></label>
                    <div className="relative">
                      <input type="text" className="input-nexus w-full h-12 pl-4 pr-20 font-mono text-lg font-bold text-white placeholder-white/20" value={streamPrice} onChange={e => setStreamPrice(e.target.value)} placeholder="0.1" />
                      <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-bold text-gray-500">PTS / MIN</span>
                    </div>
                    <p className="text-[10px] text-text-muted mt-2 mt-1">Pay-as-you-go micro-payments per second watched.</p>
                  </div>
                </div>

              </div>
            </div>

            {/* Collaborator & Revenue Split */}
            <div className="nexus-card p-0 overflow-hidden">
              <div className="bg-gradient-to-r from-amber-500/15 to-transparent p-6 border-b border-amber-500/20">
                <h3 className="text-lg font-bold flex items-center gap-2">🤝 Collaborators & Revenue Split</h3>
                <p className="text-xs text-text-muted mt-1">Add co-creators and set revenue sharing via RGB++ smart contracts.</p>
              </div>
              <div className="p-6 space-y-3">
                {collaborators.map((collab, idx) => (
                  <div key={idx} className="flex items-center gap-3 p-3 bg-black/30 rounded-xl border border-white/5">
                    <div className="flex-1">
                      <label className="text-[9px] uppercase tracking-wider text-text-muted font-bold mb-1 block">CKB Address / DID</label>
                      <input
                        type="text"
                        className="input-nexus w-full h-10 px-3 text-sm font-mono"
                        placeholder="ckt1qz... or user.bit"
                        value={collab.address}
                        onChange={e => setCollaborators(prev => {
                          const n = [...prev]; n[idx].address = e.target.value; return n;
                        })}
                      />
                    </div>
                    <div className="w-24">
                      <label className="text-[9px] uppercase tracking-wider text-text-muted font-bold mb-1 block">Split %</label>
                      <input
                        type="number"
                        className="input-nexus w-full h-10 px-3 text-sm font-mono text-center"
                        min={1} max={100}
                        value={collab.split}
                        onChange={e => setCollaborators(prev => {
                          const n = [...prev]; n[idx].split = Math.max(0, Math.min(100, parseInt(e.target.value) || 0)); return n;
                        })}
                      />
                    </div>
                    {collaborators.length > 1 && (
                      <button
                        onClick={() => setCollaborators(prev => prev.filter((_, i) => i !== idx))}
                        className="w-8 h-8 rounded-lg bg-red-500/10 text-red-400 flex items-center justify-center hover:bg-red-500/20 transition-colors mt-4 text-sm font-bold"
                      >×</button>
                    )}
                  </div>
                ))}

                <div className="flex items-center justify-between mt-3">
                  <button
                    onClick={() => setCollaborators(prev => [...prev, { address: "", split: 10 }])}
                    className="text-xs font-bold text-accent-cyan hover:text-white transition-colors flex items-center gap-1"
                  >
                    + Add Collaborator
                  </button>
                  <div className="text-xs text-text-muted">
                    Total: <span className={`font-bold ${collaborators.reduce((s, c) => s + c.split, 0) > 100 ? 'text-red-400' : 'text-accent-cyan'}`}>
                      {collaborators.reduce((s, c) => s + c.split, 0)}%
                    </span> / 100%
                  </div>
                </div>

                {collaborators.reduce((s, c) => s + c.split, 0) > 100 && (
                  <div className="text-xs text-red-400 p-2 bg-red-500/10 rounded-lg border border-red-500/20 mt-2">
                    ⚠️ Total split exceeds 100%. Please adjust percentages.
                  </div>
                )}
              </div>
            </div>

            {/* File Upload Area */}
            <div className="nexus-card p-6">
              <h3 className="text-lg font-bold mb-4 flex items-center justify-between">
                <span>Media Assets</span>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-text-muted"><span className="text-accent-green">●</span> Cloudflare Stream Ready</span>
                </div>
              </h3>

              {mode === "series" ? (
                /* SERIES: CARD LAYOUT */
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
                  {episodes.map((ep, idx) => (
                    <div key={ep.id} className="nexus-card p-4 relative group hover:border-accent-cyan/50 transition-colors">
                      <button onClick={() => setEpisodes(prev => prev.filter(e => e.id !== ep.id))} className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-red-500 text-white flex items-center justify-center shadow-lg cursor-pointer z-20 hover:scale-110 transition-transform">×</button>
                      <div className="text-xs font-bold text-accent-cyan mb-1">{contentType === 'audio' ? 'Track' : 'Ep'} {idx + 1}</div>
                      <input className="w-full bg-white/5 border border-white/10 rounded px-3 py-2 text-sm mb-2 text-white placeholder-text-muted focus:border-accent-cyan outline-none transition-colors" value={ep.title} onChange={e => setEpisodes(prev => { const n = [...prev]; n[idx].title = e.target.value; return n; })} placeholder="Title" />
                      <textarea className="w-full bg-white/5 border border-white/10 rounded px-3 py-2 text-xs min-h-[60px] resize-none text-white placeholder-text-muted focus:border-accent-cyan outline-none transition-colors leading-relaxed" value={ep.description} onChange={e => setEpisodes(prev => { const n = [...prev]; n[idx].description = e.target.value; return n; })} placeholder="Intro (Optional)" />
                      <div className="flex justify-between items-center mt-2">
                        <label className="flex items-center gap-2 text-xs cursor-pointer text-text-muted hover:text-white">
                          <input type="checkbox" className="accent-accent-cyan w-4 h-4 rounded" checked={ep.isFreePreview} onChange={e => setEpisodes(prev => { const n = [...prev]; n[idx].isFreePreview = e.target.checked; return n; })} />
                          <span>Free Preview</span>
                        </label>
                        <span className="text-xs text-text-muted opacity-70 font-mono">{(ep.file.size / 1024 / 1024).toFixed(1)}MB</span>
                      </div>
                    </div>
                  ))}

                  <div className="aspect-[3/4] border-2 border-dashed border-white/10 rounded-xl flex flex-col items-center justify-center cursor-pointer hover:border-accent-purple hover:bg-accent-purple/5 transition-all min-h-[250px] group" onClick={() => document.getElementById('series-files')?.click()}>
                    <div className="text-5xl mb-4 text-accent-purple group-hover:scale-110 transition-transform">+</div>
                    <div className="text-lg font-bold text-gray-200">Add {contentType === 'audio' ? 'Tracks' : 'Episodes'}</div>
                    <div className="text-sm text-text-muted mt-2">Support Multiple Files</div>
                    <input id="series-files" type="file" multiple accept={contentType === 'video' ? "video/mp4" : contentType === 'audio' ? "audio/*" : ".pdf,.md"} className="hidden" onChange={e => { if (e.target.files) handleAddEpisodes(Array.from(e.target.files)); e.target.value = ''; }} />
                  </div>
                </div>
              ) : (
                /* SINGLE: DROPZONE */
                <div className="relative group border-2 border-dashed border-white/10 rounded-2xl p-12 text-center cursor-pointer transition-all duration-500 hover:border-accent-cyan/60 hover:bg-accent-cyan/5 overflow-hidden" onDragOver={handleDragOver} onDrop={handleDropSingle} onClick={() => fileRef.current?.click()}>
                  <div className="absolute inset-0 bg-gradient-to-br from-accent-cyan/5 to-accent-purple/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                  <input type="file" ref={fileRef} accept={contentType === 'video' ? "video/mp4,video/*" : contentType === 'audio' ? "audio/*" : ".pdf,.md,text/markdown,application/pdf"} className="hidden" onChange={handleSingleFileChange} />
                  {singleFile ? (
                    <div className="relative z-10 animate-fade-in">
                      <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-gradient-to-br from-accent-cyan to-accent-blue p-[1px] shadow-[0_0_30px_rgba(0,213,255,0.3)] group-hover:scale-110 transition-transform duration-500">
                        <div className="w-full h-full bg-bgMain rounded-2xl flex items-center justify-center">
                          <span className="text-4xl text-transparent bg-clip-text bg-gradient-to-br from-white to-accent-cyan">{contentType === 'video' ? '🎬' : contentType === 'audio' ? '🎵' : '📄'}</span>
                        </div>
                      </div>
                      <div className="text-xl font-bold text-white mb-2 font-display tracking-wide">{singleFile.name}</div>
                      <div className="text-sm font-mono text-accent-cyan">{(singleFile.size / 1024 / 1024).toFixed(2)} MB <span className="mx-2 text-white/20">|</span> READY</div>
                    </div>
                  ) : (
                    <div className="relative z-10">
                      <div className="w-24 h-24 mx-auto mb-6 rounded-full border border-white/10 flex items-center justify-center group-hover:border-accent-cyan/50 group-hover:shadow-[0_0_30px_rgba(0,213,255,0.2)] transition-all duration-500">
                        <div className="text-5xl opacity-40 group-hover:opacity-100 transition-opacity duration-300 transform group-hover:scale-110">☁️</div>
                      </div>
                      <div className="text-2xl font-bold text-white mb-2 font-display">Drag & Drop {contentType}</div>
                      <div className="text-base text-gray-500 mb-6">or click to browse local files</div>
                    </div>
                  )}
                </div>
              )}
            </div>

            <button className="w-full py-4 text-base font-bold h-14 mt-4 bg-gradient-to-r from-accent-purple to-accent-cyan text-black hover:scale-[1.01] hover:shadow-[0_0_20px_rgba(34,211,238,0.4)] transition-all rounded-xl shadow-lg disabled:opacity-50 disabled:cursor-not-allowed uppercase tracking-widest"
              onClick={handleUpload} disabled={uploading}>
              {uploading ? <span className="flex items-center justify-center gap-3"><span className="w-5 h-5 border-2 border-black border-t-transparent rounded-full animate-spin"></span> Publishing Data...</span> : "Start Upload & Mint"}
            </button>
          </div>

          {/* Right Column: Status & Advanced */}
          <div className="space-y-6">
            <div className="nexus-card p-6">
              <h3 className="text-base font-bold mb-4 uppercase tracking-widest text-[#a267ff]">Upload Status</h3>
              <div className="text-center p-4">
                {uploading ? <div className="text-sm text-accent-cyan font-bold">{status}</div> : <div className="text-sm text-gray-500">Awaiting Assets</div>}
              </div>

              {uploadProgressList.length > 0 && (
                <div className="mt-4 pt-4 border-t border-white/10">
                  <div className="text-[10px] text-gray-500 mb-2 font-bold uppercase tracking-widest">Queue Progress</div>
                  <div className="max-h-[200px] overflow-y-auto flex flex-col gap-2 custom-scrollbar">
                    {uploadProgressList.map((item, idx) => (
                      <div key={idx} className="flex items-center gap-3 text-xs p-2 bg-white/5 rounded-lg border border-white/5">
                        <div className={`min-w-[20px] text-center ${item.done ? 'text-green-400' : 'text-accent-cyan'}`}>
                          {item.done ? "✅" : (item.status === "Waiting" ? "⏳" : "⚡")}
                        </div>
                        <div className="flex-1 overflow-hidden">
                          <div className="truncate font-semibold text-white">{item.name}</div>
                          <div className="text-gray-500 text-[9px] uppercase">{item.status}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {error && <div className="mt-4 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-mono">{error}</div>}
            </div>

            <div className="nexus-card p-6 border-accent-cyan/20 bg-gradient-to-b from-accent-cyan/5 to-transparent">
              <h3 className="text-base font-bold mb-4 uppercase tracking-widest text-accent-cyan">Web3 Features</h3>

              <div className="space-y-4">
                <div className="flex items-center justify-between p-3 bg-black/40 rounded-lg border border-white/5">
                  <div>
                    <div className="text-sm font-bold">Arweave Storage</div>
                    <div className="text-[10px] text-gray-500">Perma-web pinning (Est. 0.05 AR)</div>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input type="checkbox" className="sr-only peer" checked={arweaveStorage} onChange={e => setArweaveStorage(e.target.checked)} />
                    <div className="w-9 h-5 bg-white/10 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-accent-cyan"></div>
                  </label>
                </div>

                <div className="flex items-center justify-between p-3 bg-black/40 rounded-lg border border-white/5">
                  <div>
                    <div className="text-sm font-bold text-[#a267ff]">Auto-Mint NFT</div>
                    <div className="text-[10px] text-gray-500">Mint ownership Spore on CKB</div>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input type="checkbox" className="sr-only peer" checked={autoMint} onChange={e => setAutoMint(e.target.checked)} />
                    <div className="w-9 h-5 bg-white/10 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-accent-purple"></div>
                  </label>
                </div>
              </div>
            </div>

            <div className="nexus-card p-6">
              <h3 className="text-base font-bold mb-4 flex items-center justify-between">
                Identity
                <span className="text-[10px] bg-white/10 px-2 py-0.5 rounded text-gray-400">JoyID</span>
              </h3>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-accent-purple to-accent-cyan flex items-center justify-center font-bold text-black shadow-[0_0_10px_rgba(162,103,255,0.5)]">
                  {user?.bitDomain ? user.bitDomain[0].toUpperCase() : "U"}
                </div>
                <div>
                  <div className="font-bold text-sm text-white">{user?.bitDomain || "Unknown"}</div>
                  <div className="text-[10px] text-gray-500 font-mono tracking-widest mt-1">
                    {user?.ckbAddress ? `${user.ckbAddress.slice(0, 8)}...${user.ckbAddress.slice(-6)}` : "Not connected"}
                  </div>
                </div>
              </div>
            </div>

          </div>
        </div>

        {/* Uploading Overlay */}
        {uploading && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md">
            <div className="w-full max-w-lg nexus-card p-8 border-accent-cyan/50 shadow-[0_0_50px_rgba(34,211,238,0.2)] relative overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-accent-cyan via-accent-purple to-accent-cyan animate-pulse bg-[length:200%_auto]" />
              <h2 className="text-2xl font-bold mb-6 flex items-center gap-3 font-display">
                <span className="w-6 h-6 rounded-full border-2 border-accent-cyan border-t-transparent animate-spin" />
                Network Uplink...
              </h2>
              <div className="space-y-4 max-h-[300px] overflow-y-auto custom-scrollbar pr-2 mb-4">
                {uploadProgressList.map((item, idx) => (
                  <div key={idx} className="flex items-center gap-4 p-3 rounded-lg bg-black/40 border border-white/5">
                    <div className={`w-2 h-2 rounded-full ${item.done ? 'bg-green-400 shadow-[0_0_8px_rgba(74,222,128,0.5)]' : 'bg-accent-cyan animate-pulse'}`} />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-bold truncate text-white">{item.name}</div>
                      <div className="text-[10px] text-accent-cyan font-mono mt-0.5 uppercase tracking-wider">{item.status}</div>
                    </div>
                    {item.done && <span className="text-green-400 font-bold">✓</span>}
                  </div>
                ))}
              </div>
              <div className="text-center pt-4 border-t border-white/10">
                <span className="text-xs text-nexusYellow font-mono font-bold animate-pulse">DO NOT CLOSE THIS WINDOW</span>
              </div>
            </div>
          </div>
        )}

        {/* Done Modal */}
        {showDoneModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-sm animate-fade-in p-4">
            <div className="nexus-card p-8 max-w-md w-full text-center border-accent-cyan/50 shadow-[0_0_50px_rgba(0,213,255,0.3)]">
              <div className="text-6xl mb-4">✨</div>
              <h2 className="text-3xl font-bold text-white mb-2 font-display uppercase tracking-widest">Asset Secured</h2>
              <p className="text-gray-400 mb-6 text-sm">
                Content is now live on the Nexus network.
                {earnedPointsTotal > 0 && <span className="block text-accent-cyan mt-3 font-bold text-lg bg-accent-cyan/10 py-2 rounded-lg border border-accent-cyan/20">+{earnedPointsTotal} PTS Earned!</span>}
              </p>

              {/* Mint Progress Stepper inside modal */}
              {mode === "single" && (
                <div className="mb-8 p-4 rounded-xl bg-black/30 border border-white/5 text-left">
                  <div className="text-xs uppercase tracking-widest text-[#a267ff] font-bold mb-3 border-b border-white/5 pb-2">Blockchain Verification</div>

                  {mintStep === 'minting' && (
                    <div className="flex items-center gap-3 text-sm font-mono text-accent-cyan animate-pulse py-2">
                      <span className="w-3 h-3 border-2 border-accent-cyan border-t-transparent rounded-full animate-spin"></span>
                      Awaiting JoyID signature & minting Spore...
                    </div>
                  )}

                  {mintStep === 'done' && mintResult && (
                    <div className="bg-green-500/10 p-3 rounded-lg border border-green-500/30">
                      <div className="text-green-400 font-bold flex items-center gap-2 mb-2 text-sm">
                        <span>✓</span> Ownership NFT Minted
                      </div>
                      <div className="flex justify-between items-center bg-black/50 px-2 py-1 rounded text-[10px]">
                        <span className="text-gray-500">Spore ID:</span>
                        <span className="font-mono text-gray-300">{mintResult.sporeId.slice(0, 10)}...{mintResult.sporeId.slice(-4)}</span>
                      </div>
                    </div>
                  )}

                  {mintStep === 'error' && (
                    <div className="bg-red-500/10 p-3 rounded-lg border border-red-500/30">
                      <div className="text-red-400 font-bold text-sm mb-1">⚠️ Mint Failed</div>
                      <div className="text-[10px] text-gray-400 bg-black/50 p-2 rounded mb-3 font-mono">{mintError || 'Unknown error'}</div>
                      <button onClick={handleMintOwnership} disabled={mintingSpore} className="w-full text-xs py-2 rounded-lg bg-accent-purple/20 border border-accent-purple text-[#a267ff] hover:bg-accent-purple/30 transition-colors cursor-pointer font-bold">
                        {mintingSpore ? 'Retrying...' : 'Retry Mint Transaction'}
                      </button>
                    </div>
                  )}

                  {mintStep === 'done' && !mintResult && !autoMint && lastVideoId && (
                    <button onClick={handleMintOwnership} disabled={mintingSpore}
                      className={`w-full py-2.5 rounded-lg text-sm font-bold transition-all flex items-center justify-center gap-2 mt-2 ${mintingSpore ? "bg-white/10 cursor-not-allowed text-gray-400" : "bg-white/10 hover:bg-white/20 border border-white/20 text-white cursor-pointer"}`}
                    >
                      {mintingSpore ? 'Minting...' : 'Mint Spore NFT Manually'}
                    </button>
                  )}
                  <div className="text-[9px] text-gray-500 mt-3 text-center uppercase tracking-widest">Powered by Nervos CKB</div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <button onClick={() => navigate("/creator")} className="py-3 px-4 rounded-xl font-bold bg-white/10 hover:bg-white/20 transition-colors text-sm">Back to Studio</button>
                <button onClick={() => {
                  setShowDoneModal(false); setSingleFile(null); setEpisodes([]); setTitle(""); setDesc("");
                  setUploadProgressList([]); setLastVideoId(null); setMintResult(null); setEarnedPointsTotal(0);
                }} className="py-3 px-4 rounded-xl font-bold bg-accent-cyan hover:bg-cyan-400 text-black shadow-[0_0_15px_rgba(34,211,238,0.3)] transition-all text-sm">Publish Another</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

const style = document.createElement('style');
style.innerHTML = `
    .input-nexus { background: rgba(0,0,0,0.3); border: 1px solid rgba(255,255,255,0.1); border-radius: 0.5rem; color: white; transition: all 0.2s; outline: none; }
    .input-nexus:focus { border-color: #22d3ee; box-shadow: 0 0 0 1px rgba(34,211,238,0.2); background: rgba(0,0,0,0.5); }
    .nexus-card { background: rgba(15, 15, 20, 0.6); border: 1px solid rgba(255,255,255,0.05); border-radius: 1rem; backdrop-filter: blur(12px); box-shadow: 0 4px 20px rgba(0,0,0,0.5); }
    .custom-scrollbar::-webkit-scrollbar { width: 4px; }
    .custom-scrollbar::-webkit-scrollbar-track { background: rgba(255, 255, 255, 0.05); border-radius: 4px; }
    .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(34, 211, 238, 0.3); border-radius: 4px; }
    .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: rgba(34, 211, 238, 0.6); }
`;
document.head.appendChild(style);