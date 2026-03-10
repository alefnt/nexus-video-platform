// FILE: /video-platform/client-web/src/pages/AIToolSubmit.tsx
/**
 * AI Tool Submit — Creator tool submission page.
 * Allows creators to publish AI tools to the marketplace.
 * Includes: tool info, pricing, category, tutorial, NFT minting option.
 */
import React, { useState } from "react";
import { useNavigate } from "react-router-dom";

const CATEGORIES = [
    { id: "agents", label: "🤖 AI Agents & Chatbots" },
    { id: "writing", label: "📝 Writing & Content" },
    { id: "audio", label: "🎵 Audio & Music" },
    { id: "video", label: "🎬 Video & Animation" },
    { id: "image", label: "🖼️ Image & Design" },
    { id: "data", label: "📊 Data & Analytics" },
    { id: "dev", label: "🔧 Developer Tools" },
    { id: "gaming", label: "🎮 Gaming & Entertainment" },
    { id: "social", label: "📱 Social & Marketing" },
    { id: "other", label: "🧠 Other / Custom" },
];

const PRICING_MODELS = [
    { id: "free", label: "Free", desc: "Free for everyone, no payment required" },
    { id: "per-use", label: "Pay Per Use", desc: "Users pay each time they use the tool" },
    { id: "subscription", label: "Monthly Subscription", desc: "Recurring monthly payment for unlimited use" },
    { id: "freemium", label: "Freemium", desc: "Free tier with limited usage, paid for full access" },
];

