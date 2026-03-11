# Orkestron — Autonomous Infrastructure Orchestrator

[![CI](https://github.com/your-org/orkestron/actions/workflows/ci.yml/badge.svg)](https://github.com/your-org/orkestron/actions/workflows/ci.yml)

Production-grade multi-agent AI orchestration platform with LangGraph workflows,
vendor marketplace, outcome-based billing, and a third-party agent plugin ecosystem.

---

## Architecture Summary

```
User
 ↓
API Gateway (FastAPI)  ──►  Prometheus ──► Grafana Dashboards
 ↓
LangGraph Orchestrator
 ↓
Worker Agents (Supervisor → Retrieval → Negotiation → Compliance → Executor)
 ↓                                ↓                    ↓
Tools / Plugin System         VectorDB (Qdrant)    Redis Cache
 ↓
Outcome Tracker ──► Billing Engine ──► Ledger
 ↓
PostgreSQL (Audit Logs + Data)
 ↓
Loki (Structured Logs)
```

See [docs/architecture.md](docs/architecture.md) for detailed diagrams and component descriptions.

---

## Feature List

| Phase | Feature                          | Status |
|-------|----------------------------------|--------|
| 1     | Multi-agent routing              | ✅     |
| 1     | Multi-tenant vector memory       | ✅     |
| 1     | Semantic caching (Redis)         | ✅     |
| 1     | Immutable audit logging          | ✅     |
| 2     | LangGraph orchestration          | ✅     |
| 2     | LLM intent classification       | ✅     |
| 3     | JWT authentication               | ✅     |
| 3     | Delegation tokens (OBO)          | ✅     |
| 3     | Agent registry                   | ✅     |
| 3     | Permission engine                | ✅     |
| 4     | Vendor marketplace               | ✅     |
| 4     | Negotiation engine               | ✅     |
| 4     | Compliance agent                 | ✅     |
| 4     | Outcome tracking                 | ✅     |
| 5     | Outcome-based billing            | ✅     |
| 5     | Invoice generation               | ✅     |
| 6     | Agent capability marketplace     | ✅     |
| 6     | Third-party plugin system        | ✅     |
| 6     | Dynamic agent discovery          | ✅     |
| 7     | Prometheus metrics               | ✅     |
| 7     | Grafana dashboards               | ✅     |
| 7     | Structured logging (Loki)        | ✅     |
| 7     | CI/CD pipeline                   | ✅     |
| 7     | Docker containerization          | ✅     |
| 7     | Architecture documentation       | ✅     |

---

## Installation Guide

### Prerequisites

- **Docker & Docker Compose** — for infrastructure services
- **Python 3.11+** — for the application
- A **Groq API key** — for LLM intent classification ([console.groq.com](https://console.groq.com))

### 1. Clone the repository

```bash
git clone https://github.com/your-org/orkestron.git
cd orkestron
```

### 2. Configure environment

```bash
cp .env.example .env
# Edit .env and set your GROQ_API_KEY
```

### 3. Start infrastructure

```bash
# Core services (PostgreSQL on port 5433, Redis, Qdrant)
docker compose up -d postgres redis qdrant

# Full stack including monitoring (Prometheus, Grafana, Loki)
docker compose up -d
```

> **Note:** PostgreSQL is mapped to port **5433** to avoid conflicts with local PostgreSQL installations.

### 4. Install Python dependencies

```bash
cd backend
python -m venv .venv

# Windows
.venv\Scripts\Activate.ps1

# Linux/macOS
source .venv/bin/activate

pip install -r requirements.txt
```

### 5. Run the API server

```bash
cd backend
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

The API is now live at **http://localhost:8000**.

---

## Running the System

### Service Ports

| Service    | Port  | URL                          |
|------------|-------|------------------------------|
| API        | 8000  | http://localhost:8000        |
| PostgreSQL | 5433  | —                            |
| Redis      | 6379  | —                            |
| Qdrant     | 6333  | http://localhost:6333        |
| Prometheus | 9090  | http://localhost:9090        |
| Grafana    | 3000  | http://localhost:3000        |
| Loki       | 3100  | http://localhost:3100        |

**Grafana credentials:** `admin` / `orkestron`

### Docker Build

```bash
docker build -t orkestron ./backend
docker run -p 8000:8000 --env-file .env orkestron
```

---

## API Endpoints

### Authentication

```bash
# Get a JWT token
curl -X POST http://localhost:8000/auth/token \
  -H "Content-Type: application/json" \
  -d '{"user_id": "user-1", "tenant_id": "tenant-acme"}'
```

### Task Orchestration

```bash
# Submit a task
curl -X POST http://localhost:8000/task \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"input": "buy 500 units of steel"}'
```

### Agent Marketplace

```bash
# Register a developer
curl -X POST http://localhost:8000/developers/register \
  -H "Content-Type: application/json" \
  -d '{"name": "Acme Dev", "email": "dev@acme.com"}'

# Discover agents
curl http://localhost:8000/agents/discover?capability=price_negotiation

# List capabilities
curl http://localhost:8000/agents/capabilities
```

### Billing

```bash
# View billing ledger
curl http://localhost:8000/billing/ledger/user-1 \
  -H "Authorization: Bearer <token>"

# Generate invoice
curl -X POST http://localhost:8000/billing/invoice/user-1 \
  -H "Authorization: Bearer <token>"
```

### Monitoring

```bash
# Prometheus metrics
curl http://localhost:8000/metrics

# Health check
curl http://localhost:8000/health
```

---

## Example Workflow

```bash
# 1. Get a token
TOKEN=$(curl -s -X POST http://localhost:8000/auth/token \
  -H "Content-Type: application/json" \
  -d '{"user_id":"user-1","tenant_id":"tenant-acme"}' | python -c "import sys,json;print(json.load(sys.stdin)['access_token'])")

# 2. Submit a purchase task
curl -s -X POST http://localhost:8000/task \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"input":"buy 500 units of industrial steel"}' | python -m json.tool
```

Or run the demo script:

```bash
cd backend
python scripts/demo_workflow.py
```

---

## Project Structure

```
orkestron/
├── backend/                           # FastAPI backend
│   ├── app/
│   │   ├── main.py                    # FastAPI gateway (v0.8.0)
│   │   ├── config.py                  # Environment configuration
│   │   ├── agents/                    # AI agent modules
│   │   ├── auth/                      # JWT + OAuth2 authentication
│   │   ├── audit/                     # SHA-256 proof-of-action logger
│   │   ├── billing/                   # Outcome-based billing engine
│   │   ├── cache/                     # Redis semantic cache
│   │   ├── developers/               # Third-party developer management
│   │   ├── identity/                  # Agent identity registry
│   │   ├── marketplace/              # Vendor marketplace + negotiation
│   │   ├── memory/                    # Multi-tenant Qdrant memory
│   │   ├── models/                    # SQLAlchemy ORM models
│   │   ├── observability/            # Prometheus metrics + logging
│   │   ├── outcomes/                  # Transaction outcome tracking
│   │   ├── security/                  # Permission engine + rate limiter
│   │   └── services/                  # Product, workflow, analytics services
│   ├── tests/                         # Test suite
│   ├── scripts/                       # Demo scripts
│   ├── Dockerfile                     # Backend container
│   └── requirements.txt              # Python dependencies
├── frontend/                          # Next.js 14 dashboard
├── monitoring/                        # Prometheus, Grafana, Loki configs
├── deploy/nginx/                      # Nginx reverse proxy config
├── docs/                              # Architecture documentation
├── .github/workflows/                 # CI/CD pipeline
├── docker-compose.yml                # Infrastructure services
├── .env.example                       # Environment template
└── README.md                          # This file
```

---

## Testing

```bash
cd backend

# Install test dependencies
pip install pytest pytest-asyncio httpx

# Run all tests
pytest tests/ -v

# Run specific test module
pytest tests/test_billing.py -v
```

---

## Future Roadmap

- [ ] Kubernetes deployment manifests (Helm chart)
- [ ] Real-time WebSocket task streaming
- [ ] Agent-to-agent direct communication protocol
- [ ] Multi-LLM provider support (OpenAI, Anthropic, local models)
- [ ] SLA monitoring and alerting rules
- [ ] Plugin marketplace web UI
- [ ] A/B testing for agent routing strategies
- [ ] Rate limiting and request throttling
- [ ] Distributed tracing (OpenTelemetry)
- [ ] Multi-region deployment support

---

## License

MIT
