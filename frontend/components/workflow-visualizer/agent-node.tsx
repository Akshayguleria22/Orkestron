"use client";

import { memo } from "react";
import { Handle, Position, type NodeProps } from "reactflow";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import {
  Brain,
  Search,
  Handshake,
  Shield,
  Play,
  User,
} from "lucide-react";

const agentIcons: Record<string, typeof Brain> = {
  "User Task": User,
  Supervisor: Brain,
  "Retrieval Agent": Search,
  "Negotiation Agent": Handshake,
  "Compliance Agent": Shield,
  "Executor Agent": Play,
};

const statusStyles: Record<string, { border: string; bg: string; glow: string; text: string }> = {
  completed: {
    border: "border-emerald-500/30",
    bg: "bg-emerald-500/5",
    glow: "shadow-[0_0_20px_rgba(34,197,94,0.12)]",
    text: "text-emerald-400",
  },
  active: {
    border: "border-indigo-500/40",
    bg: "bg-indigo-500/5",
    glow: "shadow-[0_0_30px_rgba(99,102,241,0.2)]",
    text: "text-indigo-400",
  },
  pending: {
    border: "border-white/[0.06]",
    bg: "bg-white/[0.01]",
    glow: "",
    text: "text-zinc-500",
  },
  error: {
    border: "border-red-500/30",
    bg: "bg-red-500/5",
    glow: "shadow-[0_0_20px_rgba(239,68,68,0.15)]",
    text: "text-red-400",
  },
};

/**
 * Custom React Flow node representing an agent in the workflow graph.
 * Glows with pulsing animation when status is "active".
 */
function AgentNodeComponent({ data }: NodeProps<{ label: string; status: string }>) {
  const Icon = agentIcons[data.label] || Brain;
  const style = statusStyles[data.status] || statusStyles.pending;

  return (
    <>
      <Handle type="target" position={Position.Top} className="!bg-transparent !border-0 !w-0 !h-0" />
      <motion.div
        animate={data.status === "active" ? { scale: [1, 1.02, 1] } : {}}
        transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
        className={cn(
          "flex items-center gap-3 px-5 py-3.5 rounded-xl border min-w-[220px]",
          "backdrop-blur-sm transition-all duration-500",
          style.border,
          style.bg,
          style.glow
        )}
      >
        <div className={cn(
          "w-8 h-8 rounded-lg flex items-center justify-center border transition-colors duration-500",
          data.status === "active" ? "border-indigo-500/20 bg-indigo-500/10" :
          data.status === "completed" ? "border-emerald-500/20 bg-emerald-500/10" :
          "border-white/[0.06] bg-white/[0.03]"
        )}>
          <Icon className={cn("w-4 h-4 transition-colors duration-500", style.text)} />
        </div>
        <div>
          <p className="text-sm font-medium text-foreground">{data.label}</p>
          <p className={cn("text-[10px] uppercase tracking-widest font-medium", style.text)}>
            {data.status}
          </p>
        </div>

        {/* Pulse ring for active nodes */}
        {data.status === "active" && (
          <motion.div
            className="absolute inset-0 rounded-xl border border-indigo-500/20"
            animate={{ opacity: [0, 0.5, 0], scale: [1, 1.04, 1.08] }}
            transition={{ duration: 2, repeat: Infinity, ease: "easeOut" }}
          />
        )}
      </motion.div>
      <Handle type="source" position={Position.Bottom} className="!bg-transparent !border-0 !w-0 !h-0" />
    </>
  );
}

export const AgentNode = memo(AgentNodeComponent);
