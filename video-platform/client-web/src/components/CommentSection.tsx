// FILE: /video-platform/client-web/src/components/CommentSection.tsx
/**
 * Nexus Video - 评论与社交组件
 * 
 * 功能：
 * - 社交按钮组（点赞/浏览/评论/转发）
 * - 嵌套评论（最多 3 层）
 * - 评论输入框
 * - IPFS 存储评论（可选）
 */

import React, { useState, useEffect } from "react";
import { getApiClient } from "../lib/apiClient";
import { Heart, Eye, MessageCircle, Share2, Sparkles } from "lucide-react";

const client = getApiClient();

interface Comment {
    id: string;
    author: string;        // CKB 地址
    content: string;
    timestamp: number;
    likes: number;
    replies?: Comment[];
}

interface SocialStats {
    likes: number;
    views: number;
    comments: number;
    shares: number;
}

interface CommentSectionProps {
    videoId: string;
    creatorAddress?: string;
    initialStats?: Partial<SocialStats>;
    onLike?: () => void;
    onShare?: () => void;
}

export function CommentSection({
    videoId,
    creatorAddress,
    initialStats = {},
    onLike,
    onShare,
}: CommentSectionProps) {
    const [stats, setStats] = useState<SocialStats>({
        likes: initialStats.likes || 0,
        views: initialStats.views || 0,
        comments: initialStats.comments || 0,
        shares: initialStats.shares || 0,
    });
    const [comments, setComments] = useState<Comment[]>([]);
    const [newComment, setNewComment] = useState("");
    const [isLiked, setIsLiked] = useState(false);
    const [showComments, setShowComments] = useState(false);
    const [loading, setLoading] = useState(false);
    const [replyTo, setReplyTo] = useState<string | null>(null);

    // 获取评论
    useEffect(() => {
        if (showComments && comments.length === 0) {
            fetchComments();
        }
    }, [showComments]);

    const fetchComments = async () => {
        setLoading(true);
        try {
            const res = await client.get<{ comments: Comment[] }>(
                `/content/video/${videoId}/comments`
            );
            setComments(res.comments || []);
        } catch (e) {
            console.error("Failed to fetch comments:", e);
        } finally {
            setLoading(false);
        }
    };

    // 点赞
    const handleLike = () => {
        setIsLiked(!isLiked);
        setStats((prev) => ({
            ...prev,
            likes: prev.likes + (isLiked ? -1 : 1),
        }));
        if (onLike) onLike();
    };

    // 转发
    const handleShare = async () => {
        try {
            await navigator.share?.({
                title: "Nexus Video",
                url: `${window.location.origin}/#/player/${videoId}`,
            });
            setStats((prev) => ({ ...prev, shares: prev.shares + 1 }));
            if (onShare) onShare();
        } catch {
            // 复制链接
            await navigator.clipboard?.writeText(
                `${window.location.origin}/#/player/${videoId}`
            );
            alert("链接已复制到剪贴板");
        }
    };

    // 发送评论
    const handleSubmitComment = async () => {
        if (!newComment.trim()) return;

        try {
            const user = JSON.parse(sessionStorage.getItem("vp.user") || "{}");
            const newCommentObj: Comment = {
                id: `c_${Date.now()}`,
                author: user.ckbAddress || "匿名",
                content: newComment,
                timestamp: Date.now(),
                likes: 0,
            };

            // 发送到服务器
            await client.post(`/content/video/${videoId}/comments`, {
                content: newComment,
                replyTo,
            });

            if (replyTo) {
                // 添加为回复
                setComments((prev) =>
                    prev.map((c) =>
                        c.id === replyTo
                            ? { ...c, replies: [...(c.replies || []), newCommentObj] }
                            : c
                    )
                );
            } else {
                // 添加为顶级评论
                setComments((prev) => [newCommentObj, ...prev]);
            }

            setNewComment("");
            setReplyTo(null);
            setStats((prev) => ({ ...prev, comments: prev.comments + 1 }));
        } catch (e) {
            console.error("Failed to post comment:", e);
        }
    };

    // 格式化数字
    const formatNumber = (n: number): string => {
        if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
        if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
        return n.toString();
    };

    // 格式化时间
    const formatTime = (ts: number): string => {
        const diff = Date.now() - ts;
        if (diff < 60000) return "刚刚";
        if (diff < 3600000) return `${Math.floor(diff / 60000)} 分钟前`;
        if (diff < 86400000) return `${Math.floor(diff / 3600000)} 小时前`;
        return `${Math.floor(diff / 86400000)} 天前`;
    };

    // 格式化地址
    const formatAddress = (addr: string): string => {
        if (addr === "匿名") return addr;
        return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
    };

    return (
        <div className="comment-section">
            {/* 社交按钮组 */}
            <div className="social-bar">
                <button
                    className={`social-btn ${isLiked ? "active" : ""}`}
                    onClick={handleLike}
                >
                    <span className="icon">{isLiked ? "❤️" : "🤍"}</span>
                    <span className="count">{formatNumber(stats.likes)}</span>
                </button>

                <button className="social-btn">
                    <span className="icon">👁️</span>
                    <span className="count">{formatNumber(stats.views)}</span>
                </button>

                <button
                    className="social-btn"
                    onClick={() => setShowComments(!showComments)}
                    aria-label="评论"
                >
                    <span className="icon"><MessageCircle size={20} /></span>
                    <span className="count">{formatNumber(stats.comments)}</span>
                </button>

                <button className="social-btn" onClick={handleShare} aria-label="分享">
                    <span className="icon"><Share2 size={20} /></span>
                    <span className="count">{formatNumber(stats.shares)}</span>
                </button>
            </div>

            {/* 评论区 */}
            {showComments && (
                <div className="comments-panel glass-card">
                    <h3 style={{ marginBottom: 16 }}>
                        评论 ({stats.comments})
                    </h3>

                    {/* 评论输入框 */}
                    <div className="comment-input-box">
                        {replyTo && (
                            <div
                                className="reply-hint"
                                style={{
                                    fontSize: 12,
                                    color: "var(--accent-cyan)",
                                    marginBottom: 8,
                                }}
                            >
                                回复中...{" "}
                                <button
                                    onClick={() => setReplyTo(null)}
                                    style={{
                                        background: "none",
                                        border: "none",
                                        color: "var(--text-muted)",
                                        cursor: "pointer",
                                    }}
                                >
                                    ✕ 取消
                                </button>
                            </div>
                        )}
                        <div style={{ display: "flex", gap: 8 }}>
                            <input
                                type="text"
                                className="input"
                                placeholder="发表评论..."
                                value={newComment}
                                onChange={(e) => setNewComment(e.target.value)}
                                onKeyDown={(e) => e.key === "Enter" && handleSubmitComment()}
                                style={{ flex: 1 }}
                            />
                            <button className="btn-neon" onClick={handleSubmitComment}>
                                发送
                            </button>
                        </div>
                    </div>

                    {/* 评论列表 */}
                    <div className="comments-list" style={{ marginTop: 16 }}>
                        {loading ? (
                            <div className="skeleton" style={{ height: 60 }} />
                        ) : comments.length === 0 ? (
                            <div
                                style={{
                                    textAlign: "center",
                                    color: "var(--text-muted)",
                                    padding: 32,
                                }}
                            >
                                暂无评论，来发表第一条吧 <Sparkles size={16} style={{ marginLeft: 4, verticalAlign: 'middle' }} />
                            </div>
                        ) : (
                            comments.map((comment) => (
                                <CommentItem
                                    key={comment.id}
                                    comment={comment}
                                    depth={0}
                                    onReply={() => setReplyTo(comment.id)}
                                    formatTime={formatTime}
                                    formatAddress={formatAddress}
                                />
                            ))
                        )}
                    </div>
                </div>
            )}

            {/* 样式 */}
            <style>{`
        .comment-section {
          margin-top: 16px;
        }

        .social-bar {
          display: flex;
          justify-content: space-around;
          padding: 12px 0;
          border-top: 1px solid var(--border-subtle);
          border-bottom: 1px solid var(--border-subtle);
        }

        .social-btn {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 4px;
          background: transparent;
          border: none;
          cursor: pointer;
          padding: 8px 16px;
          border-radius: var(--radius-sm);
          transition: all 0.2s;
        }

        .social-btn:hover {
          background: var(--bg-elevated);
        }

        .social-btn.active .icon {
          animation: pulse 0.3s ease;
        }

        .social-btn .icon {
          font-size: 24px;
        }

        .social-btn .count {
          font-size: 12px;
          color: var(--text-muted);
        }

        .comments-panel {
          margin-top: 16px;
          max-height: 400px;
          overflow-y: auto;
        }

        .comment-item {
          padding: 12px 0;
          border-bottom: 1px solid var(--border-subtle);
        }

        .comment-item:last-child {
          border-bottom: none;
        }

        .comment-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 6px;
        }

        .comment-author {
          font-weight: 600;
          color: var(--accent-purple);
          font-size: 13px;
        }

        .comment-time {
          font-size: 11px;
          color: var(--text-muted);
        }

        .comment-content {
          font-size: 14px;
          line-height: 1.5;
          color: var(--text-primary);
        }

        .comment-actions {
          display: flex;
          gap: 12px;
          margin-top: 8px;
        }

        .comment-action {
          font-size: 12px;
          color: var(--text-muted);
          background: none;
          border: none;
          cursor: pointer;
          padding: 4px 8px;
          border-radius: 4px;
        }

        .comment-action:hover {
          color: var(--accent-cyan);
          background: rgba(0, 245, 212, 0.1);
        }

        .replies {
          margin-left: 24px;
          padding-left: 12px;
          border-left: 2px solid var(--border-subtle);
        }

        @keyframes pulse {
          0% { transform: scale(1); }
          50% { transform: scale(1.3); }
          100% { transform: scale(1); }
        }
      `}</style>
        </div>
    );
}

