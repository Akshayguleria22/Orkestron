"use client";

import { useState, useEffect, useCallback } from "react";
import { cn } from "@/lib/utils";
import {
  Brain,
  Search,
  Handshake,
  Shield,
  Play,
  CheckCircle,
  XCircle,
  Clock,
  ChevronRight,
  Activity,
  ArrowRight,
  Zap,
  RefreshCw,
  AlertTriangle,
} from "lucide-react";
import { api } from "@/lib/api-client";
import { useAuth } from "@/lib/auth-context";

/* ── Types for observatory traces ── */
interface TraceNode {
  agent: string;
  status: string;
  duration: number;
  step: number;
  error?: string;
}

interface ExecutionTrace {
  trace_id: string;
  task_id: string;
  status: string;
  nodes: TraceNode[];
  total_duration: number | null;
  started_at: string | null;
  completed_at: string | null;
}

interface ObservatoryStats {
  total_traces: number;
  completed: number;
  failed: number;
  running: number;
  success_rate: number;
  avg_duration: number;
}

/* ── Agent icon mapping ── */
const agentIcons: Record<string, typeof Brain> = {
  planner: Brain,
  web_search: Search,
  data_extraction: Handshake,
  reasoning: Shield,
  comparison: Activity,
  result_generator: Play,
};

const statusIcon = (status: string) => {
  switch (status) {
    case "completed":
      return <CheckCircle className="w-4 h-4 text-emerald-400" />;
    case "running":
      return <Activity className="w-4 h-4 text-indigo-400 animate-pulse" />;
    case "error":
    case "failed":
      return <XCircle className="w-4 h-4 text-red-400" />;
    default:
      return <Clock className="w-4 h-4 text-zinc-500" />;
  }
};

