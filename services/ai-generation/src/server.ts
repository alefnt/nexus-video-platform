// FILE: /video-platform/services/ai-generation/src/server.ts
/**
 * AI Generation Service — Provider-Agnostic AI Orchestrator
 *
 * Supports BYOK (Bring Your Own Key) model where users configure
 * their own API keys for any supported AI provider.
 *
 * Features:
 * - Save/load encrypted AI provider settings per user
 * - Test connection to any provider
 * - Submit generation tasks (text/music/video)
 * - Stream article generation via SSE
 * - Task progress tracking and history
 *
 * Port: 8105
 */

import Fastify from "fastify";
import jwt from "@fastify/jwt";
import { v4 as uuidv4 } from "uuid";

const app = Fastify({ logger: true });
const JWT_SECRET = process.env.JWT_SECRET || "nexus-dev-jwt-secret-change-me-in-production-12345";
if (process.env.NODE_ENV === "production" && (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32)) {
    throw new Error("JWT_SECRET not set or too short for production");
}

app.register(jwt, { secret: JWT_SECRET });

// ── In-memory stores (replace with DB in production) ──────────

// User AI provider settings (userId → settings)
const userSettings = new Map<string, any>();

// AI generation tasks (taskId → task)
interface AiTask {
    id: string;
    userId: string;
    type: "text" | "music" | "video";
    status: "queued" | "processing" | "completed" | "failed";
    progress: number;
    prompt: string;
    params: any;
    resultUrl?: string;
    resultContent?: string;
    resultMeta?: any;
    cost: number;
    error?: string;
    createdAt: Date;
    completedAt?: Date;
}
const tasks = new Map<string, AiTask>();

// SSE subscriber map (taskId → Set of response objects)
const sseSubscribers = new Map<string, Set<any>>();

// ── Auth Helper ──────────────────────────────────────

function getUserId(req: any): string | null {
    try {
        const decoded = req.user as any;
        return decoded?.sub || decoded?.id || decoded?.userId || null;
    } catch { return null; }
}

// JWT verification hook
app.addHook("onRequest", async (req, reply) => {
    if (req.method === "OPTIONS") return;
    if (req.url.startsWith("/health") || req.url.startsWith("/metrics")) return;
    try {
        await req.jwtVerify();
    } catch {
        return reply.status(401).send({ error: "Unauthorized", code: "unauthorized" });
    }
});

// ── CORS ──────────────────────────────────────────

app.addHook("onRequest", async (req, reply) => {
    reply.header("Access-Control-Allow-Origin", req.headers.origin || "*");
    reply.header("Access-Control-Allow-Methods", "GET,POST,PUT,DELETE,OPTIONS");
    reply.header("Access-Control-Allow-Headers", "authorization,content-type,x-csrf-token");
    if (req.method === "OPTIONS") { reply.status(204).send(); return; }
});

// ══════════════════════════════════════════════════════
// ═══ Settings Endpoints ══════════════════════════════
// ══════════════════════════════════════════════════════

// Save provider settings
app.post("/ai/settings", async (req, reply) => {
    const userId = getUserId(req);
    if (!userId) return reply.status(401).send({ error: "Unauthorized" });

    const body = req.body as any;
    // In production, encrypt API keys before storage
    const settings = {
        text: body?.text ? {
            enabled: !!body.text.enabled,
            providerId: String(body.text.providerId || ""),
            apiKey: String(body.text.apiKey || ""), // Would be AES-256 encrypted
            baseUrl: String(body.text.baseUrl || ""),
            model: String(body.text.model || ""),
        } : null,
        music: body?.music ? {
            enabled: !!body.music.enabled,
            providerId: String(body.music.providerId || ""),
            apiKey: String(body.music.apiKey || ""),
            baseUrl: String(body.music.baseUrl || ""),
            model: String(body.music.model || ""),
        } : null,
        video: body?.video ? {
            enabled: !!body.video.enabled,
            providerId: String(body.video.providerId || ""),
            apiKey: String(body.video.apiKey || ""),
            baseUrl: String(body.video.baseUrl || ""),
            model: String(body.video.model || ""),
        } : null,
        updatedAt: new Date(),
    };

    userSettings.set(userId, settings);
    return reply.send({ success: true });
});