// 单条评论组件
function CommentItem({
    comment,
    depth,
    onReply,
    formatTime,
    formatAddress,
}: {
    comment: Comment;
    depth: number;
    onReply: () => void;
    formatTime: (ts: number) => string;
    formatAddress: (addr: string) => string;
}) {
    const [liked, setLiked] = useState(false);
    const maxDepth = 3;

    return (
        <div className="comment-item">
            <div className="comment-header">
                <span className="comment-author">{formatAddress(comment.author)}</span>
                <span className="comment-time">{formatTime(comment.timestamp)}</span>
            </div>
            <div className="comment-content">{comment.content}</div>
            <div className="comment-actions">
                <button
                    className="comment-action"
                    onClick={() => setLiked(!liked)}
                >
                    {liked ? "❤️" : "🤍"} {comment.likes + (liked ? 1 : 0)}
                </button>
                {depth < maxDepth && (
                    <button className="comment-action" onClick={onReply}>
                        <MessageCircle size={14} style={{ marginRight: 4, verticalAlign: 'middle' }} /> 回复
                    </button>
                )}
            </div>

            {/* 嵌套回复 */}
            {comment.replies && comment.replies.length > 0 && (
                <div className="replies">
                    {comment.replies.map((reply) => (
                        <CommentItem
                            key={reply.id}
                            comment={reply}
                            depth={depth + 1}
                            onReply={onReply}
                            formatTime={formatTime}
                            formatAddress={formatAddress}
                        />
                    ))}
                </div>
            )}
        </div>
    );
}

export default CommentSection;
