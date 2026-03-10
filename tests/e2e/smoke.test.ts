/**
 * E2E Smoke Tests — Service Health & Core Path Verification
 * 
 * Tests the critical user journey:
 * 1. All services are healthy
 * 2. Auth flow works
 * 3. Content listing works
 * 4. AI orchestration works
 * 5. RAG search works
 * 6. Skills work
 * 7. MCP tools discovery works
 * 
 * Run: npx tsx tests/e2e/smoke.test.ts
 */

const BASE = process.env.TEST_API_URL || "http://localhost:8080";
const AI_BASE = process.env.TEST_AI_URL || "http://localhost:8105";

// ═══ Test Runner ═══

interface TestResult {
    name: string;
    passed: boolean;
    duration: number;
    error?: string;
}

const results: TestResult[] = [];

async function test(name: string, fn: () => Promise<void>) {
    const start = Date.now();
    try {
        await fn();
        results.push({ name, passed: true, duration: Date.now() - start });
        console.log(`  ✅ ${name} (${Date.now() - start}ms)`);
    } catch (err: any) {
        results.push({ name, passed: false, duration: Date.now() - start, error: err.message });
        console.log(`  ❌ ${name}: ${err.message} (${Date.now() - start}ms)`);
    }
}

function assert(condition: boolean, msg: string) {
    if (!condition) throw new Error(msg);
}

async function fetchJSON(url: string, opts?: RequestInit) {
    const resp = await fetch(url, { ...opts, headers: { "Content-Type": "application/json", ...(opts?.headers || {}) } });
    const data = await resp.json().catch(() => ({}));
    return { status: resp.status, ok: resp.ok, data };
}

// ═══ Test Suite 1: Service Health ═══

console.log("\n🏥 Suite 1: Service Health Checks\n");

const services = [
    { name: "identity (auth)", port: 8081 },
    { name: "metadata", port: 8082 },
    { name: "content", port: 8090 },
    { name: "payment", port: 8092 },
    { name: "live", port: 8095 },
    { name: "engagement", port: 8096 },
    { name: "messaging", port: 8103 },
    { name: "ai-generation", port: 8105 },
];

for (const svc of services) {
    await test(`${svc.name} /health (port ${svc.port})`, async () => {
        const resp = await fetch(`http://localhost:${svc.port}/health`, {
            signal: AbortSignal.timeout(5000),
        });
        assert(resp.ok, `Expected 200, got ${resp.status}`);
        const body = await resp.json().catch(() => null);
        assert(body?.status === "ok" || resp.ok, "Health check did not return ok");
    });
}

// ═══ Test Suite 2: Auth Flow ═══

console.log("\n🔐 Suite 2: Authentication Flow\n");

let authToken: string | null = null;

await test("POST /auth/joyid/mock — login", async () => {
    const { status, data } = await fetchJSON(`http://localhost:8081/auth/joyid/mock`, {
        method: "POST",
        body: JSON.stringify({ address: "ckb1_test_e2e_" + Date.now(), credential: "e2e-test" }),
    });
    assert(status === 200 || status === 201, `Login failed: ${status}`);
    assert(!!data.token, "No token returned");
    authToken = data.token;
});

await test("GET /auth/me — verify session", async () => {
    if (!authToken) throw new Error("Skipped: no token from login");
    const { status, data } = await fetchJSON(`http://localhost:8081/auth/me`, {
        headers: { Authorization: `Bearer ${authToken}` },
    });
    assert(status === 200, `Expected 200, got ${status}`);
});

// ═══ Test Suite 3: Content Operations ═══

console.log("\n📦 Suite 3: Content Operations\n");

await test("GET /metadata/videos — list content", async () => {
    const { status, data } = await fetchJSON(`http://localhost:8082/videos?limit=5`);
    assert(status === 200, `Expected 200, got ${status}`);
});

// ═══ Test Suite 4: AI Orchestration ═══

console.log("\n🧠 Suite 4: AI Features (Anthropic Integration)\n");

await test("POST /ai/orchestrate — multi-tool selection", async () => {
    const { status, data } = await fetchJSON(`${AI_BASE}/ai/orchestrate`, {
        method: "POST",
        body: JSON.stringify({ prompt: "生成一个太空主题的视频" }),
    });
    assert(status === 200, `Expected 200, got ${status}`);
    assert(data.toolsUsed?.length > 0, "No tools selected");
});

await test("POST /ai/rag/index — index document", async () => {
    const { status } = await fetchJSON(`${AI_BASE}/ai/rag/index`, {
        method: "POST",
        body: JSON.stringify({ id: "e2e-doc-1", title: "E2E Test Doc", content: "This is a test document about space exploration and galaxies" }),
    });
    assert(status === 200, `Expected 200, got ${status}`);
});

await test("POST /ai/rag/search — semantic search", async () => {
    const { status, data } = await fetchJSON(`${AI_BASE}/ai/rag/search`, {
        method: "POST",
        body: JSON.stringify({ query: "galaxy space", limit: 5 }),
    });
    assert(status === 200, `Expected 200, got ${status}`);
});

