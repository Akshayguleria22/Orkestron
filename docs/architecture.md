# Orkestron — Architecture Documentation

## System Overview

Orkestron is an autonomous infrastructure orchestration platform that uses
multi-agent AI workflows to handle procurement, negotiation, compliance
checking, and transaction execution. It provides a production-grade backend
with identity management, delegation tokens, a vendor marketplace,
outcome-based billing, and a third-party agent plugin ecosystem.

```
┌─────────────────────────────────────────────────────────────────────┐
│                          User / Client                              │
└─────────────────────┬───────────────────────────────────────────────┘
                      │  HTTP + JWT
                      ▼
┌─────────────────────────────────────────────────────────────────────┐
│                     FastAPI API Gateway                              │
│  ┌────────────┐  ┌──────────────┐  ┌────────────┐  ┌────────────┐  │
│  │ Auth (JWT) │  │ Delegation   │  │ Semantic   │  │ Metrics    │  │
│  │            │  │ Tokens       │  │ Cache      │  │ Middleware │  │
│  └────────────┘  └──────────────┘  └────────────┘  └────────────┘  │
└─────────────────────┬───────────────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────────────┐
│                  LangGraph Orchestrator                              │
│                                                                     │
│  supervisor ──► retrieval ──► negotiation ──► compliance            │
│       │                                          │                  │
│       │              ┌───────────────────────────┘                  │
│       │              ▼                                              │
│       └──────► executor ──► outcome_tracker ──► billing ──► END     │
│                                                                     │
└──────┬──────────┬──────────┬──────────┬─────────────────────────────┘
       │          │          │          │
       ▼          ▼          ▼          ▼
  ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐
  │ Tools  │ │VectorDB│ │ Redis  │ │Postgres│
  │        │ │(Qdrant)│ │ Cache  │ │ Audit  │
  └────────┘ └────────┘ └────────┘ └────────┘
```

---

## Core Components

### 1. FastAPI API Gateway (`app/main.py`)

The single entry point for all requests. Handles:

- **JWT authentication** — user tokens with tenant isolation
- **Delegation tokens** — short-lived OBO tokens for agent-to-agent calls
- **Semantic cache** — cosine-similarity deduplication via Redis
- **Request routing** — dispatches to the LangGraph orchestrator
- **Metrics middleware** — Prometheus counters and histograms for every HTTP request

**Key endpoints:**

| Method | Path                         | Description                        |
|--------|------------------------------|------------------------------------|
| POST   | `/auth/token`                | Issue a user JWT                   |
| POST   | `/task`                      | Submit a task for orchestration     |
| POST   | `/agents/register`           | Register an agent identity          |
| GET    | `/agents/{agent_id}`         | Look up an agent                    |
| POST   | `/agents/capabilities`       | Publish an agent capability         |
| GET    | `/agents/capabilities`       | List published capabilities         |
| GET    | `/agents/discover`           | Discover agent for a capability     |
| POST   | `/developers/register`       | Register a third-party developer    |
| GET    | `/vendors`                   | List marketplace vendors            |
| GET    | `/outcomes/{user_id}`        | Get user's transaction outcomes     |
| GET    | `/billing/ledger/{user_id}`  | Get user's billing ledger           |
| POST   | `/billing/invoice/{user_id}` | Generate an invoice                 |
| GET    | `/billing/invoices/{user_id}`| List user's invoices                |
| GET    | `/billing/invoice/detail/{id}`| Get invoice details                |
| GET    | `/metrics`                   | Prometheus scrape endpoint          |
| GET    | `/health`                    | Health check                        |

### 2. Configuration (`app/config.py`)

Central configuration via `pydantic-settings`. Loads from `.env` file:

- Database connection strings (PostgreSQL, Redis, Qdrant)
- Groq API key for LLM-based intent classification
- JWT secrets and token expiry settings
- Embedding model selection
- Cache similarity threshold

---

## Multi-Agent Orchestration

### LangGraph StateGraph (`app/agents/orchestrator.py`)

The workflow engine is a compiled LangGraph `StateGraph` with the following
topology:

```
                    ┌──────────────┐
                    │  supervisor  │  ← Intent classification
                    └──────┬───────┘
                           │
                    ┌──────▼───────┐
                    │  retrieval   │  ← Vector search + context
                    └──────┬───────┘
                           │
              ┌────────────┼────────────┐
              │            │            │
   purchase/negotiation  compliance  info/execution
              │            │            │
     ┌────────▼───────┐   │   ┌────────▼───────┐
     │  negotiation   │   │   │    executor     │
     └────────┬───────┘   │   └────────┬───────┘
              │            │            │
     ┌────────▼───────┐   │            │
     │   compliance   │   │            │
     └────────┬───────┘   │            │
              │            │            │
     pass ────┤            │            │
     fail ────► negotiation│            │
              (max 3 loops)│            │
              │            │            │
     ┌────────▼────────────▼────────────▼──────┐
     │              executor                    │
     └─────────────────┬──────────────────────-─┘
                       │
     ┌─────────────────▼──────────────────────-─┐
     │          outcome_tracker                   │
     └─────────────────┬────────────────────────-┘
                       │
     ┌─────────────────▼──────────────────────-─┐
     │             billing                        │
     └─────────────────┬────────────────────────-┘
                       │
                      END
```

