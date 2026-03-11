"use client";

import { useState, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { mockWorkflows } from "@/lib/mock-data";
import type { Workflow, WorkflowNode } from "@/lib/types";
import { api } from "@/lib/api-client";
import { useAuth } from "@/lib/auth-context";
import {
  Brain,
  Search,
  Handshake,
  Shield,
  Play,
  Pause,
  SkipForward,
  RotateCcw,
  ChevronRight,
  CheckCircle2,
  Loader2,
  AlertCircle,
  Clock,
} from "lucide-react";

const agentIcons: Record<string, typeof Brain> = {
  Supervisor: Brain,
  "Retrieval Agent": Search,
  "Negotiation Agent": Handshake,
  "Compliance Agent": Shield,
  "Executor Agent": Play,
};

const agentColors: Record<string, string> = {
  Supervisor: "text-violet-400",
  "Retrieval Agent": "text-cyan-400",
  "Negotiation Agent": "text-amber-400",
  "Compliance Agent": "text-emerald-400",
  "Executor Agent": "text-orange-400",
};

interface ReplayViewerProps {
  workflow?: Workflow;
  className?: string;
}

export function ReplayViewer({ workflow, className }: ReplayViewerProps) {
  const { getToken } = useAuth();
  const [allWorkflows, setAllWorkflows] = useState<Workflow[]>(mockWorkflows);
  const [selectedWorkflow, setSelectedWorkflow] = useState<Workflow>(
    workflow || mockWorkflows[0]
  );
  const [replayStep, setReplayStep] = useState(-1);
  const [isPlaying, setIsPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);

  useEffect(() => {
    const token = getToken();
    if (!token) return;
    api
      .listWorkflows(token)
      .then((d) => {
        if (d.workflows && d.workflows.length > 0) {
          const mapped: Workflow[] = d.workflows.map(
            (w: Record<string, unknown>) => ({
              id: (w.id as string) || "",
              taskInput: (w.name as string) || (w.task_input as string) || "",
              intent: (w.intent as string) || "general",
              status: ((w.status as string) ||
                "completed") as Workflow["status"],
              nodes: Array.isArray(w.nodes)
                ? (w.nodes as WorkflowNode[])
                : mockWorkflows[0].nodes,
              createdAt: (w.created_at as string) || new Date().toISOString(),
              completedAt: (w.completed_at as string) || undefined,
              duration: (w.duration as number) || undefined,
              userId: (w.user_id as string) || "",
              outcome: (w.outcome as string) || undefined,
              savings: (w.savings as number) || undefined,
            }),
          );
          const combined = [...mapped, ...mockWorkflows];
          setAllWorkflows(combined);
        }
      })
      .catch(() => {});
  }, [getToken]);

  const totalSteps = selectedWorkflow.nodes.length;

  const startReplay = useCallback(() => {
    setReplayStep(0);
    setIsPlaying(true);
  }, []);

  const resetReplay = useCallback(() => {
    setReplayStep(-1);
    setIsPlaying(false);
  }, []);

  // Auto-advance when playing
  useEffect(() => {
    if (!isPlaying || replayStep < 0) return;

    if (replayStep >= totalSteps) {
      setIsPlaying(false);
      return;
    }

    const timeout = setTimeout(() => {
      setReplayStep((s) => s + 1);
    }, 1500 / speed);

    return () => clearTimeout(timeout);
  }, [isPlaying, replayStep, totalSteps, speed]);

  const getNodeStatus = (idx: number): "completed" | "active" | "pending" | "error" => {
    if (replayStep < 0) return selectedWorkflow.nodes[idx].status;
    if (idx < replayStep) return "completed";
    if (idx === replayStep) return replayStep >= totalSteps ? "completed" : "active";
    return "pending";
  };

  return (
    <div className={cn("space-y-6", className)}>
      {/* Workflow Selector */}
      <div className="flex items-center gap-3 flex-wrap">
        {allWorkflows.map((wf) => (
          <button
            key={wf.id}
            onClick={() => {
              setSelectedWorkflow(wf);
              resetReplay();
            }}
            className={cn(
              "px-3 py-1.5 rounded-lg text-xs font-medium border transition-all",
              selectedWorkflow.id === wf.id
                ? "border-indigo-500/30 bg-indigo-500/10 text-indigo-400"
                : "border-white/[0.06] bg-white/[0.02] text-muted-foreground hover:bg-white/[0.04]",
            )}
          >
            {wf.id}
          </button>
        ))}
      </div>

      {/* Task info */}
      <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
        <p className="text-xs text-muted-foreground mb-1">Task Input</p>
        <p className="text-sm font-medium text-foreground">
          {selectedWorkflow.taskInput}
        </p>
        <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
          <span>
            Intent:{" "}
            <span className="text-foreground capitalize">
              {selectedWorkflow.intent}
            </span>
          </span>
          <span>
            Status:{" "}
            <span
              className={cn(
                selectedWorkflow.status === "completed"
                  ? "text-emerald-400"
                  : selectedWorkflow.status === "failed"
                    ? "text-red-400"
                    : selectedWorkflow.status === "running"
                      ? "text-indigo-400"
                      : "text-zinc-400",
              )}
            >
              {selectedWorkflow.status}
            </span>
          </span>
          {selectedWorkflow.savings && (
            <span>
              Savings:{" "}
              <span className="text-emerald-400">
                ₹{selectedWorkflow.savings.toLocaleString()}
              </span>
            </span>
          )}
        </div>
      </div>

      {/* Controls */}
      <div className="flex items-center gap-3">
        {replayStep < 0 ? (
          <button
            onClick={startReplay}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium transition-all shadow-lg shadow-indigo-600/20"
          >
            <Play className="w-3.5 h-3.5" />
            Start Replay
          </button>
        ) : (
          <>
            <button
              onClick={() => setIsPlaying(!isPlaying)}
              className="flex items-center gap-2 px-3 py-2 rounded-lg border border-white/[0.08] bg-white/[0.03] hover:bg-white/[0.06] text-xs font-medium transition-colors"
            >
              {isPlaying ? (
                <Pause className="w-3.5 h-3.5" />
              ) : (
                <Play className="w-3.5 h-3.5" />
              )}
              {isPlaying ? "Pause" : "Resume"}
            </button>
            <button
              onClick={() =>
                !isPlaying && setReplayStep((s) => Math.min(s + 1, totalSteps))
              }
              disabled={isPlaying || replayStep >= totalSteps}
              className="flex items-center gap-2 px-3 py-2 rounded-lg border border-white/[0.08] bg-white/[0.03] hover:bg-white/[0.06] text-xs font-medium transition-colors disabled:opacity-40"
            >
              <SkipForward className="w-3.5 h-3.5" />
              Step
            </button>
            <button
              onClick={resetReplay}
              className="flex items-center gap-2 px-3 py-2 rounded-lg border border-white/[0.08] bg-white/[0.03] hover:bg-white/[0.06] text-xs font-medium transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Reset
            </button>
          </>
        )}

        {/* Speed */}
        <div className="ml-auto flex items-center gap-1 text-[10px]">
          <span className="text-muted-foreground mr-1">Speed:</span>
          {[0.5, 1, 2, 3].map((s) => (
            <button
              key={s}
              onClick={() => setSpeed(s)}
              className={cn(
                "px-2 py-1 rounded border transition-colors",
                speed === s
                  ? "border-indigo-500/30 bg-indigo-500/10 text-indigo-400"
                  : "border-white/[0.06] text-zinc-500 hover:text-zinc-300",
              )}
            >
              {s}x
            </button>
          ))}
        </div>
      </div>

      {/* Progress bar */}
      <div className="h-1 rounded-full bg-white/[0.06] overflow-hidden">
        <motion.div
          className="h-full bg-indigo-500 rounded-full"
          animate={{
            width: `${Math.max(0, (Math.min(replayStep, totalSteps) / totalSteps) * 100)}%`,
          }}
          transition={{ duration: 0.3 }}
        />
      </div>

      {/* Timeline */}
      <div className="space-y-0">
        {selectedWorkflow.nodes.map((node, idx) => {
          const status = getNodeStatus(idx);
          const Icon = agentIcons[node.agent] || Brain;
          const isActive = status === "active";
          const isCompleted = status === "completed";

          return (
            <div key={node.id} className="relative">
              {idx > 0 && (
                <div className="flex pl-[18px]">
                  <div
                    className={cn(
                      "w-[2px] h-6 transition-colors duration-500",
                      isCompleted || isActive
                        ? "bg-gradient-to-b from-emerald-500/40 to-emerald-500/10"
                        : "bg-white/[0.06]",
                    )}
                  />
                </div>
              )}

              <motion.div
                animate={isActive ? { x: [0, 4, 0] } : {}}
                transition={{ duration: 0.5 }}
                className={cn(
                  "flex items-center gap-3 px-4 py-3 rounded-xl border transition-all duration-500",
                  isActive &&
                    "border-indigo-500/30 bg-indigo-500/[0.04] shadow-[0_0_20px_rgba(99,102,241,0.1)]",
                  isCompleted && "border-white/[0.06] bg-white/[0.01]",
                  status === "pending" &&
                    "border-white/[0.04] bg-transparent opacity-40",
                  status === "error" && "border-red-500/30 bg-red-500/[0.04]",
                )}
              >
                <div
                  className={cn(
                    "w-9 h-9 rounded-lg flex items-center justify-center border shrink-0",
                    isActive
                      ? "border-indigo-500/30 bg-indigo-500/10"
                      : isCompleted
                        ? "border-emerald-500/20 bg-emerald-500/5"
                        : "border-white/[0.06] bg-white/[0.02]",
                  )}
                >
                  {isActive ? (
                    <Loader2
                      className={cn(
                        "w-4 h-4 animate-spin",
                        agentColors[node.agent],
                      )}
                    />
                  ) : isCompleted ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  ) : status === "error" ? (
                    <AlertCircle className="w-4 h-4 text-red-400" />
                  ) : (
                    <Clock className="w-4 h-4 text-zinc-600" />
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <p
                    className={cn(
                      "text-sm font-medium",
                      isActive
                        ? agentColors[node.agent]
                        : isCompleted
                          ? "text-foreground"
                          : "text-zinc-500",
                    )}
                  >
                    {node.agent}
                  </p>
                  {node.output && isCompleted && (
                    <motion.p
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="text-xs text-muted-foreground mt-0.5"
                    >
                      {node.output}
                    </motion.p>
                  )}
                  {isActive && (
                    <motion.p
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="text-xs text-muted-foreground mt-0.5 font-mono"
                    >
                      Processing
                      <motion.span
                        animate={{ opacity: [1, 0] }}
                        transition={{ duration: 0.5, repeat: Infinity }}
                      >
                        …
                      </motion.span>
                    </motion.p>
                  )}
                </div>

                {isActive && (
                  <motion.div
                    className="absolute inset-0 rounded-xl border border-indigo-500/20"
                    animate={{ opacity: [0, 0.3, 0] }}
                    transition={{ duration: 2, repeat: Infinity }}
                  />
                )}
              </motion.div>
            </div>
          );
        })}
      </div>

      {/* Completion */}
      <AnimatePresence>
        {replayStep >= totalSteps && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-xl border border-emerald-500/20 bg-emerald-500/[0.04] p-4 text-center"
          >
            <CheckCircle2 className="w-6 h-6 text-emerald-400 mx-auto mb-2" />
            <p className="text-sm font-medium text-emerald-400">
              Replay Complete
            </p>
            {selectedWorkflow.outcome && (
              <p className="text-xs text-muted-foreground mt-1">
                {selectedWorkflow.outcome}
              </p>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
