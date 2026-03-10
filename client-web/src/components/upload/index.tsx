/**
 * Upload Sub-Components
 * 
 * Extracted from CreatorUpload.tsx (54KB → split into reusable parts)
 * Import: import { UploadDropzone, UploadProgress, MetadataForm } from '../components/upload';
 */

import React, { useState, useCallback, useRef } from "react";

// ═══ Upload Dropzone ═══

interface UploadDropzoneProps {
    accept: string;
    maxSize: number; // bytes
    onFileSelect: (file: File) => void;
    disabled?: boolean;
}

export function UploadDropzone({ accept, maxSize, onFileSelect, disabled }: UploadDropzoneProps) {
    const [isDragging, setIsDragging] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);

    const handleDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
        const file = e.dataTransfer.files[0];
        if (file && file.size <= maxSize) onFileSelect(file);
    }, [maxSize, onFileSelect]);

    return (
        <div
            onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
            onClick={() => !disabled && inputRef.current?.click()}
            style={{
                border: `2px dashed ${isDragging ? "#6c5ce7" : "rgba(255,255,255,0.15)"}`,
                borderRadius: "16px",
                padding: "48px",
                textAlign: "center",
                cursor: disabled ? "not-allowed" : "pointer",
                background: isDragging ? "rgba(108,92,231,0.1)" : "rgba(255,255,255,0.02)",
                transition: "all 0.3s",
                opacity: disabled ? 0.5 : 1,
            }}>
            <div style={{ fontSize: "48px", marginBottom: "16px" }}>📁</div>
            <p style={{ color: "#aaa", fontSize: "16px", margin: 0 }}>
                拖拽文件到这里，或点击选择
            </p>
            <p style={{ color: "#666", fontSize: "13px", marginTop: "8px" }}>
                支持 {accept} · 最大 {(maxSize / 1024 / 1024).toFixed(0)}MB
            </p>
            <input ref={inputRef} type="file" accept={accept} hidden
                onChange={(e) => e.target.files?.[0] && onFileSelect(e.target.files[0])} />
        </div>
    );
}

// ═══ Upload Progress ═══

interface UploadProgressProps {
    filename: string;
    progress: number; // 0-100
    speed?: string;
    status: "uploading" | "processing" | "done" | "error";
    onCancel?: () => void;
}

export function UploadProgress({ filename, progress, speed, status, onCancel }: UploadProgressProps) {
    const statusColors = { uploading: "#6c5ce7", processing: "#fdcb6e", done: "#00b894", error: "#e17055" };
    const statusLabels = { uploading: "上传中", processing: "处理中", done: "完成", error: "失败" };

    return (
        <div style={{
            padding: "16px 20px", background: "rgba(255,255,255,0.03)",
            borderRadius: "12px", border: "1px solid rgba(255,255,255,0.08)",
        }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                <span style={{ color: "#eee", fontSize: "14px", fontWeight: 500 }}>{filename}</span>
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <span style={{ color: statusColors[status], fontSize: "12px" }}>{statusLabels[status]}</span>
                    {speed && <span style={{ color: "#888", fontSize: "12px" }}>{speed}</span>}
                    {status === "uploading" && onCancel && (
                        <button onClick={onCancel} style={{ background: "none", border: "none", color: "#e17055", cursor: "pointer", fontSize: "16px" }}>✕</button>
                    )}
                </div>
            </div>
            <div style={{ height: "4px", background: "#333", borderRadius: "2px", overflow: "hidden" }}>
                <div style={{
                    width: `${progress}%`, height: "100%",
                    background: `linear-gradient(90deg, ${statusColors[status]}, ${statusColors[status]}88)`,
                    transition: "width 0.3s ease",
                }} />
            </div>
        </div>
    );
}

// ═══ Metadata Form ═══

interface MetadataFormProps {
    title: string;
    description: string;
    tags: string[];
    category: string;
    visibility: "public" | "unlisted" | "private";
    onChange: (field: string, value: any) => void;
    categories: Array<{ id: string; label: string }>;
}

export function MetadataForm({ title, description, tags, category, visibility, onChange, categories }: MetadataFormProps) {
    const [tagInput, setTagInput] = useState("");

    const addTag = () => {
        const tag = tagInput.trim();
        if (tag && !tags.includes(tag)) {
            onChange("tags", [...tags, tag]);
            setTagInput("");
        }
    };

    const inputStyle: React.CSSProperties = {
        width: "100%", padding: "10px 14px",
        background: "rgba(255,255,255,0.05)",
        border: "1px solid rgba(255,255,255,0.1)",
        borderRadius: "8px", color: "#fff",
        fontSize: "14px", outline: "none",
    };

    return (
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            <div>
                <label style={{ color: "#aaa", fontSize: "13px", marginBottom: "6px", display: "block" }}>标题 *</label>
                <input value={title} onChange={(e) => onChange("title", e.target.value)}
                    placeholder="给你的内容一个吸引人的标题" style={inputStyle} />
            </div>

            <div>
                <label style={{ color: "#aaa", fontSize: "13px", marginBottom: "6px", display: "block" }}>描述</label>
                <textarea value={description} onChange={(e) => onChange("description", e.target.value)}
                    placeholder="描述你的内容..." rows={4}
                    style={{ ...inputStyle, resize: "vertical" }} />
            </div>

            <div>
                <label style={{ color: "#aaa", fontSize: "13px", marginBottom: "6px", display: "block" }}>标签</label>
                <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", marginBottom: "8px" }}>
                    {tags.map((tag) => (
                        <span key={tag} style={{
                            padding: "4px 10px", background: "rgba(108,92,231,0.2)",
                            borderRadius: "12px", fontSize: "12px", color: "#a29bfe",
                            cursor: "pointer",
                        }} onClick={() => onChange("tags", tags.filter((t) => t !== tag))}>
                            {tag} ✕
                        </span>
                    ))}
                </div>
                <input value={tagInput} onChange={(e) => setTagInput(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addTag())}
                    placeholder="输入标签后回车" style={inputStyle} />
            </div>

            <div style={{ display: "flex", gap: "16px" }}>
                <div style={{ flex: 1 }}>
                    <label style={{ color: "#aaa", fontSize: "13px", marginBottom: "6px", display: "block" }}>分类</label>
                    <select value={category} onChange={(e) => onChange("category", e.target.value)}
                        style={{ ...inputStyle, cursor: "pointer" }}>
                        {categories.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
                    </select>
                </div>
                <div style={{ flex: 1 }}>
                    <label style={{ color: "#aaa", fontSize: "13px", marginBottom: "6px", display: "block" }}>可见性</label>
                    <select value={visibility} onChange={(e) => onChange("visibility", e.target.value)}
                        style={{ ...inputStyle, cursor: "pointer" }}>
                        <option value="public">🌍 公开</option>
                        <option value="unlisted">🔗 不公开</option>
                        <option value="private">🔒 私密</option>
                    </select>
                </div>
            </div>
        </div>
    );
}
