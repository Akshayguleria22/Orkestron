"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import type { SimulationRun, SimulationStep } from "@/lib/types";
import { createSimulationRun } from "@/lib/simulation-data";
import {
  Brain,
  Search,
  Handshake,
  Shield,
  Play,
  Loader2,
  CheckCircle2,
  Sparkles,
  ChevronDown,
  Trophy,
} from "lucide-react";

const agentIcons: Record<string, typeof Brain> = {
  Supervisor: Brain,
  "Retrieval Agent": Search,
  "Negotiation Agent": Handshake,
  "Compliance Agent": Shield,
  "Executor Agent": Play,
};

const agentGlows: Record<string, string> = {
  Supervisor: "from-violet-500/20 to-violet-500/0",
  "Retrieval Agent": "from-cyan-500/20 to-cyan-500/0",
  "Negotiation Agent": "from-amber-500/20 to-amber-500/0",
  "Compliance Agent": "from-emerald-500/20 to-emerald-500/0",
  "Executor Agent": "from-orange-500/20 to-orange-500/0",
};

const agentBorders: Record<string, string> = {
  Supervisor: "border-violet-500/40",
  "Retrieval Agent": "border-cyan-500/40",
  "Negotiation Agent": "border-amber-500/40",
  "Compliance Agent": "border-emerald-500/40",
  "Executor Agent": "border-orange-500/40",
};

const agentText: Record<string, string> = {
  Supervisor: "text-violet-400",
  "Retrieval Agent": "text-cyan-400",
  "Negotiation Agent": "text-amber-400",
  "Compliance Agent": "text-emerald-400",
  "Executor Agent": "text-orange-400",
};

interface SimulationEngineProps {
  onComplete?: (run: SimulationRun) => void;
  className?: string;
  initialTask?: string;
}

