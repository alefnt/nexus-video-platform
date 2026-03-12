// FILE: /video-platform/services/identity/src/routes/proxy.ts
/**
 * API Gateway Proxy Routes
 * Handles reverse proxying to all downstream microservices with circuit breaking.
 */

import type { FastifyInstance } from "fastify";
import { getCircuitBreaker, getAllCircuitStats } from "@video-platform/shared/resilience/circuit-breaker";
import { isJtiRevoked } from "@video-platform/shared/stores/redis";
import type { JWTClaims } from "@video-platform/shared/types";
import { isAdmin } from "../services/authService";

// ============== Service Registry ==============
const proxies = [
    { prefix: "/payment", base: process.env.PAYMENT_URL || "http://localhost:8091" },
    { prefix: "/content", base: process.env.CONTENT_URL || "http://localhost:8092" },
    { prefix: "/metadata", base: process.env.METADATA_URL || "http://localhost:8093" },
    { prefix: "/user", base: process.env.METADATA_URL || "http://localhost:8093" },
    { prefix: "/royalty", base: process.env.ROYALTY_URL || "http://localhost:8094" },
    { prefix: "/nft", base: process.env.NFT_URL || "http://localhost:8095" },
    { prefix: "/live", base: process.env.LIVE_URL || "http://localhost:8096" },
    { prefix: "/achievement", base: process.env.ACHIEVEMENT_URL || "http://localhost:8097" },
    { prefix: "/governance", base: process.env.GOVERNANCE_URL || "http://localhost:8098" },
    { prefix: "/bridge", base: process.env.BRIDGE_URL || "http://localhost:8099" },
    { prefix: "/transcode", base: process.env.TRANSCODE_URL || "http://localhost:8100" },
    { prefix: "/search", base: process.env.SEARCH_URL || "http://localhost:8101" },
    { prefix: "/moderation", base: process.env.MODERATION_URL || "http://localhost:8102" },
    { prefix: "/notifications", base: process.env.MESSAGING_URL || "http://localhost:8103" },
    { prefix: "/engagement", base: process.env.ENGAGEMENT_URL || "http://localhost:8104" },
    { prefix: "/ai", base: process.env.AI_SERVICE_URL || "http://localhost:8105" },
];

type HttpMethod = "GET" | "POST" | "PUT" | "DELETE" | "PATCH";
const methods: HttpMethod[] = ["GET", "POST", "PUT", "DELETE", "PATCH"];

const circuitBreakerConfig = {
    failureThreshold: 5,
    successThreshold: 3,
    timeout: 10000,
    resetTimeout: 30000,
};

export function registerProxyRoutes(app: FastifyInstance) {
    // Initialize circuit breakers
    const serviceBreakers = new Map<string, ReturnType<typeof getCircuitBreaker>>();
    for (const { prefix } of proxies) {
        const name = prefix.slice(1);
        serviceBreakers.set(prefix, getCircuitBreaker({ name, ...circuitBreakerConfig }));
    }

    // Register proxy routes
    for (const { prefix, base } of proxies) {
        const breaker = serviceBreakers.get(prefix)!;
        for (const method of methods) {
            const proxyHandler = async (req: any, reply: any) => {
                if (breaker.state === "OPEN") {
                    return reply.status(503).send({
                        error: "Service temporarily unavailable",
                        code: "circuit_open",
                    });
                }
                const url = req.raw.url || "";
                const target = base + url;
                return reply.from(target, {
                    rewriteRequestHeaders: (_origReq: any, headers: any) => ({
                        ...headers,
                        "x-request-id": _origReq.id,
                    }),
                    onError: (_reply: any, { error }: any) => {
                        breaker.recordFailure();
                        reply.status(502).send({
                            error: "Upstream service error",
                            code: "proxy_error",
                            detail: error?.message,
                        });
                    },
                });
            };
            app.route({ method, url: prefix, handler: proxyHandler });
            app.route({ method, url: `${prefix}/*`, handler: proxyHandler });
        }
    }

    // Admin circuits endpoint
    app.get("/admin/circuits", async (_req, reply) => {
        return reply.send(getAllCircuitStats());
    });
}

// ============== JWT Verification Hook ==============
export function registerJWTHook(app: FastifyInstance) {
    app.addHook("onRequest", async (req, reply) => {
        if (req.method === "OPTIONS") return;
        if (req.method === "GET" && (req.url.startsWith("/metadata/") || req.url.startsWith("/content/hls/") || req.url.startsWith("/user/"))) return;
        if (req.url.startsWith("/health") || req.url.startsWith("/metrics") || req.url.startsWith("/admin/")) return;
        // Skip JWT for auth routes EXCEPT /auth/profile which needs authentication
        if (req.url.startsWith("/auth/") && !req.url.startsWith("/auth/profile")) return;
        try {
            await req.jwtVerify();
        } catch {
            return reply.status(401).send({ error: "未授权", code: "unauthorized" });
        }
        const claims = (req.user || {}) as JWTClaims;
        if (claims?.jti && await isJtiRevoked(claims.jti)) {
            return reply.status(401).send({ error: "令牌已吊销", code: "revoked" });
        }
        const path = req.url || "";
        if (path.startsWith("/payment/ckb/intents")) {
            const enabled = (process.env.ENABLE_ADMIN_CKB_INTENTS || "0") === "1";
            if (!enabled) {
                return reply.status(403).send({ error: "管理员接口未启用", code: "admin_disabled" });
            }
            if (!isAdmin(claims)) {
                return reply.status(403).send({ error: "需要管理员权限", code: "admin_only" });
            }
        }
    });
}
