# Orkestron Production Deployment Guide

## Architecture

```
┌─────────────────────────────────────────────────────┐
│                    AWS Cloud                        │
│                                                     │
│  ┌─────────┐    ┌─────────────┐    ┌────────────┐  │
│  │  Route53 │───▸│ ALB / Nginx │───▸│ EC2 / ECS  │  │
│  └─────────┘    └─────────────┘    │            │  │
│                                     │ ┌────────┐ │  │
│                                     │ │Backend │ │  │
│                                     │ └───┬────┘ │  │
│                                     │     │      │  │
│                                     │ ┌───▾────┐ │  │
│                                     │ │Frontend│ │  │
│                                     │ └────────┘ │  │
│                                     └────────────┘  │
│                                          │          │
│  ┌─────────────┐   ┌──────────────┐     │          │
│  │ RDS Postgres │◂──│ ElastiCache  │◂────┘          │
│  │   (16)       │   │ Redis (7)    │                │
│  └─────────────┘   └──────────────┘                │
└─────────────────────────────────────────────────────┘
```

## Option 1: Docker Compose on EC2

### 1. Launch EC2 Instance
- **AMI**: Ubuntu 22.04 LTS
- **Type**: t3.medium (min) or t3.large (recommended)
- **Storage**: 30 GB gp3
- **Security Group**: Allow ports 80, 443, 22

### 2. Install Dependencies
```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y docker.io docker-compose-v2 nginx certbot python3-certbot-nginx
sudo usermod -aG docker $USER
```

### 3. Clone & Configure
```bash
git clone https://github.com/Akshayguleria22/Orkestron.git
cd Orkestron

# Create production env
cat > .env.prod << 'EOF'
DB_PASSWORD=<strong-password>
JWT_SECRET=<random-64-char-string>
GOOGLE_CLIENT_ID=<from-google-console>
GOOGLE_CLIENT_SECRET=<from-google-console>
GITHUB_CLIENT_ID=<from-github-settings>
GITHUB_CLIENT_SECRET=<from-github-settings>
GRAFANA_PASSWORD=<grafana-admin-password>
API_URL=https://yourdomain.com
EOF
```

### 4. Deploy
```bash
docker compose -f docker-compose.prod.yml --env-file .env.prod up -d
```

### 5. SSL with Let's Encrypt
```bash
sudo certbot --nginx -d orkestron.yourdomain.com
```

---

## Option 2: AWS Managed Services

### Frontend → Vercel
```bash
cd frontend
npx vercel --prod
# Set env: NEXT_PUBLIC_API_URL=https://api.orkestron.yourdomain.com
```

### Backend → EC2 or ECS Fargate
```bash
# Build & push to ECR
aws ecr create-repository --repository-name orkestron-api
docker build -t orkestron-api .
docker tag orkestron-api:latest <account>.dkr.ecr.<region>.amazonaws.com/orkestron-api:latest
docker push <account>.dkr.ecr.<region>.amazonaws.com/orkestron-api:latest
```

### Database → RDS PostgreSQL
- Engine: PostgreSQL 16
- Instance: db.t3.micro (dev) / db.r6g.large (prod)
- Multi-AZ: Yes for production
- Backup: 7-day retention

### Cache → ElastiCache Redis
- Engine: Redis 7.x
- Node: cache.t3.micro (dev) / cache.r6g.large (prod)
- Cluster mode: Disabled for simplicity

### Vector Store → Self-hosted Qdrant on EC2
- Run Qdrant container on a dedicated t3.small instance
- Mount EBS volume for persistence

---

## Environment Variables Reference

| Variable | Description | Required |
|---|---|---|
| `DATABASE_URL` | PostgreSQL connection string | Yes |
| `REDIS_URL` | Redis connection string | Yes |
| `QDRANT_URL` | Qdrant REST endpoint | Yes |
| `JWT_SECRET` | Secret for signing tokens | Yes |
| `CORS_ORIGINS` | Allowed frontend origins | Yes |
| `GOOGLE_CLIENT_ID` | Google OAuth client ID | For OAuth |
| `GOOGLE_CLIENT_SECRET` | Google OAuth secret | For OAuth |
| `GITHUB_CLIENT_ID` | GitHub OAuth client ID | For OAuth |
| `GITHUB_CLIENT_SECRET` | GitHub OAuth secret | For OAuth |
| `RATE_LIMIT_PER_MINUTE` | API rate limit (default: 60) | No |
| `GRAFANA_PASSWORD` | Grafana admin password | No |

---

## Health Checks

```bash
# Backend health
curl https://yourdomain.com/api/health

# Frontend
curl https://yourdomain.com

# Grafana (monitoring)
curl http://yourdomain.com:3001/api/health
```

## Monitoring

- **Grafana**: Port 3001 — dashboards for API latency, agent usage, workflow outcomes
- **Prometheus**: Scrapes `/metrics` endpoint every 15s
- **Loki**: Aggregated log streams from all containers
