"use client";

import { useEffect, useState } from "react";
import {
  Activity,
  TrendingUp,
  DollarSign,
  Bot,
  Clock,
  CheckCircle,
  XCircle,
  ArrowUpRight,
  Zap,
  Package,
  Info,
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
import {
  mockDashboardMetrics,
  mockWorkflows,
  mockAgents,
} from "@/lib/mock-data";
import { cn, formatCurrency, formatNumber, formatDuration } from "@/lib/utils";
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

export default function DashboardPage() {
  const { getToken } = useAuth();
  const [analytics, setAnalytics] = useState<Record<string, unknown> | null>(
    null,
  );
  const [dailyOutcomes, setDailyOutcomes] = useState<
    Record<string, unknown>[] | null
  >(null);
  const [revenue, setRevenue] = useState<Record<string, unknown>[] | null>(
    null,
  );
  const [agentUsage, setAgentUsage] = useState<
    Record<string, unknown>[] | null
  >(null);
  const [liveWorkflows, setLiveWorkflows] = useState<
    Record<string, unknown>[] | null
  >(null);
  const [liveAgents, setLiveAgents] = useState<
    Record<string, unknown>[] | null
  >(null);
  const [isDemo, setIsDemo] = useState(true);

  useEffect(() => {
    const token = getToken();
    if (!token) return;

    let loaded = false;
    Promise.all([
      api
        .getDashboardAnalytics(token)
        .then((d) => {
          setAnalytics(d.analytics);
          loaded = true;
        })
        .catch(() => {}),
      api
        .getDailyOutcomes(token, 14)
        .then((d) => {
          setDailyOutcomes(d.outcomes);
          loaded = true;
        })
        .catch(() => {}),
      api
        .getRevenue(token, 14)
        .then((d) => {
          setRevenue(d.revenue);
          loaded = true;
        })
        .catch(() => {}),
      api
        .getAgentUsage(token)
        .then((d) => {
          setAgentUsage(d.usage);
          loaded = true;
        })
        .catch(() => {}),
      api
        .listWorkflows(token)
        .then((d) => {
          setLiveWorkflows(d.workflows);
          loaded = true;
        })
        .catch(() => {}),
      api
        .getAgents()
        .then((d) => {
          setLiveAgents(
            Array.isArray(d)
              ? d
              : (((d as Record<string, unknown>).agents as Record<
                  string,
                  unknown
                >[]) ?? []),
          );
          loaded = true;
        })
        .catch(() => {}),
    ]).then(() => {
      if (loaded) setIsDemo(false);
    });
  }, [getToken]);

  // Use real analytics if available, otherwise mock
  const m = mockDashboardMetrics;
  const totalWorkflows =
    (analytics?.total_workflows as number) ?? m.totalWorkflows;
  const successRate = (analytics?.success_rate as number) ?? m.successRate;
  const activeAgents = (analytics?.active_agents as number) ?? m.activeAgents;
  const totalRevenue = (analytics?.total_revenue as number) ?? m.totalRevenue;
  const revenueData = revenue ?? m.revenueOverTime;
  const outcomesData = dailyOutcomes ?? m.dailyOutcomes;
  const activityWorkflows = liveWorkflows ?? mockWorkflows;
  const displayAgents = liveAgents ?? mockAgents;

  return (
    <div className="space-y-6 max-w-[1400px]">
      {/* Demo banner */}
      {isDemo && (
        <div className="flex items-center gap-2 px-4 py-2.5 rounded-lg border border-amber-500/20 bg-amber-500/5 text-amber-300 text-xs">
          <Info className="w-3.5 h-3.5 shrink-0" />
          <span>
            Showing demo data — connect agents and create workflows to see live
            metrics.
          </span>
        </div>
      )}

      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-1">
            System intelligence overview
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
          All systems operational
        </div>
      </div>

      {/* ─── KPI Cards ─── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricsCard
          title="Agents Online"
          value={activeAgents.toString()}
          icon={Bot}
          subtitle={`${displayAgents.length} total registered`}
        />
        <MetricsCard
          title="Active Workflows"
          value={formatNumber(totalWorkflows)}
          change="+12.3%"
          changeType="positive"
          icon={Activity}
          subtitle="Last 30 days"
        />
        <MetricsCard
          title="Marketplace Agents"
          value={displayAgents.length.toString()}
          icon={Zap}
          subtitle="Available for deployment"
        />
        <MetricsCard
          title="Today's Outcomes"
          value={`${successRate}%`}
          change="+0.8%"
          changeType="positive"
          icon={CheckCircle}
          subtitle="Success rate"
        />
      </div>

      {/* ─── Charts + Live Activity ─── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Revenue chart - 2 col */}
        <div className="lg:col-span-2 rounded-xl border border-white/[0.06] bg-white/[0.02] p-5">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-sm font-semibold">Revenue</h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Outcome-based earnings
              </p>
            </div>
            <div className="text-right">
              <p className="text-lg font-semibold">
                {formatCurrency(totalRevenue)}
              </p>
              <p className="text-[10px] text-emerald-400 flex items-center gap-0.5 justify-end">
                <ArrowUpRight className="w-3 h-3" /> +18.2%
              </p>
            </div>
          </div>
          <div className="h-[220px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={revenueData}>
                <defs>
                  <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                    <stop
                      offset="5%"
                      stopColor="rgb(99, 102, 241)"
                      stopOpacity={0.15}
                    />
                    <stop
                      offset="95%"
                      stopColor="rgb(99, 102, 241)"
                      stopOpacity={0}
                    />
                  </linearGradient>
                </defs>
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="rgba(255,255,255,0.03)"
                />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 10, fill: "rgba(255,255,255,0.3)" }}
                  tickFormatter={(v) => v.slice(5)}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 10, fill: "rgba(255,255,255,0.3)" }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`}
                />
                <Tooltip
                  contentStyle={{
                    background: "#111827",
                    border: "1px solid rgba(255,255,255,0.08)",
                    borderRadius: "8px",
                    fontSize: "12px",
                  }}
                  formatter={(value: number) => [
                    `$${value.toLocaleString()}`,
                    "Revenue",
                  ]}
                  labelStyle={{ color: "rgba(255,255,255,0.5)" }}
                />
                <Area
                  type="monotone"
                  dataKey="revenue"
                  stroke="rgb(99, 102, 241)"
                  strokeWidth={2}
                  fill="url(#colorRevenue)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Live Activity Feed */}
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] overflow-hidden">
          <div className="px-5 py-4 border-b border-white/[0.04] flex items-center justify-between">
            <h3 className="text-sm font-semibold">Live Activity</h3>
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
          </div>
          <div className="divide-y divide-white/[0.03] max-h-[280px] overflow-y-auto">
            {(activityWorkflows as Record<string, unknown>[])
              .slice(0, 6)
              .map((wf, i) => (
                <div
                  key={(wf.id as string) || i}
                  className="px-5 py-3 hover:bg-white/[0.02] transition-colors"
                >
                  <div className="flex items-center gap-2 mb-1">
                    <div
                      className={cn(
                        "w-1.5 h-1.5 rounded-full",
                        (wf.status as string) === "completed" &&
                          "bg-emerald-500",
                        (wf.status as string) === "running" &&
                          "bg-indigo-400 animate-pulse",
                        (wf.status as string) === "failed" && "bg-red-500",
                        (wf.status as string) === "pending" && "bg-zinc-600",
                      )}
                    />
                    <span className="text-xs text-foreground truncate">
                      {(wf.taskInput as string) ||
                        (wf.name as string) ||
                        (wf.task_input as string) ||
                        "Workflow"}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 pl-3.5">
                    <span className="text-[10px] text-muted-foreground font-mono">
                      {(wf.id as string)?.slice(0, 12)}
                    </span>
                    {(wf.duration as number) && (
                      <span className="text-[10px] text-muted-foreground">
                        {formatDuration(wf.duration as number)}
                      </span>
                    )}
                  </div>
                </div>
              ))}
          </div>
        </div>
      </div>

      {/* ─── Outcomes Chart + Agent Status ─── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Workflow outcomes chart */}
        <div className="lg:col-span-2 rounded-xl border border-white/[0.06] bg-white/[0.02] p-5">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-sm font-semibold">Workflow Outcomes</h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Daily success vs failure rate
              </p>
            </div>
            <div className="flex items-center gap-4 text-[11px] text-muted-foreground">
              <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full bg-indigo-500" />
                Successful
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full bg-red-400/60" />
                Failed
              </div>
            </div>
          </div>
          <div className="h-[220px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={outcomesData}>
                <defs>
                  <linearGradient id="colorSuccess" x1="0" y1="0" x2="0" y2="1">
                    <stop
                      offset="5%"
                      stopColor="rgb(99, 102, 241)"
                      stopOpacity={0.15}
                    />
                    <stop
                      offset="95%"
                      stopColor="rgb(99, 102, 241)"
                      stopOpacity={0}
                    />
                  </linearGradient>
                </defs>
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="rgba(255,255,255,0.03)"
                />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 10, fill: "rgba(255,255,255,0.3)" }}
                  tickFormatter={(v) => v.slice(5)}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 10, fill: "rgba(255,255,255,0.3)" }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  contentStyle={{
                    background: "#111827",
                    border: "1px solid rgba(255,255,255,0.08)",
                    borderRadius: "8px",
                    fontSize: "12px",
                  }}
                  labelStyle={{ color: "rgba(255,255,255,0.5)" }}
                />
                <Area
                  type="monotone"
                  dataKey="successful"
                  stroke="rgb(99, 102, 241)"
                  strokeWidth={2}
                  fill="url(#colorSuccess)"
                />
                <Area
                  type="monotone"
                  dataKey="failed"
                  stroke="rgba(239, 68, 68, 0.5)"
                  strokeWidth={1.5}
                  fill="rgba(239, 68, 68, 0.05)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Agent Status */}
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] overflow-hidden">
          <div className="px-5 py-4 border-b border-white/[0.04]">
            <h3 className="text-sm font-semibold">Agent Status</h3>
          </div>
          <div className="divide-y divide-white/[0.03]">
            {(displayAgents as Record<string, unknown>[]).map((agent, i) => (
              <div
                key={(agent.id as string) || i}
                className="px-5 py-3 flex items-center justify-between hover:bg-white/[0.02] transition-colors"
              >
                <div className="flex items-center gap-2.5">
                  <div
                    className={cn(
                      "w-1.5 h-1.5 rounded-full",
                      (agent.status as string) === "active" &&
                        "bg-emerald-500 shadow-[0_0_4px_rgba(34,197,94,0.5)]",
                      (agent.status as string) === "idle" && "bg-amber-500",
                      (agent.status as string) === "error" && "bg-red-500",
                      (agent.status as string) === "offline" && "bg-zinc-600",
                    )}
                  />
                  <span className="text-sm">{agent.name as string}</span>
                </div>
                <span className="text-[11px] text-muted-foreground">
                  {(agent.successRate as number) ??
                    (agent.success_rate as number) ??
                    "—"}
                  %
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ─── Agent Usage Pie + Product Stats ─── */}
      {agentUsage && agentUsage.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-5">
            <h3 className="text-sm font-semibold mb-4">
              Agent Usage Distribution
            </h3>
            <div className="h-[220px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={agentUsage.map((a, i) => ({
                      name: (a.agent_id as string) || `Agent ${i + 1}`,
                      value: (a.total_tasks as number) || 0,
                    }))}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={80}
                    dataKey="value"
                    stroke="rgba(255,255,255,0.06)"
                    strokeWidth={1}
                  >
                    {agentUsage.map((_, i) => (
                      <Cell
                        key={i}
                        fill={CHART_COLORS[i % CHART_COLORS.length]}
                      />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      background: "#111827",
                      border: "1px solid rgba(255,255,255,0.08)",
                      borderRadius: "8px",
                      fontSize: "12px",
                    }}
                    labelStyle={{ color: "rgba(255,255,255,0.5)" }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="flex flex-wrap gap-3 mt-2">
              {agentUsage.slice(0, 6).map((a, i) => (
                <div
                  key={i}
                  className="flex items-center gap-1.5 text-[11px] text-muted-foreground"
                >
                  <div
                    className="w-2 h-2 rounded-full"
                    style={{
                      backgroundColor: CHART_COLORS[i % CHART_COLORS.length],
                    }}
                  />
                  {(a.agent_id as string) || `Agent ${i + 1}`}
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-5">
            <h3 className="text-sm font-semibold mb-4">Performance Overview</h3>
            <div className="h-[220px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={agentUsage.map((a) => ({
                    name: ((a.agent_id as string) || "").slice(0, 8),
                    success: (a.success_rate as number) || 0,
                  }))}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="rgba(255,255,255,0.03)"
                  />
                  <XAxis
                    dataKey="name"
                    tick={{ fontSize: 10, fill: "rgba(255,255,255,0.3)" }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 10, fill: "rgba(255,255,255,0.3)" }}
                    axisLine={false}
                    tickLine={false}
                    domain={[0, 100]}
                  />
                  <Tooltip
                    contentStyle={{
                      background: "#111827",
                      border: "1px solid rgba(255,255,255,0.08)",
                      borderRadius: "8px",
                      fontSize: "12px",
                    }}
                    formatter={(v: number) => [
                      `${v.toFixed(1)}%`,
                      "Success Rate",
                    ]}
                    labelStyle={{ color: "rgba(255,255,255,0.5)" }}
                  />
                  <Bar dataKey="success" fill="#6366f1" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
