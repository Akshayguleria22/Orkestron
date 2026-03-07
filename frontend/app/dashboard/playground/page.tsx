"use client";

import { motion } from "framer-motion";
import { FlaskConical } from "lucide-react";
import { TrainingPlayground } from "@/components/playground/training-playground";

export default function PlaygroundPage() {
  return (
    <div className="space-y-6 max-w-[1400px]">
      <div>
        <h1 className="text-xl font-semibold tracking-tight flex items-center gap-2">
          <FlaskConical className="w-5 h-5 text-violet-400" />
          Training Playground
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Sandbox environment to experiment with agent workflows — pick a scenario or write your own task
        </p>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
      >
        <TrainingPlayground />
      </motion.div>
    </div>
  );
}
