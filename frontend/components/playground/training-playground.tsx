"use client";

import { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { api } from "@/lib/api-client";
import { useAuth } from "@/lib/auth-context";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  FlaskConical,
  Rocket,
  Target,
  ChevronRight,
  ArrowLeft,
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
  FileText,
  Lightbulb,
  Compass,
  ShoppingCart,
  Cpu,
  Newspaper,
  BookOpen,
  Send,
} from "lucide-react";

type PlaygroundScenario = {
  id: string;
  name: string;
  description: string;
  taskInput: string;
  category: string;
  icon: typeof Brain;
  difficulty: "easy" | "medium" | "hard";
};

type TaskResult = {
  task_id: string;
  input: string;
  status: string;
  result_text?: string;
  agent_path?: string[];
  total_duration?: number;
  task_type?: string;
};

const SCENARIOS: PlaygroundScenario[] = [
  {
    id: "s1",
    name: "Product Search",
    description: "Find the best product under a budget constraint",
    taskInput: "Find the cheapest RTX 4070 under ₹60,000",
    category: "Shopping",
    icon: ShoppingCart,
    difficulty: "easy",
  },
  {
    id: "s2",
    name: "Tech Comparison",
    description: "Deep comparison of two or more technologies",
    taskInput: "Compare React vs Vue vs Svelte for a 2025 enterprise project",
    category: "Analysis",
    icon: BarChart3,
    difficulty: "medium",
  },
  {
    id: "s3",
    name: "Research Summary",
    description: "Summarize latest news or research on a topic",
    taskInput: "Summarize the latest AI breakthroughs this week",
    category: "Research",
    icon: Newspaper,
    difficulty: "easy",
  },
  {
    id: "s4",
    name: "Code Review",
    description: "Analyze and improve a code architecture",
    taskInput:
      "What are best practices for microservice architecture in Python?",
    category: "Engineering",
    icon: Code,
    difficulty: "medium",
  },
  {
    id: "s5",
    name: "Market Analysis",
    description: "Analyze a market or industry segment",
    taskInput: "Analyze the AI chip market and top competitors in 2025",
    category: "Business",
    icon: Globe,
    difficulty: "hard",
  },
  {
    id: "s6",
    name: "Budget Laptop Finder",
    description: "Find best devices within constraints",
    taskInput: "Best budget laptops for programming in 2025 under $800",
    category: "Shopping",
    icon: Cpu,
    difficulty: "easy",
  },
  {
    id: "s7",
    name: "Learning Path",
    description: "Create a structured learning plan",
    taskInput: "Create a 3-month learning roadmap for machine learning",
    category: "Education",
    icon: BookOpen,
    difficulty: "medium",
  },
  {
    id: "s8",
    name: "Creative Brief",
    description: "Generate a creative strategy or concept",
    taskInput: "Generate a startup idea around AI agents for small businesses",
    category: "Creative",
    icon: Lightbulb,
    difficulty: "hard",
  },
  {
    id: "s9",
    name: "Trend Explorer",
    description: "Explore trending topics and insights",
    taskInput: "What are the top trending GitHub repos this month and why?",
    category: "Research",
    icon: Compass,
    difficulty: "easy",
  },
  {
    id: "s10",
    name: "Deep Dive",
    description: "In-depth analysis on any topic",
    taskInput:
      "Explain quantum computing advantages over classical for optimization problems",
    category: "Education",
    icon: FileText,
    difficulty: "hard",
  },
  {
    id: "s11",
    name: "Stock Market Tracker",
    description: "Analyze current trends in stocks",
    taskInput:
      "What is the current market sentiment and analysis for TSLA and AAPL?",
    category: "Business",
    icon: BarChart3,
    difficulty: "medium",
  },
  {
    id: "s12",
    name: "Developer Tools",
    description: "Find tools for specific dev needs",
    taskInput:
      "Top 5 open-source UI libraries for React that support Tailwind and Framer Motion",
    category: "Engineering",
    icon: Code,
    difficulty: "easy",
  },
  {
    id: "s13",
    name: "Competitor Analysis",
    description: "Analyze competitor edge and strategy",
    taskInput:
      "Compare the AI enterprise capabilities of Anthropic vs OpenAI in 2025",
    category: "Analysis",
    icon: Globe,
    difficulty: "hard",
  },
  {
    id: "s14",
    name: "Crypto Trends",
    description: "Identify crypto movements",
    taskInput:
      "What are the biggest Layer 2 Ethereum scaling solutions this month?",
    category: "Research",
    icon: Zap,
    difficulty: "medium",
  },
  {
    id: "s15",
    name: "Startup Research",
    description: "Analyze VC funding trends",
    taskInput:
      "Which AI agent startups received seed funding in the last 30 days?",
    category: "Business",
    icon: Lightbulb,
    difficulty: "medium",
  },
];

