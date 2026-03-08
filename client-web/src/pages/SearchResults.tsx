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
  results: VideoMeta[];
  processingTimeMs?: number;
}

export default function SearchResults() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const q = searchParams.get("q") || "";

  const [inputValue, setInputValue] = useState(q);
  const [results, setResults] = useState<VideoMeta[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  const doSearch = useCallback(async (term: string) => {
    if (!term.trim()) return;
    setLoading(true);
    setSearched(true);
    try {
      const res = await client.get<SearchResponse>(
        `/search?q=${encodeURIComponent(term.trim())}&type=video&limit=20`
      );
      setResults(res?.results || []);
      setTotal(res?.total || 0);
    } catch {
      setResults([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    setInputValue(q);
    if (q) doSearch(q);
  }, [q, doSearch]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = inputValue.trim();
    if (!trimmed) return;
    setSearchParams({ q: trimmed });
  };

  return (
    <div style={{ minHeight: "100vh", background: "#0A0A10", color: "#fff", padding: "24px 16px 100px" }}>
      {/* Search bar */}
      <form onSubmit={handleSubmit} style={{ maxWidth: 640, margin: "0 auto 32px" }}>
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
            placeholder="Search videos..."
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

      {/* Results header */}
      {searched && !loading && (
        <div style={{ maxWidth: 1200, margin: "0 auto 16px", color: "rgba(255,255,255,0.5)", fontSize: 14 }}>
          {total > 0
            ? `Found ${total} result${total !== 1 ? "s" : ""} for "${q}"`
            : `No results found for "${q}"`}
        </div>
      )}

      {/* Loading state */}
      {loading && (
        <div style={{ display: "flex", justifyContent: "center", padding: "60px 0" }}>
          <div style={{ color: "rgba(255,255,255,0.5)" }}>Searching...</div>
        </div>
      )}

      {/* Empty state */}
      {searched && !loading && results.length === 0 && (
        <div style={{ textAlign: "center", padding: "80px 20px" }}>
          <div style={{ fontSize: 48, marginBottom: 16, opacity: 0.3 }}>🔍</div>
          <div style={{ fontSize: 18, color: "rgba(255,255,255,0.6)", marginBottom: 8 }}>
            No results found
          </div>
          <div style={{ fontSize: 14, color: "rgba(255,255,255,0.3)" }}>
            Try different keywords or check the spelling
          </div>
        </div>
      )}

      {/* Results grid */}
      {results.length > 0 && (
        <div style={{
          maxWidth: 1200,
          margin: "0 auto",
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
          gap: 20,
        }}>
          {results.map((video, i) => (
            <VideoCard
              key={video.id}
              video={video}
              index={i}
              onClick={() => navigate(`/player/${video.id}`)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
