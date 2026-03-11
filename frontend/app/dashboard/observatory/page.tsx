"use client";

import { useState, useEffect } from "react";
import { mockWorkflows } from "@/lib/mock-data";
import { cn, formatDuration } from "@/lib/utils";
import {
  Brain,
  Search,
  Handshake,
  Shield,
  Play,
  CheckCircle,
  XCircle,
  Clock,
  ChevronRight,
  Activity,
  ArrowRight,
  Zap,
} from "lucide-react";
import type { Workflow, WorkflowNode } from "@/lib/types";
import { api } from "@/lib/api-client";
import { useAuth } from "@/lib/auth-context";

/* ── Agent icon mapping ── */
const agentIcons: Record<string, typeof Brain> = {
  Supervisor: Brain,
  "Retrieval Agent": Search,
  "Negotiation Agent": Handshake,
  "Compliance Agent": Shield,
  "Executor Agent": Play,
};

/* ── Per-agent detailed trace data ── */
function getTraceData(node: WorkflowNode, workflow: Workflow) {
  const agent = node.agent;
  switch (agent) {
    case "Supervisor":
      return {
        inputs: [{ label: "User Task", value: workflow.taskInput }],
        reasoning: `Classified intent as "${workflow.intent}". Routing to specialized agent pipeline based on task type.`,
        outputs: [
          { label: "Intent", value: workflow.intent },
          { label: "Pipeline", value: "Retrieval → Negotiation → Compliance → Executor" },
        ],
        duration: 450,
      };
    case "Retrieval Agent":
      return {
        inputs: [
          { label: "Query", value: workflow.taskInput },
          { label: "Source", value: "Qdrant Vector DB + Marketplace" },
        ],
        reasoning:
          "Performed semantic search across vendor database. Retrieved top matches ranked by relevance score. Cross-referenced with marketplace availability and delivery estimates.",
        outputs: [
          { label: "Vendor A", value: "$42.50/unit — Score: 0.88" },
          { label: "Vendor B", value: "$44.10/unit — Score: 0.82" },
          { label: "Vendor C", value: "$46.00/unit — Score: 0.74" },
          { label: "Vendor D", value: "$48.20/unit — Score: 0.65" },
        ],
        duration: 2200,
      };
    case "Negotiation Agent":
      return {
        inputs: [
          { label: "Candidates", value: "4 vendors" },
          { label: "Budget", value: "Cost-optimized" },
        ],
        reasoning: `Scoring formula: score = (price_weight × normalized_price) + (rating_weight × rating) + (delivery_weight × delivery_speed).\n\nVendor A Score → 0.88\nVendor B Score → 0.82\nVendor C Score → 0.74\n\nSelected Vendor A based on highest composite score.`,
        outputs: [
          { label: "Selected", value: "Vendor A" },
          { label: "Price", value: "$42.50/unit" },
          { label: "Savings", value: workflow.savings ? `$${workflow.savings}` : "N/A" },
        ],
        duration: 1800,
      };
    case "Compliance Agent":
      return {
        inputs: [
          { label: "Transaction", value: "Vendor A — $42.50/unit × 500" },
          { label: "Policies", value: "Budget, Vendor allow-list, Delivery SLA" },
        ],
        reasoning:
          "Validated transaction against 3 policy rules. Budget constraint: $25,000 ≤ $30,000 limit ✓. Vendor A is on the approved vendor list ✓. Delivery within 5 business days ✓.",
        outputs: [
          { label: "Budget Constraint", value: "✓ Passed", pass: true },
          { label: "Vendor Allowed", value: "✓ Passed", pass: true },
          { label: "Delivery Limit", value: "✓ Passed", pass: true },
        ],
        duration: 1000,
      };
    case "Executor Agent":
      return {
        inputs: [
          { label: "Vendor", value: "Vendor A" },
          { label: "Quantity", value: "500 units" },
          { label: "Price", value: "$42.50/unit" },
        ],
        reasoning:
          "Executed purchase order via vendor API. Transaction confirmed. Outcome recorded to billing ledger and outcome tracker.",
        outputs: [
          { label: "Status", value: "Transaction Completed" },
          { label: "Order ID", value: "PO-2026-001847" },
          { label: "Total", value: "$21,250" },
          { label: "Savings", value: workflow.savings ? `$${workflow.savings}` : "—" },
        ],
        duration: 1500,
      };
    default:
      return {
        inputs: [{ label: "Task", value: workflow.taskInput }],
        reasoning: node.output || "Processing…",
        outputs: [{ label: "Result", value: node.output || "—" }],
        duration: 1000,
      };
  }
}

const statusIcon = (status: string) => {
  switch (status) {
    case "completed":
      return <CheckCircle className="w-4 h-4 text-emerald-400" />;
    case "active":
      return <Activity className="w-4 h-4 text-indigo-400 animate-pulse" />;
    case "error":
      return <XCircle className="w-4 h-4 text-red-400" />;
    default:
      return <Clock className="w-4 h-4 text-zinc-500" />;
  }
};

