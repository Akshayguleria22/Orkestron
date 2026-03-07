"use client";

import { motion } from "framer-motion";
import { useEffect, useState } from "react";

/**
 * Cinematic animated background with neural network nodes,
 * pulsing connections, and flowing gradients.
 */

interface Node {
  id: number;
  x: number;
  y: number;
  size: number;
  delay: number;
  duration: number;
}

function generateNodes(count: number): Node[] {
  const nodes: Node[] = [];
  for (let i = 0; i < count; i++) {
    nodes.push({
      id: i,
      x: Math.random() * 100,
      y: Math.random() * 100,
      size: 2 + Math.random() * 3,
      delay: Math.random() * 6,
      duration: 3 + Math.random() * 4,
    });
  }
  return nodes;
}

const staticNodes = generateNodes(18);

export function GridBackground() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden">
      {/* Grid pattern */}
      <div className="absolute inset-0 grid-bg" />

      {/* Deep radial vignette */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_0%,hsl(0_0%_3.9%)_70%)]" />

      {/* Neural network nodes */}
      {mounted && staticNodes.map((node) => (
        <motion.div
          key={node.id}
          initial={{ opacity: 0 }}
          animate={{
            opacity: [0, 0.6, 0.2, 0.5, 0],
            scale: [0.8, 1.2, 1, 1.1, 0.8],
          }}
          transition={{
            duration: node.duration,
            repeat: Infinity,
            delay: node.delay,
            ease: "easeInOut",
          }}
          className="absolute rounded-full"
          style={{
            left: `${node.x}%`,
            top: `${node.y}%`,
            width: node.size,
            height: node.size,
            background: node.id % 3 === 0
              ? "rgb(139, 92, 246)"
              : node.id % 3 === 1
              ? "rgb(59, 130, 246)"
              : "rgb(6, 182, 212)",
            boxShadow: `0 0 ${node.size * 4}px ${
              node.id % 3 === 0
                ? "rgba(139, 92, 246, 0.4)"
                : node.id % 3 === 1
                ? "rgba(59, 130, 246, 0.4)"
                : "rgba(6, 182, 212, 0.4)"
            }`,
          }}
        />
      ))}

      {/* Flowing gradient orbs */}
      <motion.div
        animate={{ y: [0, -40, 0], x: [0, 25, 0], opacity: [0.02, 0.05, 0.02] }}
        transition={{ duration: 18, repeat: Infinity, ease: "easeInOut" }}
        className="absolute top-1/4 left-1/4 w-[600px] h-[600px] rounded-full bg-violet-500/[0.03] blur-[120px]"
      />
      <motion.div
        animate={{ y: [0, 30, 0], x: [0, -30, 0], opacity: [0.015, 0.04, 0.015] }}
        transition={{ duration: 22, repeat: Infinity, ease: "easeInOut" }}
        className="absolute bottom-1/4 right-1/4 w-[500px] h-[500px] rounded-full bg-cyan-500/[0.025] blur-[120px]"
      />
      <motion.div
        animate={{ y: [0, -20, 0], x: [0, 15, 0], opacity: [0.01, 0.03, 0.01] }}
        transition={{ duration: 15, repeat: Infinity, ease: "easeInOut", delay: 3 }}
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[400px] rounded-full bg-blue-500/[0.02] blur-[150px]"
      />
    </div>
  );
}