// Get provider settings (keys masked)
app.get("/ai/settings", async (req, reply) => {
    const userId = getUserId(req);
    if (!userId) return reply.status(401).send({ error: "Unauthorized" });

    const settings = userSettings.get(userId);
    if (!settings) return reply.send({ text: null, music: null, video: null });

    // Mask API keys
    const mask = (key: string) => {
        if (!key || key.length < 8) return key ? "••••••••" : "";
        return key.slice(0, 4) + "••••" + key.slice(-4);
    };

    return reply.send({
        text: settings.text ? { ...settings.text, apiKeyMasked: mask(settings.text.apiKey), apiKey: undefined } : null,
        music: settings.music ? { ...settings.music, apiKeyMasked: mask(settings.music.apiKey), apiKey: undefined } : null,
        video: settings.video ? { ...settings.video, apiKeyMasked: mask(settings.video.apiKey), apiKey: undefined } : null,
    });
});

// ══════════════════════════════════════════════════════
// ═══ Test Connection ═════════════════════════════════
// ══════════════════════════════════════════════════════

app.post("/ai/test-connection", async (req, reply) => {
    const userId = getUserId(req);
    if (!userId) return reply.status(401).send({ error: "Unauthorized" });

    const { type, providerId, apiKey, baseUrl, model } = req.body as any;

    if (!apiKey?.trim()) return reply.status(400).send({ error: "API key is required" });

    try {
        if (type === "text") {
            // Test OpenAI-compatible endpoints (OpenAI, DeepSeek, Claude, Ollama)
            const url = `${baseUrl}/models`;
            const headers: any = { "Authorization": `Bearer ${apiKey}` };
            if (providerId === "anthropic") {
                headers["x-api-key"] = apiKey;
                headers["anthropic-version"] = "2023-06-01";
                delete headers["Authorization"];
            }
            const res = await fetch(providerId === "anthropic" ? "https://api.anthropic.com/v1/models" : url, { headers, signal: AbortSignal.timeout(10000) });
            if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text().catch(() => "Connection failed")}`);
            return reply.send({ success: true, provider: providerId });
        }

        if (type === "music") {
            // Test Suno/CometAPI
            const res = await fetch(`${baseUrl}/suno/models`, {
                headers: { "Authorization": `Bearer ${apiKey}` },
                signal: AbortSignal.timeout(10000),
            });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            return reply.send({ success: true, provider: providerId });
        }

        if (type === "video") {
            // Test Runway / Kling
            if (providerId === "runway") {
                const res = await fetch(`${baseUrl}/tasks`, {
                    headers: { "Authorization": `Bearer ${apiKey}`, "X-Runway-Version": "2024-11-06" },
                    signal: AbortSignal.timeout(10000),
                });
                if (!res.ok && res.status !== 404) throw new Error(`HTTP ${res.status}`);
                return reply.send({ success: true, provider: "runway" });
            }
            // Generic check
            return reply.send({ success: true, provider: providerId, note: "Connection assumed valid (no test endpoint available)" });
        }

        return reply.status(400).send({ error: "Unknown type" });
    } catch (err: any) {
        return reply.status(400).send({ error: `Connection failed: ${err?.message || "Unknown error"}` });
    }
});

// ══════════════════════════════════════════════════════
// ═══ Generation Endpoints ════════════════════════════
// ══════════════════════════════════════════════════════

// Submit generation task
app.post("/ai/generate", async (req, reply) => {
    const userId = getUserId(req);
    if (!userId) return reply.status(401).send({ error: "Unauthorized" });

    const { type, prompt, params } = req.body as any;
    if (!type || !prompt?.trim()) return reply.status(400).send({ error: "type and prompt are required" });

    const settings = userSettings.get(userId);
    const providerConfig = settings?.[type];
    if (!providerConfig?.enabled || !providerConfig?.apiKey) {
        return reply.status(400).send({
            error: `No ${type} AI provider configured. Please set up your API key in Settings → AI Providers.`,
            code: "provider_not_configured",
        });
    }

    const task: AiTask = {
        id: uuidv4(),
        userId,
        type,
        status: "queued",
        progress: 0,
        prompt: String(prompt).trim(),
        params: params || {},
        cost: 0,
        createdAt: new Date(),
    };

    tasks.set(task.id, task);

    // Start async generation in background
    processTask(task, providerConfig).catch(err => {
        task.status = "failed";
        task.error = err?.message || "Unknown error";
        notifySubscribers(task.id, task);
    });

    return reply.send({ taskId: task.id, status: "queued" });
});

// Streaming article chat (SSE)
app.post("/ai/chat", async (req, reply) => {
    const userId = getUserId(req);
    if (!userId) return reply.status(401).send({ error: "Unauthorized" });

    const { messages, systemPrompt } = req.body as any;
    const settings = userSettings.get(userId);
    const textConfig = settings?.text;
    if (!textConfig?.enabled || !textConfig?.apiKey) {
        return reply.status(400).send({ error: "No text AI provider configured", code: "provider_not_configured" });
    }

    // Set up SSE
    reply.raw.writeHead(200, {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
        "X-Accel-Buffering": "no",
    });

    try {
        const apiMessages = [
            ...(systemPrompt ? [{ role: "system", content: systemPrompt }] : [
                { role: "system", content: "You are a professional content writer for a Web3 entertainment platform called Nexus. Help the user create engaging articles, blog posts, and content. Respond in the same language the user writes in." }
            ]),
            ...(Array.isArray(messages) ? messages : []),
        ];

        const headers: any = {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${textConfig.apiKey}`,
        };

        let apiUrl = `${textConfig.baseUrl}/chat/completions`;

        // Anthropic requires different format
        if (textConfig.providerId === "anthropic") {
            headers["x-api-key"] = textConfig.apiKey;
            headers["anthropic-version"] = "2023-06-01";
            delete headers["Authorization"];
            apiUrl = `${textConfig.baseUrl}/messages`;
        }

        const res = await fetch(apiUrl, {
            method: "POST",
            headers,
            body: JSON.stringify(
                textConfig.providerId === "anthropic"
                    ? {
                        model: textConfig.model || "claude-sonnet-4-20250514",
                        max_tokens: 4096,
                        stream: true,
                        system: systemPrompt || "You are a professional content writer for Nexus platform.",
                        messages: Array.isArray(messages) ? messages.filter((m: any) => m.role !== "system") : [],
                    }
                    : {
                        model: textConfig.model || "deepseek-chat",
                        messages: apiMessages,
                        stream: true,
                        temperature: 0.7,
                        max_tokens: 4096,
                    }
            ),
        });

        if (!res.ok) {
            const errorText = await res.text().catch(() => "API error");
            reply.raw.write(`data: ${JSON.stringify({ error: `Provider returned ${res.status}: ${errorText}` })}\n\n`);
            reply.raw.end();
            return;
        }

        const reader = (res.body as any)?.getReader?.();
        if (!reader) {
            reply.raw.write(`data: ${JSON.stringify({ error: "Streaming not supported" })}\n\n`);
            reply.raw.end();
            return;
        }

        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split("\n");
            buffer = lines.pop() || "";

            for (const line of lines) {
                const trimmed = line.trim();
                if (!trimmed || trimmed === "data: [DONE]") continue;
                if (trimmed.startsWith("data: ")) {
                    try {
                        const data = JSON.parse(trimmed.slice(6));
                        let content = "";

                        if (textConfig.providerId === "anthropic") {
                            // Anthropic SSE format
                            if (data.type === "content_block_delta") {
                                content = data.delta?.text || "";
                            }
                        } else {
                            // OpenAI-compatible format
                            content = data.choices?.[0]?.delta?.content || "";
                        }

                        if (content) {
                            reply.raw.write(`data: ${JSON.stringify({ content })}\n\n`);
                        }
                    } catch { /* skip malformed JSON */ }
                }
            }
        }

        reply.raw.write(`data: [DONE]\n\n`);
        reply.raw.end();
    } catch (err: any) {
        reply.raw.write(`data: ${JSON.stringify({ error: err?.message || "Stream failed" })}\n\n`);
        reply.raw.end();
    }
});

