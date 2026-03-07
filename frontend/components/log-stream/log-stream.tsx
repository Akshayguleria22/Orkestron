"use client";

import { useEffect, useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import type { LogEntry } from "@/lib/types";
import { generateLogEntry, mockLogs } from "@/lib/mock-data";
import { Terminal, Pause, Play, ArrowDown } from "lucide-react";

const levelColors: Record<string, string> = {
  info: "text-blue-400",
  warn: "text-amber-400",
  error: "text-red-400",
  debug: "text-zinc-500",
};

const agentColors: Record<string, string> = {
  Supervisor: "text-violet-400",
  "Retrieval Agent": "text-cyan-400",
  "Negotiation Agent": "text-amber-400",
  "Compliance Agent": "text-emerald-400",
  "Executor Agent": "text-orange-400",
  "Discovery Agent": "text-pink-400",
};

/**
 * Real-time log stream viewer styled like a terminal.
 * Streams mock logs at configurable intervals.
 */
export function LogStream({ className, maxHeight }: { className?: string; maxHeight?: string }) {
  const [logs, setLogs] = useState<LogEntry[]>(mockLogs);
  const [isPaused, setIsPaused] = useState(false);
  const [autoScroll, setAutoScroll] = useState(true);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isPaused) return;
    const interval = setInterval(() => {
      setLogs((prev) => [...prev.slice(-200), generateLogEntry()]);
    }, 1800);
    return () => clearInterval(interval);
  }, [isPaused]);

  useEffect(() => {
    if (autoScroll && containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [logs, autoScroll]);

  const handleScroll = () => {
    if (!containerRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = containerRef.current;
    setAutoScroll(scrollHeight - scrollTop - clientHeight < 40);
  };

  return (
    <div className={cn("flex flex-col rounded-xl border border-white/[0.06] bg-black/40 overflow-hidden", className)}>
      {/* Terminal header */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-white/[0.06] bg-white/[0.02]">
        <div className="flex items-center gap-2">
          <Terminal className="w-3.5 h-3.5 text-muted-foreground" />
          <span className="text-xs font-medium text-muted-foreground">Live Agent Logs</span>
          <div className="flex items-center gap-1 ml-2">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-[10px] text-emerald-400/70">streaming</span>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setIsPaused(!isPaused)}
            className="p-1.5 rounded-md hover:bg-white/[0.06] transition-colors"
          >
            {isPaused ? (
              <Play className="w-3 h-3 text-muted-foreground" />
            ) : (
              <Pause className="w-3 h-3 text-muted-foreground" />
            )}
          </button>
          <button
            onClick={() => {
              setAutoScroll(true);
              if (containerRef.current) containerRef.current.scrollTop = containerRef.current.scrollHeight;
            }}
            className="p-1.5 rounded-md hover:bg-white/[0.06] transition-colors"
          >
            <ArrowDown className="w-3 h-3 text-muted-foreground" />
          </button>
        </div>
      </div>

      {/* Log entries */}
      <div
        ref={containerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto min-h-[300px]"
        style={{ maxHeight: maxHeight || "500px" }}
      >
        <AnimatePresence initial={false}>
          {logs.map((log) => (
            <motion.div
              key={log.id}
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              transition={{ duration: 0.15 }}
              className="log-line flex items-start gap-3 border-b border-white/[0.02]"
            >
              <span className="text-[10px] text-zinc-600 font-mono shrink-0 w-[72px] pt-0.5">
                {new Date(log.timestamp).toLocaleTimeString("en-US", { hour12: false })}
              </span>
              <span className={cn("text-[10px] font-medium uppercase tracking-wider w-[36px] shrink-0 pt-0.5", levelColors[log.level])}>
                {log.level}
              </span>
              <span className={cn("text-xs font-medium shrink-0 w-[130px]", agentColors[log.agent] || "text-zinc-400")}>
                [{log.agent}]
              </span>
              <span className="text-xs text-zinc-400 break-all">{log.message}</span>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* Footer */}
      <div className="px-4 py-1.5 border-t border-white/[0.06] bg-white/[0.01]">
        <span className="text-[10px] text-zinc-600 font-mono">{logs.length} entries</span>
      </div>
    </div>
  );
}
