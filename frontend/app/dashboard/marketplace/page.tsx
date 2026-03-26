"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useAuth } from "@/lib/auth-context";
import { api } from "@/lib/api-client";
import { motion, AnimatePresence } from "framer-motion";
import {
  Bot,
  Plus,
  Search,
  Zap,
  Lock,
  Globe,
  Brain,
  Sparkles,
  Send,
  Loader2,
  CheckCircle2,
  XCircle,
  ChevronDown,
  ChevronRight,
  Clock,
  Eye,
  Cpu,
  Beaker,
  X,
  Play,
  BarChart3,
  Tag,
  Filter,
  Layers,
  Wand2,
  FlaskConical,
  MessageSquare,
  ExternalLink,
  Shield,
  Activity,
  RefreshCw,
} from "lucide-react";
import { cn } from "@/lib/utils";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

type PlatformAgent = {
  agent_id: string;
  owner_id: string;
  name: string;
  description: string;
  agent_type: "llm" | "ml" | "hybrid";
  visibility: "public" | "private";
  status: string;
  capabilities: string[];
  ml_models: string[];
  tools: string[];
  tags: string[];
  icon: string | null;
  category: string | null;
  total_runs: number;
  successful_runs: number;
  failed_runs: number;
  avg_latency_ms: number;
  success_rate: number;
  config: Record<string, unknown>;
  system_prompt: string | null;
  workflow_id: string | null;
  created_at: string;
};

type RunStep = {
  tool: string;
  status: string;
  duration_ms: number;
  output_summary?: string;
  error?: string;
};

type AgentRun = {
  run_id: string;
  agent_id: string;
  status: string;
  result_text?: string;
  steps: RunStep[];
  tools_used: string[];
  ml_models_used: string[];
  tokens_used: number;
  total_duration: number;
  error?: string;
  created_at: string;
};

const AGENT_TYPE_STYLES = {
  llm: {
    label: "LLM",
    color: "text-violet-300 bg-violet-500/15 border-violet-500/30",
    icon: Brain,
  },
  ml: {
    label: "ML",
    color: "text-cyan-300 bg-cyan-500/15 border-cyan-500/30",
    icon: FlaskConical,
  },
  hybrid: {
    label: "Hybrid",
    color: "text-amber-300 bg-amber-500/15 border-amber-500/30",
    icon: Sparkles,
  },
};

const CATEGORY_OPTIONS = [
  { value: "", label: "All Categories" },
  { value: "research", label: "🔬 Research" },
  { value: "analysis", label: "📊 Analysis" },
  { value: "commerce", label: "🛒 Commerce" },
  { value: "coding", label: "💻 Coding" },
  { value: "creative", label: "✍️ Creative" },
];

const TOOL_OPTIONS = [
  { value: "web_search", label: "Web Search" },
  { value: "web_scraper", label: "Web Scraper" },
  { value: "ml_sentiment_analysis", label: "ML: Sentiment" },
  { value: "ml_entity_extraction", label: "ML: Entities" },
  { value: "ml_keyword_extraction", label: "ML: Keywords" },
  { value: "ml_text_classification", label: "ML: Classification" },
  { value: "ml_extractive_summary", label: "ML: Summary" },
];

const ML_MODEL_OPTIONS = [
  { value: "sentiment_analysis", label: "Sentiment Analysis" },
  { value: "entity_extraction", label: "Entity Extraction" },
  { value: "keyword_extraction", label: "Keyword Extraction" },
  { value: "text_classification", label: "Text Classification" },
  { value: "extractive_summary", label: "Extractive Summary" },
];