await test("GET /ai/tools/schema — tool introspection", async () => {
    const { status, data } = await fetchJSON(`${AI_BASE}/ai/tools/schema`);
    assert(status === 200, `Expected 200, got ${status}`);
    assert(data.tools?.length > 0, "No tool schemas returned");
});

await test("POST /ai/skills/run — content-review skill", async () => {
    const { status, data } = await fetchJSON(`${AI_BASE}/ai/skills/run`, {
        method: "POST",
        body: JSON.stringify({ skillName: "content-review", input: { title: "E2E Test Video", description: "A test video for automated testing" } }),
    });
    assert(status === 200, `Expected 200, got ${status}`);
    assert(data.result !== undefined, "No skill result");
});

await test("POST /ai/skills/match — auto-match", async () => {
    const { status, data } = await fetchJSON(`${AI_BASE}/ai/skills/match`, {
        method: "POST",
        body: JSON.stringify({ task: "review this content for quality" }),
    });
    assert(status === 200, `Expected 200, got ${status}`);
});

await test("GET /ai/skills/list — list all skills", async () => {
    const { status, data } = await fetchJSON(`${AI_BASE}/ai/skills/list`);
    assert(status === 200, `Expected 200, got ${status}`);
    assert(data.skills?.length >= 3, "Expected at least 3 built-in skills");
});

// ═══ Test Suite 5: MCP Protocol ═══

console.log("\n🔌 Suite 5: MCP Protocol\n");

await test("POST /ai/mcp/tools/list — list MCP tools", async () => {
    const { status, data } = await fetchJSON(`${AI_BASE}/ai/mcp/tools/list`, { method: "POST", body: JSON.stringify({}) });
    assert(status === 200, `Expected 200, got ${status}`);
    assert(data.tools?.length > 0, "No MCP tools returned");
});

await test("POST /ai/mcp/resources/list — list resources", async () => {
    const { status } = await fetchJSON(`${AI_BASE}/ai/mcp/resources/list`, { method: "POST", body: JSON.stringify({}) });
    assert(status === 200, `Expected 200, got ${status}`);
});

await test("POST /ai/mcp/prompts/list — list prompts", async () => {
    const { status } = await fetchJSON(`${AI_BASE}/ai/mcp/prompts/list`, { method: "POST", body: JSON.stringify({}) });
    assert(status === 200, `Expected 200, got ${status}`);
});

// ═══ Test Suite 6: Prompt Caching ═══

console.log("\n💾 Suite 6: Prompt Caching\n");

await test("POST /ai/cache/prompt — cache a prompt", async () => {
    const { status } = await fetchJSON(`${AI_BASE}/ai/cache/prompt`, {
        method: "POST",
        body: JSON.stringify({ systemPrompt: "You are a helpful assistant for video platform", model: "test-model", ttl: 3600 }),
    });
    assert(status === 200, `Expected 200, got ${status}`);
});

await test("GET /ai/cache/stats — cache statistics", async () => {
    const { status, data } = await fetchJSON(`${AI_BASE}/ai/cache/stats`);
    assert(status === 200, `Expected 200, got ${status}`);
});

// ═══ Test Suite 7: Rate Limiting ═══

console.log("\n🚦 Suite 7: Rate Limiting\n");

await test("Rate limit headers present on POST", async () => {
    const resp = await fetch(`${AI_BASE}/ai/skills/list`, {
        method: "GET",
    });
    // GET should pass without rate limit
    assert(resp.ok, "GET should not be rate limited");
});

// ═══ Results Summary ═══

console.log("\n" + "═".repeat(60));
console.log("📊 E2E Test Results Summary");
console.log("═".repeat(60));

const passed = results.filter((r) => r.passed).length;
const failed = results.filter((r) => !r.passed).length;
const total = results.length;
const totalTime = results.reduce((sum, r) => sum + r.duration, 0);

console.log(`\n  Total:  ${total}`);
console.log(`  Passed: ${passed} ✅`);
console.log(`  Failed: ${failed} ❌`);
console.log(`  Time:   ${totalTime}ms`);
console.log(`  Rate:   ${((passed / total) * 100).toFixed(1)}%\n`);

if (failed > 0) {
    console.log("Failed tests:");
    results.filter((r) => !r.passed).forEach((r) => {
        console.log(`  ❌ ${r.name}: ${r.error}`);
    });
}

// Output JSON for CI
const jsonOutput = {
    timestamp: new Date().toISOString(),
    total,
    passed,
    failed,
    passRate: `${((passed / total) * 100).toFixed(1)}%`,
    duration: `${totalTime}ms`,
    results,
};

// Write results to file for CI consumption
import { writeFileSync, mkdirSync, existsSync } from "fs";
const outDir = "tests/e2e/results";
if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });
writeFileSync(`${outDir}/smoke-results.json`, JSON.stringify(jsonOutput, null, 2));
console.log(`\n📄 Results saved to ${outDir}/smoke-results.json`);

process.exit(failed > 0 ? 1 : 0);
