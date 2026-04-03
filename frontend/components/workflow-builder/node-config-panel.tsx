"use client";

import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import {
  X,
  Brain,
  Search,
  Handshake,
  Sliders,
  Lightbulb,
  BarChart3,
  FileOutput,
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
  planner: [
    {
      key: "strategy",
      label: "Planning Strategy",
      type: "select",
      options: ["sequential", "parallel", "adaptive"],
      description: "How steps are organized",
    },
    {
      key: "maxRetries",
      label: "Max Retries",
      type: "number",
      min: 0,
      max: 10,
      description: "Retry attempts on failure",
    },
    {
      key: "timeout",
      label: "Timeout (s)",
      type: "number",
      min: 5,
      max: 300,
      description: "Max execution time",
    },
  ],
  web_search: [
    {
      key: "topK",
      label: "Top-K Results",
      type: "number",
      min: 1,
      max: 50,
      description: "Number of results to retrieve",
    },
    {
      key: "sources",
      label: "Data Sources",
      type: "select",
      options: ["all", "web", "internal", "marketplace"],
    },
    {
      key: "cacheEnabled",
      label: "Cache Results",
      type: "boolean",
      description: "Use semantic cache",
    },
  ],
  data_extraction: [
    {
      key: "format",
      label: "Output Format",
      type: "select",
      options: ["json", "table", "raw"],
      description: "Extraction output format",
    },
    {
      key: "maxItems",
      label: "Max Items",
      type: "number",
      min: 1,
      max: 100,
      description: "Max items to extract",
    },
  ],
  reasoning: [
    {
      key: "depth",
      label: "Reasoning Depth",
      type: "select",
      options: ["shallow", "medium", "deep"],
      description: "Depth of analysis",
    },
    {
      key: "showChain",
      label: "Show Chain-of-Thought",
      type: "boolean",
      description: "Include reasoning steps in output",
    },
  ],
  comparison: [
    {
      key: "criteria",
      label: "Comparison Criteria",
      type: "text",
      description: "Comma-separated criteria",
    },
    {
      key: "rankingMethod",
      label: "Ranking Method",
      type: "select",
      options: ["weighted", "pairwise", "score"],
      description: "How options are ranked",
    },
  ],
  result_generator: [
    {
      key: "outputFormat",
      label: "Output Format",
      type: "select",
      options: ["json", "summary", "detailed", "markdown"],
      description: "Final output format",
    },
    {
      key: "includeMetadata",
      label: "Include Metadata",
      type: "boolean",
      description: "Add execution metadata",
    },
  ],
};

const TYPE_ALIASES: Record<string, string> = {
  supervisor: "planner",
  retrieval: "web_search",
  negotiation: "data_extraction",
  compliance: "comparison",
  executor: "result_generator",
};

const resolveNodeType = (nodeType: string): string =>
  TYPE_ALIASES[nodeType] || nodeType;

const icons: Record<string, typeof Brain> = {
  planner: Brain,
  web_search: Search,
  data_extraction: Handshake,
  reasoning: Lightbulb,
  comparison: BarChart3,
  result_generator: FileOutput,
};

const iconColors: Record<string, string> = {
  planner: "text-indigo-400",
  web_search: "text-cyan-400",
  data_extraction: "text-amber-400",
  reasoning: "text-emerald-400",
  comparison: "text-violet-400",
  result_generator: "text-orange-400",
};

