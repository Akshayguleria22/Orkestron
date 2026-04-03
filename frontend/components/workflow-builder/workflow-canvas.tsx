"use client";

import {
  useCallback,
  useRef,
  useMemo,
  type DragEvent,
  type MouseEvent as ReactMouseEvent,
} from "react";
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  addEdge,
  useNodesState,
  useEdgesState,
  type Node,
  type Edge,
  type Connection,
  type ReactFlowInstance,
  type OnSelectionChangeParams,
  MarkerType,
  Position,
  SelectionMode,
} from "reactflow";
import "reactflow/dist/style.css";
import { cn } from "@/lib/utils";
import { BuilderNode, type BuilderNodeData } from "./builder-node";
import { AnimatedEdge, type AnimatedEdgeData } from "./animated-edge";
import type { NodeTemplate } from "./node-sidebar";


interface WorkflowCanvasProps {
  nodes: Node[];
  edges: Edge[];
  onNodesChange: ReturnType<typeof useNodesState>[2];
  onEdgesChange: ReturnType<typeof useEdgesState>[2];
  setNodes: ReturnType<typeof useNodesState>[1];
  setEdges: ReturnType<typeof useEdgesState>[1];
  onNodeSelect: (nodeId: string | null) => void;
  className?: string;
}

let nodeIdCounter = 0;

export function makeNodeId() {
  nodeIdCounter += 1;
  return `node_${Date.now()}_${nodeIdCounter}`;
}

export function WorkflowCanvas({
  nodes,
  edges,
  onNodesChange,
  onEdgesChange,
  setNodes,
  setEdges,
  onNodeSelect,
  className,
}: WorkflowCanvasProps) {
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const rfInstance = useRef<ReactFlowInstance | null>(null);

  const nodeTypes = useMemo(() => ({ builderNode: BuilderNode }), []);
  const edgeTypes = useMemo(() => ({ animatedEdge: AnimatedEdge }), []);

  const onConnect = useCallback(
    (params: Connection) => {
      setEdges((eds) =>
        addEdge(
          {
            ...params,
            type: "animatedEdge",
            data: { status: "idle" } as AnimatedEdgeData,
            markerEnd: {
              type: MarkerType.ArrowClosed,
              color: "rgba(255,255,255,0.15)",
              width: 14,
              height: 14,
            },
          },
          eds
        )
      );
    },
    [setEdges]
  );

  const onDragOver = useCallback((e: DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  }, []);

  const onDrop = useCallback(
    (e: DragEvent) => {
      e.preventDefault();

      const raw = e.dataTransfer.getData("application/orkestron-node");
      if (!raw || !rfInstance.current) return;

      let template: NodeTemplate;
      try {
        template = JSON.parse(raw);
      } catch {
        return;
      }

      const bounds = reactFlowWrapper.current?.getBoundingClientRect();
      if (!bounds) return;

      const position = rfInstance.current.project({
        x: e.clientX - bounds.left,
        y: e.clientY - bounds.top,
      });

      const newNode: Node<BuilderNodeData> = {
        id: makeNodeId(),
        type: "builderNode",
        position,
        sourcePosition: Position.Right,
        targetPosition: Position.Left,
        data: {
          type: template.type,
          label: template.label,
          status: "idle",
          config: {},
        },
      };

      setNodes((nds) => nds.concat(newNode));
    },
    [setNodes]
  );

  const onSelectionChange = useCallback(
    (params: OnSelectionChangeParams) => {
      if (params.nodes.length === 1) {
        onNodeSelect(params.nodes[0].id);
      } else {
        onNodeSelect(null);
      }
    },
    [onNodeSelect]
  );

  const onPaneClick = useCallback(
    (_: ReactMouseEvent) => {
      onNodeSelect(null);
    },
    [onNodeSelect]
  );

  return (
    <div
      ref={reactFlowWrapper}
      className={cn("flex-1 h-full", className)}
    >
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onDragOver={onDragOver}
        onDrop={onDrop}
        onInit={(instance) => {
          rfInstance.current = instance;
        }}
        onSelectionChange={onSelectionChange}
        onPaneClick={onPaneClick}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        defaultEdgeOptions={{
          type: "animatedEdge",
          animated: false,
        }}
        fitView
        fitViewOptions={{ padding: 0.4 }}
        proOptions={{ hideAttribution: true }}
        className="!bg-transparent"
        minZoom={0.2}
        maxZoom={2}
        panOnScroll
        selectionOnDrag
        selectionMode={SelectionMode.Partial}
        multiSelectionKeyCode="Shift"
        deleteKeyCode="Delete"
        snapToGrid
        snapGrid={[20, 20]}
      >
        <Background
          color="rgba(99,102,241,0.04)"
          gap={20}
          size={1}
        />
        <Controls
          className="!bg-[#111827] !border-white/[0.08] !rounded-xl !shadow-lg [&>button]:!bg-transparent [&>button]:!border-white/[0.06] [&>button]:!text-zinc-400 [&>button:hover]:!bg-white/[0.06] [&>button]:!rounded-lg"
          showInteractive={false}
        />
        <MiniMap
          nodeStrokeWidth={3}
          maskColor="rgba(11,15,25,0.85)"
          style={{
            backgroundColor: "#111827",
            borderRadius: 12,
            border: "1px solid rgba(255,255,255,0.06)",
          }}
          nodeColor={(node) => {
            const t = (node.data as BuilderNodeData)?.type;
            const colors: Record<string, string> = {
              planner: "#6366F1",
              web_search: "#06B6D4",
              data_extraction: "#F59E0B",
              reasoning: "#22C55E",
              comparison: "#8B5CF6",
              result_generator: "#F97316",
              // Legacy aliases for previously saved workflows
              supervisor: "#6366F1",
              retrieval: "#06B6D4",
              negotiation: "#F59E0B",
              compliance: "#8B5CF6",
              executor: "#F97316",
            };
            return colors[t] || "#6366F1";
          }}
        />

        {/* Empty state */}
        {nodes.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="text-center space-y-3">
              <div className="w-16 h-16 rounded-2xl border border-dashed border-white/[0.1] flex items-center justify-center mx-auto">
                <span className="text-2xl text-white/20">+</span>
              </div>
              <div>
                <p className="text-sm text-white/30 font-medium">
                  Drop agents here
                </p>
                <p className="text-[11px] text-white/15">
                  Drag nodes from the sidebar to build your workflow
                </p>
              </div>
            </div>
          </div>
        )}
      </ReactFlow>
    </div>
  );
}
