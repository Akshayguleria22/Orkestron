"use client";

import { mockAgents } from "@/lib/mock-data";
import { cn } from "@/lib/utils";
import {
  Store,
  Star,
  Download,
  TrendingUp,
  Search,
  Filter,
  Zap,
  Shield,
  Handshake,
  Play,
  Brain,
} from "lucide-react";
import { useState } from "react";

const agentIcons: Record<string, typeof Brain> = {
  orchestrator: Brain,
  worker: Zap,
  system: Shield,
};

const categories = ["All", "Orchestration", "Search", "Negotiation", "Compliance", "Execution"];

/**
 * Agent Marketplace — browse, filter, and inspect available agents and capabilities.
 */
export default function MarketplacePage() {
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [searchQuery, setSearchQuery] = useState("");

  const filtered = mockAgents.filter((a) => {
    if (searchQuery && !a.name.toLowerCase().includes(searchQuery.toLowerCase()) && !a.capabilities.some(c => c.toLowerCase().includes(searchQuery.toLowerCase()))) return false;
    return true;
  });

  return (
    <div className="space-y-6 max-w-[1400px]">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Agent Marketplace</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Discover and deploy AI agents with specialized capabilities
          </p>
        </div>
      </div>

      {/* Search and filters */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-600" />
          <input
            type="text"
            placeholder="Search agents or capabilities…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 rounded-lg border border-white/[0.06] bg-white/[0.02] text-sm text-foreground placeholder:text-zinc-600 outline-none focus:border-indigo-500/30 focus:ring-1 focus:ring-indigo-500/20 transition-all"
          />
        </div>
        <div className="flex items-center gap-1">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={cn(
                "px-3 py-1.5 rounded-lg text-xs font-medium transition-all",
                selectedCategory === cat
                  ? "bg-white/[0.08] text-foreground border border-white/[0.1]"
                  : "text-muted-foreground hover:text-foreground hover:bg-white/[0.03] border border-transparent"
              )}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Agent Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filtered.map((agent, i) => {
          const Icon = agentIcons[agent.type] || Zap;
          return (
            <div
              key={agent.id}
              className="group relative rounded-xl border border-white/[0.06] bg-white/[0.02] p-6 hover:border-white/[0.1] hover:bg-white/[0.03] transition-all cursor-pointer"
            >
              <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-indigo-500/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />

              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-white/[0.04] border border-white/[0.08] flex items-center justify-center group-hover:border-indigo-500/20 transition-colors">
                    <Icon className="w-5 h-5 text-muted-foreground group-hover:text-indigo-400 transition-colors" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold">{agent.name}</h3>
                    <p className="text-[11px] text-muted-foreground">by {agent.developer}</p>
                  </div>
                </div>
                <div className="flex items-center gap-1 text-amber-400">
                  <Star className="w-3 h-3 fill-current" />
                  <span className="text-xs font-medium">{(agent.successRate / 20).toFixed(1)}</span>
                </div>
              </div>

              <p className="text-[13px] text-muted-foreground leading-relaxed mb-4">
                {agent.description}
              </p>

              {/* Capabilities */}
              <div className="flex flex-wrap gap-1.5 mb-5">
                {agent.capabilities.map((cap) => (
                  <span
                    key={cap}
                    className="text-[10px] px-2 py-1 rounded-md bg-indigo-500/5 border border-indigo-500/10 text-indigo-400/80"
                  >
                    {cap.replace(/_/g, " ")}
                  </span>
                ))}
              </div>

              {/* Stats row */}
              <div className="flex items-center justify-between pt-4 border-t border-white/[0.04]">
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-1.5">
                    <Download className="w-3 h-3 text-zinc-600" />
                    <span className="text-[11px] text-muted-foreground">
                      {agent.usageCount.toLocaleString()} uses
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <TrendingUp className="w-3 h-3 text-zinc-600" />
                    <span className="text-[11px] text-muted-foreground">{agent.successRate}% success</span>
                  </div>
                </div>
                <button className="px-3 py-1 rounded-md bg-indigo-600/80 hover:bg-indigo-600 text-[11px] font-medium text-white transition-colors">
                  Deploy
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
