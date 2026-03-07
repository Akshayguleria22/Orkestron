"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { Brain, Search, Handshake, Shield, Play, ArrowDown } from "lucide-react";
import { useState, useEffect } from "react";

const steps = [
  { id: 1, name: "Supervisor", icon: Brain, color: "text-violet-400", borderColor: "border-violet-500/30" },
  { id: 2, name: "Retrieval", icon: Search, color: "text-cyan-400", borderColor: "border-cyan-500/30" },
  { id: 3, name: "Negotiation", icon: Handshake, color: "text-amber-400", borderColor: "border-amber-500/30" },
  { id: 4, name: "Compliance", icon: Shield, color: "text-emerald-400", borderColor: "border-emerald-500/30" },
  { id: 5, name: "Executor", icon: Play, color: "text-orange-400", borderColor: "border-orange-500/30" },
];

/**
 * Animated architecture diagram on the landing page.
 * Shows the flow from User → Supervisor → Worker Agents.
 */
export function ArchitectureDiagram() {
  const [activeStep, setActiveStep] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setActiveStep((prev) => (prev + 1) % (steps.length + 1));
    }, 2000);
    return () => clearInterval(interval);
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      className="relative rounded-2xl border border-white/[0.06] bg-white/[0.01] p-8 md:p-12 overflow-hidden"
    >
      {/* Background noise */}
      <div className="absolute inset-0 noise-overlay" />

      <div className="relative flex flex-col items-center gap-3">
        {/* User Input */}
        <motion.div
          animate={{
            borderColor: activeStep === 0 ? "rgba(59, 130, 246, 0.4)" : "rgba(255, 255, 255, 0.06)",
            boxShadow: activeStep === 0 ? "0 0 25px rgba(59, 130, 246, 0.15)" : "none",
          }}
          className="flex items-center gap-3 px-6 py-3 rounded-xl border bg-white/[0.02] transition-all"
        >
          <div className="w-8 h-8 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center">
            <Brain className="w-4 h-4 text-blue-400" />
          </div>
          <div>
            <p className="text-sm font-medium">User Task Input</p>
            <p className="text-[11px] text-muted-foreground">Natural language instruction</p>
          </div>
        </motion.div>

        <ArrowDown className="w-4 h-4 text-zinc-700 my-1" />

        {/* Agent pipeline */}
        {steps.map((step, index) => (
          <div key={step.id} className="flex flex-col items-center gap-3">
            <motion.div
              animate={{
                borderColor: activeStep === index + 1
                  ? step.borderColor.replace("border-", "").replace("/30", "").includes("violet")
                    ? "rgba(139, 92, 246, 0.4)"
                    : step.borderColor.replace("border-", "").replace("/30", "").includes("cyan")
                    ? "rgba(34, 211, 238, 0.4)"
                    : step.borderColor.replace("border-", "").replace("/30", "").includes("amber")
                    ? "rgba(245, 158, 11, 0.4)"
                    : step.borderColor.replace("border-", "").replace("/30", "").includes("emerald")
                    ? "rgba(34, 197, 94, 0.4)"
                    : "rgba(249, 115, 22, 0.4)"
                  : "rgba(255, 255, 255, 0.06)",
                scale: activeStep === index + 1 ? 1.02 : 1,
              }}
              transition={{ duration: 0.4 }}
              className={cn(
                "flex items-center gap-3 px-6 py-3 rounded-xl border bg-white/[0.02] min-w-[260px] transition-all"
              )}
            >
              <div className={cn(
                "w-8 h-8 rounded-lg flex items-center justify-center border transition-all",
                activeStep === index + 1
                  ? `${step.borderColor} bg-white/[0.04]`
                  : "border-white/[0.06] bg-white/[0.02]"
              )}>
                <step.icon className={cn(
                  "w-4 h-4 transition-colors",
                  activeStep === index + 1 ? step.color : "text-zinc-600"
                )} />
              </div>
              <div>
                <p className="text-sm font-medium">{step.name} Agent</p>
                <p className={cn(
                  "text-[10px] uppercase tracking-widest font-medium",
                  activeStep > index + 1 ? "text-emerald-400" :
                  activeStep === index + 1 ? step.color :
                  "text-zinc-600"
                )}>
                  {activeStep > index + 1 ? "completed" : activeStep === index + 1 ? "processing" : "waiting"}
                </p>
              </div>

              {/* Active glow */}
              {activeStep === index + 1 && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: [0, 0.3, 0] }}
                  transition={{ duration: 2, repeat: Infinity }}
                  className="absolute inset-0 rounded-xl border border-blue-500/10"
                />
              )}
            </motion.div>

            {index < steps.length - 1 && (
              <motion.div
                animate={{
                  backgroundColor: activeStep > index + 1
                    ? "rgba(34, 197, 94, 0.3)"
                    : "rgba(255, 255, 255, 0.06)",
                }}
                className="w-px h-4 transition-colors"
              />
            )}
          </div>
        ))}
      </div>
    </motion.div>
  );
}
