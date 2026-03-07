"use client";

import { WorkflowVisualizer } from "@/components/workflow-visualizer/workflow-visualizer";
import { LogStream } from "@/components/log-stream/log-stream";
import { motion } from "framer-motion";

/**
 * Landing page section showing a live workflow graph alongside
 * a streaming log terminal.
 */
export function LiveWorkflowPreview() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      className="grid grid-cols-1 lg:grid-cols-2 gap-4"
    >
      <WorkflowVisualizer animated className="h-[520px]" />
      <LogStream className="h-[520px]" />
    </motion.div>
  );
}
