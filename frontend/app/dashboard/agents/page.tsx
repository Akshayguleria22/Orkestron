"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { AgentCard } from "@/components/agent-card/agent-card";
import { mockAgents } from "@/lib/mock-data";
import { Bot, Plus, X, Loader2, Info } from "lucide-react";
import { api } from "@/lib/api-client";
import { useAuth } from "@/lib/auth-context";
import type { Agent } from "@/lib/types";

export default function AgentsPage() {
  const { getToken } = useAuth();
  const [agents, setAgents] = useState<Agent[]>([]);
  const [isDemo, setIsDemo] = useState(true);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [addForm, setAddForm] = useState({
    agent_id: "",
    name: "",
    capabilities: "",
    public_key: "",
  });
  const [addLoading, setAddLoading] = useState(false);
  const [addError, setAddError] = useState("");

  const fetchAgents = async () => {
    try {
      const data = await api.getAgents();
      const list = Array.isArray(data)
        ? data
        : ((data as Record<string, unknown>).agents ?? []);
      const mapped: Agent[] = (list as Record<string, unknown>[]).map((a) => ({
        id: (a.agent_id as string) || (a.id as string) || "",
        name: (a.name as string) || (a.agent_id as string) || "",
        type: (a.type as string) || "worker",
        status: ((a.status as string) || "active") as Agent["status"],
        capabilities: Array.isArray(a.capabilities)
          ? (a.capabilities as string[])
          : [],
        developer: (a.developer as string) || "",
        usageCount: (a.usage_count as number) ?? (a.usageCount as number) ?? 0,
        successRate:
          (a.success_rate as number) ?? (a.successRate as number) ?? 0,
        avgLatency: (a.avg_latency as number) ?? (a.avgLatency as number) ?? 0,
        lastActive:
          (a.last_active as string) ||
          (a.lastActive as string) ||
          new Date().toISOString(),
        description: (a.description as string) || "",
      }));
      if (mapped.length > 0) {
        setAgents(mapped);
        setIsDemo(false);
      } else {
        setAgents(mockAgents);
      }
    } catch {
      setAgents(mockAgents);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAgents();
  }, []);

  const handleAddAgent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!addForm.agent_id.trim() || !addForm.name.trim()) return;
    setAddLoading(true);
    setAddError("");
    try {
      const caps = addForm.capabilities
        .split(",")
        .map((c) => c.trim())
        .filter(Boolean);
      await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/agents/register`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            agent_id: addForm.agent_id.trim(),
            name: addForm.name.trim(),
            capabilities: caps,
            public_key: addForm.public_key.trim() || undefined,
          }),
        },
      );
      setShowAdd(false);
      setAddForm({ agent_id: "", name: "", capabilities: "", public_key: "" });
      await fetchAgents();
    } catch {
      setAddError("Failed to register agent.");
    } finally {
      setAddLoading(false);
    }
  };

  const activeCount = agents.filter((a) => a.status === "active").length;

  return (
    <div className="space-y-6 max-w-[1400px]">
      {isDemo && !loading && (
        <div className="flex items-center gap-2 px-4 py-2.5 rounded-lg border border-amber-500/20 bg-amber-500/5 text-amber-300 text-xs">
          <Info className="w-3.5 h-3.5 shrink-0" />
          <span>
            Showing demo agents — register your own agents to see them here.
          </span>
        </div>
      )}

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Agents</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {activeCount} active of {agents.length} registered agents
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowAdd(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            Register Agent
          </button>
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-white/[0.06] bg-white/[0.02]">
            <Bot className="w-3.5 h-3.5 text-muted-foreground" />
            <span className="text-xs text-muted-foreground">
              {agents.length} total
            </span>
          </div>
        </div>
      </div>

      {/* Add Agent Modal */}
      {showAdd && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-xl border border-white/[0.08] bg-[#0d1117] p-5"
        >
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold">Register New Agent</h3>
            <button
              onClick={() => setShowAdd(false)}
              className="text-muted-foreground hover:text-foreground"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <form
            onSubmit={handleAddAgent}
            className="grid grid-cols-1 md:grid-cols-2 gap-3"
          >
            <div>
              <label className="block text-[11px] text-muted-foreground mb-1">
                Agent ID *
              </label>
              <input
                value={addForm.agent_id}
                onChange={(e) =>
                  setAddForm({ ...addForm, agent_id: e.target.value })
                }
                placeholder="e.g. my-custom-agent"
                className="w-full px-3 py-2 rounded-lg border border-white/[0.08] bg-white/[0.03] text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500/50"
              />
            </div>
            <div>
              <label className="block text-[11px] text-muted-foreground mb-1">
                Name *
              </label>
              <input
                value={addForm.name}
                onChange={(e) =>
                  setAddForm({ ...addForm, name: e.target.value })
                }
                placeholder="e.g. My Custom Agent"
                className="w-full px-3 py-2 rounded-lg border border-white/[0.08] bg-white/[0.03] text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500/50"
              />
            </div>
            <div>
              <label className="block text-[11px] text-muted-foreground mb-1">
                Capabilities (comma-separated)
              </label>
              <input
                value={addForm.capabilities}
                onChange={(e) =>
                  setAddForm({ ...addForm, capabilities: e.target.value })
                }
                placeholder="e.g. search, analyze, process"
                className="w-full px-3 py-2 rounded-lg border border-white/[0.08] bg-white/[0.03] text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500/50"
              />
            </div>
            <div>
              <label className="block text-[11px] text-muted-foreground mb-1">
                Public Key (optional)
              </label>
              <input
                value={addForm.public_key}
                onChange={(e) =>
                  setAddForm({ ...addForm, public_key: e.target.value })
                }
                placeholder="Optional RSA public key"
                className="w-full px-3 py-2 rounded-lg border border-white/[0.08] bg-white/[0.03] text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500/50"
              />
            </div>
            <div className="md:col-span-2 flex items-center gap-3">
              <button
                type="submit"
                disabled={
                  addLoading || !addForm.agent_id.trim() || !addForm.name.trim()
                }
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white text-xs font-medium transition-colors"
              >
                {addLoading ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Plus className="w-3.5 h-3.5" />
                )}
                Register
              </button>
              {addError && <p className="text-xs text-red-400">{addError}</p>}
            </div>
          </form>
        </motion.div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-5 h-5 text-indigo-400 animate-spin" />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {agents.map((agent) => (
            <AgentCard key={agent.id} agent={agent} />
          ))}
        </div>
      )}
    </div>
  );
}
