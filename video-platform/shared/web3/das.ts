// FILE: /video-platform/shared/web3/das.ts
/**
 * 功能说明：
 * - .bit 域名解析到 CKB 地址的 Mock 封装。
 * - 提供可扩展的静态映射与回退算法（sha256(domain) 生成伪地址）。
 *
 * 依赖声明（package.json 片段）：
 * {
 *   "dependencies": {
 *     "js-sha256": "^0.9.0"
 *   }
 * }
 */

import { sha256 } from "js-sha256";
import type { ResolveBitResponse } from "../types/index.js";

const STATIC_MAP: Record<string, string> = {
  "alice.bit": "ckt1qyq...alice",
  "bob.bit": "ckt1qyq...bob",
};

/**
 * 真实解析 .bit -> CKB 地址（优先官方 API，失败回退到静态映射/伪地址）。
 * - Node 环境读取 process.env.DOTBIT_API_URL；浏览器读取 import.meta.env.VITE_DOTBIT_API_URL。
 * - 默认使用 https://api.did.id。
 */
export async function resolveBitDomain(domain: string): Promise<ResolveBitResponse> {
  // 优先静态映射（确保已知账户快速命中）
  const mapped = STATIC_MAP[domain];
  if (mapped) return { domain, ckbAddress: mapped };

  const apiUrlNode = typeof process !== "undefined" ? process.env?.DOTBIT_API_URL : undefined;
  // import.meta 可能不存在于 Node 环境，需安全访问
  const apiUrlBrowser = (typeof import.meta !== "undefined" && (import.meta as any)?.env?.VITE_DOTBIT_API_URL) || undefined;
  const base = apiUrlNode || apiUrlBrowser || "https://api.did.id";

  const candidates: string[] = [
    `${base.replace(/\/$/, "")}/v1/account/chain?account=${encodeURIComponent(domain)}&chain=ckb&format=short`,
    // 兼容潜在的不同路径版本
    `${base.replace(/\/$/, "")}/v1/accounts/chain?account=${encodeURIComponent(domain)}&chain=ckb&format=short`,
  ];

  for (const url of candidates) {
    try {
      const res = await fetch(url);
      if (!res.ok) continue;
      const json: any = await res.json();
      // 兼容多种返回结构
      const data = json?.data ?? json;
      let addr =
        data?.address ||
        (Array.isArray(data?.addresses)
          ? (data.addresses.find((a: any) => (a.chain || a.network)?.toLowerCase().includes("ckb")) || {}).address
          : undefined);
      if (typeof addr === "string" && addr.length > 0) {
        return { domain, ckbAddress: addr };
      }
    } catch {
      // 继续尝试下一个候选
    }
  }

  // 回退：生成稳定伪地址，便于测试
  const hash = sha256(domain).slice(0, 30);
  return { domain, ckbAddress: `ckt1qyq${hash}` };
}

/**
 * 反向解析：CKB 地址 -> .bit 域名（优先官方 Indexer JSON-RPC，失败返回 null）。
 * - Node 读取 `process.env.DOTBIT_INDEXER_URL`，浏览器读取 `import.meta.env.VITE_DOTBIT_INDEXER_URL`。
 * - 默认使用公共测试节点 `https://indexer-v1.did.id`。
 */
