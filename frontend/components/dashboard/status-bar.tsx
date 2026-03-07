"use client";

import { cn } from "@/lib/utils";
import { mockHealth } from "@/lib/mock-data";
import { Activity, Cpu, HardDrive, Wifi, Clock } from "lucide-react";

/**
 * System status bar at the top of the dashboard.
 * Shows health indicators for uptime, latency, CPU, memory, and live connections.
 */
export function StatusBar() {
  const health = mockHealth;
  const uptimeDays = Math.floor(health.uptime / 86400);
  const uptimeHours = Math.floor((health.uptime % 86400) / 3600);

  return (
    <div className="h-10 border-b border-white/[0.04] bg-white/[0.01] px-6 flex items-center justify-between shrink-0">
      <div className="flex items-center gap-6">
        {/* Status indicator */}
        <div className="flex items-center gap-2">
          <div className={cn(
            "w-1.5 h-1.5 rounded-full",
            health.status === "healthy" ? "bg-emerald-500 shadow-[0_0_4px_rgba(34,197,94,0.5)]" :
            health.status === "degraded" ? "bg-amber-500 shadow-[0_0_4px_rgba(245,158,11,0.5)]" :
            "bg-red-500 shadow-[0_0_4px_rgba(239,68,68,0.5)]",
          )} />
          <span className="text-[11px] text-muted-foreground">
            System <span className={cn(
              "font-medium",
              health.status === "healthy" ? "text-emerald-400" :
              health.status === "degraded" ? "text-amber-400" : "text-red-400"
            )}>
              {health.status}
            </span>
          </span>
        </div>

        <div className="h-3 w-px bg-white/[0.06]" />

        <div className="flex items-center gap-1.5">
          <Clock className="w-3 h-3 text-zinc-600" />
          <span className="text-[11px] text-muted-foreground">{uptimeDays}d {uptimeHours}h</span>
        </div>

        <div className="flex items-center gap-1.5">
          <Activity className="w-3 h-3 text-zinc-600" />
          <span className="text-[11px] text-muted-foreground">{health.requestsPerMinute} req/m</span>
        </div>

        <div className="flex items-center gap-1.5">
          <Wifi className="w-3 h-3 text-zinc-600" />
          <span className="text-[11px] text-muted-foreground">{health.avgLatency}ms</span>
        </div>
      </div>

      <div className="flex items-center gap-4">
        <div className="flex items-center gap-1.5">
          <Cpu className="w-3 h-3 text-zinc-600" />
          <span className="text-[11px] text-muted-foreground">CPU {health.cpuUsage}%</span>
        </div>
        <div className="flex items-center gap-1.5">
          <HardDrive className="w-3 h-3 text-zinc-600" />
          <span className="text-[11px] text-muted-foreground">MEM {health.memoryUsage}%</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] font-mono text-zinc-600">v0.7.0</span>
        </div>
      </div>
    </div>
  );
}
