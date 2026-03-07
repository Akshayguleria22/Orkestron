"use client";

import Link from "next/link";
import {
  ArrowRight,
  Brain,
  Workflow,
  Shield,
  BarChart3,
  Zap,
  GitBranch,
  Globe,
  ExternalLink,
  Search,
  Handshake,
  Play,
} from "lucide-react";
import { GridBackground } from "@/components/landing/grid-background";
import { FeatureCard } from "@/components/landing/feature-card";

const pipelineSteps = [
  { name: "Supervisor", icon: Brain, color: "text-violet-400", border: "border-violet-500/30", bg: "bg-violet-500/10" },
  { name: "Retrieval", icon: Search, color: "text-cyan-400", border: "border-cyan-500/30", bg: "bg-cyan-500/10" },
  { name: "Negotiation", icon: Handshake, color: "text-amber-400", border: "border-amber-500/30", bg: "bg-amber-500/10" },
  { name: "Executor", icon: Play, color: "text-indigo-400", border: "border-indigo-500/30", bg: "bg-indigo-500/10" },
];

export default function LandingPage() {
  return (
    <div className="relative min-h-screen bg-background">
      <GridBackground />

      {/* ─── Navigation ─── */}
      <nav className="fixed top-0 inset-x-0 z-50 border-b border-white/[0.04] bg-background/60 backdrop-blur-xl animate-fade-in">
        <div className="max-w-7xl mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-md bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center">
              <Brain className="w-3.5 h-3.5 text-indigo-400" />
            </div>
            <span className="text-sm font-display font-semibold tracking-tight">ORKESTRON</span>
          </div>
          <div className="hidden md:flex items-center gap-6 text-[13px] text-muted-foreground">
            <a href="#features" className="hover:text-foreground transition-colors">Features</a>
            <a href="#architecture" className="hover:text-foreground transition-colors">Architecture</a>
            <a href="#developers" className="hover:text-foreground transition-colors">Developers</a>
            <a href="https://github.com" target="_blank" rel="noopener noreferrer" className="hover:text-foreground transition-colors flex items-center gap-1">
              GitHub <ExternalLink className="w-3 h-3" />
            </a>
            <Link
              href="/dashboard"
              className="px-4 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium transition-colors"
            >
              Dashboard
            </Link>
          </div>
        </div>
      </nav>

      {/* ─── Hero ─── */}
      <section className="relative pt-36 pb-20 px-6 animate-fade-in">
        <div className="max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 mb-6 px-3 py-1 rounded-full border border-white/[0.08] bg-white/[0.02] text-xs text-muted-foreground">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            v0.7.0 — Production Ready
          </div>

          <h1 className="text-6xl md:text-8xl font-display font-bold tracking-tight leading-[0.95] mb-6">
            ORKESTRON
          </h1>

          <p className="text-xl md:text-2xl font-display text-indigo-400/90 mb-4">
            Autonomous Infrastructure for AI Agents
          </p>

          <p className="text-base text-muted-foreground max-w-xl mx-auto mb-10 leading-relaxed">
            Launch and orchestrate intelligent agents across commerce, workflows, and systems. Multi-agent graphs with outcome-based billing.
          </p>

          <div className="flex items-center justify-center gap-4 mb-16">
            <Link
              href="/dashboard"
              className="group inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium transition-all shadow-lg shadow-indigo-600/20"
            >
              Launch Console
              <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
            </Link>
            <a
              href="#architecture"
              className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl border border-white/[0.08] bg-white/[0.03] hover:bg-white/[0.06] text-sm text-muted-foreground hover:text-foreground transition-all"
            >
              View Architecture
            </a>
          </div>

          {/* ─── Animated Pipeline Preview ─── */}
          <div className="relative max-w-2xl mx-auto">
            <div className="flex items-center justify-between gap-2">
              {pipelineSteps.map((step, i) => (
                <div key={step.name} className="flex items-center gap-2">
                  <div className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border ${step.border} ${step.bg} animate-fade-in`} style={{ animationDelay: `${i * 150}ms` }}>
                    <step.icon className={`w-4 h-4 ${step.color}`} />
                    <span className="text-xs font-medium text-foreground">{step.name}</span>
                  </div>
                  {i < pipelineSteps.length - 1 && (
                    <ArrowRight className="w-3.5 h-3.5 text-zinc-700 shrink-0" />
                  )}
                </div>
              ))}
            </div>
            <div className="mt-3 h-1 rounded-full bg-white/[0.04] overflow-hidden">
              <div className="h-full w-full bg-gradient-to-r from-violet-500 via-cyan-500 via-amber-500 to-indigo-500 rounded-full animate-shimmer" />
            </div>
          </div>
        </div>

        {/* Subtle radial glow behind hero */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[500px] bg-indigo-500/[0.04] rounded-full blur-[140px] pointer-events-none" />
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 w-[400px] h-[300px] bg-violet-500/[0.03] rounded-full blur-[120px] pointer-events-none" />
      </section>

      {/* ─── Features ─── */}
      <section id="features" className="relative py-24 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <p className="text-xs font-medium text-indigo-400 uppercase tracking-widest mb-3">Capabilities</p>
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight">
              Everything you need to orchestrate AI
            </h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <FeatureCard
              icon={Workflow}
              title="Multi-Agent Orchestration"
              description="LangGraph-powered directed graphs with conditional routing, parallel execution, and automatic recovery."
              delay={0}
            />
            <FeatureCard
              icon={Globe}
              title="Agent Marketplace"
              description="Discover, negotiate, and deploy third-party agents with real-time capability matching."
              delay={0.05}
            />
            <FeatureCard
              icon={BarChart3}
              title="Outcome-Based Billing"
              description="Pay for results, not compute. Flat, percentage, and savings-based pricing models."
              delay={0.1}
            />
            <FeatureCard
              icon={GitBranch}
              title="Capability Plugins"
              description="Hot-load agent plugins at runtime. Manifest-based validation and sandboxed execution."
              delay={0.15}
            />
          </div>
        </div>
      </section>

      {/* ─── Architecture Preview ─── */}
      <section id="architecture" className="relative py-24 px-6">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-16">
            <p className="text-xs font-medium text-indigo-400 uppercase tracking-widest mb-3">System Architecture</p>
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight">
              Built for autonomous operations
            </h2>
            <p className="text-muted-foreground mt-4 max-w-lg mx-auto">
              Multi-agent graph topology with intelligent routing, delegation tokens, and outcome-based billing.
            </p>
          </div>

          <div className="rounded-2xl border border-white/[0.06] bg-[#111827]/50 p-8 md:p-12">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {[
                { title: "Gateway Layer", items: ["JWT Authentication", "Rate Limiting", "Intent Classification"], color: "border-indigo-500/20" },
                { title: "Orchestration Core", items: ["LangGraph Supervisor", "Delegation Tokens", "Permission Engine"], color: "border-violet-500/20" },
                { title: "Agent Workers", items: ["Retrieval Agent", "Negotiation Agent", "Compliance + Executor"], color: "border-cyan-500/20" },
              ].map((block) => (
                <div key={block.title} className={`rounded-xl border ${block.color} bg-white/[0.02] p-5`}>
                  <h4 className="text-sm font-semibold mb-3">{block.title}</h4>
                  <ul className="space-y-2">
                    {block.items.map((item) => (
                      <li key={item} className="flex items-center gap-2 text-xs text-muted-foreground">
                        <div className="w-1 h-1 rounded-full bg-indigo-500/60" />
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
            <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-3">
              {["PostgreSQL", "Redis", "Qdrant Vector Store", "Prometheus + Grafana"].map((tech) => (
                <div key={tech} className="text-center py-2 rounded-lg border border-white/[0.04] bg-white/[0.01] text-[11px] text-muted-foreground">
                  {tech}
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ─── Developer Ready ─── */}
      <section id="developers" className="relative py-24 px-6">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-16">
            <p className="text-xs font-medium text-indigo-400 uppercase tracking-widest mb-3">Developer Ready</p>
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight">
              Ship faster with built-in tooling
            </h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="rounded-xl border border-white/[0.06] bg-white/[0.015] p-6">
              <Shield className="w-5 h-5 text-indigo-400 mb-3" />
              <h4 className="text-sm font-semibold mb-2">Zero-Trust Security</h4>
              <p className="text-[13px] text-muted-foreground leading-relaxed">JWT auth, delegation tokens, and permission engine enforce least-privilege.</p>
            </div>
            <div className="rounded-xl border border-white/[0.06] bg-white/[0.015] p-6">
              <Zap className="w-5 h-5 text-indigo-400 mb-3" />
              <h4 className="text-sm font-semibold mb-2">Full Observability</h4>
              <p className="text-[13px] text-muted-foreground leading-relaxed">Prometheus metrics, structured logging, and Grafana dashboards out of the box.</p>
            </div>
            <div className="rounded-xl border border-white/[0.06] bg-white/[0.015] p-6">
              <BarChart3 className="w-5 h-5 text-indigo-400 mb-3" />
              <h4 className="text-sm font-semibold mb-2">Semantic Cache</h4>
              <p className="text-[13px] text-muted-foreground leading-relaxed">Vector-similarity caching eliminates redundant LLM calls and accelerates repeat queries.</p>
            </div>
          </div>
        </div>
      </section>

      {/* ─── CTA ─── */}
      <section className="relative py-24 px-6">
        <div className="max-w-2xl mx-auto text-center">
          <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-4">
            Ready to orchestrate?
          </h2>
          <p className="text-muted-foreground mb-8">
            Deploy autonomous agents with confidence. Full observability, billing, and security built in.
          </p>
          <Link
            href="/dashboard"
            className="group inline-flex items-center gap-2 px-8 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-medium transition-all shadow-lg shadow-indigo-600/20"
          >
            Launch Dashboard
            <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
          </Link>
        </div>
      </section>

      {/* ─── Footer ─── */}
      <footer className="border-t border-white/[0.04] py-8 px-6">
        <div className="max-w-7xl mx-auto flex items-center justify-between text-xs text-muted-foreground">
          <div className="flex items-center gap-2">
            <Brain className="w-3.5 h-3.5 text-indigo-400" />
            <span className="font-display">ORKESTRON</span>
            <span>v0.7.0</span>
          </div>
          <span>Autonomous Infrastructure for AI Agents</span>
        </div>
      </footer>
    </div>
  );
}