// Get task status
app.get("/ai/task/:taskId", async (req, reply) => {
    const userId = getUserId(req);
    if (!userId) return reply.status(401).send({ error: "Unauthorized" });

    const { taskId } = req.params as any;
    const task = tasks.get(taskId);
    if (!task || task.userId !== userId) return reply.status(404).send({ error: "Task not found" });

    return reply.send({
        id: task.id,
        type: task.type,
        status: task.status,
        progress: task.progress,
        prompt: task.prompt,
        resultUrl: task.resultUrl,
        resultContent: task.resultContent,
        resultMeta: task.resultMeta,
        error: task.error,
        createdAt: task.createdAt,
        completedAt: task.completedAt,
    });
});

// SSE task progress stream
app.get("/ai/task/:taskId/stream", async (req, reply) => {
    const userId = getUserId(req);
    if (!userId) return reply.status(401).send({ error: "Unauthorized" });

    const { taskId } = req.params as any;
    const task = tasks.get(taskId);
    if (!task || task.userId !== userId) return reply.status(404).send({ error: "Task not found" });

    reply.raw.writeHead(200, {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
    });

    // Send current state immediately
    reply.raw.write(`data: ${JSON.stringify({ status: task.status, progress: task.progress })}\n\n`);

    if (task.status === "completed" || task.status === "failed") {
        reply.raw.write(`data: ${JSON.stringify(task)}\n\n`);
        reply.raw.end();
        return;
    }

    // Subscribe to updates
    if (!sseSubscribers.has(taskId)) sseSubscribers.set(taskId, new Set());
    sseSubscribers.get(taskId)!.add(reply.raw);

    req.raw.on("close", () => {
        sseSubscribers.get(taskId)?.delete(reply.raw);
    });
});

