/**
 * Nexus Video - 共享 Hooks
 * 
 * 统一导出所有自定义 hooks
 */

// API 相关
export {
    useRecommendations,
    useTrending,
    useVideoMeta,
    useVideoList,
    usePointsBalance,
    useWatchlist,
    useContinueWatching,
    usePurchases,
    useCreatorStats,
    useCreatorUploads,
    useNotifications,
    useLiveRooms,
    clearAllCache,
    refreshCache,
    prefetchData,
    useHomeData,
    useExploreData,
} from './useApi';

// 认证
export { useAuth } from './useAuth';

// 视频权限
export { useVideoEntitlement, calculateGroupDiscount, calculateGroupPurchasePrice } from './useVideoEntitlement';

// 流支付
export { useStreamMeter } from './useStreamMeter';

// 音效
export { useSound } from './useSound';

// 一起看同步
export { useWatchPartySync } from './useWatchPartySync';

// 平滑数值动画（借鉴 Fitting Pad 的指数衰减插值）
export { useAnimatedValue, useAnimatedValues } from './useAnimatedValue';

// 直播间状态管理（快照模式）
export { useLiveRoom } from './useLiveRoom';
export type { LiveRoomSnapshot, LiveRoomActions, LiveRoomStatus } from './useLiveRoom';

// WebSocket 实时通知
export { useWebSocket } from './useWebSocket';

// 用户偏好设置
export { usePreferences } from './usePreferences';

// 统一支付
export { usePayment } from './usePayment';
export type { UsePaymentOptions, UsePaymentReturn, ContentType, PriceMode, BuyOnceResult } from './usePayment';
