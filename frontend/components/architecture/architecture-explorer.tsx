"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
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
  X,
  ChevronRight,
} from "lucide-react";

const iconMap: Record<string, typeof Brain> = {
  brain: Brain, search: Search, handshake: Handshake, shield: Shield,
  play: Play, radar: Radar, database: Database, zap: Zap,
  hardDrive: HardDrive, receipt: Receipt, store: Store,
  fileText: FileText, activity: Activity,
};

const categoryStyles: Record<string, { bg: string; text: string; border: string }> = {
  core: { bg: "bg-violet-500/10", text: "text-violet-400", border: "border-violet-500/20" },
  agent: { bg: "bg-cyan-500/10", text: "text-cyan-400", border: "border-cyan-500/20" },
  storage: { bg: "bg-amber-500/10", text: "text-amber-400", border: "border-amber-500/20" },
  infrastructure: { bg: "bg-emerald-500/10", text: "text-emerald-400", border: "border-emerald-500/20" },
};

export function ArchitectureExplorer({ className }: { className?: string }) {
  const [selected, setSelected] = useState<ArchitectureComponent | null>(null);
  const [filter, setFilter] = useState<string>("all");

  const categories = ["all", "core", "agent", "storage", "infrastructure"];
  const filtered = filter === "all"
    ? architectureComponents
    : architectureComponents.filter((c) => c.category === filter);

  return (
    <div className={cn("space-y-6", className)}>
      {/* Category filter */}
      <div className="flex items-center gap-1 p-0.5 rounded-lg border border-white/[0.06] bg-white/[0.02] w-fit">
        {categories.map((cat) => (
          <button
            key={cat}
            onClick={() => setFilter(cat)}
            className={cn(
              "px-3 py-1.5 rounded-md text-xs font-medium capitalize transition-colors",
              filter === cat
                ? "bg-white/[0.08] text-foreground"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {cat}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Component Grid */}
        <div className="lg:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-3">
          {filtered.map((comp, idx) => {
            const Icon = iconMap[comp.icon] || Brain;
            const style = categoryStyles[comp.category];
            const isSelected = selected?.id === comp.id;

            return (
              <motion.div
                key={comp.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.04 }}
                onClick={() => setSelected(isSelected ? null : comp)}
                className={cn(
                  "rounded-xl border p-4 cursor-pointer transition-all duration-300 group",
                  isSelected
                    ? cn(style.border, "bg-white/[0.04]", "shadow-lg")
                    : "border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.03] hover:border-white/[0.1]"
                )}
              >
                <div className="flex items-start gap-3">
                  <div className={cn(
                    "w-9 h-9 rounded-lg flex items-center justify-center border shrink-0 transition-colors",
                    isSelected ? cn(style.bg, style.border) : "bg-white/[0.03] border-white/[0.06]"
                  )}>
                    <Icon className={cn(
                      "w-4 h-4 transition-colors",
                      isSelected ? style.text : "text-zinc-500 group-hover:text-zinc-300"
                    )} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-semibold text-foreground">{comp.name}</p>
                      <ChevronRight className={cn(
                        "w-3 h-3 text-zinc-600 transition-transform",
                        isSelected && "rotate-90"
                      )} />
                    </div>
                    <span className={cn(
                      "text-[9px] uppercase tracking-widest font-medium",
                      style.text
                    )}>
                      {comp.category}
                    </span>
                    <p className="text-xs text-muted-foreground mt-1.5 line-clamp-2">
                      {comp.description}
                    </p>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>

        {/* Detail Panel */}
        <div className="lg:col-span-1">
          <AnimatePresence mode="wait">
            {selected ? (
              <motion.div
                key={selected.id}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                transition={{ duration: 0.2 }}
                className="sticky top-6 rounded-xl border border-white/[0.06] bg-white/[0.02] overflow-hidden"
              >
                {/* Header */}
                <div className={cn(
                  "px-5 py-4 border-b border-white/[0.04]",
                  categoryStyles[selected.category].bg
                )}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      {(() => {
                        const Icon = iconMap[selected.icon] || Brain;
                        return <Icon className={cn("w-5 h-5", categoryStyles[selected.category].text)} />;
                      })()}
                      <div>
                        <h3 className="text-sm font-semibold">{selected.name}</h3>
                        <span className={cn("text-[9px] uppercase tracking-widest", categoryStyles[selected.category].text)}>
                          {selected.category}
                        </span>
                      </div>
                    </div>
                    <button
                      onClick={() => setSelected(null)}
                      className="p-1 rounded-md hover:bg-white/[0.1] transition-colors"
                    >
                      <X className="w-3.5 h-3.5 text-muted-foreground" />
                    </button>
                  </div>
                </div>

                <div className="p-5 space-y-5">
                  {/* Description */}
                  <div>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      {selected.description}
                    </p>
                  </div>

                  {/* Details */}
                  <div>
                    <p className="text-[10px] uppercase tracking-widest text-muted-foreground mb-2 font-medium">
                      Details
                    </p>
                    <div className="space-y-1.5">
                      {selected.details.map((detail, i) => (
                        <motion.div
                          key={i}
                          initial={{ opacity: 0, x: -8 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: i * 0.08 }}
                          className="flex items-center gap-2 text-xs"
                        >
                          <div className={cn("w-1 h-1 rounded-full", categoryStyles[selected.category].bg, categoryStyles[selected.category].border, "border")} />
                          <span className="text-zinc-300">{detail}</span>
                        </motion.div>
                      ))}
                    </div>
                  </div>

                  {/* Connections */}
                  <div>
                    <p className="text-[10px] uppercase tracking-widest text-muted-foreground mb-2 font-medium">
                      Connections
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {selected.connections.map((conn) => {
                        const target = architectureComponents.find((c) => c.id === conn);
                        return (
                          <button
                            key={conn}
                            onClick={() => target && setSelected(target)}
                            className="px-2 py-1 rounded-md border border-white/[0.06] bg-white/[0.02] text-[11px] text-muted-foreground hover:bg-white/[0.05] hover:text-foreground transition-colors"
                          >
                            {target?.name || conn}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </motion.div>
            ) : (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="rounded-xl border border-dashed border-white/[0.06] p-8 text-center"
              >
                <Brain className="w-8 h-8 text-zinc-700 mx-auto mb-3" />
                <p className="text-sm text-muted-foreground">Select a component to explore</p>
                <p className="text-xs text-zinc-600 mt-1">Click any card to view details</p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
