"use client";

import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import {
  User,
  Mail,
  Shield,
  Calendar,
  Activity,
  Bot,
  Zap,
  CheckCircle,
  XCircle,
  Clock,
  BarChart3,
  Globe,
  Brain,
  TrendingUp,
  Sparkles,
  Award,
  Target,
  ListTodo,
  CreditCard,
  FileText,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth-context";
import { api } from "@/lib/api-client";

type TaskItem = {
  task_id: string;
  status: string;
  total_duration?: number;
  created_at?: string;
};

/* Skeleton */
function ProfileSkeleton() {
  return (
    <div className="space-y-6 max-w-[1200px] animate-pulse">
      <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-8">
        <div className="flex items-start gap-6">
          <div className="w-20 h-20 rounded-2xl bg-white/[0.05]" />
          <div className="space-y-3 flex-1">
            <div className="h-6 w-48 bg-white/[0.05] rounded-lg" />
            <div className="h-4 w-64 bg-white/[0.03] rounded" />
            <div className="h-4 w-40 bg-white/[0.03] rounded" />
          </div>
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-5 space-y-3">
            <div className="h-4 w-20 bg-white/[0.05] rounded" />
            <div className="h-8 w-16 bg-white/[0.05] rounded" />
          </div>
        ))}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {[...Array(2)].map((_, i) => (
          <div key={i} className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-5 h-60" />
        ))}
      </div>
    </div>
  );
}

