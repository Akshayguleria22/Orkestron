"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { playgroundScenarios, createSimulationRun } from "@/lib/simulation-data";
import type { PlaygroundScenario, SimulationRun } from "@/lib/types";
import { SimulationEngine } from "@/components/simulation/simulation-engine";
import {
  FlaskConical,
  Rocket,
  Zap,
  Target,
  ChevronRight,
  ArrowLeft,
} from "lucide-react";

const difficultyColor: Record<string, string> = {
  easy: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
  medium: "text-amber-400 bg-amber-500/10 border-amber-500/20",
  hard: "text-rose-400 bg-rose-500/10 border-rose-500/20",
};

export function TrainingPlayground({ className }: { className?: string }) {
  const [mode, setMode] = useState<"select" | "run">("select");
  const [selectedScenario, setSelectedScenario] = useState<PlaygroundScenario | null>(null);
  const [customTask, setCustomTask] = useState("");
  const [completedIds, setCompletedIds] = useState<Set<string>>(new Set());

  const handleLaunch = (scenario: PlaygroundScenario) => {
    setSelectedScenario(scenario);
    setMode("run");
  };

  const handleCustomLaunch = () => {
    if (!customTask.trim()) return;
    const custom: PlaygroundScenario = {
      id: "custom",
      name: "Custom Scenario",
      description: "Your custom task",
      taskInput: customTask,
      expectedOutcome: "Depends on the task complexity",
      difficulty: "medium",
    };
    handleLaunch(custom);
  };

  const handleComplete = () => {
    if (selectedScenario && selectedScenario.id !== "custom") {
      setCompletedIds((prev) => new Set([...prev, selectedScenario.id]));
    }
  };

  const handleBack = () => {
    setMode("select");
    setSelectedScenario(null);
  };

  return (
    <div className={cn("space-y-6", className)}>
      <AnimatePresence mode="wait">
        {mode === "select" ? (
          <motion.div
            key="select"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, x: -20 }}
            className="space-y-6"
          >
            {/* Custom Task Input */}
            <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-5">
              <div className="flex items-center gap-2 mb-3">
                <FlaskConical className="w-4 h-4 text-violet-400" />
                <p className="text-sm font-semibold">Sandbox Mode</p>
              </div>
              <p className="text-xs text-muted-foreground mb-3">
                Enter any procurement task and watch the agent system solve it step by step.
              </p>
              <div className="flex gap-2">
                <input
                  value={customTask}
                  onChange={(e) => setCustomTask(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleCustomLaunch()}
                  placeholder="e.g., Find the cheapest cloud hosting with 99.9% SLA..."
                  className="flex-1 rounded-lg border border-white/[0.06] bg-white/[0.03] px-3 py-2 text-sm text-foreground placeholder:text-zinc-600 focus:outline-none focus:ring-1 focus:ring-violet-500/40"
                />
                <button
                  onClick={handleCustomLaunch}
                  disabled={!customTask.trim()}
                  className="px-4 py-2 rounded-lg bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium transition-colors disabled:opacity-40 disabled:pointer-events-none flex items-center gap-1.5"
                >
                  <Rocket className="w-3.5 h-3.5" />
                  Launch
                </button>
              </div>
            </div>

            {/* Scenarios */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="text-sm font-semibold flex items-center gap-2">
                    <Target className="w-4 h-4 text-cyan-400" />
                    Training Scenarios
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Pre-built scenarios to explore agent capabilities
                  </p>
                </div>
                <p className="text-xs text-muted-foreground">
                  {completedIds.size}/{playgroundScenarios.length} completed
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {playgroundScenarios.map((scenario, idx) => {
                  const isCompleted = completedIds.has(scenario.id);

                  return (
                    <motion.div
                      key={scenario.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: idx * 0.06 }}
                      onClick={() => handleLaunch(scenario)}
                      className={cn(
                        "rounded-xl border p-4 cursor-pointer group transition-all duration-300",
                        isCompleted
                          ? "border-emerald-500/20 bg-emerald-500/[0.03]"
                          : "border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.03] hover:border-white/[0.1]"
                      )}
                    >
                      <div className="flex items-start justify-between mb-2">
                        <span
                          className={cn(
                            "text-[9px] uppercase tracking-widest font-medium px-2 py-0.5 rounded-full border",
                            difficultyColor[scenario.difficulty]
                          )}
                        >
                          {scenario.difficulty}
                        </span>
                        {isCompleted && (
                          <span className="text-[9px] uppercase tracking-widest text-emerald-400">
                            ✓ Done
                          </span>
                        )}
                      </div>

                      <h3 className="text-sm font-semibold mt-2 mb-1 text-foreground">
                        {scenario.name}
                      </h3>
                      <p className="text-xs text-muted-foreground line-clamp-2 mb-3">
                        {scenario.description}
                      </p>

                      <div className="flex items-center justify-between">
                        <p className="text-[10px] text-zinc-500 truncate mr-2">
                          {scenario.expectedOutcome}
                        </p>
                        <ChevronRight className="w-3.5 h-3.5 text-zinc-600 group-hover:text-zinc-300 transition-colors shrink-0" />
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="run"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            className="space-y-4"
          >
            {/* Back Button + Scenario Info */}
            <div className="flex items-center gap-3">
              <button
                onClick={handleBack}
                className="p-2 rounded-lg border border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.05] transition-colors"
              >
                <ArrowLeft className="w-4 h-4 text-muted-foreground" />
              </button>
              <div>
                <p className="text-sm font-semibold">{selectedScenario?.name}</p>
                <p className="text-xs text-muted-foreground">{selectedScenario?.description}</p>
              </div>
            </div>

            {/* Simulation */}
            <SimulationEngine
              initialTask={selectedScenario?.taskInput}
              onComplete={handleComplete}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
