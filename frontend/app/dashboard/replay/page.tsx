"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  History,
  Play,
  Pause,
  RotateCcw,
  ChevronRight,
  CheckCircle2,
  XCircle,
  Clock,
  Brain,
  Search,
  Sparkles,
  Zap,
  Loader2,
  SkipForward,
  Eye,
} from "lucide-react";
import { api } from "@/lib/api-client";
import { useAuth } from "@/lib/auth-context";
import { cn } from "@/lib/utils";

type ReplayTask = {
  task_id: string;
  input: string;
  status: string;
  task_type?: string;
  agent_path?: string[];
  total_duration?: number;
  created_at?: string;
  completed_at?: string;
  plan?: { steps: { step: number; agent: string; action: string }[] };
  result_text?: string;
};

type ReplayStep = {
  label: string;
  agent: string;
  status: "pending" | "running" | "completed" | "failed";
  action?: string;
  duration?: number;
};

const AGENT_COLORS: Record<string, string> = {
  planner: "text-violet-400 bg-violet-500/10 border-violet-500/30",
  web_search: "text-cyan-400 bg-cyan-500/10 border-cyan-500/30",
  reasoning: "text-amber-400 bg-amber-500/10 border-amber-500/30",
  data_extraction: "text-blue-400 bg-blue-500/10 border-blue-500/30",
  comparison: "text-orange-400 bg-orange-500/10 border-orange-500/30",
  result_generator: "text-emerald-400 bg-emerald-500/10 border-emerald-500/30",
};

const AGENT_ICONS: Record<string, typeof Brain> = {
  planner: Brain,
  web_search: Search,
  reasoning: Sparkles,
  data_extraction: Search,
  comparison: Sparkles,
  result_generator: Zap,
};

