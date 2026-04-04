"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { api } from "@/lib/api-client";
import { useAuth } from "@/lib/auth-context";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  FlaskConical,
  Rocket,
  ChevronRight,
  Loader2,
  CheckCircle2,
  XCircle,
  Clock,
  Brain,
  Search,
  Sparkles,
  Zap,
  Globe,
  Code,
  BarChart3,
  Send,
  Play,
  Terminal,
  Activity,
  Eye,
  Wrench,
  Layers,
  History,
  ArrowRight,
  RefreshCw,
  Copy,
  ChevronDown,
  ChevronUp,
  Minus,
  Plus,
  GripVertical,
  Bug,
  Database,
  AlertCircle,
  Maximize2,
  X,
} from "lucide-react";

/* ─── Types ─── */
type ExecutionStep = {
  name: string;
  type: string;
  status: "pending" | "running" | "completed" | "error";
  duration?: number;
  output?: string;
  input?: string;
};

type TaskResult = {
  task_id: string;
  input: string;
  status: string;
  result_text?: string;
  result?: Record<string, unknown>;
  agent_path?: string[];
  total_duration?: number;
  task_type?: string;
  plan?: string[];
  step_errors?: string[];
  warnings?: string[];
  created_at?: string;
};

type LogEntry = {
  timestamp: string;
  agent: string;
  message: string;
  level: "info" | "warn" | "error" | "success";
};

type ToolTestResult = {
  tool: string;
  input: string;
  output: unknown;
  status: string;
};

type HistoryRun = {
  task_id: string;
  input: string;
  status: string;
  result_text?: string;
  total_duration?: number;
  created_at?: string;
  agent_path?: string[];
};

/* ─── Agent step config ─── */
const AGENT_STEPS = [
  { name: "Planner", type: "planner", icon: Brain, color: "text-violet-400", bg: "bg-violet-500/10 border-violet-500/20", glow: "shadow-violet-500/30", ring: "ring-violet-500/30" },
  { name: "Web Search", type: "web_search", icon: Search, color: "text-cyan-400", bg: "bg-cyan-500/10 border-cyan-500/20", glow: "shadow-cyan-500/30", ring: "ring-cyan-500/30" },
  { name: "Data Extraction", type: "data_extraction", icon: Globe, color: "text-blue-400", bg: "bg-blue-500/10 border-blue-500/20", glow: "shadow-blue-500/30", ring: "ring-blue-500/30" },
  { name: "Reasoning", type: "reasoning", icon: Sparkles, color: "text-amber-400", bg: "bg-amber-500/10 border-amber-500/20", glow: "shadow-amber-500/30", ring: "ring-amber-500/30" },
  { name: "Comparison", type: "comparison", icon: BarChart3, color: "text-pink-400", bg: "bg-pink-500/10 border-pink-500/20", glow: "shadow-pink-500/30", ring: "ring-pink-500/30" },
  { name: "Result Generator", type: "result_generator", icon: Zap, color: "text-emerald-400", bg: "bg-emerald-500/10 border-emerald-500/20", glow: "shadow-emerald-500/30", ring: "ring-emerald-500/30" },
];

const DEFAULT_EXECUTION_PLAN = [
  "planner",
  "web_search",
  "data_extraction",
  "reasoning",
  "comparison",
  "result_generator",
] as const;

const AVAILABLE_TOOLS = [
  { name: "web_search", label: "Web Search", description: "Search the web for information" },
  { name: "data_extraction", label: "Data Extraction", description: "Extract structured data from text" },
  { name: "reasoning", label: "Reasoning", description: "Analyze and reason about data" },
  { name: "comparison", label: "Comparison", description: "Compare multiple data points" },
  { name: "result_generator", label: "Result Generator", description: "Generate final structured results" },
];

/* ─── Skeleton ─── */
function PlaygroundSkeleton() {
  return (
    <div className="space-y-6 max-w-[1600px] animate-pulse">
      <div className="flex items-center justify-between">
        <div>
          <div className="h-7 w-52 bg-white/[0.05] rounded-lg mb-2" />
          <div className="h-4 w-72 bg-white/[0.03] rounded" />
        </div>
      </div>
      <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-5 h-16" />
      <div className="grid grid-cols-12 gap-4">
        <div className="col-span-3 rounded-xl border border-white/[0.06] bg-white/[0.02] h-[500px]" />
        <div className="col-span-6 rounded-xl border border-white/[0.06] bg-white/[0.02] h-[500px]" />
        <div className="col-span-3 rounded-xl border border-white/[0.06] bg-white/[0.02] h-[500px]" />
      </div>
    </div>
  );
}

