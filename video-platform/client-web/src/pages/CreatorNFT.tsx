// FILE: /video-platform/client-web/src/pages/CreatorNFT.tsx
/**
 * 创作...NFT 发行页面
 * 功能：创作者发行自己的专属通行证，设置权益和价...
 */

import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { getApiClient } from "../lib/apiClient";

const client = getApiClient();

interface CreatorPass {
    clusterId: string;
    name: string;
    description?: string;
    maxSupply: number;
    price: number;
    benefits: string[];
    royaltyPercent: number;
    mintedCount: number;
    createdAt: string;
}

export default function CreatorNFT() {
    const navigate = useNavigate();
    const [myPasses, setMyPasses] = useState<CreatorPass[]>([]);
    const [loading, setLoading] = useState(true);
    const [showCreateForm, setShowCreateForm] = useState(false);

    // 表单状...
    const [name, setName] = useState("");
    const [description, setDescription] = useState("");
    const [maxSupply, setMaxSupply] = useState("");
    const [price, setPrice] = useState("");
    const [royaltyPercent, setRoyaltyPercent] = useState("5");
    const [benefits, setBenefits] = useState<string[]>([
        "专属内容访问",
        "直播优先提问",
    ]);
    const [newBenefit, setNewBenefit] = useState("");
    const [creating, setCreating] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // 获取JWT
    const jwt = typeof window !== "undefined" ? sessionStorage.getItem("vp.jwt") : null;
    if (jwt) client.setJWT(jwt);

    useEffect(() => {
        loadMyPasses();
    }, []);

    const loadMyPasses = async () => {
        setLoading(true);
        try {
            // 获取用户地址
            const userStr = sessionStorage.getItem("vp.user");
            const user = userStr ? JSON.parse(userStr) : null;
            const ckbAddress = user?.ckbAddress;

            if (ckbAddress) {
                const res = await client.get<{ passes: CreatorPass[] }>(
                    `/nft/creator/pass/list/${ckbAddress}`
                );
                setMyPasses(res.passes || []);
            }
        } catch (err: any) {
            console.error("Load passes failed:", err);
        } finally {
            setLoading(false);
        }
    };

    const addBenefit = () => {
        if (newBenefit.trim() && benefits.length < 10) {
            setBenefits([...benefits, newBenefit.trim()]);
            setNewBenefit("");
        }
    };

    const removeBenefit = (index: number) => {
        setBenefits(benefits.filter((_, i) => i !== index));
    };

    const handleCreate = async () => {
        if (!name.trim() || !price) {
            setError("请填写通行证名称和价格");
            return;
        }

        setCreating(true);
        setError(null);

        try {
            const res = await client.post<{
                ok: boolean;
                clusterId: string;
                pass: CreatorPass;
            }>("/nft/creator/pass/create", {
                name: name.trim(),
                description: description.trim() || undefined,
                maxSupply: maxSupply ? Number(maxSupply) : undefined,
                price: Number(price),
                benefits,
                royaltyPercent: Number(royaltyPercent),
            });

            if (res.ok) {
                setShowCreateForm(false);
                setName("");
                setDescription("");
                setMaxSupply("");
                setPrice("");
                setBenefits(["专属内容访问", "直播优先提问"]);
                await loadMyPasses();
            }
        } catch (err: any) {
            setError(err?.error || err?.message || "创建失败");
        } finally {
            setCreating(false);
        }
    };

    return (
        <div className="min-h-full text-gray-200">
            <div
                className="container"
                style={{
                    padding: 24,
                    maxWidth: 1000,
                    margin: "0 auto",
                }}
            >
                {/* 标题 */}
                <div
                    style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        marginBottom: 24,
                    }}
                >
                    <h1 style={{ margin: 0, fontSize: 24 }}>
                        <span style={{ marginRight: 12 }}>🎫</span>
                        创作者通行证
                    </h1>
                    <button
                        className="btn-neon"
                        onClick={() => setShowCreateForm(true)}
                        disabled={showCreateForm}
                    >
                        + 发行新通行证
                    </button>
                </div>

                {/* 创建表单 */}
                {showCreateForm && (
                    <div
                        className="glass-card"
                        style={{
                            padding: 24,
                            marginBottom: 24,
                        }}
                    >
                        <h3 style={{ marginTop: 0, marginBottom: 20 }}>发行新通行证</h3>

                        {/* 基本信息 */}
                        <div style={{ marginBottom: 16 }}>
                            <label style={{ display: "block", marginBottom: 8, fontSize: 14 }}>
                                通行证名称 *
                            </label>
                            <input
                                type="text"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                placeholder="例如：铁粉通行证"
                                style={{
                                    width: "100%",
                                    padding: 12,
                                    borderRadius: 8,
                                    border: "1px solid rgba(255,255,255,0.2)",
                                    background: "rgba(0,0,0,0.3)",
                                    color: "white",
                                    fontSize: 14,
                                }}
                            />
                        </div>

                        <div style={{ marginBottom: 16 }}>
                            <label style={{ display: "block", marginBottom: 8, fontSize: 14 }}>
                                描述（可选）
                            </label>
                            <textarea
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                                placeholder="介绍你的通行证"
                                rows={3}
                                style={{
                                    width: "100%",
                                    padding: 12,
                                    borderRadius: 8,
                                    border: "1px solid rgba(255,255,255,0.2)",
                                    background: "rgba(0,0,0,0.3)",
                                    color: "white",
                                    fontSize: 14,
                                    resize: "vertical",
                                }}
                            />
                        </div>

                        {/* 价格和发行量 */}
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16, marginBottom: 16 }}>
                            <div>
                                <label style={{ display: "block", marginBottom: 8, fontSize: 14 }}>
                                    价格 (积分) *
                                </label>
                                <input
                                    type="number"
                                    value={price}
                                    onChange={(e) => setPrice(e.target.value)}
                                    placeholder="50"
                                    style={{
                                        width: "100%",
                                        padding: 12,
                                        borderRadius: 8,
                                        border: "1px solid rgba(255,255,255,0.2)",
                                        background: "rgba(0,0,0,0.3)",
                                        color: "white",
                                        fontSize: 14,
                                    }}
                                />
                            </div>
                            <div>
                                <label style={{ display: "block", marginBottom: 8, fontSize: 14 }}>
                                    限量发行（留空为无限）
                                </label>
                                <input
                                    type="number"
                                    value={maxSupply}
                                    onChange={(e) => setMaxSupply(e.target.value)}
                                    placeholder="100"
                                    style={{
                                        width: "100%",
                                        padding: 12,
                                        borderRadius: 8,
                                        border: "1px solid rgba(255,255,255,0.2)",
                                        background: "rgba(0,0,0,0.3)",
                                        color: "white",
                                        fontSize: 14,
                                    }}
                                />
                            </div>
                            <div>
                                <label style={{ display: "block", marginBottom: 8, fontSize: 14 }}>
                                    二级市场版税 (%)
                                </label>
                                <input
                                    type="number"
                                    value={royaltyPercent}
                                    onChange={(e) => setRoyaltyPercent(e.target.value)}
                                    min="0"
                                    max="20"
                                    style={{
                                        width: "100%",
                                        padding: 12,
                                        borderRadius: 8,
                                        border: "1px solid rgba(255,255,255,0.2)",
                                        background: "rgba(0,0,0,0.3)",
                                        color: "white",
                                        fontSize: 14,
                                    }}
                                />
                            </div>
                        </div>

                        {/* 权益 */}
                        <div style={{ marginBottom: 16 }}>
                            <label style={{ display: "block", marginBottom: 8, fontSize: 14 }}>
                                持有者权益
                            </label>
                            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 8 }}>
                                {benefits.map((benefit, index) => (
                                    <div
                                        key={index}
                                        style={{
                                            display: "flex",
                                            alignItems: "center",
                                            gap: 8,
                                            padding: "6px 12px",
                                            borderRadius: 16,
                                            background: "rgba(0, 255, 255, 0.1)",
                                            border: "1px solid rgba(0, 255, 255, 0.3)",
                                            fontSize: 13,
                                        }}
                                    >
                                        <span>...{benefit}</span>
                                        <button
                                            onClick={() => removeBenefit(index)}
                                            style={{
                                                background: "transparent",
                                                border: "none",
                                                color: "#ff6b6b",
                                                cursor: "pointer",
                                                padding: 0,
                                                fontSize: 14,
                                            }}
                                        >
                                            ×
                                        </button>
                                    </div>
                                ))}
                            </div>
                            <div style={{ display: "flex", gap: 8 }}>
                                <input
                                    type="text"
                                    value={newBenefit}
                                    onChange={(e) => setNewBenefit(e.target.value)}
                                    placeholder="添加新权益..."
                                    onKeyDown={(e) => e.key === "Enter" && addBenefit()}
                                    style={{
                                        flex: 1,
                                        padding: 10,
                                        borderRadius: 8,
                                        border: "1px solid rgba(255,255,255,0.2)",
                                        background: "rgba(0,0,0,0.3)",
                                        color: "white",
                                        fontSize: 13,
                                    }}
                                />
                                <button
                                    onClick={addBenefit}
                                    disabled={!newBenefit.trim()}
                                    style={{
                                        padding: "10px 16px",
                                        borderRadius: 8,
                                        border: "1px solid rgba(0, 255, 255, 0.5)",
                                        background: "transparent",
                                        color: "#00ffff",
                                        cursor: "pointer",
                                    }}
                                >
                                    添加
                                </button>
                            </div>
                        </div>

                        {/* 错误提示 */}
                        {error && (
                            <div
                                style={{
                                    color: "#ff6b6b",
                                    fontSize: 13,
                                    marginBottom: 16,
                                    padding: 12,
                                    background: "rgba(255,107,107,0.1)",
                                    borderRadius: 8,
                                }}
                            >
                                {error}
                            </div>
                        )}

                        {/* 按钮 */}
                        <div style={{ display: "flex", gap: 12 }}>
                            <button
                                onClick={() => setShowCreateForm(false)}
                                style={{
                                    padding: "12px 24px",
                                    borderRadius: 8,
                                    border: "1px solid rgba(255,255,255,0.2)",
                                    background: "transparent",
                                    color: "white",
                                    cursor: "pointer",
                                }}
                            >
                                取消
                            </button>
                            <button
                                className="btn-neon"
                                onClick={handleCreate}
                                disabled={creating}
                                style={{ flex: 1 }}
                            >
                                {creating ? "创建中..." : "发行通行证"}
                            </button>
                        </div>
                    </div>
                )}

                {/* 我的通行证列...*/}
                <div>
                    <h3 style={{ marginBottom: 16 }}>我发行的通行证</h3>
                    {loading ? (
                        <p style={{ color: "var(--text-muted)" }}>加载中...</p>
                    ) : myPasses.length === 0 ? (
                        <div
                            className="glass-card"
                            style={{
                                padding: 40,
                                textAlign: "center",
                                color: "var(--text-muted)",
                            }}
                        >
                            <p style={{ fontSize: 48, margin: "0 0 16px" }}>🎫</p>
                            <p>你还没有发行任何通行证</p>
                            <p style={{ fontSize: 13 }}>点击上方按钮开始发行你的第一个通行证</p>
                        </div>
                    ) : (
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 16 }}>
                            {myPasses.map((pass) => (
                                <div
                                    key={pass.clusterId}
                                    className="glass-card"
                                    style={{ padding: 20 }}
                                >
                                    <h4 style={{ margin: "0 0 8px" }}>{pass.name}</h4>
                                    <p style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 16 }}>
                                        {pass.description || "暂无描述"}
                                    </p>
                                    <div style={{ fontSize: 13, display: "flex", flexDirection: "column", gap: 4 }}>
                                        <div style={{ display: "flex", justifyContent: "space-between" }}>
                                            <span>价格</span>
                                            <span>{pass.price} 积分</span>
                                        </div>
                                        <div style={{ display: "flex", justifyContent: "space-between" }}>
                                            <span>发行量</span>
                                            {pass.mintedCount} / {pass.maxSupply || "无"}
                                        </div>
                                        <div style={{ display: "flex", justifyContent: "space-between" }}>
                                            <span>版税</span>
                                            <span>{pass.royaltyPercent}%</span>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
