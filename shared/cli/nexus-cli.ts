#!/usr/bin/env node
/// <reference types="node" />
// FILE: /video-platform/shared/cli/nexus-cli.ts
/**
 * nexus-cli — Agent-Native CLI for Nexus Video Platform
 *
 * Inspired by CLI-Anything (HKUDS/CLI-Anything):
 * "Making ALL Software Agent-Native"
 *
 * Design Principles (from CLI-Anything):
 * 1. --json flag on every command → structured machine output
 * 2. --help on every command → self-describing for agent discovery
 * 3. Dual mode: subcommand (one-shot) + REPL (interactive session)
 * 4. Session management with JWT persistence
 * 5. Structured error responses { error, code, suggestion }
 *
 * Usage:
 *   nexus-cli auth login --address "ckb1..."
 *   nexus-cli content list --limit 10 --json
 *   nexus-cli ai orchestrate --prompt "生成太空视频" --json
 *   nexus-cli                          # enters REPL mode
 */

// ══════════════════════════════════════════
// ═══ Imports & Config ════════════════════
// ══════════════════════════════════════════

import * as fs from "fs";
import * as path from "path";
import * as readline from "readline";
import * as crypto from "crypto";
import * as os from "os";

export { };

const API_BASE = process.env.NEXUS_API_URL || "http://localhost:8080";
const CONFIG_DIR = process.env.NEXUS_CONFIG_DIR || (process.env.HOME || process.env.USERPROFILE || ".") + "/.nexus-cli";
const TOKEN_FILE = CONFIG_DIR + "/token.json";
const VERSION = "2.7.1";

// ══════════════════════════════════════════
// ═══ R1: Token Encryption ═══════════════
// ══════════════════════════════════════════

/** Derive a machine-unique encryption key from hostname + username */
function deriveKey(): Buffer {
    const seed = `nexus-cli:${os.hostname()}:${os.userInfo().username}:v1`;
    return crypto.createHash("sha256").update(seed).digest();
}

function encryptToken(plaintext: string): string {
    const key = deriveKey();
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv("aes-256-cbc", key, iv);
    let encrypted = cipher.update(plaintext, "utf8", "hex");
    encrypted += cipher.final("hex");
    return iv.toString("hex") + ":" + encrypted;
}

function decryptToken(ciphertext: string): string {
    try {
        const key = deriveKey();
        const [ivHex, encrypted] = ciphertext.split(":");
        const iv = Buffer.from(ivHex, "hex");
        const decipher = crypto.createDecipheriv("aes-256-cbc", key, iv);
        let decrypted = decipher.update(encrypted, "hex", "utf8");
        decrypted += decipher.final("utf8");
        return decrypted;
    } catch {
        return ""; // Corrupted or wrong machine → force re-login
    }
}

// ══════════════════════════════════════════
// ═══ R1: Sensitive Field Filter ═════════
// ══════════════════════════════════════════

const SENSITIVE_FIELDS = new Set([
    "token", "jwt", "secret", "password", "apiKey", "api_key",
    "privateKey", "private_key", "credential", "accessToken",
    "refreshToken", "sessionId", "cookie",
]);

function sanitizeOutput(obj: any): any {
    if (obj === null || obj === undefined) return obj;
    if (typeof obj !== "object") return obj;
    if (Array.isArray(obj)) return obj.map(sanitizeOutput);
    const clean: any = {};
    for (const [key, value] of Object.entries(obj)) {
        if (SENSITIVE_FIELDS.has(key)) {
            clean[key] = typeof value === "string" ? value.substring(0, 8) + "...***" : "[REDACTED]";
        } else {
            clean[key] = sanitizeOutput(value);
        }
    }
    return clean;
}

// ══════════════════════════════════════════
// ═══ R3: API Route Map (Abstraction) ════
// ══════════════════════════════════════════