export function SimulationEngine({ onComplete, className, initialTask }: SimulationEngineProps) {
  const [taskInput, setTaskInput] = useState(initialTask || "");
  const [run, setRun] = useState<SimulationRun | null>(null);
  const [activeStep, setActiveStep] = useState(-1);
  const [expandedStep, setExpandedStep] = useState<number | null>(null);
  const [thinkingText, setThinkingText] = useState("");

  const startSimulation = useCallback(() => {
    if (!taskInput.trim()) return;
    const newRun = createSimulationRun(taskInput);
    newRun.status = "running";
    setRun(newRun);
    setActiveStep(0);
    setExpandedStep(null);
    setThinkingText("");
  }, [taskInput]);

  // Step progression
  useEffect(() => {
    if (!run || run.status !== "running" || activeStep < 0) return;

    const step = run.steps[activeStep];
    if (!step) return;

    // Mark step active
    setRun((prev) => {
      if (!prev) return prev;
      const steps = prev.steps.map((s, i) => ({
        ...s,
        status: i < activeStep ? "completed" as const : i === activeStep ? "active" as const : "pending" as const,
      }));
      return { ...prev, steps };
    });

    // Type out thinking text
    let charIdx = 0;
    const thinkingStr = step.thinking || "";
    setThinkingText("");
    const typeInterval = setInterval(() => {
      if (charIdx < thinkingStr.length) {
        setThinkingText(thinkingStr.slice(0, charIdx + 1));
        charIdx++;
      } else {
        clearInterval(typeInterval);
      }
    }, 30);

    // Auto-expand current step
    setExpandedStep(activeStep);

    // Move to next step
    const timeout = setTimeout(() => {
      clearInterval(typeInterval);
      setThinkingText(thinkingStr);

      if (activeStep < run.steps.length - 1) {
        setActiveStep((prev) => prev + 1);
      } else {
        // Complete the simulation
        setRun((prev) => {
          if (!prev) return prev;
          const steps = prev.steps.map((s) => ({ ...s, status: "completed" as const }));
          const completed = { ...prev, steps, status: "completed" as const };
          onComplete?.(completed);
          return completed;
        });
      }
    }, step.duration || 2000);

    return () => {
      clearInterval(typeInterval);
      clearTimeout(timeout);
    };
  }, [activeStep, run?.status]);

  return (
    <div className={cn("space-y-6", className)}>
      {/* Task Input */}
      <div className="relative">
        <div className="flex gap-3">
          <div className="flex-1 relative">
            <input
              type="text"
              value={taskInput}
              onChange={(e) => setTaskInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && startSimulation()}
              placeholder="Enter a task — e.g. Buy best 16GB RAM under ₹5,000"
              disabled={run?.status === "running"}
              className="w-full pl-4 pr-4 py-3 rounded-xl border border-white/[0.08] bg-white/[0.03] text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-indigo-500/40 focus:ring-1 focus:ring-indigo-500/20 transition-all disabled:opacity-50"
            />
          </div>
          <button
            onClick={startSimulation}
            disabled={!taskInput.trim() || run?.status === "running"}
            className="px-5 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-medium transition-all flex items-center gap-2 shadow-lg shadow-indigo-600/20"
          >
            {run?.status === "running" ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Sparkles className="w-4 h-4" />
            )}
            {run?.status === "running" ? "Processing…" : "Simulate"}
          </button>
        </div>
      </div>

      {/* Simulation Pipeline */}
      {run && (
        <div className="space-y-0">
          {run.steps.map((step, idx) => {
            const Icon = agentIcons[step.agent] || Brain;
            const isActive = step.status === "active";
            const isCompleted = step.status === "completed";
            const isPending = step.status === "pending";
            const isExpanded = expandedStep === idx;

            return (
              <div key={idx} className="relative">
                {/* Connector line */}
                {idx > 0 && (
                  <div className="flex justify-center">
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{
                        height: 32,
                        opacity: isCompleted || isActive ? 1 : 0.2,
                      }}
                      transition={{ duration: 0.3 }}
                      className={cn(
                        "w-[2px]",
                        isCompleted
                          ? "bg-gradient-to-b from-emerald-500/60 to-emerald-500/20"
                          : isActive
                            ? "bg-gradient-to-b from-indigo-500/60 to-indigo-500/20"
                            : "bg-white/[0.06]",
                      )}
                    />
                  </div>
                )}

                <motion.div
                  initial={{ opacity: 0, y: 20, scale: 0.95 }}
                  animate={{
                    opacity: isPending ? 0.4 : 1,
                    y: 0,
                    scale: 1,
                  }}
                  transition={{ delay: idx * 0.08, duration: 0.4 }}
                >
                  {/* Agent Card */}
                  <div
                    onClick={() =>
                      !isPending && setExpandedStep(isExpanded ? null : idx)
                    }
                    className={cn(
                      "relative rounded-xl border p-4 cursor-pointer transition-all duration-500 overflow-hidden group",
                      isActive &&
                        cn(agentBorders[step.agent], "bg-white/[0.03]"),
                      isCompleted && "border-white/[0.08] bg-white/[0.02]",
                      isPending && "border-white/[0.04] bg-white/[0.01]",
                    )}
                  >
                    {/* Active glow */}
                    {isActive && (
                      <motion.div
                        className={cn(
                          "absolute inset-0 bg-gradient-radial opacity-50",
                          agentGlows[step.agent],
                        )}
                        animate={{ opacity: [0.3, 0.6, 0.3] }}
                        transition={{ duration: 2, repeat: Infinity }}
                      />
                    )}

                    {/* Header row */}
                    <div className="relative flex items-center gap-3">
                      <div
                        className={cn(
                          "w-9 h-9 rounded-lg flex items-center justify-center border transition-all",
                          isActive &&
                            cn("border-indigo-500/30 bg-indigo-500/10"),
                          isCompleted &&
                            "border-emerald-500/30 bg-emerald-500/10",
                          isPending && "border-white/[0.06] bg-white/[0.02]",
                        )}
                      >
                        {isActive ? (
                          <motion.div
                            animate={{ rotate: 360 }}
                            transition={{
                              duration: 2,
                              repeat: Infinity,
                              ease: "linear",
                            }}
                          >
                            <Loader2
                              className={cn(
                                "w-4 h-4",
                                agentText[step.agent] || "text-indigo-400",
                              )}
                            />
                          </motion.div>
                        ) : isCompleted ? (
                          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                        ) : (
                          <Icon className="w-4 h-4 text-zinc-500" />
                        )}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span
                            className={cn(
                              "text-sm font-semibold",
                              isActive
                                ? agentText[step.agent]
                                : isCompleted
                                  ? "text-foreground"
                                  : "text-zinc-500",
                            )}
                          >
                            {step.agent}
                          </span>
                          {isActive && (
                            <motion.span
                              initial={{ opacity: 0 }}
                              animate={{ opacity: 1 }}
                              className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/20"
                            >
                              processing
                            </motion.span>
                          )}
                          {isCompleted && (
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                              done
                            </span>
                          )}
                        </div>
                        {/* Thinking text */}
                        {isActive && thinkingText && (
                          <motion.p
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            className="text-xs text-muted-foreground mt-1 font-mono"
                          >
                            {thinkingText}
                            <motion.span
                              animate={{ opacity: [1, 0] }}
                              transition={{ duration: 0.5, repeat: Infinity }}
                              className="text-indigo-400"
                            >
                              █
                            </motion.span>
                          </motion.p>
                        )}
                      </div>

                      {(isCompleted || isActive) &&
                        step.intermediateResults && (
                          <ChevronDown
                            className={cn(
                              "w-4 h-4 text-muted-foreground transition-transform",
                              isExpanded && "rotate-180",
                            )}
                          />
                        )}
                    </div>

                    {/* Expanded Results */}
                    <AnimatePresence>
                      {isExpanded &&
                        step.intermediateResults &&
                        (isCompleted || isActive) && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: "auto", opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.3 }}
                            className="overflow-hidden"
                          >
                            <div className="mt-4 pt-3 border-t border-white/[0.04] space-y-2">
                              {step.intermediateResults.map((result, ri) => (
                                <motion.div
                                  key={ri}
                                  initial={{ opacity: 0, x: -10 }}
                                  animate={{ opacity: 1, x: 0 }}
                                  transition={{ delay: ri * 0.1 }}
                                  className="flex items-center justify-between text-xs"
                                >
                                  <span className="text-muted-foreground">
                                    {result.label}
                                  </span>
                                  <div className="flex items-center gap-2">
                                    <span className="font-mono text-foreground">
                                      {result.value}
                                    </span>
                                    {result.score !== undefined && (
                                      <div className="w-16 h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
                                        <motion.div
                                          initial={{ width: 0 }}
                                          animate={{
                                            width: `${result.score * 100}%`,
                                          }}
                                          transition={{
                                            duration: 0.8,
                                            delay: ri * 0.1,
                                          }}
                                          className={cn(
                                            "h-full rounded-full",
                                            result.score > 0.85
                                              ? "bg-emerald-500"
                                              : result.score > 0.75
                                                ? "bg-indigo-500"
                                                : "bg-amber-500",
                                          )}
                                        />
                                      </div>
                                    )}
                                  </div>
                                </motion.div>
                              ))}
                            </div>

                            {/* Reasoning Trace */}
                            {step.reasoning && (
                              <div className="mt-4 pt-3 border-t border-white/[0.04]">
                                <p className="text-[10px] uppercase tracking-widest text-muted-foreground mb-2 font-medium">
                                  Reasoning Trace
                                </p>
                                <div className="grid gap-2">
                                  {step.reasoning.map((r, ri) => (
                                    <motion.div
                                      key={ri}
                                      initial={{ opacity: 0, y: 10 }}
                                      animate={{ opacity: 1, y: 0 }}
                                      transition={{ delay: ri * 0.15 + 0.3 }}
                                      className="rounded-lg border border-white/[0.04] bg-white/[0.01] p-3"
                                    >
                                      <div className="flex items-center justify-between mb-2">
                                        <span className="text-xs font-medium text-foreground">
                                          {r.vendor}
                                        </span>
                                        <span
                                          className={cn(
                                            "text-xs font-mono font-semibold",
                                            r.score > 0.85
                                              ? "text-emerald-400"
                                              : r.score > 0.75
                                                ? "text-indigo-400"
                                                : "text-amber-400",
                                          )}
                                        >
                                          {r.score.toFixed(2)}
                                        </span>
                                      </div>
                                      <div className="grid grid-cols-3 gap-2">
                                        {r.attributes.map((attr, ai) => (
                                          <div key={ai} className="text-[11px]">
                                            <span className="text-zinc-500">
                                              {attr.label}:{" "}
                                            </span>
                                            <span className="text-zinc-300">
                                              {attr.value}
                                            </span>
                                          </div>
                                        ))}
                                      </div>
                                      <div className="mt-2 w-full h-1 rounded-full bg-white/[0.06] overflow-hidden">
                                        <motion.div
                                          initial={{ width: 0 }}
                                          animate={{
                                            width: `${r.score * 100}%`,
                                          }}
                                          transition={{
                                            duration: 1,
                                            delay: ri * 0.2,
                                          }}
                                          className={cn(
                                            "h-full rounded-full",
                                            r.score > 0.85
                                              ? "bg-emerald-500"
                                              : r.score > 0.75
                                                ? "bg-indigo-500"
                                                : "bg-amber-500",
                                          )}
                                        />
                                      </div>
                                    </motion.div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </motion.div>
                        )}
                    </AnimatePresence>

                    {/* Pulse ring for active */}
                    {isActive && (
                      <motion.div
                        className={cn(
                          "absolute inset-0 rounded-xl border",
                          agentBorders[step.agent],
                        )}
                        animate={{
                          opacity: [0, 0.4, 0],
                          scale: [1, 1.02, 1.04],
                        }}
                        transition={{ duration: 2, repeat: Infinity }}
                      />
                    )}
                  </div>
                </motion.div>
              </div>
            );
          })}

          {/* Completion Card */}
          <AnimatePresence>
            {run.status === "completed" && (
              <motion.div
                initial={{ opacity: 0, y: 20, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ duration: 0.5, delay: 0.2 }}
                className="mt-4 rounded-xl border border-emerald-500/20 bg-emerald-500/[0.04] p-5"
              >
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-9 h-9 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
                    <Trophy className="w-4 h-4 text-emerald-400" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-emerald-400">
                      Workflow Complete
                    </p>
                    <p className="text-xs text-muted-foreground">
                      All agents executed successfully
                    </p>
                  </div>
                </div>
                {run.finalOutcome && (
                  <p className="text-sm text-foreground mb-2">
                    {run.finalOutcome}
                  </p>
                )}
                {run.totalSavings && (
                  <div className="flex items-center gap-2 text-xs">
                    <span className="text-muted-foreground">
                      Total Savings:
                    </span>
                    <span className="font-mono font-semibold text-emerald-400">
                      ₹{run.totalSavings.toLocaleString()}
                    </span>
                  </div>
                )}
                <button
                  onClick={() => {
                    setRun(null);
                    setActiveStep(-1);
                    setExpandedStep(null);
                  }}
                  className="mt-4 px-4 py-2 rounded-lg border border-white/[0.08] bg-white/[0.03] text-xs font-medium hover:bg-white/[0.06] transition-colors"
                >
                  Run Another Simulation
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
