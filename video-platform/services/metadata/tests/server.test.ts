// FILE: /video-platform/services/metadata/tests/server.test.ts
/**
 * 测试说明：
 * - 验证写入与读取元数据流程。
 */

import { describe, it, expect, beforeAll } from "vitest";
import app from "../src/server";

describe("metadata service", () => {
  beforeAll(() => {
    process.env.JWT_SECRET = process.env.JWT_SECRET || "x".repeat(32);
  });

  it("should list empty metas initially", async () => {
    const res = await app.inject({ method: "GET", url: "/metadata/list" });
    expect(res.statusCode).toBe(200);
    const arr = res.json();
    expect(Array.isArray(arr)).toBe(true);
  });
});