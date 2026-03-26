"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { api } from "@/lib/api-client";
import { useAuth } from "@/lib/auth-context";
import {
  Terminal,
  Pause,
  Play,
  ArrowDown,
  RefreshCw,
  CheckCircle2,
  XCircle,
  Clock,
  Brain,
  Search,
  Sparkles,
  Zap,
  Loader2,
  Filter,
} from "lucide-react";

type LogItem = {
  id: string;
  timestamp: string;
  level: "info" | "warn" | "error" | "debug";
  source: string;
  message: string;
  taskId?: string;
  status?: string;
  duration?: number;
};

const levelColors: Record<string, string> = {
  info: "text-indigo-400",
  warn: "text-amber-400",
  error: "text-red-400",
  debug: "text-zinc-500",
};

const sourceColors: Record<string, string> = {
  planner: "text-violet-400",
  web_search: "text-cyan-400",
  reasoning: "text-amber-400",
  data_extraction: "text-blue-400",
  comparison: "text-orange-400",
  result_generator: "text-emerald-400",
  system: "text-zinc-400",
  task: "text-indigo-400",
  agent: "text-pink-400",
};

export default function LogsPage() {
  const { getToken } = useAuth();
  const [logs, setLogs] = useState<LogItem[]>([]);
  const [isPaused, setIsPaused] = useState(false);
  const [autoScroll, setAutoScroll] = useState(true);
  const [loading, setLoading] = useState(true);
  const [filterLevel, setFilterLevel] = useState<string>("all");
  const containerRef = useRef<HTMLDivElement>(null);
  const wsRef = useRef<WebSocket | null>(null);

  // Build logs from real task data and execution logs
  const buildLogsFromTasks = useCallback(async () => {
    const token = getToken();
    if (!token) { setLoading(false); return; }

    try {
      const [tasksRes] = await Promise.allSettled([
        api.listRealTasks(token, undefined, 50),
      ]);

      const realLogs: LogItem[] = [];

      if (tasksRes.status === "fulfilled") {
        const tasks = (tasksRes.value.tasks || []) as Record<string, unknown>[];

        for (const task of tasks) {
          const taskId = task.task_id as string;
          const input = (task.input as string)?.slice(0, 100) || "Unknown task";
          const status = task.status as string;
          const created = task.created_at as string;
          const completed = task.completed_at as string;
          const duration = task.total_duration as number;
          const taskType = task.task_type as string;
          const agentPath = task.agent_path as string[];

          // Task created event
          realLogs.push({
            id: `${taskId}-created`,
            timestamp: created || new Date().toISOString(),
            level: "info",
            source: "task",
            message: `Task submitted: "${input}"`,
            taskId,
            status,
          });

          // Task type classification
          if (taskType) {
            realLogs.push({
              id: `${taskId}-classified`,
              timestamp: created || new Date().toISOString(),
              level: "info",
              source: "planner",
              message: `Classified as: ${taskType}`,
              taskId,
            });
          }

          // Agent path events
          if (agentPath && agentPath.length > 0) {
            agentPath.forEach((agent, i) => {
              const t = new Date(created || Date.now());
              t.setSeconds(t.getSeconds() + i * 2);
              realLogs.push({
                id: `${taskId}-agent-${i}`,
                timestamp: t.toISOString(),
                level: "info",
                source: agent,
                message: `Agent ${agent} executed`,
                taskId,
              });
            });
          }

          // Task completion/failure event
          if (status === "completed") {
            realLogs.push({
              id: `${taskId}-done`,
              timestamp: completed || new Date().toISOString(),
              level: "info",
              source: "system",
              message: `Task completed${duration ? ` in ${duration.toFixed(1)}s` : ""}`,
              taskId,
              status: "completed",
              duration,
            });
          } else if (status === "failed") {
            realLogs.push({
              id: `${taskId}-failed`,
              timestamp: completed || new Date().toISOString(),
              level: "error",
              source: "system",
              message: `Task failed: ${(task.error_message as string) || "Unknown error"}`,
              taskId,
              status: "failed",
            });
          } else if (status === "running" || status === "queued") {
            realLogs.push({
              id: `${taskId}-running`,
              timestamp: created || new Date().toISOString(),
              level: "info",
              source: "system",
              message: `Task ${status}...`,
              taskId,
              status,
            });
          }

          // Fetch execution logs for recent tasks
          try {
            const logData = await api.getTaskLogs(token, taskId);
            const taskLogs = (logData.logs || []) as Record<string, unknown>[];
            for (const log of taskLogs) {
              const agentType = log.agent_type as string || "unknown";
              const logStatus = log.status as string;
              const latency = log.latency_ms as number;
              const error = log.error_message as string;
              const toolsUsed = log.tools_used as string[];

              realLogs.push({
                id: (log.log_id as string) || `${taskId}-log-${log.step_index}`,
                timestamp: created || new Date().toISOString(),
                level: logStatus === "failed" || logStatus === "error" ? "error" : logStatus === "completed" || logStatus === "success" ? "info" : "debug",
                source: agentType,
                message: `${agentType} → ${logStatus}${latency ? ` (${latency}ms)` : ""}${toolsUsed?.length ? ` [tools: ${toolsUsed.join(", ")}]` : ""}${error ? ` Error: ${error}` : ""}`,
                taskId,
                status: logStatus,
                duration: latency,
              });
            }
          } catch {
            // No execution logs for this task
          }
        }
      }

      // Sort by timestamp
      realLogs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      setLogs(realLogs);
    } catch {
      // API error
    } finally {
      setLoading(false);
    }
  }, [getToken]);

  useEffect(() => {
    buildLogsFromTasks();
  }, [buildLogsFromTasks]);

  // Auto-refresh every 15s if not paused
  useEffect(() => {
    if (isPaused) return;
    const interval = setInterval(buildLogsFromTasks, 15000);
    return () => clearInterval(interval);
  }, [isPaused, buildLogsFromTasks]);

  useEffect(() => {
    if (autoScroll && containerRef.current) {
      containerRef.current.scrollTop = 0; // Newest first
    }
  }, [logs, autoScroll]);

  const handleScroll = () => {
    if (!containerRef.current) return;
    const { scrollTop } = containerRef.current;
    setAutoScroll(scrollTop < 40);
  };

  const filteredLogs = filterLevel === "all"
    ? logs
    : logs.filter((l) => l.level === filterLevel);

  const infoCount = logs.filter((l) => l.level === "info").length;
  const warnCount = logs.filter((l) => l.level === "warn").length;
  const errorCount = logs.filter((l) => l.level === "error").length;

  return (
    <div className="space-y-6 max-w-[1400px]">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Activity Logs</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Real-time task execution and agent activity logs
          </p>
        </div>
        <div className="flex items-center gap-3">
          {/* Stats */}
          <div className="flex items-center gap-3 text-xs">
            <span className="text-indigo-400">{infoCount} info</span>
            <span className="text-amber-400">{warnCount} warn</span>
            <span className="text-red-400">{errorCount} error</span>
          </div>
          <button
            onClick={buildLogsFromTasks}
            className="p-2 rounded-lg border border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.04] text-muted-foreground hover:text-foreground transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="rounded-xl border border-white/[0.06] bg-[#0d1117] overflow-hidden">
        {/* Terminal header */}
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-white/[0.04] bg-white/[0.02]">
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-full bg-red-500/60" />
              <div className="w-3 h-3 rounded-full bg-amber-500/60" />
              <div className="w-3 h-3 rounded-full bg-emerald-500/60" />
            </div>
            <span className="text-[11px] text-muted-foreground font-mono ml-2">orkestron-logs</span>
            <div className="flex items-center gap-1 ml-2">
              <div className={cn("w-1.5 h-1.5 rounded-full", !isPaused ? "bg-emerald-500 animate-pulse" : "bg-amber-500")} />
              <span className={cn("text-[10px]", !isPaused ? "text-emerald-400/70" : "text-amber-400/70")}>
                {!isPaused ? "streaming" : "paused"}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-1">
            {/* Level filter */}
            <select
              value={filterLevel}
              onChange={(e) => setFilterLevel(e.target.value)}
              className="px-2 py-1 rounded-md text-[10px] bg-white/[0.04] border border-white/[0.08] text-muted-foreground focus:outline-none"
            >
              <option value="all" className="bg-[#0d1117]">All Levels</option>
              <option value="info" className="bg-[#0d1117]">Info</option>
              <option value="warn" className="bg-[#0d1117]">Warn</option>
              <option value="error" className="bg-[#0d1117]">Error</option>
            </select>
            <button
              onClick={() => setIsPaused(!isPaused)}
              className="p-1.5 rounded-md hover:bg-white/[0.06] transition-colors"
            >
              {isPaused ? <Play className="w-3 h-3 text-muted-foreground" /> : <Pause className="w-3 h-3 text-muted-foreground" />}
            </button>
            <button
              onClick={() => {
                setAutoScroll(true);
                if (containerRef.current) containerRef.current.scrollTop = 0;
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
          className="overflow-y-auto"
          style={{ maxHeight: "calc(100vh - 280px)", minHeight: "300px" }}
        >
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="w-5 h-5 text-violet-400 animate-spin" />
            </div>
          ) : filteredLogs.length === 0 ? (
            <div className="flex items-center justify-center py-20 text-muted-foreground text-sm">
              <div className="text-center">
                <Terminal className="w-8 h-8 mx-auto mb-2 text-zinc-700" />
                <p>No logs yet</p>
                <p className="text-xs text-muted-foreground/60 mt-1">Submit tasks to generate activity logs</p>
              </div>
            </div>
          ) : (
            <AnimatePresence initial={false}>
              {filteredLogs.map((log) => (
                <motion.div
                  key={log.id}
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  transition={{ duration: 0.15 }}
                  className="log-line flex items-start gap-3 border-b border-white/[0.02] px-4 py-1.5"
                >
                  <span className="text-[10px] text-zinc-600 font-mono shrink-0 w-[72px] pt-0.5">
                    {new Date(log.timestamp).toLocaleTimeString("en-US", { hour12: false })}
                  </span>
                  <span className={cn("text-[10px] font-medium uppercase tracking-wider w-[36px] shrink-0 pt-0.5", levelColors[log.level])}>
                    {log.level}
                  </span>
                  <span className={cn("text-xs font-medium shrink-0 w-[130px]", sourceColors[log.source] || "text-zinc-400")}>
                    [{log.source}]
                  </span>
                  <span className="text-xs text-zinc-400 break-all flex-1">{log.message}</span>
                  {log.taskId && (
                    <span className="text-[9px] text-zinc-600 font-mono shrink-0">{log.taskId.slice(0, 12)}</span>
                  )}
                </motion.div>
              ))}
            </AnimatePresence>
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-1.5 border-t border-white/[0.06] bg-white/[0.01] flex items-center justify-between">
          <span className="text-[10px] text-zinc-600 font-mono">
            {filteredLogs.length} entries {filterLevel !== "all" ? `(filtered: ${filterLevel})` : ""}
          </span>
          <span className="text-[10px] text-zinc-600 font-mono">
            total: {logs.length}
          </span>
        </div>
      </div>
    </div>
  );
}
