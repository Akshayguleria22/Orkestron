"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useAuth } from "@/lib/auth-context";
import { api } from "@/lib/api-client";
import type { RealTask } from "@/lib/types";
import {
  Send,
  Loader2,
  CheckCircle2,
  XCircle,
  Clock,
  Brain,
  Search,
  Sparkles,
  Zap,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  RefreshCw,
  Trash2,
  ListTodo,
  StopCircle,
  AlertTriangle,
  CircleDashed,
  ShieldAlert,
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { cn } from "@/lib/utils";

type StepStatus = "pending" | "running" | "completed" | "failed";

type StepError = {
  step?: number;
  agent?: string;
  error: string;
};

type ExecutionLogView = {
  id: string;
  task_id: string;
  agent_type: string;
  step_index: number;
  status: string;
  input_summary?: string;
  output_summary?: string;
  duration_ms?: number;
  error?: string;
  tools_used?: string[];
};

type TimelineStep = {
  key: string;
  label: string;
  status: StepStatus;
  durationMs?: number;
  stepNumber?: number;
  plannedAction?: string;
  inputSummary?: string;
  outputSummary?: string;
  error?: string;
  retryUsed: boolean;
  retryAttempts: number;
  fallbackUsed: boolean;
  toolsUsed: string[];
};

const EXECUTION_ORDER = [
  "planner",
  "web_search",
  "data_extraction",
  "reasoning",
  "comparison",
  "result_generator",
] as const;

const AGENT_LABELS: Record<string, string> = {
  planner: "Planner",
  web_search: "Web Search",
  data_extraction: "Data Extraction",
  reasoning: "Reasoning",
  comparison: "Comparison",
  result_generator: "Result Generator",
};

const AGENT_ICONS: Record<string, typeof Brain> = {
  planner: Brain,
  web_search: Search,
  reasoning: Sparkles,
  comparison: Sparkles,
  data_extraction: Search,
  result_generator: Zap,
};

const AGENT_COLORS: Record<string, string> = {
  planner: "text-violet-400 bg-violet-500/10 border-violet-500/30",
  web_search: "text-cyan-400 bg-cyan-500/10 border-cyan-500/30",
  reasoning: "text-amber-400 bg-amber-500/10 border-amber-500/30",
  comparison: "text-orange-400 bg-orange-500/10 border-orange-500/30",
  data_extraction: "text-blue-400 bg-blue-500/10 border-blue-500/30",
  result_generator: "text-emerald-400 bg-emerald-500/10 border-emerald-500/30",
};

const STATUS_CONFIG: Record<
  string,
  { icon: typeof Clock; color: string; label: string }
> = {
  pending: { icon: Clock, color: "text-zinc-400", label: "Pending" },
  queued: { icon: CircleDashed, color: "text-indigo-300", label: "Queued" },
  planning: { icon: Brain, color: "text-violet-300", label: "Planning" },
  running: { icon: Loader2, color: "text-cyan-400", label: "Running" },
  completed: {
    icon: CheckCircle2,
    color: "text-emerald-400",
    label: "Completed",
  },
  cancelled: { icon: StopCircle, color: "text-amber-400", label: "Cancelled" },
  failed: { icon: XCircle, color: "text-red-400", label: "Failed" },
};

const STATUS_BADGE: Record<StepStatus, string> = {
  pending: "bg-zinc-500/10 border-zinc-500/30 text-zinc-300",
  running: "bg-cyan-500/10 border-cyan-500/30 text-cyan-300",
  completed: "bg-emerald-500/10 border-emerald-500/30 text-emerald-300",
  failed: "bg-red-500/10 border-red-500/30 text-red-300",
};

const TASK_STATUS_BADGE: Record<string, string> = {
  pending: "bg-zinc-500/10 border-zinc-500/30 text-zinc-300",
  queued: "bg-indigo-500/10 border-indigo-500/30 text-indigo-300",
  planning: "bg-violet-500/10 border-violet-500/30 text-violet-300",
  running: "bg-cyan-500/10 border-cyan-500/30 text-cyan-300",
  completed: "bg-emerald-500/10 border-emerald-500/30 text-emerald-300",
  failed: "bg-red-500/10 border-red-500/30 text-red-300",
  cancelled: "bg-amber-500/10 border-amber-500/30 text-amber-300",
};

const EXAMPLE_TASKS = [
  "Find the cheapest RTX 4070 under ₹60,000",
  "Compare React vs Vue for enterprise apps",
  "Summarize the latest AI news this week",
  "Best budget laptops for programming in 2025",
];

export default function TasksPage() {
  const { accessToken } = useAuth();
  const token = accessToken;
  const [tasks, setTasks] = useState<RealTask[]>([]);
  const [input, setInput] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [selectedTask, setSelectedTask] = useState<RealTask | null>(null);
  const [logs, setLogs] = useState<ExecutionLogView[]>([]);
  const [logsExpanded, setLogsExpanded] = useState(false);
  const [loading, setLoading] = useState(true);
  const [deletingTaskId, setDeletingTaskId] = useState<string | null>(null);
  const [cancellingTaskId, setCancellingTaskId] = useState<string | null>(null);
  const [expandedSteps, setExpandedSteps] = useState<Record<string, boolean>>({
    planner: true,
  });
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const isTerminalTaskStatus = (status: string) =>
    ["completed", "failed", "cancelled"].includes(status.toLowerCase());

  const canCancelTaskStatus = (status: string) =>
    ["pending", "queued", "planning", "running"].includes(status.toLowerCase());

  const normalizeStatus = (status: string): StepStatus => {
    const s = status.toLowerCase();
    if (s === "success" || s === "completed") return "completed";
    if (s === "error" || s === "failed") return "failed";
    if (s === "running") return "running";
    return "pending";
  };

  const toSummaryText = (value: unknown, fallback = "Not available") => {
    if (typeof value === "string") {
      const trimmed = value.trim();
      if (!trimmed) return fallback;
      return trimmed.length > 260 ? `${trimmed.slice(0, 260)}...` : trimmed;
    }
    if (value && typeof value === "object") {
      const text = JSON.stringify(value);
      return text.length > 260 ? `${text.slice(0, 260)}...` : text;
    }
    return fallback;
  };

  const parseWarnings = (task: RealTask | null): string[] => {
    if (!task) return [];
    const root = task as unknown as Record<string, unknown>;
    const direct = Array.isArray(root.warnings) ? root.warnings : [];
    const resultWarnings = Array.isArray(task.result?.warnings)
      ? (task.result?.warnings as unknown[])
      : [];
    return [...direct, ...resultWarnings]
      .map((w) => (typeof w === "string" ? w : JSON.stringify(w)))
      .filter(Boolean);
  };

  const parseStepErrors = (task: RealTask | null): StepError[] => {
    if (!task) return [];
    const root = task as unknown as Record<string, unknown>;
    const direct = Array.isArray(root.step_errors) ? root.step_errors : [];
    const resultErrors = Array.isArray(task.result?.step_errors)
      ? (task.result?.step_errors as unknown[])
      : [];
    return [...direct, ...resultErrors]
      .map((entry) => {
        if (typeof entry === "string") {
          return { error: entry } as StepError;
        }
        if (entry && typeof entry === "object") {
          const item = entry as Record<string, unknown>;
          return {
            step: typeof item.step === "number" ? item.step : undefined,
            agent: typeof item.agent === "string" ? item.agent : undefined,
            error:
              typeof item.error === "string"
                ? item.error
                : JSON.stringify(item),
          } as StepError;
        }
        return { error: String(entry) } as StepError;
      })
      .filter((e) => Boolean(e.error));
  };

  const intermediateKeys = (task: RealTask | null): string[] => {
    if (!task) return [];
    const root = task as unknown as Record<string, unknown>;
    const direct = Array.isArray(root.intermediate_keys)
      ? (root.intermediate_keys as string[])
      : [];
    const inResult = Array.isArray(task.result?.intermediate_keys)
      ? (task.result?.intermediate_keys as string[])
      : [];
    return [...direct, ...inResult].filter((k) => typeof k === "string");
  };

  const inferRetryAttempts = (text?: string): number => {
    if (!text) return 0;
    const matches = [...text.matchAll(/attempt\s*(\d+)/gi)].map((m) =>
      Number(m[1]),
    );
    if (!matches.length) return /retry/i.test(text) ? 2 : 0;
    return Math.max(...matches);
  };

  const buildTimeline = (
    task: RealTask | null,
    taskLogs: ExecutionLogView[],
  ): TimelineStep[] => {
    const path = task?.agent_path ?? [];
    const warnings = parseWarnings(task).join(" | ");
    const stepErrors = parseStepErrors(task);
    const iKeys = intermediateKeys(task);
    const planSteps = task?.plan?.steps ?? [];

    return EXECUTION_ORDER.map((agent, idx) => {
      const logsForAgent = taskLogs.filter((l) => l.agent_type === agent);
      const latestLog = logsForAgent.sort((a, b) => b.step_index - a.step_index)[0];
      const planStep = planSteps.find((s) => s.agent === agent);
      const relatedStepError =
        stepErrors.find((e) => e.agent === agent) ??
        stepErrors.find((e) => e.step === planStep?.step);
      const statusFromLog = latestLog ? normalizeStatus(latestLog.status) : "pending";
      const hasStarted =
        path.includes(agent) ||
        logsForAgent.length > 0 ||
        Boolean(planStep) ||
        iKeys.includes(agent);

      let status: StepStatus = "pending";
      if (relatedStepError || statusFromLog === "failed") {
        status = "failed";
      } else if (statusFromLog !== "pending") {
        status = statusFromLog;
      } else if (task?.status === "running") {
        if (path.includes(agent)) {
          status = "completed";
        } else if (idx === path.length) {
          status = "running";
        }
      } else if ((task?.status === "completed" || task?.status === "failed") && hasStarted) {
        status = "completed";
      }

      const errorText =
        relatedStepError?.error ||
        latestLog?.error ||
        (status === "failed" ? "Step failed" : undefined);
      const retryFromError = inferRetryAttempts(errorText);
      const retryFromWarn = inferRetryAttempts(warnings);
      const retryAttempts = Math.max(retryFromError, retryFromWarn, logsForAgent.length > 1 ? 2 : 0);
      const retryUsed = retryAttempts > 1;
      const fallbackUsed =
        /fallback|partial execution|insufficient reliable data|could not be generated/i.test(
          `${errorText ?? ""} ${warnings} ${latestLog?.output_summary ?? ""} ${task?.result_text ?? ""}`,
        ) ||
        Boolean(relatedStepError && task?.status === "completed");

      return {
        key: agent,
        label: AGENT_LABELS[agent] || agent,
        status,
        durationMs: latestLog?.duration_ms,
        stepNumber: planStep?.step,
        plannedAction: planStep?.action,
        inputSummary:
          latestLog?.input_summary ||
          planStep?.action ||
          (idx === 0 ? task?.input : undefined),
        outputSummary:
          latestLog?.output_summary ||
          (iKeys.includes(agent)
            ? "Output captured in intermediate results"
            : undefined),
        error: errorText,
        retryUsed,
        retryAttempts,
        fallbackUsed,
        toolsUsed: latestLog?.tools_used ?? [],
      };
    });
  };

  const fetchTasks = useCallback(async () => {
    if (!token) return;
    try {
      const data = await api.listRealTasks(token);
      setTasks((data.tasks || []) as unknown as RealTask[]);
    } catch {
      /* ignore */
    }
  }, [token]);

  const deleteTaskFromHistory = useCallback(
    async (taskId: string) => {
      if (!token) return;
      setDeletingTaskId(taskId);
      try {
        await api.deleteRealTask(token, taskId);
        setTasks((prev) => prev.filter((t) => t.task_id !== taskId));
        if (selectedTask?.task_id === taskId) {
          setSelectedTask(null);
          setLogs([]);
        }
      } finally {
        setDeletingTaskId(null);
      }
    },
    [token, selectedTask?.task_id],
  );

  const fetchTask = useCallback(async (taskId: string) => {
    if (!token) return;
    try {
      const data = await api.getRealTask(token, taskId);
      const task = data as unknown as RealTask;
      setSelectedTask(task);
      setTasks((prev) => prev.map((t) => (t.task_id === taskId ? task : t)));
      return task;
    } catch {
      return null;
    }
  }, [token]);

  const fetchLogs = useCallback(async (taskId: string) => {
    if (!token) return;
    try {
      const data = await api.getTaskLogs(token, taskId);
      const mapped = ((data.logs || []) as Record<string, unknown>[]).map(
        (entry, idx) => {
          const inputSummary =
            typeof entry.input_summary === "string"
              ? entry.input_summary
              : toSummaryText(entry.input_data, "Input unavailable");
          const outputSummary =
            typeof entry.output_summary === "string"
              ? entry.output_summary
              : toSummaryText(entry.output_data, "Output unavailable");
          return {
            id:
              (entry.log_id as string) ||
              (entry.id as string) ||
              `${taskId}-${idx}`,
            task_id: (entry.task_id as string) || taskId,
            agent_type: (entry.agent_type as string) || "unknown",
            step_index: Number(entry.step_index ?? idx + 1),
            status: String(entry.status || "pending"),
            input_summary: inputSummary,
            output_summary: outputSummary,
            duration_ms: Number(entry.latency_ms ?? entry.duration_ms ?? 0) || undefined,
            error:
              (entry.error_message as string) ||
              (entry.error as string) ||
              undefined,
            tools_used: Array.isArray(entry.tools_used)
              ? (entry.tools_used as string[])
              : [],
          } as ExecutionLogView;
        },
      );
      setLogs(mapped);
    } catch {
      /* ignore */
    }
  }, [token]);

  const cancelTask = useCallback(
    async (taskId: string) => {
      if (!token || cancellingTaskId) return;
      setCancellingTaskId(taskId);
      try {
        await api.cancelRealTask(token, taskId, "Cancelled by user");
        await Promise.all([fetchTasks(), fetchTask(taskId), fetchLogs(taskId)]);
      } catch {
        // no-op
      } finally {
        setCancellingTaskId(null);
      }
    },
    [token, cancellingTaskId, fetchTask, fetchTasks, fetchLogs],
  );

  // Initial load
  useEffect(() => {
    fetchTasks().finally(() => setLoading(false));
  }, [fetchTasks]);

  // Poll selected task if it's in-progress
  useEffect(() => {
    if (pollRef.current) clearInterval(pollRef.current);
    if (!selectedTask || isTerminalTaskStatus(selectedTask.status)) return;

    pollRef.current = setInterval(async () => {
      const updated = await fetchTask(selectedTask.task_id);
      if (updated) fetchLogs(updated.task_id);
      if (updated?.status && isTerminalTaskStatus(updated.status)) {
        if (pollRef.current) clearInterval(pollRef.current);
      }
    }, 2000);

    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [selectedTask?.task_id, selectedTask?.status, fetchTask, fetchLogs]);

  const handleSubmit = async () => {
    if (!input.trim() || !token || submitting) return;
    setSubmitting(true);
    try {
      const data = await api.submitRealTask(token, input.trim());
      setInput("");
      await fetchTasks();
      const newTask: RealTask = {
        task_id: data.task_id,
        input: input.trim(),
        status: "pending" as const,
        created_at: new Date().toISOString(),
      };
      setSelectedTask(newTask);
      setLogs([]);
      setLogsExpanded(true);
      // Start polling
      setTimeout(() => fetchTask(data.task_id), 1000);
    } catch {
      /* handle error */
    } finally {
      setSubmitting(false);
    }
  };

  const selectTask = async (task: RealTask) => {
    setSelectedTask(task);
    setLogsExpanded(true);
    await Promise.all([fetchTask(task.task_id), fetchLogs(task.task_id)]);
  };

  const statusConfig = (status: string) => STATUS_CONFIG[status] || STATUS_CONFIG.pending;
  const stepList = buildTimeline(selectedTask, logs);
  const completedCount = stepList.filter((s) => s.status === "completed").length;
  const failedCount = stepList.filter((s) => s.status === "failed").length;
  const activeCount = stepList.filter((s) => s.status === "running").length;
  const progressPct = Math.round((completedCount / stepList.length) * 100);
  const warnings = parseWarnings(selectedTask);
  const stepErrors = parseStepErrors(selectedTask);
  const iKeys = intermediateKeys(selectedTask);

  const resultSummary =
    selectedTask?.result?.summary ||
    selectedTask?.result_text?.split("\n").find((line) => line.trim().length > 0) ||
    "No summary available";

  const resultSources =
    (selectedTask?.result?.sources as { title: string; url: string }[] | undefined) ||
    [];

  const toggleStep = (key: string) => {
    setExpandedSteps((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const statusPill = (status: StepStatus) => (
    <span className={cn("text-[10px] px-2 py-0.5 rounded border font-medium", STATUS_BADGE[status])}>
      {status}
    </span>
  );

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <ListTodo className="w-6 h-6 text-violet-400" />
          AI Tasks
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Submit tasks in natural language — real AI agents will process them.
        </p>
      </div>

      {/* Task Input */}
      <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
        <div className="flex gap-3">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
            placeholder='Describe your task... e.g. "Find cheapest RTX 4070 under ₹60,000"'
            className="flex-1 bg-white/[0.04] border border-white/[0.08] rounded-lg px-4 py-2.5 text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:border-violet-500/40 transition-colors"
          />
          <button
            onClick={handleSubmit}
            disabled={!input.trim() || submitting}
            className="px-5 py-2.5 rounded-lg bg-gradient-to-r from-violet-600 to-violet-500 hover:from-violet-500 hover:to-violet-400 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-medium flex items-center gap-2 transition-all shadow-lg shadow-violet-600/20"
          >
            {submitting ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
            Submit
          </button>
        </div>
        <div className="flex flex-wrap gap-2 mt-3">
          {EXAMPLE_TASKS.map((ex) => (
            <button
              key={ex}
              onClick={() => setInput(ex)}
              className="text-[11px] px-2.5 py-1 rounded-md border border-white/[0.06] bg-white/[0.02] text-muted-foreground hover:text-foreground hover:border-violet-500/20 transition-colors"
            >
              {ex}
            </button>
          ))}
        </div>
      </div>

      {/* Main Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Task List */}
        <div className="lg:col-span-1 space-y-2">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-medium text-muted-foreground">
              Recent Tasks
            </h3>
            <button
              onClick={fetchTasks}
              className="text-muted-foreground hover:text-foreground transition-colors"
              title="Refresh tasks"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
          </div>

          {loading ? (
            <div className="space-y-2 animate-pulse">
              {[...Array(5)].map((_, i) => (
                <div
                  key={i}
                  className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-3 space-y-2"
                >
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 rounded-full bg-white/[0.05]" />
                    <div className="h-4 flex-1 bg-white/[0.05] rounded" />
                  </div>
                  <div className="flex items-center gap-2 pl-6">
                    <div className="h-3 w-16 bg-white/[0.03] rounded" />
                    <div className="h-3 w-12 bg-white/[0.03] rounded" />
                  </div>
                </div>
              ))}
            </div>
          ) : tasks.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground text-sm border border-white/[0.06] rounded-xl bg-white/[0.01]">
              No tasks yet. Submit your first task above.
            </div>
          ) : (
            <div className="space-y-1.5 max-h-[600px] overflow-y-auto pr-1">
              {tasks.map((task) => {
                const sc = statusConfig(task.status);
                const Icon = sc.icon;
                const isActive = selectedTask?.task_id === task.task_id;
                return (
                  <div
                    key={task.task_id}
                    className={cn(
                      "w-full rounded-lg border p-3 transition-all",
                      isActive
                        ? "border-violet-500/30 bg-violet-500/[0.06]"
                        : "border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.04]",
                    )}
                  >
                    <div className="flex items-start gap-2">
                      <button
                        onClick={() => selectTask(task)}
                        className="flex flex-1 items-start gap-2 text-left"
                      >
                        <Icon
                          className={cn(
                            "w-4 h-4 mt-0.5 shrink-0",
                            sc.color,
                            task.status === "running" && "animate-spin",
                          )}
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm truncate">{task.input}</p>
                          <div className="flex items-center gap-2 mt-1">
                            <span
                              className={cn(
                                "text-[10px] font-medium",
                                sc.color,
                              )}
                            >
                              {sc.label}
                            </span>
                            {task.total_duration && (
                              <span className="text-[10px] text-muted-foreground">
                                {task.total_duration.toFixed(1)}s
                              </span>
                            )}
                          </div>
                        </div>
                      </button>

                      <button
                        onClick={() => deleteTaskFromHistory(task.task_id)}
                        disabled={
                          deletingTaskId === task.task_id ||
                          canCancelTaskStatus(task.status)
                        }
                        className="p-1.5 rounded-md border border-white/[0.08] bg-white/[0.03] text-muted-foreground hover:text-red-300 hover:border-red-500/30 disabled:opacity-40"
                        title={
                          canCancelTaskStatus(task.status)
                            ? "Stop task before removing"
                            : "Remove from history"
                        }
                      >
                        {deletingTaskId === task.task_id ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Trash2 className="w-3.5 h-3.5" />
                        )}
                      </button>

                      {canCancelTaskStatus(task.status) && (
                        <button
                          onClick={() => cancelTask(task.task_id)}
                          disabled={cancellingTaskId === task.task_id}
                          className="p-1.5 rounded-md border border-white/[0.08] bg-white/[0.03] text-muted-foreground hover:text-amber-300 hover:border-amber-500/30 disabled:opacity-40"
                          title="Stop task"
                        >
                          {cancellingTaskId === task.task_id ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <StopCircle className="w-3.5 h-3.5" />
                          )}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Task Detail */}
        <div className="lg:col-span-2">
          {!selectedTask ? (
            <div className="text-center py-20 text-muted-foreground text-sm border border-white/[0.06] rounded-xl bg-white/[0.01]">
              Select a task or submit a new one to see results.
            </div>
          ) : (
            <div className="space-y-4">
              {/* Task Header */}
              <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3 flex-1">
                    {(() => {
                      const sc = statusConfig(selectedTask.status);
                      const Icon = sc.icon;
                      return (
                        <Icon
                          className={cn(
                            "w-5 h-5 mt-0.5 shrink-0",
                            sc.color,
                            selectedTask.status === "running" && "animate-spin",
                          )}
                        />
                      );
                    })()}
                    <div className="flex-1">
                      <p className="font-medium">{selectedTask.input}</p>
                      <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                        <span
                          className={cn(
                            "px-2 py-0.5 rounded border text-[10px] font-medium",
                            TASK_STATUS_BADGE[
                              selectedTask.status.toLowerCase()
                            ] || STATUS_BADGE.pending,
                          )}
                        >
                          {statusConfig(selectedTask.status).label}
                        </span>
                        {selectedTask.task_type && (
                          <span className="px-2 py-0.5 rounded bg-white/[0.04] border border-white/[0.06]">
                            {selectedTask.task_type}
                          </span>
                        )}
                        {selectedTask.total_duration && (
                          <span>
                            Completed in{" "}
                            {selectedTask.total_duration.toFixed(1)}s
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {canCancelTaskStatus(selectedTask.status) && (
                    <button
                      onClick={() => cancelTask(selectedTask.task_id)}
                      disabled={cancellingTaskId === selectedTask.task_id}
                      className="px-3 py-2 rounded-md border border-amber-500/30 bg-amber-500/10 text-amber-300 hover:bg-amber-500/20 disabled:opacity-50 text-xs font-medium flex items-center gap-2"
                    >
                      {cancellingTaskId === selectedTask.task_id ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <StopCircle className="w-3.5 h-3.5" />
                      )}
                      Stop task
                    </button>
                  )}
                </div>

                <div className="mt-4">
                  <div className="flex items-center justify-between text-[11px] text-muted-foreground mb-1.5">
                    <span>
                      Progress: {completedCount}/{stepList.length} completed
                      {activeCount > 0 && ` · ${activeCount} running`}
                      {failedCount > 0 && ` · ${failedCount} failed`}
                    </span>
                    <span>{progressPct}%</span>
                  </div>
                  <div className="h-2 w-full bg-white/[0.04] rounded-full overflow-hidden">
                    <div
                      className={cn(
                        "h-full transition-all",
                        failedCount > 0
                          ? "bg-gradient-to-r from-amber-500 to-red-500"
                          : "bg-gradient-to-r from-violet-500 to-emerald-500",
                      )}
                      style={{ width: `${progressPct}%` }}
                    />
                  </div>
                </div>

                {/* Agent Path */}
                {selectedTask.agent_path &&
                  selectedTask.agent_path.length > 0 && (
                    <div className="mt-4 flex flex-wrap items-center gap-1.5">
                      {selectedTask.agent_path.map((agent, i) => {
                        const colors =
                          AGENT_COLORS[agent] ||
                          "text-zinc-400 bg-zinc-500/10 border-zinc-500/30";
                        const AgentIcon = AGENT_ICONS[agent] || Brain;
                        return (
                          <div key={i} className="flex items-center gap-1.5">
                            <span
                              className={cn(
                                "inline-flex items-center gap-1 px-2 py-0.5 rounded border text-[11px]",
                                colors,
                              )}
                            >
                              <AgentIcon className="w-3 h-3" />
                              {agent}
                            </span>
                            {i < selectedTask.agent_path!.length - 1 && (
                              <ChevronRight className="w-3 h-3 text-zinc-600" />
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
              </div>

              {/* Warnings and Errors */}
              {(warnings.length > 0 || stepErrors.length > 0) && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="rounded-xl border border-amber-500/20 bg-amber-500/[0.04] p-4">
                    <h3 className="text-sm font-semibold text-amber-300 mb-2 flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4" />
                      Warnings ({warnings.length})
                    </h3>
                    {warnings.length === 0 ? (
                      <p className="text-xs text-muted-foreground">
                        No warnings
                      </p>
                    ) : (
                      <ul className="space-y-1.5">
                        {warnings.map((warning, idx) => (
                          <li
                            key={`${warning}-${idx}`}
                            className="text-xs text-amber-100/90 leading-relaxed"
                          >
                            {warning}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>

                  <div className="rounded-xl border border-red-500/20 bg-red-500/[0.04] p-4">
                    <h3 className="text-sm font-semibold text-red-300 mb-2 flex items-center gap-2">
                      <ShieldAlert className="w-4 h-4" />
                      Step Errors ({stepErrors.length})
                    </h3>
                    {stepErrors.length === 0 ? (
                      <p className="text-xs text-muted-foreground">
                        No step errors
                      </p>
                    ) : (
                      <ul className="space-y-2">
                        {stepErrors.map((entry, idx) => (
                          <li
                            key={`${entry.error}-${idx}`}
                            className="text-xs text-red-100/90 leading-relaxed"
                          >
                            <span className="font-medium">
                              {entry.agent || "unknown step"}
                              {typeof entry.step === "number" &&
                                ` (step ${entry.step})`}
                              :
                            </span>{" "}
                            {entry.error}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
              )}

              {/* Execution Timeline */}
              <div className="rounded-xl border border-white/[0.06] bg-white/[0.02]">
                <div className="px-4 py-3 border-b border-white/[0.06] flex items-center justify-between">
                  <h3 className="text-sm font-semibold flex items-center gap-2">
                    <CircleDashed className="w-4 h-4 text-cyan-400" />
                    Execution Timeline
                  </h3>
                  <span className="text-[10px] text-muted-foreground uppercase tracking-wider">
                    planner → web_search → data_extraction → reasoning →
                    comparison → result_generator
                  </span>
                </div>

                <div className="p-3 space-y-2">
                  {stepList.map((step) => {
                    const StepIcon = AGENT_ICONS[step.key] || Brain;
                    const expanded = Boolean(expandedSteps[step.key]);
                    const color =
                      AGENT_COLORS[step.key] ||
                      "text-zinc-300 bg-zinc-500/10 border-zinc-500/30";
                    return (
                      <div
                        key={step.key}
                        className="rounded-lg border border-white/[0.06] bg-white/[0.01]"
                      >
                        <button
                          onClick={() => toggleStep(step.key)}
                          className="w-full px-3 py-2.5 flex items-center gap-3 hover:bg-white/[0.03] transition-colors"
                        >
                          <span
                            className={cn(
                              "inline-flex items-center gap-1 px-2 py-0.5 rounded border text-[10px]",
                              color,
                            )}
                          >
                            <StepIcon className="w-3 h-3" />
                            {step.label}
                          </span>
                          {statusPill(step.status)}
                          {step.durationMs ? (
                            <span className="text-[11px] text-muted-foreground">
                              {Math.round(step.durationMs)}ms
                            </span>
                          ) : (
                            <span className="text-[11px] text-muted-foreground">
                              duration: n/a
                            </span>
                          )}
                          {step.retryUsed && (
                            <span className="text-[10px] px-2 py-0.5 rounded border border-amber-500/30 bg-amber-500/10 text-amber-300">
                              Retry used
                            </span>
                          )}
                          {step.fallbackUsed && (
                            <span className="text-[10px] px-2 py-0.5 rounded border border-orange-500/30 bg-orange-500/10 text-orange-300">
                              Fallback response
                            </span>
                          )}
                          <span className="ml-auto text-muted-foreground">
                            <ChevronDown
                              className={cn(
                                "w-4 h-4 transition-transform",
                                expanded && "rotate-180",
                              )}
                            />
                          </span>
                        </button>

                        {expanded && (
                          <div className="px-3 pb-3 pt-1 border-t border-white/[0.05] grid grid-cols-1 md:grid-cols-2 gap-3">
                            <div className="rounded-md border border-white/[0.06] bg-white/[0.02] p-2.5">
                              <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">
                                Input
                              </p>
                              <p className="text-xs text-foreground/90 leading-relaxed whitespace-pre-wrap">
                                {step.inputSummary || "No input data available"}
                              </p>
                            </div>

                            <div className="rounded-md border border-white/[0.06] bg-white/[0.02] p-2.5">
                              <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">
                                Output
                              </p>
                              <p className="text-xs text-foreground/90 leading-relaxed whitespace-pre-wrap">
                                {step.outputSummary ||
                                  "No output summary available"}
                              </p>
                            </div>

                            <div className="rounded-md border border-white/[0.06] bg-white/[0.02] p-2.5">
                              <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">
                                Error
                              </p>
                              <p
                                className={cn(
                                  "text-xs leading-relaxed",
                                  step.error
                                    ? "text-red-300"
                                    : "text-muted-foreground",
                                )}
                              >
                                {step.error || "No error"}
                              </p>
                            </div>

                            <div className="rounded-md border border-white/[0.06] bg-white/[0.02] p-2.5">
                              <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">
                                Step Metadata
                              </p>
                              <div className="text-xs text-muted-foreground space-y-1">
                                <p>Step: {step.stepNumber ?? "n/a"}</p>
                                <p>Retry attempts: {step.retryAttempts || 0}</p>
                                <p>
                                  Tools:{" "}
                                  {step.toolsUsed.length
                                    ? step.toolsUsed.join(", ")
                                    : "n/a"}
                                </p>
                                <p>
                                  Planned action: {step.plannedAction || "n/a"}
                                </p>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Result */}
              {(selectedTask.result_text || selectedTask.result) && (
                <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/[0.03] p-5 space-y-4">
                  <h3 className="text-sm font-semibold text-emerald-400 mb-1 flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4" />
                    Result
                  </h3>

                  <div className="rounded-lg border border-emerald-500/20 bg-[#0d1117] p-5 shadow-inner overflow-hidden">
                    <p className="text-[10px] uppercase tracking-wider text-emerald-300/80 mb-4 border-b border-emerald-500/20 pb-2 font-semibold">
                      Verified Agent Result
                    </p>
                    <div className="prose prose-invert prose-emerald prose-sm max-w-none text-foreground/90 whitespace-normal marker:text-emerald-500">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>
                        {selectedTask.result_text ||
                          selectedTask.result?.result_text ||
                          "No result_text returned"}
                      </ReactMarkdown>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div className="rounded-md border border-white/[0.06] bg-white/[0.02] p-3">
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">
                        Summary
                      </p>
                      <p className="text-xs text-foreground/90 leading-relaxed whitespace-pre-wrap">
                        {resultSummary}
                      </p>
                    </div>

                    <div className="rounded-md border border-white/[0.06] bg-white/[0.02] p-3 md:col-span-2">
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">
                        Metadata
                      </p>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs text-muted-foreground">
                        <span>
                          Task type: {selectedTask.task_type || "n/a"}
                        </span>
                        <span>Status: {selectedTask.status}</span>
                        <span>
                          Duration:{" "}
                          {selectedTask.total_duration
                            ? `${selectedTask.total_duration.toFixed(2)}s`
                            : "n/a"}
                        </span>
                        <span>
                          Agents run: {selectedTask.agent_path?.length || 0}
                        </span>
                        <span>Warnings: {warnings.length}</span>
                        <span>Step errors: {stepErrors.length}</span>
                        <span>Intermediate keys: {iKeys.length}</span>
                        <span>Logs: {logs.length}</span>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-md border border-white/[0.06] bg-white/[0.02] p-3">
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2">
                      Sources
                    </p>
                    {resultSources.length > 0 ? (
                      <div className="space-y-1">
                        {resultSources.slice(0, 10).map((source, i) => (
                          <a
                            key={`${source.url}-${i}`}
                            href={source.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-2 text-xs text-muted-foreground hover:text-violet-400 transition-colors"
                          >
                            <ExternalLink className="w-3 h-3 shrink-0" />
                            <span className="truncate">
                              {source.title || source.url}
                            </span>
                          </a>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground">
                        No sources returned.
                      </p>
                    )}
                  </div>

                  {iKeys.length > 0 && (
                    <div className="rounded-md border border-white/[0.06] bg-white/[0.02] p-3">
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2">
                        Intermediate Keys
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {iKeys.map((key) => (
                          <span
                            key={key}
                            className="text-[10px] px-2 py-0.5 rounded border border-white/[0.08] bg-white/[0.03] text-muted-foreground"
                          >
                            {key}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Error */}
              {selectedTask.status === "failed" &&
                selectedTask.error_message && (
                  <div className="rounded-xl border border-red-500/20 bg-red-500/[0.03] p-5">
                    <h3 className="text-sm font-semibold text-red-400 mb-2 flex items-center gap-2">
                      <XCircle className="w-4 h-4" />
                      Error
                    </h3>
                    <p className="text-sm text-red-300/80">
                      {selectedTask.error_message}
                    </p>
                  </div>
                )}

              {selectedTask.status === "cancelled" && (
                <div className="rounded-xl border border-amber-500/20 bg-amber-500/[0.03] p-5">
                  <h3 className="text-sm font-semibold text-amber-300 mb-2 flex items-center gap-2">
                    <StopCircle className="w-4 h-4" />
                    Task Cancelled
                  </h3>
                  <p className="text-sm text-amber-100/90">
                    {selectedTask.error_message ||
                      "Execution was stopped by user."}
                  </p>
                </div>
              )}

              {/* In-progress indicator */}
              {canCancelTaskStatus(selectedTask.status) && (
                <div className="rounded-xl border border-cyan-500/20 bg-cyan-500/[0.03] p-5 flex items-center gap-3">
                  <Loader2 className="w-5 h-5 text-cyan-400 animate-spin" />
                  <div>
                    <p className="text-sm font-medium text-cyan-300">
                      Agents executing...
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Results will appear here automatically.
                    </p>
                  </div>
                </div>
              )}

              {/* Execution Logs */}
              {logs.length > 0 && (
                <div className="rounded-xl border border-white/[0.06] bg-white/[0.02]">
                  <button
                    onClick={() => setLogsExpanded(!logsExpanded)}
                    className="w-full flex items-center justify-between p-4 text-sm font-medium hover:bg-white/[0.02] transition-colors"
                  >
                    <span className="flex items-center gap-2">
                      Raw Execution Logs
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/[0.06] text-muted-foreground">
                        {logs.length}
                      </span>
                    </span>
                    <ChevronDown
                      className={cn(
                        "w-4 h-4 transition-transform",
                        logsExpanded && "rotate-180",
                      )}
                    />
                  </button>
                  {logsExpanded && (
                    <div className="px-4 pb-4 space-y-2">
                      {logs.map((log) => {
                        const colors =
                          AGENT_COLORS[log.agent_type] ||
                          "text-zinc-400 bg-zinc-500/10 border-zinc-500/30";
                        return (
                          <div
                            key={log.id}
                            className="flex items-start gap-3 p-3 rounded-lg bg-white/[0.02] border border-white/[0.04]"
                          >
                            <span
                              className={cn(
                                "inline-flex items-center gap-1 px-2 py-0.5 rounded border text-[10px] shrink-0 mt-0.5",
                                colors,
                              )}
                            >
                              {log.agent_type}
                            </span>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                {statusPill(normalizeStatus(log.status))}
                                {log.duration_ms && (
                                  <span className="text-[10px] text-muted-foreground">
                                    {log.duration_ms}ms
                                  </span>
                                )}
                              </div>
                              {log.output_summary && (
                                <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                                  {log.output_summary}
                                </p>
                              )}
                              {log.error && (
                                <p className="text-xs text-red-400/80 mt-1">
                                  {log.error}
                                </p>
                              )}
                              {log.tools_used && log.tools_used.length > 0 && (
                                <p className="text-[10px] text-muted-foreground mt-1">
                                  Tools: {log.tools_used.join(", ")}
                                </p>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
