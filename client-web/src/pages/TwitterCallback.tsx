// FILE: /video-platform/client-web/src/pages/TwitterCallback.tsx
/**
 * 功能说明：
 * - Twitter OAuth2（PKCE）回调页面：从 URL 读取 code/state，调用后端交换令牌并签发平台 JWT。
 * - 成功后写入 sessionStorage 并跳转到视频列表。
 */

import React from "react";
import "../styles/fun.css";
import TopNav from "../components/TopNav";
import { ApiClient } from "@video-platform/shared/api/client";
import type { AuthResponse } from "@video-platform/shared/types";
import { useNavigate } from "react-router-dom";

const client = new ApiClient();

export default function TwitterCallback() {
  const navigate = useNavigate();
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    (async () => {
      try {
        const params = new URLSearchParams(window.location.search);
        const code = params.get("code") || "";
        const state = params.get("state") || "";
        if (!code || !state) {
          setError("缺少 code 或 state");
          return;
        }
        const res = await client.post<AuthResponse>("/auth/twitter/callback", { code, state });
        if (res?.jwt) {
          client.setJWT(res.jwt);
          sessionStorage.setItem("vp.jwt", res.jwt);
          sessionStorage.setItem("vp.user", JSON.stringify(res.user));
          if (res.offlineToken) sessionStorage.setItem("vp.offlineToken", JSON.stringify(res.offlineToken));
          navigate("/videos", { replace: true });
          return;
        }
        setError("回调处理失败：未返回 JWT");
      } catch (e: any) {
        setError(e?.error || "Twitter 回调处理失败");
      }
    })();
  }, [navigate]);

  return (
    <div className="fun-bg">
      <div className="container" style={{ maxWidth: 520 }}>
        <TopNav />
        <h1 className="heading">Twitter 登录处理中...</h1>
        {!error ? (
          <div className="login-card">请稍候，正在完成授权...</div>
        ) : (
          <div className="login-card" style={{ color: "#fca5a5" }}>{error}</div>
        )}
      </div>
    </div>
  );
}