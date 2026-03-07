"use client";

import { useState } from "react";
import { WorkflowVisualizer } from "@/components/workflow-visualizer/workflow-visualizer";
import { mockWorkflows } from "@/lib/mock-data";
import { cn, formatDuration } from "@/lib/utils";
import { CheckCircle, Activity, XCircle, Clock, ArrowUpRight, Brain, Search, Handshake, Play, Send } from "lucide-react";

const agentIcons: Record<string, typeof Brain> = {
  supervisor: Brain,
  retrieval: Search,
  negotiation: Handshake,
  compliance: Brain,
  executor: Play,
};

export default function WorkflowsPage() {
  const [selectedWf, setSelectedWf] = useState(mockWorkflows[0]);
  const [taskInput, setTaskInput] = useState("");

  return (
    <div className="space-y-6 max-w-[1400px]">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Workflow Execution</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Orchestration graph with live agent reasoning
          </p>
        </div>
      </div>

      {/* ─── Task Input Bar ─── */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <input
            type="text"
            placeholder="Enter a task... e.g. 'Buy best 16GB RAM under ₹5000'"
            value={taskInput}
            onChange={(e) => setTaskInput(e.target.value)}
            className="w-full px-4 py-3 rounded-xl border border-white/[0.08] bg-white/[0.03] text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-indigo-500/40 focus:ring-1 focus:ring-indigo-500/20 transition-all"
          />
        </div>
        <button className="px-5 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium transition-all flex items-center gap-2 shadow-lg shadow-indigo-600/20">
          <Send className="w-4 h-4" />
          Execute
        </button>
      </div>

      {/* ─── Main Layout: Graph + Side Panel ─── */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        {/* Workflow Graph Visualizer */}
        <div className="xl:col-span-2">
          <WorkflowVisualizer animated />
        </div>

        {/* Side Panel: Reasoning + Workflow Details */}
        <div className="space-y-4">
          {/* Active Node Reasoning */}
          <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] overflow-hidden">
            <div className="px-5 py-4 border-b border-white/[0.04] flex items-center gap-2">
              <Brain className="w-4 h-4 text-indigo-400" />
              <h3 className="text-sm font-semibold">Agent Reasoning</h3>
            </div>
            <div className="p-4 space-y-3 max-h-[300px] overflow-y-auto">
              {selectedWf.nodes.map((node) => {
                const IconComp = agentIcons[node.agent] || Brain;
                return (
                  <div key={node.id} className={cn(
                    "rounded-lg border p-3 transition-all",
                    node.status === "active" ? "border-indigo-500/30 bg-indigo-500/[0.04]" :
                    node.status === "completed" ? "border-emerald-500/20 bg-emerald-500/[0.02]" :
                    "border-white/[0.04] bg-white/[0.01]"
                  )}>
                    <div className="flex items-center gap-2 mb-1">
                      <IconComp className={cn(
                        "w-3.5 h-3.5",
                        node.status === "active" ? "text-indigo-400" :
                        node.status === "completed" ? "text-emerald-400" : "text-zinc-600"
                      )} />
                      <span className="text-xs font-medium capitalize">{node.agent}</span>
                      {node.status === "active" && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-indigo-500/10 text-indigo-400">Active</span>
                      )}
                    </div>
                    {node.output && (
                      <p className="text-[11px] text-muted-foreground pl-5 line-clamp-2">{node.output}</p>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Recent Workflows List */}
          <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] overflow-hidden">
            <div className="px-5 py-4 border-b border-white/[0.04]">
              <h3 className="text-sm font-semibold">All Workflows</h3>
              <p className="text-xs text-muted-foreground mt-0.5">{mockWorkflows.length} workflows</p>
            </div>
            <div className="divide-y divide-white/[0.03] overflow-y-auto max-h-[400px]">
              {mockWorkflows.map((wf) => (
                <div
                  key={wf.id}
                  onClick={() => setSelectedWf(wf)}
                  className={cn(
                    "px-5 py-4 hover:bg-white/[0.02] transition-colors cursor-pointer",
                    selectedWf.id === wf.id && "bg-indigo-500/[0.04] border-l-2 border-l-indigo-500"
                  )}
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <div className={cn(
                        "w-6 h-6 rounded-md flex items-center justify-center",
                        wf.status === "completed" && "bg-emerald-500/10",
                        wf.status === "running" && "bg-indigo-500/10",
                        wf.status === "failed" && "bg-red-500/10",
                        wf.status === "pending" && "bg-zinc-500/10",
                      )}>
                        {wf.status === "completed" && <CheckCircle className="w-3 h-3 text-emerald-400" />}
                        {wf.status === "running" && <Activity className="w-3 h-3 text-indigo-400 animate-pulse" />}
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
                          node.status === "active" && "bg-indigo-500/60 animate-pulse",
                          node.status === "error" && "bg-red-500/40",
                          node.status === "pending" && "bg-white/[0.06]",
                        )}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
