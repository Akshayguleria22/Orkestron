"use client";

/**
 * Lightweight grid background with CSS-only animations.
 * No JS intervals, no Framer Motion nodes — just CSS.
 */
export function GridBackground() {
  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden">
      {/* Grid pattern */}
      <div className="absolute inset-0 grid-bg" />

      {/* Deep radial vignette */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_0%,hsl(var(--background))_70%)]" />

      {/* CSS-animated gradient orbs — no JS needed */}
      <div className="absolute top-1/4 left-1/4 w-[600px] h-[600px] rounded-full bg-indigo-500/[0.03] blur-[120px] animate-float-slow" />
      <div className="absolute bottom-1/4 right-1/4 w-[500px] h-[500px] rounded-full bg-cyan-500/[0.025] blur-[120px] animate-float-medium" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[400px] rounded-full bg-indigo-500/[0.02] blur-[150px] animate-float-fast" />
    </div>
  );
}