const difficultyColor: Record<string, string> = {
  easy: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
  medium: "text-amber-400 bg-amber-500/10 border-amber-500/20",
  hard: "text-rose-400 bg-rose-500/10 border-rose-500/20",
};

const categoryColor: Record<string, string> = {
  Shopping: "text-cyan-400",
  Analysis: "text-violet-400",
  Research: "text-blue-400",
  Engineering: "text-emerald-400",
  Business: "text-amber-400",
  Education: "text-pink-400",
  Creative: "text-orange-400",
};

export function TrainingPlayground({ className }: { className?: string }) {
  const { getToken } = useAuth();
  const [mode, setMode] = useState<"select" | "running" | "result">("select");
  const [customTask, setCustomTask] = useState("");
  const [currentTask, setCurrentTask] = useState<string>("");
  const [result, setResult] = useState<TaskResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [completedIds, setCompletedIds] = useState<Set<string>>(new Set());
  const [filterCategory, setFilterCategory] = useState<string>("all");

  const executeTask = useCallback(
    async (taskInput: string, scenarioId?: string) => {
      const token = getToken();
      if (!token) {
        setError("Please log in to use the playground.");
        return;
      }

      setCurrentTask(taskInput);
      setMode("running");
      setLoading(true);
      setError("");
      setResult(null);

      try {
        const response = await api.submitRealTask(token, taskInput);
        const taskId = response.task_id;

        // Poll for completion
        let attempts = 0;
        const maxAttempts = 60;
        let finalResult: TaskResult | null = null;

        while (attempts < maxAttempts) {
          await new Promise((r) => setTimeout(r, 2000));
          attempts++;

          try {
            const data = await api.getRealTask(token, taskId);
            const task = data as unknown as TaskResult;

            if (task.status === "completed" || task.status === "failed") {
              finalResult = task;
              break;
            }
          } catch {
            // Continue polling
          }
        }

        if (finalResult) {
          setResult(finalResult);
          setMode("result");
          if (scenarioId) {
            setCompletedIds((prev) => new Set([...prev, scenarioId]));
          }
        } else {
          setError("Task timed out. Check the Tasks page for results.");
          setMode("select");
        }
      } catch (err) {
        setError("Failed to submit task. Is the backend running?");
        setMode("select");
      } finally {
        setLoading(false);
      }
    },
    [getToken],
  );

  const handleScenarioLaunch = (scenario: PlaygroundScenario) => {
    executeTask(scenario.taskInput, scenario.id);
  };

  const handleCustomLaunch = () => {
    if (!customTask.trim()) return;
    executeTask(customTask.trim());
  };

  const handleBack = () => {
    setMode("select");
    setResult(null);
    setError("");
  };

  const categories = [
    "all",
    ...Array.from(new Set(SCENARIOS.map((s) => s.category))),
  ];
  const filteredScenarios =
    filterCategory === "all"
      ? SCENARIOS
      : SCENARIOS.filter((s) => s.category === filterCategory);

  return (
    <div className={cn("space-y-6", className)}>
      <AnimatePresence mode="wait">
        {mode === "select" && (
          <motion.div
            key="select"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, x: -20 }}
            className="space-y-6"
          >
            {/* Custom Task Input */}
            <div className="rounded-xl border border-violet-500/20 bg-gradient-to-r from-violet-500/[0.05] to-cyan-500/[0.03] p-5">
              <div className="flex items-center gap-2 mb-3">
                <FlaskConical className="w-4 h-4 text-violet-400" />
                <p className="text-sm font-semibold">Free-form Sandbox</p>
              </div>
              <p className="text-xs text-muted-foreground mb-3">
                Enter any task and it will be executed by real AI agents — no
                simulations, no predefined results.
              </p>
              <div className="flex gap-2">
                <input
                  value={customTask}
                  onChange={(e) => setCustomTask(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleCustomLaunch()}
                  placeholder="e.g., Find the best cloud hosting with 99.9% SLA under $50/mo..."
                  className="flex-1 rounded-lg border border-white/[0.06] bg-white/[0.03] px-3 py-2.5 text-sm text-foreground placeholder:text-zinc-600 focus:outline-none focus:ring-1 focus:ring-violet-500/40"
                />
                <button
                  onClick={handleCustomLaunch}
                  disabled={!customTask.trim()}
                  className="px-5 py-2.5 rounded-lg bg-gradient-to-r from-violet-600 to-violet-500 hover:from-violet-500 hover:to-violet-400 text-white text-sm font-medium transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5 shadow-lg shadow-violet-600/20"
                >
                  <Rocket className="w-3.5 h-3.5" />
                  Execute
                </button>
              </div>
            </div>

            {error && (
              <div className="rounded-lg border border-red-500/20 bg-red-500/[0.05] px-4 py-3 text-sm text-red-400">
                {error}
              </div>
            )}

            {/* Category Filter */}
            <div className="flex items-center gap-2 flex-wrap">
              {categories.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setFilterCategory(cat)}
                  className={cn(
                    "text-[11px] px-3 py-1.5 rounded-full border transition-colors",
                    filterCategory === cat
                      ? "border-violet-500/30 bg-violet-500/10 text-violet-300"
                      : "border-white/[0.06] bg-white/[0.02] text-muted-foreground hover:text-foreground",
                  )}
                >
                  {cat === "all" ? "All" : cat}
                </button>
              ))}
            </div>

            {/* Scenarios */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="text-sm font-semibold flex items-center gap-2">
                    <Target className="w-4 h-4 text-cyan-400" />
                    Quick-Start Scenarios
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Pick a scenario — it will be executed with real AI agents
                  </p>
                </div>
                <p className="text-xs text-muted-foreground">
                  {completedIds.size}/{SCENARIOS.length} completed
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {filteredScenarios.map((scenario, idx) => {
                  const isCompleted = completedIds.has(scenario.id);
                  const ScenarioIcon = scenario.icon;

                  return (
                    <motion.div
                      key={scenario.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: idx * 0.04 }}
                      onClick={() => handleScenarioLaunch(scenario)}
                      className={cn(
                        "rounded-xl border p-4 cursor-pointer group transition-all duration-300",
                        isCompleted
                          ? "border-emerald-500/20 bg-emerald-500/[0.03]"
                          : "border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.03] hover:border-white/[0.1]",
                      )}
                    >
                      <div className="flex items-start justify-between mb-3">
                        <ScenarioIcon
                          className={cn(
                            "w-5 h-5",
                            categoryColor[scenario.category] || "text-zinc-400",
                          )}
                        />
                        <div className="flex items-center gap-2">
                          <span
                            className={cn(
                              "text-[9px] uppercase tracking-widest font-medium px-2 py-0.5 rounded-full border",
                              difficultyColor[scenario.difficulty],
                            )}
                          >
                            {scenario.difficulty}
                          </span>
                          {isCompleted && (
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                          )}
                        </div>
                      </div>

                      <h3 className="text-sm font-semibold mb-1 text-foreground">
                        {scenario.name}
                      </h3>
                      <p className="text-xs text-muted-foreground line-clamp-2 mb-3">
                        {scenario.description}
                      </p>

                      <div className="flex items-center justify-between">
                        <span
                          className={cn(
                            "text-[10px] font-medium",
                            categoryColor[scenario.category] || "text-zinc-500",
                          )}
                        >
                          {scenario.category}
                        </span>
                        <ChevronRight className="w-3.5 h-3.5 text-zinc-600 group-hover:text-zinc-300 transition-colors shrink-0" />
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            </div>
          </motion.div>
        )}

        {mode === "running" && (
          <motion.div
            key="running"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            className="space-y-4"
          >
            <div className="flex items-center gap-3 mb-4">
              <button
                onClick={handleBack}
                className="p-2 rounded-lg border border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.05] transition-colors"
              >
                <ArrowLeft className="w-4 h-4 text-muted-foreground" />
              </button>
              <div>
                <p className="text-sm font-semibold">Executing Task</p>
                <p className="text-xs text-muted-foreground truncate max-w-md">
                  {currentTask}
                </p>
              </div>
            </div>

            <div className="rounded-xl border border-violet-500/20 bg-gradient-to-br from-violet-500/[0.05] to-cyan-500/[0.02] p-12 flex flex-col items-center justify-center text-center">
              <div className="relative mb-6">
                <Loader2 className="w-12 h-12 text-violet-400 animate-spin" />
                <div className="absolute inset-0 w-12 h-12 rounded-full border-2 border-violet-500/20 animate-ping" />
              </div>
              <h3 className="text-lg font-semibold mb-2">
                AI Agents Working...
              </h3>
              <p className="text-sm text-muted-foreground max-w-md">
                Your task is being processed by real AI agents. This includes
                planning, web search, data extraction, and reasoning.
              </p>
              <div className="mt-6 flex items-center gap-4">
                {["Planner", "Search", "Extract", "Reason", "Generate"].map(
                  (step, i) => (
                    <div key={step} className="flex items-center gap-1">
                      <div
                        className={cn(
                          "w-2 h-2 rounded-full animate-pulse",
                          i < 3 ? "bg-violet-400" : "bg-zinc-600",
                        )}
                        style={{ animationDelay: `${i * 300}ms` }}
                      />
                      <span className="text-[10px] text-muted-foreground">
                        {step}
                      </span>
                    </div>
                  ),
                )}
              </div>
            </div>
          </motion.div>
        )}

        {mode === "result" && result && (
          <motion.div
            key="result"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            className="space-y-4"
          >
            <div className="flex items-center gap-3 mb-4">
              <button
                onClick={handleBack}
                className="p-2 rounded-lg border border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.05] transition-colors"
              >
                <ArrowLeft className="w-4 h-4 text-muted-foreground" />
              </button>
              <div className="flex-1">
                <p className="text-sm font-semibold">Task Result</p>
                <p className="text-xs text-muted-foreground truncate">
                  {result.input}
                </p>
              </div>
              <span
                className={cn(
                  "inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border text-xs font-medium",
                  result.status === "completed"
                    ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
                    : "border-red-500/30 bg-red-500/10 text-red-300",
                )}
              >
                {result.status === "completed" ? (
                  <CheckCircle2 className="w-3.5 h-3.5" />
                ) : (
                  <XCircle className="w-3.5 h-3.5" />
                )}
                {result.status}
              </span>
            </div>

            {/* Metadata */}
            <div className="grid grid-cols-3 gap-3">
              <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 text-center">
                <Clock className="w-5 h-5 text-muted-foreground mx-auto mb-2" />
                <p className="text-lg font-bold">
                  {result.total_duration
                    ? `${result.total_duration.toFixed(1)}s`
                    : "—"}
                </p>
                <p className="text-[10px] text-muted-foreground">Duration</p>
              </div>
              <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 text-center">
                <Brain className="w-5 h-5 text-muted-foreground mx-auto mb-2" />
                <p className="text-lg font-bold">
                  {result.agent_path?.length || 0}
                </p>
                <p className="text-[10px] text-muted-foreground">Agents Used</p>
              </div>
              <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 text-center">
                <Sparkles className="w-5 h-5 text-muted-foreground mx-auto mb-2" />
                <p className="text-lg font-bold">{result.task_type || "—"}</p>
                <p className="text-[10px] text-muted-foreground">Task Type</p>
              </div>
            </div>

            {/* Agent Path */}
            {result.agent_path && result.agent_path.length > 0 && (
              <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
                <h4 className="text-[10px] uppercase tracking-wider text-muted-foreground mb-3">
                  Agent Execution Path
                </h4>
                <div className="flex flex-wrap items-center gap-2">
                  {result.agent_path.map((agent, i) => (
                    <div key={i} className="flex items-center gap-1.5">
                      <span className="text-xs px-2.5 py-1 rounded-lg bg-violet-500/10 border border-violet-500/20 text-violet-300 font-medium">
                        {agent}
                      </span>
                      {i < result.agent_path!.length - 1 && (
                        <ChevronRight className="w-3 h-3 text-zinc-600" />
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Result Text */}
            <div className="rounded-xl border border-emerald-500/20 bg-[#0d1117] p-6 shadow-inner">
              <h4 className="text-sm font-semibold text-emerald-400 mb-4 flex items-center gap-2 border-b border-emerald-500/20 pb-2">
                <CheckCircle2 className="w-5 h-5" />
                Verified Output
              </h4>
              <div className="prose prose-invert prose-emerald prose-sm max-w-none text-foreground/90 whitespace-normal leading-relaxed max-h-[500px] overflow-y-auto marker:text-emerald-500 pr-2 custom-scrollbar">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {result.result_text ||
                    "No result text available. Check the Tasks page for full details."}
                </ReactMarkdown>
              </div>
            </div>

            {/* Try Another */}
            <div className="flex items-center justify-center gap-3 pt-4">
              <button
                onClick={handleBack}
                className="px-5 py-2.5 rounded-lg bg-gradient-to-r from-violet-600 to-violet-500 hover:from-violet-500 hover:to-violet-400 text-white text-sm font-medium transition-all flex items-center gap-2 shadow-lg shadow-violet-600/20"
              >
                <Rocket className="w-4 h-4" />
                Try Another
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
