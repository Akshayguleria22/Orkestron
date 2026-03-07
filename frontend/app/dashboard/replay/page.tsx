"use client";

import { motion } from "framer-motion";
import { History } from "lucide-react";
import { ReplayViewer } from "@/components/replay/replay-viewer";

export default function ReplayPage() {
  return (
    <div className="space-y-6 max-w-[1400px]">
      <div>
        <h1 className="text-xl font-semibold tracking-tight flex items-center gap-2">
          <History className="w-5 h-5 text-amber-400" />
          Workflow Replay
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Step through past workflow executions — play, pause, and inspect each agent&apos;s actions
        </p>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
      >
        <ReplayViewer />
      </motion.div>
    </div>
  );
}
