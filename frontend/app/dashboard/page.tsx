"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import {
  Activity,
  TrendingUp,
  Bot,
  CheckCircle,
  XCircle,
  ArrowUpRight,
  Zap,
  Clock,
  ListTodo,
  Send,
  Loader2,
  Sparkles,
  Plus,
  ChevronRight,
  BarChart3,
  DollarSign,
  AlertTriangle,
  Globe,
  Brain,
  Workflow,
  Eye,
} from "lucide-react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import { MetricsCard } from "@/components/metrics-card/metrics-card";
import { cn, formatNumber } from "@/lib/utils";
import { api } from "@/lib/api-client";
import { useAuth } from "@/lib/auth-context";

const CHART_COLORS = [
  "#6366f1",
  "#22d3ee",
  "#f59e0b",
  "#ef4444",
  "#10b981",
  "#8b5cf6",
];

type TaskItem = {
  task_id: string;
  input: string;
  status: string;
  task_type?: string;
  agent_path?: string[];
  total_duration?: number;
  created_at?: string;
  completed_at?: string;
};

type TraceItem = {
  trace_id: string;
  task_id: string;
  status: string;
  total_duration?: number;
  started_at?: string;
  nodes?: unknown[];
};

type AgentItem = {
  agent_id?: string;
  name: string;
  status?: string;
  total_runs?: number;
  success_rate?: number;
  agent_type?: string;
  icon?: string;
};

