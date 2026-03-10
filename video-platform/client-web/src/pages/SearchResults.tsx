import React, { useEffect, useState, useCallback } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { getApiClient } from "../lib/apiClient";
import { VideoCard } from "../components/VideoCard";
import { Search } from "lucide-react";
import type { VideoMeta } from "@video-platform/shared/types";

const client = getApiClient();

interface SearchResponse {
  query: string;
  type: string;
  page: number;
  limit: number;
  total: number;
  results: any[];
  processingTimeMs?: number;
}

const SEARCH_TYPES = [
  { id: "video", label: "🎬 Videos", color: "#a267ff" },
  { id: "music", label: "🎵 Music", color: "#ff6b9d" },
  { id: "article", label: "📝 Articles", color: "#00f5d4" },
  { id: "user", label: "👤 Users", color: "#ffd93d" },
  { id: "live", label: "📡 Live", color: "#ff4444" },
];

export default function SearchResults() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const q = searchParams.get("q") || "";
  const typeParam = searchParams.get("type") || "video";

  const [inputValue, setInputValue] = useState(q);
  const [activeType, setActiveType] = useState(typeParam);
  const [results, setResults] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [processingTime, setProcessingTime] = useState<number | null>(null);

  const doSearch = useCallback(async (term: string, type: string) => {
    if (!term.trim()) return;
    setLoading(true);
    setSearched(true);
    try {
      const res = await client.get<SearchResponse>(
        `/search?q=${encodeURIComponent(term.trim())}&type=${type}&limit=24`
      );
      setResults(res?.results || []);
      setTotal(res?.total || 0);
      setProcessingTime(res?.processingTimeMs ?? null);
    } catch {
      setResults([]);
      setTotal(0);
      setProcessingTime(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    setInputValue(q);
    if (q) doSearch(q, activeType);
  }, [q, activeType, doSearch]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = inputValue.trim();
    if (!trimmed) return;
    setSearchParams({ q: trimmed, type: activeType });
  };

  const handleTypeChange = (type: string) => {
    setActiveType(type);
    if (q) setSearchParams({ q, type });
  };

  // Highlight matching text in results
  const highlight = (text: string, query: string) => {
    if (!query || !text) return text;
    const regex = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
    const parts = text.split(regex);
    return parts.map((part, i) =>
      regex.test(part)
        ? <mark key={i} style={{ background: '#a267ff40', color: '#fff', borderRadius: 2, padding: '0 2px' }}>{part}</mark>
        : part
    );
  };

  return (
    <div style={{ minHeight: "100vh", background: "#0A0A10", color: "#fff", padding: "24px 16px 100px" }}>
      {/* Search bar */}
      <form onSubmit={handleSubmit} style={{ maxWidth: 640, margin: "0 auto 24px" }}>
        <div style={{
          display: "flex",
          gap: 8,
          background: "rgba(255,255,255,0.06)",
          border: "1px solid rgba(255,255,255,0.1)",
          borderRadius: 12,
          padding: "8px 16px",
          alignItems: "center",
        }}>
          <Search size={20} style={{ color: "rgba(255,255,255,0.4)", flexShrink: 0 }} />
          <input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder="Search videos, music, articles, creators..."
            style={{
              flex: 1,
              background: "transparent",
              border: "none",
              outline: "none",
              color: "#fff",
              fontSize: 16,
            }}
          />
          <button
            type="submit"
            style={{
              padding: "8px 20px",
              background: "linear-gradient(135deg, #a267ff, #00f5d4)",
              border: "none",
              borderRadius: 8,
              color: "#000",
              fontWeight: 700,
              fontSize: 14,
              cursor: "pointer",
              flexShrink: 0,
            }}
          >
            Search
          </button>
        </div>
      </form>

      {/* Type tabs */}
      <div style={{
        maxWidth: 640,
        margin: "0 auto 24px",
        display: "flex",
        gap: 8,
        flexWrap: "wrap",
      }}>
        {SEARCH_TYPES.map(t => (
          <button
            key={t.id}
            onClick={() => handleTypeChange(t.id)}
            style={{
              padding: "6px 16px",
              borderRadius: 20,
              border: `1px solid ${activeType === t.id ? t.color : 'rgba(255,255,255,0.1)'}`,
              background: activeType === t.id ? `${t.color}20` : 'transparent',
              color: activeType === t.id ? t.color : 'rgba(255,255,255,0.5)',
              fontSize: 13,
              fontWeight: 600,
              cursor: "pointer",
              transition: "all 0.2s",
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Results header */}
      {searched && !loading && (
        <div style={{
          maxWidth: 1200,
          margin: "0 auto 16px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}>
          <span style={{ color: "rgba(255,255,255,0.5)", fontSize: 14 }}>
            {total > 0
              ? `Found ${total} ${activeType}${total !== 1 ? "s" : ""} for "${q}"`
              : `No ${activeType}s found for "${q}"`}
          </span>
          {processingTime !== null && (
            <span style={{ color: "rgba(255,255,255,0.3)", fontSize: 12 }}>
              {processingTime}ms
            </span>
          )}
        </div>
      )}

      {/* Loading state */}
      {loading && (
        <div style={{ display: "flex", justifyContent: "center", padding: "60px 0" }}>
          <div style={{
            width: 40, height: 40, borderRadius: "50%",
            border: "3px solid rgba(162,103,255,0.2)",
            borderTopColor: "#a267ff",
            animation: "spin 0.8s linear infinite",
          }} />
          <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
        </div>
      )}

      {/* Empty state */}
      {searched && !loading && results.length === 0 && (
        <div style={{ textAlign: "center", padding: "80px 20px" }}>
          <div style={{ fontSize: 48, marginBottom: 16, opacity: 0.3 }}>🔍</div>
          <div style={{ fontSize: 18, color: "rgba(255,255,255,0.6)", marginBottom: 8 }}>
            No {activeType}s found
          </div>
          <div style={{ fontSize: 14, color: "rgba(255,255,255,0.3)" }}>
            Try different keywords, check spelling, or search in another category
          </div>
        </div>
      )}

      {/* Results grid */}
      {results.length > 0 && (
        <div style={{
          maxWidth: 1200,
          margin: "0 auto",
          display: "grid",
          gridTemplateColumns: activeType === "user"
            ? "repeat(auto-fill, minmax(200px, 1fr))"
            : "repeat(auto-fill, minmax(280px, 1fr))",
          gap: 20,
        }}>
          {activeType === "video" && results.map((video: VideoMeta, i) => (
            <VideoCard
              key={video.id}
              video={video}
              index={i}
              onClick={() => navigate(`/player/${video.id}`)}
            />
          ))}
          {activeType === "music" && results.map((item: any) => (
            <div
              key={item.id}
              onClick={() => navigate(`/music`)}
              style={{
                padding: 16,
                background: "rgba(255,255,255,0.04)",
                border: "1px solid rgba(255,255,255,0.08)",
                borderRadius: 12,
                cursor: "pointer",
                transition: "all 0.2s",
              }}
            >
              <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 4 }}>
                🎵 {highlight(item.title || item.name, q)}
              </div>
              <div style={{ fontSize: 13, color: "rgba(255,255,255,0.5)" }}>
                {highlight(item.artist || item.creator || '', q)}
              </div>
            </div>
          ))}
          {activeType === "article" && results.map((item: any) => (
            <div
              key={item.id}
              onClick={() => navigate(`/articles`)}
              style={{
                padding: 16,
                background: "rgba(255,255,255,0.04)",
                border: "1px solid rgba(255,255,255,0.08)",
                borderRadius: 12,
                cursor: "pointer",
                transition: "all 0.2s",
              }}
            >
              <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 4 }}>
                📝 {highlight(item.title, q)}
              </div>
              <div style={{ fontSize: 13, color: "rgba(255,255,255,0.5)", lineHeight: 1.4 }}>
                {highlight((item.description || item.excerpt || '').slice(0, 120), q)}...
              </div>
            </div>
          ))}
          {activeType === "user" && results.map((item: any) => (
            <div
              key={item.id}
              onClick={() => navigate(`/channel/${item.id}`)}
              style={{
                padding: 16,
                background: "rgba(255,255,255,0.04)",
                border: "1px solid rgba(255,255,255,0.08)",
                borderRadius: 12,
                cursor: "pointer",
                textAlign: "center",
                transition: "all 0.2s",
              }}
            >
              <div style={{
                width: 56, height: 56, borderRadius: "50%",
                background: "linear-gradient(135deg, #a267ff, #00f5d4)",
                margin: "0 auto 8px",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 24,
              }}>
                {(item.displayName || item.username)?.[0]?.toUpperCase() || '?'}
              </div>
              <div style={{ fontSize: 14, fontWeight: 600 }}>
                {highlight(item.displayName || item.username, q)}
              </div>
              <div style={{ fontSize: 12, color: "rgba(255,255,255,0.4)" }}>
                @{item.username || item.id?.slice(0, 8)}
              </div>
            </div>
          ))}
          {activeType === "live" && results.map((item: any) => (
            <div
              key={item.id}
              onClick={() => navigate(`/live/${item.id}`)}
              style={{
                padding: 16,
                background: "rgba(255,255,255,0.04)",
                border: "1px solid rgba(255,0,0,0.15)",
                borderRadius: 12,
                cursor: "pointer",
                transition: "all 0.2s",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                <span style={{
                  background: "#ff4444",
                  color: "#fff",
                  fontSize: 10,
                  fontWeight: 700,
                  padding: "2px 6px",
                  borderRadius: 4,
                }}>LIVE</span>
                <span style={{ fontSize: 16, fontWeight: 600 }}>
                  {highlight(item.title || item.name, q)}
                </span>
              </div>
              <div style={{ fontSize: 13, color: "rgba(255,255,255,0.5)" }}>
                {item.viewers || 0} watching
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
