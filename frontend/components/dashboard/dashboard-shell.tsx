"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  Workflow,
  Bot,
  Store,
  Receipt,
  ScrollText,
  Brain,
  ChevronLeft,
  Settings,
  Sparkles,
  Network,
  Globe,
  History,
  FlaskConical,
} from "lucide-react";
import { StatusBar } from "./status-bar";
import { CommandCenter } from "@/components/command-center/command-center";

const navItems = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { label: "Workflows", href: "/dashboard/workflows", icon: Workflow },
  { label: "Agents", href: "/dashboard/agents", icon: Bot },
  { label: "Marketplace", href: "/dashboard/marketplace", icon: Store },
  { label: "Billing", href: "/dashboard/billing", icon: Receipt },
  { label: "Logs", href: "/dashboard/logs", icon: ScrollText },
];

const cinematicNavItems = [
  { label: "Simulate", href: "/dashboard/simulate", icon: Sparkles },
  { label: "System Map", href: "/dashboard/system-map", icon: Network },
  { label: "Architecture", href: "/dashboard/architecture", icon: Globe },
  { label: "Replay", href: "/dashboard/replay", icon: History },
  { label: "Playground", href: "/dashboard/playground", icon: FlaskConical },
];

export function DashboardShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const router = useRouter();

  const handleLaunchSimulation = () => {
    router.push("/dashboard/simulate");
  };

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* ─── Sidebar ─── */}
      <motion.aside
        animate={{ width: collapsed ? 64 : 240 }}
        transition={{ duration: 0.2, ease: "easeInOut" }}
        className="flex flex-col border-r border-white/[0.04] bg-white/[0.01] shrink-0"
      >
        {/* Logo */}
        <div className="h-14 flex items-center px-4 border-b border-white/[0.04]">
          <Link href="/" className="flex items-center gap-2.5 overflow-hidden">
            <div className="w-7 h-7 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center shrink-0">
              <Brain className="w-3.5 h-3.5 text-blue-400" />
            </div>
            <AnimatePresence>
              {!collapsed && (
                <motion.span
                  initial={{ opacity: 0, width: 0 }}
                  animate={{ opacity: 1, width: "auto" }}
                  exit={{ opacity: 0, width: 0 }}
                  className="text-sm font-semibold tracking-tight whitespace-nowrap overflow-hidden"
                >
                  Orkestron
                </motion.span>
              )}
            </AnimatePresence>
          </Link>
        </div>

        {/* Nav */}
        <nav className="flex-1 py-3 px-2 space-y-0.5 overflow-y-auto">
          {navItems.map((item) => {
            const isActive = pathname === item.href || (item.href !== "/dashboard" && pathname?.startsWith(item.href));
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] font-medium transition-all duration-200 group relative overflow-hidden",
                  isActive
                    ? "text-foreground bg-white/[0.06]"
                    : "text-muted-foreground hover:text-foreground hover:bg-white/[0.03]"
                )}
              >
                {isActive && (
                  <motion.div
                    layoutId="sidebar-active"
                    className="absolute left-0 top-1/2 -translate-y-1/2 w-[2px] h-4 rounded-r bg-blue-500"
                    transition={{ type: "spring", stiffness: 300, damping: 30 }}
                  />
                )}
                <item.icon className={cn(
                  "w-4 h-4 shrink-0 transition-colors",
                  isActive ? "text-blue-400" : "text-muted-foreground group-hover:text-foreground"
                )} />
                <AnimatePresence>
                  {!collapsed && (
                    <motion.span
                      initial={{ opacity: 0, width: 0 }}
                      animate={{ opacity: 1, width: "auto" }}
                      exit={{ opacity: 0, width: 0 }}
                      className="whitespace-nowrap overflow-hidden"
                    >
                      {item.label}
                    </motion.span>
                  )}
                </AnimatePresence>
              </Link>
            );
          })}

          {/* Cinematic section divider */}
          <div className="my-2 mx-3">
            <div className="h-px bg-white/[0.04]" />
            <AnimatePresence>
              {!collapsed && (
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="text-[9px] uppercase tracking-widest text-zinc-600 mt-2 mb-1 px-0.5"
                >
                  Cinematic
                </motion.p>
              )}
            </AnimatePresence>
          </div>

          {cinematicNavItems.map((item) => {
            const isActive = pathname === item.href || pathname?.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] font-medium transition-all duration-200 group relative overflow-hidden",
                  isActive
                    ? "text-foreground bg-white/[0.06]"
                    : "text-muted-foreground hover:text-foreground hover:bg-white/[0.03]"
                )}
              >
                {isActive && (
                  <motion.div
                    layoutId="sidebar-active"
                    className="absolute left-0 top-1/2 -translate-y-1/2 w-[2px] h-4 rounded-r bg-violet-500"
                    transition={{ type: "spring", stiffness: 300, damping: 30 }}
                  />
                )}
                <item.icon className={cn(
                  "w-4 h-4 shrink-0 transition-colors",
                  isActive ? "text-violet-400" : "text-muted-foreground group-hover:text-foreground"
                )} />
                <AnimatePresence>
                  {!collapsed && (
                    <motion.span
                      initial={{ opacity: 0, width: 0 }}
                      animate={{ opacity: 1, width: "auto" }}
                      exit={{ opacity: 0, width: 0 }}
                      className="whitespace-nowrap overflow-hidden"
                    >
                      {item.label}
                    </motion.span>
                  )}
                </AnimatePresence>
              </Link>
            );
          })}
        </nav>

        {/* Collapse toggle */}
        <div className="p-2 border-t border-white/[0.04]">
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-[13px] text-muted-foreground hover:text-foreground hover:bg-white/[0.03] transition-all w-full"
          >
            <motion.div animate={{ rotate: collapsed ? 180 : 0 }} transition={{ duration: 0.2 }}>
              <ChevronLeft className="w-4 h-4" />
            </motion.div>
            <AnimatePresence>
              {!collapsed && (
                <motion.span
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                >
                  Collapse
                </motion.span>
              )}
            </AnimatePresence>
          </button>
        </div>
      </motion.aside>

      {/* ─── Main Content ─── */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <StatusBar />
        <main className="flex-1 overflow-y-auto">
          <motion.div
            key={pathname}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="p-6"
          >
            {children}
          </motion.div>
        </main>
        <CommandCenter onLaunchSimulation={handleLaunchSimulation} />
      </div>
    </div>
  );
}
