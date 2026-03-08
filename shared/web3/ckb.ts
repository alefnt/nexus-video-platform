// FILE: /video-platform/shared/web3/ckb.ts
/**
 * 功能说明：
 * - 提供 CKB 相关工具函数与 Mock SDK 封装。
 * - 写入视频元数据到 CKB（Mock 写入到本地 JSON 文件以模拟链上交易）。
 * - 按规则生成视频加密密钥：sha256(user_ckb + video_id)。
 *
 * 依赖声明（package.json 片段）：
 * {
 *   "dependencies": {
 *     "js-sha256": "^0.9.0"
 *   }
 * }
 *
 * 环境变量：
 * - process.env.CKB_MOCK_PATH (CKB Mock JSON 文件路径)
 */

import { sha256 } from "js-sha256";
import type { MetadataWriteRequest, MetadataWriteResponse, VideoMeta } from "../types/index.js";

const DEFAULT_MOCK_PATH =
  typeof process !== "undefined" && typeof process.cwd === "function"
    ? `${process.cwd()}/ckb_mock_db.json`
    : "ckb_mock_db.json";

export const generateEncryptionKeyHash = (userCkbAddress: string, videoId: string): string => {
  return sha256(`${userCkbAddress}${videoId}`);
};

export class CKBMockClient {
  private mockPath: string;
  constructor(mockPath?: string) {
    this.mockPath = mockPath || process.env.CKB_MOCK_PATH || DEFAULT_MOCK_PATH;
  }

  private async readDb(): Promise<Record<string, unknown>> {
    const { existsSync, readFileSync } = await import("node:fs");
    if (!existsSync(this.mockPath)) return { metas: [], txs: [] };
    const raw = readFileSync(this.mockPath, "utf-8");
    try {
      return JSON.parse(raw);
    } catch {
      return { metas: [], txs: [] };
    }
  }

  private async writeDb(db: Record<string, unknown>) {
    const { writeFileSync } = await import("node:fs");
    writeFileSync(this.mockPath, JSON.stringify(db, null, 2));
  }

  /**
   * 写入视频元数据到链上（Mock：写入到本地 JSON）。
   * 返回交易哈希（sha256(meta.id + 当前时间戳)）。
   */
  async writeMetadata(req: MetadataWriteRequest): Promise<MetadataWriteResponse> {
    const meta: VideoMeta = req.meta;
    const txHash = sha256(`${meta.id}${Date.now()}`);
    const db = await this.readDb();
    const metas = Array.isArray((db as any).metas) ? (db as any).metas : [];
    const txs = Array.isArray((db as any).txs) ? (db as any).txs : [];
    metas.push(meta);
    txs.push({ txHash, metaId: meta.id, at: new Date().toISOString() });
    await this.writeDb({ metas, txs });
    return { txHash };
  }
}

/**
 * 连接 CKB 节点（JSON-RPC），用于测试网连通性检查与只读查询。
 * 不依赖 Lumos，轻量检测节点状态。
 */
export class CKBNodeClient {
  private rpcUrl: string;
  constructor(rpcUrl?: string) {
    this.rpcUrl = (rpcUrl || process.env.CKB_NODE_URL || "").replace(/\/$/, "");
  }

  isConfigured(): boolean {
    return !!this.rpcUrl;
  }

  async getTipBlockNumber(): Promise<{ ok: boolean; tipBlockNumber?: string; error?: string }> {
    if (!this.rpcUrl) return { ok: false, error: "CKB_NODE_URL 未配置" };
    try {
      const res = await fetch(this.rpcUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: 1, jsonrpc: "2.0", method: "get_tip_block_number", params: [] }),
      });
      const json: any = await res.json();
      const result = json?.result || json?.data || undefined;
      if (!res.ok || !result) return { ok: false, error: json?.error?.message || res.statusText };
      return { ok: true, tipBlockNumber: typeof result === "string" ? result : String(result) };
    } catch (e: any) {
      return { ok: false, error: e?.message || String(e) };
    }
  }
}