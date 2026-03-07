"use client";

import { motion, useScroll, useTransform } from "framer-motion";
import { useRef } from "react";
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
  Lock,
  Sparkles,
} from "lucide-react";
import { GridBackground } from "@/components/landing/grid-background";
import { ArchitectureDiagram } from "@/components/landing/architecture-diagram";
import { FeatureCard } from "@/components/landing/feature-card";
import { LiveWorkflowPreview } from "@/components/landing/live-workflow-preview";

export default function LandingPage() {
  const containerRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: containerRef });
  const heroOpacity = useTransform(scrollYProgress, [0, 0.15], [1, 0]);
  const heroScale = useTransform(scrollYProgress, [0, 0.15], [1, 0.96]);

  return (
    <div ref={containerRef} className="relative min-h-screen bg-background">
      <GridBackground />

      {/* ─── Navigation ─── */}
      <motion.nav
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="fixed top-0 inset-x-0 z-50 border-b border-white/[0.04] bg-background/60 backdrop-blur-xl"
      >
        <div className="max-w-7xl mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-md bg-blue-500/10 border border-blue-500/20 flex items-center justify-center">
              <Brain className="w-3.5 h-3.5 text-blue-400" />
            </div>
            <span className="text-sm font-semibold tracking-tight">Orkestron</span>
          </div>
          <div className="hidden md:flex items-center gap-8 text-[13px] text-muted-foreground">
            <a href="#features" className="hover:text-foreground transition-colors">Features</a>
            <a href="#architecture" className="hover:text-foreground transition-colors">Architecture</a>
            <a href="#workflow" className="hover:text-foreground transition-colors">Workflow</a>
            <Link
              href="/dashboard"
              className="px-4 py-1.5 rounded-lg bg-white/[0.06] border border-white/[0.08] hover:bg-white/[0.1] transition-colors text-foreground"
            >
              Open Dashboard
            </Link>
          </div>
        </div>
      </motion.nav>

      {/* ─── Hero ─── */}
      <motion.section
        style={{ opacity: heroOpacity, scale: heroScale }}
        className="relative pt-32 pb-20 px-6"
      >
        <div className="max-w-4xl mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="inline-flex items-center gap-2 mb-6 px-3 py-1 rounded-full border border-white/[0.08] bg-white/[0.02] text-xs text-muted-foreground"
          >
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            v0.7.0 — Production Ready
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="text-5xl md:text-7xl font-bold tracking-tight leading-[1.05] mb-6"
          >
            Autonomous
            <br />
            <span className="text-gradient bg-gradient-to-r from-violet-400 via-blue-400 to-cyan-400 bg-clip-text text-transparent">Infrastructure</span>
            <br />
            Orchestrator
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="text-lg text-muted-foreground max-w-2xl mx-auto mb-10 leading-relaxed"
          >
            Deploy, monitor, and orchestrate autonomous AI agents through
            intelligent LangGraph workflows. Mission control for your AI infrastructure.
          </motion.p>

          {/* Animated agent labels */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
            className="flex items-center justify-center gap-3 mb-10 flex-wrap"
          >
            {["Supervisor", "Retrieval", "Negotiation", "Compliance", "Executor"].map((agent, i) => (
              <motion.span
                key={agent}
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.6 + i * 0.1 }}
                className="px-3 py-1 rounded-full border border-white/[0.06] bg-white/[0.02] text-[11px] text-muted-foreground font-medium"
              >
                <motion.span
                  animate={{ opacity: [0.5, 1, 0.5] }}
                  transition={{ duration: 2, repeat: Infinity, delay: i * 0.4 }}
                  className="inline-block w-1.5 h-1.5 rounded-full bg-violet-500 mr-1.5 align-middle"
                />
                {agent}
              </motion.span>
            ))}
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.7 }}
            className="flex items-center justify-center gap-4"
          >
            <Link
              href="/dashboard"
              className="group inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium transition-all shadow-lg shadow-blue-600/20"
            >
              Open Dashboard
              <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
            </Link>
            <Link
              href="/dashboard/simulate"
              className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl border border-violet-500/20 bg-violet-500/[0.05] hover:bg-violet-500/[0.1] text-sm text-violet-300 hover:text-violet-200 transition-all"
            >
              <Sparkles className="w-3.5 h-3.5" />
              Try Simulation
            </Link>
          </motion.div>
        </div>

        {/* Subtle radial glow behind hero */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[500px] bg-blue-500/[0.04] rounded-full blur-[140px] pointer-events-none" />
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 w-[400px] h-[300px] bg-violet-500/[0.03] rounded-full blur-[120px] pointer-events-none" />
      </motion.section>

      {/* ─── Architecture Diagram ─── */}
      <section id="architecture" className="relative py-24 px-6">
        <div className="max-w-6xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            className="text-center mb-16"
          >
            <p className="text-xs font-medium text-blue-400 uppercase tracking-widest mb-3">System Architecture</p>
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight">
              Built for autonomous operations
            </h2>
            <p className="text-muted-foreground mt-4 max-w-lg mx-auto">
              Multi-agent graph topology with intelligent routing, delegation tokens, and outcome-based billing.
            </p>
          </motion.div>
          <ArchitectureDiagram />
        </div>
      </section>

      {/* ─── Features ─── */}
      <section id="features" className="relative py-24 px-6">
        <div className="max-w-6xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            className="text-center mb-16"
          >
            <p className="text-xs font-medium text-blue-400 uppercase tracking-widest mb-3">Capabilities</p>
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight">
              Everything you need to orchestrate AI
            </h2>
          </motion.div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <FeatureCard
              icon={Workflow}
              title="LangGraph Workflows"
              description="Multi-agent directed graphs with conditional routing, parallel execution, and automatic recovery."
              delay={0}
            />
            <FeatureCard
              icon={Brain}
              title="Intelligent Routing"
              description="Keyword and semantic intent classification routes tasks to the optimal specialized agent."
              delay={0.05}
            />
            <FeatureCard
              icon={Shield}
              title="Zero-Trust Security"
              description="JWT auth, delegation tokens, and a permission engine enforce least-privilege at every step."
              delay={0.1}
            />
            <FeatureCard
              icon={BarChart3}
              title="Outcome-Based Billing"
              description="Pay for results, not compute. Flat, percentage, and savings-based pricing models."
              delay={0.15}
            />
            <FeatureCard
              icon={Globe}
              title="Agent Marketplace"
              description="Discover, negotiate, and deploy third-party agents with real-time capability matching."
              delay={0.2}
            />
            <FeatureCard
              icon={GitBranch}
              title="Plugin Architecture"
              description="Hot-load agent plugins at runtime. Manifest-based validation and sandboxed execution."
              delay={0.25}
            />
            <FeatureCard
              icon={Zap}
              title="Realtime Observability"
              description="Prometheus metrics, structured logging, and Grafana dashboards out of the box."
              delay={0.3}
            />
            <FeatureCard
              icon={Lock}
              title="Audit Trail"
              description="Tamper-evident hash chain records every workflow execution for full accountability."
              delay={0.35}
            />
            <FeatureCard
              icon={BarChart3}
              title="Semantic Cache"
              description="Vector-similarity caching eliminates redundant LLM calls and accelerates repeat queries."
              delay={0.4}
            />
          </div>
        </div>
      </section>

      {/* ─── Live Workflow Preview ─── */}
      <section id="workflow" className="relative py-24 px-6">
        <div className="max-w-6xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            className="text-center mb-16"
          >
            <p className="text-xs font-medium text-blue-400 uppercase tracking-widest mb-3">Live Preview</p>
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight">
              Watch agents work in real time
            </h2>
            <p className="text-muted-foreground mt-4 max-w-lg mx-auto">
              Tasks flow through the orchestration graph, with each agent processing and handing off to the next.
            </p>
          </motion.div>
          <LiveWorkflowPreview />
        </div>
      </section>

      {/* ─── CTA ─── */}
      <section className="relative py-24 px-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="max-w-2xl mx-auto text-center"
        >
          <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-4">
            Ready to orchestrate?
          </h2>
          <p className="text-muted-foreground mb-8">
            Deploy autonomous agents with confidence. Full observability, billing, and security built in.
          </p>
          <Link
            href="/dashboard"
            className="group inline-flex items-center gap-2 px-8 py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-medium transition-all shadow-lg shadow-blue-600/20"
          >
            Launch Dashboard
            <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
          </Link>
        </motion.div>
      </section>

      {/* ─── Footer ─── */}
      <footer className="border-t border-white/[0.04] py-8 px-6">
        <div className="max-w-7xl mx-auto flex items-center justify-between text-xs text-muted-foreground">
          <div className="flex items-center gap-2">
            <Brain className="w-3.5 h-3.5 text-blue-400" />
            <span>Orkestron v0.7.0</span>
          </div>
          <span>Autonomous Infrastructure Orchestrator</span>
        </div>
      </footer>
    </div>
  );
}
