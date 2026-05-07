"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export function BackendStartingBanner() {
  const [visible, setVisible] = useState(false);
  const [message, setMessage] = useState("Server is starting, please wait...");

  useEffect(() => {
    const handler = (event: Event) => {
      const detail = (event as CustomEvent<{ message?: string }>).detail;
      setMessage(detail?.message || "Server is starting, please wait...");
      setVisible(true);
    };

    window.addEventListener("orkestron:backend:starting", handler);
    return () => window.removeEventListener("orkestron:backend:starting", handler);
  }, []);

  useEffect(() => {
    if (!visible) return;
    let cancelled = false;
    let attempts = 0;

    const intervalId = window.setInterval(async () => {
      attempts += 1;
      try {
        const res = await fetch(`${API_URL}/health`, { cache: "no-store" });
        if (!cancelled && res.ok) {
          setVisible(false);
          return;
        }
      } catch {
        // Keep banner visible while backend wakes up.
      }
      if (!cancelled && attempts >= 20) {
        setVisible(false);
      }
    }, 3000);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [visible]);

  if (!visible) return null;

  return (
    <div className="fixed top-4 left-1/2 z-[200] -translate-x-1/2">
      <div className="flex items-center gap-2 rounded-full border border-amber-400/30 bg-amber-500/10 px-4 py-2 text-xs text-amber-200 shadow-lg shadow-black/40 backdrop-blur">
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
        <span>{message}</span>
      </div>
    </div>
  );
}