/** All API routes centralized — easy to update when API changes */
const ROUTES = {
    AUTH_LOGIN: "/auth/joyid/mock",
    AUTH_ME: "/auth/me",
    CONTENT_LIST: "/metadata/videos",
    CONTENT_DELETE: (id: string) => `/metadata/video/${id}`,
    CONTENT_PUBLISH: "/content/publish",
    AI_ORCHESTRATE: "/ai/orchestrate",
    AI_RAG_SEARCH: "/ai/rag/search",
    AI_RAG_INDEX: "/ai/rag/index",
    AI_SKILLS_RUN: "/ai/skills/run",
    AI_SKILLS_MATCH: "/ai/skills/match",
    AI_SKILLS_LIST: "/ai/skills/list",
    AI_CACHE_STATS: "/ai/cache/stats",
    AI_TOOLS_SCHEMA: "/ai/tools/schema",
    MCP_TOOLS_LIST: "/ai/mcp/tools/list",
    MCP_TOOLS_CALL: "/ai/mcp/tools/call",
    MCP_RESOURCES_LIST: "/ai/mcp/resources/list",
    MCP_RESOURCES_READ: "/ai/mcp/resources/read",
    MCP_PROMPTS_LIST: "/ai/mcp/prompts/list",
    MCP_PROMPTS_GET: "/ai/mcp/prompts/get",
    LIVE_ROOMS: "/live/rooms",
    LIVE_CREATE: "/live/room/create",
    LIVE_TIP: "/live/tip",
    LIVE_GIFTS: "/live/gifts",
    USER_PROFILE: (id: string) => `/user/${id}/profile`,
    PAYMENTS_BALANCE: "/payments/balance",
    ACHIEVEMENTS: "/achievement/stats",
} as const;

// ══════════════════════════════════════════
// ═══ Utilities ═══════════════════════════
// ══════════════════════════════════════════

interface CliResponse {
    ok: boolean;
    data?: any;
    error?: string;
    code?: string;
    suggestion?: string;
}

function output(data: any, jsonMode: boolean) {
    // R1: Always sanitize sensitive fields before output
    const safe = sanitizeOutput(data);
    if (jsonMode) {
        console.log(JSON.stringify(safe, null, 2));
    } else {
        if (safe.error) {
            console.error(`❌ Error: ${safe.error}`);
            if (safe.code) console.error(`   Code: ${safe.code}`);
            if (safe.suggestion) console.error(`   💡 ${safe.suggestion}`);
        } else {
            prettyPrint(safe);
        }
    }
}

function prettyPrint(obj: any, indent = 0) {
    const pad = "  ".repeat(indent);
    if (Array.isArray(obj)) {
        obj.forEach((item, i) => {
            if (typeof item === "object" && item !== null) {
                console.log(`${pad}[${i}]:`);
                prettyPrint(item, indent + 1);
            } else {
                console.log(`${pad}  - ${item}`);
            }
        });
    } else if (typeof obj === "object" && obj !== null) {
        for (const [key, value] of Object.entries(obj)) {
            if (typeof value === "object" && value !== null) {
                console.log(`${pad}${key}:`);
                prettyPrint(value, indent + 1);
            } else {
                console.log(`${pad}${key}: ${value}`);
            }
        }
    } else {
        console.log(`${pad}${obj}`);
    }
}

// Session management — R1: encrypted token storage
function loadToken(): string | null {
    try {
        if (fs.existsSync(TOKEN_FILE)) {
            const data = JSON.parse(fs.readFileSync(TOKEN_FILE, "utf-8"));
            if (data.encrypted && data.token) {
                return decryptToken(data.token) || null;
            }
            // Legacy plaintext → migrate on next save
            return data.token || null;
        }
    } catch { }
    return null;
}

function saveToken(token: string, userId?: string) {
    try {
        if (!fs.existsSync(CONFIG_DIR)) fs.mkdirSync(CONFIG_DIR, { recursive: true });
        // R1: Always encrypt tokens at rest
        fs.writeFileSync(TOKEN_FILE, JSON.stringify({
            token: encryptToken(token),
            encrypted: true,
            userId,
            savedAt: new Date().toISOString(),
        }), { mode: 0o600 }); // R1: restrict file permissions (owner-only)
    } catch { }
}

function clearToken() {
    try {
        if (fs.existsSync(TOKEN_FILE)) {
            // R1: overwrite with zeros before deleting
            fs.writeFileSync(TOKEN_FILE, crypto.randomBytes(256));
            fs.unlinkSync(TOKEN_FILE);
        }
    } catch { }
}

