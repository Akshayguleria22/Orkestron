"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Bot,
  Plus,
  X,
  Loader2,
  AlertTriangle,
  Search,
  ExternalLink,
  Activity,
  CheckCircle2,
  Clock,
  Zap,
  Brain,
  Globe,
  Lock,
  ChevronRight,
  Play,
  BarChart3,
  Sparkles,
  RefreshCw,
  Trash2,
  Settings,
  Eye,
  Tag,
} from "lucide-react";
import { api } from "@/lib/api-client";
import { useAuth } from "@/lib/auth-context";
import { cn } from "@/lib/utils";

type PlatformAgent = {
  agent_id: string;
  owner_id: string;
  name: string;
  description: string;
  agent_type: string;
  visibility: string;
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
  created_at: string;
  system_prompt?: string;
};

const TYPE_COLORS: Record<string, string> = {
  llm: "text-violet-300 bg-violet-500/15 border-violet-500/30",
  ml: "text-cyan-300 bg-cyan-500/15 border-cyan-500/30",
  hybrid: "text-amber-300 bg-amber-500/15 border-amber-500/30",
};

export default function AgentsPage() {
  const { getToken, accessToken, user } = useAuth();
  const router = useRouter();
  const token = accessToken;
  const [agents, setAgents] = useState<PlatformAgent[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedAgent, setSelectedAgent] = useState<PlatformAgent | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [showDeploy, setShowDeploy] = useState(false);
  const [deployForm, setDeployForm] = useState({
    name: "",
    description: "",
    agent_type: "hybrid" as string,
    visibility: "public" as string,
    system_prompt: "",
    tools: [] as string[],
    category: "",
    tags: "",
    icon: "🤖",
    workflow_id: "",
  });
  const [deploying, setDeploying] = useState(false);
  const [workflows, setWorkflows] = useState<any[]>([]);

  const fetchAgents = useCallback(async () => {
    try {
      if (token) {
        const [agentsData, workflowsData] = await Promise.all([
          api.listPlatformAgents(token, { search: searchQuery || undefined }),
          api.listWorkflows(token).catch(() => ({ workflows: [] })),
        ]);
        setAgents((agentsData.agents || []) as unknown as PlatformAgent[]);
        setWorkflows(workflowsData.workflows || []);
      } else {
        const data = await api.listPublicAgents({
          search: searchQuery || undefined,
        });
        setAgents((data.agents || []) as unknown as PlatformAgent[]);
      }
    } catch {
      // Fallback: try legacy agents
      try {
        const data = await api.getAgents();
        const list = Array.isArray(data) ? data : ((data as Record<string, unknown>).agents ?? []);
        setAgents((list as unknown as PlatformAgent[]));
      } catch {}
    } finally {
      setLoading(false);
    }
  }, [token, searchQuery]);

  useEffect(() => {
    fetchAgents();
  }, [fetchAgents]);

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
        category: deployForm.category || undefined,
        tags: deployForm.tags.split(",").map((t) => t.trim()).filter(Boolean),
        icon: deployForm.icon || undefined,
        workflow_id: deployForm.workflow_id || undefined,
      });
      setShowDeploy(false);
      setDeployForm({
        name: "", description: "", agent_type: "hybrid",
        visibility: "public", system_prompt: "", tools: [],
        category: "", tags: "", icon: "🤖", workflow_id: "",
      });
      await fetchAgents();
    } catch {}
    setDeploying(false);
  };

  const handleDelete = async (agentId: string) => {
    if (!token) return;
    if (!confirm("Are you sure you want to delete this agent?")) return;
    try {
      await api.deletePlatformAgent(token, agentId);
      setSelectedAgent(null);
      await fetchAgents();
    } catch {}
  };

  const navigateToMarketplace = (agentId: string) => {
    router.push(`/dashboard/marketplace`);
  };

  const filteredAgents = agents;
  const activeCount = agents.filter((a) => a.status === "active").length;
  const totalRuns = agents.reduce((s, a) => s + (a.total_runs || 0), 0);

  return (
    <div className="space-y-6 max-w-[1400px]">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight flex items-center gap-2">
            <Bot className="w-5 h-5 text-violet-400" />
            Agents
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {activeCount} active · {agents.length} total · {totalRuns} total runs
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

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <input
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search agents..."
          className="w-full pl-9 pr-4 py-2 rounded-lg border border-white/[0.08] bg-white/[0.03] text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:border-violet-500/40 transition-colors"
        />
      </div>

      {/* Main Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Agent Grid */}
        <div className="lg:col-span-2">
          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 animate-pulse">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 flex items-start gap-3">
                  <div className="w-8 h-8 rounded-lg bg-white/[0.05] shrink-0" />
                  <div className="flex-1 space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <div className="h-4 w-32 bg-white/[0.05] rounded" />
                      <div className="w-1.5 h-1.5 rounded-full bg-white/[0.05]" />
                    </div>
                    <div className="h-3 w-full bg-white/[0.03] rounded" />
                    <div className="h-3 w-4/5 bg-white/[0.03] rounded" />
                    <div className="flex items-center gap-2 pt-1 flex-wrap">
                      <div className="h-4 w-12 bg-white/[0.04] rounded" />
                      <div className="h-4 w-16 bg-white/[0.04] rounded" />
                      <div className="h-3 w-20 bg-white/[0.03] rounded ml-auto" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : agents.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center border border-white/[0.06] rounded-xl bg-white/[0.01]">
              <Bot className="w-10 h-10 text-zinc-600 mb-4" />
              <h3 className="text-lg font-medium text-zinc-400">No agents found</h3>
              <p className="text-sm text-muted-foreground mt-1 max-w-sm">
                Deploy your first agent or browse the marketplace to get started.
              </p>
              <div className="flex gap-3 mt-4">
                <button
                  onClick={() => setShowDeploy(true)}
                  className="px-4 py-2 rounded-lg bg-violet-600 text-white text-sm font-medium"
                >
                  <Plus className="w-4 h-4 inline mr-1" />
                  Deploy Agent
                </button>
                <button
                  onClick={() => router.push("/dashboard/marketplace")}
                  className="px-4 py-2 rounded-lg border border-white/[0.08] text-sm text-muted-foreground hover:text-foreground"
                >
                  Browse Marketplace
                </button>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {filteredAgents.map((agent) => {
                const isSelected = selectedAgent?.agent_id === agent.agent_id;
                const typeColor = TYPE_COLORS[agent.agent_type] || TYPE_COLORS.llm;
                return (
                  <motion.button
                    key={agent.agent_id}
                    onClick={() => setSelectedAgent(agent)}
                    className={cn(
                      "w-full text-left rounded-xl border p-4 transition-all",
                      isSelected
                        ? "border-violet-500/40 bg-violet-500/[0.08] shadow-lg shadow-violet-500/5"
                        : "border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.04] hover:border-white/[0.1]",
                    )}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                  >
                    <div className="flex items-start gap-3">
                      <span className="text-2xl">{agent.icon || "🤖"}</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="text-sm font-semibold truncate">{agent.name}</h3>
                          {agent.visibility === "private" && <Lock className="w-3 h-3 text-amber-400" />}
                          <div className={cn("w-1.5 h-1.5 rounded-full ml-auto", agent.status === "active" ? "bg-emerald-500" : "bg-zinc-600")} />
                        </div>
                        <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed mb-2">
                          {agent.description || "No description"}
                        </p>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={cn("inline-flex items-center gap-1 px-1.5 py-0.5 rounded border text-[10px] font-medium", typeColor)}>
                            {agent.agent_type}
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
              })}
            </div>
          )}
        </div>

        {/* Agent Detail Panel */}
        <div className="lg:col-span-1">
          {!selectedAgent ? (
            <div className="rounded-xl border border-white/[0.06] bg-white/[0.01] p-8 text-center sticky top-6">
              <Eye className="w-10 h-10 text-zinc-700 mx-auto mb-3" />
              <h3 className="text-sm font-medium text-zinc-400">Select an Agent</h3>
              <p className="text-xs text-muted-foreground mt-1">
                Click on any agent to view details and actions
              </p>
            </div>
          ) : (
            <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] overflow-hidden sticky top-6">
              {/* Agent Header */}
              <div className="p-5 border-b border-white/[0.06]">
                <div className="flex items-start gap-3 mb-3">
                  <span className="text-3xl">{selectedAgent.icon || "🤖"}</span>
                  <div className="flex-1">
                    <h2 className="text-lg font-bold">{selectedAgent.name}</h2>
                    <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                      {selectedAgent.description || "No description"}
                    </p>
                  </div>
                </div>

                {/* Status badges */}
                <div className="flex flex-wrap gap-2">
                  <span className={cn("inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[10px]", selectedAgent.visibility === "public" ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300" : "border-amber-500/30 bg-amber-500/10 text-amber-300")}>
                    {selectedAgent.visibility === "public" ? <Globe className="w-3 h-3" /> : <Lock className="w-3 h-3" />}
                    {selectedAgent.visibility}
                  </span>
                  <span className={cn("inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[10px]", TYPE_COLORS[selectedAgent.agent_type] || TYPE_COLORS.llm)}>
                    {selectedAgent.agent_type}
                  </span>
                  <span className={cn("inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[10px]", selectedAgent.status === "active" ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300" : "border-zinc-500/30 bg-zinc-500/10 text-zinc-300")}>
                    <div className={cn("w-1.5 h-1.5 rounded-full", selectedAgent.status === "active" ? "bg-emerald-500" : "bg-zinc-500")} />
                    {selectedAgent.status}
                  </span>
                </div>
              </div>

              {/* Stats */}
              <div className="grid grid-cols-3 divide-x divide-white/[0.06] border-b border-white/[0.06]">
                <div className="p-3 text-center">
                  <p className="text-lg font-bold text-foreground">{selectedAgent.total_runs}</p>
                  <p className="text-[10px] text-muted-foreground">Total Runs</p>
                </div>
                <div className="p-3 text-center">
                  <p className="text-lg font-bold text-emerald-400">{selectedAgent.success_rate}%</p>
                  <p className="text-[10px] text-muted-foreground">Success</p>
                </div>
                <div className="p-3 text-center">
                  <p className="text-lg font-bold text-foreground">
                    {selectedAgent.avg_latency_ms > 0 ? `${(selectedAgent.avg_latency_ms / 1000).toFixed(1)}s` : "—"}
                  </p>
                  <p className="text-[10px] text-muted-foreground">Avg Time</p>
                </div>
              </div>

              {/* Capabilities */}
              {selectedAgent.capabilities.length > 0 && (
                <div className="p-4 border-b border-white/[0.06]">
                  <h4 className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2">Capabilities</h4>
                  <div className="flex flex-wrap gap-1.5">
                    {selectedAgent.capabilities.map((cap) => (
                      <span key={cap} className="text-[10px] px-2 py-0.5 rounded bg-white/[0.04] border border-white/[0.06] text-muted-foreground">
                        {cap}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Tools & Models */}
              {(selectedAgent.tools.length > 0 || selectedAgent.ml_models.length > 0) && (
                <div className="p-4 border-b border-white/[0.06]">
                  <h4 className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2">Tools & Models</h4>
                  <div className="flex flex-wrap gap-1.5">
                    {selectedAgent.tools.map((t) => (
                      <span key={t} className="text-[10px] px-2 py-0.5 rounded border border-cyan-500/20 bg-cyan-500/5 text-cyan-300">
                        {t}
                      </span>
                    ))}
                    {selectedAgent.ml_models.map((m) => (
                      <span key={m} className="text-[10px] px-2 py-0.5 rounded border border-violet-500/20 bg-violet-500/5 text-violet-300">
                        ML: {m}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Tags */}
              {selectedAgent.tags.length > 0 && (
                <div className="p-4 border-b border-white/[0.06]">
                  <h4 className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2">Tags</h4>
                  <div className="flex flex-wrap gap-1.5">
                    {selectedAgent.tags.map((tag) => (
                      <span key={tag} className="text-[10px] px-2 py-0.5 rounded bg-white/[0.04] text-muted-foreground">
                        #{tag}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="p-4 space-y-2">
                <button
                  onClick={() => navigateToMarketplace(selectedAgent.agent_id)}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-gradient-to-r from-violet-600 to-violet-500 hover:from-violet-500 hover:to-violet-400 text-white text-sm font-medium transition-all shadow-lg shadow-violet-600/20"
                >
                  <Play className="w-4 h-4" />
                  Execute in Marketplace
                </button>
                {selectedAgent.owner_id === user?.id && (
                  <button
                    onClick={() => handleDelete(selectedAgent.agent_id)}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg border border-red-500/20 bg-red-500/[0.05] text-red-400 text-sm hover:bg-red-500/10 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                    Delete Agent
                  </button>
                )}
              </div>

              {/* Meta */}
              <div className="px-4 py-3 border-t border-white/[0.06] bg-white/[0.01]">
                <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                  <span>Created: {new Date(selectedAgent.created_at).toLocaleDateString()}</span>
                  <span className="font-mono">{selectedAgent.agent_id.slice(0, 12)}...</span>
                </div>
              </div>
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
            onClick={(e) => e.target === e.currentTarget && setShowDeploy(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="w-full max-w-lg max-h-[85vh] overflow-y-auto rounded-2xl border border-white/[0.08] bg-[#0d1117] p-6 shadow-2xl"
            >
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-bold flex items-center gap-2">
                  <Plus className="w-5 h-5 text-violet-400" />
                  Deploy New Agent
                </h2>
                <button onClick={() => setShowDeploy(false)} className="text-muted-foreground hover:text-foreground">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-[11px] text-muted-foreground mb-1">Agent Name *</label>
                  <input
                    value={deployForm.name}
                    onChange={(e) => setDeployForm({ ...deployForm, name: e.target.value })}
                    placeholder="e.g. My Research Bot"
                    className="w-full px-3 py-2 rounded-lg border border-white/[0.08] bg-white/[0.03] text-sm focus:outline-none focus:ring-1 focus:ring-violet-500/50"
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-muted-foreground mb-1">Description</label>
                  <textarea
                    value={deployForm.description}
                    onChange={(e) => setDeployForm({ ...deployForm, description: e.target.value })}
                    placeholder="What does this agent do?"
                    rows={2}
                    className="w-full px-3 py-2 rounded-lg border border-white/[0.08] bg-white/[0.03] text-sm focus:outline-none focus:ring-1 focus:ring-violet-500/50 resize-none"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] text-muted-foreground mb-1">Type</label>
                    <select
                      value={deployForm.agent_type}
                      onChange={(e) => setDeployForm({ ...deployForm, agent_type: e.target.value })}
                      className="w-full px-3 py-2 rounded-lg border border-white/[0.08] bg-white/[0.03] text-sm"
                    >
                      <option value="llm" className="bg-[#0d1117]">LLM</option>
                      <option value="ml" className="bg-[#0d1117]">ML</option>
                      <option value="hybrid" className="bg-[#0d1117]">Hybrid</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] text-muted-foreground mb-1">Visibility</label>
                    <select
                      value={deployForm.visibility}
                      onChange={(e) => setDeployForm({ ...deployForm, visibility: e.target.value })}
                      className="w-full px-3 py-2 rounded-lg border border-white/[0.08] bg-white/[0.03] text-sm"
                    >
                      <option value="public" className="bg-[#0d1117]">Public</option>
                      <option value="private" className="bg-[#0d1117]">Private</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] text-muted-foreground mb-1">Workflow (Optional)</label>
                    <select
                      value={deployForm.workflow_id}
                      onChange={(e) => setDeployForm({ ...deployForm, workflow_id: e.target.value })}
                      className="w-full px-3 py-2 rounded-lg border border-white/[0.08] bg-white/[0.03] text-sm"
                    >
                      <option value="" className="bg-[#0d1117]">None (Default Orchestrator)</option>
                      {workflows.map((wf) => (
                        <option key={wf.workflow_id} value={wf.workflow_id} className="bg-[#0d1117]">
                          {wf.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block text-[11px] text-muted-foreground mb-1">System Prompt</label>
                  <textarea
                    value={deployForm.system_prompt}
                    onChange={(e) => setDeployForm({ ...deployForm, system_prompt: e.target.value })}
                    placeholder="Optional system prompt for LLM agents..."
                    rows={3}
                    className="w-full px-3 py-2 rounded-lg border border-white/[0.08] bg-white/[0.03] text-sm focus:outline-none resize-none"
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-muted-foreground mb-1">Tags (comma-separated)</label>
                  <input
                    value={deployForm.tags}
                    onChange={(e) => setDeployForm({ ...deployForm, tags: e.target.value })}
                    placeholder="research, analysis, trading"
                    className="w-full px-3 py-2 rounded-lg border border-white/[0.08] bg-white/[0.03] text-sm focus:outline-none"
                  />
                </div>
                <button
                  onClick={handleDeploy}
                  disabled={deploying || !deployForm.name.trim()}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-gradient-to-r from-violet-600 to-violet-500 hover:from-violet-500 hover:to-violet-400 disabled:opacity-40 text-white text-sm font-medium transition-all"
                >
                  {deploying ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
                  Deploy Agent
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
