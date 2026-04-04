# Orkestron

[![CI](https://github.com/your-org/orkestron/actions/workflows/ci.yml/badge.svg)](https://github.com/your-org/orkestron/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

Autonomous, production-oriented multi-agent orchestration platform built with FastAPI and Next.js.

Orkestron executes natural-language tasks through coordinated AI agents (planning, retrieval, reasoning, comparison, synthesis), with observability, billing, and a plugin-capable marketplace architecture.

## Table of Contents

- [Why Orkestron](#why-orkestron)
- [Core Capabilities](#core-capabilities)
- [Architecture](#architecture)
- [Tech Stack](#tech-stack)
- [Repository Structure](#repository-structure)
- [Quick Start (Local)](#quick-start-local)
- [Deploy Now (Production)](#deploy-now-production)
- [API Quick Examples](#api-quick-examples)
- [Testing](#testing)
- [Observability](#observability)
- [Troubleshooting](#troubleshooting)
- [Roadmap](#roadmap)
- [Contributing](#contributing)
- [License](#license)

## Why Orkestron

Orkestron is designed for teams that need:

- Real multi-agent task execution (not mock chains)
- Structured outcomes with traceable execution paths
- Built-in auth, policy, and auditability
- Operational visibility (Prometheus, Grafana, Loki)
- Extensibility through agent registry and capability marketplace

## Core Capabilities

- Dynamic task planning and routing
- Multi-step execution via specialized agents
- Semantic caching via Redis
- Vector memory with Qdrant
- JWT auth + OAuth support
- Outcome tracking, ledger, and invoice generation
- Plugin/developer ecosystem with capability discovery
- End-to-end observability and metrics

## Architecture

```
User
 ↓
API Gateway (FastAPI)  -->  Prometheus --> Grafana
 ↓
LangGraph-style Dynamic Orchestrator
 ↓
Planner -> Search -> Extraction -> Reasoning -> Comparison -> Result
 ↓
Outcome Tracker --> Billing Engine --> Ledger/Invoices
 ↓
PostgreSQL + Redis + Qdrant + Loki
```

Detailed architecture docs: [docs/architecture.md](docs/architecture.md)

## Tech Stack

- Backend: FastAPI, SQLAlchemy (async), RQ workers
- Frontend: Next.js 14, TypeScript, Tailwind CSS
- Datastores: PostgreSQL, Redis, Qdrant
- Monitoring: Prometheus, Grafana, Loki, Promtail
- Infra: Docker Compose

## Repository Structure

```
Orkestron/
|- backend/                 # FastAPI API, agents, auth, billing, worker
|- frontend/                # Next.js dashboard and UX
|- monitoring/              # Prometheus/Grafana/Loki/Promtail configs
|- deploy/nginx/            # Nginx reverse proxy config
|- docs/                    # Architecture and deployment docs
|- docker-compose.yml       # Local infra + monitoring + worker
|- docker-compose.prod.yml  # Full production-oriented stack
`- README.md
```

## Quick Start (Local)

### Prerequisites

- Docker + Docker Compose
- Python 3.11+
- Node.js 20+
- Groq API key

### 1. Clone and configure env

```bash
git clone https://github.com/your-org/orkestron.git
cd Orkestron
cp .env.example .env
```

Set at least:

- `GROQ_API_KEY`
- `JWT_SECRET` (non-default)

### 2. Start infrastructure

```bash
# Core services
docker compose up -d postgres redis qdrant

# Optional: full local stack with monitoring + worker
docker compose up -d
```

### 3. Start backend API

```bash
cd backend
python -m venv .venv

# Windows
.venv\Scripts\Activate.ps1

# Linux/macOS
# source .venv/bin/activate

pip install -r requirements.txt
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

In another terminal (same virtualenv):

```bash
cd backend
python -m app.jobs.worker
```

### 4. Start frontend

```bash
cd frontend
npm install
npm run dev
```

Frontend: `http://localhost:3000`  
Backend API: `http://localhost:8000`  
API docs: `http://localhost:8000/docs`

## Deploy Now (Production)

If you want this online now, this is the fastest single-server path.

### 1. Provision server

- Ubuntu 22.04 LTS (or similar)
- Open ports: `80`, `443`, `22`

Install runtime:

```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y docker.io docker-compose-plugin git
sudo usermod -aG docker $USER
newgrp docker
```

### 2. Clone repo and create production env file

```bash
git clone https://github.com/your-org/orkestron.git
cd Orkestron
cp .env.example .env.prod
```

Edit `.env.prod` and add/update:

```env
DB_PASSWORD=<strong-password>
JWT_SECRET=<very-strong-secret>
GRAFANA_PASSWORD=<grafana-admin-password>

# Frontend public API base (important)
API_URL=https://your-domain.com/api

# Required for real AI execution
GROQ_API_KEY=<your-groq-key>

# Optional OAuth
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GITHUB_CLIENT_ID=
GITHUB_CLIENT_SECRET=
```

### 3. Configure domain and TLS

Update server name in `deploy/nginx/orkestron.conf`.

Put certs in:

- `deploy/nginx/ssl/cert.pem`
- `deploy/nginx/ssl/key.pem`

### 4. Launch stack

```bash
docker compose -f docker-compose.prod.yml --env-file .env.prod up -d --build
```

### 5. Verify deployment

```bash
docker compose -f docker-compose.prod.yml ps
docker compose -f docker-compose.prod.yml logs -f api
curl -f https://your-domain.com/api/health
```

More deployment patterns (AWS/Vercel/ECS): [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)

## API Quick Examples

### Get token

```bash
curl -X POST http://localhost:8000/auth/token \
  -H "Content-Type: application/json" \
  -d '{"user_id":"user-1","tenant_id":"tenant-acme"}'
```

### Submit task

```bash
curl -X POST http://localhost:8000/tasks/real \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"input":"buy 500 units of steel"}'
```

### Poll task

```bash
curl -X GET http://localhost:8000/tasks/<task_id> \
  -H "Authorization: Bearer <token>"
```

## Testing

```bash
cd backend
pip install pytest pytest-asyncio httpx
pytest tests/ -v
```

## Observability

- Prometheus: `http://localhost:9090`
- Grafana: `http://localhost:3000` (local compose), admin/orkestron
- Loki: `http://localhost:3100`

## Troubleshooting

### Frontend webpack cache ENOENT in `.next/cache`

```bash
cd frontend
rm -rf .next
npm run dev
```

### Worker not processing tasks

- Ensure Redis is up: `docker compose ps`
- Ensure worker is running: `python -m app.jobs.worker`

### API cannot connect to Postgres

- Confirm Postgres is healthy and mapped to `5433` locally
- Verify `.env` values match compose values

## Roadmap

- Kubernetes manifests and Helm chart
- Real-time task streaming UX
- Multi-LLM provider support
- OpenTelemetry distributed tracing
- Multi-region deployment support

## Contributing

1. Fork the repo
2. Create a feature branch
3. Add tests for your changes
4. Open a PR with clear description

## License

MIT