export default function DashboardPage() {
  const { getToken, user } = useAuth();
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [traces, setTraces] = useState<TraceItem[]>([]);
  const [agents, setAgents] = useState<AgentItem[]>([]);
  const [analytics, setAnalytics] = useState<Record<string, unknown> | null>(null);
  const [dailyOutcomes, setDailyOutcomes] = useState<Record<string, unknown>[] | null>(null);
  const [quickInput, setQuickInput] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);

  const fetchAll = useCallback(async () => {
    const token = getToken();
    if (!token) { setLoading(false); return; }

    const fetches = [
      // Real tasks
      api.listRealTasks(token, undefined, 15)
        .then((d) => setTasks((d.tasks || []) as TaskItem[]))
        .catch(() => {}),
      // Analytics
      api.getDashboardAnalytics(token)
        .then((d) => setAnalytics(d.analytics))
        .catch(() => {}),
      // Daily outcomes
      api.getDailyOutcomes(token, 14)
        .then((d) => setDailyOutcomes(d.outcomes))
        .catch(() => {}),
      // Traces (from observatory)
      api.getTraces(token, undefined, 10)
        .then((d) => setTraces((d.traces || []) as TraceItem[]))
        .catch(() => {}),
      // Platform agents
      api.listPlatformAgents(token)
        .then((d) => setAgents((d.agents || []) as unknown as AgentItem[]))
        .catch(() => {
          api.getAgents()
            .then((d) => {
              const list = Array.isArray(d)
                ? d
                : ((d as Record<string, unknown>).agents ?? []);
              setAgents(list as AgentItem[]);
            })
            .catch(() => {});
        }),
    ];

    await Promise.allSettled(fetches);
    setLoading(false);
  }, [getToken]);

  useEffect(() => {
    fetchAll();
    // Auto-refresh every 30s
    const refreshInterval = setInterval(fetchAll, 30000);
    return () => clearInterval(refreshInterval);
  }, [fetchAll]);

  const handleQuickSubmit = async () => {
    if (!quickInput.trim() || submitting) return;
    const token = getToken();
    if (!token) return;
    setSubmitting(true);
    try {
      await api.submitRealTask(token, quickInput.trim());
      setQuickInput("");
      setTimeout(() => fetchAll(), 1500);
    } catch {}
    setSubmitting(false);
  };

  // Computed stats
  const totalTasks = tasks.length;
  const completedTasks = tasks.filter((t) => t.status === "completed").length;
  const failedTasks = tasks.filter((t) => t.status === "failed").length;
  const runningTasks = tasks.filter((t) => t.status === "running" || t.status === "queued" || t.status === "pending").length;
  const successRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
  const totalAgents = agents.length;
  const activeAgents = agents.filter((a) => a.status === "active").length;
  const avgDuration = completedTasks > 0
    ? (tasks.filter((t) => t.status === "completed" && t.total_duration).reduce((s, t) => s + (t.total_duration || 0), 0) / completedTasks).toFixed(1)
    : "0";
  const outcomesData = dailyOutcomes ?? [];

  const hasData = totalTasks > 0 || totalAgents > 0;

  const statusColor = (status: string) => {
    if (status === "completed") return "bg-emerald-500";
    if (status === "running" || status === "queued") return "bg-cyan-400 animate-pulse";
    if (status === "failed") return "bg-red-500";
    return "bg-zinc-600";
  };

  const statusLabel = (status: string) => {
    if (status === "completed") return "text-emerald-400";
    if (status === "running" || status === "queued") return "text-cyan-400";
    if (status === "failed") return "text-red-400";
    return "text-zinc-400";
  };

  const timeAgo = (dateStr?: string) => {
    if (!dateStr) return "";
    const diff = Date.now() - new Date(dateStr).getTime();
    if (diff < 60000) return "just now";
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    return `${Math.floor(diff / 86400000)}d ago`;
  };

  if (loading) {
    return (
      <div className="space-y-6 max-w-[1400px] animate-pulse">
        {/* Header skeleton */}
        <div className="flex items-center justify-between">
          <div>
            <div className="h-6 w-48 bg-white/[0.05] rounded-lg" />
            <div className="h-4 w-64 bg-white/[0.03] rounded mt-2" />
          </div>
          <div className="h-10 w-56 bg-white/[0.03] rounded-lg" />
        </div>
        {/* KPI cards skeleton */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-5 space-y-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-white/[0.04]" />
                <div className="h-4 w-20 bg-white/[0.04] rounded" />
              </div>
              <div className="h-7 w-16 bg-white/[0.06] rounded" />
              <div className="h-3 w-24 bg-white/[0.03] rounded" />
            </div>
          ))}
        </div>
        {/* Charts skeleton */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2 h-[300px] rounded-xl border border-white/[0.06] bg-white/[0.02]" />
          <div className="h-[300px] rounded-xl border border-white/[0.06] bg-white/[0.02]" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-[1400px]">
      {/* ─── Header ─── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">
            {user?.name ? `Welcome back, ${user.name.split(" ")[0]}` : "Dashboard"}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Real-time overview of your AI operations
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
          Systems operational
        </div>
      </div>

      {/* ─── Quick Task Submit ─── */}
      <div className="rounded-xl border border-violet-500/20 bg-gradient-to-r from-violet-500/[0.05] to-cyan-500/[0.03] p-4">
        <div className="flex gap-3">
          <div className="flex-1 relative">
            <Brain className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-violet-400" />
            <input
              type="text"
              value={quickInput}
              onChange={(e) => setQuickInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleQuickSubmit()}
              placeholder="Submit a task... e.g. &quot;Find cheapest RTX 4070 under ₹60,000&quot;"
              className="w-full pl-9 pr-4 py-2.5 rounded-lg border border-white/[0.08] bg-white/[0.03] text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:border-violet-500/40 transition-colors"
            />
          </div>
          <button
            onClick={handleQuickSubmit}
            disabled={!quickInput.trim() || submitting}
            className="px-5 py-2.5 rounded-lg bg-gradient-to-r from-violet-600 to-violet-500 hover:from-violet-500 hover:to-violet-400 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-medium flex items-center gap-2 transition-all shadow-lg shadow-violet-600/20"
          >
            {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            Submit
          </button>
        </div>
      </div>

      {/* ─── Onboarding for new users ─── */}
      {!hasData && (
        <div className="rounded-xl border border-white/[0.08] bg-gradient-to-br from-violet-500/[0.04] to-cyan-500/[0.02] p-8 text-center">
          <Sparkles className="w-10 h-10 text-violet-400 mx-auto mb-4" />
          <h2 className="text-lg font-semibold mb-2">Welcome to Orkestron!</h2>
          <p className="text-sm text-muted-foreground max-w-md mx-auto mb-6">
            Get started by submitting your first task above, or deploy agents from the marketplace.
          </p>
          <div className="flex items-center justify-center gap-3">
            <Link
              href="/dashboard/marketplace"
              className="px-4 py-2 rounded-lg bg-gradient-to-r from-violet-600 to-violet-500 text-white text-sm font-medium flex items-center gap-2"
            >
              <Bot className="w-4 h-4" />
              Browse Marketplace
            </Link>
            <Link
              href="/dashboard/workflows"
              className="px-4 py-2 rounded-lg border border-white/[0.08] bg-white/[0.03] hover:bg-white/[0.06] text-sm text-muted-foreground hover:text-foreground transition-all flex items-center gap-2"
            >
              <Workflow className="w-4 h-4" />
              Create Workflow
            </Link>
          </div>
        </div>
      )}

      {/* ─── KPI Cards ─── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricsCard
          title="Total Tasks"
          value={formatNumber(totalTasks)}
          icon={ListTodo}
          subtitle={`${runningTasks} running · ${completedTasks} done`}
        />
        <MetricsCard
          title="Success Rate"
          value={`${successRate}%`}
          change={failedTasks > 0 ? `${failedTasks} failed` : "0 failures"}
          changeType={failedTasks > 0 ? "negative" : "positive"}
          icon={CheckCircle}
          subtitle="Across all tasks"
        />
        <MetricsCard
          title="Active Agents"
          value={activeAgents.toString()}
          icon={Bot}
          subtitle={`${totalAgents} total deployed`}
        />
        <MetricsCard
          title="Avg Duration"
          value={`${avgDuration}s`}
          icon={Clock}
          subtitle="Per completed task"
        />
      </div>

      {/* ─── Charts + Live Activity ─── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Task Activity Chart */}
        <div className="lg:col-span-2 rounded-xl border border-white/[0.06] bg-white/[0.02] p-5">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-sm font-semibold">Task Activity</h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Daily task outcomes (14 days)
              </p>
            </div>
            <div className="flex items-center gap-4 text-[11px] text-muted-foreground">
              <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full bg-indigo-500" />
                Completed
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full bg-red-400/60" />
                Failed
              </div>
            </div>
          </div>
          <div className="h-[220px]">
            {outcomesData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={outcomesData}>
                  <defs>
                    <linearGradient id="colorSuccess" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="rgb(99, 102, 241)" stopOpacity={0.15} />
                      <stop offset="95%" stopColor="rgb(99, 102, 241)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.03)" />
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 10, fill: "rgba(255,255,255,0.3)" }}
                    tickFormatter={(v) => v.slice(5)}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis tick={{ fontSize: 10, fill: "rgba(255,255,255,0.3)" }} axisLine={false} tickLine={false} />
                  <Tooltip
                    contentStyle={{ background: "#111827", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "8px", fontSize: "12px" }}
                    labelStyle={{ color: "rgba(255,255,255,0.5)" }}
                  />
                  <Area type="monotone" dataKey="successful" stroke="rgb(99, 102, 241)" strokeWidth={2} fill="url(#colorSuccess)" />
                  <Area type="monotone" dataKey="failed" stroke="rgba(239, 68, 68, 0.5)" strokeWidth={1.5} fill="rgba(239, 68, 68, 0.05)" />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
                <div className="text-center">
                  <BarChart3 className="w-8 h-8 mx-auto mb-2 text-zinc-700" />
                  <p>No task data yet</p>
                  <p className="text-xs text-muted-foreground/60 mt-1">Submit tasks to see activity charts</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Recent Tasks Feed */}
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] overflow-hidden">
          <div className="px-5 py-4 border-b border-white/[0.04] flex items-center justify-between">
            <h3 className="text-sm font-semibold">Recent Tasks</h3>
            <Link href="/dashboard/tasks" className="text-[10px] text-violet-400 hover:text-violet-300 transition-colors">
              View all →
            </Link>
          </div>
          <div className="divide-y divide-white/[0.03] max-h-[280px] overflow-y-auto">
            {tasks.length === 0 ? (
              <div className="px-5 py-8 text-center text-sm text-muted-foreground">
                <ListTodo className="w-6 h-6 mx-auto mb-2 text-zinc-700" />
                No tasks yet
              </div>
            ) : (
              tasks.slice(0, 8).map((task) => (
                <Link
                  key={task.task_id}
                  href="/dashboard/tasks"
                  className="px-5 py-3 hover:bg-white/[0.02] transition-colors block"
                >
                  <div className="flex items-center gap-2 mb-1">
                    <div className={cn("w-1.5 h-1.5 rounded-full shrink-0", statusColor(task.status))} />
                    <span className="text-xs text-foreground truncate flex-1">{task.input}</span>
                    <span className="text-[10px] text-muted-foreground shrink-0">{timeAgo(task.created_at)}</span>
                  </div>
                  <div className="flex items-center gap-2 pl-3.5">
                    <span className={cn("text-[10px] font-medium", statusLabel(task.status))}>
                      {task.status}
                    </span>
                    {task.total_duration && (
                      <span className="text-[10px] text-muted-foreground">{task.total_duration.toFixed(1)}s</span>
                    )}
                    {task.task_type && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/[0.04] text-muted-foreground">{task.task_type}</span>
                    )}
                  </div>
                </Link>
              ))
            )}
          </div>
        </div>
      </div>

      {/* ─── Agents + Traces ─── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Agent Performance */}
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] overflow-hidden">
          <div className="px-5 py-4 border-b border-white/[0.04] flex items-center justify-between">
            <h3 className="text-sm font-semibold">Agent Performance</h3>
            <Link href="/dashboard/marketplace" className="text-[10px] text-violet-400 hover:text-violet-300 transition-colors">
              Marketplace →
            </Link>
          </div>
          <div className="divide-y divide-white/[0.03] max-h-[280px] overflow-y-auto">
            {agents.length === 0 ? (
              <div className="px-5 py-8 text-center text-sm text-muted-foreground">
                <Bot className="w-6 h-6 mx-auto mb-2 text-zinc-700" />
                <p>No agents deployed</p>
                <Link href="/dashboard/marketplace" className="text-violet-400 text-xs hover:underline mt-1 inline-block">
                  Deploy your first agent →
                </Link>
              </div>
            ) : (
              agents.slice(0, 8).map((agent, i) => (
                <Link
                  key={agent.agent_id || i}
                  href="/dashboard/marketplace"
                  className="px-5 py-3 flex items-center justify-between hover:bg-white/[0.02] transition-colors"
                >
                  <div className="flex items-center gap-2.5">
                    <span className="text-xl">{agent.icon || "🤖"}</span>
                    <div>
                      <span className="text-sm font-medium">{agent.name}</span>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[10px] text-muted-foreground">{agent.total_runs || 0} runs</span>
                        {agent.agent_type && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-violet-500/10 border border-violet-500/20 text-violet-300">
                            {agent.agent_type}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-sm font-medium text-emerald-400">
                      {agent.success_rate ?? 0}%
                    </span>
                    <p className="text-[10px] text-muted-foreground">success</p>
                  </div>
                </Link>
              ))
            )}
          </div>
        </div>

        {/* Execution Traces (from Observatory) */}
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] overflow-hidden">
          <div className="px-5 py-4 border-b border-white/[0.04] flex items-center justify-between">
            <h3 className="text-sm font-semibold flex items-center gap-2">
              <Eye className="w-4 h-4 text-cyan-400" />
              Execution Traces
            </h3>
            <span className="text-[10px] text-muted-foreground">{traces.length} traces</span>
          </div>
          <div className="divide-y divide-white/[0.03] max-h-[280px] overflow-y-auto">
            {traces.length === 0 ? (
              <div className="px-5 py-8 text-center text-sm text-muted-foreground">
                <Activity className="w-6 h-6 mx-auto mb-2 text-zinc-700" />
                <p>No execution traces</p>
                <p className="text-xs text-muted-foreground/60 mt-1">Submit tasks to generate traces</p>
              </div>
            ) : (
              traces.map((trace) => (
                <div
                  key={trace.trace_id}
                  className="px-5 py-3 hover:bg-white/[0.02] transition-colors"
                >
                  <div className="flex items-center gap-2 mb-1">
                    <div className={cn("w-1.5 h-1.5 rounded-full shrink-0", statusColor(trace.status))} />
                    <span className="text-xs font-mono text-muted-foreground">
                      {trace.trace_id.slice(0, 16)}...
                    </span>
                    <span className={cn("text-[10px] font-medium ml-auto", statusLabel(trace.status))}>
                      {trace.status}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 pl-3.5">
                    {trace.total_duration && (
                      <span className="text-[10px] text-muted-foreground">{trace.total_duration.toFixed(1)}s</span>
                    )}
                    {trace.nodes && (
                      <span className="text-[10px] text-muted-foreground">{(trace.nodes as unknown[]).length} nodes</span>
                    )}
                    <span className="text-[10px] text-muted-foreground ml-auto">{timeAgo(trace.started_at)}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* ─── Quick Action Cards ─── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Link
          href="/dashboard/tasks"
          className="group rounded-xl border border-white/[0.06] bg-white/[0.02] p-5 hover:bg-white/[0.04] hover:border-violet-500/20 transition-all"
        >
          <ListTodo className="w-5 h-5 text-violet-400 mb-3" />
          <h4 className="text-sm font-semibold mb-1">View All Tasks</h4>
          <p className="text-[12px] text-muted-foreground">
            {totalTasks} tasks · {completedTasks} completed
          </p>
          <ChevronRight className="w-4 h-4 text-muted-foreground mt-3 group-hover:translate-x-0.5 transition-transform" />
        </Link>
        <Link
          href="/dashboard/workflows"
          className="group rounded-xl border border-white/[0.06] bg-white/[0.02] p-5 hover:bg-white/[0.04] hover:border-cyan-500/20 transition-all"
        >
          <Workflow className="w-5 h-5 text-cyan-400 mb-3" />
          <h4 className="text-sm font-semibold mb-1">Workflow Builder</h4>
          <p className="text-[12px] text-muted-foreground">
            Create and manage agent workflows
          </p>
          <ChevronRight className="w-4 h-4 text-muted-foreground mt-3 group-hover:translate-x-0.5 transition-transform" />
        </Link>
        <Link
          href="/dashboard/marketplace"
          className="group rounded-xl border border-white/[0.06] bg-white/[0.02] p-5 hover:bg-white/[0.04] hover:border-emerald-500/20 transition-all"
        >
          <Plus className="w-5 h-5 text-emerald-400 mb-3" />
          <h4 className="text-sm font-semibold mb-1">Deploy Agent</h4>
          <p className="text-[12px] text-muted-foreground">
            {totalAgents} agents in marketplace
          </p>
          <ChevronRight className="w-4 h-4 text-muted-foreground mt-3 group-hover:translate-x-0.5 transition-transform" />
        </Link>
      </div>
    </div>
  );
}