export default function ProfilePage() {
  const { user, getToken } = useAuth();
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [agents, setAgents] = useState<unknown[]>([]);
  const [billingSummary, setBillingSummary] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    const token = getToken();
    if (!token) { setLoading(false); return; }

    await Promise.allSettled([
      api.listRealTasks(token, undefined, 50)
        .then((d) => setTasks((d.tasks || []) as TaskItem[]))
        .catch(() => {}),
      api.listPlatformAgents(token)
        .then((d) => setAgents(d.agents || []))
        .catch(() => {}),
      api.getBillingSummary(token)
        .then((d) => setBillingSummary(d.summary))
        .catch(() => {}),
    ]);
    setLoading(false);
  }, [getToken]);

  useEffect(() => { fetchData(); }, [fetchData]);

  if (loading) return <ProfileSkeleton />;

  const completedTasks = tasks.filter(t => t.status === "completed").length;
  const failedTasks = tasks.filter(t => t.status === "failed").length;
  const totalTasks = tasks.length;
  const successRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
  const avgDuration = completedTasks > 0
    ? (tasks.filter(t => t.status === "completed" && t.total_duration).reduce((s, t) => s + (t.total_duration || 0), 0) / completedTasks).toFixed(1)
    : "0";
  const totalCredits = (billingSummary as any)?.credits_remaining ?? 10;
  const totalFees = (billingSummary as any)?.total_fees ?? 0;

  // Activity heatmap data (simplified — last 30 days)
  const activityByDay = Array.from({ length: 30 }, (_, i) => {
    const date = new Date();
    date.setDate(date.getDate() - (29 - i));
    const dayStr = date.toISOString().split("T")[0];
    const count = tasks.filter(t => t.created_at?.startsWith(dayStr)).length;
    return { date: dayStr, count };
  });

  const memberSince = user ? "Member since 2025" : "";

  return (
    <div className="space-y-6 max-w-[1200px]">
      {/* ─── Header ─── */}
      <div>
        <h1 className="text-xl font-semibold tracking-tight flex items-center gap-2">
          <User className="w-5 h-5 text-violet-400" />
          Profile
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Your account details and activity overview
        </p>
      </div>

      {/* ─── Profile Card ─── */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-2xl border border-white/[0.08] bg-gradient-to-br from-violet-500/[0.04] to-cyan-500/[0.02] p-8"
      >
        <div className="flex flex-col md:flex-row items-start gap-6">
          {/* Avatar */}
          <div className="relative">
            <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-violet-500/30 to-cyan-500/30 border-2 border-violet-500/30 flex items-center justify-center text-3xl font-bold text-white shadow-xl shadow-violet-500/10">
              {user?.name?.[0]?.toUpperCase() || "U"}
            </div>
            <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-emerald-500 border-2 border-background flex items-center justify-center">
              <CheckCircle className="w-3 h-3 text-white" />
            </div>
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <h2 className="text-2xl font-bold tracking-tight">{user?.name || "User"}</h2>
            <div className="flex flex-wrap items-center gap-3 mt-2 text-sm text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <Mail className="w-3.5 h-3.5" />
                {user?.email || "—"}
              </span>
              <span className="flex items-center gap-1.5">
                <Shield className="w-3.5 h-3.5" />
                {user?.provider === "local" ? "Email Account" : `${user?.provider || "local"} OAuth`}
              </span>
              <span className="flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5" />
                {memberSince}
              </span>
            </div>

            {/* Badges */}
            <div className="flex flex-wrap items-center gap-2 mt-4">
              {totalTasks >= 1 && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full border border-violet-500/20 bg-violet-500/[0.08] text-[11px] text-violet-300 font-medium">
                  <Zap className="w-3 h-3" /> First Task
                </span>
              )}
              {totalTasks >= 10 && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full border border-cyan-500/20 bg-cyan-500/[0.08] text-[11px] text-cyan-300 font-medium">
                  <Award className="w-3 h-3" /> Power User
                </span>
              )}
              {successRate >= 80 && totalTasks >= 5 && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full border border-emerald-500/20 bg-emerald-500/[0.08] text-[11px] text-emerald-300 font-medium">
                  <Target className="w-3 h-3" /> High Accuracy
                </span>
              )}
              {agents.length >= 3 && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full border border-amber-500/20 bg-amber-500/[0.08] text-[11px] text-amber-300 font-medium">
                  <Bot className="w-3 h-3" /> Agent Deployer
                </span>
              )}
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full border border-white/[0.08] bg-white/[0.03] text-[11px] text-muted-foreground font-medium">
                <Sparkles className="w-3 h-3" /> Early Adopter
              </span>
            </div>
          </div>
        </div>
      </motion.div>

      {/* ─── Stats Grid ─── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-5"
        >
          <div className="flex items-center gap-2 mb-2">
            <ListTodo className="w-4 h-4 text-violet-400" />
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Total Tasks</p>
          </div>
          <p className="text-2xl font-bold">{totalTasks}</p>
          <p className="text-[11px] text-muted-foreground mt-1">{completedTasks} completed · {failedTasks} failed</p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-5"
        >
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="w-4 h-4 text-emerald-400" />
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Success Rate</p>
          </div>
          <p className="text-2xl font-bold text-emerald-400">{successRate}%</p>
          <p className="text-[11px] text-muted-foreground mt-1">Across all tasks</p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-5"
        >
          <div className="flex items-center gap-2 mb-2">
            <Clock className="w-4 h-4 text-cyan-400" />
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Avg Duration</p>
          </div>
          <p className="text-2xl font-bold">{avgDuration}s</p>
          <p className="text-[11px] text-muted-foreground mt-1">Per completed task</p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
          className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-5"
        >
          <div className="flex items-center gap-2 mb-2">
            <CreditCard className="w-4 h-4 text-amber-400" />
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Credits</p>
          </div>
          <p className="text-2xl font-bold">${Number(totalCredits).toFixed(2)}</p>
          <p className="text-[11px] text-muted-foreground mt-1">${Number(totalFees).toFixed(4)} used</p>
        </motion.div>
      </div>

      {/* ─── Activity + Details ─── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Activity Heatmap */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-5"
        >
          <h3 className="text-sm font-semibold mb-4 flex items-center gap-2">
            <Activity className="w-4 h-4 text-violet-400" />
            Activity (Last 30 Days)
          </h3>
          <div className="grid grid-cols-10 gap-1">
            {activityByDay.map((day, i) => {
              const intensity = day.count === 0 ? 0 : day.count <= 2 ? 1 : day.count <= 5 ? 2 : 3;
              const colors = [
                "bg-white/[0.03]",
                "bg-violet-500/20",
                "bg-violet-500/40",
                "bg-violet-500/70",
              ];
              return (
                <div
                  key={i}
                  className={cn(
                    "aspect-square rounded-sm transition-colors",
                    colors[intensity],
                  )}
                  title={`${day.date}: ${day.count} tasks`}
                />
              );
            })}
          </div>
          <div className="flex items-center gap-2 mt-3 text-[10px] text-muted-foreground">
            <span>Less</span>
            <div className="flex gap-0.5">
              <div className="w-3 h-3 rounded-sm bg-white/[0.03]" />
              <div className="w-3 h-3 rounded-sm bg-violet-500/20" />
              <div className="w-3 h-3 rounded-sm bg-violet-500/40" />
              <div className="w-3 h-3 rounded-sm bg-violet-500/70" />
            </div>
            <span>More</span>
          </div>
        </motion.div>

        {/* Account Details */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35 }}
          className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-5"
        >
          <h3 className="text-sm font-semibold mb-4 flex items-center gap-2">
            <FileText className="w-4 h-4 text-cyan-400" />
            Account Details
          </h3>
          <div className="space-y-3">
            {[
              { label: "User ID", value: user?.id || "—" },
              { label: "Email", value: user?.email || "—" },
              { label: "Name", value: user?.name || "—" },
              { label: "Provider", value: user?.provider || "local" },
              { label: "Agents Deployed", value: agents.length.toString() },
              { label: "Total Tasks", value: totalTasks.toString() },
            ].map((item) => (
              <div key={item.label} className="flex items-center justify-between py-2 border-b border-white/[0.04] last:border-0">
                <span className="text-xs text-muted-foreground">{item.label}</span>
                <span className="text-xs font-medium font-mono">{item.value}</span>
              </div>
            ))}
          </div>
        </motion.div>
      </div>

      {/* ─── Recent Activity ─── */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-5"
      >
        <h3 className="text-sm font-semibold mb-4 flex items-center gap-2">
          <BarChart3 className="w-4 h-4 text-amber-400" />
          Task Breakdown
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {[
            { label: "Completed", count: completedTasks, color: "bg-emerald-500", textColor: "text-emerald-400" },
            { label: "Failed", count: failedTasks, color: "bg-red-500", textColor: "text-red-400" },
            { label: "Running", count: tasks.filter(t => t.status === "running").length, color: "bg-cyan-500", textColor: "text-cyan-400" },
            { label: "Queued", count: tasks.filter(t => t.status === "queued").length, color: "bg-amber-500", textColor: "text-amber-400" },
            { label: "Pending", count: tasks.filter(t => t.status === "pending").length, color: "bg-zinc-500", textColor: "text-zinc-400" },
          ].map((item) => (
            <div key={item.label} className="rounded-lg border border-white/[0.04] bg-white/[0.01] p-3 text-center">
              <div className={cn("w-2 h-2 rounded-full mx-auto mb-2", item.color)} />
              <p className={cn("text-lg font-bold", item.textColor)}>{item.count}</p>
              <p className="text-[10px] text-muted-foreground">{item.label}</p>
            </div>
          ))}
        </div>
      </motion.div>
    </div>
  );
}