// HTTP client
async function api(method: string, path: string, body?: any, token?: string | null): Promise<any> {
    const url = `${API_BASE}${path}`;
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (token) headers["Authorization"] = `Bearer ${token}`;

    try {
        const resp = await fetch(url, {
            method,
            headers,
            body: body ? JSON.stringify(body) : undefined,
        });
        const data = await resp.json().catch(() => ({}));
        if (!resp.ok) {
            return { ok: false, error: data.error || `HTTP ${resp.status}`, code: data.code || `HTTP_${resp.status}`, suggestion: "Check API server is running" };
        }
        return { ok: true, ...data };
    } catch (err: any) {
        return { ok: false, error: err.message, code: "NETWORK_ERROR", suggestion: `Ensure API is running at ${API_BASE}` };
    }
}

// Argument parser
function parseArgs(argv: string[]): { command: string; subcommand: string; flags: Record<string, any>; positional: string[] } {
    const command = argv[0] || "help";
    const subcommand = argv[1] || "help";
    const flags: Record<string, any> = {};
    const positional: string[] = [];

    for (let i = 2; i < argv.length; i++) {
        const arg = argv[i];
        if (arg.startsWith("--")) {
            const key = arg.slice(2);
            const next = argv[i + 1];
            if (!next || next.startsWith("--")) {
                flags[key] = true;
            } else {
                flags[key] = next;
                i++;
            }
        } else {
            positional.push(arg);
        }
    }
    return { command, subcommand, flags, positional };
}

// ══════════════════════════════════════════
// ═══ Command Definitions ════════════════
// ══════════════════════════════════════════

interface CommandGroup {
    name: string;
    description: string;
    commands: Record<string, { description: string; usage: string; handler: (flags: Record<string, any>, positional: string[]) => Promise<any> }>;
}

const token = loadToken();

