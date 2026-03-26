"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { useNodesState, useEdgesState, type Node, type Edge } from "reactflow";
import { cn } from "@/lib/utils";
import {
  Play,
  Square,
  Save,
  Download,
  Upload,
  RotateCcw,
  CheckCircle,
  AlertCircle,
  Loader2,
  Clock,
  Brain,
  Search,
  Handshake,
  Shield,
  Zap,
  FileJson,
  FolderOpen,
  Trash2,
} from "lucide-react";
import {
  WorkflowCanvas,
  NodeSidebar,
  NodeConfigPanel,
  makeNodeId,
} from "@/components/workflow-builder";
import type { BuilderNodeData } from "@/components/workflow-builder";
import type { AnimatedEdgeData } from "@/components/workflow-builder";
import { api } from "@/lib/api-client";
import { useAuth } from "@/lib/auth-context";

// Helper to cast node data
type BNode = Node & { data: BuilderNodeData };
const asB = (n: Node): BNode => n as BNode;
const getWorkflowId = (wf: Record<string, unknown>): string =>
  ((wf.workflow_id as string) || (wf.id as string) || "").trim();

// ── Execution Simulation ──

type ExecStatus = "idle" | "running" | "completed" | "error";

interface ExecLog {
  nodeId: string;
  label: string;
  type: string;
  status: "completed" | "error";
  message: string;
  duration: number;
}

const agentIcons: Record<string, typeof Brain> = {
  supervisor: Brain,
  retrieval: Search,
  negotiation: Handshake,
  compliance: Shield,
  executor: Zap,
};

// ── Page ──

