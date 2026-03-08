// FILE: /video-platform/services/payment/tests/server.test.ts
/**
 * 测试说明：
 * - 验证创建支付意图与赎回流程。
 */

import { describe, it, expect, beforeAll } from "vitest";
import app from "../src/server";

describe("payment service", () => {
  beforeAll(() => {
    process.env.JWT_SECRET = process.env.JWT_SECRET || "x".repeat(32);
    process.env.METADATA_URL = process.env.METADATA_URL || "http://localhost:8093";
    process.env.ROYALTY_URL = process.env.ROYALTY_URL || "http://localhost:8094";
  });

  it("should require auth", async () => {
    const res = await app.inject({ method: "POST", url: "/payment/create", payload: { videoId: "v1", amountUSDI: "1" } });
    expect(res.statusCode).toBe(401);
  });
});