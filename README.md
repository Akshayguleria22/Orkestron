# Orkestron — Autonomous Infrastructure Orchestrator

Production-grade multi-agent orchestration platform with deterministic routing, multi-tenant vector memory, semantic caching, and immutable audit logging.

## Architecture

```
User Request
  → FastAPI API Gateway (/task)
  → Supervisor Agent (deterministic keyword router)
  → Worker Agents (retrieval / negotiation / compliance / executor)
  → Tool Execution Layer
  → Vector Memory (Qdrant, per-tenant) + Semantic Cache (Redis)
  → Proof-of-Action Audit Logger (SHA-256 → PostgreSQL)
```

## Prerequisites

- **Docker & Docker Compose** — for PostgreSQL, Redis, Qdrant
- **Python 3.11+** — for the application
- A **Groq API key** (set in `.env`)

## Quick Start

### 1. Clone & configure

```bash
cp .env.example .env
# Edit .env and set your GROQ_API_KEY
```

### 2. Start infrastructure

```bash
docker-compose up -d
```

This spins up:

| Service    | Port  |
|------------|-------|
| PostgreSQL | 5432  |
| Redis      | 6379  |
| Qdrant     | 6333  |

### 3. Install Python dependencies

```bash
python -m venv venv
# Windows
venv\Scripts\activate
# Linux/macOS
source venv/bin/activate

pip install -r requirements.txt
```

### 4. Run the API server

```bash
uvicorn app.main:app --reload
```

The API is now live at **http://127.0.0.1:8000**.

## API Reference

### `POST /task`

Orchestrate a task through the agent pipeline.

**Request body:**

```json
{
  "user_id": "user-1",
  "tenant_id": "tenant-acme",
  "input": "buy 500 units of steel"
}
```

**Response:**

```json
{
  "status": "ok",
  "agent": "retrieval",
  "response": "[RetrievalAgent] Retrieved relevant data for tenant 'tenant-acme': mock results for query 'buy 500 units of steel'",
  "audit_hash": "a1b2c3...sha256...",
  "cached": false
}
```

### `GET /health`

Health check endpoint.

## Routing Rules (Supervisor)

| Keywords                                  | Agent       |
|-------------------------------------------|-------------|
| buy, purchase, find, search, retrieve     | retrieval   |
| negotiate, deal, bargain, offer           | negotiation |
| comply, compliance, policy, audit, regulation | compliance |
| execute, run, deploy, launch              | executor    |
| *(no match)*                              | retrieval (default) |

## Project Structure

```
orkestron/
├── app/
│   ├── main.py              # FastAPI gateway
│   ├── config.py             # Environment config (pydantic-settings)
│   ├── agents/
│   │   ├── supervisor.py     # Deterministic router
│   │   ├── retrieval.py      # Retrieval worker
│   │   ├── negotiation.py    # Negotiation worker
│   │   ├── compliance.py     # Compliance worker
│   │   └── executor.py       # Executor worker
│   ├── memory/
│   │   └── vector_store.py   # Multi-tenant Qdrant memory
│   ├── cache/
│   │   └── semantic_cache.py # Redis semantic cache
│   ├── audit/
│   │   └── logger.py         # SHA-256 proof-of-action logger
│   ├── models/
│   │   └── db.py             # SQLAlchemy models + engine
│   └── services/             # Future service modules
├── docker-compose.yml
├── requirements.txt
├── .env.example
└── README.md
```

## Phase 1 Capabilities

- **Multi-agent routing** — deterministic keyword-based supervisor
- **Multi-tenant vector memory** — Qdrant with tenant_id filtering
- **Semantic caching** — cosine-similarity dedup via Redis + SentenceTransformers
- **Immutable audit logging** — SHA-256 hashed proof-of-action in PostgreSQL
- **API-based orchestration** — single `/task` endpoint for all operations
