"use client";

import { useCallback, useEffect, useState, useMemo } from "react";
import ReactFlow, {
  Background,
  Controls,
  type Node,
  type Edge,
  Position,
  MarkerType,
  useNodesState,
  useEdgesState,
} from "reactflow";
import "reactflow/dist/style.css";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { AgentNode } from "./agent-node";


interface WorkflowStep {
  id: string;
  agent: string;
  status: "pending" | "active" | "completed" | "error";
}

interface WorkflowVisualizerProps {
  steps?: WorkflowStep[];
  className?: string;
  animated?: boolean;
}

const defaultSteps: WorkflowStep[] = [
  { id: "1", agent: "User Task", status: "completed" },
  { id: "2", agent: "Supervisor", status: "completed" },
  { id: "3", agent: "Retrieval Agent", status: "completed" },
  { id: "4", agent: "Negotiation Agent", status: "active" },
  { id: "5", agent: "Compliance Agent", status: "pending" },
  { id: "6", agent: "Executor Agent", status: "pending" },
];

function buildNodes(steps: WorkflowStep[]): Node[] {
  const spacingY = 110;
  const startY = 40;

  return steps.map((step, i) => ({
    id: step.id,
    type: "agentNode",
    position: { x: 200, y: startY + i * spacingY },
    data: { label: step.agent, status: step.status },
    sourcePosition: Position.Bottom,
    targetPosition: Position.Top,
  }));
}

function buildEdges(steps: WorkflowStep[]): Edge[] {
  return steps.slice(0, -1).map((step, i) => {
    const nextStep = steps[i + 1];
    const isActive = step.status === "completed" && nextStep.status === "active";
    const isCompleted = step.status === "completed" && nextStep.status === "completed";

    return {
      id: `e-${step.id}-${nextStep.id}`,
      source: step.id,
      target: nextStep.id,
      animated: isActive,
      style: {
        stroke: isCompleted
          ? "rgba(34, 197, 94, 0.5)"
          : isActive
          ? "rgba(59, 130, 246, 0.7)"
          : "rgba(255, 255, 255, 0.08)",
        strokeWidth: isActive ? 2.5 : 1.5,
      },
      markerEnd: {
        type: MarkerType.ArrowClosed,
        color: isCompleted
          ? "rgba(34, 197, 94, 0.5)"
          : isActive
          ? "rgba(59, 130, 246, 0.7)"
          : "rgba(255, 255, 255, 0.08)",
        width: 16,
        height: 16,
      },
    };
  });
}

/**
 * Interactive workflow graph built on React Flow.
 * Nodes glow when active, edges animate when data flows.
 */
export function WorkflowVisualizer({
  steps = defaultSteps,
  className,
  animated = true,
}: WorkflowVisualizerProps) {
  const [nodes, setNodes, onNodesChange] = useNodesState(buildNodes(steps));
  const [edges, setEdges, onEdgesChange] = useEdgesState(buildEdges(steps));
  const [currentSteps, setCurrentSteps] = useState(steps);
  const nodeTypes = useMemo(() => ({ agentNode: AgentNode }), []);

  // Animate steps progressing through the workflow
  useEffect(() => {
    if (!animated) return;

    const interval = setInterval(() => {
      setCurrentSteps((prev) => {
        const activeIdx = prev.findIndex((s) => s.status === "active");
        if (activeIdx === -1 || activeIdx === prev.length - 1) {
          // Reset to beginning
          return prev.map((s, i) => ({
            ...s,
            status: i === 0 ? "completed" : i === 1 ? "active" : "pending",
          }));
        }
        return prev.map((s, i) => ({
          ...s,
          status:
            i <= activeIdx ? "completed" : i === activeIdx + 1 ? "active" : "pending",
        }));
      });
    }, 2500);

    return () => clearInterval(interval);
  }, [animated]);

  useEffect(() => {
    setNodes(buildNodes(currentSteps));
    setEdges(buildEdges(currentSteps));
  }, [currentSteps, setNodes, setEdges]);

  return (
    <div className={cn("w-full h-[700px] rounded-xl border border-white/[0.06] bg-black/30 overflow-hidden", className)}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{ padding: 0.3 }}
        proOptions={{ hideAttribution: true }}
        className="!bg-transparent"
        minZoom={0.5}
        maxZoom={1.5}
        nodesDraggable={false}
        nodesConnectable={false}
      >
        <Background color="rgba(59, 130, 246, 0.04)" gap={30} size={1} />
        <Controls
          className="!bg-white/[0.04] !border-white/[0.08] !rounded-lg [&>button]:!bg-transparent [&>button]:!border-white/[0.06] [&>button]:!text-zinc-400 [&>button:hover]:!bg-white/[0.06]"
          showInteractive={false}
        />
      </ReactFlow>
    </div>
  );
}
