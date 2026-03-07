"use client";

import { motion } from "framer-motion";
import { Globe } from "lucide-react";
import { ArchitectureExplorer } from "@/components/architecture/architecture-explorer";

export default function ArchitecturePage() {
  return (
    <div className="space-y-6 max-w-[1400px]">
      <div>
        <h1 className="text-xl font-semibold tracking-tight flex items-center gap-2">
          <Globe className="w-5 h-5 text-emerald-400" />
          Architecture Explorer
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Explore every component of the orchestration system — click to inspect details and connections
        </p>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
      >
        <ArchitectureExplorer />
      </motion.div>
    </div>
  );
}
