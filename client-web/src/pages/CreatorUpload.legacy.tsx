
import React, { useRef, useState } from "react";
import "../styles/fun.css";
import TopNav from "../components/TopNav";
import { ApiClient } from "@video-platform/shared/api/client";
import type { MetadataWriteResponse, VideoMeta, DirectUploadInitResponse } from "@video-platform/shared/types";
import { useNavigate } from "react-router-dom";
import * as tus from "tus-js-client";

const client = new ApiClient();

// Updated Genres with AI categories first
const GENRES = ["AI Movie", "AI Animation", "Action", "Adventure", "Comedy", "Drama", "Documentary", "Education", "Fantasy", "Horror", "Music", "Sci-Fi", "Tech", "Thriller", "Vlog", "Gaming", "Other"];
const QUALITIES = ["4K", "2K", "1080p", "720p", "480p"];
const LANGUAGES = ["English", "Chinese", "Japanese", "Spanish", "French", "German", "Other"];
const YEARS = Array.from({ length: 50 }, (_, i) => new Date().getFullYear() - i);
const FREE_UPLOAD_REWARD = 100;

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

const tusUpload = (uploadUrl: string, file: File, onProgress: (p: number) => void): Promise<string> => {
  return new Promise((resolve, reject) => {
    const upload = new tus.Upload(file, {
      uploadUrl,
      chunkSize: 50 * 1024 * 1024,
      retryDelays: [0, 1000, 3000, 5000],
      metadata: {
        filename: file.name,
        filetype: file.type || "video/mp4",
      },
      onProgress: (bytesUploaded, bytesTotal) => {
        const percentage = ((bytesUploaded / bytesTotal) * 100).toFixed(2);
        onProgress(Number(percentage));
      },
      onSuccess: () => {
        const urlPart = upload.url;
        if (!urlPart) {
          reject(new Error("Upload URL not found"));
          return;
        }
        const parts = urlPart.split("/");
        const uid = parts[parts.length - 1]; // cloudflare stream uid
        resolve(uid);
      },
      onError: (error) => reject(error),
    });
    upload.start();
  });
};

const waitCloudflareReady = async (uid: string, onStatus: (st: string) => void): Promise<string | null> => {
  let attempts = 0;
  while (attempts < 60) {
    try {
      const res = await client.get<any>(`/content/status/${uid}`);
      const st = res?.result?.status?.state || "processing";
      const pct = res?.result?.status?.pctComplete || "0";
      onStatus(`${st} (${pct}%)`);
      if (res?.result?.readyToStream) {
        return res.result.playback.hls;
      }
      if (res?.result?.status?.error) {
        throw new Error("Transcode Error: " + res.result.status.error);
      }
    } catch (e) {
      console.warn("Check status error", e);
    }
    await new Promise(r => setTimeout(r, 3000));
    attempts++;
  }
  return null;
};

interface EpisodeDraft {
  id: string; // internal unique id
  file: File;
  title: string;
  description: string;
  thumbnail: File | null;
  isFreePreview: boolean;
}