### Shared State (`app/agents/state.py`)

`GraphState` is a `TypedDict` with 27 fields spanning:

- **Identity**: `user_id`, `tenant_id`, `agent_id`
- **Security**: `delegation_token`, `delegation_token_id`
- **Workflow**: `input`, `intent`, `agent_path`, `iteration_count`
- **Retrieval**: `retrieved_context`, `retrieval_error`
- **Marketplace**: `marketplace_offers`, `marketplace_budget`
- **Negotiation**: `negotiation_result`
- **Compliance**: `compliance_status`, `compliance_violations`
- **Execution**: `final_result`, `tool_outputs`, `execution_error`, `transaction`
- **Outcomes**: `outcome`, `savings`
- **Billing**: `billing_entry`
- **Discovery**: `discovered_agent`
- **Audit**: `audit_hash`, `authorization_error`

### Worker Agents

| Agent           | Module                       | Role                              |
|-----------------|------------------------------|-----------------------------------|
| Supervisor      | `app/agents/supervisor.py`   | Intent classification + routing   |
| Retrieval       | `app/agents/retrieval.py`    | Vector search, context retrieval  |
| Negotiation     | `app/agents/negotiation.py`  | Vendor offer negotiation          |
| Compliance      | `app/agents/compliance.py`   | Policy validation                 |
| Executor        | `app/agents/executor.py`     | Transaction execution             |

---

## Identity and Delegation

### JWT Authentication (`app/auth/auth_service.py`)

- User tokens: HS256, 60-minute expiry
- Contains: `sub` (user_id), `tenant_id`, `roles`, `permissions`

### Delegation Tokens (`app/auth/token_service.py`)

- On-Behalf-Of (OBO) model for agent-to-agent calls
- 15-minute expiry, scoped to specific operations
- Each token has a unique `token_id` for audit tracking

### Permission Engine (`app/security/permission_engine.py`)

Three-layer authorization check:
1. **Agent capability** — does the agent have the required capability?
2. **Delegation scope** — is the operation within the delegation token's scope?
3. **Tenant isolation** — does the token belong to the correct tenant?

### Agent Registry (`app/identity/agent_registry.py`)

Five default agents registered on startup:
- `agent-supervisor`, `agent-retrieval`, `agent-negotiation`,
  `agent-compliance`, `agent-executor`

Each agent has: `agent_id`, `name`, `public_key`, `capabilities`,
`reputation_score`.

---

## Marketplace and Negotiation

### Vendor Registry (`app/marketplace/vendor_registry.py`)

Manages vendor profiles with pricing, categories, and compliance
certifications. Seeded with sample vendors on startup.

### Offer Engine (`app/marketplace/offer_engine.py`)

Generates competitive offers from vendors matching a product search query.

### Negotiation Engine (`app/marketplace/negotiation_engine.py`)

Multi-round price negotiation with vendor scoring based on:
- Price competitiveness
- Compliance status
- Delivery terms
- Reputation score

---

## Outcome-Based Billing

### Outcome Tracker (`app/outcomes/outcome_tracker.py`)

Records every workflow outcome with:
- `outcome_id`, `user_id`, `agent_id`, `task_type`
- `value_generated` (savings achieved)
- Timestamp and result summary

### Billing Engine (`app/billing/billing_engine.py`)

Calculates fees using pricing models:
- **Flat fee** — fixed amount per transaction
- **Percentage** — percentage of transaction value
- **Outcome-based** — percentage of savings generated

### Ledger (`app/billing/ledger.py`)

Immutable billing ledger with entries linked to outcomes by `outcome_id`.

### Invoice Service (`app/billing/invoice_service.py`)

Generates invoices from ledger entries with line items and totals.

---

## Agent Capability Marketplace

### Developer Registration (`app/developers/developer_service.py`)

- Third-party developers register via API
- API keys: `ork_` prefix + 256-bit entropy, stored as SHA-256 hashes
- Developer accounts have status: `active`, `suspended`, `revoked`

### Capability Registry (`app/agents/capability_registry.py`)

- Agents publish capabilities with input/output schemas
- Five core capabilities seeded on startup
- Queryable by `agent_id` or `capability_name`

### Agent Discovery (`app/agents/agent_discovery.py`)

- Maps intents to capabilities to agents
- Ranks agents by reputation score
- Checks both database registry and in-memory plugin registry
- Sync wrappers for LangGraph node compatibility

### Plugin System (`app/agents/plugin_loader.py`)

- Third-party agents loaded from `plugins/<name>/` directories
- Each plugin: `manifest.json` + `agent.py` (exports `execute()`)
- Dynamic import with manifest validation
- Both sync and async `execute()` functions supported

---

## Security Model

