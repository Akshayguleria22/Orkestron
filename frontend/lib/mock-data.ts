// ── Mock Data for Demo Mode ──
// Realistic data used when the backend is not available.

import type {
  Agent,
  Workflow,
  BillingEvent,
  LedgerEntry,
  LogEntry,
  SystemHealth,
  DashboardMetrics,
} from "./types";

export const mockHealth: SystemHealth = {
  status: "healthy",
  uptime: 864000,
  activeWorkflows: 12,
  totalAgents: 6,
  requestsPerMinute: 342,
  avgLatency: 127,
  memoryUsage: 67,
  cpuUsage: 34,
};

export const mockAgents: Agent[] = [
  {
    id: "supervisor",
    name: "Supervisor",
    type: "orchestrator",
    status: "active",
    capabilities: ["intent_classification", "task_routing", "workflow_coordination"],
    developer: "Orkestron Core",
    usageCount: 14820,
    successRate: 99.2,
    avgLatency: 45,
    lastActive: new Date().toISOString(),
    description: "Central orchestrator that classifies intent and routes tasks to specialized agents.",
  },
  {
    id: "retrieval",
    name: "Retrieval Agent",
    type: "worker",
    status: "active",
    capabilities: ["vendor_search", "product_lookup", "market_analysis"],
    developer: "Orkestron Core",
    usageCount: 8934,
    successRate: 97.8,
    avgLatency: 230,
    lastActive: new Date().toISOString(),
    description: "Searches vendor databases and retrieves contextual information using vector embeddings.",
  },
  {
    id: "negotiation",
    name: "Negotiation Agent",
    type: "worker",
    status: "active",
    capabilities: ["price_negotiation", "offer_scoring", "deal_optimization"],
    developer: "Orkestron Core",
    usageCount: 5621,
    successRate: 94.5,
    avgLatency: 890,
    lastActive: new Date().toISOString(),
    description: "Negotiates optimal pricing by scoring marketplace offers against budget constraints.",
  },
  {
    id: "compliance",
    name: "Compliance Agent",
    type: "worker",
    status: "idle",
    capabilities: ["policy_validation", "budget_check", "regulatory_compliance"],
    developer: "Orkestron Core",
    usageCount: 4102,
    successRate: 99.9,
    avgLatency: 120,
    lastActive: new Date(Date.now() - 300000).toISOString(),
    description: "Validates transactions against organizational policies and regulatory requirements.",
  },
  {
    id: "executor",
    name: "Executor Agent",
    type: "worker",
    status: "active",
    capabilities: ["transaction_execution", "order_placement", "settlement"],
    developer: "Orkestron Core",
    usageCount: 3847,
    successRate: 98.1,
    avgLatency: 1200,
    lastActive: new Date().toISOString(),
    description: "Executes approved transactions, places orders, and records outcomes to the ledger.",
  },
  {
    id: "discovery",
    name: "Discovery Agent",
    type: "system",
    status: "active",
    capabilities: ["agent_discovery", "capability_matching", "plugin_loading"],
    developer: "Orkestron Core",
    usageCount: 2190,
    successRate: 96.3,
    avgLatency: 85,
    lastActive: new Date().toISOString(),
    description: "Discovers and registers third-party agent plugins from the capability marketplace.",
  },
];