// User's generation history
app.get("/ai/history", async (req, reply) => {
    const userId = getUserId(req);
    if (!userId) return reply.status(401).send({ error: "Unauthorized" });

    const userTasks = Array.from(tasks.values())
        .filter(t => t.userId === userId)
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
        .slice(0, 50)
        .map(t => ({
            id: t.id,
            type: t.type,
            status: t.status,
            progress: t.progress,
            prompt: t.prompt.slice(0, 100),
            resultUrl: t.resultUrl,
            resultMeta: t.resultMeta,
            createdAt: t.createdAt,
            completedAt: t.completedAt,
        }));

    return reply.send({ tasks: userTasks });
});

// ══════════════════════════════════════════════════════
// ═══ Task Processing (Background Workers) ════════════
// ══════════════════════════════════════════════════════

function notifySubscribers(taskId: string, task: AiTask) {
    const subs = sseSubscribers.get(taskId);
    if (!subs) return;
    const data = JSON.stringify({
        status: task.status,
        progress: task.progress,
        resultUrl: task.resultUrl,
        resultContent: task.resultContent,
        error: task.error,
    });
    for (const res of subs) {
        try { res.write(`data: ${data}\n\n`); } catch { subs.delete(res); }
    }
    if (task.status === "completed" || task.status === "failed") {
        for (const res of subs) {
            try { res.end(); } catch { }
        }
        sseSubscribers.delete(taskId);
    }
}

async function processTask(task: AiTask, providerConfig: any) {
    task.status = "processing";
    task.progress = 5;
    notifySubscribers(task.id, task);

    try {
        switch (task.type) {
            case "text":
                await processTextGeneration(task, providerConfig);
                break;
            case "music":
                await processMusicGeneration(task, providerConfig);
                break;
            case "video":
                await processVideoGeneration(task, providerConfig);
                break;
            default:
                throw new Error(`Unknown task type: ${task.type}`);
        }
    } catch (err: any) {
        task.status = "failed";
        task.error = err?.message || "Processing failed";
        notifySubscribers(task.id, task);
    }
}

// ── Text/Article Generation Worker ──────────────