export default function CreatorUpload() {
  const navigate = useNavigate();
  // SINGLE MODE STATE
  const fileRef = useRef<HTMLInputElement>(null);
  const [title, setTitle] = useState("");
  const [singleFile, setSingleFile] = useState<File | null>(null);

  // SERIES MODE STATE
  const [seriesTitle, setSeriesTitle] = useState("");
  const [episodes, setEpisodes] = useState<EpisodeDraft[]>([]);

  // COMMON STATE
  const [desc, setDesc] = useState("");
  const [price, setPrice] = useState("1000");
  const [status, setStatus] = useState<string>("准备上传...");
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState<boolean>(false);
  const [mode, setMode] = useState<"single" | "series">("single");
  const [showDoneModal, setShowDoneModal] = useState(false);
  const [earnedPointsTotal, setEarnedPointsTotal] = useState(0);

  // Metadata State
  const [genre, setGenre] = useState(GENRES[0]);
  const [selectedYear, setSelectedYear] = useState(YEARS[0]);
  const [quality, setQuality] = useState(QUALITIES[2]); // Default 1080p
  const [language, setLanguage] = useState(LANGUAGES[0]);

  // Upload Progress State
  const [uploadProgressList, setUploadProgressList] = useState<{ name: string; status: string; done: boolean }[]>([]);

  const usrRaw = typeof window !== "undefined" ? sessionStorage.getItem("vp.user") : null;
  const user = usrRaw ? JSON.parse(usrRaw) : null;
  const jwt = typeof window !== "undefined" ? sessionStorage.getItem("vp.token") : null;

  // Single Mode Handlers
  const handleSingleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setSingleFile(e.target.files[0]);
      if (!title) setTitle(e.target.files[0].name.replace(".mp4", ""));
    }
  };

  const handleDragOver = (e: React.DragEvent) => e.preventDefault();
  const handleDropSingle = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      setSingleFile(e.dataTransfer.files[0]);
      if (!title) setTitle(e.dataTransfer.files[0].name.replace(".mp4", ""));
    }
  };

  // Series Mode Handlers
  const handleAddEpisodes = (files: File[]) => {
    const newDrafts: EpisodeDraft[] = files.map((f) => ({
      id: crypto.randomUUID(),
      file: f,
      title: f.name.replace(/\.[^.]+$/, ""),
      description: "",
      thumbnail: null,
      isFreePreview: false
    }));
    setEpisodes(prev => [...prev, ...newDrafts]);
  };

  async function handleUpload() {
    setError(null);
    try {
      if (!jwt || !user) { setError("请先使用 JoyID 登录后再上传"); return; }
      client.setJWT(jwt);
      if (!desc.trim()) { setError("请填写描述"); return; }
      if (!/^[0-9]+$/.test(price)) { setError("积分价格格式不正确（请输入整数，0 表示免费）"); return; }

      const isSeries = mode === "series";
      let filesToUpload: { file: File, title: string, desc: string, thumb: File | null, isFree: boolean, draftId?: string }[] = [];

      if (!isSeries) {
        if (!title.trim()) { setError("请填写标题"); return; }
        if (!singleFile) { setError("请选择需要上传的 mp4 文件"); return; }
        filesToUpload = [{ file: singleFile, title: title.trim(), desc: desc.trim(), thumb: null, isFree: false }];
      } else {
        if (!seriesTitle.trim()) { setError("请填写合集标题"); return; }
        if (episodes.length === 0) { setError("请添加至少一集视频"); return; }
        for (let i = 0; i < episodes.length; i++) {
          if (!episodes[i].title.trim()) { setError(`第 ${i + 1} 集标题为空`); return; }
        }
        filesToUpload = episodes.map(ep => ({
          file: ep.file,
          title: ep.title.trim(),
          desc: ep.description.trim() || desc.trim(), // fallback to main desc
          thumb: ep.thumbnail,
          isFree: ep.isFreePreview,
          draftId: ep.id
        }));
      }

      setUploading(true);
      // Initialize List
      setUploadProgressList(filesToUpload.map(i => ({ name: i.title, status: "Waiting", done: false })));

      const total = filesToUpload.length;
      const seriesId = isSeries ? crypto.randomUUID() : undefined;
      const pointsVal = parseInt(price, 10);
      const isFreeGlobal = !Number.isNaN(pointsVal) && pointsVal <= 0;
      let earnedTotal = 0;

      // Meta Append
      const metaInfo = `\n\nGenre: ${genre} | Year: ${selectedYear} | Quality: ${quality} | Language: ${language}`;

      for (let i = 0; i < total; i++) {
        const item = filesToUpload[i];
        const file = item.file;
        const videoId = crypto.randomUUID();

        const updateSt = (st: string, done: boolean = false) => {
          setStatus(isSeries ? `[${i + 1}/${total}] ${st}` : st);
          setUploadProgressList(prev => {
            const n = [...prev];
            n[i] = { name: item.title, status: st, done };
            return n;
          });
        };

        const useResumable = file.size >= 200 * 1024 * 1024;
        let cfStreamUid: string | undefined;
        // Forced Local
        const forcedLocalUpload = (typeof window !== "undefined") && (
          localStorage.getItem("vp.uploadMode") === "local" ||
          localStorage.getItem("vp.upload.mode") === "local"
        );

        if (forcedLocalUpload) {
          updateSt("Local Upload...");
          const base64 = await readFileAsBase64(file);
          updateSt("Local sending...");
          const up = await client.post<any>("/content/upload", {
            videoId,
            creatorCkbAddress: user.ckbAddress,
            base64Content: base64,
          });
          cfStreamUid = up?.record?.cfStreamUid;
        } else if (useResumable) {
          updateSt("Init Resumable...");
          const init = await client.post<{ tusURL: string }>("/content/upload/resumable_init", {
            videoId,
            creatorCkbAddress: user.ckbAddress,
            uploadLength: file.size,
            name: file.name,
            filetype: file.type || "video/mp4",
          });
          updateSt("Uploading...");
          cfStreamUid = await tusUpload(init.tusURL, file, (p) => updateSt(`Uploading ${p}%`));
        } else {
          try {
            updateSt("Init Direct...");
            const init = await client.post<any>("/content/upload/direct_init", {
              videoId,
              creatorCkbAddress: user.ckbAddress,
            });
            cfStreamUid = init?.cfStreamUid;
            const form = new FormData();
            form.set("file", file, file.name);
            updateSt("Uploading...");
            const resp = await fetch(init?.uploadURL!, { method: "POST", body: form });
            if (!resp.ok) throw new Error(`直传失败: ${resp.status}`);
          } catch (e) {
            updateSt("Fallback Local...");
            const base64 = await readFileAsBase64(file);
            updateSt("Local Uploading...");
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
          updateSt("Transcoding...");
          const hls = await waitCloudflareReady(cfStreamUid, (st) => updateSt(`Transcoding ${st}`));
          if (hls) cdnUrl = hls;
        }

        const meta: VideoMeta = {
          id: videoId,
          title: isSeries ? `${seriesTitle.trim()} - ${item.title}` : item.title,
          description: item.desc + metaInfo,
          creatorBitDomain: user.bitDomain || "",
          creatorCkbAddress: user.ckbAddress || "",
          priceUSDI: "0",
          pointsPrice: (isSeries && item.isFree) ? 0 : pointsVal,
          cdnUrl,
          cfStreamUid,
          posterUrl: item.thumb ? await readFileAsBase64(item.thumb) : undefined,
          filecoinCid: undefined,
          sha256: undefined,
          createdAt: new Date().toISOString(),
          ...(isSeries ? { seriesId, seriesTitle: seriesTitle.trim(), episodeIndex: i + 1 } : {}),
        };

        updateSt("Finalizing...");
        await client.post<MetadataWriteResponse>("/metadata/write", { meta });

        // Reward
        if (meta.pointsPrice <= 0) {
          try {
            const res = await client.post<{ amount: number }>("/payment/points/earn", { amount: FREE_UPLOAD_REWARD, reason: "上传免费视频奖励" });
            const got = Number(res?.amount || FREE_UPLOAD_REWARD);
            if (!Number.isNaN(got)) earnedTotal += got;
          } catch { }
        }

        updateSt("Published", true);
      } // end for

      setStatus(isSeries ? `Series Upload Complete` : "Upload Complete");
      setEarnedPointsTotal(earnedTotal);
      setShowDoneModal(true);

    } catch (e: any) {
      setError(e?.error || e?.message || "上传失败");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="layout-container">
      <TopNav />
      <div className="main-content" style={{ paddingTop: 40, paddingBottom: 80 }}>
        <div style={{ padding: "0 16px", marginBottom: 32 }}>
          <h1 style={{ fontSize: 32, fontWeight: 800, fontFamily: "var(--font-display)", marginBottom: 8, textShadow: "0 0 20px rgba(162,103,255,0.3)" }}>
            Upload Center
          </h1>
          <p style={{ color: "var(--text-muted)", fontSize: 14 }}>Upload and manage your videos and series on Nexus.</p>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 340px", gap: 32, padding: "0 16px" }}>
          {/* Left Column: Form */}
          <div className="glass-card" style={{ padding: 32, border: "1px solid var(--border-subtle)" }}>
            <div style={{ marginBottom: 32 }}>
              <label className="field-label" style={{ marginBottom: 12 }}>CONTENT TYPE</label>
              <div style={{ display: "flex", gap: 16 }}>
                <div
                  onClick={() => setMode("single")}
                  style={{
                    flex: 1, padding: "16px", borderRadius: 16, cursor: "pointer", textAlign: "center", fontSize: 14, fontWeight: 600,
                    border: mode === "single" ? "2px solid var(--accent-cyan)" : "1px solid var(--border-subtle)",
                    background: mode === "single" ? "rgba(0,255,255,0.05)" : "transparent",
                    color: mode === "single" ? "var(--accent-cyan)" : "var(--text-muted)"
                  }}
                >
                  Single Video
                </div>
                <div
                  onClick={() => setMode("series")}
                  style={{
                    flex: 1, padding: "16px", borderRadius: 16, cursor: "pointer", textAlign: "center", fontSize: 14, fontWeight: 600,
                    border: mode === "series" ? "2px solid var(--accent-purple)" : "1px solid var(--border-subtle)",
                    background: mode === "series" ? "linear-gradient(90deg, #a267ff 0%, #7645d9 100%)" : "transparent",
                    color: mode === "series" ? "#fff" : "var(--text-muted)",
                    boxShadow: mode === "series" ? "0 4px 20px rgba(162,103,255,0.4)" : "none"
                  }}
                >
                  Video Series
                </div>
              </div>
            </div>

            {mode === "series" ? (
              <div style={{ marginBottom: 24 }}>
                <label className="field-label">Series Title</label>
                <input className="input-nexus" value={seriesTitle} onChange={(e) => setSeriesTitle(e.target.value)} placeholder="e.g. My Travel Diaries 2024" />
              </div>
            ) : (
              <div style={{ marginBottom: 24 }}>
                <label className="field-label">Video Title</label>
                <input className="input-nexus" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Cyberpunk City Walk" />
              </div>
            )}

            {/* Metadata Fields */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 16, marginBottom: 24 }}>
              <div>
                <label className="field-label">Genre</label>
                <select className="input-nexus" value={genre} onChange={e => setGenre(e.target.value)} style={{ color: "#fff", background: "#1a1a1a", border: "1px solid var(--border-subtle)" }}>
                  {GENRES.map(g => <option key={g} value={g}>{g}</option>)}
                </select>
              </div>
              <div>
                <label className="field-label">Year</label>
                <select className="input-nexus" value={selectedYear} onChange={e => setSelectedYear(Number(e.target.value))} style={{ color: "#fff", background: "#1a1a1a", border: "1px solid var(--border-subtle)" }}>
                  {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
                </select>
              </div>
              <div>
                <label className="field-label">Language</label>
                <select className="input-nexus" value={language} onChange={e => setLanguage(e.target.value)} style={{ color: "#fff", background: "#1a1a1a", border: "1px solid var(--border-subtle)" }}>
                  {LANGUAGES.map(l => <option key={l} value={l}>{l}</option>)}
                </select>
              </div>
              <div>
                <label className="field-label">Quality</label>
                <select className="input-nexus" value={quality} onChange={e => setQuality(e.target.value)} style={{ color: "#fff", background: "#1a1a1a", border: "1px solid var(--border-subtle)" }}>
                  {QUALITIES.map(q => <option key={q} value={q}>{q}</option>)}
                </select>
              </div>
            </div>

            <div style={{ marginBottom: 24 }}>
              <label className="field-label">Description</label>
              <textarea
                className="input-nexus"
                style={{ minHeight: 120, resize: "none" }}
                value={desc}
                onChange={(e) => setDesc(e.target.value)}
                placeholder="Tell viewers about your video..."
              />
            </div>

            <div style={{ marginBottom: 32 }}>
              <label className="field-label">Access Price (Points)</label>
              <div style={{ position: "relative" }}>
                <input
                  className="input-nexus"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  style={{ paddingRight: 60 }}
                />
                <span style={{ position: "absolute", right: 16, top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)", fontSize: 12 }}>PTS</span>
              </div>
              <p style={{ color: "var(--text-muted)", fontSize: 12, marginTop: 8 }}>Set to 0 to make this video free for everyone.</p>
            </div>

            {/* Upload Area */}
            <div style={{ marginBottom: 24 }}>
              <label className="field-label">Video File</label>

              {mode === "series" ? (
                /* SERIES: CARD LAYOUT */
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 16, marginTop: 16 }}>
                  {/* Episode Cards */}
                  {episodes.map((ep, idx) => (
                    <div key={ep.id} className="glass-card" style={{ padding: 12, position: "relative", border: "1px solid var(--glass-border)", background: "rgba(0,0,0,0.3)" }}>
                      {/* Remove Button */}
                      <button
                        onClick={() => setEpisodes(prev => prev.filter(e => e.id !== ep.id))}
                        style={{ position: "absolute", top: -8, right: -8, width: 24, height: 24, borderRadius: "50%", background: "#ff4444", color: "white", border: "none", cursor: "pointer", zIndex: 10, display: "flex", alignItems: "center", justifyContent: "center" }}
                      >×</button>

                      {/* Thumbnail Area */}
                      <div
                        style={{ aspectRatio: "16/9", background: "#111", marginBottom: 8, borderRadius: 8, position: "relative", overflow: "hidden", cursor: "pointer", border: "1px solid var(--border-subtle)" }}
                        onClick={() => document.getElementById(`thumb-${ep.id}`)?.click()}
                        title="Click to upload cover"
                      >
                        {ep.thumbnail ? (
                          <img src={URL.createObjectURL(ep.thumbnail)} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                        ) : (
                          <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", color: "var(--text-muted)" }}>
                            <span style={{ fontSize: 24 }}>📷</span>
                            <span style={{ fontSize: 10, marginTop: 4 }}>Cover</span>
                          </div>
                        )}
                        <input type="file" id={`thumb-${ep.id}`} style={{ display: "none" }} accept="image/*" onChange={(e) => {
                          const f = e.target.files?.[0];
                          if (f) setEpisodes(prev => {
                            const n = [...prev];
                            n[idx].thumbnail = f;
                            return n;
                          });
                        }} />
                      </div>

                      {/* Meta Inputs */}
                      <div style={{ fontSize: 11, color: "var(--accent-purple)", marginBottom: 4, fontWeight: 700 }}>Ep {idx + 1}</div>
                      <input
                        className="input-nexus"
                        style={{ padding: "6px", fontSize: 12, marginBottom: 4, height: 32, background: "rgba(255,255,255,0.05)" }}
                        value={ep.title}
                        onChange={e => setEpisodes(prev => { const n = [...prev]; n[idx].title = e.target.value; return n; })}
                        placeholder="Title"
                      />
                      <textarea
                        className="input-nexus"
                        style={{ padding: "6px", fontSize: 11, marginBottom: 4, minHeight: 40, resize: "none", background: "rgba(255,255,255,0.05)" }}
                        value={ep.description}
                        onChange={e => setEpisodes(prev => { const n = [...prev]; n[idx].description = e.target.value; return n; })}
                        placeholder="Intro (Optional)"
                      />

                      {/* Footer */}
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <label style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11, cursor: "pointer", color: "var(--text-muted)" }}>
                          <input type="checkbox" checked={ep.isFreePreview} onChange={e => setEpisodes(prev => { const n = [...prev]; n[idx].isFreePreview = e.target.checked; return n; })} />
                          <span>Free</span>
                        </label>
                        <span style={{ fontSize: 10, color: "var(--text-muted)", opacity: 0.7 }}>{(ep.file.size / 1024 / 1024).toFixed(1)}MB</span>
                      </div>
                    </div>
                  ))}

                  {/* Add Button */}
                  <div
                    className="drop-zone"
                    style={{
                      aspectRatio: "3/4",
                      border: "2px dashed var(--border-subtle)",
                      borderRadius: 12,
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      justifyContent: "center",
                      cursor: "pointer",
                      background: "rgba(255,255,255,0.02)",
                      minHeight: 250
                    }}
                    onClick={() => document.getElementById('series-files')?.click()}
                  >
                    <div style={{ fontSize: 40, marginBottom: 8, color: "var(--accent-purple)" }}>+</div>
                    <div style={{ fontSize: 14, fontWeight: 600 }}>Add Episodes</div>
                    <div style={{ fontSize: 11, color: "var(--text-muted)", textAlign: "center", marginTop: 4 }}>Support Multiple Files</div>
                    <input
                      id="series-files"
                      type="file"
                      multiple
                      accept="video/mp4"
                      style={{ display: "none" }}
                      onChange={e => {
                        if (e.target.files) handleAddEpisodes(Array.from(e.target.files));
                        e.target.value = ''; // reset
                      }}
                    />
                  </div>
                </div>
              ) : (
                /* SINGLE: DROPZONE */
                <div
                  className="drop-zone"
                  style={{
                    padding: 40, border: "2px dashed var(--border-subtle)", borderRadius: 16,
                    textAlign: "center", cursor: "pointer", background: "rgba(255,255,255,0.02)"
                  }}
                  onDragOver={handleDragOver}
                  onDrop={handleDropSingle}
                  onClick={() => fileRef.current?.click()}
                >
                  <input type="file" ref={fileRef} accept="video/mp4" style={{ display: "none" }} onChange={handleSingleFileChange} />
                  {singleFile ? (
                    <div>
                      <div style={{ fontSize: 32, marginBottom: 16 }}>🎬</div>
                      <div style={{ fontSize: 16, fontWeight: 600 }}>{singleFile.name}</div>
                      <div style={{ color: "var(--text-muted)", marginTop: 8 }}>{(singleFile.size / 1024 / 1024).toFixed(2)} MB</div>
                      <div style={{ color: "var(--accent-cyan)", marginTop: 16, fontSize: 14 }}>Click to change</div>
                    </div>
                  ) : (
                    <div>
                      <div style={{ fontSize: 32, marginBottom: 16 }}>☁️</div>
                      <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>Drag and drop your video</div>
                      <div style={{ color: "var(--text-muted)", fontSize: 14 }}>or click to browse local files</div>
                      <div style={{ color: "var(--text-muted)", fontSize: 12, marginTop: 16 }}>Supports MP4 • Max 2GB</div>
                    </div>
                  )}
                </div>
              )}
            </div>

            <button
              className="nexus-button"
              disabled={uploading}
              onClick={handleUpload}
              style={{
                width: "100%", padding: 16, fontSize: 16, fontWeight: 700,
                background: uploading ? "var(--surface-3)" : "var(--accent-primary-gradient)"
              }}
            >
              {uploading ? (
                <span style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
                  <span className="spinner" style={{ width: 20, height: 20 }}></span>
                  Processing...
                </span>
              ) : (
                "Start Upload"
              )}
            </button>
          </div>

          {/* Right Column: Status */}
          <div>
            <div className="glass-card" style={{ padding: 24, marginBottom: 24 }}>
              <h3 style={{ fontSize: 16, marginBottom: 16 }}>Upload Status</h3>
              <div style={{ textAlign: "center", padding: 20 }}>
                {uploading ? (
                  <>
                    <div style={{ color: "var(--accent-cyan)", fontSize: 14 }}>{status}</div>
                  </>
                ) : (
                  <div style={{ color: "var(--text-muted)", fontSize: 14 }}>Ready to start</div>
                )}
              </div>
              {/* Upload Progress List */}
              {uploadProgressList.length > 0 && (
                <div style={{ marginTop: 16, borderTop: "1px solid var(--border-subtle)", paddingTop: 16 }}>
                  <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 8 }}>Queue ({uploadProgressList.filter(i => i.done).length}/{uploadProgressList.length})</div>
                  <div style={{ maxHeight: 200, overflowY: "auto", display: "flex", flexDirection: "column", gap: 8 }}>
                    {uploadProgressList.map((item, idx) => (
                      <div key={idx} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, padding: "8px", background: "rgba(255,255,255,0.03)", borderRadius: 8 }}>
                        <div style={{ minWidth: 20, textAlign: "center" }}>
                          {item.done ? "✅" : (item.status === "Waiting" ? "⏳" : "🔄")}
                        </div>
                        <div style={{ flex: 1, overflow: "hidden" }}>
                          <div style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", fontWeight: 600 }}>{item.name}</div>
                          <div style={{ color: "var(--text-muted)", fontSize: 11 }}>{item.status}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {error && <div style={{ marginTop: 16, padding: 12, borderRadius: 8, background: "rgba(255,100,100,0.1)", color: "#ff8888", fontSize: 13 }}>{error}</div>}
            </div>

            <div className="glass-card" style={{ padding: 24 }}>
              <h3 style={{ fontSize: 16, marginBottom: 16 }}>Identity</h3>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <div style={{ width: 40, height: 40, borderRadius: "50%", background: "var(--accent-purple)", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700 }}>
                  {user?.bitDomain ? user.bitDomain[0].toUpperCase() : "U"}
                </div>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 14 }}>{user?.bitDomain || "Unknown"}</div>
                  <div style={{ fontSize: 12, color: "var(--text-muted)", fontFamily: "monospace" }}>
                    {user?.ckbAddress ? `${user.ckbAddress.slice(0, 6)}...${user.ckbAddress.slice(-4)}` : "Not connected"}
                  </div>
                </div>
              </div>
            </div>
            <div className="glass-card" style={{ padding: 24, marginTop: 24 }}>
              <h3 style={{ fontSize: 16, marginBottom: 16 }}>Tips</h3>
              <ul style={{ fontSize: 12, color: "var(--text-muted)", paddingLeft: 16, lineHeight: 1.6 }}>
                <li>Uploads support MP4 format.</li>
                <li>You can set custom covers for each episode.</li>
                <li>Set price to 0 for free content.</li>
                <li>Free content earns you Points rewards.</li>
              </ul>
            </div>
          </div>
        </div>

        {/* Done Modal */}
        {showDoneModal && (
          <div className="modal-overlay">
            <div className="glass-card" style={{ padding: 40, maxWidth: 400, textAlign: "center", position: "relative" }}>
              <div style={{ fontSize: 48, marginBottom: 24 }}>🎉</div>
              <h2 style={{ fontSize: 24, marginBottom: 16 }}>Upload Complete!</h2>
              {earnedPointsTotal > 0 && (
                <div style={{ marginBottom: 24, padding: "12px", background: "rgba(0,255,0,0.1)", borderRadius: 8, color: "#4affaa" }}>
                  You earned {earnedPointsTotal} bonus points!
                </div>
              )}
              <p style={{ color: "var(--text-muted)", marginBottom: 32 }}>Your content is now being processed.</p>
              <button className="nexus-button" onClick={() => navigate("/explore")} style={{ width: "100%", padding: 12 }}>Check My Space</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}