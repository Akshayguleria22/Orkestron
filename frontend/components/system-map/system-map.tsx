"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
import { architectureComponents } from "@/lib/simulation-data";
import type { ArchitectureComponent } from "@/lib/types";
import {
  Brain,
  Search,
  Handshake,
  Shield,
  Play,
  Radar,
  Database,
  Zap,
  HardDrive,
  Receipt,
  Store,
  FileText,
  Activity,
} from "lucide-react";

const iconMap: Record<string, typeof Brain> = {
  brain: Brain,
  search: Search,
  handshake: Handshake,
  shield: Shield,
  play: Play,
  radar: Radar,
  database: Database,
  zap: Zap,
  hardDrive: HardDrive,
  receipt: Receipt,
  store: Store,
  fileText: FileText,
  activity: Activity,
};

const categoryColors: Record<string, { border: string; bg: string; text: string; glow: string }> = {
  core: {
    border: "border-violet-500/40",
    bg: "bg-violet-500/10",
    text: "text-violet-400",
    glow: "shadow-[0_0_30px_rgba(139,92,246,0.2)]",
  },
  agent: {
    border: "border-cyan-500/40",
    bg: "bg-cyan-500/10",
    text: "text-cyan-400",
    glow: "shadow-[0_0_25px_rgba(6,182,212,0.15)]",
  },
  storage: {
    border: "border-amber-500/40",
    bg: "bg-amber-500/10",
    text: "text-amber-400",
    glow: "shadow-[0_0_25px_rgba(245,158,11,0.15)]",
  },
  infrastructure: {
    border: "border-emerald-500/40",
    bg: "bg-emerald-500/10",
    text: "text-emerald-400",
    glow: "shadow-[0_0_25px_rgba(34,197,94,0.15)]",
  },
};

// ── Custom System Node ──

function SystemNode({ data }: { data: { component: ArchitectureComponent; isActive: boolean; onClick: () => void } }) {
  const { component, isActive, onClick } = data;
  const Icon = iconMap[component.icon] || Brain;
  const colors = categoryColors[component.category];

  return (
    <div onClick={onClick} className="cursor-pointer">
      <motion.div
        animate={
          isActive
            ? { scale: [1, 1.04, 1], boxShadow: ["0 0 0px transparent", "0 0 40px rgba(59,130,246,0.15)", "0 0 0px transparent"] }
            : {}
        }
        transition={{ duration: 3, repeat: Infinity }}
        className={cn(
          "relative rounded-xl border px-4 py-3 min-w-[160px] backdrop-blur-sm transition-all duration-500",
          isActive ? cn(colors.border, colors.glow, "bg-white/[0.04]") : "border-white/[0.06] bg-white/[0.02]"
        )}
      >
        <div className="flex items-center gap-2.5">
          <div
            className={cn(
              "w-8 h-8 rounded-lg flex items-center justify-center border transition-all",
              isActive ? cn(colors.border, colors.bg) : "border-white/[0.06] bg-white/[0.02]"
            )}
          >
            <Icon className={cn("w-4 h-4 transition-colors", isActive ? colors.text : "text-zinc-500")} />
          </div>
          <div>
            <p className={cn("text-xs font-semibold", isActive ? colors.text : "text-zinc-300")}>
              {component.name}
            </p>
            <p className="text-[9px] uppercase tracking-widest text-zinc-500">{component.category}</p>
          </div>
        </div>

        {/* Active pulse ring */}
        {isActive && (
          <motion.div
            className={cn("absolute inset-0 rounded-xl border", colors.border)}
            animate={{ opacity: [0, 0.4, 0], scale: [1, 1.03, 1.06] }}
            transition={{ duration: 2.5, repeat: Infinity }}
          />
        )}
      </motion.div>
    </div>
  );
}

const nodeTypes = { systemNode: SystemNode };

// ── Layout positions for the network graph ──

