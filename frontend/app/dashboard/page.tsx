"use client";

import { motion } from "framer-motion";
import {
  Activity,
  TrendingUp,
  DollarSign,
  Bot,
  Clock,
  CheckCircle,
  XCircle,
  ArrowUpRight,
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

/**
 * Main dashboard page showing KPI cards, charts, recent workflows, and agent status.
 */
export default function DashboardPage() {
  const m = mockDashboardMetrics;

  return (
    <div className="space-y-6 max-w-[1400px]">
      {/* Page header */}
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Dashboard</h1>
        <p className="text-sm text-muted-foreground mt-1">System overview and real-time metrics</p>
      </div>

      {/* ─── KPI Cards ─── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricsCard
          title="Total Workflows"
          value={formatNumber(m.totalWorkflows)}
          change="+12.3%"
          changeType="positive"
          icon={Activity}
          subtitle="Last 30 days"
        />
        <MetricsCard
          title="Success Rate"
          value={`${m.successRate}%`}
          change="+0.8%"
          changeType="positive"
          icon={CheckCircle}
          subtitle="Across all agents"
        />
        <MetricsCard
          title="Total Revenue"
          value={formatCurrency(m.totalRevenue)}
          change="+18.2%"
          changeType="positive"
          icon={DollarSign}
          subtitle="Outcome-based billing"
        />
        <MetricsCard
          title="Active Agents"
          value={m.activeAgents.toString()}
          icon={Bot}
          subtitle={`${mockAgents.length} total registered`}
        />
      </div>

      {/* ─── Charts ─── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Workflow outcomes chart */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-5"
        >
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-sm font-semibold">Workflow Outcomes</h3>
              <p className="text-xs text-muted-foreground mt-0.5">Daily success vs failure rate</p>
            </div>
            <div className="flex items-center gap-4 text-[11px] text-muted-foreground">
              <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full bg-blue-500" />
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
                    <stop offset="5%" stopColor="rgb(59, 130, 246)" stopOpacity={0.15} />
                    <stop offset="95%" stopColor="rgb(59, 130, 246)" stopOpacity={0} />
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
                    background: "hsl(0 0% 8%)",
                    border: "1px solid rgba(255,255,255,0.08)",
                    borderRadius: "8px",
                    fontSize: "12px",
                  }}
                  labelStyle={{ color: "rgba(255,255,255,0.5)" }}
                />
                <Area
                  type="monotone"
                  dataKey="successful"
                  stroke="rgb(59, 130, 246)"
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
        </motion.div>

        {/* Revenue chart */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-5"
        >
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-sm font-semibold">Revenue</h3>
              <p className="text-xs text-muted-foreground mt-0.5">Daily outcome-based earnings</p>
            </div>
          </div>
          <div className="h-[220px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={m.revenueOverTime}>
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
                    background: "hsl(0 0% 8%)",
                    border: "1px solid rgba(255,255,255,0.08)",
                    borderRadius: "8px",
                    fontSize: "12px",
                  }}
                  formatter={(value: number) => [`$${value.toLocaleString()}`, "Revenue"]}
                  labelStyle={{ color: "rgba(255,255,255,0.5)" }}
                />
                <Bar dataKey="revenue" fill="rgba(59, 130, 246, 0.6)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </motion.div>
      </div>

      {/* ─── Recent Workflows & Agent Status ─── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Recent Workflows */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="lg:col-span-2 rounded-xl border border-white/[0.06] bg-white/[0.02] overflow-hidden"
        >
          <div className="px-5 py-4 border-b border-white/[0.04]">
            <h3 className="text-sm font-semibold">Recent Executions</h3>
          </div>
          <div className="divide-y divide-white/[0.03]">
            {mockWorkflows.map((wf) => (
              <div key={wf.id} className="px-5 py-3.5 flex items-center justify-between hover:bg-white/[0.02] transition-colors">
                <div className="flex items-center gap-3 min-w-0">
                  <div className={cn(
                    "w-7 h-7 rounded-lg flex items-center justify-center shrink-0",
                    wf.status === "completed" && "bg-emerald-500/10 border border-emerald-500/20",
                    wf.status === "running" && "bg-blue-500/10 border border-blue-500/20",
                    wf.status === "failed" && "bg-red-500/10 border border-red-500/20",
                    wf.status === "pending" && "bg-zinc-500/10 border border-zinc-500/20",
                  )}>
                    {wf.status === "completed" && <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />}
                    {wf.status === "running" && <Activity className="w-3.5 h-3.5 text-blue-400 animate-pulse" />}
                    {wf.status === "failed" && <XCircle className="w-3.5 h-3.5 text-red-400" />}
                    {wf.status === "pending" && <Clock className="w-3.5 h-3.5 text-zinc-400" />}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm text-foreground truncate">{wf.taskInput}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-[10px] text-muted-foreground font-mono">{wf.id}</span>
                      <span className="text-[10px] text-muted-foreground capitalize px-1.5 py-0.5 rounded bg-white/[0.03]">{wf.intent}</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-4 shrink-0">
                  {wf.savings && wf.savings > 0 && (
                    <div className="flex items-center gap-1 text-emerald-400">
                      <ArrowUpRight className="w-3 h-3" />
                      <span className="text-xs font-medium">${wf.savings.toLocaleString()}</span>
                    </div>
                  )}
                  {wf.duration && (
                    <span className="text-[11px] text-muted-foreground">{formatDuration(wf.duration)}</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Agent Status */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
          className="rounded-xl border border-white/[0.06] bg-white/[0.02] overflow-hidden"
        >
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
        </motion.div>
      </div>
    </div>
  );
}