export default function ObservatoryPage() {
  const { getToken } = useAuth();
  const [workflows, setWorkflows] = useState<Workflow[]>(mockWorkflows);

  useEffect(() => {
    const token = getToken();
    if (!token) return;
    api
      .listWorkflows(token)
      .then((d) => {
        if (d.workflows && d.workflows.length > 0) {
          const mapped: Workflow[] = d.workflows.map((w) => ({
            id: (w.id as string) || "",
            taskInput: (w.name as string) || (w.task_input as string) || "",
            intent: (w.intent as string) || "general",
            status: ((w.status as string) || "completed") as Workflow["status"],
            nodes: Array.isArray(w.nodes)
              ? (w.nodes as WorkflowNode[])
              : mockWorkflows[0].nodes,
            createdAt: (w.created_at as string) || new Date().toISOString(),
            completedAt: (w.completed_at as string) || undefined,
            duration: (w.duration as number) || undefined,
            userId: (w.user_id as string) || "",
            outcome: (w.outcome as string) || undefined,
            savings: (w.savings as number) || undefined,
          }));
          setWorkflows([...mapped, ...mockWorkflows]);
        }
      })
      .catch(() => {});
  }, [getToken]);

  const completedWorkflows = workflows.filter(
    (w) => w.status === "completed" || w.status === "failed",
  );
  const [selected, setSelected] = useState<Workflow>(completedWorkflows[0]);
  const [expandedNode, setExpandedNode] = useState<string | null>(
    completedWorkflows[0]?.nodes[0]?.id || null
  );

  const totalDuration = selected.nodes.reduce((sum, n) => {
    const trace = getTraceData(n, selected);
    return sum + trace.duration;
  }, 0);

  return (
    <div className="space-y-6">
      {/* ── Header ── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            AI Reasoning Observatory
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Inspect the internal reasoning trace of every workflow execution
          </p>
        </div>
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-white/[0.06] bg-white/[0.02] text-xs text-muted-foreground">
          <Zap className="w-3.5 h-3.5 text-indigo-400" />
          {completedWorkflows.length} traces available
        </div>
      </div>

      <div className="grid grid-cols-12 gap-6">
        {/* ── Workflow Selector ── */}
        <div className="col-span-3 space-y-2">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider px-1 mb-3">
            Workflow Traces
          </p>
          {completedWorkflows.map((wf) => (
            <button
              key={wf.id}
              onClick={() => {
                setSelected(wf);
                setExpandedNode(wf.nodes[0]?.id || null);
              }}
              className={cn(
                "w-full text-left px-4 py-3 rounded-xl border transition-all",
                selected.id === wf.id
                  ? "border-indigo-500/30 bg-indigo-500/[0.06]"
                  : "border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.04]"
              )}
            >
              <p className="text-sm font-medium truncate">{wf.taskInput}</p>
              <div className="flex items-center gap-2 mt-1.5">
                <span
                  className={cn(
                    "text-[10px] px-2 py-0.5 rounded-full border font-medium",
                    wf.status === "completed"
                      ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-400"
                      : "border-red-500/20 bg-red-500/10 text-red-400"
                  )}
                >
                  {wf.status}
                </span>
                <span className="text-[10px] text-muted-foreground">
                  {wf.duration ? formatDuration(wf.duration) : "—"}
                </span>
              </div>
            </button>
          ))}
        </div>

        {/* ── Trace Detail ── */}
        <div className="col-span-9 space-y-4">
          {/* Workflow summary bar */}
          <div className="flex items-center gap-4 px-5 py-3 rounded-xl border border-white/[0.06] bg-white/[0.02]">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{selected.taskInput}</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {selected.id} · {selected.nodes.length} agents · {totalDuration}ms total
              </p>
            </div>
            {selected.outcome && (
              <div className="shrink-0 flex items-center gap-2 px-3 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />
                <span className="text-xs text-emerald-400 font-medium">
                  {selected.outcome}
                </span>
              </div>
            )}
          </div>

          {/* Timeline bar */}
          <div className="flex items-center gap-1 h-2 rounded-full overflow-hidden bg-white/[0.04]">
            {selected.nodes.map((node, idx) => {
              const trace = getTraceData(node, selected);
              const widthPct = (trace.duration / totalDuration) * 100;
              const colors = [
                "bg-indigo-500",
                "bg-cyan-500",
                "bg-amber-500",
                "bg-emerald-500",
                "bg-orange-500",
              ];
              return (
                <div
                  key={node.id}
                  className={cn(
                    "h-full rounded-full transition-all",
                    colors[idx % colors.length],
                    node.status === "error" && "bg-red-500"
                  )}
                  style={{ width: `${widthPct}%` }}
                  title={`${node.agent}: ${trace.duration}ms`}
                />
              );
            })}
          </div>

          {/* Agent trace cards */}
          <div className="space-y-2">
            {selected.nodes.map((node, idx) => {
              const Icon = agentIcons[node.agent] || Brain;
              const trace = getTraceData(node, selected);
              const isExpanded = expandedNode === node.id;

              return (
                <div key={node.id}>
                  {/* Connector line */}
                  {idx > 0 && (
                    <div className="flex items-center justify-center py-1">
                      <div className="flex flex-col items-center gap-0.5">
                        <div className="w-[2px] h-3 bg-white/[0.08]" />
                        <ArrowRight className="w-3 h-3 text-white/20 rotate-90" />
                      </div>
                    </div>
                  )}

                  {/* Agent card */}
                  <button
                    onClick={() =>
                      setExpandedNode(isExpanded ? null : node.id)
                    }
                    className={cn(
                      "w-full text-left rounded-xl border transition-all",
                      isExpanded
                        ? "border-indigo-500/20 bg-indigo-500/[0.03]"
                        : "border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.03]"
                    )}
                  >
                    {/* Header row */}
                    <div className="flex items-center gap-3 px-5 py-3">
                      <div
                        className={cn(
                          "w-9 h-9 rounded-lg border flex items-center justify-center shrink-0",
                          node.status === "completed"
                            ? "border-emerald-500/20 bg-emerald-500/10"
                            : node.status === "error"
                            ? "border-red-500/20 bg-red-500/10"
                            : "border-indigo-500/20 bg-indigo-500/10"
                        )}
                      >
                        <Icon
                          className={cn(
                            "w-4 h-4",
                            node.status === "completed"
                              ? "text-emerald-400"
                              : node.status === "error"
                              ? "text-red-400"
                              : "text-indigo-400"
                          )}
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium">{node.agent}</p>
                        <p className="text-[11px] text-muted-foreground">
                          {trace.duration}ms
                          {node.output && ` · ${node.output}`}
                        </p>
                      </div>
                      {statusIcon(node.status)}
                      <ChevronRight
                        className={cn(
                          "w-4 h-4 text-muted-foreground transition-transform",
                          isExpanded && "rotate-90"
                        )}
                      />
                    </div>

                    {/* Expanded detail */}
                    {isExpanded && (
                      <div className="px-5 pb-4 pt-1 border-t border-white/[0.04] space-y-4">
                        {/* Inputs */}
                        <div>
                          <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-2">
                            Inputs
                          </p>
                          <div className="grid grid-cols-2 gap-2">
                            {trace.inputs.map((inp, i) => (
                              <div
                                key={i}
                                className="px-3 py-2 rounded-lg bg-white/[0.03] border border-white/[0.04]"
                              >
                                <p className="text-[10px] text-muted-foreground">
                                  {inp.label}
                                </p>
                                <p className="text-xs font-medium mt-0.5">
                                  {inp.value}
                                </p>
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* Reasoning */}
                        <div>
                          <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-2">
                            Reasoning
                          </p>
                          <div className="px-4 py-3 rounded-lg bg-[#0d1117] border border-white/[0.04] font-mono text-xs text-zinc-300 whitespace-pre-wrap leading-relaxed">
                            {trace.reasoning}
                          </div>
                        </div>

                        {/* Outputs */}
                        <div>
                          <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-2">
                            Outputs
                          </p>
                          <div className="grid grid-cols-2 gap-2">
                            {trace.outputs.map((out, i) => (
                              <div
                                key={i}
                                className={cn(
                                  "px-3 py-2 rounded-lg border",
                                  (out as { pass?: boolean }).pass
                                    ? "bg-emerald-500/[0.04] border-emerald-500/20"
                                    : "bg-white/[0.03] border-white/[0.04]"
                                )}
                              >
                                <p className="text-[10px] text-muted-foreground">
                                  {out.label}
                                </p>
                                <p
                                  className={cn(
                                    "text-xs font-medium mt-0.5",
                                    (out as { pass?: boolean }).pass &&
                                      "text-emerald-400"
                                  )}
                                >
                                  {out.value}
                                </p>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}
                  </button>
                </div>
              );
            })}
          </div>

          {/* Savings / outcome footer */}
          {selected.savings && (
            <div className="flex items-center justify-between px-5 py-3 rounded-xl border border-emerald-500/20 bg-emerald-500/[0.04]">
              <div className="flex items-center gap-2">
                <Zap className="w-4 h-4 text-emerald-400" />
                <span className="text-sm font-medium text-emerald-400">
                  Total Savings
                </span>
              </div>
              <span className="text-lg font-semibold text-emerald-400">
                ${selected.savings.toLocaleString()}
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
