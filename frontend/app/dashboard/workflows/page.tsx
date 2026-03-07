"use client";

import { motion } from "framer-motion";
import { WorkflowVisualizer } from "@/components/workflow-visualizer/workflow-visualizer";
import { mockWorkflows } from "@/lib/mock-data";
import { cn, formatDuration } from "@/lib/utils";
import { CheckCircle, Activity, XCircle, Clock, ArrowUpRight } from "lucide-react";

/**
 * Workflows page — interactive graph visualizer alongside recent workflow list.
 */
export default function WorkflowsPage() {
  return (
    <div className="space-y-6 max-w-[1400px]">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Workflows</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Visualize and monitor agent orchestration graphs
        </p>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        {/* Visualizer */}
        <div className="xl:col-span-2">
          <WorkflowVisualizer animated />
        </div>

        {/* Workflow List */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="rounded-xl border border-white/[0.06] bg-white/[0.02] overflow-hidden"
        >
          <div className="px-5 py-4 border-b border-white/[0.04]">
            <h3 className="text-sm font-semibold">All Workflows</h3>
            <p className="text-xs text-muted-foreground mt-0.5">{mockWorkflows.length} workflows</p>
          </div>
          <div className="divide-y divide-white/[0.03] overflow-y-auto max-h-[600px]">
            {mockWorkflows.map((wf) => (
              <div
                key={wf.id}
                className="px-5 py-4 hover:bg-white/[0.02] transition-colors cursor-pointer"
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <div className={cn(
                      "w-6 h-6 rounded-md flex items-center justify-center",
                      wf.status === "completed" && "bg-emerald-500/10",
                      wf.status === "running" && "bg-blue-500/10",
                      wf.status === "failed" && "bg-red-500/10",
                      wf.status === "pending" && "bg-zinc-500/10",
                    )}>
                      {wf.status === "completed" && <CheckCircle className="w-3 h-3 text-emerald-400" />}
                      {wf.status === "running" && <Activity className="w-3 h-3 text-blue-400 animate-pulse" />}
                      {wf.status === "failed" && <XCircle className="w-3 h-3 text-red-400" />}
                      {wf.status === "pending" && <Clock className="w-3 h-3 text-zinc-400" />}
                    </div>
                    <span className="text-[10px] font-mono text-muted-foreground">{wf.id}</span>
                  </div>
                  {wf.duration && (
                    <span className="text-[10px] text-muted-foreground">{formatDuration(wf.duration)}</span>
                  )}
                </div>
                <p className="text-sm text-foreground line-clamp-2 mb-2">{wf.taskInput}</p>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] capitalize px-1.5 py-0.5 rounded bg-white/[0.04] text-muted-foreground">
                    {wf.intent}
                  </span>
                  {wf.savings && wf.savings > 0 && (
                    <div className="flex items-center gap-0.5 text-emerald-400">
                      <ArrowUpRight className="w-2.5 h-2.5" />
                      <span className="text-[10px] font-medium">${wf.savings.toLocaleString()}</span>
                    </div>
                  )}
                </div>
                {/* Node progress indicators */}
                <div className="flex items-center gap-1 mt-3">
                  {wf.nodes.map((node) => (
                    <div
                      key={node.id}
                      className={cn(
                        "h-1 flex-1 rounded-full transition-all",
                        node.status === "completed" && "bg-emerald-500/40",
                        node.status === "active" && "bg-blue-500/60 animate-pulse",
                        node.status === "error" && "bg-red-500/40",
                        node.status === "pending" && "bg-white/[0.06]",
                      )}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      </div>
    </div>
  );
}
