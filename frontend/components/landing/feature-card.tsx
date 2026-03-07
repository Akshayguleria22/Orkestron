"use client";

import { motion } from "framer-motion";
import { LucideIcon } from "lucide-react";

interface FeatureCardProps {
  icon: LucideIcon;
  title: string;
  description: string;
  delay?: number;
}

export function FeatureCard({ icon: Icon, title, description, delay = 0 }: FeatureCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-50px" }}
      transition={{ delay, duration: 0.4 }}
      className="group relative rounded-xl border border-white/[0.06] bg-white/[0.015] p-6 hover:bg-white/[0.03] hover:border-white/[0.1] transition-all duration-300"
    >
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-indigo-500/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />

      <div className="w-9 h-9 rounded-lg bg-white/[0.04] border border-white/[0.08] flex items-center justify-center mb-4 group-hover:border-indigo-500/20 transition-colors">
        <Icon className="w-4 h-4 text-muted-foreground group-hover:text-indigo-400 transition-colors" />
      </div>

      <h3 className="text-sm font-semibold text-foreground mb-2">{title}</h3>
      <p className="text-[13px] text-muted-foreground leading-relaxed">{description}</p>
    </motion.div>
  );
}
