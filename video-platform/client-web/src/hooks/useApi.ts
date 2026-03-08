/**
 * API 缓存 Hooks (使用 React Query)
 * 
 * 特性:
 * - 自动缓存: 相同请求不重复发送
 * - stale-while-revalidate: 先显示缓存，后台刷新
 * - 自动重试: 失败后自动重试
 * - 焦点重新验证: 窗口聚焦时刷新 (已禁用以减少请求)
 */

import { useQuery, useMutation, useQueryClient, QueryClient } from '@tanstack/react-query';
import { getApiClient } from '../lib/apiClient';
import { useAuthStore, getAuth } from '../stores';

interface ApiErrorLike {
    status?: number;
    message?: string;
}

// 使用统一客户端（含 401/5xx 处理）
const getClient = () => {
    const client = getApiClient();
    const jwt = typeof window !== 'undefined' ? sessionStorage.getItem('vp.jwt') : null;
    if (jwt) client.setJWT(jwt);
    return client;
};

// 通用 fetcher / poster
const fetcher = async <T>(url: string): Promise<T> => {
    const client = getClient();
    return client.get<T>(url);
};

const poster = async <T>(url: string, data?: any): Promise<T> => {
    const client = getClient();
    return client.post<T>(url, data);
};

// 默认 React Query 配置 (used by all hooks below via ...defaultOptions)
const defaultOptions = {
    refetchOnWindowFocus: false,
    retry: (failureCount: number, error: unknown) => {
        if ((error as ApiErrorLike)?.status === 401) return false;
        return failureCount < 2;
    },
    retryDelay: (attempt: number) => Math.min(1000 * 2 ** attempt, 10000),
    staleTime: 60000,
};

// ============== 视频相关 Hooks ==============

/**
 * 获取推荐视频列表
 */
export function useRecommendations() {
    return useQuery({
        queryKey: ['recommendations'],
        queryFn: () => fetcher('/metadata/recommendations'),
        ...defaultOptions,
    });
}

/**
 * 获取热门视频列表
 */
export function useTrending() {
    return useQuery({
        queryKey: ['trending'],
        queryFn: () => fetcher('/metadata/trending'),
        ...defaultOptions,
    });
}

/**
 * 获取视频详情
 */
export function useVideoMeta(videoId: string | undefined) {
    return useQuery({
        queryKey: ['videoMeta', videoId],
        queryFn: () => fetcher(`/metadata/${videoId}`),
        ...defaultOptions,
        enabled: !!videoId,
    });
}

/**
 * 视频列表/搜索
 */
export function useVideoList(params?: { genre?: string; region?: string; language?: string }) {
    const searchParams = new URLSearchParams();
    if (params?.genre) searchParams.set('genre', params.genre);
    if (params?.region) searchParams.set('region', params.region);
    if (params?.language) searchParams.set('language', params.language);
    const query = searchParams.toString();
    const url = query ? `/metadata?${query}` : '/metadata';

    return useQuery({
        queryKey: ['videoList', query],
        queryFn: () => fetcher(url),
        ...defaultOptions,
    });
}

// ============== 用户相关 Hooks ==============

/**
 * 获取积分余额
 */
export function usePointsBalance() {
    return useQuery({
        queryKey: ['pointsBalance'],
        queryFn: () => fetcher('/payment/points/balance'),
        ...defaultOptions,
        refetchInterval: 30000,
    });
}

/**
 * 获取用户观看列表
 */
export function useWatchlist() {
    return useQuery({
        queryKey: ['watchlist'],
        queryFn: () => fetcher('/content/watchlist'),
        ...defaultOptions,
    });
}

/**
 * 获取继续观看列表
 */
export function useContinueWatching() {
    return useQuery({
        queryKey: ['continueWatching'],
        queryFn: () => fetcher('/content/continue'),
        ...defaultOptions,
    });
}

/**
 * 获取购买记录
 */
export function usePurchases() {
    return useQuery({
        queryKey: ['purchases'],
        queryFn: () => fetcher('/payment/purchases'),
        ...defaultOptions,
    });
}

// ============== 任务/成就/权益相关 Hooks ==============

/**
 * 获取任务列表 (所有可用任务)
 */
export function useTaskList() {
    return useQuery({
        queryKey: ['taskList'],
        queryFn: () => fetcher('/engagement/tasks'),
        ...defaultOptions,
    });
}

/**
 * 获取每日任务进度
 */
export function useDailyTasks() {
    const { user } = useAuthStore();
    return useQuery({
        queryKey: ['dailyTasks', user?.id],
        queryFn: () => fetcher<{ tasks: any[], streak: number, todayCheckedIn: boolean }>(`/engagement/tasks/daily?userId=${user?.id}`),
        ...defaultOptions,
        enabled: !!user?.id,
    });
}

/**
 * 领取任务奖励 Mutation
 */
