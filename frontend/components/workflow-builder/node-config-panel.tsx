"use client";

import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import {
  X, Brain, Search, Handshake, Shield, Zap, Sliders,
} from "lucide-react";
import type { BuilderNodeData } from "./builder-node";

interface NodeConfigPanelProps {
  nodeId: string | null;
  nodeData: BuilderNodeData | null;
  onUpdate: (nodeId: string, config: Record<string, unknown>) => void;
  onClose: () => void;
  className?: string;
}

interface FieldConfig {
  key: string;
  label: string;
  type: "number" | "text" | "select" | "slider" | "boolean";
  options?: string[];
  min?: number;
  max?: number;
  step?: number;
  description?: string;
}

const nodeConfigs: Record<string, FieldConfig[]> = {
  supervisor: [
    { key: "strategy", label: "Routing Strategy", type: "select", options: ["sequential", "parallel", "adaptive"], description: "How tasks are distributed" },
    { key: "maxRetries", label: "Max Retries", type: "number", min: 0, max: 10, description: "Retry attempts on failure" },
    { key: "timeout", label: "Timeout (s)", type: "number", min: 5, max: 300, description: "Max execution time" },
    { key: "priority", label: "Priority", type: "select", options: ["low", "normal", "high", "critical"] },
  ],
  retrieval: [
    { key: "topK", label: "Top-K Results", type: "number", min: 1, max: 50, description: "Number of results to retrieve" },
    { key: "similarityThreshold", label: "Similarity Threshold", type: "slider", min: 0, max: 1, step: 0.05, description: "Minimum relevance score" },
    { key: "sources", label: "Data Sources", type: "select", options: ["all", "vendors", "internal", "marketplace"] },
    { key: "cacheEnabled", label: "Cache Results", type: "boolean", description: "Use semantic cache" },
  ],
  negotiation: [
    { key: "priceWeight", label: "Price Weight", type: "slider", min: 0, max: 1, step: 0.05, description: "Importance of price in scoring" },
    { key: "ratingWeight", label: "Rating Weight", type: "slider", min: 0, max: 1, step: 0.05, description: "Importance of vendor rating" },
    { key: "deliveryWeight", label: "Delivery Weight", type: "slider", min: 0, max: 1, step: 0.05, description: "Importance of delivery speed" },
    { key: "maxRounds", label: "Max Negotiation Rounds", type: "number", min: 1, max: 10 },
    { key: "minSavingsTarget", label: "Min Savings %", type: "number", min: 0, max: 50, description: "Target savings percentage" },
  ],
  compliance: [
    { key: "strictMode", label: "Strict Mode", type: "boolean", description: "Fail on any violation" },
    { key: "ruleSet", label: "Rule Set", type: "select", options: ["default", "enterprise", "government", "custom"], description: "Policy rule set" },
    { key: "budgetLimit", label: "Budget Limit ($)", type: "number", min: 0, max: 1000000, description: "Max allowed spend" },
    { key: "requireApproval", label: "Require Approval", type: "boolean", description: "Human-in-the-loop approval" },
  ],
  executor: [
    { key: "executionMode", label: "Execution Mode", type: "select", options: ["auto", "confirm", "dry-run"], description: "How actions are executed" },
    { key: "rollbackEnabled", label: "Rollback on Failure", type: "boolean", description: "Auto-rollback on error" },
    { key: "notifyOnComplete", label: "Notify on Complete", type: "boolean", description: "Send completion notification" },
    { key: "outputFormat", label: "Output Format", type: "select", options: ["json", "summary", "detailed"] },
  ],
};

const icons: Record<string, typeof Brain> = {
  supervisor: Brain,
  retrieval: Search,
  negotiation: Handshake,
  compliance: Shield,
  executor: Zap,
};

const iconColors: Record<string, string> = {
  supervisor: "text-indigo-400",
  retrieval: "text-cyan-400",
  negotiation: "text-amber-400",
  compliance: "text-emerald-400",
  executor: "text-violet-400",
};

