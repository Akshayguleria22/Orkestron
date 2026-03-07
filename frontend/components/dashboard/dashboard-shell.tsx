"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
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
  Map,
  Telescope,
  FlaskConical,
  RotateCcw,
  Blocks,
  Sparkles,
  Settings,
} from "lucide-react";
import { StatusBar } from "./status-bar";
import { CommandCenter } from "@/components/command-center/command-center";

type NavSection = {
  title?: string;
  items: { label: string; href: string; icon: typeof Brain }[];
};

const navSections: NavSection[] = [
  {
    items: [
      { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
      { label: "Workflows", href: "/dashboard/workflows", icon: Workflow },
      { label: "Agents", href: "/dashboard/agents", icon: Bot },
      { label: "Marketplace", href: "/dashboard/marketplace", icon: Store },
      { label: "Billing", href: "/dashboard/billing", icon: Receipt },
      { label: "Logs", href: "/dashboard/logs", icon: ScrollText },
    ],
  },
  {
    title: "Intelligence",
    items: [
      { label: "Observatory", href: "/dashboard/observatory", icon: Telescope },
      { label: "System Map", href: "/dashboard/system-map", icon: Map },
      { label: "Architecture", href: "/dashboard/architecture", icon: Blocks },
    ],
  },
  {
    title: "Interact",
    items: [
      { label: "Simulate", href: "/dashboard/simulate", icon: Sparkles },
      { label: "Replay", href: "/dashboard/replay", icon: RotateCcw },
      { label: "Playground", href: "/dashboard/playground", icon: FlaskConical },
    ],
  },
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
      <aside
        className={cn(
          "flex flex-col border-r border-white/[0.06] bg-[#0d1117] shrink-0 transition-[width] duration-200 ease-in-out",
          collapsed ? "w-16" : "w-[220px]"
        )}
      >
        {/* Logo */}
        <div className="h-14 flex items-center px-4 border-b border-white/[0.06]">
          <Link href="/" className="flex items-center gap-2.5 overflow-hidden">
            <div className="w-7 h-7 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center shrink-0">
              <Brain className="w-3.5 h-3.5 text-indigo-400" />
            </div>
            {!collapsed && (
              <span className="text-sm font-semibold tracking-tight whitespace-nowrap font-display">
                Orkestron
              </span>
            )}
          </Link>
        </div>

        {/* Nav */}
        <nav className="flex-1 py-3 px-2 space-y-4 overflow-y-auto">
          {navSections.map((section, sIdx) => (
            <div key={sIdx} className="space-y-0.5">
              {section.title && !collapsed && (
                <p className="px-3 pt-2 pb-1 text-[10px] font-semibold text-muted-foreground/60 uppercase tracking-widest">
                  {section.title}
                </p>
              )}
              {section.title && collapsed && (
                <div className="mx-3 my-2 h-px bg-white/[0.06]" />
              )}
              {section.items.map((item) => {
                const isActive = pathname === item.href || (item.href !== "/dashboard" && pathname?.startsWith(item.href));
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      "flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] font-medium transition-colors duration-150 group relative",
                      isActive
                        ? "text-foreground bg-white/[0.06]"
                        : "text-muted-foreground hover:text-foreground hover:bg-white/[0.04]"
                    )}
                  >
                    {isActive && (
                      <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[2px] h-4 rounded-r bg-indigo-500" />
                    )}
                    <item.icon className={cn(
                      "w-4 h-4 shrink-0",
                      isActive ? "text-indigo-400" : "text-muted-foreground group-hover:text-foreground"
                    )} />
                    {!collapsed && (
                      <span className="whitespace-nowrap overflow-hidden">
                        {item.label}
                      </span>
                    )}
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>

        {/* Collapse toggle */}
        <div className="p-2 border-t border-white/[0.06]">
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-[13px] text-muted-foreground hover:text-foreground hover:bg-white/[0.04] transition-colors w-full"
          >
            <ChevronLeft className={cn("w-4 h-4 transition-transform duration-200", collapsed && "rotate-180")} />
            {!collapsed && <span>Collapse</span>}
          </button>
        </div>
      </aside>

      {/* ─── Main Content ─── */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <StatusBar />
        <main className="flex-1 overflow-y-auto">
          <div className="p-6 animate-fade-in">{children}</div>
        </main>
        <CommandCenter onLaunchSimulation={handleLaunchSimulation} />
      </div>
    </div>
  );
}