export function useClaimTask() {
    const queryClient = useQueryClient();
    const { user } = useAuthStore();
    return useMutation({
        mutationFn: (taskType: string) => poster(`/engagement/tasks/claim`, { userId: user?.id, taskType }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['dailyTasks', user?.id] });
            queryClient.invalidateQueries({ queryKey: ['pointsBalance'] });
        },
    });
}

/**
 * 每日签到 Mutation
 */
export function useCheckin() {
    const queryClient = useQueryClient();
    const { user } = useAuthStore();
    return useMutation({
        mutationFn: () => poster(`/engagement/checkin`, { userId: user?.id }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['dailyTasks', user?.id] });
            queryClient.invalidateQueries({ queryKey: ['pointsBalance'] });
        },
    });
}

/**
 * 获取成就列表
 */
export function useAchievements() {
    return useQuery({
        queryKey: ['achievements'],
        queryFn: () => fetcher('/achievement/list'),
        ...defaultOptions,
    });
}

/**
 * 获取交易记录
 */
export function useTransactions() {
    return useQuery({
        queryKey: ['transactions'],
        queryFn: () => fetcher('/payment/transactions'),
        ...defaultOptions,
        staleTime: 30000,
    });
}

/**
 * 获取用户权益 (已购视频)
 */
export function useEntitlements() {
    return useQuery({
        queryKey: ['entitlements'],
        queryFn: () => fetcher('/content/entitlements/by-user/me'),
        ...defaultOptions,
    });
}

// ============== 创作者相关 Hooks ==============

/**
 * 获取创作者统计
 */
export function useCreatorStats() {
    return useQuery({
        queryKey: ['creatorStats'],
        queryFn: () => fetcher('/creator/stats'),
        ...defaultOptions,
        refetchInterval: 60000,
    });
}

/**
 * 获取创作者上传列表
 */
export function useCreatorUploads(status?: string) {
    const url = status ? `/creator/uploads?status=${status}` : '/creator/uploads';
    return useQuery({
        queryKey: ['creatorUploads', status],
        queryFn: () => fetcher(url),
        ...defaultOptions,
    });
}

// ============== 通知相关 Hooks ==============

/**
 * 获取通知列表
 */
export function useNotifications() {
    return useQuery({
        queryKey: ['notifications'],
        queryFn: () => fetcher('/notifications'),
        ...defaultOptions,
        refetchInterval: 120000,
    });
}

// ============== 直播相关 Hooks ==============

/**
 * 获取正在直播列表
 */
export function useLiveRooms() {
    return useQuery({
        queryKey: ['liveRooms'],
        queryFn: () => fetcher<any[]>('/live/rooms'),
        ...defaultOptions,
        refetchInterval: 30000,
    });
}

/**
 * 获取直播房间列表（/live/list，用于 Explore 页）
 */
export function useLiveList() {
    return useQuery({
        queryKey: ['liveList'],
        queryFn: () => fetcher<{ rooms: unknown[] }>('/live/list').then((r) => r?.rooms ?? []),
        ...defaultOptions,
        refetchInterval: 10000,
    });
}

// ============== 缓存管理 ==============

/**
 * 清除所有缓存
 */
export function useClearAllCache() {
    const queryClient = useQueryClient();
    return () => queryClient.clear();
}

/**
 * 刷新特定缓存
 */
export function useRefreshCache() {
    const queryClient = useQueryClient();
    return (key: string | string[]) =>
        queryClient.invalidateQueries({ queryKey: Array.isArray(key) ? key : [key] });
}

/**
 * 预加载数据
 */
export async function prefetchData(queryClient: QueryClient, keys: string[]) {
    const client = getClient();
    await Promise.all(keys.map(key =>
        queryClient.prefetchQuery({ queryKey: [key], queryFn: () => client.get(key) })
    ));
}

// ============== 组合 Hook ==============

/**
 * 首页数据预加载 Hook
 * 并行加载首页所有数据
 */
export function useHomeData() {
    const { data: recommendations, isLoading: loadingRec } = useRecommendations();
    const { data: trending, isLoading: loadingTrending } = useTrending();
    const { data: points, isLoading: loadingPoints } = usePointsBalance();
    const { data: watchlist, isLoading: loadingWatchlist } = useWatchlist();
    const { data: continueList, isLoading: loadingContinue } = useContinueWatching();
    const { data: notifications, isLoading: loadingNotifications } = useNotifications();

    return {
        recommendations: recommendations || [],
        trending: trending || [],
        points,
        watchlist: watchlist || [],
        continueList: continueList || [],
        notifications: notifications || [],
        isLoading: loadingRec || loadingTrending || loadingPoints,
        isFullyLoaded: !loadingRec && !loadingTrending && !loadingPoints && !loadingWatchlist && !loadingContinue && !loadingNotifications,
    };
}

/**
 * 探索页数据 Hook
 */
export function useExploreData(filters?: { genre?: string; region?: string; language?: string }) {
    const { data: videos, isLoading, error } = useVideoList(filters);
    const { data: trending } = useTrending();

    return {
        videos: videos || [],
        trending: trending || [],
        isLoading,
        error,
    };
}
