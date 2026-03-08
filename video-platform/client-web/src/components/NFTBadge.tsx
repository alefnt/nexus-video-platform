// FILE: /video-platform/client-web/src/components/NFTBadge.tsx
/**
 * NFT Badge Display Component
 * 
 * 用于在视频卡片和播放器上显示 NFT 状态徽章：
 * - "On-Chain Certified" 所有权认证
 * - "Limited #N/100" 限量版编号
 * - "SOLD OUT" 售罄标识
 */

import React from "react";

interface NFTBadgeProps {
    type: 'ownership' | 'limited' | 'sold-out' | 'access-pass';
    editionNumber?: number;
    maxEditions?: number;
    size?: 'small' | 'medium' | 'large';
}

export default function NFTBadge({ type, editionNumber, maxEditions, size = 'medium' }: NFTBadgeProps) {
    const sizeStyles = {
        small: { padding: "2px 6px", fontSize: 10, gap: 3 },
        medium: { padding: "4px 10px", fontSize: 12, gap: 4 },
        large: { padding: "6px 14px", fontSize: 14, gap: 5 },
    };

    const styles = sizeStyles[size];

    const getBadgeContent = () => {
        switch (type) {
            case 'ownership':
                return {
                    icon: '⛓️',
                    label: 'On-Chain Certified',
                    background: 'linear-gradient(135deg, #10B981, #059669)',
                    border: 'rgba(16, 185, 129, 0.5)',
                };
            case 'limited':
                return {
                    icon: '💎',
                    label: `Limited #${editionNumber}/${maxEditions}`,
                    background: 'linear-gradient(135deg, #8B5CF6, #7C3AED)',
                    border: 'rgba(139, 92, 246, 0.5)',
                };
            case 'sold-out':
                return {
                    icon: '🔥',
                    label: 'SOLD OUT',
                    background: 'linear-gradient(135deg, #EF4444, #DC2626)',
                    border: 'rgba(239, 68, 68, 0.5)',
                };
            case 'access-pass':
                return {
                    icon: '🎫',
                    label: 'Access NFT',
                    background: 'linear-gradient(135deg, #0EA5E9, #0284C7)',
                    border: 'rgba(14, 165, 233, 0.5)',
                };
            default:
                return {
                    icon: '📦',
                    label: 'NFT',
                    background: 'rgba(100,100,100,0.5)',
                    border: 'rgba(100,100,100,0.3)',
                };
        }
    };

    const badge = getBadgeContent();

    return (
        <div
            className="nft-badge"
            style={{
                display: "inline-flex",
                alignItems: "center",
                gap: styles.gap,
                padding: styles.padding,
                borderRadius: 20,
                background: badge.background,
                border: `1px solid ${badge.border}`,
                fontSize: styles.fontSize,
                fontWeight: 600,
                color: "#fff",
                boxShadow: "0 2px 8px rgba(0,0,0,0.3)",
                whiteSpace: "nowrap",
            }}
        >
            <span>{badge.icon}</span>
            <span>{badge.label}</span>
        </div>
    );
}

// 用于视频卡片上的简洁版徽章组合
interface VideoNFTBadgesProps {
    hasOwnership?: boolean;
    isLimited?: boolean;
    editionNumber?: number;
    maxEditions?: number;
    mintedCount?: number;
    hasAccessPass?: boolean;
}

export function VideoNFTBadges({
    hasOwnership,
    isLimited,
    editionNumber,
    maxEditions,
    mintedCount,
    hasAccessPass
}: VideoNFTBadgesProps) {
    const isSoldOut = isLimited && mintedCount !== undefined && maxEditions !== undefined && mintedCount >= maxEditions;

    return (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {hasOwnership && <NFTBadge type="ownership" size="small" />}
            {isLimited && !isSoldOut && (
                <NFTBadge
                    type="limited"
                    editionNumber={editionNumber}
                    maxEditions={maxEditions}
                    size="small"
                />
            )}
            {isSoldOut && <NFTBadge type="sold-out" size="small" />}
            {hasAccessPass && <NFTBadge type="access-pass" size="small" />}
        </div>
    );
}