export function AIAgentLab({ className }: { className?: string }) {
  const { getToken } = useAuth();

  // State
  const [taskInput, setTaskInput] = useState("");
  const [isRunning, setIsRunning] = useState(false);
  const [currentTaskId, setCurrentTaskId] = useState<string | null>(null);
  const [steps, setSteps] = useState<ExecutionStep[]>([]);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [result, setResult] = useState<TaskResult | null>(null);
  const [selectedStep, setSelectedStep] = useState<ExecutionStep | null>(null);
  const [executionPlan, setExecutionPlan] = useState<string[]>([...DEFAULT_EXECUTION_PLAN]);
  const [error, setError] = useState("");
  const [isResultModalOpen, setIsResultModalOpen] = useState(false);

  // Tool Testing
  const [toolName, setToolName] = useState("web_search");
  const [toolInput, setToolInput] = useState("");
  const [toolResult, setToolResult] = useState<ToolTestResult | null>(null);
  const [toolLoading, setToolLoading] = useState(false);

  // History / Comparison
  const [history, setHistory] = useState<HistoryRun[]>([]);
  const [compareRuns, setCompareRuns] = useState<HistoryRun[]>([]);

  // Active tab for bottom panel
  const [bottomTab, setBottomTab] = useState<"tools" | "history" | "memory">("tools");

  const logsContainerRef = useRef<HTMLDivElement>(null);
  const [logAutoScroll, setLogAutoScroll] = useState(true);

  // Auto-scroll logs panel without forcing page scroll.
  useEffect(() => {
    if (!logAutoScroll || !logsContainerRef.current) return;
    logsContainerRef.current.scrollTop = logsContainerRef.current.scrollHeight;
  }, [logs, logAutoScroll]);

  const handleLogsScroll = useCallback(() => {
    if (!logsContainerRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = logsContainerRef.current;
    setLogAutoScroll(scrollHeight - scrollTop - clientHeight < 24);
  }, []);

  const addLog = useCallback((agent: string, message: string, level: LogEntry["level"] = "info") => {
    setLogs((prev) => [...prev, { timestamp: new Date().toISOString(), agent, message, level }]);
  }, []);

  // ─── Load History ───
  const loadHistory = useCallback(async () => {
    const token = getToken();
    if (!token) return;

    try {
      const res = await api.getTaskHistory(token, 20);
      setHistory((res.runs || []) as unknown as HistoryRun[]);
    } catch {
      setHistory([]);
    }
  }, [getToken]);

  useEffect(() => {
    if (bottomTab === "history") {
      void loadHistory();
    }
  }, [bottomTab, loadHistory]);

  // Refresh run history after task completion.
  useEffect(() => {
    if (result) {
      void loadHistory();
    }
  }, [result, loadHistory]);

  // ─── Execute Task ───
  const executeTask = useCallback(async () => {
    const token = getToken();
    if (!token || !taskInput.trim()) return;

    const selectedPlan = executionPlan.filter(Boolean);
    if (selectedPlan.length === 0) {
      setError("Select at least one execution step before running the task.");
      return;
    }

    setIsRunning(true);
    setError("");
    setResult(null);
    setSelectedStep(null);
    setIsResultModalOpen(false);
    setLogs([]);
    setCompareRuns([]);
    setLogAutoScroll(true);

    // Initialize steps
    setSteps(
      selectedPlan.map((type) => {
        const config = AGENT_STEPS.find((s) => s.type === type);
        return { name: config?.name || type, type, status: "pending" as const };
      }),
    );

    addLog("System", "Task submitted: " + taskInput.trim(), "info");

    try {
      // Submit task
      addLog("System", "Creating task...", "info");
      const response = await api.submitRealTask(token, taskInput.trim(), selectedPlan);
      const taskId = response.task_id;
      setCurrentTaskId(taskId);
      addLog("System", `Task created: ${taskId}`, "success");

      // Poll for completion with step simulation
      let attempts = 0;
      const maxAttempts = 90;
      let currentStepIdx = 0;
      let didComplete = false;

      while (attempts < maxAttempts) {
        await new Promise((r) => setTimeout(r, 2000));
        attempts++;

        try {
          const data = await api.getRealTask(token, taskId) as unknown as TaskResult;

          // Simulate step progression based on elapsed time
          if (data.status === "running" || data.status === "queued") {
            if (currentStepIdx < selectedPlan.length) {
              const stepType = selectedPlan[currentStepIdx];
              const stepConfig = AGENT_STEPS.find((s) => s.type === stepType);

              setSteps((prev) =>
                prev.map((s, i) =>
                  i === currentStepIdx ? { ...s, status: "running" } :
                  i < currentStepIdx ? { ...s, status: "completed" } : s,
                ),
              );
              addLog(stepConfig?.name || stepType, `Processing...`, "info");

              if (attempts % 3 === 0) {
                currentStepIdx++;
              }
            }
          }

          if (data.status === "completed" || data.status === "failed") {
            // Mark all steps appropriately
            setSteps((prev) =>
              prev.map((s) => ({
                ...s,
                status: data.status === "completed" ? "completed" : "error",
              })),
            );

            if (data.status === "completed") {
              addLog("System", `Task completed in ${data.total_duration?.toFixed(1)}s`, "success");
              if (data.agent_path) {
                data.agent_path.forEach((agent) => {
                  addLog(agent, "Step completed", "success");
                });
              }
            } else {
              addLog("System", "Task failed", "error");
            }

            // Update execution plan from actual results
            if (data.plan) {
              let parsedPlan: string[] = [];
              if (Array.isArray(data.plan)) {
                parsedPlan = data.plan as string[];
              } else if (typeof data.plan === 'object' && Array.isArray((data.plan as any).steps)) {
                parsedPlan = (data.plan as any).steps.map((s: any) => s.agent || s);
              }
              if (parsedPlan.length > 0) {
                setExecutionPlan(parsedPlan);
              }
            }

            setResult(data);
            didComplete = true;
            break;
          }
        } catch {
          // Continue polling
        }
      }

      if (!didComplete) {
        addLog("System", "Task timed out", "warn");
      }
    } catch (err) {
      setError("Failed to submit task. Is the backend running?");
      addLog("System", "Task submission failed", "error");
    } finally {
      setIsRunning(false);
    }
  }, [getToken, taskInput, executionPlan, addLog]);

  // ─── Tool Testing ───
  const runToolTest = useCallback(async () => {
    const token = getToken();
    if (!token || !toolInput.trim()) return;

    setToolLoading(true);
    setToolResult(null);

    try {
      const res = await api.runTool(token, toolName, toolInput.trim());
      setToolResult(res);
    } catch (err) {
      setToolResult({ tool: toolName, input: toolInput, output: "Error: " + String(err), status: "error" });
    } finally {
      setToolLoading(false);
    }
  }, [getToken, toolName, toolInput]);

  // ─── Plan Editor Handlers ───
  const removePlanStep = (index: number) => {
    setExecutionPlan((prev) => prev.filter((_, i) => i !== index));
  };

  const addPlanStep = (step: string) => {
    setExecutionPlan((prev) => [...prev, step]);
  };

  const movePlanStep = (from: number, to: number) => {
    setExecutionPlan((prev) => {
      const arr = [...prev];
      const [item] = arr.splice(from, 1);
      arr.splice(to, 0, item);
      return arr;
    });
  };

  return (
    <div className={cn("space-y-4", className)}>
      {/* ─── Task Input Bar ─── */}
      <div className="rounded-xl border border-violet-500/20 bg-gradient-to-r from-violet-500/[0.05] to-cyan-500/[0.03] p-4">
        <div className="flex gap-3">
          <div className="flex-1 relative">
            <Terminal className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-violet-400" />
            <input
              type="text"
              value={taskInput}
              onChange={(e) => setTaskInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && !isRunning && executeTask()}
              placeholder='Submit a task... e.g. "Find cheapest RTX 4070 under ₹60,000"'
              className="w-full pl-9 pr-4 py-2.5 rounded-lg border border-white/[0.08] bg-white/[0.03] text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:border-violet-500/40 transition-colors font-mono"
              disabled={isRunning}
            />
          </div>
          <button
            onClick={executeTask}
            disabled={!taskInput.trim() || isRunning || executionPlan.length === 0}
            className="px-6 py-2.5 rounded-lg bg-gradient-to-r from-violet-600 to-violet-500 hover:from-violet-500 hover:to-violet-400 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-medium flex items-center gap-2 transition-all shadow-lg shadow-violet-600/20"
          >
            {isRunning ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
            Run Task
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-red-500/20 bg-red-500/[0.05] px-4 py-3 text-sm text-red-400 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          {error}
        </div>
      )}

      {/* ─── Main 3-Panel Layout ─── */}
      <div className="grid grid-cols-12 gap-4" style={{ minHeight: "500px" }}>
        {/* LEFT: Execution Plan Editor */}
        <div className="col-span-3 rounded-xl border border-white/[0.06] bg-white/[0.02] overflow-hidden flex flex-col">
          <div className="px-4 py-3 border-b border-white/[0.04] flex items-center gap-2">
            <Layers className="w-4 h-4 text-violet-400" />
            <h3 className="text-xs font-semibold uppercase tracking-wider">Execution Plan</h3>
          </div>
          <div className="flex-1 overflow-y-auto p-3 space-y-1.5 custom-scrollbar">
            {executionPlan.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground text-xs">
                <Layers className="w-6 h-6 mx-auto mb-2 text-zinc-700" />
                <p>No steps selected</p>
                <button
                  onClick={() => setExecutionPlan([...DEFAULT_EXECUTION_PLAN])}
                  className="mt-2 text-[10px] px-2 py-1 rounded border border-violet-500/25 text-violet-300 hover:bg-violet-500/10"
                >
                  Reset default steps
                </button>
              </div>
            ) : (
              executionPlan.map((step, i) => {
                const config = AGENT_STEPS.find((s) => s.type === step);
                const StepIcon = config?.icon || Code;
                const stepState = steps.find((s) => s.type === step);

                return (
                  <div
                    key={`${step}-${i}`}
                    className={cn(
                      "flex items-center gap-2 px-3 py-2 rounded-lg border transition-all text-xs group cursor-pointer",
                      stepState?.status === "running"
                        ? `${config?.bg} ${config?.glow} shadow-md animate-pulse`
                        : stepState?.status === "completed"
                        ? "border-emerald-500/20 bg-emerald-500/[0.05]"
                        : stepState?.status === "error"
                        ? "border-red-500/20 bg-red-500/[0.05]"
                        : "border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.04]",
                    )}
                    onClick={() => stepState && setSelectedStep(stepState)}
                  >
                    <span className="text-[10px] text-muted-foreground w-4">{i + 1}</span>
                    <StepIcon className={cn("w-3.5 h-3.5 shrink-0", config?.color || "text-zinc-400")} />
                    <span className="flex-1 truncate font-medium">{config?.name || step}</span>
                    {stepState?.status === "running" && <Loader2 className="w-3 h-3 animate-spin text-cyan-400" />}
                    {stepState?.status === "completed" && <CheckCircle2 className="w-3 h-3 text-emerald-400" />}
                    {stepState?.status === "error" && <XCircle className="w-3 h-3 text-red-400" />}
                    {!isRunning && (
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            if (i > 0) movePlanStep(i, i - 1);
                          }}
                          disabled={i === 0}
                          className="disabled:opacity-30"
                          title="Move up"
                        >
                          <ChevronUp className="w-3 h-3 text-zinc-500 hover:text-foreground" />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            if (i < executionPlan.length - 1) movePlanStep(i, i + 1);
                          }}
                          disabled={i === executionPlan.length - 1}
                          className="disabled:opacity-30"
                          title="Move down"
                        >
                          <ChevronDown className="w-3 h-3 text-zinc-500 hover:text-foreground" />
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); removePlanStep(i); }}
                          title="Remove step"
                        >
                          <Minus className="w-3 h-3 text-zinc-500 hover:text-red-400" />
                        </button>
                      </div>
                    )}
                  </div>
                );
              })
            )}

            {/* Add Step */}
            {!isRunning && (
              <div className="pt-2 border-t border-white/[0.04]">
                <p className="text-[10px] text-muted-foreground mb-1.5 px-1">Add step:</p>
                <div className="flex flex-wrap gap-1">
                  {AVAILABLE_TOOLS.filter((t) => !executionPlan.includes(t.name)).map((tool) => (
                    <button
                      key={tool.name}
                      onClick={() => addPlanStep(tool.name)}
                      className="text-[9px] px-2 py-1 rounded border border-white/[0.06] bg-white/[0.02] text-muted-foreground hover:text-foreground hover:border-violet-500/20 transition-colors"
                    >
                      <Plus className="w-2.5 h-2.5 inline mr-0.5" />
                      {tool.label}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* CENTER: Execution Graph */}
        <div className="col-span-6 rounded-xl border border-white/[0.06] bg-white/[0.02] overflow-hidden flex flex-col">
          <div className="px-4 py-3 border-b border-white/[0.04] flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Activity className="w-4 h-4 text-cyan-400" />
              <h3 className="text-xs font-semibold uppercase tracking-wider">Workflow Execution</h3>
            </div>
            {currentTaskId && (
              <span className="text-[10px] font-mono text-muted-foreground">{currentTaskId}</span>
            )}
          </div>

          <div className="flex-1 p-6 flex flex-col items-center justify-center">
            {executionPlan.length === 0 && !isRunning && !result ? (
              <div className="text-center text-muted-foreground">
                <FlaskConical className="w-10 h-10 mx-auto mb-3 text-zinc-700" />
                <p className="text-sm font-medium">AI Agent Lab</p>
                <p className="text-xs mt-1">Enter a task above and click Run to start</p>
              </div>
            ) : (
              <div className="w-full">
                {/* Execution Flow Graph */}
                <div className="flex items-center gap-2 flex-wrap justify-center">
                  {executionPlan.map((step, i) => {
                    const config = AGENT_STEPS.find((s) => s.type === step);
                    const StepIcon = config?.icon || Code;
                    const stepState = steps.find((s) => s.type === step);
                    const isActive = stepState?.status === "running";
                    const isDone = stepState?.status === "completed";
                    const isFailed = stepState?.status === "error";

                    return (
                      <div key={`graph-${step}-${i}`} className="flex items-center gap-2">
                        <motion.div
                          initial={{ scale: 0.8, opacity: 0 }}
                          animate={{ scale: 1, opacity: 1 }}
                          transition={{ delay: i * 0.05 }}
                          onClick={() => stepState && setSelectedStep(stepState)}
                          className={cn(
                            "relative flex flex-col items-center gap-1.5 px-4 py-3 rounded-xl border cursor-pointer transition-all duration-300",
                            isActive
                              ? `${config?.bg} ${config?.glow} ${config?.ring || ""} shadow-lg ring-1`
                              : isDone
                              ? "border-emerald-500/30 bg-emerald-500/[0.08]"
                              : isFailed
                              ? "border-red-500/30 bg-red-500/[0.08]"
                              : "border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.04]",
                          )}
                        >
                          {isActive && (
                            <div className="absolute inset-0 rounded-xl animate-pulse bg-gradient-to-r from-transparent via-white/[0.02] to-transparent" />
                          )}
                          <StepIcon className={cn("w-5 h-5 relative z-10", config?.color || "text-zinc-400")} />
                          <span className="text-[10px] font-medium relative z-10">{config?.name || step}</span>
                          {isActive && <Loader2 className="w-3 h-3 animate-spin text-cyan-400 absolute -top-1 -right-1" />}
                          {isDone && <CheckCircle2 className="w-3 h-3 text-emerald-400 absolute -top-1 -right-1" />}
                          {isFailed && <XCircle className="w-3 h-3 text-red-400 absolute -top-1 -right-1" />}
                        </motion.div>
                        {i < executionPlan.length - 1 && (
                          <motion.div
                            initial={{ scaleX: 0 }}
                            animate={{ scaleX: 1 }}
                            transition={{ delay: i * 0.05 + 0.1 }}
                            className="origin-left"
                          >
                            <ArrowRight className={cn(
                              "w-4 h-4",
                              isDone ? "text-emerald-500/50" : "text-zinc-700",
                            )} />
                          </motion.div>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Result Display */}
                {result && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mt-6"
                  >
                    {/* Result Metadata */}
                    <div className="grid grid-cols-3 gap-3 mb-4">
                      <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-3 text-center">
                        <Clock className="w-4 h-4 text-muted-foreground mx-auto mb-1" />
                        <p className="text-sm font-bold">{result.total_duration?.toFixed(1) || "—"}s</p>
                        <p className="text-[10px] text-muted-foreground">Duration</p>
                      </div>
                      <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-3 text-center">
                        <Brain className="w-4 h-4 text-muted-foreground mx-auto mb-1" />
                        <p className="text-sm font-bold">{result.agent_path?.length || 0}</p>
                        <p className="text-[10px] text-muted-foreground">Agents</p>
                      </div>
                      <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-3 text-center">
                        <span className={cn(
                          "inline-block w-2 h-2 rounded-full mb-1",
                          result.status === "completed" ? "bg-emerald-500" : "bg-red-500",
                        )} />
                        <p className="text-sm font-bold capitalize">{result.status}</p>
                        <p className="text-[10px] text-muted-foreground">Status</p>
                      </div>
                    </div>

                    {/* Result Text */}
                    <div className="rounded-xl border border-emerald-500/20 bg-[#0d1117] p-4 max-h-[340px] overflow-y-auto custom-scrollbar">
                      <div className="flex items-center justify-between mb-3">
                        <p className="text-xs uppercase tracking-wider text-emerald-300/80 font-semibold">Execution Output</p>
                        <button
                          onClick={() => setIsResultModalOpen(true)}
                          className="inline-flex items-center gap-1 rounded-md border border-emerald-500/25 bg-emerald-500/10 px-2 py-1 text-[10px] text-emerald-300 hover:bg-emerald-500/20 transition-colors"
                        >
                          <Maximize2 className="w-3 h-3" />
                          View Full
                        </button>
                      </div>
                      <div className="prose prose-invert prose-emerald prose-sm max-w-none text-foreground/90">
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>
                          {result.result_text || "No result text available."}
                        </ReactMarkdown>
                      </div>
                    </div>
                  </motion.div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* RIGHT: Logs / Agent Debug */}
        <div className="col-span-3 rounded-xl border border-white/[0.06] bg-white/[0.02] overflow-hidden flex flex-col">
          <div className="px-4 py-3 border-b border-white/[0.04] flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Eye className="w-4 h-4 text-amber-400" />
              <h3 className="text-xs font-semibold uppercase tracking-wider">
                {selectedStep ? "Agent Debug" : "Live Logs"}
              </h3>
            </div>
            {selectedStep && (
              <button
                onClick={() => setSelectedStep(null)}
                className="text-[10px] text-muted-foreground hover:text-foreground"
              >
                ← Back to logs
              </button>
            )}
          </div>

          <div
            ref={logsContainerRef}
            onScroll={handleLogsScroll}
            className="flex-1 overflow-y-auto p-3 custom-scrollbar"
          >
            {selectedStep ? (
              /* Agent Debug Panel */
              <div className="space-y-3">
                <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-3">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Agent</p>
                  <p className="text-sm font-semibold">{selectedStep.name}</p>
                </div>
                <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-3">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Type</p>
                  <p className="text-xs font-mono text-violet-400">{selectedStep.type}</p>
                </div>
                <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-3">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Status</p>
                  <p className={cn(
                    "text-xs font-medium capitalize",
                    selectedStep.status === "completed" ? "text-emerald-400" :
                    selectedStep.status === "running" ? "text-cyan-400" :
                    selectedStep.status === "error" ? "text-red-400" : "text-zinc-400",
                  )}>
                    {selectedStep.status}
                  </p>
                </div>
                {selectedStep.duration !== undefined && (
                  <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-3">
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Duration</p>
                    <p className="text-xs font-mono">{selectedStep.duration.toFixed(2)}s</p>
                  </div>
                )}
                {selectedStep.output && (
                  <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-3">
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Output</p>
                    <pre className="text-[10px] font-mono text-foreground/80 whitespace-pre-wrap max-h-[200px] overflow-y-auto">
                      {selectedStep.output}
                    </pre>
                  </div>
                )}
              </div>
            ) : (
              /* Live Logs */
              <div className="space-y-1">
                {logs.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground text-xs">
                    <Terminal className="w-6 h-6 mx-auto mb-2 text-zinc-700" />
                    <p>Logs will appear here when you run a task</p>
                  </div>
                ) : (
                  logs.map((log, i) => (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, x: 4 }}
                      animate={{ opacity: 1, x: 0 }}
                      className="flex items-start gap-2 px-2 py-1.5 rounded text-[11px] font-mono"
                    >
                      <span className={cn(
                        "shrink-0 font-semibold",
                        log.level === "error" ? "text-red-400" :
                        log.level === "warn" ? "text-amber-400" :
                        log.level === "success" ? "text-emerald-400" : "text-cyan-400",
                      )}>
                        [{log.agent}]
                      </span>
                      <span className="text-foreground/70">{log.message}</span>
                    </motion.div>
                  ))
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ─── Bottom Panel: Tool Testing + History + Memory ─── */}
      <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] overflow-hidden">
        <div className="flex items-center border-b border-white/[0.04]">
          {[
            { key: "tools" as const, label: "Tool Testing", icon: Wrench },
            { key: "history" as const, label: "Run History", icon: History },
            { key: "memory" as const, label: "Memory Viewer", icon: Database },
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setBottomTab(tab.key)}
              className={cn(
                "flex items-center gap-1.5 px-4 py-3 text-xs font-medium transition-colors border-b-2",
                bottomTab === tab.key
                  ? "border-violet-500 text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground",
              )}
            >
              <tab.icon className="w-3.5 h-3.5" />
              {tab.label}
            </button>
          ))}
        </div>

        <div className="p-4">
          {bottomTab === "tools" && (
            <div className="space-y-3">
              <div className="flex gap-3">
                <select
                  value={toolName}
                  onChange={(e) => setToolName(e.target.value)}
                  className="themed-select rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-sm text-foreground focus:outline-none focus:border-violet-500/40"
                >
                  {AVAILABLE_TOOLS.map((t) => (
                    <option key={t.name} value={t.name} className="bg-[#0b0f19] text-foreground">{t.label}</option>
                  ))}
                </select>
                <input
                  value={toolInput}
                  onChange={(e) => setToolInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && runToolTest()}
                  placeholder='e.g. "RTX 4070 India price"'
                  className="flex-1 rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-sm font-mono placeholder:text-muted-foreground/50 focus:outline-none focus:border-violet-500/40"
                />
                <button
                  onClick={runToolTest}
                  disabled={!toolInput.trim() || toolLoading}
                  className="px-4 py-2 rounded-lg bg-gradient-to-r from-cyan-600 to-cyan-500 hover:from-cyan-500 hover:to-cyan-400 disabled:opacity-40 text-white text-sm font-medium flex items-center gap-1.5 transition-all"
                >
                  {toolLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
                  Run
                </button>
              </div>

              {toolResult && (
                <div className={cn(
                  "rounded-lg border p-3",
                  toolResult.status === "success" ? "border-emerald-500/20 bg-emerald-500/[0.03]" : "border-red-500/20 bg-red-500/[0.03]",
                )}>
                  <div className="flex items-center gap-2 mb-2">
                    {toolResult.status === "success"
                      ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                      : <XCircle className="w-3.5 h-3.5 text-red-400" />
                    }
                    <span className="text-xs font-semibold">{toolResult.tool} — {toolResult.status}</span>
                  </div>
                  <pre className="text-[11px] font-mono text-foreground/80 whitespace-pre-wrap max-h-[200px] overflow-y-auto custom-scrollbar">
                    {typeof toolResult.output === "string" ? toolResult.output : JSON.stringify(toolResult.output, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          )}

          {bottomTab === "history" && (
            <div>
              {history.length === 0 ? (
                <div className="text-center py-6 text-muted-foreground text-xs">
                  <History className="w-6 h-6 mx-auto mb-2 text-zinc-700" />
                  <p>No task history yet</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {history.slice(0, 10).map((run) => (
                    <div
                      key={run.task_id}
                      className="flex items-center gap-3 px-3 py-2 rounded-lg border border-white/[0.04] bg-white/[0.01] hover:bg-white/[0.03] transition-colors"
                    >
                      <div className={cn(
                        "w-2 h-2 rounded-full shrink-0",
                        run.status === "completed" ? "bg-emerald-500" : run.status === "failed" ? "bg-red-500" : "bg-zinc-500",
                      )} />
                      <span className="text-xs flex-1 truncate">{run.input}</span>
                      <span className="text-[10px] text-muted-foreground">{run.total_duration?.toFixed(1)}s</span>
                      <span className={cn(
                        "text-[10px] font-medium capitalize",
                        run.status === "completed" ? "text-emerald-400" : "text-red-400",
                      )}>
                        {run.status}
                      </span>
                      <button
                        onClick={() => {
                          setCompareRuns((prev) =>
                            prev.some(r => r.task_id === run.task_id)
                              ? prev.filter(r => r.task_id !== run.task_id)
                              : [...prev, run],
                          );
                        }}
                        className={cn(
                          "text-[9px] px-2 py-0.5 rounded border transition-colors",
                          compareRuns.some(r => r.task_id === run.task_id)
                            ? "border-violet-500/30 bg-violet-500/10 text-violet-300"
                            : "border-white/[0.06] text-muted-foreground hover:text-foreground",
                        )}
                      >
                        Compare
                      </button>
                    </div>
                  ))}

                  {/* Comparison View */}
                  {compareRuns.length >= 2 && (
                    <div className="mt-3 rounded-lg border border-violet-500/20 bg-violet-500/[0.03] p-3">
                      <h4 className="text-xs font-semibold mb-2">Comparison: Run {compareRuns[0]?.task_id.slice(-6)} vs Run {compareRuns[1]?.task_id.slice(-6)}</h4>
                      <div className="grid grid-cols-2 gap-3">
                        {compareRuns.slice(0, 2).map((run) => (
                          <div key={run.task_id} className="rounded-lg border border-white/[0.04] bg-white/[0.01] p-2">
                            <p className="text-[10px] font-mono text-muted-foreground mb-1">{run.task_id.slice(-8)}</p>
                            <p className="text-xs mb-1 truncate">{run.input}</p>
                            <div className="flex gap-2 text-[10px]">
                              <span className={run.status === "completed" ? "text-emerald-400" : "text-red-400"}>{run.status}</span>
                              <span className="text-muted-foreground">{run.total_duration?.toFixed(1)}s</span>
                              <span className="text-muted-foreground">{run.agent_path?.length || 0} agents</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {bottomTab === "memory" && (
            <div className="text-center py-6">
              <Database className="w-8 h-8 mx-auto mb-3 text-zinc-700" />
              <p className="text-sm text-muted-foreground font-medium">Vector Memory</p>
              <p className="text-xs text-muted-foreground/60 mt-1">
                {result ? (
                  <span className="text-left block">
                    Retrieved context from task execution:
                    <br />
                    {result.agent_path?.map((a, i) => (
                      <span key={i} className="block mt-1 text-violet-400/80">• {a} — processed</span>
                    ))}
                  </span>
                ) : (
                  "Memory context will appear after task execution"
                )}
              </p>
            </div>
          )}
        </div>
      </div>

      <AnimatePresence>
        {isResultModalOpen && result && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[70] bg-black/70 backdrop-blur-sm p-4 md:p-8"
            onClick={() => setIsResultModalOpen(false)}
          >
            <motion.div
              initial={{ scale: 0.98, opacity: 0.8 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.98, opacity: 0.8 }}
              transition={{ duration: 0.16 }}
              onClick={(e) => e.stopPropagation()}
              className="mx-auto h-full max-h-[92vh] w-full max-w-5xl rounded-2xl border border-emerald-500/25 bg-[#0b0f19] shadow-2xl overflow-hidden flex flex-col"
            >
              <div className="flex items-center justify-between px-5 py-3 border-b border-white/[0.08]">
                <div>
                  <h4 className="text-sm font-semibold">Execution Output</h4>
                  <p className="text-[11px] text-muted-foreground mt-0.5">Task {result.task_id}</p>
                </div>
                <button
                  onClick={() => setIsResultModalOpen(false)}
                  className="w-8 h-8 rounded-lg border border-white/[0.08] bg-white/[0.02] hover:bg-white/[0.06] transition-colors flex items-center justify-center"
                  aria-label="Close full output"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto custom-scrollbar p-5">
                <div className="prose prose-invert prose-emerald max-w-none text-foreground/90">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {result.result_text || "No result text available."}
                  </ReactMarkdown>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