```
┌─────────────────────────────────────────┐
│              Security Layers             │
├──────────────────────────────────────────┤
│  1. JWT Authentication (user identity)   │
│  2. Delegation Tokens (agent scoping)    │
│  3. Permission Engine (3-layer authz)    │
│  4. Tenant Isolation (data partitioning) │
│  5. API Key Auth (developer identity)    │
│  6. Audit Logging (SHA-256 proof chain)  │
└──────────────────────────────────────────┘
```

- **JWT tokens** are validated on every request
- **Delegation tokens** limit what agents can do on behalf of users
- **Tenant isolation** ensures data never leaks across organizations
- **API keys** are hashed with SHA-256 before storage
- **Audit hashes** create an immutable proof-of-action chain

---

## Deployment Architecture

### Infrastructure Services

```
┌──────────────────────────────────────────────────────┐
│                  Docker Compose                       │
│                                                      │
│  ┌────────────┐  ┌────────────┐  ┌────────────┐     │
│  │ PostgreSQL │  │   Redis    │  │   Qdrant   │     │
│  │   :5432    │  │   :6379    │  │   :6333    │     │
│  └────────────┘  └────────────┘  └────────────┘     │
│                                                      │
│  ┌────────────┐  ┌────────────┐  ┌────────────┐     │
│  │ Prometheus │  │  Grafana   │  │    Loki    │     │
│  │   :9090    │  │   :3000    │  │   :3100    │     │
│  └────────────┘  └────────────┘  └────────────┘     │
│                                                      │
│  ┌──────────────────────────────────────────────┐   │
│  │              Promtail (log shipper)            │   │
│  └──────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────┘
```

### Application Server

```
uvicorn app.main:app --host 0.0.0.0 --port 8000
```

or via Docker:

```
docker build -t orkestron .
docker run -p 8000:8000 --env-file .env orkestron
```

### Monitoring Access

| Service    | URL                        | Credentials          |
|------------|----------------------------|----------------------|
| API        | http://localhost:8000       | JWT token            |
| Prometheus | http://localhost:9090       | —                    |
| Grafana    | http://localhost:3000       | admin / orkestron    |
| Loki       | http://localhost:3100       | —                    |

---

## Data Flow

```
User Request
  │
  ├─► JWT Validation
  ├─► Semantic Cache Check (Redis)
  │     ├─ HIT  → return cached response
  │     └─ MISS → continue
  ├─► Delegation Token Generation
  ├─► LangGraph Workflow
  │     ├─► Supervisor (intent classification + agent discovery)
  │     ├─► Retrieval (Qdrant vector search)
  │     ├─► Negotiation (vendor offer ranking)
  │     ├─► Compliance (policy validation)
  │     ├─► Executor (transaction execution)
  │     ├─► Outcome Tracker (PostgreSQL)
  │     └─► Billing Engine (ledger entry)
  ├─► Cache Store (Redis)
  ├─► Audit Log (SHA-256 → PostgreSQL)
  └─► Response
```

---

## Observability

### Metrics (Prometheus)

Exposed at `GET /metrics`:

| Metric                        | Type      | Labels                      |
|-------------------------------|-----------|-----------------------------|
| `agent_tasks_total`           | Counter   | `intent`                    |
| `agent_execution_time`        | Histogram | `intent`                    |
| `successful_outcomes_total`   | Counter   | —                           |
| `failed_workflows_total`      | Counter   | `error_type`                |
| `billing_events_total`        | Counter   | `pricing_model`             |
| `plugin_executions_total`     | Counter   | `plugin_name`, `status`     |
| `http_requests_total`         | Counter   | `method`, `endpoint`, `status` |
| `http_request_duration_seconds` | Histogram | `method`, `endpoint`      |
| `cache_hits_total`            | Counter   | —                           |
| `cache_misses_total`          | Counter   | —                           |

### Structured Logging (Loki)

JSON-formatted log entries with fields:
- `timestamp`, `level`, `logger`, `message`
- `user_id`, `agent_id`, `workflow_id`, `task_type`, `status`

### Grafana Dashboards

Pre-provisioned dashboard: **Orkestron Overview**
- Task throughput by intent
- Workflow success/failure rates
- Billing event counts
- Agent execution time percentiles (p50, p95)
- Plugin execution rates
- HTTP request rates and latency

---

## Technology Stack

| Component          | Technology                  | Version     |
|--------------------|-----------------------------|-------------|
| API Framework      | FastAPI                     | 0.135.1     |
| Orchestration      | LangGraph                   | 1.0.10      |
| Database           | PostgreSQL                  | 16-alpine   |
| ORM                | SQLAlchemy (async)          | 2.0.36      |
| Cache              | Redis                       | 7-alpine    |
| Vector Store       | Qdrant                      | 1.12.5      |
| LLM Provider       | Groq (llama-3.1-8b-instant) | 1.0.0       |
| Embeddings         | SentenceTransformers        | 3.3.1       |
| Metrics            | Prometheus                  | 2.51.0      |
| Dashboards         | Grafana                     | 10.4.1      |
| Log Aggregation    | Loki + Promtail             | 2.9.4       |
| Containerization   | Docker Compose              | 3.9         |
| CI/CD              | GitHub Actions              | —           |
