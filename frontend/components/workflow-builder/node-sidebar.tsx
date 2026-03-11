"use client";

import { type DragEvent, useState } from "react";
import { cn } from "@/lib/utils";
import {
  Brain, Search, Handshake, Shield, Zap, GripVertical, ChevronDown, ChevronRight,
} from "lucide-react";

export interface NodeTemplate {
  type: "supervisor" | "retrieval" | "negotiation" | "compliance" | "executor";
  label: string;
  description: string;
}

const nodeTemplates: NodeTemplate[] = [
  {
    type: "supervisor",
    label: "Supervisor",
    description: "Routes tasks & coordinates",
  },
  {
    type: "retrieval",
    label: "Retrieval",
    description: "Search vendors & data",
  },
  {
    type: "negotiation",
    label: "Negotiation",
    description: "Negotiate pricing & deals",
  },
  {
    type: "compliance",
    label: "Compliance",
    description: "Verify policies & rules",
  },
  {
    type: "executor",
    label: "Executor",
    description: "Execute final actions",
  },
];

const icons: Record<string, typeof Brain> = {
  supervisor: Brain,
  retrieval: Search,
  negotiation: Handshake,
  compliance: Shield,
  executor: Zap,
};

const colors: Record<string, { bg: string; text: string; border: string }> = {
  supervisor: { bg: "bg-indigo-500/10", text: "text-indigo-400", border: "border-indigo-500/20" },
  retrieval: { bg: "bg-cyan-500/10", text: "text-cyan-400", border: "border-cyan-500/20" },
  negotiation: { bg: "bg-amber-500/10", text: "text-amber-400", border: "border-amber-500/20" },
  compliance: { bg: "bg-emerald-500/10", text: "text-emerald-400", border: "border-emerald-500/20" },
  executor: { bg: "bg-violet-500/10", text: "text-violet-400", border: "border-violet-500/20" },
};

interface NodeSidebarProps {
  className?: string;
}

export function NodeSidebar({ className }: NodeSidebarProps) {
  const [isExpanded, setIsExpanded] = useState(true);

  const onDragStart = (e: DragEvent, template: NodeTemplate) => {
    e.dataTransfer.setData("application/orkestron-node", JSON.stringify(template));
    e.dataTransfer.effectAllowed = "move";
  };

  return (
    <div
      className={cn(
        "flex flex-col border-r border-white/[0.06] bg-[#0B0F19]/80 backdrop-blur-sm w-[240px] shrink-0",
        className
      )}
    >
      <div className="px-4 py-3 border-b border-white/[0.06] flex items-center justify-between">
        <p className="text-xs font-semibold text-white/60 uppercase tracking-widest">
          Agent Nodes
        </p>
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="p-1 rounded-md hover:bg-white/[0.05] text-white/40 transition-colors"
        >
          {isExpanded ? (
            <ChevronDown className="w-3.5 h-3.5" />
          ) : (
            <ChevronRight className="w-3.5 h-3.5" />
          )}
        </button>
      </div>

      {isExpanded && (
        <div className="p-3 space-y-2 overflow-y-auto flex-1">
          {nodeTemplates.map((template) => {
            const Icon = icons[template.type];
            const color = colors[template.type];
            return (
              <div
                key={template.type}
                draggable
                onDragStart={(e) => onDragStart(e, template)}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-xl border cursor-grab active:cursor-grabbing",
                  "transition-all duration-200 hover:bg-white/[0.04] hover:border-white/[0.12]",
                  "bg-white/[0.02]",
                  color.border
                )}
              >
                <GripVertical className="w-3.5 h-3.5 text-white/20 shrink-0" />
                <div
                  className={cn(
                    "w-8 h-8 rounded-lg flex items-center justify-center shrink-0",
                    color.bg
                  )}
                >
                  <Icon className={cn("w-4 h-4", color.text)} />
                </div>
                <div className="min-w-0">
                  <p className="text-[13px] font-medium text-white/85 truncate">
                    {template.label}
                  </p>
                  <p className="text-[10px] text-white/35 truncate">
                    {template.description}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="px-4 py-3 border-t border-white/[0.06]">
        <p className="text-[10px] text-white/30 text-center">
          Drag nodes to canvas
        </p>
      </div>
    </div>
  );
}
