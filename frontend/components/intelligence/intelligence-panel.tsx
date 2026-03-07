"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { mockHealth, mockAgents } from "@/lib/mock-data";
import {
  Activity,
  Bot,
  Workflow,
  Store,
  TrendingUp,
  Wifi,
  Cpu,
  MemoryStick,
  Clock,
  Zap,
} from "lucide-react";

interface StatItem {
  label: string;
  value: string;
  icon: typeof Activity;
  color: string;
  pulseColor: string;
}

export function IntelligencePanel({ className }: { className?: string }) {
  const [stats, setStats] = useState<StatItem[]>([]);
  const [tick, setTick] = useState(0);

  // Simulate live updates
  useEffect(() => {
    const update = () => {
      setStats([
        {
          label: "System Status",
          value: "Operational",
          icon: Wifi,
          color: "text-emerald-400",
          pulseColor: "bg-emerald-500",
        },
        {
          label: "Agents Online",
          value: `${mockAgents.filter((a) => a.status === "active").length + Math.floor(Math.random() * 3)}`,
          icon: Bot,
          color: "text-cyan-400",
          pulseColor: "bg-cyan-500",
        },
        {
          label: "Active Workflows",
          value: `${mockHealth.activeWorkflows + Math.floor(Math.random() * 5)}`,
          icon: Workflow,
          color: "text-blue-400",
          pulseColor: "bg-blue-500",
        },
        {
          label: "Marketplace Agents",
          value: `${21 + Math.floor(Math.random() * 4)}`,
          icon: Store,
          color: "text-violet-400",
          pulseColor: "bg-violet-500",
        },
        {
          label: "Today's Savings",
          value: `₹${(12400 + Math.floor(Math.random() * 2000)).toLocaleString()}`,
          icon: TrendingUp,
          color: "text-emerald-400",
          pulseColor: "bg-emerald-500",
        },
        {
          label: "Requests / min",
          value: `${mockHealth.requestsPerMinute + Math.floor(Math.random() * 50)}`,
          icon: Zap,
          color: "text-amber-400",
          pulseColor: "bg-amber-500",
        },
        {
          label: "Avg Latency",
          value: `${mockHealth.avgLatency + Math.floor(Math.random() * 20)}ms`,
          icon: Clock,
          color: "text-blue-400",
          pulseColor: "bg-blue-500",
        },
        {
          label: "CPU Usage",
          value: `${mockHealth.cpuUsage + Math.floor(Math.random() * 8)}%`,
          icon: Cpu,
          color: "text-orange-400",
          pulseColor: "bg-orange-500",
        },
        {
          label: "Memory",
          value: `${mockHealth.memoryUsage + Math.floor(Math.random() * 6)}%`,
          icon: MemoryStick,
          color: "text-pink-400",
          pulseColor: "bg-pink-500",
        },
      ]);
      setTick((t) => t + 1);
    };

    update();
    const interval = setInterval(update, 4000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className={cn("rounded-xl border border-white/[0.06] bg-white/[0.02] overflow-hidden", className)}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.04]">
        <div className="flex items-center gap-2">
          <Activity className="w-3.5 h-3.5 text-blue-400" />
          <span className="text-xs font-semibold">System Intelligence</span>
        </div>
        <div className="flex items-center gap-1.5">
          <motion.div
            animate={{ scale: [1, 1.3, 1] }}
            transition={{ duration: 2, repeat: Infinity }}
            className="w-1.5 h-1.5 rounded-full bg-emerald-500"
          />
          <span className="text-[10px] text-emerald-400/70">live</span>
        </div>
      </div>

      {/* Stats grid */}
      <div className="p-3 space-y-1">
        {stats.map((stat, idx) => (
          <motion.div
            key={stat.label}
            initial={false}
            animate={{ backgroundColor: tick > 0 ? ["rgba(255,255,255,0)", "rgba(255,255,255,0.02)", "rgba(255,255,255,0)"] : "rgba(255,255,255,0)" }}
            transition={{ duration: 1 }}
            className="flex items-center justify-between px-3 py-2 rounded-lg"
          >
            <div className="flex items-center gap-2.5">
              <stat.icon className={cn("w-3.5 h-3.5", stat.color)} />
              <span className="text-xs text-muted-foreground">{stat.label}</span>
            </div>
            <motion.span
              key={`${stat.label}-${stat.value}`}
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-xs font-mono font-medium text-foreground"
            >
              {stat.value}
            </motion.span>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