async function processTextGeneration(task: AiTask, config: any) {
    const { prompt, params } = task;

    task.progress = 20;
    notifySubscribers(task.id, task);

    const systemPrompt = params?.systemPrompt || "You are a professional content writer. Generate a well-structured article based on the given topic.";
    const headers: any = {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${config.apiKey}`,
    };

    let apiUrl = `${config.baseUrl}/chat/completions`;
    let body: any;

    if (config.providerId === "anthropic") {
        headers["x-api-key"] = config.apiKey;
        headers["anthropic-version"] = "2023-06-01";
        delete headers["Authorization"];
        apiUrl = `${config.baseUrl}/messages`;
        body = {
            model: config.model || "claude-sonnet-4-20250514",
            max_tokens: params?.maxTokens || 4096,
            system: systemPrompt,
            messages: [{ role: "user", content: prompt }],
        };
    } else {
        body = {
            model: config.model || "deepseek-chat",
            messages: [
                { role: "system", content: systemPrompt },
                { role: "user", content: prompt },
            ],
            temperature: params?.temperature || 0.7,
            max_tokens: params?.maxTokens || 4096,
        };
    }

    task.progress = 40;
    notifySubscribers(task.id, task);

    const res = await fetch(apiUrl, { method: "POST", headers, body: JSON.stringify(body) });
    if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(`Provider returned ${res.status}: ${text}`);
    }

    task.progress = 80;
    notifySubscribers(task.id, task);

    const data = await res.json() as any;
    let content = "";

    if (config.providerId === "anthropic") {
        content = data.content?.[0]?.text || "";
    } else {
        content = data.choices?.[0]?.message?.content || "";
    }

    task.resultContent = content;
    task.resultMeta = {
        model: data.model || config.model,
        usage: data.usage,
        wordCount: content.split(/\s+/).length,
    };
    task.status = "completed";
    task.progress = 100;
    task.completedAt = new Date();
    notifySubscribers(task.id, task);
}

// ── Music Generation Worker ──────────────

async function processMusicGeneration(task: AiTask, config: any) {
    const { prompt, params } = task;

    task.progress = 10;
    notifySubscribers(task.id, task);

    // Suno via CometAPI / EvoLink
    const headers: any = {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${config.apiKey}`,
    };

    // Submit music generation
    const submitBody: any = {
        prompt,
        make_instrumental: params?.instrumental ?? false,
        model: "chirp-v5",
    };

    if (params?.lyrics) {
        submitBody.custom_mode = true;
        submitBody.lyrics = params.lyrics;
        submitBody.style = params?.style || params?.genre || "";
        submitBody.title = params?.title || "Untitled";
    }

    task.progress = 20;
    notifySubscribers(task.id, task);

    const submitRes = await fetch(`${config.baseUrl}/suno/submit/music`, {
        method: "POST", headers, body: JSON.stringify(submitBody),
    });

    if (!submitRes.ok) {
        const errText = await submitRes.text().catch(() => "");
        throw new Error(`Music generation submit failed (${submitRes.status}): ${errText}`);
    }

    const submitData = await submitRes.json() as any;
    const externalTaskId = submitData?.data?.taskId || submitData?.taskId || submitData?.id;

    if (!externalTaskId) throw new Error("No task ID returned from music provider");

    // Poll for completion
    task.progress = 30;
    notifySubscribers(task.id, task);

    let result: any = null;
    for (let i = 0; i < 120; i++) {
        await new Promise(r => setTimeout(r, 3000)); // Poll every 3s

        const pollRes = await fetch(`${config.baseUrl}/suno/fetch/${externalTaskId}`, { headers });
        if (!pollRes.ok) continue;

        const pollData = await pollRes.json() as any;
        const status = pollData?.data?.status || pollData?.status;

        task.progress = Math.min(30 + Math.round(i * 0.5), 90);
        notifySubscribers(task.id, task);

        if (status === "complete" || status === "completed") {
            result = pollData?.data || pollData;
            break;
        }
        if (status === "error" || status === "failed") {
            throw new Error(pollData?.data?.error || "Music generation failed");
        }
    }

    if (!result) throw new Error("Music generation timed out (6 minutes)");

    // Extract audio URL from result
    const audioUrl = result.audio_url || result.audioUrl || result?.clips?.[0]?.audio_url || "";
    task.resultUrl = audioUrl;
    task.resultMeta = {
        title: result.title || params?.title || "AI Generated Track",
        duration: result.duration,
        style: result.style || params?.style,
        clips: result.clips?.map((c: any) => ({
            id: c.id,
            title: c.title,
            audioUrl: c.audio_url,
            imageUrl: c.image_url,
            duration: c.duration,
        })),
    };
    task.status = "completed";
    task.progress = 100;
    task.completedAt = new Date();
    notifySubscribers(task.id, task);
}

// ── Video Generation Worker ──────────────

