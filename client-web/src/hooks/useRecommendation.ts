/**
 * 推荐系统 Hooks
 * 
 * useRecommendationFeed - 获取个性化推荐 Feed (无限滚动)
 * useTrending - 获取趋势内容
 * useSimilar - 获取相似内容
 */

import { useState, useEffect, useCallback, useRef } from "react";
import { getApiClient } from "../lib/apiClient";
import { useAuthStore } from "../stores";

interface VideoItem {
    id: string;
    title: string;
    coverUrl: string | null;
    videoUrl: string;
    duration: number;
    views: number;
    likes: number;
    commentCount: number;
    tags: string[];
    contentType: string;
    createdAt: string;
    recommendSource?: string;
    creator: {
        id: string;
        username: string | null;
        avatarUrl: string | null;
    };
}

interface FeedResponse {
    items: VideoItem[];
    page: number;
    pageSize: number;
    hasMore: boolean;
}

/**
 * 个性化推荐 Feed（支持无限滚动）
 */
export function useRecommendationFeed(contentType: string = "video", pageSize: number = 20) {
    const [items, setItems] = useState<VideoItem[]>([]);
    const [page, setPage] = useState(1);
    const [loading, setLoading] = useState(false);
    const [hasMore, setHasMore] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const loadingRef = useRef(false);
    const user = useAuthStore((s) => s.user);
    const api = getApiClient();

    const loadPage = useCallback(
        async (pageNum: number, append: boolean = true) => {
            if (loadingRef.current) return;
            loadingRef.current = true;
            setLoading(true);
            setError(null);

            try {
                const params = new URLSearchParams({
                    page: String(pageNum),
                    pageSize: String(pageSize),
                    contentType,
                });
                if (user?.id) params.set("userId", user.id);

                const data = await api.get<FeedResponse>(
                    `/api/recommendation/feed?${params.toString()}`
                );

                if (append && pageNum > 1) {
                    setItems((prev) => [...prev, ...data.items]);
                } else {
                    setItems(data.items);
                }
                setHasMore(data.hasMore);
                setPage(pageNum);
            } catch (err: any) {
                setError(err?.message || "加载推荐失败");
            } finally {
                setLoading(false);
                loadingRef.current = false;
            }
        },
        [user?.id, contentType, pageSize]
    );

    // 初始加载
    useEffect(() => {
        loadPage(1, false);
    }, [loadPage]);

    const loadMore = useCallback(() => {
        if (!loading && hasMore) {
            loadPage(page + 1, true);
        }
    }, [loading, hasMore, page, loadPage]);

    const refresh = useCallback(() => {
        setItems([]);
        setPage(1);
        setHasMore(true);
        loadPage(1, false);
    }, [loadPage]);

    return { items, loading, hasMore, error, loadMore, refresh };
}

/**
 * 趋势内容
 */
export function useTrending(hours: number = 24, limit: number = 20, contentType: string = "video") {
    const [items, setItems] = useState<VideoItem[]>([]);
    const [loading, setLoading] = useState(true);
    const api = getApiClient();

    useEffect(() => {
        const params = new URLSearchParams({
            hours: String(hours),
            limit: String(limit),
            contentType,
        });
        api.get<{ items: VideoItem[] }>(`/api/recommendation/trending?${params}`)
            .then((data) => setItems(data.items))
            .catch(() => setItems([]))
            .finally(() => setLoading(false));
    }, [hours, limit, contentType]);

    return { items, loading };
}

/**
 * 相似内容推荐
 */
export function useSimilar(videoId: string | undefined, limit: number = 10) {
    const [items, setItems] = useState<VideoItem[]>([]);
    const [loading, setLoading] = useState(false);
    const api = getApiClient();

    useEffect(() => {
        if (!videoId) return;
        setLoading(true);
        api.get<{ items: VideoItem[] }>(`/api/recommendation/similar/${videoId}?limit=${limit}`)
            .then((data) => setItems(data.items))
            .catch(() => setItems([]))
            .finally(() => setLoading(false));
    }, [videoId, limit]);

    return { items, loading };
}

/**
 * 发送推荐反馈 (用于改进推荐质量)
 */
export function useRecommendationFeedback() {
    const user = useAuthStore((s) => s.user);
    const api = getApiClient();

    const reportClick = useCallback(
        (videoId: string) => {
            if (!user?.id) return;
            api.post("/api/recommendation/feedback", {
                userId: user.id,
                videoId,
                action: "click",
            }).catch(() => { }); // 静默失败
        },
        [user?.id]
    );

    const reportWatch = useCallback(
        (videoId: string, watchTime: number) => {
            if (!user?.id) return;
            api.post("/api/recommendation/feedback", {
                userId: user.id,
                videoId,
                action: "watch",
                watchTime,
            }).catch(() => { });
        },
        [user?.id]
    );

    const reportComplete = useCallback(
        (videoId: string) => {
            if (!user?.id) return;
            api.post("/api/recommendation/feedback", {
                userId: user.id,
                videoId,
                action: "complete",
            }).catch(() => { });
        },
        [user?.id]
    );

    return { reportClick, reportWatch, reportComplete };
}