export default function ReplayPage() {
  const { getToken } = useAuth();
  const [tasks, setTasks] = useState<ReplayTask[]>([]);
  const [selectedTask, setSelectedTask] = useState<ReplayTask | null>(null);
  const [loading, setLoading] = useState(true);
  const [playing, setPlaying] = useState(false);
  const [currentStep, setCurrentStep] = useState(-1);
  const [speed, setSpeed] = useState(1);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchTasks = useCallback(async () => {
    const token = getToken();
    if (!token) { setLoading(false); return; }
    try {
      const data = await api.listRealTasks(token, undefined, 50);
      const rawTasks = (data.tasks || []) as Record<string, unknown>[];
      // Only show completed/failed tasks for replay
      const replayable = rawTasks
        .filter((t) => t.status === "completed" || t.status === "failed")
        .map((t) => ({
          task_id: t.task_id as string,
          input: ((t.input as string) || "").slice(0, 200),
          status: t.status as string,
          task_type: t.task_type as string,
          agent_path: (t.agent_path as string[]) || [],
          total_duration: t.total_duration as number,
          created_at: t.created_at as string,
          completed_at: t.completed_at as string,
        })) as ReplayTask[];
      setTasks(replayable);
    } catch {}
    setLoading(false);
  }, [getToken]);

  // Fetch full task data for replay
  const loadTaskForReplay = useCallback(async (taskId: string) => {
    const token = getToken();
    if (!token) return;
    try {
      const data = await api.getRealTask(token, taskId);
      const task = data as unknown as ReplayTask;
      setSelectedTask(task);
      setCurrentStep(-1);
      setPlaying(false);
    } catch {}
  }, [getToken]);

  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  // Build replay steps from task data
  const buildSteps = (task: ReplayTask | null): ReplayStep[] => {
    if (!task) return [];
    const agentPath = task.agent_path || [];
    const planSteps = task.plan?.steps || [];
    const duration = task.total_duration || 5;
    const stepDuration = agentPath.length > 0 ? duration / agentPath.length : 1;

    if (agentPath.length > 0) {
      return agentPath.map((agent, i) => {
        const planStep = planSteps.find((s) => s.agent === agent);
        return {
          label: agent.replace(/_/g, " "),
          agent,
          status: "pending" as const,
          action: planStep?.action || `Processing step ${i + 1}`,
          duration: stepDuration,
        };
      });
    }

    // Fallback: use standard pipeline
    const defaultPipeline = ["planner", "web_search", "data_extraction", "reasoning", "result_generator"];
    return defaultPipeline.map((agent, i) => ({
      label: agent.replace(/_/g, " "),
      agent,
      status: "pending" as const,
      action: `Step ${i + 1}`,
      duration: 1,
    }));
  };

  const steps = buildSteps(selectedTask);

  // Play/Pause logic
  useEffect(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);

    if (playing && selectedTask && currentStep < steps.length) {
      intervalRef.current = setInterval(() => {
        setCurrentStep((prev) => {
          if (prev >= steps.length - 1) {
            setPlaying(false);
            return prev;
          }
          return prev + 1;
        });
      }, (1200 / speed));
    }

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [playing, selectedTask, speed, steps.length, currentStep]);

  const handlePlay = () => {
    if (currentStep >= steps.length - 1) {
      setCurrentStep(-1);
      setTimeout(() => {
        setCurrentStep(0);
        setPlaying(true);
      }, 100);
    } else {
      setCurrentStep((prev) => (prev < 0 ? 0 : prev));
      setPlaying(true);
    }
  };

  const handleReset = () => {
    setPlaying(false);
    setCurrentStep(-1);
  };

  const getStepStatus = (index: number): "pending" | "running" | "completed" | "failed" => {
    if (index < currentStep) return "completed";
    if (index === currentStep) return playing ? "running" : "completed";
    return "pending";
  };

  const timeAgo = (dateStr?: string) => {
    if (!dateStr) return "";
    const diff = Date.now() - new Date(dateStr).getTime();
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    return `${Math.floor(diff / 86400000)}d ago`;
  };

  return (
    <div className="space-y-6 max-w-[1400px]">
      <div>
        <h1 className="text-xl font-semibold tracking-tight flex items-center gap-2">
          <History className="w-5 h-5 text-amber-400" />
          Task Replay
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Step through your completed task executions — see how each agent processed your request
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Task list */}
        <div className="lg:col-span-1 space-y-2">
          <h3 className="text-sm font-medium text-muted-foreground mb-2">Completed Tasks</h3>

          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="w-5 h-5 text-violet-400 animate-spin" />
            </div>
          ) : tasks.length === 0 ? (
            <div className="rounded-xl border border-white/[0.06] bg-white/[0.01] p-8 text-center">
              <History className="w-8 h-8 text-zinc-700 mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">No completed tasks to replay</p>
              <p className="text-xs text-muted-foreground/60 mt-1">Submit tasks first</p>
            </div>
          ) : (
            <div className="space-y-1.5 max-h-[600px] overflow-y-auto pr-1">
              {tasks.map((task) => (
                <button
                  key={task.task_id}
                  onClick={() => loadTaskForReplay(task.task_id)}
                  className={cn(
                    "w-full text-left rounded-lg border p-3 transition-all",
                    selectedTask?.task_id === task.task_id
                      ? "border-amber-500/30 bg-amber-500/[0.06]"
                      : "border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.04]",
                  )}
                >
                  <div className="flex items-start gap-2">
                    {task.status === "completed" ? (
                      <CheckCircle2 className="w-4 h-4 mt-0.5 text-emerald-400 shrink-0" />
                    ) : (
                      <XCircle className="w-4 h-4 mt-0.5 text-red-400 shrink-0" />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm truncate">{task.input}</p>
                      <div className="flex items-center gap-2 mt-1">
                        {task.task_type && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/[0.04] text-muted-foreground">{task.task_type}</span>
                        )}
                        {task.total_duration && (
                          <span className="text-[10px] text-muted-foreground">{task.total_duration.toFixed(1)}s</span>
                        )}
                        <span className="text-[10px] text-muted-foreground ml-auto">{timeAgo(task.created_at)}</span>
                      </div>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Replay Viewer */}
        <div className="lg:col-span-2">
          {!selectedTask ? (
            <div className="rounded-xl border border-white/[0.06] bg-white/[0.01] flex flex-col items-center justify-center py-20 text-center">
              <Play className="w-12 h-12 text-zinc-700 mb-4" />
              <h3 className="text-lg font-medium text-zinc-400">Select a Task to Replay</h3>
              <p className="text-sm text-muted-foreground mt-1 max-w-sm">
                Choose a completed task from the list to watch its execution step-by-step
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Task info */}
              <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-5">
                <h3 className="text-sm font-medium mb-1">{selectedTask.input}</h3>
                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                  {selectedTask.task_type && (
                    <span className="px-2 py-0.5 rounded bg-white/[0.04] border border-white/[0.06]">{selectedTask.task_type}</span>
                  )}
                  {selectedTask.total_duration && (
                    <span>Duration: {selectedTask.total_duration.toFixed(1)}s</span>
                  )}
                  <span className={cn("font-medium", selectedTask.status === "completed" ? "text-emerald-400" : "text-red-400")}>
                    {selectedTask.status}
                  </span>
                </div>
              </div>

              {/* Playback controls */}
              <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
                <div className="flex items-center gap-3 mb-4">
                  <button
                    onClick={playing ? () => setPlaying(false) : handlePlay}
                    className="p-2.5 rounded-lg bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 text-white transition-all shadow-lg shadow-amber-600/20"
                  >
                    {playing ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                  </button>
                  <button
                    onClick={handleReset}
                    className="p-2.5 rounded-lg border border-white/[0.08] bg-white/[0.03] hover:bg-white/[0.06] text-muted-foreground transition-colors"
                  >
                    <RotateCcw className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setCurrentStep((prev) => Math.min(prev + 1, steps.length - 1))}
                    className="p-2.5 rounded-lg border border-white/[0.08] bg-white/[0.03] hover:bg-white/[0.06] text-muted-foreground transition-colors"
                  >
                    <SkipForward className="w-4 h-4" />
                  </button>

                  {/* Speed control */}
                  <div className="flex items-center gap-2 ml-auto">
                    <span className="text-[10px] text-muted-foreground">Speed:</span>
                    {[0.5, 1, 2, 3].map((s) => (
                      <button
                        key={s}
                        onClick={() => setSpeed(s)}
                        className={cn(
                          "text-[10px] px-2 py-1 rounded border transition-colors",
                          speed === s
                            ? "border-amber-500/30 bg-amber-500/10 text-amber-300"
                            : "border-white/[0.06] bg-white/[0.02] text-muted-foreground",
                        )}
                      >
                        {s}x
                      </button>
                    ))}
                  </div>
                </div>

                {/* Progress bar */}
                <div className="h-2 w-full bg-white/[0.04] rounded-full overflow-hidden mb-2">
                  <div
                    className="h-full bg-gradient-to-r from-amber-500 to-emerald-500 transition-all duration-300"
                    style={{ width: `${steps.length > 0 ? ((currentStep + 1) / steps.length) * 100 : 0}%` }}
                  />
                </div>
                <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                  <span>Step {Math.max(0, currentStep + 1)} of {steps.length}</span>
                  <span>{playing ? "Playing..." : currentStep >= steps.length - 1 ? "Complete" : "Paused"}</span>
                </div>
              </div>

              {/* Step Timeline */}
              <div className="space-y-2">
                {steps.map((step, i) => {
                  const status = getStepStatus(i);
                  const StepIcon = AGENT_ICONS[step.agent] || Brain;
                  const colors = AGENT_COLORS[step.agent] || "text-zinc-400 bg-zinc-500/10 border-zinc-500/30";

                  return (
                    <motion.div
                      key={`${step.agent}-${i}`}
                      initial={{ opacity: 0, x: -8 }}
                      animate={{
                        opacity: status !== "pending" ? 1 : 0.4,
                        x: 0,
                        scale: status === "running" ? 1.02 : 1,
                      }}
                      transition={{ duration: 0.3 }}
                      className={cn(
                        "rounded-xl border p-4 transition-all",
                        status === "running"
                          ? "border-amber-500/30 bg-amber-500/[0.06] shadow-lg shadow-amber-500/5"
                          : status === "completed"
                          ? "border-emerald-500/20 bg-emerald-500/[0.03]"
                          : "border-white/[0.06] bg-white/[0.02]",
                      )}
                    >
                      <div className="flex items-center gap-3">
                        <div className="shrink-0">
                          {status === "completed" ? (
                            <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                          ) : status === "running" ? (
                            <Loader2 className="w-5 h-5 text-amber-400 animate-spin" />
                          ) : (
                            <Clock className="w-5 h-5 text-zinc-600" />
                          )}
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className={cn("inline-flex items-center gap-1 px-2 py-0.5 rounded border text-[11px] font-medium", colors)}>
                              <StepIcon className="w-3 h-3" />
                              {step.label}
                            </span>
                            {step.duration && status === "completed" && (
                              <span className="text-[10px] text-muted-foreground">{step.duration.toFixed(1)}s</span>
                            )}
                          </div>
                          {step.action && status !== "pending" && (
                            <p className="text-xs text-muted-foreground mt-1">{step.action}</p>
                          )}
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </div>

              {/* Result (show when replay complete) */}
              {currentStep >= steps.length - 1 && selectedTask.result_text && (
                <motion.div
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="rounded-xl border border-emerald-500/20 bg-emerald-500/[0.03] p-5"
                >
                  <h4 className="text-sm font-semibold text-emerald-400 mb-2 flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4" />
                    Task Result
                  </h4>
                  <p className="text-sm text-foreground/90 whitespace-pre-wrap leading-relaxed max-h-[300px] overflow-y-auto">
                    {selectedTask.result_text}
                  </p>
                </motion.div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
