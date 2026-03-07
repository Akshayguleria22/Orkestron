"use client";

import { motion } from "framer-motion";
import { LogStream } from "@/components/log-stream/log-stream";

export default function LogsPage() {
  return (
    <div className="space-y-6 max-w-[1400px]">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Logs</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Real-time system event stream
        </p>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05 }}
      >
        <LogStream maxHeight="calc(100vh - 240px)" />
      </motion.div>
    </div>
  );
}
