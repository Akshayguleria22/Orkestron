"use client";

import { motion } from "framer-motion";
import { FlaskConical } from "lucide-react";
import { AIAgentLab } from "@/components/playground/training-playground";

export default function PlaygroundPage() {
  return (
    <div className="space-y-4 max-w-[1600px]">
      <div>
        <h1 className="text-xl font-semibold tracking-tight flex items-center gap-2">
          <FlaskConical className="w-5 h-5 text-violet-400" />
          AI Agent Lab
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Live environment to submit tasks, observe AI agent execution, inspect steps, and test tools
        </p>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
      >
        <AIAgentLab />
      </motion.div>
    </div>
  );
}