export default function AIToolSubmit() {
    const navigate = useNavigate();
    const [form, setForm] = useState({
        name: "",
        description: "",
        category: "",
        pricingModel: "free",
        price: "",
        apiEndpoint: "",
        tutorialUrl: "",
        tutorialText: "",
        tags: "",
        mintNft: true,
    });
    const [step, setStep] = useState(1);
    const [submitting, setSubmitting] = useState(false);

    const handleChange = (field: string, value: any) => {
        setForm(prev => ({ ...prev, [field]: value }));
    };

    const handleSubmit = async () => {
        setSubmitting(true);
        // In production, this would call the backend API to create the tool listing
        // and optionally mint a Spore Protocol NFT for ownership proof
        await new Promise(r => setTimeout(r, 2000));
        setSubmitting(false);
        alert("✅ Tool submitted successfully! It will appear in the marketplace after review.");
        navigate("/ai-tools");
    };

    const isStep1Valid = form.name.trim() && form.description.trim() && form.category;
    const isStep2Valid = form.pricingModel && (form.pricingModel === "free" || form.price.trim());
    const isStep3Valid = true; // Tutorial is optional

    return (
        <div className="min-h-screen bg-[#0a0a12] text-white p-6 md:p-10 font-sans">
            <div className="max-w-3xl mx-auto">

                {/* Header */}
                <header className="mb-10">
                    <button onClick={() => navigate("/ai-tools")} className="text-gray-500 hover:text-white text-sm mb-4 flex items-center gap-1">
                        ← Back to Marketplace
                    </button>
                    <h1 className="text-3xl md:text-4xl font-black tracking-tight mb-2">
                        <span className="bg-gradient-to-r from-purple-400 to-pink-400 text-transparent bg-clip-text">
                            Publish Your AI Tool
                        </span>
                    </h1>
                    <p className="text-gray-400 text-sm">
                        Share your AI tool with the world. Earn CKB through Fiber Network payments with automatic RGB++ revenue splits.
                    </p>
                </header>

                {/* Step Progress */}
                <div className="flex items-center gap-2 mb-10">
                    {[
                        { n: 1, label: "Tool Info" },
                        { n: 2, label: "Pricing" },
                        { n: 3, label: "Tutorial & NFT" },
                    ].map(s => (
                        <button
                            key={s.n}
                            onClick={() => setStep(s.n)}
                            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all ${step === s.n
                                ? "bg-gradient-to-r from-purple-600/30 to-pink-600/30 text-white border border-purple-500/30"
                                : step > s.n
                                    ? "bg-green-500/10 text-green-400 border border-green-500/20"
                                    : "bg-white/5 text-gray-500 border border-white/5"
                                }`}
                        >
                            <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-black ${step === s.n ? "bg-purple-500 text-white" : step > s.n ? "bg-green-500 text-white" : "bg-white/10 text-gray-500"}`}>
                                {step > s.n ? "✓" : s.n}
                            </span>
                            {s.label}
                        </button>
                    ))}
                </div>

                {/* Step 1: Tool Info */}
                {step === 1 && (
                    <div className="space-y-6 animate-fadeIn">
                        <div>
                            <label className="block text-sm font-bold text-gray-300 mb-2">Tool Name *</label>
                            <input
                                type="text"
                                value={form.name}
                                onChange={e => handleChange("name", e.target.value)}
                                placeholder="e.g. Smart Article Writer"
                                className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-purple-500/50 focus:ring-1 focus:ring-purple-500/30"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-bold text-gray-300 mb-2">Description *</label>
                            <textarea
                                value={form.description}
                                onChange={e => handleChange("description", e.target.value)}
                                placeholder="Describe what your tool does, its features, and use cases..."
                                rows={5}
                                className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-purple-500/50 focus:ring-1 focus:ring-purple-500/30 resize-none"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-bold text-gray-300 mb-2">Category *</label>
                            <div className="grid grid-cols-2 gap-2">
                                {CATEGORIES.map(cat => (
                                    <button
                                        key={cat.id}
                                        onClick={() => handleChange("category", cat.id)}
                                        className={`px-4 py-3 rounded-xl text-left text-sm font-bold transition-all ${form.category === cat.id
                                            ? "bg-purple-500/20 border border-purple-500/40 text-white"
                                            : "bg-white/5 border border-white/10 text-gray-400 hover:bg-white/10 hover:text-white"
                                            }`}
                                    >
                                        {cat.label}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-bold text-gray-300 mb-2">Tags (comma separated)</label>
                            <input
                                type="text"
                                value={form.tags}
                                onChange={e => handleChange("tags", e.target.value)}
                                placeholder="e.g. GPT-4, SEO, Writing, Multi-language"
                                className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-purple-500/50 focus:ring-1 focus:ring-purple-500/30"
                            />
                        </div>

                        <button
                            onClick={() => setStep(2)}
                            disabled={!isStep1Valid}
                            className={`w-full py-3.5 rounded-xl font-bold text-sm transition-all ${isStep1Valid
                                ? "bg-gradient-to-r from-purple-600 to-pink-600 text-white hover:shadow-[0_0_25px_rgba(168,85,247,0.3)]"
                                : "bg-white/10 text-gray-500 cursor-not-allowed"
                                }`}
                        >
                            Next: Pricing →
                        </button>
                    </div>
                )}

                {/* Step 2: Pricing */}
                {step === 2 && (
                    <div className="space-y-6 animate-fadeIn">
                        <div>
                            <label className="block text-sm font-bold text-gray-300 mb-2">Pricing Model *</label>
                            <div className="space-y-2">
                                {PRICING_MODELS.map(pm => (
                                    <button
                                        key={pm.id}
                                        onClick={() => handleChange("pricingModel", pm.id)}
                                        className={`w-full px-5 py-4 rounded-xl text-left transition-all ${form.pricingModel === pm.id
                                            ? "bg-purple-500/20 border border-purple-500/40"
                                            : "bg-white/5 border border-white/10 hover:bg-white/10"
                                            }`}
                                    >
                                        <p className="text-sm font-bold text-white">{pm.label}</p>
                                        <p className="text-xs text-gray-400 mt-0.5">{pm.desc}</p>
                                    </button>
                                ))}
                            </div>
                        </div>

                        {form.pricingModel !== "free" && (
                            <div>
                                <label className="block text-sm font-bold text-gray-300 mb-2">
                                    Price (CKB) {form.pricingModel === "subscription" ? "per month" : "per use"} *
                                </label>
                                <input
                                    type="number"
                                    value={form.price}
                                    onChange={e => handleChange("price", e.target.value)}
                                    placeholder="e.g. 0.5"
                                    min="0"
                                    step="0.01"
                                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-purple-500/50 focus:ring-1 focus:ring-purple-500/30"
                                />
                            </div>
                        )}

                        <div className="bg-white/5 border border-white/10 rounded-xl p-5 space-y-3">
                            <h3 className="text-sm font-bold text-purple-400">💰 Revenue Split (RGB++)</h3>
                            <div className="space-y-2 text-sm">
                                <div className="flex justify-between">
                                    <span className="text-gray-400">You (Creator)</span>
                                    <span className="text-green-400 font-bold">70%</span>
                                </div>
                                <div className="w-full bg-white/10 rounded-full h-2.5">
                                    <div className="h-2.5 rounded-full bg-gradient-to-r from-green-500 to-emerald-500" style={{ width: "70%" }}></div>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-gray-400">Platform (Nexus)</span>
                                    <span className="text-cyan-400 font-bold">20%</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-gray-400">Referrers</span>
                                    <span className="text-pink-400 font-bold">10%</span>
                                </div>
                            </div>
                        </div>

                        <div className="flex gap-3">
                            <button onClick={() => setStep(1)} className="px-6 py-3 bg-white/10 text-gray-300 font-bold text-sm rounded-xl hover:bg-white/20">← Back</button>
                            <button
                                onClick={() => setStep(3)}
                                disabled={!isStep2Valid}
                                className={`flex-1 py-3.5 rounded-xl font-bold text-sm transition-all ${isStep2Valid
                                    ? "bg-gradient-to-r from-purple-600 to-pink-600 text-white hover:shadow-[0_0_25px_rgba(168,85,247,0.3)]"
                                    : "bg-white/10 text-gray-500 cursor-not-allowed"
                                    }`}
                            >
                                Next: Tutorial & NFT →
                            </button>
                        </div>
                    </div>
                )}

                {/* Step 3: Tutorial & NFT */}
                {step === 3 && (
                    <div className="space-y-6 animate-fadeIn">
                        <div>
                            <label className="block text-sm font-bold text-gray-300 mb-2">API Endpoint / Tool URL</label>
                            <input
                                type="url"
                                value={form.apiEndpoint}
                                onChange={e => handleChange("apiEndpoint", e.target.value)}
                                placeholder="https://your-tool-api.com/endpoint"
                                className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-purple-500/50 focus:ring-1 focus:ring-purple-500/30"
                            />
                            <p className="text-gray-600 text-xs mt-1">Where your tool is hosted. Users will interact via this endpoint.</p>
                        </div>

                        <div>
                            <label className="block text-sm font-bold text-gray-300 mb-2">Tutorial Video URL</label>
                            <input
                                type="url"
                                value={form.tutorialUrl}
                                onChange={e => handleChange("tutorialUrl", e.target.value)}
                                placeholder="https://youtube.com/watch?v=..."
                                className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-purple-500/50 focus:ring-1 focus:ring-purple-500/30"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-bold text-gray-300 mb-2">Usage Instructions</label>
                            <textarea
                                value={form.tutorialText}
                                onChange={e => handleChange("tutorialText", e.target.value)}
                                placeholder="Explain how to use your tool step by step..."
                                rows={5}
                                className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-purple-500/50 focus:ring-1 focus:ring-purple-500/30 resize-none"
                            />
                        </div>

                        {/* Mint NFT Toggle */}
                        <div className="bg-gradient-to-r from-purple-500/10 to-pink-500/10 border border-purple-500/20 rounded-xl p-5">
                            <div className="flex items-center justify-between">
                                <div>
                                    <h3 className="text-sm font-bold text-purple-400 flex items-center gap-2">
                                        🎨 Mint Ownership NFT (Spore Protocol)
                                    </h3>
                                    <p className="text-gray-400 text-xs mt-1">Creates an on-chain proof of ownership. Transferable and sellable.</p>
                                </div>
                                <button
                                    onClick={() => handleChange("mintNft", !form.mintNft)}
                                    className={`w-12 h-6 rounded-full transition-all ${form.mintNft ? "bg-purple-500" : "bg-white/20"}`}
                                >
                                    <div className={`w-5 h-5 rounded-full bg-white shadow-md transition-transform ${form.mintNft ? "translate-x-6" : "translate-x-0.5"}`}></div>
                                </button>
                            </div>
                        </div>

                        {/* Preview */}
                        <div className="bg-white/5 border border-white/10 rounded-xl p-5">
                            <h3 className="text-sm font-bold text-gray-300 mb-3 uppercase tracking-wider">Preview</h3>
                            <div className="flex items-center gap-3 mb-2">
                                <span className="text-2xl">🔧</span>
                                <div>
                                    <p className="font-bold text-white">{form.name || "Tool Name"}</p>
                                    <p className="text-xs text-gray-500">{CATEGORIES.find(c => c.id === form.category)?.label || "Select category"}</p>
                                </div>
                                <span className={`text-xs font-bold px-2 py-0.5 rounded-full ml-auto ${form.pricingModel === "free" ? "bg-green-500/20 text-green-400" : "bg-purple-500/20 text-purple-400"}`}>
                                    {form.pricingModel === "free" ? "Free" : `${form.price || "?"} CKB`}
                                </span>
                            </div>
                            <p className="text-gray-400 text-xs line-clamp-2">{form.description || "No description yet"}</p>
                        </div>

                        <div className="flex gap-3">
                            <button onClick={() => setStep(2)} className="px-6 py-3 bg-white/10 text-gray-300 font-bold text-sm rounded-xl hover:bg-white/20">← Back</button>
                            <button
                                onClick={handleSubmit}
                                disabled={submitting || !isStep1Valid}
                                className={`flex-1 py-3.5 rounded-xl font-bold text-sm transition-all ${!submitting && isStep1Valid
                                    ? "bg-gradient-to-r from-green-500 to-emerald-600 text-white hover:shadow-[0_0_25px_rgba(34,197,94,0.3)]"
                                    : "bg-white/10 text-gray-500 cursor-not-allowed"
                                    }`}
                            >
                                {submitting ? "⏳ Publishing..." : form.mintNft ? "🚀 Publish & Mint NFT" : "🚀 Publish Tool"}
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