export function NodeConfigPanel({
  nodeId,
  nodeData,
  onUpdate,
  onClose,
  className,
}: NodeConfigPanelProps) {
  const [localConfig, setLocalConfig] = useState<Record<string, unknown>>({});
  const [customKey, setCustomKey] = useState("");
  const [customValue, setCustomValue] = useState("");

  useEffect(() => {
    if (nodeData) {
      setLocalConfig(nodeData.config || {});
    }
  }, [nodeData, nodeId]);

  if (!nodeId || !nodeData) return null;

  const resolvedType = resolveNodeType(nodeData.type);
  const fields = nodeConfigs[resolvedType] || [];
  const Icon = icons[resolvedType] || Sliders;
  const iconColor = iconColors[resolvedType] || "text-zinc-400";

  const customFields: FieldConfig[] = Object.keys(localConfig)
    .filter((key) => !fields.some((f) => f.key === key))
    .map(
      (key): FieldConfig => ({
        key,
        label: key,
        type:
          typeof localConfig[key] === "boolean"
            ? "boolean"
            : typeof localConfig[key] === "number"
              ? "number"
              : "text",
        description: "Custom parameter",
      }),
    );

  const handleChange = (key: string, value: unknown) => {
    const updated = { ...localConfig, [key]: value };
    setLocalConfig(updated);
    onUpdate(nodeId, updated);
  };

  const parseCustomValue = (value: string): unknown => {
    const trimmed = value.trim();
    if (!trimmed) return "";
    if (trimmed === "true") return true;
    if (trimmed === "false") return false;
    const asNum = Number(trimmed);
    if (!Number.isNaN(asNum) && trimmed.match(/^-?\d+(\.\d+)?$/)) {
      return asNum;
    }
    return trimmed;
  };

  const addCustomParam = () => {
    const key = customKey.trim();
    if (!key) return;
    const updated = {
      ...localConfig,
      [key]: parseCustomValue(customValue),
    };
    setLocalConfig(updated);
    onUpdate(nodeId, updated);
    setCustomKey("");
    setCustomValue("");
  };

  const removeCustomParam = (key: string) => {
    const updated = { ...localConfig };
    delete updated[key];
    setLocalConfig(updated);
    onUpdate(nodeId, updated);
  };

  const allFields = [...fields, ...customFields];

  return (
    <div
      className={cn(
        "flex flex-col border-l border-white/[0.06] bg-[#0B0F19]/80 backdrop-blur-sm w-[300px] shrink-0",
        className,
      )}
    >
      {/* Header */}
      <div className="px-4 py-3 border-b border-white/[0.06] flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Icon className={cn("w-4 h-4", iconColor)} />
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

        {allFields.length === 0 && (
          <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-3 text-xs text-muted-foreground">
            No predefined parameters for this node type. Add custom parameters
            below.
          </div>
        )}

        {allFields.map((field) => (
          <div key={field.key} className="space-y-1.5">
            <label className="text-[12px] font-medium text-white/60 flex items-center justify-between">
              {field.label}
              {field.type === "slider" && (
                <span className="text-[11px] text-indigo-400 font-mono tabular-nums">
                  {(
                    (localConfig[field.key] as number) ??
                    field.min ??
                    0
                  ).toFixed(2)}
                </span>
              )}
            </label>

            {field.type === "number" && (
              <input
                type="number"
                min={field.min}
                max={field.max}
                value={(localConfig[field.key] as number) ?? ""}
                onChange={(e) =>
                  handleChange(field.key, parseFloat(e.target.value) || 0)
                }
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
                value={
                  (localConfig[field.key] as string) ?? field.options?.[0] ?? ""
                }
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
                onChange={(e) =>
                  handleChange(field.key, parseFloat(e.target.value))
                }
                className="w-full h-1.5 rounded-full appearance-none bg-white/[0.08] accent-indigo-500 cursor-pointer [&::-webkit-slider-thumb]:w-3.5 [&::-webkit-slider-thumb]:h-3.5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-indigo-500 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-[#111827]"
              />
            )}

            {field.type === "boolean" && (
              <button
                onClick={() => handleChange(field.key, !localConfig[field.key])}
                className={cn(
                  "relative w-10 h-5 rounded-full transition-colors duration-200",
                  localConfig[field.key] ? "bg-indigo-500" : "bg-white/[0.1]",
                )}
              >
                <div
                  className={cn(
                    "absolute top-0.5 w-4 h-4 rounded-full bg-white shadow-sm transition-transform duration-200",
                    localConfig[field.key]
                      ? "translate-x-5"
                      : "translate-x-0.5",
                  )}
                />
              </button>
            )}

            {field.description && (
              <p className="text-[10px] text-white/25 flex items-center justify-between gap-2">
                <span>{field.description}</span>
                {customFields.some((f) => f.key === field.key) && (
                  <button
                    onClick={() => removeCustomParam(field.key)}
                    className="text-[10px] text-red-300/80 hover:text-red-200"
                  >
                    Remove
                  </button>
                )}
              </p>
            )}
          </div>
        ))}

        <div className="pt-2 border-t border-white/[0.06] space-y-2">
          <p className="text-[10px] text-white/30 uppercase tracking-wider">
            Add Custom Parameter
          </p>
          <input
            type="text"
            value={customKey}
            onChange={(e) => setCustomKey(e.target.value)}
            placeholder="key (e.g. max_tokens)"
            className="w-full px-3 py-2 rounded-lg border border-white/[0.08] bg-white/[0.03] text-xs text-white/90 focus:outline-none focus:border-indigo-500/40"
          />
          <input
            type="text"
            value={customValue}
            onChange={(e) => setCustomValue(e.target.value)}
            placeholder="value (supports number/true/false/text)"
            className="w-full px-3 py-2 rounded-lg border border-white/[0.08] bg-white/[0.03] text-xs text-white/90 focus:outline-none focus:border-indigo-500/40"
          />
          <button
            onClick={addCustomParam}
            className="w-full px-3 py-2 rounded-lg border border-indigo-500/30 bg-indigo-500/10 text-indigo-300 text-xs font-medium hover:bg-indigo-500/20 transition-colors"
          >
            Add Parameter
          </button>
        </div>
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
