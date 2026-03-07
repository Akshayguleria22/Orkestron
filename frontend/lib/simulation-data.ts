// ── Simulation Engine Data ──
// Predefined simulation scenarios with intermediate results and reasoning traces.

import type {
  SimulationStep,
  SimulationRun,
  ArchitectureComponent,
  PlaygroundScenario,
} from "./types";

/**
 * Generate a full simulation run from a task input string.
 * Returns steps with intermediate results, reasoning, and thinking text.
 */
export function createSimulationRun(taskInput: string): SimulationRun {
  return {
    id: `sim-${Date.now()}`,
    taskInput,
    status: "idle",
    steps: [
      {
        agent: "Supervisor",
        status: "pending",
        thinking: "Analyzing user intent and classifying task type…",
        intermediateResults: [
          { label: "Intent", value: "purchase" },
          { label: "Category", value: "hardware" },
          { label: "Priority", value: "cost-optimized" },
        ],
        duration: 800,
      },
      {
        agent: "Retrieval Agent",
        status: "pending",
        thinking: "Searching vendor database and marketplace listings…",
        intermediateResults: [
          { label: "Vendor A", value: "₹4,300", score: 0.82 },
          { label: "Vendor B", value: "₹4,600", score: 0.74 },
          { label: "Vendor C", value: "₹4,100", score: 0.88 },
          { label: "Vendor D", value: "₹4,800", score: 0.65 },
        ],
        duration: 2200,
      },
      {
        agent: "Negotiation Agent",
        status: "pending",
        thinking: "Scoring offers based on price, rating, and delivery…",
        intermediateResults: [
          { label: "Vendor C", value: "Score: 0.88", score: 0.88 },
          { label: "Vendor A", value: "Score: 0.82", score: 0.82 },
          { label: "Vendor B", value: "Score: 0.74", score: 0.74 },
        ],
        reasoning: [
          {
            vendor: "Vendor C",
            attributes: [
              { label: "Price", value: "₹4,100" },
              { label: "Rating", value: "4.7/5" },
              { label: "Delivery", value: "2 days" },
            ],
            score: 0.88,
          },
          {
            vendor: "Vendor A",
            attributes: [
              { label: "Price", value: "₹4,300" },
              { label: "Rating", value: "4.6/5" },
              { label: "Delivery", value: "3 days" },
            ],
            score: 0.82,
          },
          {
            vendor: "Vendor B",
            attributes: [
              { label: "Price", value: "₹4,600" },
              { label: "Rating", value: "4.2/5" },
              { label: "Delivery", value: "5 days" },
            ],
            score: 0.74,
          },
        ],
        duration: 1800,
      },
      {
        agent: "Compliance Agent",
        status: "pending",
        thinking: "Validating budget constraints and delivery requirements…",
        intermediateResults: [
          { label: "Budget check", value: "✓ Passed" },
          { label: "Delivery constraint", value: "✓ Passed" },
          { label: "Policy validation", value: "✓ Passed" },
        ],
        duration: 1000,
      },
      {
        agent: "Executor Agent",
        status: "pending",
        thinking: "Executing purchase transaction with Vendor C…",
        intermediateResults: [
          { label: "Transaction", value: "Executed" },
          { label: "Order ID", value: "PO-2026-001847" },
          { label: "Savings", value: "₹900" },
        ],
        duration: 1500,
      },
    ],
    totalSavings: 900,
    finalOutcome: "Purchased 16GB RAM from Vendor C at ₹4,100 — saved ₹900",
  };
}

// ── Architecture Components ──

