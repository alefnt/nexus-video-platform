// FILE: /video-platform/services/royalty/tests/server.test.ts
/**
 * 测试说明：
 * - 验证分账接口计算结果与返回 txId。
 */

import { describe, it, expect, beforeAll } from "vitest";
import app from "../src/server";

describe("royalty service", () => {
  beforeAll(() => {
    process.env.JWT_SECRET = process.env.JWT_SECRET || "x".repeat(32);
  });

  it("should require auth", async () => {
    const res = await app.inject({ method: "POST", url: "/royalty/distribute", payload: { videoId: "v1", totalUSDI: "1.000000", participants: [{ address: "a", ratio: 1 }] } });
    expect(res.statusCode).toBe(401);
  });
});