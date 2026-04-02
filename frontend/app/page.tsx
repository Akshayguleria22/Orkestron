"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { motion, useScroll, useTransform, useInView } from "framer-motion";
import {
  ArrowRight,
  Brain,
  Workflow,
  Shield,
  BarChart3,
  Zap,
  Globe,
  Search,
  Sparkles,
  Bot,
  Cpu,
  Eye,
  CheckCircle2,
  Star,
  ChevronRight,
  Play,
  Code,
  Layers,
  Clock,
} from "lucide-react";
import { GridBackground } from "@/components/landing/grid-background";
import logoImage from "@/lib/logo.png";

const pipelineSteps = [
  { name: "Plan", desc: "LLM decomposes your task", icon: Brain, color: "from-violet-500/20 to-violet-500/5", border: "border-violet-500/30", text: "text-violet-400", delay: 0 },
  { name: "Search", desc: "Web search & data collection", icon: Search, color: "from-cyan-500/20 to-cyan-500/5", border: "border-cyan-500/30", text: "text-cyan-400", delay: 0.1 },
  { name: "Reason", desc: "Analyze & compare data", icon: Sparkles, color: "from-amber-500/20 to-amber-500/5", border: "border-amber-500/30", text: "text-amber-400", delay: 0.2 },
  { name: "Deliver", desc: "Structured results with sources", icon: Zap, color: "from-emerald-500/20 to-emerald-500/5", border: "border-emerald-500/30", text: "text-emerald-400", delay: 0.3 },
];

const features = [
  { icon: Bot, title: "Real AI Processing", description: "Groq-powered LLM agents that decompose, reason, and synthesize. No mocks." },
  { icon: Globe, title: "Live Web Search", description: "Real-time data via Serper.dev search and intelligent page scraping." },
  { icon: Workflow, title: "Dynamic Pipelines", description: "Every task gets a custom agent pipeline crafted by the planner." },
  { icon: Eye, title: "Full Observability", description: "Execution traces, agent logs, and real-time progress tracking." },
  { icon: Shield, title: "Secure by Design", description: "JWT auth, SSRF protection, and tamper-evident audit trails." },
  { icon: Layers, title: "Agent Marketplace", description: "Deploy, share, and execute specialized AI agents on-demand." },
];

const stats = [
  { value: "6+", label: "AI Agents" },
  { value: "<30s", label: "Avg Response" },
  { value: "100%", label: "Real Data" },
  { value: "24/7", label: "Availability" },
];

const taskExamples = [
  "Find cheapest RTX 4070 under ₹60,000",
  "Compare React vs Vue for enterprise apps",
  "Summarize latest AI research this week",
  "Analyze Tesla stock trends this quarter",
  "Best cloud hosting with 99.9% SLA",
  "Create ML learning roadmap for beginners",
];

function AnimatedCounter({ value }: { value: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const isInView = useInView(ref, { once: true });
  return (
    <span ref={ref} className={isInView ? "animate-slide-up" : "opacity-0"}>
      {value}
    </span>
  );
}

function ScrollSection({ children, className, delay = 0 }: { children: React.ReactNode; className?: string; delay?: number }) {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-80px" });
  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 40 }}
      animate={isInView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.7, delay, ease: [0.16, 1, 0.3, 1] }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

