"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Network, X } from "lucide-react";
import { SystemMap } from "@/components/system-map/system-map";
import { architectureComponents } from "@/lib/simulation-data";
import type { ArchitectureComponent } from "@/lib/types";
import { cn } from "@/lib/utils";

export default function SystemMapPage() {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = selectedId
    ? architectureComponents.find((c) => c.id === selectedId)
    : null;

  const handleSelect = (comp: ArchitectureComponent) => {
    setSelectedId(comp.id);
  };

  return (
    <div className="space-y-6 max-w-[1400px]">
      <div>
        <h1 className="text-xl font-semibold tracking-tight flex items-center gap-2">
          <Network className="w-5 h-5 text-cyan-400" />
          System Map
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Neural network view of the agent ecosystem — drag nodes, watch activity pulse
        </p>
      </div>

      <div className="relative">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-xl border border-white/[0.06] bg-white/[0.02] overflow-hidden"
          style={{ height: "calc(100vh - 220px)", minHeight: 500 }}
        >
          <SystemMap onSelectComponent={handleSelect} />
        </motion.div>

        {/* Detail overlay */}
        <AnimatePresence>
          {selected && (
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="absolute top-4 right-4 w-72 rounded-xl border border-white/[0.06] bg-background/95 backdrop-blur-lg p-4 shadow-xl"
            >
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold">{selected.name}</h3>
                <button onClick={() => setSelectedId(null)} className="p-1 rounded hover:bg-white/[0.05]">
                  <X className="w-3.5 h-3.5 text-muted-foreground" />
                </button>
              </div>
              <p className="text-xs text-muted-foreground mb-3">{selected.description}</p>
              <div className="space-y-1">
                {selected.details.map((d, i) => (
                  <p key={i} className="text-[11px] text-zinc-400 flex items-center gap-1.5">
                    <span className="w-1 h-1 rounded-full bg-cyan-500/50" />
                    {d}
                  </p>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
