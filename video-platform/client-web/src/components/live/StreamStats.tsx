/**
 * StreamStats — 科幻风实时仪表盘组件
 *
 * 灵感来源：Fitting Pad 飞船属性面板
 * 特点：
 *  - 渐变进度条 + 霓虹发光
 *  - 数值平滑动画（useAnimatedValue）
 *  - 底部能量行摘要
 */

import React from 'react';
import { useAnimatedValues } from '../hooks/useAnimatedValue';
import '../styles/stream-stats.css';

export interface StreamStatsData {
    viewers: number;
    totalTips: number;
    chatRate: number;       // 弹幕/分钟
    likes: number;
    duration: number;       // 直播时长(分钟)
    quality: number;        // 画质评分 0~100
}

interface StatBarConfig {
    label: string;
    key: keyof StreamStatsData;
    max: number;
    color: 'purple' | 'cyan' | 'gold' | 'pink' | 'blue' | 'green';
    unit?: string;
}

const DEFAULT_BARS: StatBarConfig[] = [
    { label: '观众', key: 'viewers', max: 500, color: 'cyan' },
    { label: '打赏', key: 'totalTips', max: 5000, color: 'gold', unit: 'PTS' },
    { label: '互动', key: 'chatRate', max: 60, color: 'pink', unit: '/m' },
    { label: '点赞', key: 'likes', max: 1000, color: 'purple' },
    { label: '时长', key: 'duration', max: 120, color: 'blue', unit: 'min' },
    { label: '画质', key: 'quality', max: 100, color: 'green', unit: '%' },
];

interface StreamStatsProps {
    data: Partial<StreamStatsData>;
    bars?: StatBarConfig[];
    showPowerLine?: boolean;
    className?: string;
}

export function StreamStats({
    data,
    bars = DEFAULT_BARS,
    showPowerLine = true,
    className = '',
}: StreamStatsProps) {
    // 使用 useAnimatedValues 批量平滑动画
    const fullData: StreamStatsData = {
        viewers: data.viewers ?? 0,
        totalTips: data.totalTips ?? 0,
        chatRate: data.chatRate ?? 0,
        likes: data.likes ?? 0,
        duration: data.duration ?? 0,
        quality: data.quality ?? 0,
    };

    const animated = useAnimatedValues(fullData, 0.12);

    return (
        <div className={`stream-stats glass-panel ${className}`}>
            <div className="stream-stats-header">
                <span className="stream-stats-dot" />
                <span>System Stats</span>
            </div>

            <div className="stream-stats-grid">
                {bars.map((bar) => {
                    const rawValue = animated[bar.key];
                    const pct = Math.min(100, (rawValue / bar.max) * 100);
                    return (
                        <div className="stat-row" key={bar.key}>
                            <span className="stat-label">{bar.label}</span>
                            <span className="stat-value">
                                {rawValue >= 1000
                                    ? `${(rawValue / 1000).toFixed(1)}k`
                                    : Math.round(rawValue)}
                                {bar.unit ? ` ${bar.unit}` : ''}
                            </span>
                            <div className="stat-bar">
                                <span
                                    className={`stat-bar-fill stat-bar-${bar.color}`}
                                    style={{ width: `${pct}%` }}
                                />
                            </div>
                        </div>
                    );
                })}
            </div>

            {showPowerLine && (
                <div className="stream-power-line">
                    👁 {Math.round(animated.viewers)} · 💰 {Math.round(animated.totalTips)} PTS · 💬 {Math.round(animated.chatRate)}/m
                </div>
            )}
        </div>
    );
}

export default StreamStats;
