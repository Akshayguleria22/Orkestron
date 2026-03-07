"use client";

import { motion } from "framer-motion";
import { AgentCard } from "@/components/agent-card/agent-card";
import { mockAgents } from "@/lib/mock-data";
import { Bot } from "lucide-react";

/**
 * Agents page — grid of all registered agents with status and stats.
 */
export default function AgentsPage() {
  const activeCount = mockAgents.filter((a) => a.status === "active").length;

  return (
    <div className="space-y-6 max-w-[1400px]">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Agents</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {activeCount} active of {mockAgents.length} registered agents
          </p>
        </div>
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-white/[0.06] bg-white/[0.02]">
          <Bot className="w-3.5 h-3.5 text-muted-foreground" />
          <span className="text-xs text-muted-foreground">{mockAgents.length} total</span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {mockAgents.map((agent, i) => (
          <AgentCard key={agent.id} agent={agent} />
        ))}
      </div>
    </div>
  );
}