export function NodeConfigPanel({
  nodeId,
  nodeData,
  onUpdate,
  onClose,
  className,
}: NodeConfigPanelProps) {
  const [localConfig, setLocalConfig] = useState<Record<string, unknown>>({});

  useEffect(() => {
    if (nodeData) {
      setLocalConfig(nodeData.config || {});
    }
  }, [nodeData, nodeId]);

  if (!nodeId || !nodeData) return null;

  const fields = nodeConfigs[nodeData.type] || [];
  const Icon = icons[nodeData.type] || Sliders;

  const handleChange = (key: string, value: unknown) => {
    const updated = { ...localConfig, [key]: value };
    setLocalConfig(updated);
    onUpdate(nodeId, updated);
  };

  return (
    <div
      className={cn(
        "flex flex-col border-l border-white/[0.06] bg-[#0B0F19]/80 backdrop-blur-sm w-[300px] shrink-0",
        className
      )}
    >
      {/* Header */}
      <div className="px-4 py-3 border-b border-white/[0.06] flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Icon className={cn("w-4 h-4", iconColors[nodeData.type])} />
          <p className="text-sm font-semibold text-white/80">
            {nodeData.label}
          </p>
        </div>
        <button
          onClick={onClose}
          className="p-1 rounded-md hover:bg-white/[0.05] text-white/40 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Config Fields */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        <div className="text-[10px] text-white/30 uppercase tracking-widest font-medium mb-1">
          Parameters
        </div>

        {fields.map((field) => (
          <div key={field.key} className="space-y-1.5">
            <label className="text-[12px] font-medium text-white/60 flex items-center justify-between">
              {field.label}
              {field.type === "slider" && (
                <span className="text-[11px] text-indigo-400 font-mono tabular-nums">
                  {((localConfig[field.key] as number) ?? field.min ?? 0).toFixed(2)}
                </span>
              )}
            </label>

            {field.type === "number" && (
              <input
                type="number"
                min={field.min}
                max={field.max}
                value={(localConfig[field.key] as number) ?? ""}
                onChange={(e) => handleChange(field.key, parseFloat(e.target.value) || 0)}
                className="w-full px-3 py-2 rounded-lg border border-white/[0.08] bg-white/[0.03] text-sm text-white/90 focus:outline-none focus:border-indigo-500/40 transition-colors"
              />
            )}

            {field.type === "text" && (
              <input
                type="text"
                value={(localConfig[field.key] as string) ?? ""}
                onChange={(e) => handleChange(field.key, e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-white/[0.08] bg-white/[0.03] text-sm text-white/90 focus:outline-none focus:border-indigo-500/40 transition-colors"
              />
            )}

            {field.type === "select" && (
              <select
                value={(localConfig[field.key] as string) ?? field.options?.[0] ?? ""}
                onChange={(e) => handleChange(field.key, e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-white/[0.08] bg-[#111827] text-sm text-white/90 focus:outline-none focus:border-indigo-500/40 transition-colors cursor-pointer"
              >
                {field.options?.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt.charAt(0).toUpperCase() + opt.slice(1)}
                  </option>
                ))}
              </select>
            )}

            {field.type === "slider" && (
              <input
                type="range"
                min={field.min ?? 0}
                max={field.max ?? 1}
                step={field.step ?? 0.01}
                value={(localConfig[field.key] as number) ?? field.min ?? 0}
                onChange={(e) => handleChange(field.key, parseFloat(e.target.value))}
                className="w-full h-1.5 rounded-full appearance-none bg-white/[0.08] accent-indigo-500 cursor-pointer [&::-webkit-slider-thumb]:w-3.5 [&::-webkit-slider-thumb]:h-3.5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-indigo-500 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-[#111827]"
              />
            )}

            {field.type === "boolean" && (
              <button
                onClick={() => handleChange(field.key, !localConfig[field.key])}
                className={cn(
                  "relative w-10 h-5 rounded-full transition-colors duration-200",
                  localConfig[field.key] ? "bg-indigo-500" : "bg-white/[0.1]"
                )}
              >
                <div
                  className={cn(
                    "absolute top-0.5 w-4 h-4 rounded-full bg-white shadow-sm transition-transform duration-200",
                    localConfig[field.key] ? "translate-x-5" : "translate-x-0.5"
                  )}
                />
              </button>
            )}

            {field.description && (
              <p className="text-[10px] text-white/25">{field.description}</p>
            )}
          </div>
        ))}
      </div>

      {/* Node ID footer */}
      <div className="px-4 py-3 border-t border-white/[0.06]">
        <p className="text-[10px] text-white/20 font-mono truncate">
          ID: {nodeId}
        </p>
      </div>
    </div>
  );
}
