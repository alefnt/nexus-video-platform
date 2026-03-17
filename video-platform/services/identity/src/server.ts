// FILE: /video-platform/services/identity/src/server.ts
/**
 * Identity Service + API Gateway — Entry Point
 *
 * This file is the thin orchestrator that initializes Fastify, registers plugins,
 * and mounts route modules. All business logic lives in:
 * - routes/auth.ts    — Authentication routes (JoyID, MetaMask, Email, Twitter, Google, Nostr)
 * - routes/proxy.ts   — API Gateway proxy + circuit breakers
 * - services/authService.ts — Auth logic, user persistence, JWT utilities
 */

import Fastify from "fastify";
import cors from "@fastify/cors";
import jwt from "@fastify/jwt";
import rateLimit from "@fastify/rate-limit";
import replyFrom from "@fastify/reply-from";
import { register } from "prom-client";
import { v4 as uuidv4 } from "uuid";
import fastifySwagger from "@fastify/swagger";
import fastifySwaggerUi from "@fastify/swagger-ui";
import { initRedis } from "@video-platform/shared/stores/redis";

// Route modules
import { registerAuthRoutes } from "./routes/auth";
import { registerProxyRoutes, registerJWTHook } from "./routes/proxy";

// ============== Initialize ==============
initRedis();

const JWT_SECRET = process.env.JWT_SECRET || "";
if (!JWT_SECRET || JWT_SECRET.length < 32) {
  throw new Error("JWT_SECRET 未配置或长度不足（>=32 字节）");
}

const app = Fastify({ logger: true, bodyLimit: 500 * 1024 * 1024 });

// ============== Plugins ==============
await app.register(fastifySwagger, {
  openapi: {
    info: { title: "Nexus Platform API", description: "API documentation for the Nexus Video Platform gateway", version: "1.1.0" },
    servers: [{ url: "http://localhost:8080", description: "Local gateway" }],
    components: { securitySchemes: { bearerAuth: { type: "http", scheme: "bearer", bearerFormat: "JWT" } } },
  },
});
await app.register(fastifySwaggerUi, { routePrefix: "/docs" });

app.register(cors, {
  origin: (origin, cb) => {
    if (!origin) return cb(null, true); // Allow non-browser (curl, Postman, server-to-server)
    const allowedPatterns = ["localhost:5173", "127.0.0.1:5173", "localhost:5174", "127.0.0.1:5174", "localhost:3000", "127.0.0.1:3000"];
    // Allow any configured CORS_ORIGINS env var (comma-separated)
    const extraOrigins = (process.env.CORS_ORIGINS || "").split(",").filter(Boolean);
    const allAllowed = [...allowedPatterns, ...extraOrigins];
    const ok = allAllowed.some(p => origin.includes(p));
    if (ok) return cb(null, true);
    cb(new Error(`Origin ${origin} not allowed by CORS`), false);
  },
  methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "Idempotency-Key", "X-Request-Id", "X-Internal-Service"],
});

app.register(jwt, { secret: JWT_SECRET });
app.register(rateLimit, {
  max: 200,
  timeWindow: "1 minute",
  keyGenerator: (req: any) => req.ip,
  errorResponseBuilder: (_req: any, context: any) => ({ error: "Rate limit exceeded", code: "rate_limit", retryAfter: context.after }),
});
app.register(replyFrom);

// ============== Request Tracing ==============
app.addHook("onRequest", async (req, reply) => {
  const requestId = (req.headers["x-request-id"] as string) || uuidv4();
  (req as any).requestId = requestId;
  reply.header("X-Request-Id", requestId);
});

// ============== Register Routes ==============
registerProxyRoutes(app);
registerJWTHook(app);
registerAuthRoutes(app);

// ============== Health & Metrics ==============
app.get("/health", async () => ({ status: "ok" }));
app.get("/metrics", async () => register.metrics());

// ============== Start Server ==============
const port = Number(process.env.API_PORT || 8080);
app.listen({ port }).then(() => {
  app.log.info(`Gateway listening on http://localhost:${port}`);
});

export default app;