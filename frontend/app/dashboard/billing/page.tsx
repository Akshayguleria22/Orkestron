"use client";

import { useEffect, useState, useCallback } from "react";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { MetricsCard } from "@/components/metrics-card/metrics-card";
import { cn } from "@/lib/utils";
import {
  DollarSign,
  TrendingUp,
  Receipt,
  CreditCard,
  CheckCircle,
  Clock,
  Zap,
  Bot,
  ListTodo,
  Loader2,
  Brain,
  BarChart3,
  Activity,
} from "lucide-react";
import { api } from "@/lib/api-client";
import { useAuth } from "@/lib/auth-context";

type UsageEntry = {
  date: string;
  tasks: number;
  agents_used: number;
  tokens_estimate: number;
  cost_estimate: number;
};

type TaskBilling = {
  task_id: string;
  input: string;
  status: string;
  task_type: string;
  agents_count: number;
  duration: number;
  cost: number;
  created_at: string;
};

// Cost estimation: $0.002 per task + $0.001 per second of execution
const estimateTaskCost = (duration: number, agentCount: number): number => {
  const baseCost = 0.002;
  const durationCost = (duration || 0) * 0.001;
  const agentCost = (agentCount || 1) * 0.0005;
  return Math.round((baseCost + durationCost + agentCost) * 10000) / 10000;
};

