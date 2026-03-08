// FILE: /video-platform/client-web/src/pages/MagicLink.tsx
/**
 * 功能说明：
 * - 消费邮箱魔法链接中的 token，完成后端登录并签发 JWT。
 * - 成功后写入 sessionStorage 并跳转到视频列表。
 */

import React from "react";
import "../styles/fun.css";
import TopNav from "../components/TopNav";
import { ApiClient } from "@video-platform/shared/api/client";
import type { AuthResponse } from "@video-platform/shared/types";
import { useNavigate, useLocation } from "react-router-dom";

const client = new ApiClient();

export default function MagicLink() {
  const navigate = useNavigate();
  const location = useLocation();
  const [status, setStatus] = React.useState<string>("正在处理登录链接...");
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    (async () => {
      try {
        // 兼容 HashRouter：优先使用 React Router 的 location.search，其次从 hash 中解析
        const search = location.search || (window.location.hash.includes("?") ? window.location.hash.split("?")[1] : "");
        const params = new URLSearchParams(search);
        const token = params.get("token") || "";
        if (!token) {
          setError("缺少 token 参数");
          setStatus("登录链接无效");
          return;
        }
        const res = await client.post<AuthResponse>("/auth/email/magic/consume", { token });
        if (res?.jwt) {
          client.setJWT(res.jwt);
          sessionStorage.setItem("vp.jwt", res.jwt);
          sessionStorage.setItem("vp.user", JSON.stringify(res.user));
          if (res.offlineToken) sessionStorage.setItem("vp.offlineToken", JSON.stringify(res.offlineToken));
          // 首次从登录页进入首页，隐藏一次“返回”按钮
          try { sessionStorage.setItem("vp.hideBackOnce", "1"); } catch {}
          setStatus("登录成功，正在跳转...");
          navigate("/home", { replace: true });
          return;
        }
        setError("回调处理失败：未返回 JWT");
        setStatus("登录链接处理失败");
      } catch (e: any) {
        setError(e?.error || "登录链接处理失败");
        setStatus("登录链接处理失败");
      }
    })();
  }, [navigate, location.search]);

  return (
    <div className="fun-bg">
      <div className="container" style={{ maxWidth: 520 }}>
        <TopNav />
        <h1 className="heading">登录链接处理中...</h1>
        {!error ? (
          <div className="login-card">{status}</div>
        ) : (
          <div className="login-card" style={{ color: "#fca5a5" }}>{error}</div>
        )}
      </div>
    </div>
  );
}