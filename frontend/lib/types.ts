// ── Orkestron Domain Types ──

export type AgentStatus = "active" | "idle" | "error" | "offline";
export type WorkflowStatus = "running" | "completed" | "failed" | "pending";
export type LogLevel = "info" | "warn" | "error" | "debug";

export interface Agent {
  id: string;
  name: string;
  type: string;
  status: AgentStatus;
  capabilities: string[];
  developer: string;
  usageCount: number;
  successRate: number;
  avgLatency: number;
  lastActive: string;
  description: string;
}

export interface WorkflowNode {
  id: string;
  agent: string;
  status: "pending" | "active" | "completed" | "error";
  startedAt?: string;
  completedAt?: string;
  output?: string;
}

export interface Workflow {
  id: string;
  taskInput: string;
  intent: string;
  status: WorkflowStatus;
  nodes: WorkflowNode[];
  createdAt: string;
  completedAt?: string;
  duration?: number;
  userId: string;
  outcome?: string;
  savings?: number;
}

export interface BillingEvent {
  id: string;
  workflowId: string;
  pricingModel: string;
  amount: number;
  currency: string;
  status: "charged" | "pending" | "refunded";
  createdAt: string;
  description: string;
}

export interface LedgerEntry {
  id: string;
  date: string;
  revenue: number;
  costs: number;
  net: number;
  transactionCount: number;
}

export interface LogEntry {
  id: string;
  timestamp: string;
  level: LogLevel;
  agent: string;
  message: string;
  workflowId?: string;
  metadata?: Record<string, string>;
}

export interface SystemHealth {
  status: "healthy" | "degraded" | "down";
  uptime: number;
  activeWorkflows: number;
  totalAgents: number;
  requestsPerMinute: number;
  avgLatency: number;
  memoryUsage: number;
  cpuUsage: number;
}

export interface MetricPoint {
  timestamp: string;
  value: number;
}

export interface DashboardMetrics {
  totalWorkflows: number;
  successRate: number;
  totalRevenue: number;
  activeAgents: number;
  avgExecutionTime: number;
  dailyOutcomes: { date: string; successful: number; failed: number }[];
  revenueOverTime: { date: string; revenue: number }[];
  agentUsage: { agent: string; tasks: number; successRate: number }[];
}

// ── Simulation Engine Types ──

export interface SimulationStep {
  agent: string;
  status: "pending" | "active" | "completed" | "error";
  thinking?: string;
  intermediateResults?: SimulationResult[];
  reasoning?: ReasoningEntry[];
  duration?: number;
}

export interface SimulationResult {
  label: string;
  value: string;
  score?: number;
}

export interface ReasoningEntry {
  vendor: string;
  attributes: { label: string; value: string }[];
  score: number;
}

export interface SimulationRun {
  id: string;
  taskInput: string;
  steps: SimulationStep[];
  status: "idle" | "running" | "completed";
  totalSavings?: number;
  finalOutcome?: string;
}

// ── Architecture Explorer ──

export interface ArchitectureComponent {
  id: string;
  name: string;
  category: "core" | "storage" | "agent" | "infrastructure";
  description: string;
  details: string[];
  connections: string[];
  icon: string;
}

// ── Training Playground ──

export interface PlaygroundScenario {
  id: string;
  name: string;
  description: string;
  taskInput: string;
  expectedOutcome: string;
  difficulty: "easy" | "medium" | "hard";
}