const commandGroups: Record<string, CommandGroup> = {

    // ─── AUTH ───
    auth: {
        name: "auth",
        description: "Authentication & session management",
        commands: {
            login: {
                description: "Login with CKB address or credentials",
                usage: "nexus-cli auth login --address <ckb_address> [--password <pass>]",
                handler: async (flags) => {
                    const { address, password } = flags;
                    if (!address) return { ok: false, error: "address required", code: "MISSING_PARAM", suggestion: "Use --address ckb1..." };
                    const result = await api("POST", ROUTES.AUTH_LOGIN, { address, credential: password || "cli-login" });
                    if (result.ok && result.token) {
                        saveToken(result.token, result.userId);
                        return { ok: true, message: "Login successful", userId: result.userId, address };
                    }
                    return result;
                },
            },
            logout: {
                description: "Clear saved session",
                usage: "nexus-cli auth logout",
                handler: async () => {
                    clearToken();
                    return { ok: true, message: "Logged out. Token cleared." };
                },
            },
            whoami: {
                description: "Show current session info",
                usage: "nexus-cli auth whoami",
                handler: async () => {
                    if (!token) return { ok: false, error: "Not logged in", code: "NO_SESSION", suggestion: "Run: nexus-cli auth login --address <addr>" };
                    return await api("GET", ROUTES.AUTH_ME, undefined, token);
                },
            },
        },
    },

    // ─── CONTENT ───
    content: {
        name: "content",
        description: "Content management (videos, articles, uploads)",
        commands: {
            list: {
                description: "List content with optional filters",
                usage: "nexus-cli content list [--limit N] [--type video|article] [--sort latest|popular]",
                handler: async (flags) => {
                    const limit = flags.limit || 20;
                    const type = flags.type || "";
                    return await api("GET", `${ROUTES.CONTENT_LIST}?limit=${limit}${type ? `&type=${type}` : ""}`, undefined, token);
                },
            },
            search: {
                description: "Search content (keyword or semantic RAG)",
                usage: "nexus-cli content search --query <text> [--mode keyword|rag] [--limit N]",
                handler: async (flags) => {
                    const { query, mode, limit } = flags;
                    if (!query) return { ok: false, error: "query required", code: "MISSING_PARAM", suggestion: "Use --query 'search terms'" };
                    if (mode === "rag") {
                        return await api("POST", ROUTES.AI_RAG_SEARCH, { query, limit: parseInt(limit || "10") }, token);
                    }
                    return await api("GET", `${ROUTES.CONTENT_LIST}?search=${encodeURIComponent(query)}&limit=${limit || 10}`, undefined, token);
                },
            },
            publish: {
                description: "Publish content through the automation pipeline",
                usage: "nexus-cli content publish --title <title> --file <path> [--description <desc>] [--tags tag1,tag2]",
                handler: async (flags) => {
                    const { title, description, tags, type } = flags;
                    if (!title) return { ok: false, error: "title required", code: "MISSING_PARAM", suggestion: "Use --title 'My Video'" };
                    return await api("POST", ROUTES.CONTENT_PUBLISH, {
                        title,
                        description: description || "",
                        tags: tags ? tags.split(",") : [],
                        contentType: type || "video",
                    }, token);
                },
            },
            delete: {
                description: "Delete content by ID",
                usage: "nexus-cli content delete --id <contentId>",
                handler: async (flags) => {
                    if (!flags.id) return { ok: false, error: "id required", code: "MISSING_PARAM", suggestion: "Use --id <contentId>" };
                    return await api("DELETE", ROUTES.CONTENT_DELETE(flags.id), undefined, token);
                },
            },
        },
    },

    // ─── AI ───
    ai: {
        name: "ai",
        description: "AI tools: orchestration, RAG search, skills, caching",
        commands: {
            orchestrate: {
                description: "Auto-select and run AI tools from natural language",
                usage: "nexus-cli ai orchestrate --prompt <text> [--max-tools N]",
                handler: async (flags) => {
                    const { prompt, "max-tools": maxTools } = flags;
                    if (!prompt) return { ok: false, error: "prompt required", code: "MISSING_PARAM", suggestion: 'Use --prompt "生成太空视频配音乐"' };
                    return await api("POST", ROUTES.AI_ORCHESTRATE, { prompt, maxTools: maxTools ? parseInt(maxTools) : undefined }, token);
                },
            },
            "rag-search": {
                description: "Semantic search across indexed content",
                usage: "nexus-cli ai rag-search --query <text> [--limit N]",
                handler: async (flags) => {
                    if (!flags.query) return { ok: false, error: "query required" };
                    return await api("POST", ROUTES.AI_RAG_SEARCH, { query: flags.query, limit: parseInt(flags.limit || "10") }, token);
                },
            },
            "rag-index": {
                description: "Index a document for RAG search",
                usage: "nexus-cli ai rag-index --id <docId> --title <title> --content <text>",
                handler: async (flags) => {
                    if (!flags.id || !flags.content) return { ok: false, error: "id and content required" };
                    return await api("POST", ROUTES.AI_RAG_INDEX, { id: flags.id, title: flags.title || "", content: flags.content }, token);
                },
            },
            "skill-run": {
                description: "Run an automation skill by name",
                usage: "nexus-cli ai skill-run --name <skillName> [--input <json>]",
                handler: async (flags) => {
                    if (!flags.name) return { ok: false, error: "name required", suggestion: "Available: content-review, seo-optimizer, royalty-calculator" };
                    let input = {};
                    try { if (flags.input) input = JSON.parse(flags.input); } catch { return { ok: false, error: "Invalid JSON in --input" }; }
                    return await api("POST", ROUTES.AI_SKILLS_RUN, { skillName: flags.name, input }, token);
                },
            },
            "skill-match": {
                description: "Auto-match skills for a task description",
                usage: "nexus-cli ai skill-match --task <description>",
                handler: async (flags) => {
                    if (!flags.task) return { ok: false, error: "task required" };
                    return await api("POST", ROUTES.AI_SKILLS_MATCH, { task: flags.task }, token);
                },
            },
            "skill-list": {
                description: "List all available skills",
                usage: "nexus-cli ai skill-list",
                handler: async () => await api("GET", ROUTES.AI_SKILLS_LIST, undefined, token),
            },
            "cache-stats": {
                description: "Show prompt cache statistics",
                usage: "nexus-cli ai cache-stats",
                handler: async () => await api("GET", ROUTES.AI_CACHE_STATS, undefined, token),
            },
            "tools-schema": {
                description: "List all tool schemas for introspection",
                usage: "nexus-cli ai tools-schema",
                handler: async () => await api("GET", ROUTES.AI_TOOLS_SCHEMA, undefined, token),
            },
        },
    },

    // ─── MCP ───
    mcp: {
        name: "mcp",
        description: "Model Context Protocol operations",
        commands: {
            "tools-list": {
                description: "List all MCP tools",
                usage: "nexus-cli mcp tools-list",
                handler: async () => await api("POST", ROUTES.MCP_TOOLS_LIST, {}, token),
            },
            "tools-call": {
                description: "Call an MCP tool",
                usage: "nexus-cli mcp tools-call --name <toolName> [--args <json>]",
                handler: async (flags) => {
                    if (!flags.name) return { ok: false, error: "name required" };
                    let args = {};
                    try { if (flags.args) args = JSON.parse(flags.args); } catch { return { ok: false, error: "Invalid JSON in --args" }; }
                    return await api("POST", ROUTES.MCP_TOOLS_CALL, { name: flags.name, arguments: args }, token);
                },
            },
            "resources-list": {
                description: "List MCP resources",
                usage: "nexus-cli mcp resources-list",
                handler: async () => await api("POST", ROUTES.MCP_RESOURCES_LIST, {}, token),
            },
            "resources-read": {
                description: "Read an MCP resource by URI",
                usage: "nexus-cli mcp resources-read --uri <resource_uri>",
                handler: async (flags) => {
                    if (!flags.uri) return { ok: false, error: "uri required", suggestion: "Try: nexus://platform/stats" };
                    return await api("POST", ROUTES.MCP_RESOURCES_READ, { uri: flags.uri }, token);
                },
            },
            "prompts-list": {
                description: "List MCP prompt templates",
                usage: "nexus-cli mcp prompts-list",
                handler: async () => await api("POST", ROUTES.MCP_PROMPTS_LIST, {}, token),
            },
            "prompts-get": {
                description: "Get a specific MCP prompt with arguments",
                usage: "nexus-cli mcp prompts-get --name <promptName> [--args <json>]",
                handler: async (flags) => {
                    if (!flags.name) return { ok: false, error: "name required" };
                    let args = {};
                    try { if (flags.args) args = JSON.parse(flags.args); } catch { }
                    return await api("POST", ROUTES.MCP_PROMPTS_GET, { name: flags.name, arguments: args }, token);
                },
            },
        },
    },

    // ─── PARTY ───
    party: {
        name: "party",
        description: "Watch Party management",
        commands: {
            create: {
                description: "Create a new watch party room",
                usage: "nexus-cli party create --video <videoId> [--title <title>] [--countdown 60]",
                handler: async (flags) => {
                    return {
                        ok: true,
                        roomId: Math.random().toString(36).substring(2, 10),
                        videoId: flags.video || "demo",
                        title: flags.title || "Watch Party",
                        countdown: parseInt(flags.countdown || "60"),
                        joinUrl: `${API_BASE.replace("8080", "5173")}/watch-party?room=<roomId>`,
                        instructions: "Share the joinUrl with participants. Use WebRTC for screen sharing.",
                    };
                },
            },
            list: {
                description: "List active watch party rooms",
                usage: "nexus-cli party list",
                handler: async () => ({ ok: true, rooms: [], message: "Room discovery via GunDB P2P — use joinUrl directly" }),
            },
        },
    },

    // ─── LIVE ───
    live: {
        name: "live",
        description: "Live streaming management",
        commands: {
            rooms: {
                description: "List active live rooms",
                usage: "nexus-cli live rooms [--status live|ended] [--limit N]",
                handler: async (flags) => {
                    const status = flags.status || "live";
                    const limit = flags.limit || 20;
                    return await api("GET", `${ROUTES.LIVE_ROOMS}?status=${status}&limit=${limit}`, undefined, token);
                },
            },
            create: {
                description: "Create a new live room",
                usage: "nexus-cli live create --title <title> [--category gaming|music|tech]",
                handler: async (flags) => {
                    if (!flags.title) return { ok: false, error: "title required" };
                    return await api("POST", ROUTES.LIVE_CREATE, { title: flags.title, category: flags.category || "tech" }, token);
                },
            },
            tip: {
                description: "Send a tip/gift in a live room",
                usage: "nexus-cli live tip --room <roomId> --gift <giftId>",
                handler: async (flags) => {
                    if (!flags.room || !flags.gift) return { ok: false, error: "room and gift required" };
                    return await api("POST", ROUTES.LIVE_TIP, { roomId: flags.room, giftId: flags.gift }, token);
                },
            },
            gifts: {
                description: "List available gift types",
                usage: "nexus-cli live gifts",
                handler: async () => await api("GET", ROUTES.LIVE_GIFTS, undefined, token),
            },
        },
    },

    // ─── USER ───
    user: {
        name: "user",
        description: "User profile & account management",
        commands: {
            profile: {
                description: "Get user profile info",
                usage: "nexus-cli user profile [--id <userId>]",
                handler: async (flags) => {
                    if (flags.id) return await api("GET", ROUTES.USER_PROFILE(flags.id), undefined, token);
                    return await api("GET", ROUTES.AUTH_ME, undefined, token);
                },
            },
            balance: {
                description: "Check point balance",
                usage: "nexus-cli user balance",
                handler: async () => await api("GET", ROUTES.PAYMENTS_BALANCE, undefined, token),
            },
            achievements: {
                description: "List user achievements",
                usage: "nexus-cli user achievements",
                handler: async () => await api("GET", ROUTES.ACHIEVEMENTS, undefined, token),
            },
        },
    },

    // ─── SYSTEM ───
    system: {
        name: "system",
        description: "Platform health & diagnostics",
        commands: {
            health: {
                description: "Check all service health statuses",
                usage: "nexus-cli system health",
                handler: async () => {
                    const services = [
                        { name: "gateway", port: 8080 },
                        { name: "auth", port: 8081 },
                        { name: "metadata", port: 8082 },
                        { name: "content", port: 8090 },
                        { name: "payments", port: 8092 },
                        { name: "live", port: 8095 },
                        { name: "engagement", port: 8096 },
                        { name: "messaging", port: 8103 },
                        { name: "ai-generation", port: 8105 },
                    ];
                    const results: any[] = [];
                    for (const svc of services) {
                        try {
                            const start = Date.now();
                            const resp = await fetch(`http://localhost:${svc.port}/health`, { signal: AbortSignal.timeout(3000) });
                            const data = await resp.json().catch(() => ({}));
                            results.push({ service: svc.name, port: svc.port, status: data.status || "ok", latency: `${Date.now() - start}ms` });
                        } catch {
                            results.push({ service: svc.name, port: svc.port, status: "down", latency: "timeout" });
                        }
                    }
                    const up = results.filter((r) => r.status === "ok").length;
                    return { ok: true, services: results, summary: `${up}/${results.length} services healthy` };
                },
            },
            version: {
                description: "Show platform version",
                usage: "nexus-cli system version",
                handler: async () => ({ ok: true, cli: VERSION, platform: "Nexus Video Platform", node: process.version }),
            },
        },
    },
};