export default function BillingPage() {
  const { getToken, user } = useAuth();
  const [tasks, setTasks] = useState<TaskBilling[]>([]);
  const [dailyUsage, setDailyUsage] = useState<UsageEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [ledger, setLedger] = useState<Record<string, unknown>[]>([]);
  const [billingSummary, setBillingSummary] = useState<Record<string, unknown> | null>(null);

  const buildBillingData = useCallback(async () => {
    const token = getToken();
    if (!token) { setLoading(false); return; }

    try {
      // Fetch real tasks
      const [tasksRes, ledgerRes, summaryRes] = await Promise.allSettled([
        api.listRealTasks(token, undefined, 100),
        api.getLedger(token, user?.id || "system"),
        api.getBillingSummary(token),
      ]);

      const taskBillings: TaskBilling[] = [];
      const dailyMap = new Map<string, UsageEntry>();

      if (tasksRes.status === "fulfilled") {
        const rawTasks = (tasksRes.value.tasks || []) as Record<string, unknown>[];

        for (const t of rawTasks) {
          const agentPath = (t.agent_path as string[]) || [];
          const duration = (t.total_duration as number) || 0;
          const cost = estimateTaskCost(duration, agentPath.length);
          const created = t.created_at as string;
          const date = created ? created.split("T")[0] : new Date().toISOString().split("T")[0];

          taskBillings.push({
            task_id: t.task_id as string,
            input: ((t.input as string) || "").slice(0, 80),
            status: t.status as string,
            task_type: (t.task_type as string) || "general",
            agents_count: agentPath.length,
            duration,
            cost,
            created_at: created,
          });

          // Aggregate daily
          if (!dailyMap.has(date)) {
            dailyMap.set(date, { date, tasks: 0, agents_used: 0, tokens_estimate: 0, cost_estimate: 0 });
          }
          const entry = dailyMap.get(date)!;
          entry.tasks += 1;
          entry.agents_used += agentPath.length;
          entry.tokens_estimate += Math.round(duration * 50); // Rough token estimate
          entry.cost_estimate = Math.round((entry.cost_estimate + cost) * 10000) / 10000;
        }
      }

      if (ledgerRes.status === "fulfilled") {
        const rawLedger = ledgerRes.value as Record<string, unknown>;
        const entries = (rawLedger.entries ?? rawLedger.ledger ?? rawLedger) as Record<string, unknown>[];
        if (Array.isArray(entries)) {
          setLedger(entries);
        }
      }

      if (summaryRes.status === "fulfilled") {
        const summaryData = summaryRes.value as Record<string, unknown>;
        setBillingSummary((summaryData.summary || null) as Record<string, unknown> | null);
      }

      setTasks(taskBillings);

      // Sort daily entries
      const sortedDaily = Array.from(dailyMap.values()).sort((a, b) => a.date.localeCompare(b.date));
      setDailyUsage(sortedDaily);
    } catch {}
    setLoading(false);
  }, [getToken, user]);

  useEffect(() => {
    buildBillingData();
  }, [buildBillingData]);

  // Computed stats
  const totalTasks = tasks.length;
  const completedTasks = tasks.filter((t) => t.status === "completed").length;
  const totalCost = tasks.reduce((s, t) => s + t.cost, 0);
  const totalTokens = dailyUsage.reduce((s, d) => s + d.tokens_estimate, 0);
  const avgCostPerTask = totalTasks > 0 ? totalCost / totalTasks : 0;
  const totalAgentCalls = tasks.reduce((s, t) => s + t.agents_count, 0);

  // Ledger-based revenue if available
  const ledgerRevenue = ledger.reduce((s, e) => s + ((e.revenue as number) || (e.fee as number) || 0), 0);
  const ledgerCosts = ledger.reduce((s, e) => s + ((e.costs as number) || 0), 0);

  const displayRevenue = ledgerRevenue > 0 ? ledgerRevenue : totalCost;
  const displayCosts = ledgerCosts > 0 ? ledgerCosts : totalCost * 0.6;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <Loader2 className="w-6 h-6 text-violet-400 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-[1400px]">
      <div>
        <h1 className="text-xl font-semibold tracking-tight flex items-center gap-2">
          <Receipt className="w-5 h-5 text-violet-400" />
          Usage & Billing
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Platform usage metrics and cost breakdown from real task execution
        </p>
      </div>

      {/* ─── KPI Cards ─── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <MetricsCard
          title="Credits Remaining"
          value={billingSummary ? `$${((billingSummary.credits_remaining as number) || 0).toFixed(2)}` : "$10.00"}
          icon={CreditCard}
          subtitle={billingSummary ? `of $${((billingSummary.starting_credits as number) || 10).toFixed(2)} total` : "Starting credits"}
        />
        <MetricsCard
          title="Total Tasks"
          value={totalTasks.toString()}
          icon={ListTodo}
          subtitle={`${completedTasks} completed`}
        />
        <MetricsCard
          title="Total Fees"
          value={billingSummary ? `$${((billingSummary.total_fees as number) || 0).toFixed(4)}` : `$${totalCost.toFixed(4)}`}
          icon={DollarSign}
          subtitle={`$${avgCostPerTask.toFixed(4)} avg/task`}
        />
        <MetricsCard
          title="Agent Calls"
          value={totalAgentCalls.toString()}
          icon={Bot}
          subtitle={`Across ${totalTasks} tasks`}
        />
        <MetricsCard
          title="Est. Tokens"
          value={totalTokens.toLocaleString()}
          icon={Zap}
          subtitle="Approximate token usage"
        />
      </div>

      {/* ─── Charts ─── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Daily Usage Chart */}
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-5">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-sm font-semibold">Daily Task Volume</h3>
              <p className="text-xs text-muted-foreground mt-0.5">Tasks per day</p>
            </div>
          </div>
          <div className="h-[240px]">
            {dailyUsage.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={dailyUsage}>
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
                  <Bar dataKey="tasks" fill="#6366f1" radius={[4, 4, 0, 0]} name="Tasks" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
                <div className="text-center">
                  <BarChart3 className="w-8 h-8 mx-auto mb-2 text-zinc-700" />
                  <p>No usage data yet</p>
                  <p className="text-xs text-muted-foreground/60 mt-1">Submit tasks to see usage</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Cost Over Time Chart */}
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-5">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-sm font-semibold">Cost Trend</h3>
              <p className="text-xs text-muted-foreground mt-0.5">Estimated daily costs</p>
            </div>
          </div>
          <div className="h-[240px]">
            {dailyUsage.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={dailyUsage}>
                  <defs>
                    <linearGradient id="costGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="rgb(34, 197, 94)" stopOpacity={0.15} />
                      <stop offset="95%" stopColor="rgb(34, 197, 94)" stopOpacity={0} />
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
                  <YAxis tick={{ fontSize: 10, fill: "rgba(255,255,255,0.3)" }} axisLine={false} tickLine={false} tickFormatter={(v) => `$${v}`} />
                  <Tooltip
                    contentStyle={{ background: "#111827", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "8px", fontSize: "12px" }}
                    formatter={(v: number) => [`$${v.toFixed(4)}`, "Cost"]}
                    labelStyle={{ color: "rgba(255,255,255,0.5)" }}
                  />
                  <Area type="monotone" dataKey="cost_estimate" stroke="rgb(34, 197, 94)" strokeWidth={2} fill="url(#costGrad)" name="Cost" />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
                <div className="text-center">
                  <DollarSign className="w-8 h-8 mx-auto mb-2 text-zinc-700" />
                  <p>No cost data yet</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ─── Task Billing Table ─── */}
      <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] overflow-hidden">
        <div className="px-5 py-4 border-b border-white/[0.04] flex items-center justify-between">
          <h3 className="text-sm font-semibold">Task Execution Costs</h3>
          <span className="text-xs text-muted-foreground">{tasks.length} tasks</span>
        </div>

        {tasks.length === 0 ? (
          <div className="px-5 py-12 text-center text-sm text-muted-foreground">
            <ListTodo className="w-8 h-8 mx-auto mb-2 text-zinc-700" />
            <p>No billing data yet</p>
            <p className="text-xs text-muted-foreground/60 mt-1">Submit tasks to generate billing entries</p>
          </div>
        ) : (
          <>
            {/* Table header */}
            <div className="grid grid-cols-7 gap-4 px-5 py-2.5 border-b border-white/[0.04] text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
              <span className="col-span-2">Task</span>
              <span>Type</span>
              <span>Status</span>
              <span>Agents</span>
              <span>Duration</span>
              <span>Est. Cost</span>
            </div>

            {/* Rows */}
            <div className="divide-y divide-white/[0.03] max-h-[400px] overflow-y-auto">
              {tasks.map((task) => (
                <div
                  key={task.task_id}
                  className="grid grid-cols-7 gap-4 px-5 py-3 items-center hover:bg-white/[0.02] transition-colors"
                >
                  <span className="text-xs text-foreground truncate col-span-2">
                    {task.input}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {task.task_type}
                  </span>
                  <span className={cn("text-xs font-medium",
                    task.status === "completed" ? "text-emerald-400" :
                    task.status === "failed" ? "text-red-400" :
                    "text-amber-400"
                  )}>
                    {task.status}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {task.agents_count}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {task.duration ? `${task.duration.toFixed(1)}s` : "—"}
                  </span>
                  <span className="text-xs font-medium text-foreground">
                    ${task.cost.toFixed(4)}
                  </span>
                </div>
              ))}
            </div>

            {/* Total */}
            <div className="grid grid-cols-7 gap-4 px-5 py-3 border-t border-white/[0.06] bg-white/[0.02]">
              <span className="text-xs font-medium col-span-2">Total</span>
              <span></span>
              <span></span>
              <span className="text-xs font-medium">{totalAgentCalls}</span>
              <span></span>
              <span className="text-xs font-bold text-emerald-400">${totalCost.toFixed(4)}</span>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