export default function MarketplacePage() {
  const { accessToken, user } = useAuth();
  const token = accessToken;

  const [agents, setAgents] = useState<PlatformAgent[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [workflows, setWorkflows] = useState<
    { workflow_id: string; name: string }[]
  >([]);

  // Selected agent + execution
  const [selectedAgent, setSelectedAgent] = useState<PlatformAgent | null>(
    null,
  );
  const [executeInput, setExecuteInput] = useState("");
  const [executing, setExecuting] = useState(false);
  const [currentRun, setCurrentRun] = useState<AgentRun | null>(null);
  const [runs, setRuns] = useState<AgentRun[]>([]);

  // Deploy modal
  const [showDeploy, setShowDeploy] = useState(false);
  const [deployForm, setDeployForm] = useState({
    name: "",
    description: "",
    agent_type: "hybrid" as "llm" | "ml" | "hybrid",
    visibility: "public" as "public" | "private",
    system_prompt: "",
    tools: [] as string[],
    ml_models: [] as string[],
    category: "",
    tags: "",
    icon: "🤖",
    workflow_id: "",
  });
  const [deploying, setDeploying] = useState(false);

  // Execution step animation
  const [liveSteps, setLiveSteps] = useState<RunStep[]>([]);

  const fetchAgents = useCallback(async () => {
    try {
      let data: { agents: Record<string, unknown>[]; count: number };
      if (token) {
        data = await api.listPlatformAgents(token, {
          category: categoryFilter || undefined,
          agent_type: typeFilter || undefined,
          search: searchQuery || undefined,
        });
      } else {
        data = await api.listPublicAgents({
          category: categoryFilter || undefined,
          search: searchQuery || undefined,
        });
      }
      setAgents((data.agents || []) as unknown as PlatformAgent[]);
    } catch {
      // API unavailable
    } finally {
      setLoading(false);
    }
  }, [token, categoryFilter, typeFilter, searchQuery]);

  const fetchWorkflows = useCallback(async () => {
    if (!token) return;
    try {
      const data = await api.listWorkflows(token);
      setWorkflows(
        (data.workflows || []) as { workflow_id: string; name: string }[],
      );
    } catch {
      /* ignore */
    }
  }, [token]);

  useEffect(() => {
    fetchAgents();
    fetchWorkflows();
  }, [fetchAgents, fetchWorkflows]);

  const fetchRuns = useCallback(
    async (agentId: string) => {
      if (!token) return;
      try {
        const data = await api.listPlatformRuns(token, agentId, 10);
        setRuns((data.runs || []) as unknown as AgentRun[]);
      } catch {
        /* ignore */
      }
    },
    [token],
  );

  const handleExecute = async () => {
    if (!executeInput.trim() || !token || !selectedAgent || executing) return;
    setExecuting(true);
    setLiveSteps([]);
    setCurrentRun(null);

    try {
      const result = await api.executePlatformAgent(
        token,
        selectedAgent.agent_id,
        executeInput.trim(),
      );
      const run = result as unknown as AgentRun;
      setCurrentRun(run);

      // Animate steps one by one
      const steps = run.steps || [];
      for (let i = 0; i < steps.length; i++) {
        await new Promise((resolve) => setTimeout(resolve, 300));
        setLiveSteps((prev) => [...prev, steps[i]]);
      }

      await fetchRuns(selectedAgent.agent_id);
      await fetchAgents();
    } catch {
      setCurrentRun({
        run_id: "error",
        agent_id: selectedAgent.agent_id,
        status: "failed",
        result_text: "Failed to execute agent. Check backend connection.",
        steps: [],
        tools_used: [],
        ml_models_used: [],
        tokens_used: 0,
        total_duration: 0,
        created_at: new Date().toISOString(),
      });
    } finally {
      setExecuting(false);
    }
  };

  const handleDeploy = async () => {
    if (!token || !deployForm.name.trim()) return;
    setDeploying(true);
    try {
      await api.createPlatformAgent(token, {
        name: deployForm.name,
        description: deployForm.description,
        agent_type: deployForm.agent_type,
        visibility: deployForm.visibility,
        system_prompt: deployForm.system_prompt || undefined,
        tools: deployForm.tools,
        ml_models: deployForm.ml_models,
        category: deployForm.category || undefined,
        workflow_id: deployForm.workflow_id || undefined,
        tags: deployForm.tags
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean),
        icon: deployForm.icon || undefined,
      });
      setShowDeploy(false);
      setDeployForm({
        name: "",
        description: "",
        agent_type: "hybrid",
        visibility: "public",
        system_prompt: "",
        tools: [],
        ml_models: [],
        category: "",
        tags: "",
        icon: "🤖",
        workflow_id: "",
      });
      await fetchAgents();
    } catch {
      /* handle error */
    } finally {
      setDeploying(false);
    }
  };

  const handleSelectAgent = async (agent: PlatformAgent) => {
    setSelectedAgent(agent);
    setCurrentRun(null);
    setLiveSteps([]);
    setExecuteInput("");
    if (token) await fetchRuns(agent.agent_id);
  };

  return (
    <div className="max-w-[1600px] mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2.5">
            <Layers className="w-6 h-6 text-violet-400" />
            Agent Marketplace
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Deploy, discover, and execute real AI agents with ML + LLM
            capabilities
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={fetchAgents}
            className="p-2 rounded-lg border border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.04] text-muted-foreground hover:text-foreground transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          {token && (
            <button
              onClick={() => setShowDeploy(true)}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-gradient-to-r from-violet-600 to-violet-500 hover:from-violet-500 hover:to-violet-400 text-white text-sm font-medium transition-all shadow-lg shadow-violet-600/20"
            >
              <Plus className="w-4 h-4" />
              Deploy Agent
            </button>
          )}
        </div>
      </div>

      {/* Search + Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search agents..."
            className="w-full pl-9 pr-4 py-2 rounded-lg border border-white/[0.08] bg-white/[0.03] text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:border-violet-500/40 transition-colors"
          />
        </div>
        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="px-3 py-2 rounded-lg border border-white/[0.08] bg-white/[0.03] text-sm text-foreground focus:outline-none focus:border-violet-500/40"
        >
          {CATEGORY_OPTIONS.map((c) => (
            <option key={c.value} value={c.value} className="bg-[#0d1117]">
              {c.label}
            </option>
          ))}
        </select>
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          className="px-3 py-2 rounded-lg border border-white/[0.08] bg-white/[0.03] text-sm text-foreground focus:outline-none focus:border-violet-500/40"
        >
          <option value="" className="bg-[#0d1117]">
            All Types
          </option>
          <option value="llm" className="bg-[#0d1117]">
            🧠 LLM
          </option>
          <option value="ml" className="bg-[#0d1117]">
            🧪 ML
          </option>
          <option value="hybrid" className="bg-[#0d1117]">
            ⚡ Hybrid
          </option>
        </select>
        <div className="text-xs text-muted-foreground">
          {agents.length} agents available
        </div>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Agent Cards Column */}
        <div className="lg:col-span-1 space-y-3 max-h-[calc(100vh-280px)] overflow-y-auto pr-1">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="w-5 h-5 text-violet-400 animate-spin" />
            </div>
          ) : agents.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground text-sm border border-white/[0.06] rounded-xl bg-white/[0.01]">
              <Bot className="w-10 h-10 mx-auto mb-3 text-zinc-600" />
              No agents found. Deploy your first agent!
            </div>
          ) : (
            agents.map((agent) => {
              const typeStyle =
                AGENT_TYPE_STYLES[agent.agent_type] || AGENT_TYPE_STYLES.llm;
              const TypeIcon = typeStyle.icon;
              const isActive = selectedAgent?.agent_id === agent.agent_id;

              return (
                <motion.button
                  key={agent.agent_id}
                  onClick={() => handleSelectAgent(agent)}
                  className={cn(
                    "w-full text-left rounded-xl border p-4 transition-all",
                    isActive
                      ? "border-violet-500/40 bg-violet-500/[0.08] shadow-lg shadow-violet-500/5"
                      : "border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.04] hover:border-white/[0.1]",
                  )}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.02 }}
                >
                  <div className="flex items-start gap-3">
                    <div className="text-2xl flex-shrink-0">
                      {agent.icon || "🤖"}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="text-sm font-semibold truncate">
                          {agent.name}
                        </h3>
                        {agent.visibility === "private" && (
                          <Lock className="w-3 h-3 text-amber-400 flex-shrink-0" />
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
                        {agent.description}
                      </p>
                      <div className="flex items-center gap-2 mt-2 flex-wrap">
                        <span
                          className={cn(
                            "inline-flex items-center gap-1 px-1.5 py-0.5 rounded border text-[10px] font-medium",
                            typeStyle.color,
                          )}
                        >
                          <TypeIcon className="w-3 h-3" />
                          {typeStyle.label}
                        </span>
                        {agent.category && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/[0.04] border border-white/[0.06] text-muted-foreground">
                            {agent.category}
                          </span>
                        )}
                        <span className="text-[10px] text-muted-foreground ml-auto">
                          {agent.total_runs} runs · {agent.success_rate}%
                        </span>
                      </div>
                    </div>
                  </div>
                </motion.button>
              );
            })
          )}
        </div>

        {/* Agent Detail + Execution Column */}
        <div className="lg:col-span-2">
          {!selectedAgent ? (
            <div className="flex flex-col items-center justify-center py-32 text-center border border-white/[0.06] rounded-xl bg-white/[0.01]">
              <Bot className="w-16 h-16 text-zinc-700 mb-4" />
              <h3 className="text-lg font-medium text-zinc-400">
                Select an Agent
              </h3>
              <p className="text-sm text-muted-foreground mt-1 max-w-sm">
                Choose an agent from the marketplace to see details, execute
                tasks, and view results.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Agent Info Card */}
              <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-5">
                <div className="flex items-start gap-4">
                  <div className="text-4xl">{selectedAgent.icon || "🤖"}</div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h2 className="text-lg font-bold">
                        {selectedAgent.name}
                      </h2>
                      {selectedAgent.visibility === "private" ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full border border-amber-500/30 bg-amber-500/10 text-[10px] text-amber-300">
                          <Lock className="w-3 h-3" /> Private
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 text-[10px] text-emerald-300">
                          <Globe className="w-3 h-3" /> Public
                        </span>
                      )}
                      {selectedAgent.workflow_id && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full border border-violet-500/30 bg-violet-500/10 text-[10px] text-violet-300 ml-2">
                          <Layers className="w-3 h-3" /> Workflow Attached
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground mt-1 leading-relaxed">
                      {selectedAgent.description}
                    </p>

                    {/* Stats */}
                    <div className="flex items-center gap-4 mt-3">
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <Activity className="w-3.5 h-3.5 text-violet-400" />
                        {selectedAgent.total_runs} runs
                      </div>
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                        {selectedAgent.success_rate}% success
                      </div>
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <Clock className="w-3.5 h-3.5 text-cyan-400" />
                        {selectedAgent.avg_latency_ms > 0
                          ? `${(selectedAgent.avg_latency_ms / 1000).toFixed(1)}s avg`
                          : "No data"}
                      </div>
                    </div>

                    {/* Tools + ML Models */}
                    <div className="flex flex-wrap gap-1.5 mt-3">
                      {selectedAgent.tools.map((t) => (
                        <span
                          key={t}
                          className="text-[10px] px-2 py-0.5 rounded border border-cyan-500/20 bg-cyan-500/5 text-cyan-300"
                        >
                          {t}
                        </span>
                      ))}
                      {selectedAgent.ml_models.map((m) => (
                        <span
                          key={m}
                          className="text-[10px] px-2 py-0.5 rounded border border-violet-500/20 bg-violet-500/5 text-violet-300"
                        >
                          ML: {m}
                        </span>
                      ))}
                    </div>

                    {/* Tags */}
                    {selectedAgent.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        {selectedAgent.tags.map((tag) => (
                          <span
                            key={tag}
                            className="text-[10px] px-2 py-0.5 rounded bg-white/[0.04] text-muted-foreground"
                          >
                            #{tag}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Execution Input */}
              {token && (
                <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
                  <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                    <Play className="w-4 h-4 text-emerald-400" />
                    Execute Agent
                  </h3>
                  <div className="flex gap-3">
                    <input
                      value={executeInput}
                      onChange={(e) => setExecuteInput(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && handleExecute()}
                      placeholder={`Ask ${selectedAgent.name} anything...`}
                      className="flex-1 bg-white/[0.04] border border-white/[0.08] rounded-lg px-4 py-2.5 text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:border-violet-500/40 transition-colors"
                    />
                    <button
                      onClick={handleExecute}
                      disabled={!executeInput.trim() || executing}
                      className="px-5 py-2.5 rounded-lg bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-medium flex items-center gap-2 transition-all shadow-lg shadow-emerald-600/20"
                    >
                      {executing ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Zap className="w-4 h-4" />
                      )}
                      Execute
                    </button>
                  </div>
                </div>
              )}

              {/* Execution Result */}
              <AnimatePresence mode="wait">
                {(executing || currentRun) && (
                  <motion.div
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    className="rounded-xl border border-white/[0.06] bg-white/[0.02] overflow-hidden"
                  >
                    {/* Execution Steps */}
                    <div className="px-4 py-3 border-b border-white/[0.06] flex items-center justify-between">
                      <h3 className="text-sm font-semibold flex items-center gap-2">
                        <Activity className="w-4 h-4 text-cyan-400" />
                        Execution Pipeline
                      </h3>
                      {currentRun && (
                        <div className="flex items-center gap-2 text-xs">
                          {currentRun.status === "completed" ? (
                            <span className="flex items-center gap-1 text-emerald-400">
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              Completed in {currentRun.total_duration}s
                            </span>
                          ) : currentRun.status === "failed" ? (
                            <span className="flex items-center gap-1 text-red-400">
                              <XCircle className="w-3.5 h-3.5" />
                              Failed
                            </span>
                          ) : (
                            <span className="flex items-center gap-1 text-cyan-400">
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              Running...
                            </span>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Step Visualization */}
                    <div className="p-4 space-y-2">
                      {executing && liveSteps.length === 0 && (
                        <div className="flex items-center gap-3 p-3 rounded-lg bg-white/[0.02] border border-white/[0.04]">
                          <Loader2 className="w-4 h-4 text-violet-400 animate-spin" />
                          <span className="text-sm text-muted-foreground">
                            Agent is processing your request...
                          </span>
                        </div>
                      )}

                      {(currentRun?.steps || liveSteps).map((step, i) => (
                        <motion.div
                          key={`${step.tool}-${i}`}
                          initial={{ opacity: 0, x: -12 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: i * 0.1 }}
                          className={cn(
                            "flex items-center gap-3 p-3 rounded-lg border",
                            step.status === "completed"
                              ? "border-emerald-500/20 bg-emerald-500/[0.03]"
                              : step.status === "failed"
                                ? "border-red-500/20 bg-red-500/[0.03]"
                                : "border-white/[0.06] bg-white/[0.02]",
                          )}
                        >
                          <div className="flex-shrink-0">
                            {step.status === "completed" ? (
                              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                            ) : step.status === "failed" ? (
                              <XCircle className="w-4 h-4 text-red-400" />
                            ) : (
                              <Loader2 className="w-4 h-4 text-cyan-400 animate-spin" />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-medium">
                                {step.tool
                                  .replace("ml_", "ML: ")
                                  .replace(/_/g, " ")}
                              </span>
                              {step.duration_ms > 0 && (
                                <span className="text-[10px] text-muted-foreground">
                                  {step.duration_ms < 1000
                                    ? `${Math.round(step.duration_ms)}ms`
                                    : `${(step.duration_ms / 1000).toFixed(1)}s`}
                                </span>
                              )}
                            </div>
                            {step.output_summary && (
                              <p className="text-[11px] text-muted-foreground mt-0.5 truncate">
                                {step.output_summary}
                              </p>
                            )}
                            {step.error && (
                              <p className="text-[11px] text-red-400 mt-0.5">
                                {step.error}
                              </p>
                            )}
                          </div>
                        </motion.div>
                      ))}

                      {/* Result */}
                      {currentRun?.result_text && (
                        <motion.div
                          initial={{ opacity: 0, y: 8 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: 0.3 }}
                          className="mt-4 rounded-xl border border-emerald-500/20 bg-emerald-500/[0.03] p-4"
                        >
                          <h4 className="text-sm font-semibold text-emerald-400 mb-2 flex items-center gap-2">
                            <Sparkles className="w-4 h-4" />
                            Result
                          </h4>
                          <div className="prose prose-invert prose-emerald prose-sm max-w-none max-h-[450px] overflow-y-auto border-t border-emerald-500/10 pt-3 mt-1 scrollbar-thin scrollbar-thumb-emerald-500/20">
                            <ReactMarkdown remarkPlugins={[remarkGfm]}>
                              {currentRun.result_text}
                            </ReactMarkdown>
                          </div>
                          <div className="flex items-center gap-4 mt-3 text-[11px] text-muted-foreground">
                            <span>
                              Tools:{" "}
                              {currentRun.tools_used?.join(", ") || "none"}
                            </span>
                            {currentRun.tokens_used > 0 && (
                              <span>Tokens: {currentRun.tokens_used}</span>
                            )}
                            <span>Duration: {currentRun.total_duration}s</span>
                          </div>
                        </motion.div>
                      )}

                      {currentRun?.error && !currentRun.result_text && (
                        <div className="mt-3 p-3 rounded-lg border border-red-500/20 bg-red-500/[0.04]">
                          <p className="text-sm text-red-300">
                            {currentRun.error}
                          </p>
                        </div>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Recent Runs */}
              {runs.length > 0 && (
                <div className="rounded-xl border border-white/[0.06] bg-white/[0.02]">
                  <div className="px-4 py-3 border-b border-white/[0.06]">
                    <h3 className="text-sm font-semibold flex items-center gap-2">
                      <Clock className="w-4 h-4 text-muted-foreground" />
                      Recent Runs ({runs.length})
                    </h3>
                  </div>
                  <div className="divide-y divide-white/[0.03] max-h-[250px] overflow-y-auto">
                    {runs.map((run) => (
                      <div
                        key={run.run_id}
                        className="px-4 py-3 hover:bg-white/[0.02] transition-colors"
                      >
                        <div className="flex items-center gap-2 mb-1">
                          {run.status === "completed" ? (
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                          ) : (
                            <XCircle className="w-3.5 h-3.5 text-red-400" />
                          )}
                          <span className="text-xs text-foreground truncate flex-1">
                            {(run as unknown as { input?: string }).input ||
                              "Run"}
                          </span>
                          <span className="text-[10px] text-muted-foreground">
                            {run.total_duration
                              ? `${run.total_duration}s`
                              : "—"}
                          </span>
                        </div>
                        {run.result_text && (
                          <p className="text-[11px] text-muted-foreground line-clamp-1 pl-5">
                            {run.result_text}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Deploy Agent Modal */}
      <AnimatePresence>
        {showDeploy && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
            onClick={(e) =>
              e.target === e.currentTarget && setShowDeploy(false)
            }
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="w-full max-w-2xl max-h-[85vh] overflow-y-auto rounded-2xl border border-white/[0.08] bg-[#0d1117] p-6 shadow-2xl"
            >
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-bold flex items-center gap-2">
                  <Plus className="w-5 h-5 text-violet-400" />
                  Deploy New Agent
                </h2>
                <button
                  onClick={() => setShowDeploy(false)}
                  className="text-muted-foreground hover:text-foreground"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-4">
                {/* Name + Category */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] text-muted-foreground mb-1">
                      Agent Name *
                    </label>
                    <input
                      value={deployForm.name}
                      onChange={(e) =>
                        setDeployForm({ ...deployForm, name: e.target.value })
                      }
                      placeholder="e.g. My Research Bot"
                      className="w-full px-3 py-2 rounded-lg border border-white/[0.08] bg-white/[0.03] text-sm focus:outline-none focus:ring-1 focus:ring-violet-500/50"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-muted-foreground mb-1">
                      Category
                    </label>
                    <select
                      value={deployForm.category}
                      onChange={(e) =>
                        setDeployForm({
                          ...deployForm,
                          category: e.target.value,
                        })
                      }
                      className="w-full px-3 py-2 rounded-lg border border-white/[0.08] bg-white/[0.03] text-sm focus:outline-none"
                    >
                      {CATEGORY_OPTIONS.map((c) => (
                        <option
                          key={c.value}
                          value={c.value}
                          className="bg-[#0d1117]"
                        >
                          {c.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Workflow Attachment */}
                <div>
                  <label className="block text-[11px] text-muted-foreground mb-1">
                    Attach External Workflow (Optional)
                  </label>
                  <select
                    value={deployForm.workflow_id}
                    onChange={(e) =>
                      setDeployForm({
                        ...deployForm,
                        workflow_id: e.target.value,
                      })
                    }
                    className="w-full px-3 py-2 rounded-lg border border-white/[0.08] bg-white/[0.03] text-sm focus:outline-none"
                  >
                    <option value="" className="bg-[#0d1117]">
                      No Workflow
                    </option>
                    {workflows.map((wf) => (
                      <option
                        key={wf.workflow_id}
                        value={wf.workflow_id}
                        className="bg-[#0d1117]"
                      >
                        {wf.name}
                      </option>
                    ))}
                  </select>
                  <p className="text-[10px] text-muted-foreground mt-1">
                    If attached, executing this agent will run the workflow
                    graph instead of the standard LLM/ML pipeline.
                  </p>
                </div>

                {/* Description */}
                <div>
                  <label className="block text-[11px] text-muted-foreground mb-1">
                    Description
                  </label>
                  <textarea
                    value={deployForm.description}
                    onChange={(e) =>
                      setDeployForm({
                        ...deployForm,
                        description: e.target.value,
                      })
                    }
                    placeholder="What does this agent do?"
                    rows={2}
                    className="w-full px-3 py-2 rounded-lg border border-white/[0.08] bg-white/[0.03] text-sm focus:outline-none focus:ring-1 focus:ring-violet-500/50 resize-none"
                  />
                </div>

                {/* Type + Visibility */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] text-muted-foreground mb-1">
                      Agent Type
                    </label>
                    <div className="flex gap-2">
                      {(["llm", "ml", "hybrid"] as const).map((t) => {
                        const s = AGENT_TYPE_STYLES[t];
                        return (
                          <button
                            key={t}
                            onClick={() =>
                              setDeployForm({ ...deployForm, agent_type: t })
                            }
                            className={cn(
                              "flex-1 py-2 rounded-lg border text-xs font-medium transition-all",
                              deployForm.agent_type === t
                                ? s.color
                                : "border-white/[0.06] bg-white/[0.02] text-muted-foreground",
                            )}
                          >
                            {s.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                  <div>
                    <label className="block text-[11px] text-muted-foreground mb-1">
                      Visibility
                    </label>
                    <div className="flex gap-2">
                      {[
                        { value: "public", label: "Public", icon: Globe },
                        { value: "private", label: "Private", icon: Lock },
                      ].map((v) => (
                        <button
                          key={v.value}
                          onClick={() =>
                            setDeployForm({
                              ...deployForm,
                              visibility: v.value as "public" | "private",
                            })
                          }
                          className={cn(
                            "flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg border text-xs font-medium transition-all",
                            deployForm.visibility === v.value
                              ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
                              : "border-white/[0.06] bg-white/[0.02] text-muted-foreground",
                          )}
                        >
                          <v.icon className="w-3.5 h-3.5" />
                          {v.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Tools */}
                <div>
                  <label className="block text-[11px] text-muted-foreground mb-1">
                    Tools
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {TOOL_OPTIONS.map((tool) => (
                      <button
                        key={tool.value}
                        onClick={() => {
                          const tools = deployForm.tools.includes(tool.value)
                            ? deployForm.tools.filter((t) => t !== tool.value)
                            : [...deployForm.tools, tool.value];
                          setDeployForm({ ...deployForm, tools });
                        }}
                        className={cn(
                          "text-[11px] px-2.5 py-1 rounded-lg border transition-all",
                          deployForm.tools.includes(tool.value)
                            ? "border-cyan-500/30 bg-cyan-500/10 text-cyan-300"
                            : "border-white/[0.06] bg-white/[0.02] text-muted-foreground hover:border-white/[0.12]",
                        )}
                      >
                        {tool.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* ML Models */}
                {(deployForm.agent_type === "ml" ||
                  deployForm.agent_type === "hybrid") && (
                  <div>
                    <label className="block text-[11px] text-muted-foreground mb-1">
                      ML Models
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {ML_MODEL_OPTIONS.map((model) => (
                        <button
                          key={model.value}
                          onClick={() => {
                            const models = deployForm.ml_models.includes(
                              model.value,
                            )
                              ? deployForm.ml_models.filter(
                                  (m) => m !== model.value,
                                )
                              : [...deployForm.ml_models, model.value];
                            setDeployForm({ ...deployForm, ml_models: models });
                          }}
                          className={cn(
                            "text-[11px] px-2.5 py-1 rounded-lg border transition-all",
                            deployForm.ml_models.includes(model.value)
                              ? "border-violet-500/30 bg-violet-500/10 text-violet-300"
                              : "border-white/[0.06] bg-white/[0.02] text-muted-foreground hover:border-white/[0.12]",
                          )}
                        >
                          {model.label}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* System Prompt */}
                {(deployForm.agent_type === "llm" ||
                  deployForm.agent_type === "hybrid") && (
                  <div>
                    <label className="block text-[11px] text-muted-foreground mb-1">
                      System Prompt (Agent Personality)
                    </label>
                    <textarea
                      value={deployForm.system_prompt}
                      onChange={(e) =>
                        setDeployForm({
                          ...deployForm,
                          system_prompt: e.target.value,
                        })
                      }
                      placeholder="You are an expert AI assistant that..."
                      rows={3}
                      className="w-full px-3 py-2 rounded-lg border border-white/[0.08] bg-white/[0.03] text-sm focus:outline-none focus:ring-1 focus:ring-violet-500/50 resize-none font-mono text-xs"
                    />
                  </div>
                )}

                {/* Tags + Icon */}
                <div className="grid grid-cols-3 gap-3">
                  <div className="col-span-2">
                    <label className="block text-[11px] text-muted-foreground mb-1">
                      Tags (comma-separated)
                    </label>
                    <input
                      value={deployForm.tags}
                      onChange={(e) =>
                        setDeployForm({ ...deployForm, tags: e.target.value })
                      }
                      placeholder="e.g. research, ml, nlp"
                      className="w-full px-3 py-2 rounded-lg border border-white/[0.08] bg-white/[0.03] text-sm focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-muted-foreground mb-1">
                      Icon (emoji)
                    </label>
                    <input
                      value={deployForm.icon}
                      onChange={(e) =>
                        setDeployForm({ ...deployForm, icon: e.target.value })
                      }
                      className="w-full px-3 py-2 rounded-lg border border-white/[0.08] bg-white/[0.03] text-sm text-center focus:outline-none"
                    />
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-3 pt-2">
                  <button
                    onClick={handleDeploy}
                    disabled={deploying || !deployForm.name.trim()}
                    className="flex items-center gap-2 px-6 py-2.5 rounded-lg bg-gradient-to-r from-violet-600 to-violet-500 hover:from-violet-500 hover:to-violet-400 disabled:opacity-40 text-white text-sm font-medium transition-all shadow-lg shadow-violet-600/20"
                  >
                    {deploying ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Zap className="w-4 h-4" />
                    )}
                    Deploy Agent
                  </button>
                  <button
                    onClick={() => setShowDeploy(false)}
                    className="px-4 py-2.5 rounded-lg border border-white/[0.08] text-sm text-muted-foreground hover:text-foreground transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
