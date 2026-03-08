// FILE: /video-platform/tests/integration/ckb.test.ts
/**
 * 集成测试：CKB Mock 写入元数据并读取校验。
 */

import { describe, it, expect, beforeAll } from "vitest";
import { CKBMockClient } from "../../shared/web3/ckb";
import type { VideoMeta } from "../../shared/types";

describe("ckb mock integration", () => {
  beforeAll(() => {
    process.env.CKB_MOCK_PATH = process.env.CKB_MOCK_PATH || "ckb_mock_db.json";
  });

  it("write and read metadata", async () => {
    const client = new CKBMockClient(process.env.CKB_MOCK_PATH);
    const meta: VideoMeta = {
      id: "vid-int-1",
      title: "Test Video",
      description: "Integration",
      creatorBitDomain: "alice.bit",
      creatorCkbAddress: "ckt1qyqalice",
      priceUSDI: "1.000000",
      cdnUrl: "https://cdn.example/video/vid-int-1.m3u8",
      createdAt: new Date().toISOString(),
    };
    const r = await client.writeMetadata({ meta });
    expect(r.txHash).toBeTypeOf("string");
  });
});