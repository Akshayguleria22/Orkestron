"use client";

import { memo } from "react";
import { Handle, Position, type NodeProps } from "reactflow";
import { cn } from "@/lib/utils";
import {
  Brain,
  Search,
  Handshake,
  Shield,
  Zap,
  Lightbulb,
  BarChart3,
  FileOutput,
} from "lucide-react";

export interface BuilderNodeData {
  type: string;
  label: string;
  status: "idle" | "active" | "completed" | "error";
  config: Record<string, unknown>;
}

const handleColors: Record<string, string> = {
  planner: "#6366F1",
  web_search: "#06B6D4",
  data_extraction: "#F59E0B",
  reasoning: "#22C55E",
  comparison: "#8B5CF6",
  result_generator: "#F97316",
};

const nodeThemes: Record<
  string,
  {
    icon: typeof Brain;
    stripe: string;
    iconBg: string;
    iconText: string;
  }
> = {
  planner: {
    icon: Brain,
    stripe: "bg-indigo-500",
    iconBg: "bg-indigo-500/10",
    iconText: "text-indigo-400",
  },
  web_search: {
    icon: Search,
    stripe: "bg-cyan-500",
    iconBg: "bg-cyan-500/10",
    iconText: "text-cyan-400",
  },
  data_extraction: {
    icon: Handshake,
    stripe: "bg-amber-500",
    iconBg: "bg-amber-500/10",
    iconText: "text-amber-400",
  },
  reasoning: {
    icon: Lightbulb,
    stripe: "bg-emerald-500",
    iconBg: "bg-emerald-500/10",
    iconText: "text-emerald-400",
  },
  comparison: {
    icon: BarChart3,
    stripe: "bg-violet-500",
    iconBg: "bg-violet-500/10",
    iconText: "text-violet-400",
  },
  result_generator: {
    icon: FileOutput,
    stripe: "bg-orange-500",
    iconBg: "bg-orange-500/10",
    iconText: "text-orange-400",
  },
};

const statusDots: Record<string, string> = {
  active: "bg-indigo-400 animate-pulse",
  completed: "bg-emerald-400",
  error: "bg-red-400",
};

function BuilderNodeComponent({
  data,
  selected,
}: NodeProps<BuilderNodeData>) {
  const theme = nodeThemes[data.type] || nodeThemes.planner;
  const Icon = theme.icon;
  const handleColor = handleColors[data.type] || handleColors.planner;

  return (
    <>
      <Handle
        type="target"
        position={Position.Left}
        className="!w-3 !h-3 !rounded-full !border-2 !border-[#111827]"
        style={{ background: handleColor }}
      />

      <div
        className={cn(
          "relative w-[210px] rounded-xl border overflow-hidden transition-all duration-200",
          "bg-[#111827]",
          selected
            ? "border-indigo-500/50 shadow-[0_0_25px_rgba(99,102,241,0.2)]"
            : "border-white/[0.08] hover:border-white/[0.15]",
          data.status === "active" &&
            "shadow-[0_0_30px_rgba(99,102,241,0.2)]"
        )}
      >
        {/* Color stripe */}
        <div
          className={cn(
            "absolute left-0 top-0 bottom-0 w-1 rounded-l-xl",
            theme.stripe
          )}
        />

        <div className="flex items-center gap-3 px-4 py-3.5 pl-5">
          <div
            className={cn(
              "w-9 h-9 rounded-lg flex items-center justify-center shrink-0",
              theme.iconBg
            )}
          >
            <Icon className={cn("w-[18px] h-[18px]", theme.iconText)} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[13px] font-semibold text-white/90 truncate">
              {data.label}
            </p>
            <p className="text-[10px] text-white/40 capitalize tracking-wide">
              {data.type} agent
            </p>
          </div>
          {data.status !== "idle" && (
            <div
              className={cn(
                "w-2.5 h-2.5 rounded-full shrink-0",
                statusDots[data.status]
              )}
            />
          )}
        </div>

        {/* Active pulse ring */}
        {data.status === "active" && (
          <div className="absolute inset-0 rounded-xl border border-indigo-500/30 animate-pulse pointer-events-none" />
        )}
      </div>

      <Handle
        type="source"
        position={Position.Right}
        className="!w-3 !h-3 !rounded-full !border-2 !border-[#111827]"
        style={{ background: handleColor }}
      />
    </>
  );
}

export const BuilderNode = memo(BuilderNodeComponent);