export const mockWorkflows: Workflow[] = [
  {
    id: "wf-001",
    taskInput: "Purchase 500 units of steel at best price",
    intent: "purchase",
    status: "completed",
    createdAt: new Date(Date.now() - 120000).toISOString(),
    completedAt: new Date(Date.now() - 60000).toISOString(),
    duration: 58200,
    userId: "user-alpha",
    outcome: "Purchased 500 units at $42.50/unit from SteelCorp",
    savings: 2340,
    nodes: [
      { id: "n1", agent: "Supervisor", status: "completed", output: "Intent: purchase" },
      { id: "n2", agent: "Retrieval Agent", status: "completed", output: "Found 12 vendors" },
      { id: "n3", agent: "Negotiation Agent", status: "completed", output: "Best offer: $42.50/unit" },
      { id: "n4", agent: "Compliance Agent", status: "completed", output: "Budget approved" },
      { id: "n5", agent: "Executor Agent", status: "completed", output: "Order placed" },
    ],
  },
  {
    id: "wf-002",
    taskInput: "Find cheapest cloud GPU provider for training",
    intent: "information",
    status: "running",
    createdAt: new Date(Date.now() - 30000).toISOString(),
    duration: 30000,
    userId: "user-beta",
    nodes: [
      { id: "n1", agent: "Supervisor", status: "completed", output: "Intent: information" },
      { id: "n2", agent: "Retrieval Agent", status: "active" },
      { id: "n3", agent: "Negotiation Agent", status: "pending" },
      { id: "n4", agent: "Compliance Agent", status: "pending" },
      { id: "n5", agent: "Executor Agent", status: "pending" },
    ],
  },
  {
    id: "wf-003",
    taskInput: "Negotiate SaaS license renewal with Acme Corp",
    intent: "negotiation",
    status: "completed",
    createdAt: new Date(Date.now() - 600000).toISOString(),
    completedAt: new Date(Date.now() - 540000).toISOString(),
    duration: 62100,
    userId: "user-alpha",
    outcome: "Renewed at 15% discount",
    savings: 4500,
    nodes: [
      { id: "n1", agent: "Supervisor", status: "completed" },
      { id: "n2", agent: "Retrieval Agent", status: "completed" },
      { id: "n3", agent: "Negotiation Agent", status: "completed" },
      { id: "n4", agent: "Compliance Agent", status: "completed" },
      { id: "n5", agent: "Executor Agent", status: "completed" },
    ],
  },
  {
    id: "wf-004",
    taskInput: "Verify GDPR compliance for data pipeline",
    intent: "compliance",
    status: "failed",
    createdAt: new Date(Date.now() - 1800000).toISOString(),
    completedAt: new Date(Date.now() - 1740000).toISOString(),
    duration: 12400,
    userId: "user-gamma",
    nodes: [
      { id: "n1", agent: "Supervisor", status: "completed" },
      { id: "n2", agent: "Retrieval Agent", status: "completed" },
      { id: "n3", agent: "Compliance Agent", status: "error", output: "Policy violation detected" },
    ],
  },
];

export const mockBillingEvents: BillingEvent[] = [
  { id: "b-001", workflowId: "wf-001", pricingModel: "outcome_based", amount: 234, currency: "USD", status: "charged", createdAt: new Date(Date.now() - 60000).toISOString(), description: "10% of $2,340 savings on steel purchase" },
  { id: "b-002", workflowId: "wf-003", pricingModel: "outcome_based", amount: 450, currency: "USD", status: "charged", createdAt: new Date(Date.now() - 540000).toISOString(), description: "10% of $4,500 savings on SaaS renewal" },
  { id: "b-003", workflowId: "wf-002", pricingModel: "flat", amount: 5, currency: "USD", status: "pending", createdAt: new Date(Date.now() - 30000).toISOString(), description: "Flat fee for information retrieval" },
  { id: "b-004", workflowId: "wf-004", pricingModel: "flat", amount: 2, currency: "USD", status: "charged", createdAt: new Date(Date.now() - 1740000).toISOString(), description: "Flat fee for compliance check" },
];

export const mockLedger: LedgerEntry[] = Array.from({ length: 30 }, (_, i) => {
  const date = new Date();
  date.setDate(date.getDate() - (29 - i));
  const revenue = 800 + Math.random() * 1200;
  const costs = 200 + Math.random() * 300;
  return {
    id: `ledger-${i}`,
    date: date.toISOString().split("T")[0],
    revenue: Math.round(revenue),
    costs: Math.round(costs),
    net: Math.round(revenue - costs),
    transactionCount: Math.floor(20 + Math.random() * 40),
  };
});

