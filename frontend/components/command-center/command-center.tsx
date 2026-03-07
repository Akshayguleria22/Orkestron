"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import {
  Search,
  LayoutDashboard,
  Workflow,
  Bot,
  Store,
  Receipt,
  ScrollText,
  Sparkles,
  Network,
  Globe,
  Beaker,
  Command,
  ArrowRight,
  History,
  Zap,
} from "lucide-react";

interface CommandItem {
  id: string;
  label: string;
  description?: string;
  icon: typeof Search;
  action: () => void;
  category: string;
}

interface CommandCenterProps {
  onLaunchSimulation?: (task: string) => void;
}

export function CommandCenter({ onLaunchSimulation }: CommandCenterProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [selectedIdx, setSelectedIdx] = useState(0);
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);

  const commands: CommandItem[] = [
    // Navigation
    { id: "nav-dashboard", label: "Dashboard", description: "Overview & metrics", icon: LayoutDashboard, action: () => router.push("/dashboard"), category: "Navigation" },
    { id: "nav-workflows", label: "Workflows", description: "Workflow visualizer", icon: Workflow, action: () => router.push("/dashboard/workflows"), category: "Navigation" },
    { id: "nav-agents", label: "Agents", description: "Agent management", icon: Bot, action: () => router.push("/dashboard/agents"), category: "Navigation" },
    { id: "nav-marketplace", label: "Marketplace", description: "Agent marketplace", icon: Store, action: () => router.push("/dashboard/marketplace"), category: "Navigation" },
    { id: "nav-billing", label: "Billing", description: "Revenue & billing", icon: Receipt, action: () => router.push("/dashboard/billing"), category: "Navigation" },
    { id: "nav-logs", label: "Logs", description: "System event stream", icon: ScrollText, action: () => router.push("/dashboard/logs"), category: "Navigation" },
    { id: "nav-simulate", label: "Simulation", description: "AI workflow simulation", icon: Sparkles, action: () => router.push("/dashboard/simulate"), category: "Navigation" },
    { id: "nav-systemmap", label: "System Map", description: "Neural agent network", icon: Network, action: () => router.push("/dashboard/system-map"), category: "Navigation" },
    { id: "nav-architecture", label: "Architecture", description: "System explorer", icon: Globe, action: () => router.push("/dashboard/architecture"), category: "Navigation" },
    { id: "nav-playground", label: "Training Playground", description: "Agent sandbox", icon: Beaker, action: () => router.push("/dashboard/playground"), category: "Navigation" },
    // Actions
    { id: "act-simulate", label: "Launch Simulation", description: "Run an AI workflow simulation", icon: Zap, action: () => { router.push("/dashboard/simulate"); }, category: "Actions" },
    { id: "act-replay", label: "Replay Last Workflow", description: "Step-by-step execution replay", icon: History, action: () => router.push("/dashboard/replay"), category: "Actions" },
  ];

  const filtered = query.trim()
    ? commands.filter(
        (c) =>
          c.label.toLowerCase().includes(query.toLowerCase()) ||
          c.description?.toLowerCase().includes(query.toLowerCase())
      )
    : commands;

  // Check if query looks like a natural language task
  const isTaskQuery = query.trim().length > 10 && !filtered.length;

  const grouped = filtered.reduce<Record<string, CommandItem[]>>((acc, item) => {
    if (!acc[item.category]) acc[item.category] = [];
    acc[item.category].push(item);
    return acc;
  }, {});

  const flatItems = filtered;

  const executeSelected = useCallback(() => {
    if (isTaskQuery && onLaunchSimulation) {
      onLaunchSimulation(query);
      setOpen(false);
      setQuery("");
      router.push("/dashboard/simulate");
      return;
    }
    const item = flatItems[selectedIdx];
    if (item) {
      item.action();
      setOpen(false);
      setQuery("");
    }
  }, [selectedIdx, flatItems, isTaskQuery, query, onLaunchSimulation, router]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen((v) => !v);
      }
      if (e.key === "Escape") {
        setOpen(false);
        setQuery("");
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  useEffect(() => {
    if (open) {
      setSelectedIdx(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIdx((i) => Math.min(i + 1, flatItems.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIdx((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      executeSelected();
    }
  };

  return (
    <>
      {/* Trigger button */}
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.04] text-xs text-muted-foreground transition-colors"
      >
        <Command className="w-3 h-3" />
        <span>Command</span>
        <kbd className="ml-2 px-1.5 py-0.5 rounded border border-white/[0.08] bg-white/[0.03] text-[10px] font-mono">
          ⌘K
        </kbd>
      </button>

      {/* Modal */}
      <AnimatePresence>
        {open && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => { setOpen(false); setQuery(""); }}
              className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: -20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: -20 }}
              transition={{ duration: 0.15 }}
              className="fixed top-[20%] left-1/2 -translate-x-1/2 z-[101] w-full max-w-[560px]"
            >
              <div className="rounded-2xl border border-white/[0.08] bg-[hsl(0,0%,6%)] shadow-2xl shadow-black/40 overflow-hidden">
                {/* Search input */}
                <div className="flex items-center gap-3 px-4 border-b border-white/[0.06]">
                  <Search className="w-4 h-4 text-muted-foreground shrink-0" />
                  <input
                    ref={inputRef}
                    value={query}
                    onChange={(e) => { setQuery(e.target.value); setSelectedIdx(0); }}
                    onKeyDown={handleKeyDown}
                    placeholder="Type a command or natural language task…"
                    className="flex-1 py-3.5 bg-transparent text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none"
                  />
                  <kbd className="px-1.5 py-0.5 rounded border border-white/[0.06] bg-white/[0.02] text-[10px] text-zinc-500 font-mono">
                    ESC
                  </kbd>
                </div>

                {/* Results */}
                <div className="max-h-[320px] overflow-y-auto py-2">
                  {isTaskQuery ? (
                    <div className="px-2">
                      <button
                        onClick={executeSelected}
                        className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg bg-blue-500/10 border border-blue-500/20 text-left"
                      >
                        <div className="w-8 h-8 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center">
                          <Sparkles className="w-4 h-4 text-blue-400" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-blue-400">Launch AI Simulation</p>
                          <p className="text-xs text-muted-foreground truncate">&quot;{query}&quot;</p>
                        </div>
                        <ArrowRight className="w-4 h-4 text-blue-400" />
                      </button>
                    </div>
                  ) : (
                    Object.entries(grouped).map(([category, items]) => (
                      <div key={category}>
                        <p className="px-4 py-1.5 text-[10px] uppercase tracking-widest text-zinc-500 font-medium">
                          {category}
                        </p>
                        {items.map((item) => {
                          const globalIdx = flatItems.indexOf(item);
                          return (
                            <button
                              key={item.id}
                              onClick={() => {
                                item.action();
                                setOpen(false);
                                setQuery("");
                              }}
                              onMouseEnter={() => setSelectedIdx(globalIdx)}
                              className={cn(
                                "flex items-center gap-3 w-full px-4 py-2 text-left transition-colors mx-2 rounded-lg",
                                globalIdx === selectedIdx
                                  ? "bg-white/[0.06]"
                                  : "hover:bg-white/[0.03]"
                              )}
                              style={{ width: "calc(100% - 16px)" }}
                            >
                              <item.icon className="w-4 h-4 text-muted-foreground shrink-0" />
                              <div className="flex-1 min-w-0">
                                <p className="text-sm text-foreground">{item.label}</p>
                                {item.description && (
                                  <p className="text-[11px] text-muted-foreground">{item.description}</p>
                                )}
                              </div>
                              {globalIdx === selectedIdx && (
                                <ArrowRight className="w-3 h-3 text-zinc-500" />
                              )}
                            </button>
                          );
                        })}
                      </div>
                    ))
                  )}

                  {!isTaskQuery && !filtered.length && (
                    <p className="px-4 py-6 text-center text-sm text-muted-foreground">
                      No matching commands
                    </p>
                  )}
                </div>

                {/* Footer */}
                <div className="flex items-center justify-between px-4 py-2 border-t border-white/[0.06] text-[10px] text-zinc-600">
                  <div className="flex items-center gap-3">
                    <span>↑↓ Navigate</span>
                    <span>↵ Select</span>
                    <span>esc Close</span>
                  </div>
                  <span>Type a task to launch AI simulation</span>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
