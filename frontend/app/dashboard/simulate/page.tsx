"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Sparkles } from "lucide-react";
import { SimulationEngine } from "@/components/simulation/simulation-engine";
import { IntelligencePanel } from "@/components/intelligence/intelligence-panel";

export default function SimulatePage() {
  const [showPanel, setShowPanel] = useState(true);

  return (
    <div className="space-y-6 max-w-[1400px]">
      <div>
        <h1 className="text-xl font-semibold tracking-tight flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-violet-400" />
          AI Simulation
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Watch agents think, negotiate, and execute tasks in real time
        </p>
      </div>

      <IntelligencePanel />

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
      >
        <SimulationEngine />
      </motion.div>
    </div>
  );
}