export default function ObservatoryPage() {
  const { getToken } = useAuth();
  const [traces, setTraces] = useState<ExecutionTrace[]>([]);
  const [stats, setStats] = useState<ObservatoryStats | null>(null);
  const [selected, setSelected] = useState<ExecutionTrace | null>(null);
  const [expandedNode, setExpandedNode] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    const token = getToken();
    if (!token) return;

    try {
      const [tracesResp, statsResp] = await Promise.all([
        api.getTraces(token).catch(() => ({ traces: [], count: 0 })),
        api.getObservatoryStats(token).catch(() => ({ stats: null })),
      ]);
      let traceList = (tracesResp.traces ||
        []) as unknown as ExecutionTrace[];

      // Also fetch platform agent runs and convert to trace format
      try {
        const runsResp = await api.listPlatformRuns(token, undefined, 30);
        const agentRuns = (runsResp.runs || []) as Record<string, unknown>[];
        const runTraces: ExecutionTrace[] = agentRuns.map((r) => ({
          trace_id: (r.run_id as string) || "",
          task_id: (r.agent_id as string) || "",
          status: (r.status as string) || "pending",
          nodes: ((r.steps as { tool: string; status: string; duration_ms: number; output_summary?: string; error?: string }[]) || []).map(
            (step, idx) => ({
              agent: step.tool || "unknown",
              status: step.status === "completed" ? "completed" : step.status === "failed" ? "error" : step.status,
              duration: Math.round((step.duration_ms || 0) / 1000 * 100) / 100,
              step: idx + 1,
              error: step.error,
            })
          ),
          total_duration: (r.total_duration as number) || null,
          started_at: (r.created_at as string) || null,
          completed_at: (r.completed_at as string) || null,
        }));

        // Merge — platform runs first (most recent)
        const existingIds = new Set(traceList.map((t) => t.trace_id));
        const uniqueRunTraces = runTraces.filter((rt) => !existingIds.has(rt.trace_id));
        traceList = [...uniqueRunTraces, ...traceList];
      } catch {
        // Platform runs not available
      }

      setTraces(traceList);
      if (statsResp.stats) {
        setStats(statsResp.stats as unknown as ObservatoryStats);
      } else {
        // Compute stats from traces
        const completed = traceList.filter((t) => t.status === "completed").length;
        const failed = traceList.filter((t) => t.status === "failed" || t.status === "error").length;
        const durations = traceList.filter((t) => t.total_duration).map((t) => t.total_duration!);
        setStats({
          total_traces: traceList.length,
          completed,
          failed,
          running: traceList.filter((t) => t.status === "running").length,
          success_rate: traceList.length > 0 ? Math.round(completed / traceList.length * 100) : 0,
          avg_duration: durations.length > 0 ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length * 10) / 10 : 0,
        });
      }
      if (traceList.length > 0 && !selected) {
        setSelected(traceList[0]);
        if (traceList[0].nodes.length > 0) {
          setExpandedNode(0);
        }
      }
    } catch {
      // API unavailable
    } finally {
      setLoading(false);
    }
  }, [getToken, selected]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const totalDuration =
    selected?.nodes.reduce((sum, n) => sum + (n.duration || 0), 0) || 0;

  return (
    <div className="space-y-6">
      {/* ── Header ── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            AI Execution Observatory
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Inspect real execution traces from your AI task pipeline
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              setLoading(true);
              loadData();
            }}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-white/[0.06] bg-white/[0.02] text-xs text-muted-foreground hover:bg-white/[0.04] transition-colors"
          >
            <RefreshCw
              className={cn("w-3.5 h-3.5", loading && "animate-spin")}
            />
            Refresh
          </button>
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-white/[0.06] bg-white/[0.02] text-xs text-muted-foreground">
            <Zap className="w-3.5 h-3.5 text-indigo-400" />
            {traces.length} traces
          </div>
        </div>
      </div>

      {/* ── Stats Bar ── */}
      {stats && (
        <div className="grid grid-cols-5 gap-4">
          {[
            {
              label: "Total Traces",
              value: stats.total_traces,
              color: "text-white",
            },
            {
              label: "Completed",
              value: stats.completed,
              color: "text-emerald-400",
            },
            { label: "Failed", value: stats.failed, color: "text-red-400" },
            {
              label: "Success Rate",
              value: `${stats.success_rate}%`,
              color: "text-indigo-400",
            },
            {
              label: "Avg Duration",
              value: `${stats.avg_duration}s`,
              color: "text-amber-400",
            },
          ].map((s) => (
            <div
              key={s.label}
              className="px-4 py-3 rounded-xl border border-white/[0.06] bg-white/[0.02]"
            >
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider">
                {s.label}
              </p>
              <p className={cn("text-xl font-semibold mt-1", s.color)}>
                {s.value}
              </p>
            </div>
          ))}
        </div>
      )}

      {/* ── Empty State ── */}
      {!loading && traces.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <AlertTriangle className="w-10 h-10 text-zinc-600 mb-4" />
          <h3 className="text-lg font-medium text-zinc-400">
            No execution traces yet
          </h3>
          <p className="text-sm text-muted-foreground mt-1">
            Submit a task from the Tasks page to see real execution traces here.
          </p>
        </div>
      )}

      {traces.length > 0 && (
        <div className="grid grid-cols-12 gap-6">
          {/* ── Trace Selector ── */}
          <div className="col-span-3 space-y-2">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider px-1 mb-3">
              Execution Traces
            </p>
            {traces.map((t) => (
              <button
                key={t.trace_id}
                onClick={() => {
                  setSelected(t);
                  setExpandedNode(t.nodes.length > 0 ? 0 : null);
                }}
                className={cn(
                  "w-full text-left px-4 py-3 rounded-xl border transition-all",
                  selected?.trace_id === t.trace_id
                    ? "border-indigo-500/30 bg-indigo-500/[0.06]"
                    : "border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.04]",
                )}
              >
                <p className="text-sm font-medium truncate font-mono">
                  {t.task_id}
                </p>
                <div className="flex items-center gap-2 mt-1.5">
                  <span
                    className={cn(
                      "text-[10px] px-2 py-0.5 rounded-full border font-medium",
                      t.status === "completed"
                        ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-400"
                        : t.status === "running"
                          ? "border-indigo-500/20 bg-indigo-500/10 text-indigo-400"
                          : "border-red-500/20 bg-red-500/10 text-red-400",
                    )}
                  >
                    {t.status}
                  </span>
                  <span className="text-[10px] text-muted-foreground">
                    {t.total_duration ? `${t.total_duration}s` : "—"}
                  </span>
                  <span className="text-[10px] text-muted-foreground">
                    {t.nodes.length} agents
                  </span>
                </div>
              </button>
            ))}
          </div>

          {/* ── Trace Detail ── */}
          {selected && (
            <div className="col-span-9 space-y-4">
              {/* Summary bar */}
              <div className="flex items-center gap-4 px-5 py-3 rounded-xl border border-white/[0.06] bg-white/[0.02]">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium font-mono">
                    {selected.trace_id}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Task: {selected.task_id} · {selected.nodes.length} agents ·{" "}
                    {selected.total_duration
                      ? `${selected.total_duration}s`
                      : "—"}{" "}
                    total
                  </p>
                </div>
                <div
                  className={cn(
                    "shrink-0 flex items-center gap-2 px-3 py-1.5 rounded-lg border",
                    selected.status === "completed"
                      ? "bg-emerald-500/10 border-emerald-500/20"
                      : selected.status === "running"
                        ? "bg-indigo-500/10 border-indigo-500/20"
                        : "bg-red-500/10 border-red-500/20",
                  )}
                >
                  {statusIcon(selected.status)}
                  <span
                    className={cn(
                      "text-xs font-medium",
                      selected.status === "completed"
                        ? "text-emerald-400"
                        : selected.status === "running"
                          ? "text-indigo-400"
                          : "text-red-400",
                    )}
                  >
                    {selected.status}
                  </span>
                </div>
              </div>

              {/* Timeline bar */}
              {totalDuration > 0 && (
                <div className="flex items-center gap-1 h-2 rounded-full overflow-hidden bg-white/[0.04]">
                  {selected.nodes.map((node, idx) => {
                    const widthPct = (node.duration / totalDuration) * 100;
                    const colors = [
                      "bg-indigo-500",
                      "bg-cyan-500",
                      "bg-amber-500",
                      "bg-emerald-500",
                      "bg-orange-500",
                      "bg-violet-500",
                    ];
                    return (
                      <div
                        key={idx}
                        className={cn(
                          "h-full rounded-full transition-all",
                          node.status === "error"
                            ? "bg-red-500"
                            : colors[idx % colors.length],
                        )}
                        style={{ width: `${Math.max(widthPct, 2)}%` }}
                        title={`${node.agent}: ${node.duration}s`}
                      />
                    );
                  })}
                </div>
              )}

              {/* Agent trace cards */}
              <div className="space-y-2">
                {selected.nodes.map((node, idx) => {
                  const Icon = agentIcons[node.agent] || Brain;
                  const isExpanded = expandedNode === idx;

                  return (
                    <div key={idx}>
                      {/* Connector line */}
                      {idx > 0 && (
                        <div className="flex items-center justify-center py-1">
                          <div className="flex flex-col items-center gap-0.5">
                            <div className="w-[2px] h-3 bg-white/[0.08]" />
                            <ArrowRight className="w-3 h-3 text-white/20 rotate-90" />
                          </div>
                        </div>
                      )}

                      {/* Agent card */}
                      <button
                        onClick={() => setExpandedNode(isExpanded ? null : idx)}
                        className={cn(
                          "w-full text-left rounded-xl border transition-all",
                          isExpanded
                            ? "border-indigo-500/20 bg-indigo-500/[0.03]"
                            : "border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.03]",
                        )}
                      >
                        {/* Header row */}
                        <div className="flex items-center gap-3 px-5 py-3">
                          <div
                            className={cn(
                              "w-9 h-9 rounded-lg border flex items-center justify-center shrink-0",
                              node.status === "completed"
                                ? "border-emerald-500/20 bg-emerald-500/10"
                                : node.status === "error"
                                  ? "border-red-500/20 bg-red-500/10"
                                  : "border-indigo-500/20 bg-indigo-500/10",
                            )}
                          >
                            <Icon
                              className={cn(
                                "w-4 h-4",
                                node.status === "completed"
                                  ? "text-emerald-400"
                                  : node.status === "error"
                                    ? "text-red-400"
                                    : "text-indigo-400",
                              )}
                            />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium capitalize">
                              {node.agent.replace(/_/g, " ")}
                            </p>
                            <p className="text-[11px] text-muted-foreground">
                              Step {node.step} · {node.duration}s
                            </p>
                          </div>
                          {statusIcon(node.status)}
                          <ChevronRight
                            className={cn(
                              "w-4 h-4 text-muted-foreground transition-transform",
                              isExpanded && "rotate-90",
                            )}
                          />
                        </div>

                        {/* Expanded detail */}
                        {isExpanded && (
                          <div className="px-5 pb-4 pt-1 border-t border-white/[0.04] space-y-3">
                            <div className="grid grid-cols-3 gap-3">
                              <div className="px-3 py-2 rounded-lg bg-white/[0.03] border border-white/[0.04]">
                                <p className="text-[10px] text-muted-foreground">
                                  Status
                                </p>
                                <p
                                  className={cn(
                                    "text-xs font-medium mt-0.5",
                                    node.status === "completed"
                                      ? "text-emerald-400"
                                      : node.status === "error"
                                        ? "text-red-400"
                                        : "text-indigo-400",
                                  )}
                                >
                                  {node.status}
                                </p>
                              </div>
                              <div className="px-3 py-2 rounded-lg bg-white/[0.03] border border-white/[0.04]">
                                <p className="text-[10px] text-muted-foreground">
                                  Duration
                                </p>
                                <p className="text-xs font-medium mt-0.5">
                                  {node.duration}s
                                </p>
                              </div>
                              <div className="px-3 py-2 rounded-lg bg-white/[0.03] border border-white/[0.04]">
                                <p className="text-[10px] text-muted-foreground">
                                  Agent Type
                                </p>
                                <p className="text-xs font-medium mt-0.5 capitalize">
                                  {node.agent}
                                </p>
                              </div>
                            </div>
                            {node.error && (
                              <div className="px-4 py-3 rounded-lg bg-red-500/[0.06] border border-red-500/20">
                                <p className="text-[10px] text-red-400 font-medium uppercase tracking-wider mb-1">
                                  Error
                                </p>
                                <p className="text-xs text-red-300 font-mono">
                                  {node.error}
                                </p>
                              </div>
                            )}
                          </div>
                        )}
                      </button>
                    </div>
                  );
                })}
              </div>

              {/* Duration footer */}
              {selected.total_duration && (
                <div className="flex items-center justify-between px-5 py-3 rounded-xl border border-indigo-500/20 bg-indigo-500/[0.04]">
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-indigo-400" />
                    <span className="text-sm font-medium text-indigo-400">
                      Total Execution Time
                    </span>
                  </div>
                  <span className="text-lg font-semibold text-indigo-400">
                    {selected.total_duration}s
                  </span>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
