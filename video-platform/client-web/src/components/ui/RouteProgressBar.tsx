/**
 * F17: 顶部细条路由进度条
 * 路由切换时显示，模拟 nprogress 效果
 */

import React, { useEffect, useState, useRef } from "react";
import { useLocation } from "react-router-dom";

export function RouteProgressBar() {
  const location = useLocation();
  const [progress, setProgress] = useState(0);
  const [visible, setVisible] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    setProgress(30);
    setVisible(true);

    timer.current = setTimeout(() => setProgress(70), 120);
    const done = setTimeout(() => {
      setProgress(100);
      setTimeout(() => setVisible(false), 300);
    }, 350);

    return () => {
      clearTimeout(timer.current);
      clearTimeout(done);
    };
  }, [location.pathname]);

  if (!visible && progress === 0) return null;

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        zIndex: 9999,
        height: 2,
        pointerEvents: "none",
      }}
    >
      <div
        style={{
          height: "100%",
          width: `${progress}%`,
          background: "linear-gradient(90deg, var(--accent-cyan, #00D5FF), var(--accent-purple, #9D4EDD))",
          boxShadow: "0 0 8px var(--accent-cyan, #00D5FF)",
          transition: progress === 100 ? "width 0.2s, opacity 0.3s" : "width 0.4s cubic-bezier(0.4, 0, 0.2, 1)",
          opacity: visible ? 1 : 0,
        }}
      />
    </div>
  );
}

export default RouteProgressBar;
