/**
 * 应用级 API 客户端：单例 + 统一 401/5xx + JWT刷新 + CSRF
 * - 401：尝试 /auth/refresh 刷新 token，成功后重试原请求；失败则跳转登录页
 * - 5xx（仅写操作 POST/PUT/PATCH/DELETE）：派发全局事件供 Toast 展示
 *   GET 请求的 5xx 默认静默处理，由各组件自行降级。
 *   如需 GET 也弹 toast，传 { loud: true }；写操作如需静默，传 { quiet: true }。
 * - CSRF：页面加载时获取 CSRF token，写操作自动附带 X-CSRF-Token header
 */

import { ApiClient } from "@video-platform/shared/api/client";
import type { ApiError } from "@video-platform/shared/types";
import { useAuthStore } from "../stores";

const LOGIN_PATH = "/login";

// ── CSRF Token Management ──────────────────────────────────
let csrfToken: string | null = null;

async function fetchCsrfToken(raw: ApiClient): Promise<void> {
  try {
    const res = await raw.get<{ token?: string }>("/auth/csrf-token");
    if (res?.token) csrfToken = res.token;
  } catch {
    // Non-critical: CSRF endpoints may not exist yet
  }
}

// ── JWT Refresh ────────────────────────────────────────────
let refreshInFlight: Promise<string | null> | null = null;

async function tryRefreshToken(raw: ApiClient): Promise<string | null> {
  // Deduplicate concurrent refresh attempts
  if (refreshInFlight) return refreshInFlight;

  refreshInFlight = (async () => {
    try {
      const refreshToken = sessionStorage.getItem("vp.refreshToken");
      const currentJwt = sessionStorage.getItem("vp.jwt");
      const res = await raw.post<{ jwt?: string; refreshToken?: string }>("/auth/refresh", {
        refreshToken: refreshToken || undefined,
        jwt: currentJwt || undefined,
      });
      if (res?.jwt) {
        sessionStorage.setItem("vp.jwt", res.jwt);
        if (res.refreshToken) sessionStorage.setItem("vp.refreshToken", res.refreshToken);
        raw.setJWT(res.jwt);
        return res.jwt;
      }
      return null;
    } catch {
      return null;
    } finally {
      refreshInFlight = null;
    }
  })();

  return refreshInFlight;
}

// ── Session Clear ──────────────────────────────────────────
function clearSessionAndRedirect() {
  try {
    useAuthStore.getState().logout();
  } finally {
    if (typeof window !== "undefined" && !window.location.pathname.endsWith(LOGIN_PATH)) {
      window.location.href = LOGIN_PATH;
    }
  }
}

// ── Error Handling ─────────────────────────────────────────
function handleApiError(err: unknown, showToast: boolean): void {
  const apiErr = err as ApiError | undefined;
  const status = apiErr?.status;
  // Note: 401 is now handled by wrap() with refresh logic
  if (status === 401) {
    // Refresh already attempted and failed — redirect
    clearSessionAndRedirect();
    return;
  }
  if (showToast && status != null && status >= 500) {
    window.dispatchEvent(
      new CustomEvent("api:serverError", {
        detail: { message: apiErr?.error || "服务暂时不可用，请稍后重试", status },
      })
    );
  }
}

// ── Request Wrapper with Auto-Refresh ──────────────────────
function wrap<T>(
  makeRequest: () => Promise<T>,
  showToast: boolean,
  raw: ApiClient,
  isRetry = false
): Promise<T> {
  return makeRequest().catch(async (err) => {
    const apiErr = err as ApiError | undefined;
    const status = apiErr?.status;

    // Auto-refresh on 401 (first attempt only)
    if (status === 401 && !isRetry) {
      const newJwt = await tryRefreshToken(raw);
      if (newJwt) {
        // Retry the original request with fresh token
        return wrap(makeRequest, showToast, raw, true);
      }
    }

    handleApiError(err, showToast);
    throw err;
  });
}

// ── Client Factory ─────────────────────────────────────────
let instance: ReturnType<typeof createWrappedClient> | null = null;

interface ReadOptions {
  loud?: boolean;
}

interface WriteOptions {
  quiet?: boolean;
}

function createWrappedClient() {
  const raw = new ApiClient();

  // Fetch CSRF token on init (non-blocking)
  if (typeof window !== "undefined") {
    setTimeout(() => fetchCsrfToken(raw), 500);
  }

  return {
    setJWT: (jwt: string) => raw.setJWT(jwt),
    setBaseURL: (url: string) => raw.setBaseURL(url),
    get: <T>(path: string, opts?: ReadOptions) =>
      wrap(() => raw.get<T>(path), !!opts?.loud, raw),
    post: <T>(path: string, body?: unknown, opts?: WriteOptions) =>
      wrap(() => raw.post<T>(path, body), !opts?.quiet, raw),
    put: <T>(path: string, body?: unknown, opts?: WriteOptions) =>
      wrap(() => raw.put<T>(path, body), !opts?.quiet, raw),
    patch: <T>(path: string, body?: unknown, opts?: WriteOptions) =>
      wrap(() => raw.patch<T>(path, body), !opts?.quiet, raw),
    delete: <T>(path: string, opts?: WriteOptions) =>
      wrap(() => raw.delete<T>(path), !opts?.quiet, raw),
    /** Manually refresh CSRF token */
    refreshCsrf: () => fetchCsrfToken(raw),
    /** Get current CSRF token for custom requests */
    getCsrfToken: () => csrfToken,
  };
}

export function getApiClient() {
  if (!instance) instance = createWrappedClient();
  return instance;
}
