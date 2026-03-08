import { useEffect, useRef, useState, useCallback } from "react";
import { useAuthStore } from "../stores";
import { useUIStore } from "../stores";

const WS_URL = import.meta.env.VITE_WS_URL || "ws://localhost:8080/ws";

const MIN_RECONNECT_MS = 1000;
const MAX_RECONNECT_MS = 30_000;

interface UseWebSocketReturn {
  connected: boolean;
  send: (msg: unknown) => void;
}

export function useWebSocket(): UseWebSocketReturn {
  const jwt = useAuthStore((s) => s.jwt);
  const [connected, setConnected] = useState(false);

  const wsRef = useRef<WebSocket | null>(null);
  const retryRef = useRef(MIN_RECONNECT_MS);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const unmountedRef = useRef(false);

  const cleanup = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    if (wsRef.current) {
      wsRef.current.onopen = null;
      wsRef.current.onclose = null;
      wsRef.current.onerror = null;
      wsRef.current.onmessage = null;
      wsRef.current.close();
      wsRef.current = null;
    }
    setConnected(false);
  }, []);

  const connect = useCallback(() => {
    if (unmountedRef.current) return;

    const token = useAuthStore.getState().jwt;
    if (!token) return;

    cleanup();

    const ws = new WebSocket(WS_URL);
    wsRef.current = ws;

    ws.onopen = () => {
      if (unmountedRef.current) { ws.close(); return; }
      retryRef.current = MIN_RECONNECT_MS;
      setConnected(true);
      ws.send(JSON.stringify({ type: "auth", token }));
    };

    ws.onmessage = (ev) => {
      try {
        const msg = JSON.parse(ev.data);

        if (msg.type === "notification" && msg.data) {
          const notifType = msg.data.level === "error" ? "error"
            : msg.data.level === "warning" ? "warning"
            : "info";
          useUIStore.getState().addToast(notifType, msg.data.message ?? "New notification");
        }

        if (msg.type === "message") {
          window.dispatchEvent(new CustomEvent("ws:message", { detail: msg.data }));
        }
      } catch { /* ignore malformed frames */ }
    };

    ws.onclose = () => {
      setConnected(false);
      if (unmountedRef.current) return;
      scheduleReconnect();
    };

    ws.onerror = () => {
      ws.close();
    };
  }, [cleanup]);

  const scheduleReconnect = useCallback(() => {
    if (unmountedRef.current) return;
    const delay = retryRef.current;
    retryRef.current = Math.min(delay * 2, MAX_RECONNECT_MS);
    timerRef.current = setTimeout(() => connect(), delay);
  }, [connect]);

  useEffect(() => {
    unmountedRef.current = false;

    if (jwt) {
      connect();
    } else {
      cleanup();
    }

    return () => {
      unmountedRef.current = true;
      cleanup();
    };
  }, [jwt, connect, cleanup]);

  const send = useCallback((msg: unknown) => {
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(typeof msg === "string" ? msg : JSON.stringify(msg));
    }
  }, []);

  return { connected, send };
}