// ══════════════════════════════════════════
// ═══ Help System ════════════════════════
// ══════════════════════════════════════════

function showMainHelp(jsonMode: boolean) {
    const help = {
        tool: "nexus-cli",
        version: VERSION,
        description: "Agent-Native CLI for Nexus Video Platform",
        inspiration: "CLI-Anything (github.com/HKUDS/CLI-Anything)",
        usage: "nexus-cli <command> <subcommand> [--flags]",
        globalFlags: {
            "--json": "Output in structured JSON (agent-friendly)",
            "--help": "Show help for any command",
        },
        commands: Object.fromEntries(
            Object.entries(commandGroups).map(([name, group]) => [
                name,
                {
                    description: group.description,
                    subcommands: Object.keys(group.commands),
                },
            ])
        ),
        examples: [
            "nexus-cli auth login --address ckb1... --json",
            "nexus-cli content list --limit 5 --json",
            'nexus-cli ai orchestrate --prompt "generate space video with music" --json',
            'nexus-cli ai skill-run --name content-review --input \'{"title":"My Video"}\'',
            "nexus-cli mcp tools-list --json",
            "nexus-cli system health --json",
        ],
        repl: "Run 'nexus-cli' with no arguments to enter interactive REPL mode",
    };

    output(help, jsonMode);
}