async function processVideoGeneration(task: AiTask, config: any) {
    const { prompt, params } = task;

    task.progress = 10;
    notifySubscribers(task.id, task);

    if (config.providerId === "runway") {
        // Runway Gen-4/4.5 API
        const headers: any = {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${config.apiKey}`,
            "X-Runway-Version": "2024-11-06",
        };

        const body: any = {
            model: config.model || "gen4-turbo",
            promptText: prompt,
            duration: params?.duration || 5,
            ratio: params?.aspectRatio || "16:9",
        };

        if (params?.referenceImage) {
            body.promptImage = params.referenceImage;
        }

        task.progress = 20;
        notifySubscribers(task.id, task);

        const submitRes = await fetch(`${config.baseUrl}/image_to_video`, {
            method: "POST", headers, body: JSON.stringify(body),
        });

        if (!submitRes.ok) {
            const errText = await submitRes.text().catch(() => "");
            throw new Error(`Video generation submit failed (${submitRes.status}): ${errText}`);
        }

        const submitData = await submitRes.json() as any;
        const runwayTaskId = submitData?.id;
        if (!runwayTaskId) throw new Error("No task ID from Runway");

        // Poll for completion
        task.progress = 30;
        notifySubscribers(task.id, task);

        for (let i = 0; i < 120; i++) {
            await new Promise(r => setTimeout(r, 5000)); // Poll every 5s

            const pollRes = await fetch(`${config.baseUrl}/tasks/${runwayTaskId}`, { headers });
            if (!pollRes.ok) continue;

            const pollData = await pollRes.json() as any;

            task.progress = Math.min(30 + Math.round(i * 0.5), 95);
            notifySubscribers(task.id, task);

            if (pollData.status === "SUCCEEDED") {
                task.resultUrl = pollData.output?.[0] || pollData.artifactUrl || "";
                task.resultMeta = {
                    model: config.model,
                    duration: params?.duration || 5,
                    resolution: params?.resolution || "1080p",
                    aspectRatio: params?.aspectRatio || "16:9",
                };
                task.status = "completed";
                task.progress = 100;
                task.completedAt = new Date();
                notifySubscribers(task.id, task);
                return;
            }
            if (pollData.status === "FAILED") {
                throw new Error(pollData.failure || "Video generation failed");
            }
        }

        throw new Error("Video generation timed out (10 minutes)");
    }

    // Kling or other providers — similar pattern
    if (config.providerId === "kling" || config.providerId === "kling_fal") {
        const headers: any = {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${config.apiKey}`,
        };

        const body = {
            prompt,
            duration: String(params?.duration || 5),
            aspect_ratio: params?.aspectRatio || "16:9",
        };

        task.progress = 20;
        notifySubscribers(task.id, task);

        const endpoint = config.providerId === "kling_fal"
            ? `${config.baseUrl}/fal-ai/kling-video/v3/standard/text-to-video`
            : `${config.baseUrl}/v1/videos/text2video`;

        const submitRes = await fetch(endpoint, {
            method: "POST", headers, body: JSON.stringify(body),
        });

        if (!submitRes.ok) {
            const errText = await submitRes.text().catch(() => "");
            throw new Error(`Kling video generation failed (${submitRes.status}): ${errText}`);
        }

        const submitData = await submitRes.json() as any;
        const externalId = submitData?.request_id || submitData?.task_id || submitData?.id;

        // Poll
        for (let i = 0; i < 120; i++) {
            await new Promise(r => setTimeout(r, 5000));

            const pollUrl = config.providerId === "kling_fal"
                ? `${config.baseUrl}/fal-ai/kling-video/v3/standard/text-to-video/status/${externalId}`
                : `${config.baseUrl}/v1/videos/${externalId}`;

            const pollRes = await fetch(pollUrl, { headers });
            if (!pollRes.ok) continue;

            const pollData = await pollRes.json() as any;
            task.progress = Math.min(30 + Math.round(i * 0.5), 95);
            notifySubscribers(task.id, task);

            const status = pollData?.status || pollData?.task_status;

            if (status === "completed" || status === "succeed" || status === "COMPLETED") {
                task.resultUrl = pollData?.output?.video_url || pollData?.works?.[0]?.resource?.resource || "";
                task.resultMeta = { model: "kling-3.0", duration: params?.duration || 5 };
                task.status = "completed";
                task.progress = 100;
                task.completedAt = new Date();
                notifySubscribers(task.id, task);
                return;
            }
            if (status === "failed" || status === "FAILED") {
                throw new Error("Kling video generation failed");
            }
        }

        throw new Error("Video generation timed out");
    }

    throw new Error(`Unsupported video provider: ${config.providerId}`);
}

// ══════════════════════════════════════════════════════
// ═══ Health & Start ══════════════════════════════════
// ══════════════════════════════════════════════════════

app.get("/health", async () => ({ status: "ok", service: "ai-generation", uptime: process.uptime() }));

const PORT = parseInt(process.env.AI_PORT || "8105", 10);
app.listen({ port: PORT, host: "0.0.0.0" }).then(() => {
    console.log(`🧠 AI Generation Service running on :${PORT}`);
}).catch(err => {
    console.error("Failed to start AI Generation Service:", err);
    process.exit(1);
});
