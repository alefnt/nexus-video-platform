// FILE: /video-platform/services/content/tests/server.test.ts
/**
 * 测试说明：
 * - 验证上传与原始读取接口。
 */

import { describe, it, expect, beforeAll } from "vitest";
import app from "../src/server";

describe("content service", () => {
  beforeAll(() => {
    process.env.JWT_SECRET = process.env.JWT_SECRET || "x".repeat(32);
  });

  it("should require auth", async () => {
    const res = await app.inject({ method: "POST", url: "/content/upload", payload: { videoId: "v1", base64Content: "aGVsbG8=", creatorCkbAddress: "ckt1" } });
    expect(res.statusCode).toBe(401);
  });
});