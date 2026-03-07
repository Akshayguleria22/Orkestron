"use client";

import { cn } from "@/lib/utils";
import { LucideIcon } from "lucide-react";

interface MetricsCardProps {
  title: string;
  value: string;
  change?: string;
  changeType?: "positive" | "negative" | "neutral";
  icon: LucideIcon;
  subtitle?: string;
  className?: string;
}

export function MetricsCard({
  title,
  value,
  change,
  changeType = "neutral",
  icon: Icon,
  subtitle,
  className,
}: MetricsCardProps) {
  return (
    <div
      className={cn(
        "relative group rounded-xl border border-white/[0.06] bg-white/[0.02] p-5 overflow-hidden",
        "hover:border-white/[0.1] hover:bg-white/[0.03] transition-all duration-300",
        className
      )}
    >
      {/* Subtle gradient accent at top */}
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-indigo-500/20 to-transparent" />

      <div className="flex items-start justify-between">
        <div className="space-y-3">
          <p className="text-[13px] font-medium text-muted-foreground tracking-wide uppercase">
            {title}
          </p>
          <div className="flex items-baseline gap-2">
            <p className="text-2xl font-semibold tracking-tight text-foreground">
              {value}
            </p>
            {change && (
              <span
                className={cn(
                  "text-xs font-medium px-1.5 py-0.5 rounded",
                  changeType === "positive" && "text-emerald-400 bg-emerald-400/10",
                  changeType === "negative" && "text-red-400 bg-red-400/10",
                  changeType === "neutral" && "text-zinc-400 bg-zinc-400/10"
                )}
              >
                {change}
              </span>
            )}
          </div>
          {subtitle && (
            <p className="text-xs text-muted-foreground">{subtitle}</p>
          )}
        </div>
        <div className="p-2.5 rounded-lg bg-white/[0.04] border border-white/[0.06] group-hover:border-indigo-500/20 transition-colors">
          <Icon className="w-4 h-4 text-muted-foreground group-hover:text-indigo-400 transition-colors" />
        </div>
      </div>
    </div>
  );
}