const nodePositions: Record<string, { x: number; y: number }> = {
  supervisor: { x: 400, y: 40 },
  retrieval: { x: 100, y: 200 },
  negotiation: { x: 340, y: 200 },
  compliance: { x: 580, y: 200 },
  executor: { x: 400, y: 370 },
  discovery: { x: 700, y: 200 },
  "vector-store": { x: 0, y: 370 },
  "redis-cache": { x: 600, y: 40 },
  postgres: { x: 200, y: 500 },
  billing: { x: 400, y: 530 },
  marketplace: { x: 680, y: 370 },
  "audit-log": { x: 580, y: 500 },
  monitoring: { x: 200, y: 40 },
};

interface SystemMapProps {
  className?: string;
  onSelectComponent?: (component: ArchitectureComponent) => void;
}

export function SystemMap({ className, onSelectComponent }: SystemMapProps) {
  const [activeNodes, setActiveNodes] = useState<Set<string>>(new Set(["supervisor"]));
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Cycle active nodes to simulate a living system
  useEffect(() => {
    const interval = setInterval(() => {
      const ids = architectureComponents.map((c) => c.id);
      const randomCount = 2 + Math.floor(Math.random() * 3);
      const newActive = new Set<string>();
      newActive.add("supervisor"); // always active
      for (let i = 0; i < randomCount; i++) {
        newActive.add(ids[Math.floor(Math.random() * ids.length)]);
      }
      setActiveNodes(newActive);
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  const handleNodeClick = useCallback(
    (id: string) => {
      setSelectedId(id);
      const comp = architectureComponents.find((c) => c.id === id);
      if (comp) onSelectComponent?.(comp);
    },
    [onSelectComponent]
  );

  const nodes: Node[] = useMemo(
    () =>
      architectureComponents.map((comp) => ({
        id: comp.id,
        type: "systemNode",
        position: nodePositions[comp.id] || { x: 400, y: 300 },
        data: {
          component: comp,
          isActive: activeNodes.has(comp.id),
          onClick: () => handleNodeClick(comp.id),
        },
      })),
    [activeNodes, handleNodeClick]
  );

  const edges: Edge[] = useMemo(() => {
    const edgeSet: Edge[] = [];
    const seen = new Set<string>();
    architectureComponents.forEach((comp) => {
      comp.connections.forEach((target) => {
        const key = [comp.id, target].sort().join("-");
        if (seen.has(key)) return;
        seen.add(key);

        const isActive = activeNodes.has(comp.id) && activeNodes.has(target);
        edgeSet.push({
          id: `e-${comp.id}-${target}`,
          source: comp.id,
          target,
          animated: isActive,
          style: {
            stroke: isActive ? "rgba(59, 130, 246, 0.5)" : "rgba(255, 255, 255, 0.06)",
            strokeWidth: isActive ? 2 : 1,
          },
          markerEnd: {
            type: MarkerType.ArrowClosed,
            color: isActive ? "rgba(59, 130, 246, 0.5)" : "rgba(255, 255, 255, 0.06)",
            width: 12,
            height: 12,
          },
        });
      });
    });
    return edgeSet;
  }, [activeNodes]);

  return (
    <div className={cn("w-full h-[650px] rounded-xl border border-white/[0.06] bg-black/30 overflow-hidden relative", className)}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        proOptions={{ hideAttribution: true }}
        className="!bg-transparent"
        minZoom={0.4}
        maxZoom={1.5}
        nodesDraggable
        nodesConnectable={false}
      >
        <Background color="rgba(59, 130, 246, 0.03)" gap={40} size={1} />
        <Controls
          className="!bg-white/[0.04] !border-white/[0.08] !rounded-lg [&>button]:!bg-transparent [&>button]:!border-white/[0.06] [&>button]:!text-zinc-400 [&>button:hover]:!bg-white/[0.06]"
          showInteractive={false}
        />
      </ReactFlow>

      {/* Legend */}
      <div className="absolute bottom-4 left-4 flex items-center gap-4 text-[10px]">
        {Object.entries(categoryColors).map(([cat, colors]) => (
          <div key={cat} className="flex items-center gap-1.5">
            <div className={cn("w-2 h-2 rounded-full", colors.bg, colors.border, "border")} />
            <span className="text-zinc-500 capitalize">{cat}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
