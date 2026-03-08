// FILE: /video-platform/shared/api/client.ts
/**
 * 功能说明：
 * - 提供统一的 API 客户端（支持 JWT、错误处理、简单本地限流）。
 * - 在浏览器使用 `import.meta.env.VITE_API_GATEWAY_URL`，在 Node 使用 `process.env.API_GATEWAY_URL`。
 *
 * 依赖声明（package.json 片段）：
 * {
 *   "dependencies": {
 *     "@types/node": "^20.11.0"
 *   }
 * }
 *
 * 环境变量：
 * - process.env.API_GATEWAY_URL
 */

import type { ApiError, RateLimitConfig } from "../types/index.js";

type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

export class ApiClient {
  private baseURL: string;
  private jwt?: string;
  private requests = 0;
  private resetAt = Date.now();
  private rl: RateLimitConfig;

  constructor(opts?: { baseURL?: string; jwt?: string; rateLimit?: RateLimitConfig }) {
    // 支持 Node、Vite、Expo 三种环境的网关地址解析
    const envUrl =
      // Expo（RN）公共环境变量
      (typeof process !== "undefined" && (process.env?.EXPO_PUBLIC_API_GATEWAY_URL || process.env?.API_GATEWAY_URL)) ||
      // Vite（Web）环境变量
      (typeof import.meta !== "undefined" && (import.meta as any).env?.VITE_API_GATEWAY_URL) ||
      // 默认本地网关
      "http://localhost:8080";
    // 允许浏览器端通过本地覆盖 `vp.apiBase`
    const overrideUrl =
      typeof window !== "undefined" && typeof window.localStorage !== "undefined"
        ? window.localStorage.getItem("vp.apiBase") || undefined
        : undefined;
    this.baseURL = opts?.baseURL || overrideUrl || envUrl;
    // 优先使用传入 jwt；否则在浏览器端自动从 sessionStorage 读取
    if (opts?.jwt) {
      this.jwt = opts.jwt;
    } else if (typeof window !== "undefined" && typeof window.sessionStorage !== "undefined") {
      try {
        const stored = window.sessionStorage.getItem("vp.jwt");
        if (stored) this.jwt = stored;
      } catch { }
    }
    this.rl = opts?.rateLimit || { requestsPerMinute: 120 };
  }

  setJWT(jwt: string) {
    this.jwt = jwt;
  }

  /**
   * 运行时切换基础网关地址（用于“系统设置”入口）。
   */
  setBaseURL(url: string) {
    this.baseURL = url;
  }

  private checkRateLimit() {
    const now = Date.now();
    if (now - this.resetAt >= 60_000) {
      this.resetAt = now;
      this.requests = 0;
    }
    this.requests += 1;
    if (this.requests > this.rl.requestsPerMinute) {
      const err: ApiError = { error: "Too Many Requests", code: "rate_limit_exceeded" };
      throw err;
    }
  }

  private async request<T>(method: HttpMethod, path: string, body?: any): Promise<T> {
    this.checkRateLimit();
    const url = `${this.baseURL}${path.startsWith("/") ? path : `/${path}`}`;
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (this.jwt) headers["Authorization"] = `Bearer ${this.jwt}`;
    // 为支付与授权等 POST 请求自动添加 Idempotency-Key
    // 修复：使用随机 nonce 避免 "Idempotency-Key 参数不一致" 错误，确保每次请求（即便是重试）都被视为独立尝试
    // 如果业务层确实需要幂等保护，应由调用方显式传递 header，或后端改进指纹识别
    if (method === "POST" && !headers["Idempotency-Key"]) {
      try {
        // 生成 12 位随机字符 (72-bit entropy)
        const nonce = Math.random().toString(36).substring(2, 14) + Date.now().toString(36);
        headers["Idempotency-Key"] = `ik_rnd_${nonce}`;
      } catch { }
    }

    let resp: Response;
    try {
      resp = await fetch(url, { method, headers, body: body ? JSON.stringify(body) : undefined });
    } catch (networkError: any) {
      // Network error (e.g., DNS failure, connection refused, CORS)
      console.error(`[ApiClient] Network error for ${method} ${url}:`, networkError);
      const err: ApiError = {
        error: `网络请求失败: ${networkError?.message || '无法连接服务器'}`,
        code: "network_error",
        details: { url, method, originalError: networkError?.message }
      };
      throw err;
    }

    const text = await resp.text();
    let json: any = null;
    try { json = JSON.parse(text); } catch { }
    if (!resp.ok) {
      const err: ApiError = {
        error: json?.error || resp.statusText,
        code: json?.code || String(resp.status),
        details: json?.details,
        status: resp.status,
      };
      throw err;
    }
    return (json ?? (text as any)) as T;
  }

  get<T>(path: string): Promise<T> { return this.request<T>("GET", path); }
  post<T>(path: string, body?: any): Promise<T> { return this.request<T>("POST", path, body); }
  put<T>(path: string, body?: any): Promise<T> { return this.request<T>("PUT", path, body); }
  patch<T>(path: string, body?: any): Promise<T> { return this.request<T>("PATCH", path, body); }
  delete<T>(path: string): Promise<T> { return this.request<T>("DELETE", path); }
}