export default function LandingPage() {
  const heroRef = useRef<HTMLDivElement>(null);
  const { scrollY } = useScroll();
  const heroOpacity = useTransform(scrollY, [0, 400], [1, 0]);
  const heroY = useTransform(scrollY, [0, 400], [0, -60]);

  return (
    <div className="relative min-h-screen bg-background overflow-x-hidden">
      <GridBackground />

      {/* ─── Navigation ─── */}
      <nav className="fixed top-0 inset-x-0 z-50 border-b border-white/[0.04] bg-background/60 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="relative w-7 h-7 rounded-lg border border-violet-500/20 bg-white/[0.02] overflow-hidden">
              <Image
                src={logoImage}
                alt="Orkestron logo"
                fill
                className="object-contain p-1"
                priority
              />
            </div>
            <span className="text-sm font-display font-bold tracking-tight">
              ORKESTRON
            </span>
          </div>
          <div className="hidden md:flex items-center gap-6 text-[13px] text-muted-foreground">
            <a
              href="#features"
              className="hover:text-foreground transition-colors"
            >
              Features
            </a>
            <a
              href="#how-it-works"
              className="hover:text-foreground transition-colors"
            >
              How It Works
            </a>
            <a
              href="#stats"
              className="hover:text-foreground transition-colors"
            >
              Stats
            </a>
            <Link
              href="/dashboard"
              className="px-4 py-1.5 rounded-lg border border-white/[0.08] bg-white/[0.03] hover:bg-white/[0.06] text-sm transition-colors"
            >
              Dashboard
            </Link>
            <Link
              href="/login"
              className="px-4 py-1.5 rounded-lg bg-gradient-to-r from-violet-600 to-violet-500 hover:from-violet-500 hover:to-violet-400 text-white text-sm font-medium transition-all shadow-lg shadow-violet-600/20"
            >
              Get Started
            </Link>
          </div>
        </div>
      </nav>

      {/* ─── Hero ─── */}
      <motion.section
        ref={heroRef}
        style={{ opacity: heroOpacity, y: heroY }}
        className="relative pt-32 pb-20 px-6"
      >
        <div className="max-w-5xl mx-auto text-center">
          {/* Badge */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="inline-flex items-center gap-2 mb-8 px-4 py-1.5 rounded-full border border-violet-500/20 bg-violet-500/[0.05] text-xs text-violet-300"
          >
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            v1.0 — Real AI Agent Execution
            <ChevronRight className="w-3 h-3" />
          </motion.div>

          {/* Main Title */}
          <motion.h1
            initial={{ opacity: 0, scale: 0.95, filter: "blur(10px)" }}
            animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
            transition={{ duration: 1, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
            className="text-6xl md:text-[8rem] font-display font-extrabold tracking-tighter leading-[0.9] mb-8"
          >
            <span className="text-gradient drop-shadow-2xl">ORKESTRON</span>
          </motion.h1>

          {/* Subtitle with wavy underline */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.25 }}
            className="relative mb-5"
          >
            <p className="text-2xl md:text-3xl font-display text-violet-400/90 font-medium">
              Your tasks. Real AI agents. Real results.
            </p>
            <div className="mt-3 mx-auto w-32 h-1 rounded-full overflow-hidden bg-white/[0.04]">
              <div className="h-full w-full bg-gradient-to-r from-violet-500 via-cyan-500 to-emerald-500 animate-shimmer" />
            </div>
          </motion.div>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.35 }}
            className="text-base text-muted-foreground max-w-xl mx-auto mb-10 leading-relaxed"
          >
            Submit any task in natural language. Orkestron decomposes it,
            dispatches real AI agents with web search, analysis, and reasoning —
            then delivers structured results.
          </motion.p>

          {/* Example task pills */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.45 }}
            className="flex flex-wrap items-center justify-center gap-2 mb-10"
          >
            {taskExamples.map((task, i) => (
              <span
                key={task}
                className="px-3 py-1.5 rounded-lg border border-white/[0.06] bg-white/[0.02] text-xs text-muted-foreground hover:border-violet-500/20 hover:text-foreground transition-all cursor-default"
                style={{ animationDelay: `${i * 80}ms` }}
              >
                &ldquo;{task}&rdquo;
              </span>
            ))}
          </motion.div>

          {/* CTA Buttons */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.55 }}
            className="flex items-center justify-center gap-4 mb-16"
          >
            <Link
              href="/login"
              className="group inline-flex items-center gap-2 px-7 py-3 rounded-xl bg-gradient-to-r from-violet-600 to-violet-500 hover:from-violet-500 hover:to-violet-400 text-white font-medium transition-all shadow-xl shadow-violet-600/25 hover:scale-[1.02]"
            >
              Start Building
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </Link>
            <Link
              href="/dashboard"
              className="group inline-flex items-center gap-2 px-7 py-3 rounded-xl border border-white/[0.08] bg-white/[0.03] hover:bg-white/[0.06] text-sm text-muted-foreground hover:text-foreground transition-all"
            >
              <Play className="w-4 h-4" />
              Try Dashboard
            </Link>
          </motion.div>

          {/* ─── Animated Pipeline ─── */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.65 }}
            className="relative max-w-3xl mx-auto"
          >
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {pipelineSteps.map((step, i) => (
                <motion.div
                  key={step.name}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.7 + i * 0.1, duration: 0.5 }}
                  className={`relative rounded-xl border ${step.border} bg-gradient-to-b ${step.color} p-4 text-center group hover:scale-105 transition-transform duration-300`}
                >
                  <step.icon className={`w-6 h-6 ${step.text} mx-auto mb-2`} />
                  <h4 className="text-sm font-semibold mb-0.5">{step.name}</h4>
                  <p className="text-[11px] text-muted-foreground">
                    {step.desc}
                  </p>
                  {/* Connection arrow */}
                  {i < pipelineSteps.length - 1 && (
                    <div className="hidden md:block absolute -right-2 top-1/2 -translate-y-1/2 z-10">
                      <ChevronRight className="w-3.5 h-3.5 text-zinc-600" />
                    </div>
                  )}
                </motion.div>
              ))}
            </div>
            {/* Animated progress bar */}
            <div className="mt-4 h-1 rounded-full bg-white/[0.04] overflow-hidden">
              <div className="h-full w-full bg-gradient-to-r from-violet-500 via-cyan-500 to-emerald-500 rounded-full animate-shimmer" />
            </div>
          </motion.div>
        </div>

        {/* Hero glow effects */}
        <div className="absolute top-[20%] left-1/2 -translate-x-1/2 -translate-y-1/2 w-[1000px] h-[600px] bg-violet-600/[0.08] rounded-full blur-[180px] pointer-events-none" />
        <div className="absolute top-[40%] left-[20%] w-[500px] h-[500px] bg-cyan-500/[0.06] rounded-full blur-[150px] pointer-events-none animate-float-slow" />
        <div className="absolute top-[50%] right-[15%] w-[450px] h-[450px] bg-fuchsia-600/[0.05] rounded-full blur-[150px] pointer-events-none animate-float-medium" />
      </motion.section>

      {/* ─── Stats Bar ─── */}
      <section
        id="stats"
        className="relative py-12 px-6 border-y border-white/[0.04] bg-white/[0.01]"
      >
        <div className="max-w-4xl mx-auto">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {stats.map((stat, i) => (
              <ScrollSection
                key={stat.label}
                delay={i * 0.1}
                className="text-center"
              >
                <p className="text-3xl md:text-4xl font-display font-bold text-gradient mb-1">
                  <AnimatedCounter value={stat.value} />
                </p>
                <p className="text-xs text-muted-foreground uppercase tracking-wider">
                  {stat.label}
                </p>
              </ScrollSection>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Features ─── */}
      <section id="features" className="relative py-28 px-6">
        <div className="max-w-6xl mx-auto">
          <ScrollSection className="text-center mb-16">
            <p className="text-xs font-medium text-violet-400 uppercase tracking-[0.2em] mb-3">
              Capabilities
            </p>
            <h2 className="text-4xl md:text-5xl font-bold tracking-tight mb-4">
              Real AI agents that{" "}
              <span className="text-gradient">actually work</span>
            </h2>
            <p className="text-muted-foreground max-w-lg mx-auto">
              Not another wrapper. Orkestron is a full agent orchestration
              engine that plans, executes, and delivers.
            </p>
          </ScrollSection>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {features.map((feature, i) => (
              <ScrollSection key={feature.title} delay={i * 0.08}>
                <div className="group relative rounded-xl border border-white/[0.06] bg-white/[0.015] p-6 hover:bg-white/[0.03] hover:border-white/[0.1] transition-all duration-300 h-full">
                  <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-indigo-500/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                  <div className="w-10 h-10 rounded-lg bg-white/[0.04] border border-white/[0.08] flex items-center justify-center mb-4 group-hover:border-violet-500/20 transition-colors">
                    <feature.icon className="w-5 h-5 text-muted-foreground group-hover:text-violet-400 transition-colors" />
                  </div>
                  <h3 className="text-sm font-semibold text-foreground mb-2">
                    {feature.title}
                  </h3>
                  <p className="text-[13px] text-muted-foreground leading-relaxed">
                    {feature.description}
                  </p>
                </div>
              </ScrollSection>
            ))}
          </div>
        </div>
      </section>

      {/* ─── How It Works ─── */}
      <section id="how-it-works" className="relative py-28 px-6">
        <div className="max-w-5xl mx-auto">
          <ScrollSection className="text-center mb-16">
            <p className="text-xs font-medium text-violet-400 uppercase tracking-[0.2em] mb-3">
              How It Works
            </p>
            <h2 className="text-4xl md:text-5xl font-bold tracking-tight mb-4">
              From task to result in{" "}
              <span className="text-gradient">seconds</span>
            </h2>
            <p className="text-muted-foreground max-w-lg mx-auto">
              Describe what you need. Orkestron plans, dispatches agents, and
              delivers structured results — fully automated.
            </p>
          </ScrollSection>

          <ScrollSection delay={0.2}>
            <div className="rounded-2xl border border-white/[0.08] bg-[#030303]/60 backdrop-blur-2xl p-8 md:p-12 relative overflow-hidden shadow-2xl">
              {/* Animated border glow */}
              <div className="absolute inset-0 rounded-2xl bg-gradient-to-r from-violet-500/20 via-cyan-500/10 to-fuchsia-500/20 animate-flow-border pointer-events-none" />

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 relative z-10">
                {[
                  {
                    step: "01",
                    title: "Plan",
                    items: [
                      "LLM decomposes your task",
                      "Identifies required agents",
                      "Generates search queries & strategy",
                    ],
                    color: "border-violet-500/20",
                    icon: Brain,
                    iconColor: "text-violet-400",
                  },
                  {
                    step: "02",
                    title: "Execute",
                    items: [
                      "Web search & data scraping",
                      "Analysis, reasoning & comparison",
                      "Multi-agent coordination",
                    ],
                    color: "border-cyan-500/20",
                    icon: Zap,
                    iconColor: "text-cyan-400",
                  },
                  {
                    step: "03",
                    title: "Deliver",
                    items: [
                      "Structured results with sources",
                      "Recommendations & insights",
                      "Full execution logs & traces",
                    ],
                    color: "border-emerald-500/20",
                    icon: CheckCircle2,
                    iconColor: "text-emerald-400",
                  },
                ].map((block, i) => (
                  <ScrollSection key={block.title} delay={0.3 + i * 0.15}>
                    <div
                      className={`rounded-xl border ${block.color} bg-white/[0.02] p-6 h-full`}
                    >
                      <div className="flex items-center gap-3 mb-4">
                        <div className="w-8 h-8 rounded-lg bg-white/[0.04] flex items-center justify-center">
                          <block.icon
                            className={`w-4 h-4 ${block.iconColor}`}
                          />
                        </div>
                        <div>
                          <span className="text-[10px] text-muted-foreground uppercase tracking-wider">
                            Step {block.step}
                          </span>
                          <h4 className="text-sm font-semibold">
                            {block.title}
                          </h4>
                        </div>
                      </div>
                      <ul className="space-y-2.5">
                        {block.items.map((item) => (
                          <li
                            key={item}
                            className="flex items-start gap-2 text-[13px] text-muted-foreground"
                          >
                            <div className="w-1.5 h-1.5 rounded-full bg-violet-500/60 mt-1.5 shrink-0" />
                            {item}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </ScrollSection>
                ))}
              </div>

              {/* Tech stack pills */}
              <div className="mt-8 grid grid-cols-2 md:grid-cols-4 gap-3 relative z-10">
                {[
                  { name: "Groq LLM", icon: Brain },
                  { name: "Serper.dev", icon: Search },
                  { name: "Web Scraping", icon: Globe },
                  { name: "Structured Output", icon: Code },
                ].map((tech) => (
                  <div
                    key={tech.name}
                    className="flex items-center justify-center gap-2 py-2.5 rounded-lg border border-white/[0.04] bg-white/[0.01] text-[11px] text-muted-foreground hover:border-violet-500/15 transition-colors"
                  >
                    <tech.icon className="w-3.5 h-3.5" />
                    {tech.name}
                  </div>
                ))}
              </div>
            </div>
          </ScrollSection>
        </div>
      </section>

      {/* ─── Architecture ─── */}
      <section className="relative py-28 px-6">
        <div className="max-w-4xl mx-auto">
          <ScrollSection className="text-center mb-16">
            <p className="text-xs font-medium text-violet-400 uppercase tracking-[0.2em] mb-3">
              Under the Hood
            </p>
            <h2 className="text-4xl md:text-5xl font-bold tracking-tight">
              Production-grade{" "}
              <span className="text-gradient">infrastructure</span>
            </h2>
          </ScrollSection>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[
              {
                icon: Shield,
                title: "Secure by Default",
                desc: "JWT auth, bcrypt passwords, SSRF protection on all outbound requests.",
              },
              {
                icon: Cpu,
                title: "Real-Time Tracking",
                desc: "WebSocket updates, agent execution logs, and full task audit trails.",
              },
              {
                icon: BarChart3,
                title: "Full Observability",
                desc: "Execution traces, dashboard analytics, and semantic caching built in.",
              },
            ].map((item, i) => (
              <ScrollSection key={item.title} delay={i * 0.1}>
                <div className="rounded-xl border border-white/[0.06] bg-white/[0.015] p-6 hover:bg-white/[0.03] hover:border-white/[0.1] transition-all duration-300 h-full">
                  <item.icon className="w-5 h-5 text-violet-400 mb-4" />
                  <h4 className="text-sm font-semibold mb-2">{item.title}</h4>
                  <p className="text-[13px] text-muted-foreground leading-relaxed">
                    {item.desc}
                  </p>
                </div>
              </ScrollSection>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Final CTA ─── */}
      <section className="relative py-28 px-6">
        <ScrollSection className="max-w-3xl mx-auto text-center">
          <div className="relative">
            {/* Glow orb behind CTA */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[300px] bg-violet-500/[0.06] rounded-full blur-[120px] pointer-events-none" />

            <h2 className="relative text-4xl md:text-5xl font-bold tracking-tight mb-4">
              Ready to let AI{" "}
              <span className="text-gradient">do the work?</span>
            </h2>
            <p className="relative text-muted-foreground mb-10 max-w-md mx-auto">
              Sign up in seconds. Submit your first task. Get real results
              powered by real agents.
            </p>
            <div className="relative flex items-center justify-center gap-4">
              <Link
                href="/login"
                className="group inline-flex items-center gap-2 px-8 py-3.5 rounded-xl bg-gradient-to-r from-violet-600 to-violet-500 hover:from-violet-500 hover:to-violet-400 text-white font-medium transition-all shadow-xl shadow-violet-600/25 hover:scale-[1.02]"
              >
                Get Started Free
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </Link>
              <Link
                href="/dashboard"
                className="group inline-flex items-center gap-2 px-8 py-3.5 rounded-xl border border-white/[0.08] bg-white/[0.03] hover:bg-white/[0.06] text-muted-foreground hover:text-foreground font-medium transition-all"
              >
                <Play className="w-4 h-4" />
                Explore Dashboard
              </Link>
            </div>
          </div>
        </ScrollSection>
      </section>

      {/* ─── Footer ─── */}
      <footer className="border-t border-white/[0.04] py-8 px-6">
        <div className="max-w-7xl mx-auto flex items-center justify-between text-xs text-muted-foreground">
          <div className="flex items-center gap-2.5">
            <div className="relative w-5 h-5 rounded-md border border-violet-500/20 bg-white/[0.02] overflow-hidden">
              <Image
                src={logoImage}
                alt="Orkestron logo"
                fill
                className="object-contain p-1"
              />
            </div>
            <span className="font-display font-semibold">ORKESTRON</span>
            <span>v1.0</span>
          </div>
          <span>Real AI Agent Execution Platform</span>
        </div>
      </footer>
    </div>
  );
}
