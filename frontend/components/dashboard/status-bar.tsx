"use client";

import { cn } from "@/lib/utils";
import { Activity, Cpu, HardDrive, Wifi, Clock } from "lucide-react";

/**
 * System status bar at the top of the dashboard.
 */
export function StatusBar() {
  return (
    <div className="h-10 border-b border-white/[0.04] bg-white/[0.01] px-6 flex items-center justify-between shrink-0">
      <div className="flex items-center gap-6">
        <div className="flex items-center gap-2">
          <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_4px_rgba(34,197,94,0.5)]" />
          <span className="text-[11px] text-muted-foreground">
            System{" "}
            <span className="font-medium text-emerald-400">operational</span>
          </span>
        </div>
      </div>

      <div className="flex items-center gap-4">
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] font-mono text-zinc-600">v0.7.0</span>
        </div>
      </div>
    </div>
  );
}
