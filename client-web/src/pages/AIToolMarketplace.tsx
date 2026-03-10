// FILE: /video-platform/client-web/src/pages/AIToolMarketplace.tsx
/**
 * AI Tool Marketplace — Decentralized marketplace for AI tools/plugins.
 * Creators publish tools, users browse/try/pay via Fiber Network + RGB++ + Spore NFT.
 * Supports ALL tool categories (not just media generation).
 */
import React, { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";

const CATEGORIES = [
    { id: "all", label: "🔥 All", color: "from-orange-500 to-red-500" },
    { id: "agents", label: "🤖 AI Agents", color: "from-purple-500 to-indigo-500" },
    { id: "writing", label: "📝 Writing", color: "from-blue-500 to-cyan-500" },
    { id: "audio", label: "🎵 Audio & Music", color: "from-pink-500 to-rose-500" },
    { id: "video", label: "🎬 Video", color: "from-red-500 to-orange-500" },
    { id: "image", label: "🖼️ Image & Design", color: "from-emerald-500 to-teal-500" },
    { id: "data", label: "📊 Data & Analytics", color: "from-yellow-500 to-amber-500" },
    { id: "dev", label: "🔧 Developer Tools", color: "from-gray-500 to-slate-500" },
    { id: "prompts", label: "💡 Prompts", color: "from-amber-400 to-orange-500" },
    { id: "tutorials", label: "📚 Tutorials & Courses", color: "from-sky-500 to-blue-600" },
    { id: "gaming", label: "🎮 Gaming", color: "from-violet-500 to-purple-500" },
    { id: "social", label: "📱 Social & Marketing", color: "from-cyan-500 to-blue-500" },
    { id: "other", label: "🧠 Other", color: "from-gray-400 to-gray-500" },
];

// Real-world AI tools, prompts, skills, and tutorials
// In production this would come from the backend API
const MOCK_TOOLS = [
    // ── AI Agents ──────────────────────────────────────
    {
        id: "1", name: "Cursor AI", creator: "anysphere.bit", creatorAvatar: "", category: "agents",
        type: "tool",
        description: "The AI-first code editor. Built on VS Code, with deep integration of GPT-4 and Claude for inline code generation, multi-file editing, and natural language refactoring across entire codebases.",
        rating: 4.9, reviews: 12800, price: "20", priceLabel: "$20/mo", uses: 580000,
        tags: ["Code Editor", "GPT-4", "Claude", "Refactor"], featured: true,
        icon: "⌨️", gradient: "from-purple-600 to-indigo-600",
        demoUrl: "https://cursor.com",
    },
    {
        id: "2", name: "AutoGPT", creator: "significant-gravitas.bit", creatorAvatar: "", category: "agents",
        type: "tool",
        description: "Autonomous AI agent that chains GPT-4 calls to accomplish complex tasks. Give it a goal and it breaks it down, executes sub-tasks, browses the web, writes files, and self-corrects iteratively.",
        rating: 4.3, reviews: 5400, price: "free", priceLabel: "Open Source", uses: 420000,
        tags: ["Autonomous", "GPT-4", "Agent", "Open Source"], featured: false,
        icon: "🤖", gradient: "from-purple-500 to-indigo-500",
        demoUrl: "https://github.com/Significant-Gravitas/AutoGPT",
    },
    {
        id: "3", name: "CrewAI", creator: "joaomdmoura.bit", creatorAvatar: "", category: "agents",
        type: "tool",
        description: "Framework for orchestrating multi-agent AI teams. Define roles (Researcher, Writer, Critic), assign tasks, and let AI agents collaborate autonomously. Perfect for content pipelines and research workflows.",
        rating: 4.6, reviews: 2100, price: "free", priceLabel: "Open Source", uses: 89000,
        tags: ["Multi-Agent", "Framework", "Python", "Workflow"], featured: true,
        icon: "👥", gradient: "from-violet-500 to-purple-500",
        demoUrl: "https://github.com/joaomdmoura/crewAI",
    },
    // ── Developer Tools ────────────────────────────────
    {
        id: "4", name: "v0.dev", creator: "vercel-labs.bit", creatorAvatar: "", category: "dev",
        type: "tool",
        description: "AI-powered UI generator by Vercel. Describe any interface in natural language and get production-ready React + Tailwind components. Supports shadcn/ui, responsive layouts, and direct deployment.",
        rating: 4.8, reviews: 8900, price: "free", priceLabel: "Free Tier", uses: 320000,
        tags: ["React", "Tailwind", "UI Generator", "Vercel"], featured: true,
        icon: "🎨", gradient: "from-gray-600 to-slate-600",
        demoUrl: "https://v0.dev",
    },
    {
        id: "5", name: "Bolt.new", creator: "stackblitz.bit", creatorAvatar: "", category: "dev",
        type: "tool",
        description: "Full-stack web app builder in the browser. Describe your app idea, and Bolt generates a complete Next.js/Vite project with database, auth, and deployment — all in a WebContainer sandbox.",
        rating: 4.7, reviews: 6200, price: "free", priceLabel: "Free Tier", uses: 210000,
        tags: ["Full-Stack", "WebContainer", "Next.js", "No Setup"], featured: true,
        icon: "⚡", gradient: "from-yellow-500 to-orange-500",
        demoUrl: "https://bolt.new",
    },
    {
        id: "6", name: "GitHub Copilot", creator: "github.bit", creatorAvatar: "", category: "dev",
        type: "tool",
        description: "AI pair programmer that suggests whole lines or entire functions in real-time. Trained on billions of lines of code. Supports 20+ languages with inline completions, chat, and workspace mode.",
        rating: 4.6, reviews: 34000, price: "10", priceLabel: "$10/mo", uses: 1800000,
        tags: ["Copilot", "VS Code", "Python", "TypeScript"], featured: false,
        icon: "🐙", gradient: "from-gray-700 to-gray-900",
        demoUrl: "https://github.com/features/copilot",
    },
    // ── Image & Design ─────────────────────────────────
    {
        id: "7", name: "Stable Diffusion XL", creator: "stability-ai.bit", creatorAvatar: "", category: "image",
        type: "tool",
        description: "State-of-the-art open-source image generation model. SDXL produces photorealistic images at 1024×1024 with superior composition and text rendering. Run locally on consumer GPUs or via ComfyUI.",
        rating: 4.7, reviews: 18500, price: "free", priceLabel: "Open Source", uses: 2400000,
        tags: ["Image Gen", "Open Source", "ComfyUI", "LoRA"], featured: false,
        icon: "🖼️", gradient: "from-emerald-500 to-teal-500",
        demoUrl: "https://stability.ai",
    },
    {
        id: "8", name: "ComfyUI Workflow Pack", creator: "comfyanon.bit", creatorAvatar: "", category: "image",
        type: "plugin",
        description: "50+ production-ready ComfyUI workflows: img2img, inpainting, ControlNet poses, face swap, upscaling, batch processing. Includes custom nodes and step-by-step guides for each workflow.",
        rating: 4.8, reviews: 3400, price: "5", priceLabel: "5 PTS", uses: 67000,
        tags: ["ComfyUI", "Workflows", "ControlNet", "Nodes"], featured: false,
        icon: "🔧", gradient: "from-teal-500 to-emerald-500",
    },
    {
        id: "9", name: "Midjourney Prompt Bible", creator: "prompt-master.bit", creatorAvatar: "", category: "prompts",
        type: "prompt",
        description: "500+ tested Midjourney v6 prompts organized by style: photorealistic, anime, 3D render, oil painting, pixel art, cinematic. Each includes parameter combos (--ar, --s, --c) and result examples.",
        rating: 4.9, reviews: 7600, price: "3", priceLabel: "3 PTS", uses: 145000,
        tags: ["Midjourney", "Prompts", "v6", "Styles"], featured: true,
        icon: "🎭", gradient: "from-amber-400 to-orange-500",
    },
    // ── Audio & Music ──────────────────────────────────
    {
        id: "10", name: "Suno Music AI", creator: "suno-ai.bit", creatorAvatar: "", category: "audio",
        type: "tool",
        description: "Generate full songs with vocals from text descriptions. Specify genre, mood, lyrics, and style — Suno produces studio-quality tracks with singing, instruments, and mixing in under 2 minutes.",
        rating: 4.7, reviews: 21000, price: "10", priceLabel: "$10/mo", uses: 890000,
        tags: ["Music Gen", "Vocals", "Lyrics", "Production"], featured: false,
        icon: "🎵", gradient: "from-pink-500 to-rose-500",
        demoUrl: "https://suno.com",
    },
    {
        id: "11", name: "ElevenLabs Voice AI", creator: "elevenlabs.bit", creatorAvatar: "", category: "audio",
        type: "tool",
        description: "Industry-leading AI voice synthesis and cloning. Generate speech in 29 languages with emotional control. Clone any voice from a 1-minute sample. Used by content creators, game studios, and enterprises.",
        rating: 4.8, reviews: 15000, price: "5", priceLabel: "$5/mo", uses: 720000,
        tags: ["TTS", "Voice Clone", "29 Languages", "API"], featured: false,
        icon: "🗣️", gradient: "from-rose-500 to-pink-500",
        demoUrl: "https://elevenlabs.io",
    },
    {
        id: "12", name: "OpenAI Whisper", creator: "openai.bit", creatorAvatar: "", category: "audio",
        type: "tool",
        description: "Open-source speech recognition model supporting 99 languages. Transcribe audio/video with timestamps, speaker diarization, and translation. Run locally or via API. Powers most transcription tools today.",
        rating: 4.9, reviews: 28000, price: "free", priceLabel: "Open Source", uses: 3200000,
        tags: ["Transcription", "99 Languages", "Open Source", "API"], featured: false,
        icon: "📝", gradient: "from-green-500 to-emerald-500",
        demoUrl: "https://github.com/openai/whisper",
    },
    // ── Video ──────────────────────────────────────────
    {
        id: "13", name: "Runway Gen-3 Alpha", creator: "runway-ml.bit", creatorAvatar: "", category: "video",
        type: "tool",
        description: "Next-gen AI video generation. Create cinematic 10-second clips from text or images. Features motion brush, camera controls, and style consistency. Used by Hollywood studios for pre-visualization.",
        rating: 4.6, reviews: 9800, price: "15", priceLabel: "$15/mo", uses: 340000,
        tags: ["Video Gen", "Text-to-Video", "Motion", "Cinema"], featured: false,
        icon: "🎬", gradient: "from-red-500 to-orange-500",
        demoUrl: "https://runway.ml",
    },
    {
        id: "14", name: "CapCut Pro Templates", creator: "bytedance.bit", creatorAvatar: "", category: "video",
        type: "plugin",
        description: "200+ premium video editing templates for CapCut/TikTok. Includes transitions, text animations, color grading presets, and trending formats. Auto-adjust to any aspect ratio (9:16, 16:9, 1:1).",
        rating: 4.5, reviews: 4200, price: "2", priceLabel: "2 PTS", uses: 78000,
        tags: ["CapCut", "Templates", "TikTok", "Editing"], featured: false,
        icon: "🎥", gradient: "from-orange-500 to-red-500",
    },
    // ── Writing ────────────────────────────────────────
    {
        id: "15", name: "Claude System Prompt Builder", creator: "prompt-eng.bit", creatorAvatar: "", category: "prompts",
        type: "prompt",
        description: "Structured system prompt templates for Claude 3.5 Sonnet. Includes: Code Assistant, Research Analyst, Creative Writer, Data Scientist, Legal Advisor. Each prompt is battle-tested with chain-of-thought reasoning.",
        rating: 4.8, reviews: 5600, price: "2", priceLabel: "2 PTS", uses: 112000,
        tags: ["Claude", "System Prompt", "Chain-of-Thought", "Templates"], featured: false,
        icon: "🧠", gradient: "from-amber-500 to-yellow-500",
    },
    {
        id: "16", name: "SEO Blog Writer Agent", creator: "content-lab.bit", creatorAvatar: "", category: "writing",
        type: "skill",
        description: "End-to-end AI writing agent: keyword research → outline → draft → SEO optimize → internal linking. Outputs publish-ready blog posts with meta descriptions, OG tags, and schema markup.",
        rating: 4.5, reviews: 3100, price: "1", priceLabel: "1 PTS/article", uses: 56000,
        tags: ["SEO", "Blog", "Content", "Agent"], featured: false,
        icon: "📝", gradient: "from-blue-500 to-cyan-500",
    },
    // ── Prompts ────────────────────────────────────────
    {
        id: "17", name: "Chain-of-Thought Mega Pack", creator: "ai-research.bit", creatorAvatar: "", category: "prompts",
        type: "prompt",
        description: "100 proven chain-of-thought prompt templates for math, coding, analysis, and creative tasks. Each template includes: system message, few-shot examples, and evaluation rubric. Works with GPT-4, Claude, Gemini.",
        rating: 4.7, reviews: 8900, price: "5", priceLabel: "5 PTS", uses: 230000,
        tags: ["CoT", "Few-Shot", "GPT-4", "Claude"], featured: true,
        icon: "🔗", gradient: "from-amber-400 to-orange-500",
    },
    {
        id: "18", name: "GPT-4 Vision Prompts", creator: "vision-lab.bit", creatorAvatar: "", category: "prompts",
        type: "prompt",
        description: "75 optimized prompts for GPT-4 Vision: UI/UX analysis, document parsing, chart reading, product identification, accessibility audit. Each prompt includes image preprocessing tips and output schemas.",
        rating: 4.6, reviews: 2400, price: "3", priceLabel: "3 PTS", uses: 45000,
        tags: ["GPT-4V", "Vision", "Multimodal", "Analysis"], featured: false,
        icon: "👁️", gradient: "from-orange-400 to-red-500",
    },
    // ── Skills ─────────────────────────────────────────
    {
        id: "19", name: "Full-Stack AI Agent Skill", creator: "code-sensei.bit", creatorAvatar: "", category: "dev",
        type: "skill",
        description: "Complete skill package: React + Node.js + PostgreSQL agent that scaffolds projects, writes CRUD APIs, generates database migrations, creates tests, and deploys to Vercel/Railway. Includes 15 workflow templates.",
        rating: 4.8, reviews: 3800, price: "10", priceLabel: "10 PTS", uses: 42000,
        tags: ["Full-Stack", "React", "Node.js", "PostgreSQL"], featured: false,
        icon: "🛠️", gradient: "from-slate-500 to-gray-600",
    },
    {
        id: "20", name: "Data Pipeline Builder", creator: "data-ops.bit", creatorAvatar: "", category: "data",
        type: "skill",
        description: "AI-powered ETL pipeline generator. Describe your data source and desired output — get a complete Python pipeline with extraction, transformation, validation, and loading. Supports CSV, JSON, SQL, APIs, and web scraping.",
        rating: 4.4, reviews: 1200, price: "5", priceLabel: "5 PTS", uses: 18000,
        tags: ["ETL", "Pipeline", "Python", "Data"], featured: false,
        icon: "📊", gradient: "from-yellow-500 to-amber-500",
    },
    // ── Tutorials & Courses ────────────────────────────
    {
        id: "21", name: "LangChain Masterclass", creator: "ai-academy.bit", creatorAvatar: "", category: "tutorials",
        type: "tutorial",
        description: "12-module course: LangChain fundamentals → RAG systems → Multi-agent architectures → Production deployment. Includes 40+ code examples, 3 capstone projects (chatbot, document QA, research agent), and a certification NFT.",
        rating: 4.9, reviews: 6700, price: "15", priceLabel: "15 PTS", uses: 89000,
        tags: ["LangChain", "RAG", "Course", "Python"], featured: true,
        icon: "🎓", gradient: "from-sky-500 to-blue-600",
        demoUrl: "https://python.langchain.com",
    },
    {
        id: "22", name: "Prompt Engineering 101", creator: "openai-community.bit", creatorAvatar: "", category: "tutorials",
        type: "tutorial",
        description: "Comprehensive guide to prompt engineering: zero-shot, few-shot, chain-of-thought, tree-of-thought, ReAct, and self-consistency prompting. 50+ hands-on exercises with GPT-4 and Claude. From beginner to expert.",
        rating: 4.8, reviews: 11200, price: "free", priceLabel: "Free", uses: 560000,
        tags: ["Prompting", "Course", "GPT-4", "Beginner"], featured: false,
        icon: "📖", gradient: "from-blue-500 to-indigo-500",
        demoUrl: "https://platform.openai.com/docs/guides/prompt-engineering",
    },
    {
        id: "23", name: "Fine-Tuning LLMs Guide", creator: "huggingface.bit", creatorAvatar: "", category: "tutorials",
        type: "tutorial",
        description: "Step-by-step guide to fine-tuning open-source LLMs: Llama 3, Mistral, Qwen. Covers LoRA/QLoRA, dataset preparation, training on consumer GPUs (8GB+), evaluation metrics, and GGUF export for local inference.",
        rating: 4.7, reviews: 4500, price: "8", priceLabel: "8 PTS", uses: 67000,
        tags: ["Fine-Tuning", "Llama", "LoRA", "GPU"], featured: false,
        icon: "🔬", gradient: "from-indigo-500 to-purple-500",
        demoUrl: "https://huggingface.co/docs/transformers/training",
    },
    // ── Social & Marketing ─────────────────────────────
    {
        id: "24", name: "AI Content Calendar", creator: "growth-hack.bit", creatorAvatar: "", category: "social",
        type: "tool",
        description: "Generate a complete 30-day content calendar for any niche. AI creates post ideas, hooks, hashtags, and optimal posting times for Twitter/X, LinkedIn, Instagram, and TikTok. Includes A/B test variants.",
        rating: 4.5, reviews: 3400, price: "3", priceLabel: "3 PTS/month", uses: 45000,
        tags: ["Content", "Calendar", "Social Media", "Marketing"], featured: false,
        icon: "📅", gradient: "from-cyan-500 to-blue-500",
    },
];

export default function AIToolMarketplace() {
    const navigate = useNavigate();
    const [search, setSearch] = useState("");
    const [activeCategory, setActiveCategory] = useState("all");
    const [sortBy, setSortBy] = useState<"popular" | "rating" | "newest" | "price">("popular");
    const [selectedTool, setSelectedTool] = useState<typeof MOCK_TOOLS[0] | null>(null);
    const [typeFilter, setTypeFilter] = useState<"all" | "tool" | "prompt" | "skill" | "tutorial" | "plugin">("all");

    const filtered = useMemo(() => {
        let list = MOCK_TOOLS;
        if (activeCategory !== "all") list = list.filter(t => t.category === activeCategory);
        if (typeFilter !== "all") list = list.filter(t => t.type === typeFilter);
        if (search.trim()) {
            const q = search.toLowerCase();
            list = list.filter(t =>
                t.name.toLowerCase().includes(q) ||
                t.description.toLowerCase().includes(q) ||
                t.tags.some(tag => tag.toLowerCase().includes(q))
            );
        }
        switch (sortBy) {
            case "rating": return [...list].sort((a, b) => b.rating - a.rating);
            case "newest": return [...list].reverse();
            case "price": return [...list].sort((a, b) => {
                const pa = a.price === "free" ? 0 : parseFloat(a.price);
                const pb = b.price === "free" ? 0 : parseFloat(b.price);
                return pa - pb;
            });
            default: return [...list].sort((a, b) => b.uses - a.uses);
        }
    }, [search, activeCategory, sortBy, typeFilter]);

    const featuredTools = MOCK_TOOLS.filter(t => t.featured);

    const TYPE_BADGES = [
        { id: "all", label: "All Types" },
        { id: "tool", label: "🔧 Tools" },
        { id: "prompt", label: "💡 Prompts" },
        { id: "skill", label: "⚙️ Skills" },
        { id: "plugin", label: "🧩 Plugins" },
        { id: "tutorial", label: "📚 Tutorials" },
    ];

    return (
        <div className="min-h-screen bg-[#0a0a12] text-white p-6 md:p-10 font-sans">
            <div className="max-w-[1600px] mx-auto">

                {/* Hero Section */}
                <header className="mb-12">
                    <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-6">
                        <div>
                            <h1 className="text-4xl md:text-5xl font-black tracking-tight mb-2">
                                <span className="bg-gradient-to-r from-cyan-400 via-purple-400 to-pink-400 text-transparent bg-clip-text">
                                    AI Tool Marketplace
                                </span>
                            </h1>
                            <p className="text-gray-400 text-sm max-w-2xl">
                                🔥 Discover {MOCK_TOOLS.length} AI tools, prompts, skills & tutorials from creators worldwide.
                                Ownership via <span className="text-purple-400 font-semibold">Spore NFT</span>, payments via{" "}
                                <span className="text-cyan-400 font-semibold">Fiber Network</span>, revenue splits via{" "}
                                <span className="text-pink-400 font-semibold">RGB++</span>.
                            </p>
                        </div>
                        <button
                            onClick={() => navigate("/ai-tools/submit")}
                            className="px-6 py-3 bg-gradient-to-r from-purple-600 to-pink-600 text-white font-bold text-sm rounded-xl hover:shadow-[0_0_25px_rgba(168,85,247,0.4)] transition-all flex items-center gap-2 shrink-0"
                        >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4"></path></svg>
                            Publish Tool
                        </button>
                    </div>

                    {/* Search */}
                    <div className="relative max-w-2xl">
                        <svg className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path>
                        </svg>
                        <input
                            type="text"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder="Search tools, agents, prompts, skills..."
                            className="w-full pl-12 pr-4 py-3.5 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/30 transition-all"
                        />
                    </div>
                </header>

                {/* Featured Tools */}
                {!search && activeCategory === "all" && typeFilter === "all" && (
                    <section className="mb-12">
                        <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                            ⭐ Featured Tools
                        </h2>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                            {featuredTools.map(tool => (
                                <button
                                    key={tool.id}
                                    onClick={() => setSelectedTool(tool)}
                                    className="text-left p-5 rounded-2xl border border-white/10 bg-gradient-to-br from-white/5 to-transparent hover:border-cyan-500/30 hover:shadow-[0_0_20px_rgba(34,211,238,0.1)] transition-all group"
                                >
                                    <div className="flex items-center gap-3 mb-3">
                                        <span className={`text-3xl w-12 h-12 rounded-xl bg-gradient-to-r ${tool.gradient} flex items-center justify-center`}>
                                            {tool.icon}
                                        </span>
                                        <div className="flex-1 min-w-0">
                                            <h3 className="font-bold text-white text-sm truncate group-hover:text-cyan-400 transition-colors">{tool.name}</h3>
                                            <p className="text-gray-500 text-xs truncate">{tool.creator}</p>
                                        </div>
                                    </div>
                                    <p className="text-gray-400 text-xs line-clamp-2 mb-3">{tool.description}</p>
                                    <div className="flex items-center justify-between">
                                        <span className="flex items-center gap-1 text-yellow-400 text-xs font-bold">
                                            ★ {tool.rating} <span className="text-gray-500 font-normal">({tool.reviews})</span>
                                        </span>
                                        <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${tool.price === "free" ? "bg-green-500/20 text-green-400" : "bg-purple-500/20 text-purple-400"}`}>
                                            {tool.priceLabel}
                                        </span>
                                    </div>
                                </button>
                            ))}
                        </div>
                    </section>
                )}

                {/* Categories */}
                <div className="flex items-center gap-2 overflow-x-auto pb-4 mb-4 hide-scrollbar">
                    {CATEGORIES.map(cat => (
                        <button
                            key={cat.id}
                            onClick={() => setActiveCategory(cat.id)}
                            className={`flex-shrink-0 px-4 py-2 rounded-full text-xs font-bold transition-all ${activeCategory === cat.id
                                ? `bg-gradient-to-r ${cat.color} text-white shadow-lg`
                                : "bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white"
                                }`}
                        >
                            {cat.label}
                        </button>
                    ))}
                </div>

                {/* Type Filter */}
                <div className="flex items-center gap-2 overflow-x-auto pb-4 mb-8 hide-scrollbar">
                    {TYPE_BADGES.map(tb => (
                        <button
                            key={tb.id}
                            onClick={() => setTypeFilter(tb.id as any)}
                            className={`flex-shrink-0 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${typeFilter === tb.id
                                ? "bg-white/15 text-white border border-white/20"
                                : "text-gray-500 hover:text-white hover:bg-white/5"
                                }`}
                        >
                            {tb.label}
                        </button>
                    ))}
                </div>

                {/* Sort + Count */}
                <div className="flex items-center justify-between mb-6">
                    <p className="text-gray-500 text-sm">
                        <span className="text-white font-bold">{filtered.length}</span> tools found
                    </p>
                    <div className="flex items-center gap-2">
                        {(["popular", "rating", "newest", "price"] as const).map(s => (
                            <button
                                key={s}
                                onClick={() => setSortBy(s)}
                                className={`px-3 py-1.5 rounded-lg text-xs font-bold capitalize transition-all ${sortBy === s ? "bg-cyan-500/20 text-cyan-400 border border-cyan-500/30" : "text-gray-500 hover:text-white"}`}
                            >
                                {s}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Tool Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                    {filtered.map(tool => (
                        <button
                            key={tool.id}
                            onClick={() => setSelectedTool(tool)}
                            className="text-left p-5 rounded-2xl border border-white/10 bg-white/[0.02] hover:bg-white/[0.06] hover:border-white/20 transition-all group"
                        >
                            <div className="flex items-center gap-3 mb-3">
                                <span className={`text-2xl w-10 h-10 rounded-lg bg-gradient-to-r ${tool.gradient} flex items-center justify-center`}>
                                    {tool.icon}
                                </span>
                                <div className="flex-1 min-w-0">
                                    <h3 className="font-bold text-white text-sm truncate group-hover:text-cyan-400 transition-colors">{tool.name}</h3>
                                    <p className="text-gray-600 text-xs truncate">{tool.creator}</p>
                                </div>
                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${tool.type === 'prompt' ? 'bg-amber-500/10 text-amber-400 border-amber-500/30' :
                                        tool.type === 'skill' ? 'bg-blue-500/10 text-blue-400 border-blue-500/30' :
                                            tool.type === 'plugin' ? 'bg-teal-500/10 text-teal-400 border-teal-500/30' :
                                                tool.type === 'tutorial' ? 'bg-sky-500/10 text-sky-400 border-sky-500/30' :
                                                    'bg-gray-500/10 text-gray-400 border-gray-500/30'
                                    }`}>
                                    {tool.type.toUpperCase()}
                                </span>
                            </div>
                            <p className="text-gray-400 text-xs line-clamp-2 mb-3 leading-relaxed">{tool.description}</p>
                            <div className="flex flex-wrap gap-1 mb-3">
                                {tool.tags.map(tag => (
                                    <span key={tag} className="px-2 py-0.5 bg-white/5 rounded text-[10px] text-gray-400 font-mono">{tag}</span>
                                ))}
                            </div>
                            <div className="flex items-center justify-between">
                                <span className="flex items-center gap-1 text-yellow-400 text-xs font-bold">
                                    ★ {tool.rating}
                                </span>
                                <span className="text-gray-500 text-[10px]">{tool.uses.toLocaleString()} uses</span>
                                <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${tool.price === "free" ? "bg-green-500/20 text-green-400" : "bg-purple-500/20 text-purple-400"}`}>
                                    {tool.priceLabel}
                                </span>
                            </div>
                        </button>
                    ))}
                </div>

                {filtered.length === 0 && (
                    <div className="text-center py-24">
                        <p className="text-gray-500 text-lg mb-2">No tools found</p>
                        <p className="text-gray-600 text-sm">Try a different search or category</p>
                    </div>
                )}
            </div>

            {/* Tool Detail Modal */}
            {selectedTool && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm" onClick={() => setSelectedTool(null)}>
                    <div className="bg-[#13131f] border border-white/10 rounded-3xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto shadow-2xl" onClick={e => e.stopPropagation()}>
                        {/* Modal Header */}
                        <div className={`p-8 bg-gradient-to-r ${selectedTool.gradient} bg-opacity-10 rounded-t-3xl relative`}>
                            <button onClick={() => setSelectedTool(null)} className="absolute top-4 right-4 text-white/50 hover:text-white text-xl">✕</button>
                            <div className="flex items-center gap-4">
                                <span className="text-5xl w-16 h-16 rounded-2xl bg-white/10 flex items-center justify-center backdrop-blur-sm">{selectedTool.icon}</span>
                                <div>
                                    <h2 className="text-2xl font-black text-white">{selectedTool.name}</h2>
                                    <p className="text-white/60 text-sm">by <span className="text-white/80 font-bold">{selectedTool.creator}</span></p>
                                    <span className={`inline-block mt-1 text-[10px] font-bold px-2 py-0.5 rounded-full border ${selectedTool.type === 'prompt' ? 'bg-amber-500/20 text-amber-400 border-amber-500/30' :
                                            selectedTool.type === 'skill' ? 'bg-blue-500/20 text-blue-400 border-blue-500/30' :
                                                selectedTool.type === 'plugin' ? 'bg-teal-500/20 text-teal-400 border-teal-500/30' :
                                                    selectedTool.type === 'tutorial' ? 'bg-sky-500/20 text-sky-400 border-sky-500/30' :
                                                        'bg-gray-500/20 text-gray-400 border-gray-500/30'
                                        }`}>
                                        {selectedTool.type.toUpperCase()}
                                    </span>
                                </div>
                            </div>
                        </div>

                        <div className="p-8 space-y-6">
                            {/* Stats */}
                            <div className="grid grid-cols-4 gap-3">
                                {[
                                    { label: "Rating", value: `★ ${selectedTool.rating}`, sub: `${selectedTool.reviews.toLocaleString()} reviews` },
                                    { label: "Uses", value: selectedTool.uses.toLocaleString(), sub: "total" },
                                    { label: "Price", value: selectedTool.priceLabel, sub: selectedTool.price === "free" ? "forever free" : "per use" },
                                    { label: "Category", value: CATEGORIES.find(c => c.id === selectedTool.category)?.label?.split(" ")[0] || "🧠", sub: selectedTool.category },
                                ].map((stat, i) => (
                                    <div key={i} className="text-center p-3 bg-white/5 rounded-xl">
                                        <p className="text-white font-bold text-lg">{stat.value}</p>
                                        <p className="text-gray-500 text-[10px] uppercase tracking-wider">{stat.sub}</p>
                                    </div>
                                ))}
                            </div>

                            {/* Description */}
                            <div>
                                <h3 className="text-sm font-bold text-gray-300 mb-2 uppercase tracking-wider">Description</h3>
                                <p className="text-gray-400 text-sm leading-relaxed">{selectedTool.description}</p>
                            </div>

                            {/* Tags */}
                            <div className="flex flex-wrap gap-2">
                                {selectedTool.tags.map(tag => (
                                    <span key={tag} className="px-3 py-1 bg-white/5 border border-white/10 rounded-full text-xs text-gray-300 font-mono">{tag}</span>
                                ))}
                            </div>

                            {/* Web3 Info */}
                            <div className="bg-white/5 border border-white/10 rounded-xl p-4 space-y-2">
                                <h3 className="text-sm font-bold text-purple-400 mb-2">🔗 On-Chain Info</h3>
                                <div className="flex justify-between text-xs">
                                    <span className="text-gray-500">Ownership NFT</span>
                                    <span className="text-purple-400 font-mono">Spore Protocol</span>
                                </div>
                                <div className="flex justify-between text-xs">
                                    <span className="text-gray-500">Payment</span>
                                    <span className="text-cyan-400 font-mono">Fiber Network L2</span>
                                </div>
                                <div className="flex justify-between text-xs">
                                    <span className="text-gray-500">Revenue Split</span>
                                    <span className="text-pink-400 font-mono">70% Creator / 20% Platform / 10% Referrer (RGB++)</span>
                                </div>
                            </div>

                            {/* Actions */}
                            <div className="flex gap-3">
                                <button
                                    onClick={() => {
                                        const url = (selectedTool as any).demoUrl;
                                        if (url) window.open(url, '_blank');
                                        else alert(`✅ "${selectedTool.name}" has been added to your workspace!`);
                                    }}
                                    className="flex-1 py-3.5 bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-bold text-sm rounded-xl hover:shadow-[0_0_25px_rgba(34,211,238,0.3)] transition-all"
                                >
                                    {(selectedTool as any).demoUrl ? '🌐 Visit Website' : '🚀 Try Now'}
                                </button>
                                {selectedTool.price !== "free" && (
                                    <button
                                        onClick={() => alert(`⚡ Purchasing "${selectedTool.name}" for ${selectedTool.priceLabel} via Fiber Network...`)}
                                        className="flex-1 py-3.5 bg-gradient-to-r from-purple-600 to-pink-600 text-white font-bold text-sm rounded-xl hover:shadow-[0_0_25px_rgba(168,85,247,0.3)] transition-all"
                                    >
                                        ⚡ Purchase via Fiber
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