export default function WorkflowsPage() {
  const { getToken } = useAuth();
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [workflowName, setWorkflowName] = useState("Untitled Workflow");
  const [execStatus, setExecStatus] = useState<ExecStatus>("idle");
  const [execLogs, setExecLogs] = useState<ExecLog[]>([]);
  const [showLogs, setShowLogs] = useState(false);
  const execAbort = useRef(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [savedWorkflows, setSavedWorkflows] = useState<
    Record<string, unknown>[]
  >([]);
  const [activeWorkflowId, setActiveWorkflowId] = useState<string | null>(null);
  const [showSaved, setShowSaved] = useState(false);
  const [saving, setSaving] = useState(false);

  // Fetch saved workflows from API
  const fetchWorkflows = useCallback(async () => {
    const token = getToken();
    if (!token) return;
    try {
      const data = await api.listWorkflows(token);
      setSavedWorkflows(data.workflows ?? []);
    } catch {}
  }, [getToken]);

  useEffect(() => {
    fetchWorkflows();
  }, [fetchWorkflows]);

  // Save workflow to API
  const saveToBackend = useCallback(async () => {
    const token = getToken();
    if (!token) return;
    setSaving(true);
    try {
      const graphJson = {
        nodes: nodes.map((n) => {
          const d = asB(n).data;
          return {
            id: n.id,
            type: d.type,
            label: d.label,
            position: n.position,
            config: d.config,
          };
        }),
        edges: edges.map((e) => ({
          id: e.id,
          source: e.source,
          target: e.target,
        })),
      };
      if (activeWorkflowId) {
        await api.updateWorkflow(token, activeWorkflowId, {
          name: workflowName,
          graph_json: graphJson,
        });
      } else {
        const result = await api.createWorkflow(token, workflowName, graphJson);
        const wf = result.workflow;
        setActiveWorkflowId(getWorkflowId(wf) || null);
      }
      await fetchWorkflows();
    } catch (err) {
      console.error("Save failed:", err);
    } finally {
      setSaving(false);
    }
  }, [getToken, nodes, edges, workflowName, activeWorkflowId, fetchWorkflows]);

  // Load a saved workflow
  const loadWorkflow = useCallback(
    (wf: Record<string, unknown>) => {
      setActiveWorkflowId(getWorkflowId(wf));
      setWorkflowName((wf.name as string) || "Workflow");
      const graph = wf.graph_json as Record<string, unknown> | undefined;
      if (graph?.nodes && graph?.edges) {
        const gNodes = graph.nodes as {
          id: string;
          type: string;
          label: string;
          position: { x: number; y: number };
          config?: Record<string, unknown>;
        }[];
        const gEdges = graph.edges as {
          id: string;
          source: string;
          target: string;
        }[];
        setNodes(
          gNodes.map((n) => ({
            id: n.id,
            type: "builderNode",
            position: n.position,
            data: {
              type: n.type,
              label: n.label,
              status: "idle",
              config: n.config || {},
            },
          })),
        );
        setEdges(
          gEdges.map((e) => ({
            id: e.id,
            source: e.source,
            target: e.target,
            type: "animatedEdge",
            data: { status: "idle" },
          })),
        );
      }
      setShowSaved(false);
      setExecStatus("idle");
      setExecLogs([]);
    },
    [setNodes, setEdges],
  );

  // Delete a saved workflow
  const deleteWorkflow = useCallback(
    async (id: string) => {
      const token = getToken();
      if (!token) return;
      try {
        await api.deleteWorkflow(token, id);
        if (activeWorkflowId === id) setActiveWorkflowId(null);
        await fetchWorkflows();
      } catch {}
    },
    [getToken, activeWorkflowId, fetchWorkflows],
  );

  const selectedNode = nodes.find((n) => n.id === selectedNodeId) ?? null;
  const selectedData = selectedNode ? asB(selectedNode).data : null;

  // ── Node Config Update ──
  const handleConfigUpdate = useCallback(
    (nodeId: string, config: Record<string, unknown>) => {
      setNodes((nds) =>
        nds.map((n) =>
          n.id === nodeId ? { ...n, data: { ...n.data, config } } : n,
        ),
      );
    },
    [setNodes],
  );

  // ── Topological Sort (for execution order) ──
  const topoSort = useCallback((): BNode[] => {
    const adj = new Map<string, string[]>();
    const inDeg = new Map<string, number>();
    nodes.forEach((n) => {
      adj.set(n.id, []);
      inDeg.set(n.id, 0);
    });
    edges.forEach((e) => {
      adj.get(e.source)?.push(e.target);
      inDeg.set(e.target, (inDeg.get(e.target) || 0) + 1);
    });
    const queue = nodes
      .filter((n) => (inDeg.get(n.id) || 0) === 0)
      .map((n) => n.id);
    const order: string[] = [];
    while (queue.length) {
      const id = queue.shift()!;
      order.push(id);
      for (const next of adj.get(id) || []) {
        inDeg.set(next, (inDeg.get(next) || 0) - 1);
        if (inDeg.get(next) === 0) queue.push(next);
      }
    }
    const idxMap = new Map(order.map((id, i) => [id, i]));
    return [...nodes]
      .sort((a, b) => (idxMap.get(a.id) ?? 0) - (idxMap.get(b.id) ?? 0))
      .map(asB);
  }, [nodes, edges]);

  // ── Run Workflow ──
  const runWorkflow = useCallback(async () => {
    if (nodes.length === 0) return;
    execAbort.current = false;
    setExecStatus("running");
    setExecLogs([]);
    setShowLogs(true);

    // Reset all nodes & edges
    setNodes((nds) =>
      nds.map((n) => ({ ...n, data: { ...n.data, status: "idle" as const } })),
    );
    setEdges((eds) =>
      eds.map((e) => ({ ...e, data: { ...e.data, status: "idle" as const } })),
    );

    const sorted = topoSort();

    for (const node of sorted) {
      if (execAbort.current) break;

      // Mark node active
      setNodes((nds) =>
        nds.map((n) =>
          n.id === node.id
            ? { ...n, data: { ...n.data, status: "active" as const } }
            : n,
        ),
      );

      // Mark incoming edges as flowing
      setEdges((eds) =>
        eds.map((e) =>
          e.target === node.id
            ? { ...e, data: { ...e.data, status: "flowing" as const } }
            : e,
        ),
      );

      // Simulated execution delay (800-2200ms)
      const duration = 800 + Math.random() * 1400;
      await new Promise((r) => setTimeout(r, duration));

      if (execAbort.current) break;

      // Mark completed
      const success = Math.random() > 0.08; // 92% success rate
      setNodes((nds) =>
        nds.map((n) =>
          n.id === node.id
            ? {
                ...n,
                data: {
                  ...n.data,
                  status: success ? ("completed" as const) : ("error" as const),
                },
              }
            : n,
        ),
      );

      // Mark incoming edges completed
      setEdges((eds) =>
        eds.map((e) =>
          e.target === node.id
            ? { ...e, data: { ...e.data, status: "completed" as const } }
            : e,
        ),
      );

      setExecLogs((prev) => [
        ...prev,
        {
          nodeId: node.id,
          label: node.data.label,
          type: node.data.type,
          status: success ? "completed" : "error",
          message: success
            ? `${node.data.label} completed successfully`
            : `${node.data.label} encountered an error`,
          duration: Math.round(duration),
        },
      ]);

      if (!success) {
        setExecStatus("error");
        return;
      }
    }

    if (!execAbort.current) setExecStatus("completed");
  }, [nodes, edges, topoSort, setNodes, setEdges]);

  const stopWorkflow = useCallback(() => {
    execAbort.current = true;
    setExecStatus("idle");
    setNodes((nds) =>
      nds.map((n) => ({ ...n, data: { ...n.data, status: "idle" as const } })),
    );
    setEdges((eds) =>
      eds.map((e) => ({ ...e, data: { ...e.data, status: "idle" as const } })),
    );
  }, [setNodes, setEdges]);

  const resetWorkflow = useCallback(() => {
    execAbort.current = true;
    setExecStatus("idle");
    setExecLogs([]);
    setNodes((nds) =>
      nds.map((n) => ({ ...n, data: { ...n.data, status: "idle" as const } })),
    );
    setEdges((eds) =>
      eds.map((e) => ({ ...e, data: { ...e.data, status: "idle" as const } })),
    );
  }, [setNodes, setEdges]);

  // ── JSON Export / Import ──
  const exportWorkflow = useCallback(() => {
    const data = {
      name: workflowName,
      version: "1.0",
      exportedAt: new Date().toISOString(),
      nodes: nodes.map((n) => {
        const d = asB(n).data;
        return {
          id: n.id,
          type: d.type,
          label: d.label,
          position: n.position,
          config: d.config,
        };
      }),
      edges: edges.map((e) => ({
        id: e.id,
        source: e.source,
        target: e.target,
      })),
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${workflowName.replace(/\s+/g, "_").toLowerCase()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [nodes, edges, workflowName]);

  const importWorkflow = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (ev) => {
        try {
          const data = JSON.parse(ev.target?.result as string);
          if (!data?.nodes || !data?.edges) return;
          setWorkflowName(data.name || "Imported Workflow");
          setNodes(
            data.nodes.map(
              (n: {
                id: string;
                type: string;
                label: string;
                position: { x: number; y: number };
                config: Record<string, unknown>;
              }) => ({
                id: n.id,
                type: "builderNode",
                position: n.position,
                data: {
                  type: n.type,
                  label: n.label,
                  status: "idle",
                  config: n.config || {},
                },
              }),
            ),
          );
          setEdges(
            data.edges.map(
              (e: { id: string; source: string; target: string }) => ({
                id: e.id,
                source: e.source,
                target: e.target,
                type: "animatedEdge",
                data: { status: "idle" },
              }),
            ),
          );
          setExecStatus("idle");
          setExecLogs([]);
        } catch {
          // Invalid JSON
        }
      };
      reader.readAsText(file);
      // Reset input
      if (fileInputRef.current) fileInputRef.current.value = "";
    },
    [setNodes, setEdges],
  );

  // ── Preloaded Demo Workflow ──
  useEffect(() => {
    const demoNodes: Node[] = [
      {
        id: "demo_sup",
        type: "builderNode",
        position: { x: 100, y: 200 },
        data: {
          type: "supervisor",
          label: "Supervisor",
          status: "idle",
          config: { strategy: "sequential", maxRetries: 2, timeout: 60 },
        },
      },
      {
        id: "demo_ret",
        type: "builderNode",
        position: { x: 400, y: 80 },
        data: {
          type: "retrieval",
          label: "Retrieval",
          status: "idle",
          config: {
            topK: 10,
            similarityThreshold: 0.75,
            sources: "all",
            cacheEnabled: true,
          },
        },
      },
      {
        id: "demo_neg",
        type: "builderNode",
        position: { x: 400, y: 320 },
        data: {
          type: "negotiation",
          label: "Negotiation",
          status: "idle",
          config: {
            priceWeight: 0.5,
            ratingWeight: 0.3,
            deliveryWeight: 0.2,
            maxRounds: 3,
          },
        },
      },
      {
        id: "demo_comp",
        type: "builderNode",
        position: { x: 720, y: 200 },
        data: {
          type: "compliance",
          label: "Compliance",
          status: "idle",
          config: { strictMode: false, ruleSet: "default", budgetLimit: 50000 },
        },
      },
      {
        id: "demo_exec",
        type: "builderNode",
        position: { x: 1000, y: 200 },
        data: {
          type: "executor",
          label: "Executor",
          status: "idle",
          config: {
            executionMode: "confirm",
            rollbackEnabled: true,
            notifyOnComplete: true,
          },
        },
      },
    ];
    const demoEdges: Edge[] = [
      {
        id: "e1",
        source: "demo_sup",
        target: "demo_ret",
        type: "animatedEdge",
        data: { status: "idle" },
      },
      {
        id: "e2",
        source: "demo_sup",
        target: "demo_neg",
        type: "animatedEdge",
        data: { status: "idle" },
      },
      {
        id: "e3",
        source: "demo_ret",
        target: "demo_comp",
        type: "animatedEdge",
        data: { status: "idle" },
      },
      {
        id: "e4",
        source: "demo_neg",
        target: "demo_comp",
        type: "animatedEdge",
        data: { status: "idle" },
      },
      {
        id: "e5",
        source: "demo_comp",
        target: "demo_exec",
        type: "animatedEdge",
        data: { status: "idle" },
      },
    ];
    setNodes(demoNodes);
    setEdges(demoEdges);
  }, [setNodes, setEdges]);

  return (
    <div className="h-[calc(100vh-4rem)] flex flex-col -m-6">
      {/* ─── Top Bar ─── */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-white/[0.06] bg-[#0B0F19]/90 backdrop-blur-sm shrink-0">
        <div className="flex items-center gap-4">
          {/* Workflow Name */}
          <input
            type="text"
            value={workflowName}
            onChange={(e) => setWorkflowName(e.target.value)}
            className="text-[15px] font-semibold bg-transparent border-none outline-none text-white/90 focus:text-white w-[200px] placeholder:text-white/30"
            placeholder="Workflow name..."
          />

          {/* Node count badge */}
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white/[0.04] border border-white/[0.06]">
            <div className="w-1.5 h-1.5 rounded-full bg-indigo-400" />
            <span className="text-[11px] text-white/50">
              {nodes.length} node{nodes.length !== 1 ? "s" : ""}
            </span>
          </div>

          {/* Exec status */}
          {execStatus !== "idle" && (
            <div
              className={cn(
                "flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-medium",
                execStatus === "running" && "bg-indigo-500/10 text-indigo-400",
                execStatus === "completed" &&
                  "bg-emerald-500/10 text-emerald-400",
                execStatus === "error" && "bg-red-500/10 text-red-400",
              )}
            >
              {execStatus === "running" && (
                <Loader2 className="w-3 h-3 animate-spin" />
              )}
              {execStatus === "completed" && (
                <CheckCircle className="w-3 h-3" />
              )}
              {execStatus === "error" && <AlertCircle className="w-3 h-3" />}
              {execStatus === "running" && "Running..."}
              {execStatus === "completed" && "Completed"}
              {execStatus === "error" && "Error"}
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* Import */}
          <input
            ref={fileInputRef}
            type="file"
            accept=".json"
            className="hidden"
            onChange={importWorkflow}
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            className="p-2 rounded-lg hover:bg-white/[0.05] text-white/40 hover:text-white/60 transition-colors"
            title="Import workflow"
          >
            <Upload className="w-4 h-4" />
          </button>

          {/* Export */}
          <button
            onClick={exportWorkflow}
            disabled={nodes.length === 0}
            className="p-2 rounded-lg hover:bg-white/[0.05] text-white/40 hover:text-white/60 transition-colors disabled:opacity-30"
            title="Export JSON"
          >
            <Download className="w-4 h-4" />
          </button>

          {/* Save to API */}
          <button
            onClick={saveToBackend}
            disabled={nodes.length === 0 || saving}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-indigo-500/30 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-300 hover:text-indigo-200 text-[12px] font-medium transition-colors disabled:opacity-30"
          >
            {saving ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Save className="w-3.5 h-3.5" />
            )}
            {activeWorkflowId ? "Update" : "Save"}
          </button>

          {/* Load saved */}
          <button
            onClick={() => setShowSaved(!showSaved)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-white/[0.08] hover:bg-white/[0.04] text-white/50 hover:text-white/70 text-[12px] font-medium transition-colors"
          >
            <FolderOpen className="w-3.5 h-3.5" />
            Load {savedWorkflows.length > 0 && `(${savedWorkflows.length})`}
          </button>

          {/* JSON View */}
          <button
            onClick={() => {
              const json = JSON.stringify(
                {
                  nodes: nodes.map((n) => {
                    const d = asB(n).data;
                    return {
                      id: n.id,
                      type: d.type,
                      label: d.label,
                      config: d.config,
                    };
                  }),
                  edges: edges.map((e) => ({
                    source: e.source,
                    target: e.target,
                  })),
                },
                null,
                2,
              );
              navigator.clipboard.writeText(json);
            }}
            disabled={nodes.length === 0}
            className="p-2 rounded-lg hover:bg-white/[0.05] text-white/40 hover:text-white/60 transition-colors disabled:opacity-30"
            title="Copy JSON to clipboard"
          >
            <FileJson className="w-4 h-4" />
          </button>

          <div className="w-px h-6 bg-white/[0.06] mx-1" />

          {/* Reset */}
          <button
            onClick={resetWorkflow}
            className="p-2 rounded-lg hover:bg-white/[0.05] text-white/40 hover:text-white/60 transition-colors"
            title="Reset execution"
          >
            <RotateCcw className="w-4 h-4" />
          </button>

          {/* Run / Stop */}
          {execStatus === "running" ? (
            <button
              onClick={stopWorkflow}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white text-[13px] font-medium transition-all shadow-lg shadow-red-600/20"
            >
              <Square className="w-3.5 h-3.5" />
              Stop
            </button>
          ) : (
            <button
              onClick={runWorkflow}
              disabled={nodes.length === 0}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-[13px] font-medium transition-all shadow-lg shadow-indigo-600/20 disabled:opacity-50 disabled:pointer-events-none"
            >
              <Play className="w-3.5 h-3.5" />
              Run Workflow
            </button>
          )}
        </div>
      </div>

      {/* ─── Builder Layout: Sidebar | Canvas | Config Panel ─── */}
      <div className="flex flex-1 overflow-hidden relative">
        {/* Saved Workflows Panel */}
        {showSaved && (
          <div className="absolute top-0 right-0 z-20 w-72 max-h-80 bg-[#0d1117] border border-white/[0.08] rounded-bl-xl overflow-y-auto shadow-2xl">
            <div className="px-4 py-3 border-b border-white/[0.06] flex items-center justify-between sticky top-0 bg-[#0d1117] z-10">
              <span className="text-xs font-semibold">Saved Workflows</span>
              <button
                onClick={() => setShowSaved(false)}
                className="text-muted-foreground hover:text-foreground"
              >
                <Zap className="w-3.5 h-3.5" />
              </button>
            </div>
            {savedWorkflows.length === 0 ? (
              <p className="px-4 py-6 text-xs text-muted-foreground text-center">
                No saved workflows yet.
              </p>
            ) : (
              savedWorkflows.map((wf) => (
                <div
                  key={getWorkflowId(wf)}
                  className={cn(
                    "flex items-center justify-between px-4 py-2.5 border-b border-white/[0.03] hover:bg-white/[0.03] transition-colors cursor-pointer",
                    activeWorkflowId === getWorkflowId(wf) &&
                      "bg-indigo-500/5 border-l-2 border-l-indigo-500",
                  )}
                >
                  <button
                    onClick={() => loadWorkflow(wf)}
                    className="flex-1 text-left"
                  >
                    <p className="text-xs font-medium truncate">
                      {(wf.name as string) || "Untitled"}
                    </p>
                    <p className="text-[10px] text-muted-foreground">
                      {getWorkflowId(wf)?.slice(0, 12)}...
                    </p>
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteWorkflow(getWorkflowId(wf));
                    }}
                    className="p-1 text-muted-foreground hover:text-red-400 transition-colors"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              ))
            )}
          </div>
        )}

        <NodeSidebar />

        <div className="flex-1 relative">
          <WorkflowCanvas
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            setNodes={setNodes}
            setEdges={setEdges}
            onNodeSelect={setSelectedNodeId}
          />

          {/* ─── Execution Log Drawer ─── */}
          {showLogs && execLogs.length > 0 && (
            <div className="absolute bottom-0 left-0 right-0 bg-[#0B0F19]/95 backdrop-blur-md border-t border-white/[0.06] max-h-[200px] overflow-y-auto">
              <div className="flex items-center justify-between px-4 py-2 border-b border-white/[0.04] sticky top-0 bg-[#0B0F19]/95 backdrop-blur-md z-10">
                <div className="flex items-center gap-2">
                  <Clock className="w-3.5 h-3.5 text-indigo-400" />
                  <span className="text-[11px] font-semibold text-white/60 uppercase tracking-widest">
                    Execution Log
                  </span>
                </div>
                <button
                  onClick={() => setShowLogs(false)}
                  className="text-[10px] text-white/30 hover:text-white/50 transition-colors px-2 py-1 rounded"
                >
                  Hide
                </button>
              </div>
              <div className="p-3 space-y-1.5">
                {execLogs.map((log, i) => {
                  const Icon = agentIcons[log.type] || Brain;
                  return (
                    <div
                      key={i}
                      className="flex items-center gap-3 px-3 py-2 rounded-lg bg-white/[0.02]"
                    >
                      <div
                        className={cn(
                          "w-5 h-5 rounded flex items-center justify-center shrink-0",
                          log.status === "completed"
                            ? "bg-emerald-500/10"
                            : "bg-red-500/10",
                        )}
                      >
                        {log.status === "completed" ? (
                          <CheckCircle className="w-3 h-3 text-emerald-400" />
                        ) : (
                          <AlertCircle className="w-3 h-3 text-red-400" />
                        )}
                      </div>
                      <Icon className="w-3.5 h-3.5 text-white/30 shrink-0" />
                      <span className="text-[12px] text-white/70 flex-1">
                        {log.message}
                      </span>
                      <span className="text-[10px] text-white/25 font-mono tabular-nums">
                        {log.duration}ms
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {selectedNode && (
          <NodeConfigPanel
            nodeId={selectedNodeId}
            nodeData={selectedData}
            onUpdate={handleConfigUpdate}
            onClose={() => setSelectedNodeId(null)}
          />
        )}
      </div>
    </div>
  );
}
