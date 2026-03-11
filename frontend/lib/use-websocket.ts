"use client";

import { useEffect, useRef, useCallback, useState } from "react";

interface WebSocketMessage {
  type: string;
  event?: string;
  run_id?: string;
  node_id?: string;
  data?: Record<string, unknown>;
  timestamp?: string;
}

interface UseOrkestronWSOptions {
  userId: string | null;
  onMessage?: (msg: WebSocketMessage) => void;
  onConnect?: () => void;
  onDisconnect?: () => void;
  autoReconnect?: boolean;
}

const WS_URL = process.env.NEXT_PUBLIC_WS_URL || "ws://localhost:8000";

export function useOrkestronWS({
  userId,
  onMessage,
  onConnect,
  onDisconnect,
  autoReconnect = true,
}: UseOrkestronWSOptions) {
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout>>();
  const [isConnected, setIsConnected] = useState(false);
  const [lastMessage, setLastMessage] = useState<WebSocketMessage | null>(null);

  const connect = useCallback(() => {
    if (!userId || wsRef.current?.readyState === WebSocket.OPEN) return;

    const ws = new WebSocket(`${WS_URL}/ws/${userId}`);
    wsRef.current = ws;

    ws.onopen = () => {
      setIsConnected(true);
      onConnect?.();
      // Start heartbeat
      const heartbeat = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: "ping" }));
        } else {
          clearInterval(heartbeat);
        }
      }, 30000);
    };

    ws.onmessage = (event) => {
      try {
        const msg: WebSocketMessage = JSON.parse(event.data);
        if (msg.type === "pong") return; // Heartbeat response
        setLastMessage(msg);
        onMessage?.(msg);
      } catch {
        // Ignore malformed messages
      }
    };

    ws.onclose = () => {
      setIsConnected(false);
      onDisconnect?.();
      wsRef.current = null;
      if (autoReconnect) {
        reconnectTimer.current = setTimeout(connect, 3000);
      }
    };

    ws.onerror = () => {
      ws.close();
    };
  }, [userId, onMessage, onConnect, onDisconnect, autoReconnect]);

  const disconnect = useCallback(() => {
    if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
    wsRef.current?.close();
    wsRef.current = null;
    setIsConnected(false);
  }, []);

  const send = useCallback((data: Record<string, unknown>) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(data));
    }
  }, []);

  const subscribeWorkflow = useCallback(
    (runId: string) => {
      send({ type: "subscribe", run_id: runId });
    },
    [send]
  );

  const unsubscribeWorkflow = useCallback(
    (runId: string) => {
      send({ type: "unsubscribe", run_id: runId });
    },
    [send]
  );

  useEffect(() => {
    connect();
    return disconnect;
  }, [connect, disconnect]);

  return {
    isConnected,
    lastMessage,
    send,
    subscribeWorkflow,
    unsubscribeWorkflow,
    disconnect,
    reconnect: connect,
  };
}
