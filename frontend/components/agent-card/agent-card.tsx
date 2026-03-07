"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import type { Agent } from "@/lib/types";
import { Activity, Zap, Clock, TrendingUp } from "lucide-react";

interface AgentCardProps {
  agent: Agent;
  onClick?: () => void;
  className?: string;
}

const statusColors: Record<string, string> = {
  active: "bg-emerald-500",
  idle: "bg-amber-500",
  error: "bg-red-500",
  offline: "bg-zinc-600",
};

const statusGlow: Record<string, string> = {
  active: "shadow-[0_0_6px_rgba(34,197,94,0.4)]",
  idle: "shadow-[0_0_6px_rgba(245,158,11,0.4)]",
  error: "shadow-[0_0_6px_rgba(239,68,68,0.4)]",
  offline: "",
};

export function AgentCard({ agent, onClick, className }: AgentCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -2 }}
      transition={{ duration: 0.3 }}
      onClick={onClick}
      className={cn(
        "relative group rounded-xl border border-white/[0.06] bg-white/[0.02] p-5 cursor-pointer overflow-hidden",
        "hover:border-white/[0.1] hover:bg-white/[0.03] transition-all duration-300",
        className
      )}
    >
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-indigo-500/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />

      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className="w-9 h-9 rounded-lg bg-white/[0.04] border border-white/[0.08] flex items-center justify-center">
              <Zap className="w-4 h-4 text-indigo-400" />
            </div>
            <div
              className={cn(
                "absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-background",
                statusColors[agent.status],
                statusGlow[agent.status],
              )}
            />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-foreground">{agent.name}</h3>
            <p className="text-[11px] text-muted-foreground capitalize">{agent.type}</p>
          </div>
        </div>
        <span className={cn(
          "text-[10px] font-medium uppercase tracking-widest px-2 py-0.5 rounded-full border",
          agent.status === "active" && "text-emerald-400 border-emerald-500/20 bg-emerald-500/5",
          agent.status === "idle" && "text-amber-400 border-amber-500/20 bg-amber-500/5",
          agent.status === "error" && "text-red-400 border-red-500/20 bg-red-500/5",
          agent.status === "offline" && "text-zinc-500 border-zinc-600/20 bg-zinc-600/5",
        )}>
          {agent.status}
        </span>
      </div>

      {/* Description */}
      <p className="text-xs text-muted-foreground leading-relaxed mb-4 line-clamp-2">
        {agent.description}
      </p>

      {/* Capabilities */}
      <div className="flex flex-wrap gap-1.5 mb-4">
        {agent.capabilities.slice(0, 3).map((cap) => (
          <span
            key={cap}
            className="text-[10px] px-2 py-0.5 rounded-md bg-white/[0.04] border border-white/[0.06] text-muted-foreground"
          >
            {cap.replace(/_/g, " ")}
          </span>
        ))}
        {agent.capabilities.length > 3 && (
          <span className="text-[10px] px-2 py-0.5 text-muted-foreground">
            +{agent.capabilities.length - 3}
          </span>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3 pt-3 border-t border-white/[0.04]">
        <div className="flex items-center gap-1.5">
          <Activity className="w-3 h-3 text-muted-foreground" />
          <span className="text-[11px] text-muted-foreground">
            {agent.usageCount.toLocaleString()}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <TrendingUp className="w-3 h-3 text-muted-foreground" />
          <span className="text-[11px] text-muted-foreground">
            {agent.successRate}%
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <Clock className="w-3 h-3 text-muted-foreground" />
          <span className="text-[11px] text-muted-foreground">
            {agent.avgLatency}ms
          </span>
        </div>
      </div>
    </motion.div>
  );
}