export async function reverseResolveAddress(address: string): Promise<{ address: string; domain: string | null }> {
  const idxNode = typeof process !== "undefined" ? process.env?.DOTBIT_INDEXER_URL : undefined;
  const idxBrowser = (typeof import.meta !== "undefined" && (import.meta as any)?.env?.VITE_DOTBIT_INDEXER_URL) || undefined;
  const url = (idxNode || idxBrowser || "https://indexer-v1.did.id").replace(/\/$/, "");

  // 优先尝试 JSON-RPC 风格
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: 1, jsonrpc: "2.0", method: "das_reverseRecord", params: [{ type: "address", coin_type: "CKB", key: address }] }),
    });
    const json: any = await res.json();
    if (res.ok) {
      const result = json?.result || json?.data || json || {};
      // 兼容多种返回结构：可能是 { account }, 或 { data: { account } }
      const domain = result?.account || result?.data?.account || result?.reverse_account || null;
      if (typeof domain === "string" && domain.length > 0) {
        return { address, domain };
      }
    }
  } catch {
    // 忽略错误，继续回退
  }

  // 回退：尝试 REST 风格（部分部署可能提供该路径）
  try {
    const res = await fetch(`${url}/das_reverseRecord`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ coin_type: "CKB", address }),
    });
    const json: any = await res.json();
    if (res.ok) {
      const domain = json?.data?.account || json?.account || null;
      if (typeof domain === "string" && domain.length > 0) {
        return { address, domain };
      }
    }
  } catch {
    // 忽略错误
  }

  return { address, domain: null };
}

export async function checkBitAvailability(domain: string): Promise<{ domain: string; registered: boolean; data?: any }> {
  const d = (domain || "").trim().toLowerCase();
  if (!d || !d.endsWith(".bit")) {
    return { domain: d, registered: false };
  }
  const apiUrlNode = typeof process !== "undefined" ? process.env?.DOTBIT_API_URL : undefined;
  const apiUrlBrowser = (typeof import.meta !== "undefined" && (import.meta as any)?.env?.VITE_DOTBIT_API_URL) || undefined;
  const apiBase = (apiUrlNode || apiUrlBrowser || "https://api.did.id").replace(/\/$/, "");

  const idxNode = typeof process !== "undefined" ? process.env?.DOTBIT_INDEXER_URL : undefined;
  const idxBrowser = (typeof import.meta !== "undefined" && (import.meta as any)?.env?.VITE_DOTBIT_INDEXER_URL) || undefined;
  const idxBase = (idxNode || idxBrowser || "https://indexer-v1.did.id").replace(/\/$/, "");

  const candidates: { url: string; parse: (json: any) => boolean }[] = [
    // 若能返回链上地址，则视为已注册
    {
      url: `${apiBase}/v1/account/chain?account=${encodeURIComponent(d)}&chain=ckb&format=short`,
      parse: (json: any) => {
        const data = json?.data ?? json;
        const addr = data?.address || (Array.isArray(data?.addresses) ? (data.addresses.find((a: any) => (a.chain || a.network)?.toLowerCase().includes("ckb")) || {}).address : undefined);
        return typeof addr === "string" && addr.length > 0;
      },
    },
    // 兼容另一种账户详情结构
    {
      url: `${apiBase}/v1/account/profile?account=${encodeURIComponent(d)}`,
      parse: (json: any) => {
        const data = json?.data ?? json;
        const acc = data?.account || data?.profile?.account || data?.reverse_account;
        return typeof acc === "string" && acc.toLowerCase() === d;
      },
    },
    // Indexer 搜索：若能在列表中命中，则视为已注册
    {
      url: `${idxBase}/v1/search?keyword=${encodeURIComponent(d)}`,
      parse: (json: any) => {
        const list = json?.data?.list || json?.list || [];
        if (Array.isArray(list)) {
          return list.some((item: any) => (item?.account || item?.data?.account || "").toLowerCase() === d);
        }
        // 某些实现可能直接返回 account 字段
        const acc = json?.data?.account || json?.account;
        return typeof acc === "string" && acc.toLowerCase() === d;
      },
    },
    // Indexer 账户详情：部分部署可能提供该路径
    {
      url: `${idxBase}/v1/account/${encodeURIComponent(d)}`,
      parse: (json: any) => {
        const acc = json?.data?.account || json?.account;
        return typeof acc === "string" && acc.toLowerCase() === d;
      },
    },
  ];

  for (const c of candidates) {
    try {
      const res = await fetch(c.url);
      if (!res.ok) continue;
      const json = await res.json();
      if (c.parse(json)) return { domain: d, registered: true, data: json };
    } catch {
      // 忽略错误，继续尝试其他候选
    }
  }
  return { domain: d, registered: false };
}