export const mockDashboardMetrics: DashboardMetrics = {
  totalWorkflows: 14820,
  successRate: 97.3,
  totalRevenue: 128450,
  activeAgents: 5,
  avgExecutionTime: 4200,
  dailyOutcomes: Array.from({ length: 14 }, (_, i) => {
    const date = new Date();
    date.setDate(date.getDate() - (13 - i));
    return {
      date: date.toISOString().split("T")[0],
      successful: Math.floor(80 + Math.random() * 60),
      failed: Math.floor(2 + Math.random() * 8),
    };
  }),
  revenueOverTime: Array.from({ length: 14 }, (_, i) => {
    const date = new Date();
    date.setDate(date.getDate() - (13 - i));
    return {
      date: date.toISOString().split("T")[0],
      revenue: Math.floor(3000 + Math.random() * 4000),
    };
  }),
  agentUsage: [
    { agent: "Supervisor", tasks: 14820, successRate: 99.2 },
    { agent: "Retrieval", tasks: 8934, successRate: 97.8 },
    { agent: "Negotiation", tasks: 5621, successRate: 94.5 },
    { agent: "Compliance", tasks: 4102, successRate: 99.9 },
    { agent: "Executor", tasks: 3847, successRate: 98.1 },
  ],
};

const agentLog = (agent: string, msg: string, level: "info" | "warn" | "error" = "info"): LogEntry => ({
  id: `log-${Math.random().toString(36).slice(2, 9)}`,
  timestamp: new Date().toISOString(),
  level,
  agent,
  message: msg,
});

export const mockLogs: LogEntry[] = [
  agentLog("Supervisor", "Received task: Purchase 500 units of steel"),
  agentLog("Supervisor", "Classified intent → purchase"),
  agentLog("Supervisor", "Routing to Retrieval Agent"),
  agentLog("Retrieval Agent", "Searching vendor database…"),
  agentLog("Retrieval Agent", "Found 12 matching vendors"),
  agentLog("Retrieval Agent", "Ranked by relevance score"),
  agentLog("Supervisor", "Routing to Negotiation Agent"),
  agentLog("Negotiation Agent", "Evaluating 12 offers…"),
  agentLog("Negotiation Agent", "Scoring against budget: $25,000"),
  agentLog("Negotiation Agent", "Best offer: SteelCorp @ $42.50/unit"),
  agentLog("Supervisor", "Routing to Compliance Agent"),
  agentLog("Compliance Agent", "Validating budget allocation"),
  agentLog("Compliance Agent", "Policy check: PASSED"),
  agentLog("Supervisor", "Routing to Executor Agent"),
  agentLog("Executor Agent", "Placing purchase order…"),
  agentLog("Executor Agent", "Order confirmed: PO-2026-001847"),
  agentLog("Executor Agent", "Recording outcome: $2,340 saved"),
  agentLog("Supervisor", "Workflow wf-001 completed successfully"),
];

// Generates streaming log entries for the live log viewer
export function generateLogEntry(): LogEntry {
  const entries = [
    agentLog("Supervisor", "Received new task submission"),
    agentLog("Supervisor", "Classifying intent…"),
    agentLog("Supervisor", "Routing to specialized agent"),
    agentLog("Retrieval Agent", "Querying vector store"),
    agentLog("Retrieval Agent", "Embedding similarity search complete"),
    agentLog("Negotiation Agent", "Evaluating marketplace offers"),
    agentLog("Negotiation Agent", "Running offer scoring algorithm"),
    agentLog("Compliance Agent", "Checking organization policies"),
    agentLog("Compliance Agent", "Budget validation passed"),
    agentLog("Executor Agent", "Executing transaction"),
    agentLog("Executor Agent", "Transaction committed to ledger"),
    agentLog("Discovery Agent", "Scanning plugin registry"),
    agentLog("Discovery Agent", "New capability registered"),
    agentLog("Supervisor", "Workflow completed", "info"),
    agentLog("Compliance Agent", "Policy violation detected", "warn"),
    agentLog("Executor Agent", "Transaction timeout — retrying", "error"),
  ];
  const entry = entries[Math.floor(Math.random() * entries.length)];
  return { ...entry, id: `log-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, timestamp: new Date().toISOString() };
}
