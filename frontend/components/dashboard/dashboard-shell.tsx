"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
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
  FlaskConical,
  RotateCcw,
  LogOut,
  ListTodo,
  User,
} from "lucide-react";
import { StatusBar } from "./status-bar";
import { CommandCenter } from "@/components/command-center/command-center";
import { useAuth } from "@/lib/auth-context";
import logoImage from "@/lib/logo.png";

type NavSection = {
  title?: string;
  items: { label: string; href: string; icon: typeof Brain }[];
};

const navSections: NavSection[] = [
  {
    title: "Core",
    items: [
      { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
      { label: "Tasks", href: "/dashboard/tasks", icon: ListTodo },
      { label: "Workflows", href: "/dashboard/workflows", icon: Workflow },
      { label: "Agents", href: "/dashboard/agents", icon: Bot },
      { label: "Marketplace", href: "/dashboard/marketplace", icon: Store },
    ],
  },
  {
    title: "Ops",
    items: [
      { label: "Billing", href: "/dashboard/billing", icon: Receipt },
      { label: "Logs", href: "/dashboard/logs", icon: ScrollText },
    ],
  },
  {
    title: "Sandbox",
    items: [
      { label: "Replay", href: "/dashboard/replay", icon: RotateCcw },
      {
        label: "Playground",
        href: "/dashboard/playground",
        icon: FlaskConical,
      },
    ],
  },
];

export function DashboardShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const router = useRouter();
  const { user, logout, isAuthenticated } = useAuth();

  const handleLaunchSimulation = () => {
    router.push("/dashboard/simulate");
  };

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* ─── Sidebar ─── */}
      <aside
        className={cn(
          "flex flex-col border-r border-white/[0.06] bg-black/40 backdrop-blur-xl shrink-0 transition-[width] duration-200 ease-in-out relative z-10",
          collapsed ? "w-16" : "w-[220px]",
        )}
      >
        {/* Logo */}
        <div className="h-14 flex items-center px-4 border-b border-white/[0.06]">
          <Link href="/" className="flex items-center gap-2.5 overflow-hidden">
            <div className="relative w-7 h-7 rounded-lg border border-violet-500/20 bg-white/[0.02] overflow-hidden shrink-0">
              <Image
                src={logoImage}
                alt="Orkestron logo"
                fill
                className="object-contain p-1"
                priority
              />
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
                const isActive =
                  pathname === item.href ||
                  (item.href !== "/dashboard" &&
                    pathname?.startsWith(item.href));
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      "flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] font-medium transition-colors duration-150 group relative",
                      isActive
                        ? "text-foreground bg-white/[0.06]"
                        : "text-muted-foreground hover:text-foreground hover:bg-white/[0.04]",
                    )}
                  >
                    {isActive && (
                      <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[2px] h-4 rounded-r bg-violet-500" />
                    )}
                    <item.icon
                      className={cn(
                        "w-4 h-4 shrink-0",
                        isActive
                          ? "text-violet-400"
                          : "text-muted-foreground group-hover:text-foreground",
                      )}
                    />
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

        {/* User + Collapse */}
        <div className="border-t border-white/[0.06]">
          {isAuthenticated && user && (
            <div className="p-2 space-y-1">
              <Link
                href="/dashboard/profile"
                className="flex items-center gap-2.5 px-3 py-2 rounded-lg hover:bg-white/[0.04] transition-colors group"
              >
                <div className="w-6 h-6 rounded-full bg-violet-500/20 border border-violet-500/30 flex items-center justify-center shrink-0 text-[10px] font-bold text-violet-300">
                  {user.name?.[0]?.toUpperCase() || "U"}
                </div>
                {!collapsed && (
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium truncate">{user.name}</p>
                    <p className="text-[10px] text-muted-foreground truncate">
                      {user.email}
                    </p>
                  </div>
                )}
              </Link>
              <button
                onClick={async () => {
                  await logout();
                  router.push("/login");
                }}
                className={cn(
                  "flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] font-medium text-muted-foreground hover:text-red-400 hover:bg-red-500/[0.06] transition-colors w-full",
                )}
                title="Sign out"
              >
                <LogOut className="w-4 h-4 shrink-0" />
                {!collapsed && <span>Sign Out</span>}
              </button>
            </div>
          )}
          <div className="p-2">
            <button
              onClick={() => setCollapsed(!collapsed)}
              className="flex items-center gap-2 px-3 py-2 rounded-lg text-[13px] text-muted-foreground hover:text-foreground hover:bg-white/[0.04] transition-colors w-full"
            >
              <ChevronLeft
                className={cn(
                  "w-4 h-4 transition-transform duration-200",
                  collapsed && "rotate-180",
                )}
              />
              {!collapsed && <span>Collapse</span>}
            </button>
          </div>
        </div>
      </aside>

      {/* ─── Main Content ─── */}
      <div className="flex-1 flex flex-col overflow-hidden relative">
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-violet-600/[0.03] rounded-full blur-[150px] pointer-events-none" />
        <StatusBar />
        <main className="flex-1 overflow-y-auto z-10 relative custom-scrollbar">
          <div className="p-6 animate-fade-in">{children}</div>
        </main>
        <CommandCenter onLaunchSimulation={handleLaunchSimulation} />
      </div>
    </div>
  );
}