function showGroupHelp(groupName: string, jsonMode: boolean) {
    const group = commandGroups[groupName];
    if (!group) {
        output({ ok: false, error: `Unknown command group: ${groupName}`, suggestion: `Available: ${Object.keys(commandGroups).join(", ")}` }, jsonMode);
        return;
    }

    const help = {
        command: groupName,
        description: group.description,
        subcommands: Object.fromEntries(
            Object.entries(group.commands).map(([name, cmd]) => [name, { description: cmd.description, usage: cmd.usage }])
        ),
    };
    output(help, jsonMode);
}

// ══════════════════════════════════════════
// ═══ REPL Mode (Interactive Session) ════
// ══════════════════════════════════════════

async function startREPL() {
    if (!readline) {
        console.error("REPL not available in this environment");
        return;
    }

    console.log(`
╔══════════════════════════════════════════════════╗
║                                                  ║
║   🧠  N E X U S  C L I  v${VERSION}              ║
║   Agent-Native Platform Interface                ║
║                                                  ║
║   Type 'help' for commands, 'exit' to quit       ║
║   Inspired by CLI-Anything                       ║
║                                                  ║
╚══════════════════════════════════════════════════╝
`);

    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
        prompt: "nexus> ",
    });

    rl.prompt();

    rl.on("line", async (line: string) => {
        const input = line.trim();
        if (!input) { rl.prompt(); return; }
        if (input === "exit" || input === "quit") { console.log("👋 Goodbye!"); rl.close(); process.exit(0); }
        if (input === "help") { showMainHelp(false); rl.prompt(); return; }

        const parts = input.split(/\s+/);
        const parsed = parseArgs(parts);
        await executeCommand(parsed, false);
        rl.prompt();
    });

    rl.on("close", () => process.exit(0));
}