export const architectureComponents: ArchitectureComponent[] = [
  {
    id: "supervisor",
    name: "Supervisor Agent",
    category: "core",
    description: "Central orchestrator that classifies intent and routes tasks to specialized agents.",
    details: [
      "Keyword-based intent classification",
      "LangGraph state machine routing",
      "Delegation token issuance",
      "Workflow lifecycle management",
    ],
    connections: ["retrieval", "negotiation", "compliance", "executor", "discovery"],
    icon: "brain",
  },
  {
    id: "retrieval",
    name: "Retrieval Agent",
    category: "agent",
    description: "Searches vendor databases using vector embeddings and semantic similarity.",
    details: [
      "Qdrant vector store integration",
      "Sentence transformer embeddings",
      "Contextual re-ranking",
      "Multi-source aggregation",
    ],
    connections: ["vector-store", "supervisor"],
    icon: "search",
  },
  {
    id: "negotiation",
    name: "Negotiation Agent",
    category: "agent",
    description: "Scores marketplace offers and negotiates optimal pricing against constraints.",
    details: [
      "Multi-attribute scoring algorithm",
      "Budget-aware optimization",
      "Marketplace protocol support",
      "Counter-offer generation",
    ],
    connections: ["marketplace", "supervisor"],
    icon: "handshake",
  },
  {
    id: "compliance",
    name: "Compliance Agent",
    category: "agent",
    description: "Validates transactions against organizational policies and regulatory requirements.",
    details: [
      "Policy rule engine",
      "Budget allocation verification",
      "Regulatory compliance checks",
      "Audit trail generation",
    ],
    connections: ["audit-log", "supervisor"],
    icon: "shield",
  },
  {
    id: "executor",
    name: "Executor Agent",
    category: "agent",
    description: "Executes approved transactions, places orders, and records outcomes.",
    details: [
      "Transaction execution engine",
      "Order placement integration",
      "Outcome recording to ledger",
      "Settlement confirmation",
    ],
    connections: ["billing", "supervisor"],
    icon: "play",
  },
  {
    id: "discovery",
    name: "Discovery Agent",
    category: "agent",
    description: "Discovers and registers third-party agent plugins from the capability marketplace.",
    details: [
      "Plugin manifest validation",
      "Dynamic capability matching",
      "Hot-reload plugin system",
      "Version compatibility checks",
    ],
    connections: ["marketplace", "supervisor"],
    icon: "radar",
  },
  {
    id: "vector-store",
    name: "Vector Memory",
    category: "storage",
    description: "Qdrant-powered vector store for semantic search and contextual retrieval.",
    details: [
      "Qdrant v1.12.5",
      "384-dim sentence embeddings",
      "Cosine similarity search",
      "Persistent on-disk storage",
    ],
    connections: ["retrieval"],
    icon: "database",
  },
  {
    id: "redis-cache",
    name: "Redis Cache",
    category: "storage",
    description: "Semantic cache layer that eliminates redundant LLM calls using vector similarity.",
    details: [
      "Redis 7 with RediSearch",
      "Similarity threshold: 0.92",
      "TTL-based expiration",
      "Cache hit rate tracking",
    ],
    connections: ["supervisor"],
    icon: "zap",
  },
  {
    id: "postgres",
    name: "PostgreSQL",
    category: "storage",
    description: "Primary relational database for audit logs, billing records, and agent registry.",
    details: [
      "PostgreSQL 16",
      "SQLAlchemy ORM models",
      "Hash-chain audit trail",
      "Migration support via Alembic",
    ],
    connections: ["audit-log", "billing"],
    icon: "hardDrive",
  },
  {
    id: "billing",
    name: "Billing Engine",
    category: "infrastructure",
    description: "Outcome-based billing engine with flat, percentage, and savings-based pricing.",
    details: [
      "Outcome tracking per workflow",
      "Multiple pricing models",
      "Ledger entry generation",
      "Revenue analytics",
    ],
    connections: ["executor", "postgres"],
    icon: "receipt",
  },
  {
    id: "marketplace",
    name: "Agent Marketplace",
    category: "infrastructure",
    description: "Capability marketplace for discovering and deploying third-party agents.",
    details: [
      "Vendor registry",
      "Capability matching",
      "Negotiation protocol",
      "SLA enforcement",
    ],
    connections: ["negotiation", "discovery"],
    icon: "store",
  },
  {
    id: "audit-log",
    name: "Audit Trail",
    category: "infrastructure",
    description: "Tamper-evident hash-chain audit log for complete execution accountability.",
    details: [
      "SHA-256 hash chain",
      "Immutable append-only log",
      "Full workflow replay",
      "Compliance reporting",
    ],
    connections: ["compliance", "postgres"],
    icon: "fileText",
  },
  {
    id: "monitoring",
    name: "Monitoring Stack",
    category: "infrastructure",
    description: "Prometheus metrics, Grafana dashboards, and Loki log aggregation.",
    details: [
      "10 Prometheus counters/histograms",
      "Grafana auto-provisioned",
      "Loki + Promtail log pipeline",
      "Real-time alerting",
    ],
    connections: ["supervisor"],
    icon: "activity",
  },
];

// ── Training Playground Scenarios ──

export const playgroundScenarios: PlaygroundScenario[] = [
  {
    id: "s-001",
    name: "Budget Purchase",
    description: "Find the best product under a budget constraint",
    taskInput: "Buy best 16GB RAM under ₹5,000",
    expectedOutcome: "Purchase at optimal price with maximum savings",
    difficulty: "easy",
  },
  {
    id: "s-002",
    name: "Multi-Vendor Negotiation",
    description: "Negotiate across multiple vendors for bulk pricing",
    taskInput: "Negotiate bulk pricing for 100 SSDs from top 3 vendors",
    expectedOutcome: "Secured 15-25% discount through competitive bidding",
    difficulty: "medium",
  },
  {
    id: "s-003",
    name: "Compliance-Heavy Purchase",
    description: "Execute a purchase with strict regulatory requirements",
    taskInput: "Procure GDPR-compliant cloud storage for EU data",
    expectedOutcome: "Vendor selected passes all compliance checks",
    difficulty: "hard",
  },
  {
    id: "s-004",
    name: "Service Renewal",
    description: "Renegotiate an expiring SaaS license",
    taskInput: "Negotiate SaaS license renewal with Acme Corp",
    expectedOutcome: "Renewed at 15% discount, saving ₹4,500",
    difficulty: "medium",
  },
  {
    id: "s-005",
    name: "GPU Cloud Search",
    description: "Find cheapest GPU compute for ML training",
    taskInput: "Find cheapest cloud GPU under ₹50,000/month for training",
    expectedOutcome: "Identified optimal provider with cost-performance ratio",
    difficulty: "easy",
  },
];
