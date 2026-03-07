import type { Metadata } from "next";
import "@/styles/globals.css";

export const metadata: Metadata = {
  title: "Orkestron — Autonomous Infrastructure Orchestrator",
  description:
    "Mission-control dashboard for autonomous AI agent workflows. Visualize, orchestrate, and monitor multi-agent systems.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen bg-background font-sans">{children}</body>
    </html>
  );
}
