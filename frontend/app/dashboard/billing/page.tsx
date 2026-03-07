"use client";

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
  LineChart,
  Line,
} from "recharts";
import { MetricsCard } from "@/components/metrics-card/metrics-card";
import { mockBillingEvents, mockLedger, mockDashboardMetrics } from "@/lib/mock-data";
import { cn, formatCurrency } from "@/lib/utils";
import {
  DollarSign,
  TrendingUp,
  Receipt,
  CreditCard,
  ArrowUpRight,
  ArrowDownRight,
  CheckCircle,
  Clock,
  RotateCcw,
} from "lucide-react";

const statusIcons: Record<string, typeof CheckCircle> = {
  charged: CheckCircle,
  pending: Clock,
  refunded: RotateCcw,
};
const statusColors: Record<string, string> = {
  charged: "text-emerald-400",
  pending: "text-amber-400",
  refunded: "text-red-400",
};

/**
 * Billing dashboard — revenue metrics, ledger charts, billing events table.
 */
export default function BillingPage() {
  const totalRevenue = mockLedger.reduce((sum, e) => sum + e.revenue, 0);
  const totalCosts = mockLedger.reduce((sum, e) => sum + e.costs, 0);
  const net = totalRevenue - totalCosts;
  const pendingCount = mockBillingEvents.filter((e) => e.status === "pending").length;

  return (
    <div className="space-y-6 max-w-[1400px]">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Billing</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Revenue, outcome billing, and ledger entries
        </p>
      </div>

      {/* ─── KPI Cards ─── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricsCard
          title="Total Revenue"
          value={formatCurrency(totalRevenue)}
          change="+18.2%"
          changeType="positive"
          icon={DollarSign}
          subtitle="Last 30 days"
        />
        <MetricsCard
          title="Net Earnings"
          value={formatCurrency(net)}
          change="+22.1%"
          changeType="positive"
          icon={TrendingUp}
          subtitle="After costs"
        />
        <MetricsCard
          title="Billing Events"
          value={mockBillingEvents.length.toString()}
          icon={Receipt}
          subtitle={`${pendingCount} pending`}
        />
        <MetricsCard
          title="Avg Transaction"
          value={formatCurrency(totalRevenue / mockLedger.reduce((s, e) => s + e.transactionCount, 0))}
          icon={CreditCard}
          subtitle="Per workflow"
        />
      </div>

      {/* ─── Charts ─── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Revenue & Costs */}
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-5">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-sm font-semibold">Revenue vs Costs</h3>
              <p className="text-xs text-muted-foreground mt-0.5">30-day ledger overview</p>
            </div>
            <div className="flex items-center gap-4 text-[11px] text-muted-foreground">
              <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full bg-indigo-500" />
                Revenue
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full bg-red-400/60" />
                Costs
              </div>
            </div>
          </div>
          <div className="h-[240px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={mockLedger}>
                <defs>
                  <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
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
                  tickFormatter={(v) => `$${v}`}
                />
                <Tooltip
                  contentStyle={{
                    background: "hsl(0 0% 8%)",
                    border: "1px solid rgba(255,255,255,0.08)",
                    borderRadius: "8px",
                    fontSize: "12px",
                  }}
                  formatter={(value: number) => [`$${value.toLocaleString()}`]}
                  labelStyle={{ color: "rgba(255,255,255,0.5)" }}
                />
                <Area type="monotone" dataKey="revenue" stroke="rgb(99, 102, 241)" strokeWidth={2} fill="url(#revGrad)" />
                <Area type="monotone" dataKey="costs" stroke="rgba(239, 68, 68, 0.5)" strokeWidth={1.5} fill="rgba(239, 68, 68, 0.05)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Net Earnings */}
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-5">
          <div className="mb-6">
            <h3 className="text-sm font-semibold">Net Earnings Trend</h3>
            <p className="text-xs text-muted-foreground mt-0.5">Daily net profit</p>
          </div>
          <div className="h-[240px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={mockLedger}>
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
                  tickFormatter={(v) => `$${v}`}
                />
                <Tooltip
                  contentStyle={{
                    background: "hsl(0 0% 8%)",
                    border: "1px solid rgba(255,255,255,0.08)",
                    borderRadius: "8px",
                    fontSize: "12px",
                  }}
                  formatter={(value: number) => [`$${value.toLocaleString()}`, "Net"]}
                  labelStyle={{ color: "rgba(255,255,255,0.5)" }}
                />
                <Line type="monotone" dataKey="net" stroke="rgb(34, 197, 94)" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* ─── Billing Events Table ─── */}
      <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] overflow-hidden">
        <div className="px-5 py-4 border-b border-white/[0.04]">
          <h3 className="text-sm font-semibold">Billing Events</h3>
        </div>

        {/* Table header */}
        <div className="grid grid-cols-6 gap-4 px-5 py-2.5 border-b border-white/[0.04] text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
          <span>Event</span>
          <span>Workflow</span>
          <span>Model</span>
          <span>Amount</span>
          <span>Status</span>
          <span>Date</span>
        </div>

        {/* Rows */}
        <div className="divide-y divide-white/[0.03]">
          {mockBillingEvents.map((event) => {
            const StatusIcon = statusIcons[event.status] || CheckCircle;
            return (
              <div
                key={event.id}
                className="grid grid-cols-6 gap-4 px-5 py-3 items-center hover:bg-white/[0.02] transition-colors"
              >
                <span className="text-xs font-mono text-muted-foreground">{event.id}</span>
                <span className="text-xs font-mono text-muted-foreground">{event.workflowId}</span>
                <span className="text-xs capitalize text-muted-foreground">
                  {event.pricingModel.replace(/_/g, " ")}
                </span>
                <span className="text-sm font-medium text-foreground">
                  {formatCurrency(event.amount)}
                </span>
                <div className="flex items-center gap-1.5">
                  <StatusIcon className={cn("w-3 h-3", statusColors[event.status])} />
                  <span className={cn("text-xs capitalize", statusColors[event.status])}>
                    {event.status}
                  </span>
                </div>
                <span className="text-xs text-muted-foreground">
                  {new Date(event.createdAt).toLocaleDateString()}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
