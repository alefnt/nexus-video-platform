// FILE: /client-web/src/components/StreamPaymentModal.tsx
/**
 * 流支付说明弹窗组件
 * 替换 confirm 对话框，提供更好的用户体验
 */

import React from "react";
import "../styles/fun.css";

interface StreamPaymentDisclosureProps {
    videoDuration: number;
    segmentMinutes: number;
    segmentAmount: number;
    totalSegments: number;
    pricePerMinute: number;
    onConfirm: () => void;
    onCancel: () => void;
}

export function StreamPaymentDisclosureModal({
    videoDuration,
    segmentMinutes,
    segmentAmount,
    totalSegments,
    pricePerMinute,
    onConfirm,
    onCancel,
}: StreamPaymentDisclosureProps) {
    const minutes = Math.floor(videoDuration / 60);
    const estimatedTotal = segmentAmount * totalSegments;

    return (
        <div className="modal-overlay" onClick={onCancel}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 500 }}>
                <h2 style={{ marginBottom: 20, fontSize: 24 }}>流支付说明</h2>

                <div style={{ marginBottom: 20, padding: 15, backgroundColor: "#f5f5f5", borderRadius: 8 }}>
                    <div style={{ marginBottom: 10 }}>
                        <strong>视频总时长：</strong>{minutes} 分钟
                    </div>
                    <div style={{ marginBottom: 10 }}>
                        <strong>分段策略：</strong>每 {segmentMinutes} 分钟一段
                    </div>
                    <div style={{ marginBottom: 10 }}>
                        <strong>总共分段：</strong>{totalSegments} 段
                    </div>
                    <div style={{ marginBottom: 10 }}>
                        <strong>每段费用：</strong>{segmentAmount} Points
                    </div>
                    <div style={{ fontSize: 18, fontWeight: "bold", color: "#1976d2" }}>
                        <strong>预计总费用：</strong>{estimatedTotal} Points
                    </div>
                </div>

                <div style={{ marginBottom: 20, padding: 15, backgroundColor: "#e3f2fd", borderRadius: 8, fontSize: 14 }}>
                    <p style={{ marginBottom: 10, fontWeight: "bold" }}>说明：</p>
                    <ul style={{ paddingLeft: 20, margin: 0 }}>
                        <li>每段播放结束时，视频会暂停并询问您是否继续观看下一段</li>
                        <li>您可以随时停止观看，只需支付已观看部分的费用</li>
                        <li style={{ color: "#1976d2", fontWeight: "bold" }}>已支付的段落下次观看时无需重复支付</li>
                    </ul>
                </div>

                <div style={{ display: "flex", gap: 10 }}>
                    <button
                        className="button"
                        onClick={onConfirm}
                        style={{ flex: 1, backgroundColor: "#4caf50", color: "white" }}
                    >
                        确认并开始观看
                    </button>
                    <button
                        className="button"
                        onClick={onCancel}
                        style={{ flex: 1, backgroundColor: "#9e9e9e", color: "white" }}
                    >
                        取消
                    </button>
                </div>
            </div>
        </div>
    );
}

interface StreamResumePromptProps {
    paidSegments: number[];
    totalSegments: number;
    resumeFromSegment: number;
    segmentMinutes: number;
    onResume: () => void;
    onStartOver: () => void;
}

export function StreamResumePromptModal({
    paidSegments,
    totalSegments,
    resumeFromSegment,
    segmentMinutes,
    onResume,
    onStartOver,
}: StreamResumePromptProps) {
    const paidCount = paidSegments.length;
    const resumeTime = (resumeFromSegment - 1) * segmentMinutes;
    const resumeMinutes = Math.floor(resumeTime / 60);
    const resumeSeconds = resumeTime % 60;

    return (
        <div className="modal-overlay" onClick={onStartOver}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 500 }}>
                <h2 style={{ marginBottom: 20, fontSize: 24 }}>检测到观看记录</h2>

                <div style={{ marginBottom: 20, padding: 15, backgroundColor: "#e8f5e9", borderRadius: 8 }}>
                    <div style={{ marginBottom: 10 }}>
                        <strong>您已支付：</strong>第 {paidSegments.join(", ")} 段（共 {paidCount} 段）
                    </div>
                    <div style={{ marginBottom: 10 }}>
                        <strong>上次观看到：</strong>第 {resumeFromSegment - 1} 段结束
                    </div>
                    <div style={{ fontSize: 16, color: "#2e7d32", fontWeight: "bold" }}>
                        可从 {resumeMinutes} 分 {resumeSeconds} 秒处继续
                    </div>
                </div>

                <div style={{ marginBottom: 20, padding: 15, backgroundColor: "#fff3e0", borderRadius: 8, fontSize: 14 }}>
                    <p style={{ margin: 0, color: "#e65100", fontWeight: "bold" }}>
                        ✨ 已支付的段落无需重复付费，可直接观看！
                    </p>
                </div>

                <div style={{ display: "flex", gap: 10 }}>
                    <button
                        className="button"
                        onClick={onResume}
                        style={{ flex: 1, backgroundColor: "#4caf50", color: "white" }}
                    >
                        继续观看
                    </button>
                    <button
                        className="button"
                        onClick={onStartOver}
                        style={{ flex: 1, backgroundColor: "#9e9e9e", color: "white" }}
                    >
                        从头开始
                    </button>
                </div>
            </div>
        </div>
    );
}

interface StreamContinuationPromptProps {
    currentSegment: number;
    totalSegments: number;
    nextSegmentMinutes: number;
    nextSegmentAmount: number;
    onContinue: () => void;
    onStop: () => void;
}

export function StreamContinuationPromptModal({
    currentSegment,
    totalSegments,
    nextSegmentMinutes,
    nextSegmentAmount,
    onContinue,
    onStop,
}: StreamContinuationPromptProps) {
    const remaining = totalSegments - currentSegment;

    return (
        <div className="modal-overlay" onClick={onStop}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 500 }}>
                <h2 style={{ marginBottom: 20, fontSize: 24 }}>第 {currentSegment} 段已结束</h2>

                <div style={{ marginBottom: 20, padding: 15, backgroundColor: "#e3f2fd", borderRadius: 8 }}>
                    <div style={{ marginBottom: 10, fontSize: 18 }}>
                        是否继续观看第 <strong>{currentSegment + 1}</strong> 段？
                    </div>
                    <div style={{ marginBottom: 10 }}>
                        <strong>时长：</strong>{nextSegmentMinutes} 分钟
                    </div>
                    <div style={{ marginBottom: 10 }}>
                        <strong>费用：</strong>{nextSegmentAmount} Points
                    </div>
                    <div style={{ color: "#666" }}>
                        剩余：{remaining} 段
                    </div>
                </div>

                <div style={{ display: "flex", gap: 10 }}>
                    <button
                        className="button"
                        onClick={onContinue}
                        style={{ flex: 1, backgroundColor: "#4caf50", color: "white" }}
                    >
                        继续观看
                    </button>
                    <button
                        className="button"
                        onClick={onStop}
                        style={{ flex: 1, backgroundColor: "#ff9800", color: "white" }}
                    >
                        稍后再看
                    </button>
                </div>
            </div>
        </div>
    );
}
