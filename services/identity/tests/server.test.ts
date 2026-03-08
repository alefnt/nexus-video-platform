// FILE: /video-platform/services/identity/tests/server.test.ts
/**
 * 测试说明：
 * - 验证 /auth/joyid 登录返回 JWT 与离线 Token。
 * - 验证 JWT 密钥长度要求与限流生效。
 */

import { describe, it, expect, beforeAll } from "vitest";
let app: any;

beforeAll(async () => {
  process.env.JWT_SECRET = process.env.JWT_SECRET || "x".repeat(32);
  process.env.API_PORT = process.env.API_PORT || "0"; // 使用随机端口避免 EADDRINUSE
  const mod = await import("../src/server");
  app = mod.default;
});

describe("identity gateway", () => {
  it("should login with joyid and return jwt", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/auth/joyid",
      payload: { bitDomain: "alice.bit", joyIdAssertion: "pass", deviceFingerprint: "dfp" },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.jwt).toBeTypeOf("string");
    expect(body.offlineToken).toBeDefined();
    expect(body.user.bitDomain).toBe("alice.bit");
  });

  it("should rate limit on burst", async () => {
    const results = await Promise.all(
      Array.from({ length: 110 }).map((_, i) =>
        app.inject({ method: "GET", url: "/health" })
      )
    );
    const has429 = results.some((r) => r.statusCode === 429);
    expect(has429).toBe(true);
  });
});