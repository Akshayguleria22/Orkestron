# Orkestron Backend

FastAPI backend for the Orkestron autonomous infrastructure orchestrator.

## Quick Start

### 1. Start Infrastructure (Docker)

From the **project root** (`Orkestron/`):

```bash
docker compose up -d
```

This starts PostgreSQL, Redis, and Qdrant. Wait ~10 seconds for them to be healthy.

> **Note:** Docker Postgres is mapped to port **5433** (not 5432) to avoid conflicts with any local PostgreSQL installation.

### 2. Reset Postgres Password (if needed)

If you lost your Postgres password or need to reset it:

```bash
# Stop and remove the old postgres container + data
docker compose down -v

# Start fresh (uses password from docker-compose.yml: orkestron2026)
docker compose up -d
```

The password is defined in `docker-compose.yml` → `POSTGRES_PASSWORD`.  
It must match `POSTGRES_PASSWORD` in your `.env` file.

### 3. Set Up Python Environment

Use `backend/.venv` as the only supported Python environment for this project.

```bash
cd backend

# Create virtual environment
python -m venv .venv

# Activate it
# Windows:
.venv\Scripts\Activate.ps1
# Linux/Mac:
source .venv/bin/activate

# Install dependencies
pip install -r requirements.txt
```

### 4. Configure Environment

Edit `backend/.env` (or `Orkestron/.env` — both are checked):

```env
POSTGRES_USER=postgres
POSTGRES_PASSWORD=orkestron2026
POSTGRES_HOST=localhost
POSTGRES_PORT=5433
POSTGRES_DB=orkestron
REDIS_URL=redis://localhost:6379/0
QDRANT_HOST=localhost
QDRANT_PORT=6333
GROQ_API_KEY=your-groq-key
JWT_SECRET=your-secret-key
SERPER_API_KEY=your-serper-key
SERPAPI_API_KEY=your-serpapi-key
```

`SERPER_API_KEY` or `SERPAPI_API_KEY` is recommended for reliable web search in production.

### 5. Run the Server

```bash
cd backend
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

# In another terminal (same virtualenv), run queue worker
python -m app.jobs.worker
```

The API will be at `http://localhost:8000`.  
Docs at `http://localhost:8000/docs`.

## API Endpoints

### Auth
- `POST /auth/token` — Get JWT token (userId + tenantId)
- `GET /auth/oauth/{provider}/authorize` — OAuth2 login URL  
- `POST /auth/oauth/{provider}/callback` — OAuth2 code exchange
- `POST /auth/refresh` — Refresh access token
- `POST /auth/logout` — Revoke refresh token
- `GET /auth/me` — Current user info

### Tasks
- `POST /tasks/real` — Submit orchestration task to async queue (requires JWT)
- `GET /tasks/{task_id}` — Poll status and result
- `GET /tasks/real/{task_id}` — Backward-compatible poll endpoint
- `GET /tasks/real/{task_id}/logs` — Agent execution logs

### Workflows
- `POST /workflows` — Create workflow
- `GET /workflows` — List user workflows
- `GET /workflows/{id}` — Get workflow
- `PUT /workflows/{id}` — Update workflow
- `DELETE /workflows/{id}` — Delete workflow
- `POST /workflows/{id}/run` — Execute workflow
- `GET /workflows/{id}/runs` — List workflow runs

### Products & Vendors
- `GET /products` — Search products (filters: category, vendor_id, min_price, max_price, search)
- `GET /products/{id}` — Get product
- `GET /products/categories/list` — List categories
- `GET /products/stats/overview` — Product stats
- `GET /vendors` — List vendors
- `GET /vendors/analytics` — Vendor analytics

### Analytics
- `GET /analytics/dashboard` — Dashboard overview
- `GET /analytics/daily-outcomes` — Daily success/failure
- `GET /analytics/revenue` — Revenue over time
- `GET /analytics/agent-usage` — Agent usage stats
- `GET /analytics/workflow-stats` — Workflow analytics

### Agents
- `GET /agents/{id}` — Get agent
- `POST /agents/register` — Register agent
- `GET /agents/capabilities` — List capabilities
- `GET /agents/discover?capability=X` — Find agent for capability

### Billing
- `GET /billing/ledger/{user_id}` — User billing ledger
- `POST /billing/invoice/{user_id}` — Generate invoice
- `GET /billing/invoices/{user_id}` — List invoices

### Other
- `GET /health` — Health check
- `GET /metrics` — Prometheus metrics
- `WebSocket /ws/{user_id}` — Live workflow updates

## Project Structure

```
backend/
├── app/
│   ├── agents/          # LangGraph agent nodes (supervisor, retrieval, negotiation, compliance, executor)
│   ├── audit/           # Proof-of-action SHA-256 audit logger
│   ├── auth/            # JWT auth, OAuth2, refresh tokens, delegation tokens
│   ├── billing/         # Billing engine, ledger, invoices, pricing models
│   ├── cache/           # Redis + SentenceTransformer semantic cache
│   ├── developers/      # Third-party developer registration
│   ├── identity/        # Agent registry
│   ├── marketplace/     # Vendor registry, offer engine, negotiation engine
│   ├── memory/          # Qdrant vector store
│   ├── models/          # SQLAlchemy ORM models (12 tables)
│   ├── observability/   # Structured logging + Prometheus metrics
│   ├── outcomes/        # Outcome tracking
│   ├── security/        # Permission engine, rate limiter
│   ├── services/        # Business logic (products, workflows, analytics, WebSocket, tools)
│   ├── config.py        # Pydantic settings (loads .env)
│   └── main.py          # FastAPI app with all routes
├── tests/               # Test suite
├── scripts/             # Demo/utility scripts
├── requirements.txt     # Python dependencies
├── Dockerfile           # Container build
└── .env                 # Environment variables (git-ignored)
```