// ══════════════════════════════════════════
// ═══ Command Execution ══════════════════
// ══════════════════════════════════════════

async function executeCommand(parsed: ReturnType<typeof parseArgs>, jsonMode: boolean) {
    const { command, subcommand, flags, positional } = parsed;

    // Global --json flag
    const isJson = jsonMode || !!flags.json;

    // Help requests
    if (flags.help || subcommand === "help") {
        if (command === "help") showMainHelp(isJson);
        else showGroupHelp(command, isJson);
        return;
    }

    // Find command group
    const group = commandGroups[command];
    if (!group) {
        output({ ok: false, error: `Unknown command: ${command}`, code: "UNKNOWN_COMMAND", suggestion: `Available commands: ${Object.keys(commandGroups).join(", ")}` }, isJson);
        return;
    }

    // Find subcommand
    const cmd = group.commands[subcommand];
    if (!cmd) {
        output({ ok: false, error: `Unknown subcommand: ${command} ${subcommand}`, code: "UNKNOWN_SUBCOMMAND", suggestion: `Available: ${Object.keys(group.commands).join(", ")}` }, isJson);
        return;
    }

    // Execute
    try {
        const result = await cmd.handler(flags, positional);
        output(result, isJson);
    } catch (err: any) {
        output({ ok: false, error: err.message, code: "EXECUTION_ERROR" }, isJson);
    }
}

// ══════════════════════════════════════════
// ═══ Main Entry ═════════════════════════
// ══════════════════════════════════════════

async function main() {
    const args = process.argv.slice(2);

    // R7: No arguments → REPL mode (but not if piped or --no-repl)
    if (args.length === 0) {
        // Detect if stdin is a pipe (non-interactive) — skip REPL for CI/CD
        if (!process.stdin.isTTY || args.includes("--no-repl")) {
            showMainHelp(false);
            return;
        }
        await startREPL();
        return;
    }

    // --version flag
    if (args[0] === "--version" || args[0] === "-v") {
        console.log(`nexus-cli v${VERSION}`);
        return;
    }

    // --help flag at top level
    if (args[0] === "--help" || args[0] === "-h" || args[0] === "help") {
        showMainHelp(args.includes("--json"));
        return;
    }

    const parsed = parseArgs(args);
    await executeCommand(parsed, false);
}

main().catch((err) => {
    console.error("Fatal error:", err.message);
    process.exit(1);
});
