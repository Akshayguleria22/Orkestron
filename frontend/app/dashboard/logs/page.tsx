"use client";

import { LogStream } from "@/components/log-stream/log-stream";

export default function LogsPage() {
  return (
    <div className="space-y-6 max-w-[1400px]">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Live Logs</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Real-time system event stream
        </p>
      </div>

      <div className="rounded-xl border border-white/[0.06] bg-[#0d1117] overflow-hidden">
        <div className="flex items-center gap-2 px-4 py-2.5 border-b border-white/[0.04] bg-white/[0.02]">
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-full bg-red-500/60" />
            <div className="w-3 h-3 rounded-full bg-amber-500/60" />
            <div className="w-3 h-3 rounded-full bg-emerald-500/60" />
          </div>
          <span className="text-[11px] text-muted-foreground font-mono ml-2">orkestron-logs</span>
          <div className="ml-auto flex items-center gap-1.5">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-[10px] text-muted-foreground">streaming</span>
          </div>
        </div>
        <LogStream maxHeight="calc(100vh - 280px)" />
      </div>
    </div>
  );
}
