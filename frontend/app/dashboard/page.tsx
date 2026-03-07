"use client";

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
} from "recharts";
import { MetricsCard } from "@/components/metrics-card/metrics-card";
import {
  mockDashboardMetrics,
  mockWorkflows,
  mockAgents,
} from "@/lib/mock-data";
import { cn, formatCurrency, formatNumber, formatDuration } from "@/lib/utils";

export default function DashboardPage() {
  const m = mockDashboardMetrics;

  return (
    <div className="space-y-6 max-w-[1400px]">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-1">System intelligence overview</p>
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
          value={m.activeAgents.toString()}
          icon={Bot}
          subtitle={`${mockAgents.length} total registered`}
        />
        <MetricsCard
          title="Active Workflows"
          value={formatNumber(m.totalWorkflows)}
          change="+12.3%"
          changeType="positive"
          icon={Activity}
          subtitle="Last 30 days"
        />
        <MetricsCard
          title="Marketplace Agents"
          value={mockAgents.length.toString()}
          icon={Zap}
          subtitle="Available for deployment"
        />
        <MetricsCard
          title="Today's Outcomes"
          value={`${m.successRate}%`}
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
              <p className="text-xs text-muted-foreground mt-0.5">Outcome-based earnings</p>
            </div>
            <div className="text-right">
              <p className="text-lg font-semibold">{formatCurrency(m.totalRevenue)}</p>
              <p className="text-[10px] text-emerald-400 flex items-center gap-0.5 justify-end">
                <ArrowUpRight className="w-3 h-3" /> +18.2%
              </p>
            </div>
          </div>
          <div className="h-[220px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={m.revenueOverTime}>
                <defs>
                  <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
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
                  formatter={(value: number) => [`$${value.toLocaleString()}`, "Revenue"]}
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
            {mockWorkflows.slice(0, 6).map((wf) => (
              <div key={wf.id} className="px-5 py-3 hover:bg-white/[0.02] transition-colors">
                <div className="flex items-center gap-2 mb-1">
                  <div className={cn(
                    "w-1.5 h-1.5 rounded-full",
                    wf.status === "completed" && "bg-emerald-500",
                    wf.status === "running" && "bg-indigo-400 animate-pulse",
                    wf.status === "failed" && "bg-red-500",
                    wf.status === "pending" && "bg-zinc-600",
                  )} />
                  <span className="text-xs text-foreground truncate">{wf.taskInput}</span>
                </div>
                <div className="flex items-center gap-2 pl-3.5">
                  <span className="text-[10px] text-muted-foreground font-mono">{wf.id}</span>
                  {wf.duration && (
                    <span className="text-[10px] text-muted-foreground">{formatDuration(wf.duration)}</span>
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
              <p className="text-xs text-muted-foreground mt-0.5">Daily success vs failure rate</p>
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
              <AreaChart data={m.dailyOutcomes}>
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
            {mockAgents.map((agent) => (
              <div key={agent.id} className="px-5 py-3 flex items-center justify-between hover:bg-white/[0.02] transition-colors">
                <div className="flex items-center gap-2.5">
                  <div className={cn(
                    "w-1.5 h-1.5 rounded-full",
                    agent.status === "active" && "bg-emerald-500 shadow-[0_0_4px_rgba(34,197,94,0.5)]",
                    agent.status === "idle" && "bg-amber-500",
                    agent.status === "error" && "bg-red-500",
                    agent.status === "offline" && "bg-zinc-600",
                  )} />
                  <span className="text-sm">{agent.name}</span>
                </div>
                <span className="text-[11px] text-muted-foreground">{agent.successRate}%</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
