// FILE: /video-platform/client-web/src/hooks/useVideoEntitlement.ts
/**
 * 视频权限检查 Hook
 * 检查用户对特定视频的访问权限和购买状态
 */

import { useState, useEffect, useCallback } from 'react';
import { getApiClient } from '../lib/apiClient';

const apiClient = getApiClient();

export interface StreamPurchaseProgress {
    paidUntilSeconds: number;   // 流支付已购买到的秒数
    totalDuration: number;      // 视频总时长
    remainingPrice: number;     // 剩余部分价格
}

export interface VideoEntitlement {
    isLoading: boolean;
    hasFullAccess: boolean;       // 是否有完整访问权限
    isCreator: boolean;           // 是否是创作者
    isFree: boolean;              // 是否免费视频
    purchasedWithPoints: boolean; // 是否已用积分购买
    streamPurchase: StreamPurchaseProgress | null;  // 流支付进度
    requiresPayment: boolean;     // 是否需要付费
    videoMeta: {
        title: string;
        pointsPrice: number;
        streamPricePerMinute: number;
        duration: number;
        creatorId: string;
        priceMode: 'free' | 'buy_once' | 'stream' | 'both';
    } | null;
}

export function useVideoEntitlement(videoId: string, userId: string): VideoEntitlement & {
    refresh: () => Promise<void>;
} {
    const [state, setState] = useState<VideoEntitlement>({
        isLoading: true,
        hasFullAccess: false,
        isCreator: false,
        isFree: true,
        purchasedWithPoints: false,
        streamPurchase: null,
        requiresPayment: false,
        videoMeta: null
    });

    const checkEntitlement = useCallback(async () => {
        if (!videoId || !userId) {
            setState(prev => ({ ...prev, isLoading: false }));
            return;
        }

        setState(prev => ({ ...prev, isLoading: true }));

        // Set JWT if available
        const jwt = sessionStorage.getItem('vp.jwt') || localStorage.getItem('jwt');
        if (jwt) {
            apiClient.setJWT(jwt);
        }

        try {
            // Fetch video metadata - returns T directly, not { data: T }
            interface VideoMetaResponse {
                title: string;
                pointsPrice?: number;
                streamPricePerMinute?: number;
                duration?: number;
                creatorId: string;
                priceMode?: 'free' | 'buy_once' | 'stream' | 'both';
            }
            const meta = await apiClient.get<VideoMetaResponse>(`/metadata/video/${videoId}`);

            if (!meta) {
                setState(prev => ({ ...prev, isLoading: false, requiresPayment: false }));
                return;
            }

            const isCreator = meta.creatorId === userId;
            const isFree = !meta.pointsPrice && !meta.streamPricePerMinute;
            const priceMode = meta.priceMode || (
                meta.pointsPrice && meta.streamPricePerMinute ? 'both' :
                    meta.pointsPrice ? 'buy_once' :
                        meta.streamPricePerMinute ? 'stream' : 'free'
            );

            // If free or creator, no need to check payment
            if (isFree || isCreator) {
                setState({
                    isLoading: false,
                    hasFullAccess: true,
                    isCreator,
                    isFree,
                    purchasedWithPoints: false,
                    streamPurchase: null,
                    requiresPayment: false,
                    videoMeta: {
                        title: meta.title,
                        pointsPrice: meta.pointsPrice || 0,
                        streamPricePerMinute: meta.streamPricePerMinute || 0,
                        duration: meta.duration || 0,
                        creatorId: meta.creatorId,
                        priceMode
                    }
                });
                return;
            }

            // Check payment status
            let purchasedWithPoints = false;
            let streamPurchase: StreamPurchaseProgress | null = null;

            try {
                // Check if user has entitlement (one-time purchase)
                interface EntitlementResponse {
                    hasAccess: boolean;
                    purchaseType?: string;
                }
                const entitlementRes = await apiClient.get<EntitlementResponse>(`/payment/entitlement/${videoId}`);

                if (entitlementRes?.hasAccess) {
                    purchasedWithPoints = entitlementRes.purchaseType === 'points';
                }

                // Check stream payment progress
                if (!purchasedWithPoints && priceMode !== 'buy_once') {
                    interface StreamHistoryResponse {
                        paidSeconds?: number;
                    }
                    const streamRes = await apiClient.get<StreamHistoryResponse>(`/payment/stream/history/${videoId}`);

                    if (streamRes?.paidSeconds && streamRes.paidSeconds > 0) {
                        streamPurchase = {
                            paidUntilSeconds: streamRes.paidSeconds,
                            totalDuration: meta.duration || 0,
                            remainingPrice: Math.ceil(((meta.duration || 0) - streamRes.paidSeconds) / 60) * (meta.streamPricePerMinute || 0)
                        };
                    }
                }
            } catch (e) {
                // Payment check failed, assume no purchase
                console.warn('Payment check failed:', e);
            }

            const hasFullAccess = purchasedWithPoints || (streamPurchase?.paidUntilSeconds || 0) >= (meta.duration || 0);
            const requiresPayment = !hasFullAccess && !isFree && !isCreator;

            setState({
                isLoading: false,
                hasFullAccess,
                isCreator,
                isFree,
                purchasedWithPoints,
                streamPurchase,
                requiresPayment,
                videoMeta: {
                    title: meta.title,
                    pointsPrice: meta.pointsPrice || 0,
                    streamPricePerMinute: meta.streamPricePerMinute || 0,
                    duration: meta.duration || 0,
                    creatorId: meta.creatorId,
                    priceMode
                }
            });
        } catch (error) {
            console.error('Failed to check video entitlement:', error);
            setState(prev => ({ ...prev, isLoading: false }));
        }
    }, [videoId, userId]);

    useEffect(() => {
        checkEntitlement();
    }, [checkEntitlement]);

    return { ...state, refresh: checkEntitlement };
}

/**
 * 计算团购折扣
 * @param participantCount 参与人数
 * @returns 折扣比例 (0.6 = 60% 折扣 = 实付 40%)
 */
export function calculateGroupDiscount(participantCount: number): { discount: number; percent: string } {
    if (participantCount >= 21) return { discount: 0.60, percent: '60%' };
    if (participantCount >= 11) return { discount: 0.70, percent: '70%' };
    if (participantCount >= 6) return { discount: 0.80, percent: '80%' };
    if (participantCount >= 4) return { discount: 0.90, percent: '90%' };
    if (participantCount >= 2) return { discount: 0.95, percent: '95%' };
    return { discount: 1.0, percent: '100%' };
}

/**
 * 计算团购总价
 */
export function calculateGroupPurchasePrice(
    pricePerPerson: number,
    participantCount: number
): {
    originalTotal: number;
    discount: number;
    finalTotal: number;
    perPersonAfterDiscount: number;
} {
    const { discount } = calculateGroupDiscount(participantCount);
    const originalTotal = pricePerPerson * participantCount;
    const finalTotal = Math.floor(originalTotal * discount);
    const perPersonAfterDiscount = Math.floor(finalTotal / participantCount);

    return {
        originalTotal,
        discount,
        finalTotal,
        perPersonAfterDiscount
    };
}

export default useVideoEntitlement;
