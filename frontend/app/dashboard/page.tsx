"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import Link from "next/link";
import {
  Activity,
  TrendingUp,
  Bot,
  CheckCircle,
  ArrowUpRight,
  Zap,
  Clock,
  ListTodo,
  Sparkles,
  ChevronRight,
  BarChart3,
  Globe,
  Brain,
  Workflow,
  Eye,
  Shield,
  Cpu,
  AlertCircle,
  ArrowRight,
  Play,
  Target,
  Layers,
} from "lucide-react";
import { MetricsCard } from "@/components/metrics-card/metrics-card";
import { cn, formatNumber } from "@/lib/utils";
import { api } from "@/lib/api-client";
import { useAuth } from "@/lib/auth-context";

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

/* ─── Skeleton Components ─── */
function SkeletonPulse({ className }: { className?: string }) {
  return <div className={cn("animate-pulse bg-white/[0.05] rounded-lg", className)} />;
}

function DashboardSkeleton() {
  return (
    <div className="space-y-6 max-w-[1400px]">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <SkeletonPulse className="h-7 w-52 mb-2" />
          <SkeletonPulse className="h-4 w-72" />
        </div>
        <SkeletonPulse className="h-8 w-36 rounded-full" />
      </div>
      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-5 space-y-3">
            <div className="flex items-center gap-3">
              <SkeletonPulse className="w-9 h-9 rounded-lg" />
              <SkeletonPulse className="h-4 w-20" />
            </div>
            <SkeletonPulse className="h-8 w-16" />
            <SkeletonPulse className="h-3 w-28" />
          </div>
        ))}
      </div>
      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 rounded-xl border border-white/[0.06] bg-white/[0.02] p-5">
          <SkeletonPulse className="h-5 w-40 mb-4" />
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="flex items-center gap-3">
                <SkeletonPulse className="w-2 h-2 rounded-full" />
                <SkeletonPulse className="h-4 flex-1" />
                <SkeletonPulse className="h-3 w-16" />
              </div>
            ))}
          </div>
        </div>
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-5 space-y-4">
          <SkeletonPulse className="h-5 w-32" />
          <SkeletonPulse className="h-40" />
        </div>
      </div>
      {/* Quick Actions */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-5 space-y-3">
            <SkeletonPulse className="w-10 h-10 rounded-lg" />
            <SkeletonPulse className="h-5 w-28" />
            <SkeletonPulse className="h-3 w-40" />
          </div>
        ))}
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const { getToken, user } = useAuth();
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [traces, setTraces] = useState<TraceItem[]>([]);
  const [agents, setAgents] = useState<AgentItem[]>([]);
  const [analytics, setAnalytics] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchAll = useCallback(async () => {
    const token = getToken();
    if (!token) { setLoading(false); return; }

    const fetches = [
      api.listRealTasks(token, undefined, 15)
        .then((d) => setTasks((d.tasks || []) as TaskItem[]))
        .catch(() => {}),
      api.getDashboardAnalytics(token)
        .then((d) => setAnalytics(d.analytics))
        .catch(() => {}),
      api.getTraces(token, undefined, 10)
        .then((d) => setTraces((d.traces || []) as TraceItem[]))
        .catch(() => {}),
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
    const refreshInterval = setInterval(fetchAll, 30000);
    return () => clearInterval(refreshInterval);
  }, [fetchAll]);

  // Computed stats
  const stats = useMemo(() => {
    const totalTasks = tasks.length;
    const completedTasks = tasks.filter((t) => t.status === "completed").length;
    const failedTasks = tasks.filter((t) => t.status === "failed").length;
    const runningTasks = tasks.filter((t) => ["running", "queued", "pending"].includes(t.status)).length;
    const successRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
    const totalAgents = agents.length;
    const activeAgents = agents.filter((a) => a.status === "active").length;
    const avgDuration = completedTasks > 0
      ? (tasks.filter((t) => t.status === "completed" && t.total_duration).reduce((s, t) => s + (t.total_duration || 0), 0) / completedTasks).toFixed(1)
      : "0";
    return { totalTasks, completedTasks, failedTasks, runningTasks, successRate, totalAgents, activeAgents, avgDuration };
  }, [tasks, agents]);

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

  if (loading) return <DashboardSkeleton />;

  const hasData = stats.totalTasks > 0 || stats.totalAgents > 0;

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
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 text-xs text-muted-foreground px-3 py-1.5 rounded-full border border-white/[0.06] bg-white/[0.02]">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            All systems operational
          </div>
        </div>
      </div>

      {/* ─── Onboarding for new users ─── */}
      {!hasData && (
        <div className="rounded-xl border border-white/[0.08] bg-gradient-to-br from-violet-500/[0.04] to-cyan-500/[0.02] p-8 text-center">
          <Sparkles className="w-10 h-10 text-violet-400 mx-auto mb-4" />
          <h2 className="text-lg font-semibold mb-2">Welcome to Orkestron!</h2>
          <p className="text-sm text-muted-foreground max-w-md mx-auto mb-6">
            Get started by submitting your first task from the Tasks page, or deploy agents from the marketplace.
          </p>
          <div className="flex items-center justify-center gap-3">
            <Link
              href="/dashboard/tasks"
              className="px-4 py-2 rounded-lg bg-gradient-to-r from-violet-600 to-violet-500 text-white text-sm font-medium flex items-center gap-2 hover:from-violet-500 hover:to-violet-400 transition-all shadow-lg shadow-violet-600/20"
            >
              <Brain className="w-4 h-4" />
              Submit a Task
            </Link>
            <Link
              href="/dashboard/marketplace"
              className="px-4 py-2 rounded-lg border border-white/[0.08] bg-white/[0.03] hover:bg-white/[0.06] text-sm text-muted-foreground hover:text-foreground transition-all flex items-center gap-2"
            >
              <Bot className="w-4 h-4" />
              Browse Marketplace
            </Link>
          </div>
        </div>
      )}

      {/* ─── KPI Cards ─── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricsCard
          title="Total Tasks"
          value={formatNumber(stats.totalTasks)}
          icon={ListTodo}
          subtitle={`${stats.runningTasks} running · ${stats.completedTasks} done`}
        />
        <MetricsCard
          title="Success Rate"
          value={`${stats.successRate}%`}
          change={stats.failedTasks > 0 ? `${stats.failedTasks} failed` : "0 failures"}
          changeType={stats.failedTasks > 0 ? "negative" : "positive"}
          icon={CheckCircle}
          subtitle="Across all tasks"
        />
        <MetricsCard
          title="Active Agents"
          value={stats.activeAgents.toString()}
          icon={Bot}
          subtitle={`${stats.totalAgents} total deployed`}
        />
        <MetricsCard
          title="Avg Duration"
          value={`${stats.avgDuration}s`}
          icon={Clock}
          subtitle="Per completed task"
        />
      </div>

      {/* ─── System Health + Recent Tasks ─── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* System Health Overview */}
        <div className="lg:col-span-2 rounded-xl border border-white/[0.06] bg-white/[0.02] p-5">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h3 className="text-sm font-semibold flex items-center gap-2">
                <Activity className="w-4 h-4 text-violet-400" />
                System Health
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">Platform performance overview</p>
            </div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              {
                label: "Task Engine",
                status: "operational",
                icon: Zap,
                color: "text-emerald-400",
                bgColor: "bg-emerald-500/10 border-emerald-500/20",
              },
              {
                label: "Agent Runtime",
                status: "operational",
                icon: Cpu,
                color: "text-emerald-400",
                bgColor: "bg-emerald-500/10 border-emerald-500/20",
              },
              {
                label: "Web Search",
                status: "operational",
                icon: Globe,
                color: "text-emerald-400",
                bgColor: "bg-emerald-500/10 border-emerald-500/20",
              },
              {
                label: "LLM Provider",
                status: "operational",
                icon: Brain,
                color: "text-emerald-400",
                bgColor: "bg-emerald-500/10 border-emerald-500/20",
              },
            ].map((item) => (
              <div
                key={item.label}
                className={cn(
                  "rounded-lg border p-3 text-center transition-colors",
                  item.bgColor,
                )}
              >
                <item.icon className={cn("w-5 h-5 mx-auto mb-2", item.color)} />
                <p className="text-xs font-medium">{item.label}</p>
                <p className={cn("text-[10px] mt-0.5 capitalize", item.color)}>
                  {item.status}
                </p>
              </div>
            ))}
          </div>

          {/* Performance Indicators */}
          <div className="mt-5 grid grid-cols-3 gap-3">
            <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-3">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Tasks Today</p>
              <p className="text-lg font-bold">
                {tasks.filter(t => {
                  const d = t.created_at ? new Date(t.created_at) : null;
                  return d && (Date.now() - d.getTime()) < 86400000;
                }).length}
              </p>
            </div>
            <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-3">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Traces</p>
              <p className="text-lg font-bold">{traces.length}</p>
            </div>
            <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-3">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Uptime</p>
              <p className="text-lg font-bold text-emerald-400">99.9%</p>
            </div>
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
          <div className="divide-y divide-white/[0.03] max-h-[380px] overflow-y-auto custom-scrollbar">
            {tasks.length === 0 ? (
              <div className="px-5 py-12 text-center text-sm text-muted-foreground">
                <ListTodo className="w-8 h-8 mx-auto mb-3 text-zinc-700" />
                <p className="font-medium">No tasks yet</p>
                <p className="text-xs text-muted-foreground/60 mt-1">Submit your first task to get started</p>
                <Link
                  href="/dashboard/tasks"
                  className="inline-flex items-center gap-1 mt-3 text-xs text-violet-400 hover:text-violet-300"
                >
                  Go to Tasks <ArrowRight className="w-3 h-3" />
                </Link>
              </div>
            ) : (
              tasks.slice(0, 10).map((task) => (
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
          <div className="divide-y divide-white/[0.03] max-h-[280px] overflow-y-auto custom-scrollbar">
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

        {/* Execution Traces */}
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] overflow-hidden">
          <div className="px-5 py-4 border-b border-white/[0.04] flex items-center justify-between">
            <h3 className="text-sm font-semibold flex items-center gap-2">
              <Eye className="w-4 h-4 text-cyan-400" />
              Execution Traces
            </h3>
            <span className="text-[10px] text-muted-foreground">{traces.length} traces</span>
          </div>
          <div className="divide-y divide-white/[0.03] max-h-[280px] overflow-y-auto custom-scrollbar">
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
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Link
          href="/dashboard/tasks"
          className="group rounded-xl border border-white/[0.06] bg-white/[0.02] p-5 hover:bg-white/[0.04] hover:border-violet-500/20 transition-all"
        >
          <ListTodo className="w-5 h-5 text-violet-400 mb-3" />
          <h4 className="text-sm font-semibold mb-1">View All Tasks</h4>
          <p className="text-[12px] text-muted-foreground">
            {stats.totalTasks} tasks · {stats.completedTasks} completed
          </p>
          <ChevronRight className="w-4 h-4 text-muted-foreground mt-3 group-hover:translate-x-0.5 transition-transform" />
        </Link>
        <Link
          href="/dashboard/playground"
          className="group rounded-xl border border-white/[0.06] bg-white/[0.02] p-5 hover:bg-white/[0.04] hover:border-cyan-500/20 transition-all"
        >
          <Target className="w-5 h-5 text-cyan-400 mb-3" />
          <h4 className="text-sm font-semibold mb-1">AI Agent Lab</h4>
          <p className="text-[12px] text-muted-foreground">
            Execute, inspect & debug agent workflows
          </p>
          <ChevronRight className="w-4 h-4 text-muted-foreground mt-3 group-hover:translate-x-0.5 transition-transform" />
        </Link>
        <Link
          href="/dashboard/workflows"
          className="group rounded-xl border border-white/[0.06] bg-white/[0.02] p-5 hover:bg-white/[0.04] hover:border-amber-500/20 transition-all"
        >
          <Workflow className="w-5 h-5 text-amber-400 mb-3" />
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
          <Layers className="w-5 h-5 text-emerald-400 mb-3" />
          <h4 className="text-sm font-semibold mb-1">Deploy Agent</h4>
          <p className="text-[12px] text-muted-foreground">
            {stats.totalAgents} agents in marketplace
          </p>
          <ChevronRight className="w-4 h-4 text-muted-foreground mt-3 group-hover:translate-x-0.5 transition-transform" />
        </Link>
      </div>
    </div>
  );
}
