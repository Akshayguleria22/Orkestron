"""
Orkestron — FastAPI API Gateway

Single entry point for all task orchestration requests.
Production mode: authenticate → submit task → dynamic AI agent execution
                 (planner → search/extraction → reasoning → comparison → result) → response.
"""

import asyncio
import logging
import uuid
from datetime import datetime, timedelta, timezone
from contextlib import asynccontextmanager
from typing import Any, Dict, List, Optional
from urllib.parse import urlparse

log = logging.getLogger(__name__)

from fastapi import Depends, FastAPI, HTTPException, Header, WebSocket, WebSocketDisconnect, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, EmailStr
from sqlalchemy import delete, select

from app.audit.logger import log_action
from app.auth.auth_service import AuthenticationError, create_user_token, verify_user_token, signup_user, login_user
from app.auth.oauth import get_authorize_url, handle_oauth_callback, OAuthError
from app.auth.refresh_tokens import (
    create_refresh_token,
    store_refresh_token,
    validate_refresh_token,
    revoke_refresh_token,
)
from app.cache.semantic_cache import check_cache, store_cache
from app.identity.agent_registry import get_agent, list_agents, register_agent, register_default_agents
from app.marketplace.vendor_registry import list_vendors
from app.models.db import (
    init_db,
    Task,
    AgentExecutionLog,
    ExecutionTrace,
    MarketplaceDeployedAgent,
    ToolCallLog,
    AgentRun,
    async_session,
)
from app.outcomes.outcome_tracker import get_user_outcomes
from app.billing.ledger import get_user_ledger
from app.billing.invoice_service import generate_invoice, list_user_invoices, get_invoice_details

# Phase 6 imports
from app.developers.developer_service import (
    register_developer,
    seed_core_developer,
    verify_api_key,
)
from app.agents.capability_registry import (
    list_capabilities,
    register_capability,
    seed_capabilities,
)
from app.agents.agent_discovery import find_agent_for_capability

# Phase 7 imports
import time
from starlette.requests import Request
from starlette.responses import Response
from app.observability.logger import setup_logging, get_logger, log_workflow_event
from app.observability.metrics import (
    AGENT_TASKS_TOTAL,
    AGENT_EXECUTION_TIME,
    SUCCESSFUL_OUTCOMES_TOTAL,
    FAILED_WORKFLOWS_TOTAL,
    BILLING_EVENTS_TOTAL,
    CACHE_HITS_TOTAL,
    CACHE_MISSES_TOTAL,
    HTTP_REQUESTS_TOTAL,
    HTTP_REQUEST_DURATION,
    get_metrics,
    get_metrics_content_type,
)

# Phase 8 imports
from app.config import settings
from app.security.rate_limiter import RateLimitMiddleware
from app.services.websocket_manager import manager as ws_manager, workflow_event
from app.services.product_service import (
    get_products,
    get_product,
    get_categories,
    get_product_stats,
    get_vendor_analytics,
    seed_product_data,
)
from app.services.workflow_service import (
    create_workflow,
    get_workflow,
    list_workflows,
    update_workflow,
    delete_workflow,
    create_run,
    update_run,
    get_run,
    list_runs,
    get_workflow_analytics,
)
from app.services.analytics_service import (
    get_dashboard_analytics,
    get_daily_outcomes,
    get_revenue_over_time,
    get_agent_usage,
)
from app.jobs.queue import enqueue_real_task_job

# Phase 10 imports — Real Agent Marketplace
from app.services.agent_deployment_service import (
    create_agent as deploy_new_agent,
    list_agents_for_user,
    get_agent_by_id as get_deployable_agent,
    update_agent as update_deployable_agent,
    delete_agent as delete_deployable_agent,
    execute_agent,
    list_agent_runs,
    get_agent_run,
    seed_default_agents as seed_deployable_agents,
)
from app.tools.ml_tools import ML_TOOLS

log = get_logger(__name__)


async def _run_startup_step(name: str, step_coro):
    """Run a startup coroutine with timeout and configurable strictness."""
    timeout_seconds = max(1, int(settings.startup_step_timeout_seconds or 25))
    try:
        await asyncio.wait_for(step_coro, timeout=timeout_seconds)
        log.info("startup_step_ok step=%s", name)
    except Exception as exc:
        log.exception("startup_step_failed step=%s error=%s", name, str(exc))
        if settings.startup_strict:
            raise


async def _get_task_by_task_id(task_id: str) -> Optional[Task]:
    """Fetch a task row by its public task_id value."""
    async with async_session() as session:
        result = await session.execute(select(Task).where(Task.task_id == task_id))
        return result.scalar_one_or_none()


def _serialize_real_task(task: Task) -> Dict[str, Any]:
    """Convert a Task row into API response payload."""
    result_payload = task.result if isinstance(task.result, dict) else {}
    return {
        "task_id": task.task_id,
        "input": task.input_text,
        "status": task.status,
        "task_type": task.task_type,
        "plan": task.plan,
        "result": task.result,
        "result_text": task.result_text,
        "warnings": result_payload.get("warnings", []),
        "step_errors": result_payload.get("step_errors", []),
        "agent_path": task.agent_path,
        "total_duration": task.total_duration,
        "error_message": task.error_message,
        "created_at": task.created_at.isoformat() if task.created_at else None,
        "completed_at": task.completed_at.isoformat() if task.completed_at else None,
    }


# ---------------------------------------------------------------------------
# Lifespan — DB migrations + agent registration on startup
# ---------------------------------------------------------------------------
@asynccontextmanager
async def lifespan(app: FastAPI):
    setup_logging()
    log.info("Orkestron starting up")
    await _run_startup_step("init_db", init_db())
    await _run_startup_step("register_default_agents", register_default_agents())
    await _run_startup_step("seed_core_developer", seed_core_developer())
    await _run_startup_step("seed_capabilities", seed_capabilities())
    await _run_startup_step("seed_product_data", seed_product_data())
    await _run_startup_step("seed_deployable_agents", seed_deployable_agents())
    log.info("Orkestron ready")
    yield
    log.info("Orkestron shutting down")


app = FastAPI(
    title="Orkestron",
    description="Autonomous Infrastructure Orchestrator — Phase 8 Production",
    version="0.8.0",
    lifespan=lifespan,
)

# ---------------------------------------------------------------------------
# Rate limiting middleware
# ---------------------------------------------------------------------------
app.add_middleware(RateLimitMiddleware)


# ---------------------------------------------------------------------------
# CORS — allow frontend origins (Must be added LAST to execute FIRST)
# ---------------------------------------------------------------------------
def _build_allowed_origins() -> List[str]:
    def _normalize_origin(value: str) -> str:
        cleaned = value.strip()
        return cleaned[:-1] if cleaned.endswith("/") else cleaned

    origins = [_normalize_origin(o) for o in settings.cors_origins.split(",") if o.strip()]
    oauth_base = (settings.oauth_redirect_base or "").strip()
    if oauth_base:
        parsed = urlparse(oauth_base)
        if parsed.scheme and parsed.netloc:
            base_origin = _normalize_origin(f"{parsed.scheme}://{parsed.netloc}")
            if base_origin not in origins:
                origins.append(base_origin)
    return list(dict.fromkeys(origins))


app.add_middleware(
    CORSMiddleware,
    allow_origins=_build_allowed_origins(),
    allow_origin_regex=(settings.cors_origin_regex or None),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------------------------------------------------------------------------
# Metrics middleware — tracks HTTP request count + latency
# ---------------------------------------------------------------------------
@app.middleware("http")
async def metrics_middleware(request: Request, call_next):
    start = time.perf_counter()
    response: Response = await call_next(request)
    elapsed = time.perf_counter() - start
    endpoint = request.url.path
    method = request.method
    HTTP_REQUESTS_TOTAL.labels(method=method, endpoint=endpoint, status=response.status_code).inc()
    HTTP_REQUEST_DURATION.labels(method=method, endpoint=endpoint).observe(elapsed)
    return response


# ---------------------------------------------------------------------------
# Auth dependency
# ---------------------------------------------------------------------------
async def get_current_user(authorization: str = Header(default="")):
    """Extract and verify JWT from Authorization header."""
    if not authorization:
        raise HTTPException(status_code=401, detail="Missing Authorization header")

    scheme, _, token = authorization.partition(" ")
    if scheme.lower() != "bearer" or not token:
        raise HTTPException(status_code=401, detail="Invalid Authorization header format")

    try:
        return verify_user_token(token)
    except AuthenticationError as exc:
        raise HTTPException(status_code=401, detail=str(exc))


# ---------------------------------------------------------------------------
# Request / Response schemas
# ---------------------------------------------------------------------------
class TokenRequest(BaseModel):
    user_id: str
    tenant_id: str
    roles: List[str] = ["user"]
    permissions: List[str] = ["submit_task"]


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


class AgentRegisterRequest(BaseModel):
    agent_id: str
    name: str
    public_key: str
    capabilities: List[str]


class DeveloperRegisterRequest(BaseModel):
    name: str
    email: str


class CapabilityRegisterRequest(BaseModel):
    agent_id: str
    capability_name: str
    description: str = ""
    input_schema: dict = {}
    output_schema: dict = {}
    endpoint: str = ""
    version: str = "1.0.0"


# ── Phase 9: Signup / Login / Real Task schemas ──

class SignupRequest(BaseModel):
    email: str
    password: str
    name: str = ""


class LoginRequest(BaseModel):
    email: str
    password: str


class RealTaskRequest(BaseModel):
    input: str
    selected_steps: Optional[List[str]] = None


async def get_current_developer(x_api_key: str = Header(default="")):
    """Verify developer API key from X-Api-Key header."""
    if not x_api_key:
        raise HTTPException(status_code=401, detail="Missing X-Api-Key header")
    developer = await verify_api_key(x_api_key)
    if developer is None:
        raise HTTPException(status_code=401, detail="Invalid API key")
    if developer.get("status") != "active":
        raise HTTPException(status_code=403, detail="Developer account is not active")
    return developer


# ---------------------------------------------------------------------------
# POST /auth/token — issue a user JWT
# ---------------------------------------------------------------------------
@app.post("/auth/token", response_model=TokenResponse)
async def issue_token(req: TokenRequest):
    token = create_user_token(
        user_id=req.user_id,
        tenant_id=req.tenant_id,
        roles=req.roles,
        permissions=req.permissions,
    )
    return TokenResponse(access_token=token)


# ---------------------------------------------------------------------------
# POST /auth/signup — create a new user account
# ---------------------------------------------------------------------------
@app.post("/auth/signup")
async def signup_endpoint(req: SignupRequest):
    """Register a new user with email and password."""
    if not req.email or not req.password:
        raise HTTPException(status_code=400, detail="Email and password are required")
    if len(req.password) < 6:
        raise HTTPException(status_code=400, detail="Password must be at least 6 characters")
    try:
        user_info = await signup_user(email=req.email, password=req.password, name=req.name)
        # Auto-login: issue token
        access_token = create_user_token(
            user_id=user_info["user_id"],
            tenant_id="default",
            roles=["user"],
            permissions=["submit_task", "view_workflows", "view_billing"],
        )
        # Issue refresh token (DB-backed)
        refresh = create_refresh_token(user_id=user_info["user_id"])
        await store_refresh_token(user_id=user_info["user_id"], token=refresh)
        return {
            "access_token": access_token,
            "refresh_token": refresh,
            "token_type": "bearer",
            "user": {
                "id": user_info["user_id"],
                "email": user_info["email"],
                "name": user_info["name"],
                "avatar": "",
                "provider": "local",
            },
        }
    except AuthenticationError as exc:
        raise HTTPException(status_code=409, detail=str(exc))


# ---------------------------------------------------------------------------
# POST /auth/login — authenticate with email and password
# ---------------------------------------------------------------------------
@app.post("/auth/login")
async def login_endpoint(req: LoginRequest):
    """Authenticate a user with email and password."""
    try:
        result = await login_user(email=req.email, password=req.password)
        # Issue DB-backed refresh token
        refresh = create_refresh_token(user_id=result["user"]["id"])
        await store_refresh_token(user_id=result["user"]["id"], token=refresh)
        return {
            "access_token": result["access_token"],
            "refresh_token": refresh,
            "token_type": "bearer",
            "user": result["user"],
        }
    except AuthenticationError as exc:
        raise HTTPException(status_code=401, detail=str(exc))


# ---------------------------------------------------------------------------
# POST /tasks/real — submit a real task for AI agent processing
# ---------------------------------------------------------------------------
@app.post("/tasks/real")
async def submit_real_task(req: RealTaskRequest, user=Depends(get_current_user)):
    """Submit a natural language task that gets processed by real AI agents."""
    from app.agents.dynamic_orchestrator import execute_real_task

    user_id = user["sub"]

    if not req.input or not req.input.strip():
        raise HTTPException(status_code=400, detail="Task input cannot be empty")

    allowed_steps = {
        "planner",
        "web_search",
        "data_extraction",
        "reasoning",
        "comparison",
        "result_generator",
    }
    selected_steps: List[str] = []
    for step in req.selected_steps or []:
        step_name = str(step or "").strip().lower()
        if step_name in allowed_steps and step_name not in selected_steps:
            selected_steps.append(step_name)
    if selected_steps and "planner" not in selected_steps:
        selected_steps.insert(0, "planner")

    task_id = f"task-{uuid.uuid4().hex[:12]}"

    # Create task record
    task = Task(
        task_id=task_id,
        user_id=user_id,
        input_text=req.input.strip(),
        status="pending",
    )
    try:
        async with async_session() as session:
            session.add(task)
            await session.commit()
    except Exception as exc:
        log.error("Failed to create task: %s", exc)
        raise HTTPException(status_code=500, detail="Failed to create task")

    job_id = None
    queued_via_rq = False

    # Try Redis queue first, fall back to inline async execution
    try:
        job_id = enqueue_real_task_job(
            task_id=task_id,
            user_id=user_id,
            task_input=req.input.strip(),
            selected_steps=selected_steps or None,
        )
        await _update_task_status(task_id=task_id, status="queued")
        queued_via_rq = True
    except Exception as exc:
        log.warning("RQ enqueue failed for task %s (%s), running inline", task_id, str(exc))
        # Fall back: execute the task inline as an async background coroutine
        await _update_task_status(task_id=task_id, status="queued")

        async def _inline_execute():
            try:
                await _update_task_status(task_id=task_id, status="running")
                await execute_real_task(
                    task_id=task_id,
                    user_id=user_id,
                    task_input=req.input.strip(),
                    selected_steps=selected_steps or None,
                )
            except Exception as inner_exc:
                log.exception("Inline task execution failed for %s: %s", task_id, str(inner_exc))
                await _update_task_failure(task_id=task_id, error_message=str(inner_exc)[:500])

        asyncio.create_task(_inline_execute())

    return {
        "task_id": task_id,
        "job_id": job_id or f"inline-{task_id}",
        "status": "queued",
        "selected_steps": selected_steps,
        "message": "Task queued. Poll GET /tasks/{task_id} or GET /tasks/real/{task_id} for status",
    }


async def _update_task_failure(task_id: str, error_message: str) -> None:
    """Mark task as failed if queueing or startup processing fails."""
    await _update_task_status(task_id=task_id, status="failed", error_message=error_message)


async def _update_task_status(task_id: str, status: str, error_message: Optional[str] = None) -> None:
    """Update task status and optional error message."""
    try:
        async with async_session() as session:
            result = await session.execute(select(Task).where(Task.task_id == task_id))
            task = result.scalar_one_or_none()
            if task:
                task.status = status
                if error_message:
                    task.error_message = error_message[:500]
                await session.commit()
    except Exception as exc:
        log.warning("Failed to update task %s status=%s: %s", task_id, status, exc)


async def _delete_tasks_with_related_records(user_id: str, task_ids: List[str]) -> int:
    """Delete tasks and their associated logs/traces for a specific user."""
    if not task_ids:
        return 0

    async with async_session() as session:
        await session.execute(
            delete(AgentExecutionLog).where(AgentExecutionLog.task_id.in_(task_ids))
        )
        await session.execute(
            delete(ToolCallLog).where(ToolCallLog.task_id.in_(task_ids))
        )
        await session.execute(
            delete(ExecutionTrace).where(ExecutionTrace.task_id.in_(task_ids))
        )
        await session.execute(
            delete(AgentRun).where(AgentRun.task_id.in_(task_ids))
        )
        await session.execute(
            delete(Task).where(Task.user_id == user_id, Task.task_id.in_(task_ids))
        )
        await session.commit()

    return len(task_ids)


# ---------------------------------------------------------------------------
# GET /tasks/real/{task_id} — get status and result of a real task
# ---------------------------------------------------------------------------
@app.get("/tasks/real/{task_id}")
async def get_real_task(task_id: str, user=Depends(get_current_user)):
    """Get the status and result of a submitted task."""
    task = await _get_task_by_task_id(task_id)

    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    if task.user_id != user["sub"]:
        raise HTTPException(status_code=403, detail="Access denied")

    return _serialize_real_task(task)


# ---------------------------------------------------------------------------
# GET /tasks/real — list all tasks for the current user
# ---------------------------------------------------------------------------
@app.get("/tasks/real")
async def list_real_tasks(
    status: Optional[str] = None,
    limit: int = 20,
    user=Depends(get_current_user),
):
    """List tasks for the current user, optionally filtered by status."""
    user_id = user["sub"]
    async with async_session() as session:
        query = select(Task).where(Task.user_id == user_id).order_by(Task.created_at.desc()).limit(min(limit, 100))
        if status:
            query = query.where(Task.status == status)
        result = await session.execute(query)
        tasks = result.scalars().all()

    return {
        "tasks": [
            {
                "task_id": t.task_id,
                "input": t.input_text[:200],
                "status": t.status,
                "task_type": t.task_type,
                "agent_path": t.agent_path,
                "total_duration": t.total_duration,
                "created_at": t.created_at.isoformat() if t.created_at else None,
                "completed_at": t.completed_at.isoformat() if t.completed_at else None,
            }
            for t in tasks
        ],
        "count": len(tasks),
    }


# ---------------------------------------------------------------------------
# DELETE /tasks/real/pending — remove stale pending/queued/planning tasks
# ---------------------------------------------------------------------------
@app.delete("/tasks/real/pending")
async def cleanup_pending_tasks(
    older_than_hours: int = Query(default=24, ge=1, le=24 * 30),
    user=Depends(get_current_user),
):
    """Delete stale pending-like tasks for current user to keep history clean."""
    user_id = user["sub"]
    cutoff = datetime.now(timezone.utc) - timedelta(hours=older_than_hours)
    pending_like = ["pending", "queued", "planning"]

    async with async_session() as session:
        result = await session.execute(
            select(Task.task_id).where(
                Task.user_id == user_id,
                Task.status.in_(pending_like),
                Task.created_at < cutoff,
            )
        )
        task_ids = [row[0] for row in result.all()]

    deleted = await _delete_tasks_with_related_records(user_id=user_id, task_ids=task_ids)
    return {
        "deleted": deleted,
        "older_than_hours": older_than_hours,
        "statuses": pending_like,
    }


# ---------------------------------------------------------------------------
# DELETE /tasks/real — clear task history by status (default: completed,failed)
# ---------------------------------------------------------------------------
@app.delete("/tasks/real")
async def clear_real_task_history(
    status: str = Query(default="completed,failed"),
    user=Depends(get_current_user),
):
    """Delete task history entries for current user by status list."""
    user_id = user["sub"]
    allowed = {"pending", "queued", "planning", "running", "completed", "failed"}
    statuses = [s.strip().lower() for s in status.split(",") if s.strip()]
    statuses = [s for s in statuses if s in allowed]

    # Do not delete currently running tasks via bulk history cleanup.
    statuses = [s for s in statuses if s != "running"]
    if not statuses:
        return {"deleted": 0, "statuses": []}

    async with async_session() as session:
        result = await session.execute(
            select(Task.task_id).where(
                Task.user_id == user_id,
                Task.status.in_(statuses),
            )
        )
        task_ids = [row[0] for row in result.all()]

    deleted = await _delete_tasks_with_related_records(user_id=user_id, task_ids=task_ids)
    return {"deleted": deleted, "statuses": statuses}


# ---------------------------------------------------------------------------
# DELETE /tasks/real/{task_id} — remove a single task from history
# ---------------------------------------------------------------------------
@app.delete("/tasks/real/{task_id}")
async def delete_real_task(task_id: str, user=Depends(get_current_user)):
    """Delete one task (and related logs) from the current user's history."""
    task = await _get_task_by_task_id(task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    if task.user_id != user["sub"]:
        raise HTTPException(status_code=403, detail="Access denied")

    deleted = await _delete_tasks_with_related_records(user_id=user["sub"], task_ids=[task_id])
    return {"deleted": deleted, "task_id": task_id}


# ---------------------------------------------------------------------------
# GET /tasks/{task_id} — polling endpoint for queued task status/results
# ---------------------------------------------------------------------------
@app.get("/tasks/{task_id}")
async def get_task(task_id: str, user=Depends(get_current_user)):
    """Poll task status/result for asynchronous real-task execution."""
    task = await _get_task_by_task_id(task_id)

    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    if task.user_id != user["sub"]:
        raise HTTPException(status_code=403, detail="Access denied")

    return _serialize_real_task(task)


# ---------------------------------------------------------------------------
# GET /tasks/real/{task_id}/logs — get execution logs for a task
# ---------------------------------------------------------------------------
@app.get("/tasks/real/{task_id}/logs")
async def get_task_logs(task_id: str, user=Depends(get_current_user)):
    """Get agent execution logs for a specific task."""
    # Verify ownership
    task = await _get_task_by_task_id(task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    if task.user_id != user["sub"]:
        raise HTTPException(status_code=403, detail="Access denied")

    async with async_session() as session:
        result = await session.execute(
            select(AgentExecutionLog)
            .where(AgentExecutionLog.task_id == task_id)
            .order_by(AgentExecutionLog.step_index)
        )
        logs = result.scalars().all()

    return {
        "task_id": task_id,
        "logs": [
            {
                "log_id": l.log_id,
                "agent_name": l.agent_name,
                "agent_type": l.agent_type,
                "step_index": l.step_index,
                "status": l.status,
                "latency_ms": l.latency_ms,
                "tools_used": l.tools_used,
                "error_message": l.error_message,
            }
            for l in logs
        ],
    }


# ---------------------------------------------------------------------------
# GET /agents/registered — list all registered agents
# ---------------------------------------------------------------------------
@app.get("/agents/registered")
async def list_agents_endpoint():
    agents = await list_agents()
    return {"agents": agents}


# ---------------------------------------------------------------------------
# POST /agents/register — register an agent identity
# ---------------------------------------------------------------------------
@app.post("/agents/register")
async def register_agent_endpoint(req: AgentRegisterRequest):
    result = await register_agent(
        agent_id=req.agent_id,
        name=req.name,
        public_key=req.public_key,
        capabilities=req.capabilities,
    )
    return {"status": "registered", "agent": result}


# ---------------------------------------------------------------------------
# POST /agents/capabilities — publish an agent capability (dev auth)
# ---------------------------------------------------------------------------
@app.post("/agents/capabilities")
async def register_capability_endpoint(
    req: CapabilityRegisterRequest,
    developer=Depends(get_current_developer),
):
    result = await register_capability(
        agent_id=req.agent_id,
        developer_id=developer["developer_id"],
        capability_name=req.capability_name,
        description=req.description,
        input_schema=req.input_schema,
        output_schema=req.output_schema,
        endpoint=req.endpoint,
        version=req.version,
    )
    return {"status": "published", "capability": result}


# ---------------------------------------------------------------------------
# GET /agents/capabilities — list all published capabilities
# ---------------------------------------------------------------------------
@app.get("/agents/capabilities")
async def list_capabilities_endpoint(agent_id: Optional[str] = None):
    caps = await list_capabilities(agent_id=agent_id)
    return {"capabilities": caps}


# ---------------------------------------------------------------------------
# GET /agents/discover — find an agent for a capability
# ---------------------------------------------------------------------------
@app.get("/agents/discover")
async def discover_agent_endpoint(capability: str):
    agent = await find_agent_for_capability(capability)
    if agent is None:
        raise HTTPException(status_code=404, detail=f"No agent found for capability '{capability}'")
    return {"agent": agent}


# ---------------------------------------------------------------------------
# GET /agents/{agent_id} — look up an agent (MUST be after static /agents/ routes)
# ---------------------------------------------------------------------------
@app.get("/agents/{agent_id}")
async def get_agent_endpoint(agent_id: str):
    agent = await get_agent(agent_id)
    if agent is None:
        raise HTTPException(status_code=404, detail="Agent not found")
    return agent


# ---------------------------------------------------------------------------
# GET /vendors — list all marketplace vendors
# ---------------------------------------------------------------------------
@app.get("/vendors")
async def list_vendors_endpoint():
    vendors = await list_vendors()
    return {"vendors": vendors}


# ---------------------------------------------------------------------------
# GET /outcomes/{user_id} — get transaction outcomes for a user
# ---------------------------------------------------------------------------
@app.get("/outcomes/{user_id}")
async def get_outcomes_endpoint(user_id: str, user=Depends(get_current_user)):
    # Users can only view their own outcomes
    if user["sub"] != user_id:
        raise HTTPException(status_code=403, detail="Cannot view other user's outcomes")
    outcomes = await get_user_outcomes(user_id)
    return {"outcomes": outcomes}


# ---------------------------------------------------------------------------
# GET /billing/ledger/{user_id} — billing ledger for a user
# ---------------------------------------------------------------------------
@app.get("/billing/ledger/{user_id}")
async def get_billing_ledger_endpoint(user_id: str, user=Depends(get_current_user)):
    if user["sub"] != user_id:
        raise HTTPException(status_code=403, detail="Cannot view other user's billing ledger")
    ledger = await get_user_ledger(user_id)
    return {"ledger": ledger}


# ---------------------------------------------------------------------------
# POST /billing/invoice/{user_id} — generate an invoice for a user
# ---------------------------------------------------------------------------
@app.post("/billing/invoice/{user_id}")
async def generate_invoice_endpoint(user_id: str, user=Depends(get_current_user)):
    if user["sub"] != user_id:
        raise HTTPException(status_code=403, detail="Cannot generate invoice for other user")
    invoice = await generate_invoice(user_id)
    return {"invoice": invoice}


# ---------------------------------------------------------------------------
# GET /billing/invoices/{user_id} — list all invoices for a user
# ---------------------------------------------------------------------------
@app.get("/billing/invoices/{user_id}")
async def list_invoices_endpoint(user_id: str, user=Depends(get_current_user)):
    if user["sub"] != user_id:
        raise HTTPException(status_code=403, detail="Cannot view other user's invoices")
    invoices = await list_user_invoices(user_id)
    return {"invoices": invoices}


# ---------------------------------------------------------------------------
# GET /billing/invoice/detail/{invoice_id} — single invoice details
# ---------------------------------------------------------------------------
@app.get("/billing/invoice/detail/{invoice_id}")
async def get_invoice_detail_endpoint(invoice_id: str, user=Depends(get_current_user)):
    invoice = await get_invoice_details(invoice_id)
    if invoice is None:
        raise HTTPException(status_code=404, detail="Invoice not found")
    if invoice["user_id"] != user["sub"]:
        raise HTTPException(status_code=403, detail="Cannot view other user's invoice")
    return {"invoice": invoice}


# ---------------------------------------------------------------------------
# GET /billing/summary — aggregated billing summary for current user
# ---------------------------------------------------------------------------
@app.get("/billing/summary")
async def billing_summary_endpoint(user=Depends(get_current_user)):
    """Get billing summary with total fees, credits, and usage breakdown."""
    user_id = user["sub"]
    ledger = await get_user_ledger(user_id)

    total_fees = sum(e.get("fee", 0) for e in ledger)
    total_entries = len(ledger)
    starting_credits = 10.00  # Default starting credits
    credits_remaining = max(starting_credits - total_fees, 0)

    # Group by pricing model
    by_model: Dict[str, float] = {}
    for entry in ledger:
        model = entry.get("pricing_model", "unknown")
        by_model[model] = by_model.get(model, 0) + entry.get("fee", 0)

    return {
        "summary": {
            "total_fees": round(total_fees, 4),
            "total_entries": total_entries,
            "credits_remaining": round(credits_remaining, 4),
            "starting_credits": starting_credits,
            "usage_by_model": by_model,
        }
    }


# ---------------------------------------------------------------------------
# POST /developers/register — register a third-party developer
# ---------------------------------------------------------------------------
@app.post("/developers/register")
async def register_developer_endpoint(req: DeveloperRegisterRequest):
    result = await register_developer(name=req.name, email=req.email)
    return {"status": "registered", "developer": result}



# ---------------------------------------------------------------------------
# GET /metrics — Prometheus scrape endpoint
# ---------------------------------------------------------------------------
@app.get("/metrics", include_in_schema=False)
async def metrics_endpoint():
    return Response(
        content=get_metrics(),
        media_type=get_metrics_content_type(),
    )


# ---------------------------------------------------------------------------
# Health check
# ---------------------------------------------------------------------------
@app.get("/health")
async def health():
    return {
        "status": "healthy",
        "version": "0.8.0",
        "ws_connections": ws_manager.active_connections,
    }


# ===========================================================================
# Phase 8: OAuth2 Authentication Endpoints
# ===========================================================================

class OAuthCallbackRequest(BaseModel):
    code: str
    state: str


class RefreshRequest(BaseModel):
    refresh_token: str


@app.get("/auth/oauth/{provider}/authorize")
async def oauth_authorize(provider: str, redirect_uri: str = Query(default="")):
    """Get OAuth2 authorization URL for Google or GitHub."""
    if not redirect_uri:
        redirect_uri = f"{settings.oauth_redirect_base}/auth/callback/{provider}"
    try:
        url = get_authorize_url(provider, redirect_uri)
        return {"authorize_url": url, "provider": provider}
    except OAuthError as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/auth/oauth/{provider}/callback")
async def oauth_callback(provider: str, req: OAuthCallbackRequest):
    """Exchange OAuth2 code for JWT tokens."""
    try:
        result = await handle_oauth_callback(provider, req.code, req.state)
        return result
    except OAuthError as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/auth/refresh")
async def refresh_token_endpoint(req: RefreshRequest):
    """Exchange a refresh token for a new access token + refresh token."""
    token_data = await validate_refresh_token(req.refresh_token)
    if not token_data:
        raise HTTPException(status_code=401, detail="Invalid or expired refresh token")

    user_id = token_data["user_id"]

    # Issue new access token
    access_token = create_user_token(
        user_id=user_id,
        tenant_id="default",
        roles=["user"],
        permissions=["submit_task", "view_workflows", "view_billing"],
    )

    # Issue new refresh token (rotation)
    new_refresh = create_refresh_token(user_id=user_id)
    await store_refresh_token(user_id=user_id, token=new_refresh)

    return {
        "access_token": access_token,
        "refresh_token": new_refresh,
        "token_type": "bearer",
    }


@app.post("/auth/logout")
async def logout_endpoint(req: RefreshRequest):
    """Revoke refresh token on logout."""
    await revoke_refresh_token(req.refresh_token)
    return {"status": "logged_out"}


@app.get("/auth/me")
async def get_current_user_info(user=Depends(get_current_user)):
    """Get current user info from JWT."""
    return {
        "user_id": user["sub"],
        "tenant_id": user.get("tenant_id", "default"),
        "roles": user.get("roles", []),
        "permissions": user.get("permissions", []),
    }


# ===========================================================================
# Phase 8: Workflow CRUD Endpoints
# ===========================================================================

class WorkflowCreateRequest(BaseModel):
    name: str
    graph_json: Dict[str, Any]
    description: str = ""


class WorkflowUpdateRequest(BaseModel):
    name: Optional[str] = None
    graph_json: Optional[Dict[str, Any]] = None
    description: Optional[str] = None


@app.post("/workflows")
async def create_workflow_endpoint(req: WorkflowCreateRequest, user=Depends(get_current_user)):
    """Save a new workflow definition."""
    result = await create_workflow(
        user_id=user["sub"],
        name=req.name,
        graph_json=req.graph_json,
        description=req.description,
    )
    return {"status": "created", "workflow": result}


@app.get("/workflows")
async def list_workflows_endpoint(user=Depends(get_current_user)):
    """List all workflows for current user."""
    workflows = await list_workflows(user_id=user["sub"])
    return {"workflows": workflows}


@app.get("/workflows/{workflow_id}")
async def get_workflow_endpoint(workflow_id: str, user=Depends(get_current_user)):
    """Get a single workflow definition."""
    wf = await get_workflow(workflow_id)
    if not wf:
        raise HTTPException(status_code=404, detail="Workflow not found")
    if wf["user_id"] != user["sub"]:
        raise HTTPException(status_code=403, detail="Access denied")
    return {"workflow": wf}


@app.put("/workflows/{workflow_id}")
async def update_workflow_endpoint(
    workflow_id: str,
    req: WorkflowUpdateRequest,
    user=Depends(get_current_user),
):
    """Update a workflow definition."""
    result = await update_workflow(
        workflow_id=workflow_id,
        user_id=user["sub"],
        name=req.name,
        graph_json=req.graph_json,
        description=req.description,
    )
    if not result:
        raise HTTPException(status_code=404, detail="Workflow not found")
    return {"status": "updated", "workflow": result}


@app.delete("/workflows/{workflow_id}")
async def delete_workflow_endpoint(workflow_id: str, user=Depends(get_current_user)):
    """Delete a workflow definition."""
    deleted = await delete_workflow(workflow_id, user["sub"])
    if not deleted:
        raise HTTPException(status_code=404, detail="Workflow not found")
    return {"status": "deleted"}


# ---------------------------------------------------------------------------
# Workflow Execution
# ---------------------------------------------------------------------------

@app.post("/workflows/{workflow_id}/run")
async def run_workflow_endpoint(workflow_id: str, user=Depends(get_current_user)):
    """Start a workflow execution run with live WebSocket updates."""
    wf = await get_workflow(workflow_id)
    if not wf:
        raise HTTPException(status_code=404, detail="Workflow not found")
    if wf["user_id"] != user["sub"]:
        raise HTTPException(status_code=403, detail="Access denied")

    run = await create_run(workflow_id=workflow_id, user_id=user["sub"])
    run_id = run["run_id"]

    # Execute asynchronously (fire and forget) — updates streamed via WebSocket
    asyncio.create_task(_execute_workflow(run_id, wf, user["sub"]))

    return {"status": "started", "run": run}


async def _execute_workflow(run_id: str, wf: Dict[str, Any], user_id: str):
    """Execute workflow nodes in topological order with real agent calls."""
    import time as time_mod
    from app.agents.dynamic_orchestrator import _run_agent_step

    await update_run(run_id, status="running")
    await ws_manager.send_to_user(user_id, workflow_event(run_id, "workflow_started"))

    graph = wf.get("graph_json", {})
    nodes = graph.get("nodes", [])
    edges = graph.get("edges", [])

    # Build adjacency for topological sort
    in_degree = {n["id"]: 0 for n in nodes}
    adj = {n["id"]: [] for n in nodes}
    for e in edges:
        src, tgt = e.get("source"), e.get("target")
        if src in adj and tgt in in_degree:
            adj[src].append(tgt)
            in_degree[tgt] = in_degree.get(tgt, 0) + 1

    # Kahn's algorithm
    queue = [nid for nid, deg in in_degree.items() if deg == 0]
    order = []
    while queue:
        nid = queue.pop(0)
        order.append(nid)
        for neighbour in adj.get(nid, []):
            in_degree[neighbour] -= 1
            if in_degree[neighbour] == 0:
                queue.append(neighbour)

    node_results = {}
    intermediate_results: Dict[str, Any] = {}
    overall_status = "completed"
    # Use workflow description or first node's label as task context
    task_context = wf.get("description") or wf.get("name") or "workflow execution"

    for step_idx, node_id in enumerate(order):
        node_data = next((n for n in nodes if n["id"] == node_id), None)
        if not node_data:
            continue

        node_type = node_data.get("data", {}).get("type", "unknown")
        node_label = node_data.get("data", {}).get("label", node_type)

        # Notify: node started
        await ws_manager.send_to_user(
            user_id,
            workflow_event(run_id, "node_started", node_id, {"label": node_label, "type": node_type}),
        )

        start_time = time_mod.perf_counter()

        try:
            # Execute the node using the real agent step runner
            if node_type in ("web_search", "data_extraction", "reasoning", "comparison", "result_generator"):
                result = await _run_agent_step(
                    agent_type=node_type,
                    task_input=task_context,
                    task_id=run_id,
                    step_index=step_idx + 1,
                    key_queries=[task_context[:120]],
                    intermediate_results=intermediate_results,
                )
                intermediate_results[node_type] = result
            else:
                # For unknown node types, log and skip gracefully
                result = {"status": "skipped", "message": f"No handler for node type: {node_type}"}

            elapsed = round(time_mod.perf_counter() - start_time, 3)

            node_results[node_id] = {
                "status": "completed",
                "output": f"{node_label} processed successfully",
                "duration": elapsed,
            }
            await ws_manager.send_to_user(
                user_id,
                workflow_event(run_id, "node_completed", node_id, {
                    "label": node_label,
                    "duration": elapsed,
                    "output": node_results[node_id]["output"],
                }),
            )

        except Exception as exc:
            elapsed = round(time_mod.perf_counter() - start_time, 3)
            log.error("Workflow node %s (%s) failed: %s", node_id, node_type, exc)

            node_results[node_id] = {
                "status": "error",
                "output": f"{node_label} execution failed: {str(exc)[:200]}",
                "duration": elapsed,
            }
            overall_status = "failed"
            await ws_manager.send_to_user(
                user_id,
                workflow_event(run_id, "node_error", node_id, {
                    "label": node_label,
                    "error": "Execution failed",
                }),
            )
            break  # Stop on first error

    await update_run(run_id, status=overall_status, node_results=node_results)
    await ws_manager.send_to_user(
        user_id,
        workflow_event(run_id, "workflow_completed", data={"status": overall_status}),
    )


@app.get("/workflows/runs/{run_id}")
async def get_run_endpoint(run_id: str, user=Depends(get_current_user)):
    """Get a workflow execution run."""
    run = await get_run(run_id)
    if not run:
        raise HTTPException(status_code=404, detail="Run not found")
    if run["user_id"] != user["sub"]:
        raise HTTPException(status_code=403, detail="Access denied")
    return {"run": run}


@app.get("/workflows/{workflow_id}/runs")
async def list_workflow_runs(workflow_id: str, user=Depends(get_current_user)):
    """List all runs for a workflow."""
    runs = await list_runs(user_id=user["sub"], workflow_id=workflow_id)
    return {"runs": runs}


# ===========================================================================
# Phase 8: Product / Vendor API (Real Data)
# ===========================================================================

@app.get("/products")
async def list_products_endpoint(
    category: Optional[str] = None,
    vendor_id: Optional[str] = None,
    min_price: Optional[float] = None,
    max_price: Optional[float] = None,
    search: Optional[str] = None,
    limit: int = 50,
):
    """Search products with filters."""
    products = await get_products(
        category=category,
        vendor_id=vendor_id,
        min_price=min_price,
        max_price=max_price,
        search=search,
        limit=limit,
    )
    return {"products": products, "count": len(products)}


@app.get("/products/{product_id}")
async def get_product_endpoint(product_id: str):
    """Get a single product."""
    product = await get_product(product_id)
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    return {"product": product}


@app.get("/products/categories/list")
async def list_categories_endpoint():
    """Get all product categories."""
    categories = await get_categories()
    return {"categories": categories}


@app.get("/products/stats/overview")
async def product_stats_endpoint():
    """Get product statistics."""
    stats = await get_product_stats()
    return {"stats": stats}


@app.get("/vendors/analytics")
async def vendor_analytics_endpoint():
    """Get vendor performance analytics."""
    analytics = await get_vendor_analytics()
    return {"analytics": analytics}


# ===========================================================================
# Phase 8: Analytics Endpoints (Charts & Dashboard)
# ===========================================================================

@app.get("/analytics/dashboard")
async def dashboard_analytics_endpoint(user=Depends(get_current_user)):
    """Get comprehensive dashboard analytics."""
    analytics = await get_dashboard_analytics(user_id=user["sub"])
    return {"analytics": analytics}


@app.get("/analytics/daily-outcomes")
async def daily_outcomes_endpoint(days: int = 30, user=Depends(get_current_user)):
    """Get daily workflow outcomes for charts."""
    outcomes = await get_daily_outcomes(days=days)
    return {"outcomes": outcomes}


@app.get("/analytics/revenue")
async def revenue_endpoint(days: int = 30, user=Depends(get_current_user)):
    """Get daily revenue data for charts."""
    revenue = await get_revenue_over_time(days=days)
    return {"revenue": revenue}


@app.get("/analytics/agent-usage")
async def agent_usage_endpoint(user=Depends(get_current_user)):
    """Get agent usage statistics."""
    usage = await get_agent_usage()
    return {"usage": usage}


@app.get("/analytics/workflow-stats")
async def workflow_stats_endpoint(user=Depends(get_current_user)):
    """Get workflow analytics for current user."""
    stats = await get_workflow_analytics(user_id=user["sub"])
    return {"stats": stats}


# ===========================================================================
# Marketplace Agent Deployment Endpoints
# ===========================================================================

class DeployAgentRequest(BaseModel):
    agent_id: str
    config: Dict[str, Any] = {}


@app.post("/marketplace/deploy")
async def deploy_agent_endpoint(req: DeployAgentRequest, user=Depends(get_current_user)):
    """Deploy an agent from the marketplace for the current user."""
    user_id = user["sub"]

    # Verify the agent exists
    agent = await get_agent(req.agent_id)
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")

    deployment_id = f"deploy-{uuid.uuid4().hex[:12]}"
    entry = MarketplaceDeployedAgent(
        deployment_id=deployment_id,
        user_id=user_id,
        agent_id=req.agent_id,
        agent_name=agent.get("name", req.agent_id),
        status="active",
        config=req.config,
    )

    async with async_session() as session:
        session.add(entry)
        await session.commit()

    return {
        "status": "deployed",
        "deployment_id": deployment_id,
        "agent_id": req.agent_id,
        "agent_name": agent.get("name", req.agent_id),
    }


@app.get("/marketplace/deployed")
async def list_deployed_agents(user=Depends(get_current_user)):
    """List all agents the current user has deployed."""
    user_id = user["sub"]
    async with async_session() as session:
        result = await session.execute(
            select(MarketplaceDeployedAgent)
            .where(MarketplaceDeployedAgent.user_id == user_id)
            .order_by(MarketplaceDeployedAgent.deployed_at.desc())
        )
        deployments = result.scalars().all()

    return {
        "deployed": [
            {
                "deployment_id": d.deployment_id,
                "agent_id": d.agent_id,
                "agent_name": d.agent_name,
                "status": d.status,
                "config": d.config,
                "deployed_at": d.deployed_at.isoformat() if d.deployed_at else None,
            }
            for d in deployments
        ],
    }


@app.delete("/marketplace/deploy/{deployment_id}")
async def undeploy_agent_endpoint(deployment_id: str, user=Depends(get_current_user)):
    """Remove a deployed agent."""
    async with async_session() as session:
        result = await session.execute(
            select(MarketplaceDeployedAgent).where(
                MarketplaceDeployedAgent.deployment_id == deployment_id,
                MarketplaceDeployedAgent.user_id == user["sub"],
            )
        )
        deployment = result.scalar_one_or_none()
        if not deployment:
            raise HTTPException(status_code=404, detail="Deployment not found")
        deployment.status = "removed"
        await session.commit()

    return {"status": "removed", "deployment_id": deployment_id}


# ===========================================================================
# Observatory — Real Execution Traces
# ===========================================================================

@app.get("/observatory/traces")
async def list_traces(
    status: Optional[str] = None,
    limit: int = 50,
    user=Depends(get_current_user),
):
    """List execution traces for the observatory."""
    user_id = user["sub"]
    async with async_session() as session:
        query = (
            select(ExecutionTrace)
            .where(ExecutionTrace.user_id == user_id)
            .order_by(ExecutionTrace.started_at.desc())
            .limit(min(limit, 100))
        )
        if status:
            query = query.where(ExecutionTrace.status == status)
        result = await session.execute(query)
        traces = result.scalars().all()

    return {
        "traces": [
            {
                "trace_id": t.trace_id,
                "task_id": t.task_id,
                "status": t.status,
                "nodes": t.nodes,
                "total_duration": t.total_duration,
                "started_at": t.started_at.isoformat() if t.started_at else None,
                "completed_at": t.completed_at.isoformat() if t.completed_at else None,
            }
            for t in traces
        ],
        "count": len(traces),
    }


@app.get("/observatory/traces/{trace_id}")
async def get_trace(trace_id: str, user=Depends(get_current_user)):
    """Get a single execution trace with full node details."""
    async with async_session() as session:
        result = await session.execute(
            select(ExecutionTrace).where(ExecutionTrace.trace_id == trace_id)
        )
        trace = result.scalar_one_or_none()

    if not trace:
        raise HTTPException(status_code=404, detail="Trace not found")
    if trace.user_id != user["sub"]:
        raise HTTPException(status_code=403, detail="Access denied")

    return {
        "trace": {
            "trace_id": trace.trace_id,
            "task_id": trace.task_id,
            "status": trace.status,
            "nodes": trace.nodes,
            "total_duration": trace.total_duration,
            "started_at": trace.started_at.isoformat() if trace.started_at else None,
            "completed_at": trace.completed_at.isoformat() if trace.completed_at else None,
        },
    }


@app.get("/observatory/stats")
async def observatory_stats(user=Depends(get_current_user)):
    """Get aggregated observatory statistics."""
    user_id = user["sub"]
    async with async_session() as session:
        result = await session.execute(
            select(ExecutionTrace).where(ExecutionTrace.user_id == user_id)
        )
        traces = result.scalars().all()

    total = len(traces)
    completed = sum(1 for t in traces if t.status == "completed")
    failed = sum(1 for t in traces if t.status == "failed")
    avg_duration = 0.0
    if completed:
        durations = [t.total_duration for t in traces if t.total_duration and t.status == "completed"]
        avg_duration = round(sum(durations) / len(durations), 2) if durations else 0.0

    return {
        "stats": {
            "total_traces": total,
            "completed": completed,
            "failed": failed,
            "running": total - completed - failed,
            "success_rate": round(completed / total * 100, 1) if total else 0,
            "avg_duration": avg_duration,
        },
    }


# ===========================================================================
# Phase 8: WebSocket Endpoint
# ===========================================================================

@app.websocket("/ws/{user_id}")
async def websocket_endpoint(websocket: WebSocket, user_id: str):
    """
    WebSocket connection for live workflow updates.
    Client sends: {"type": "subscribe", "run_id": "..."} to watch a run.
    Server pushes: workflow_event messages as nodes execute.
    """
    await ws_manager.connect(websocket, user_id)

    try:
        while True:
            data = await websocket.receive_json()
            msg_type = data.get("type", "")

            if msg_type == "subscribe":
                run_id = data.get("run_id", "")
                if run_id:
                    ws_manager.subscribe_workflow(websocket, run_id)
                    await websocket.send_json({"type": "subscribed", "run_id": run_id})

            elif msg_type == "unsubscribe":
                run_id = data.get("run_id", "")
                if run_id:
                    ws_manager.unsubscribe_workflow(websocket, run_id)

            elif msg_type == "ping":
                await websocket.send_json({"type": "pong"})

    except WebSocketDisconnect:
        ws_manager.disconnect(websocket, user_id)
    except Exception:
        ws_manager.disconnect(websocket, user_id)


# ===========================================================================
# Phase 10: Deployable Agent Marketplace API
# ===========================================================================

class DeployAgentCreateRequest(BaseModel):
    name: str
    description: str = ""
    agent_type: str = "llm"  # llm | ml | hybrid
    visibility: str = "public"  # public | private
    capabilities: List[str] = []
    ml_models: List[str] = []
    llm_provider: Optional[str] = None
    llm_model: Optional[str] = None
    system_prompt: Optional[str] = None
    tools: List[str] = []
    config: Dict[str, Any] = {}
    tags: List[str] = []
    icon: Optional[str] = None
    category: Optional[str] = None
    workflow_id: Optional[str] = None


class DeployAgentUpdateRequest(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    agent_type: Optional[str] = None
    visibility: Optional[str] = None
    capabilities: Optional[List[str]] = None
    ml_models: Optional[List[str]] = None
    system_prompt: Optional[str] = None
    tools: Optional[List[str]] = None
    config: Optional[Dict[str, Any]] = None
    tags: Optional[List[str]] = None
    icon: Optional[str] = None
    category: Optional[str] = None
    status: Optional[str] = None
    workflow_id: Optional[str] = None


class AgentExecuteRequest(BaseModel):
    input: str


@app.post("/platform/agents")
async def create_deployable_agent(req: DeployAgentCreateRequest, user=Depends(get_current_user)):
    """Deploy a new agent (public or private)."""
    if not req.name.strip():
        raise HTTPException(status_code=400, detail="Agent name is required")
    result = await deploy_new_agent(
        owner_id=user["sub"],
        name=req.name,
        description=req.description,
        agent_type=req.agent_type,
        visibility=req.visibility,
        capabilities=req.capabilities,
        ml_models=req.ml_models,
        llm_provider=req.llm_provider,
        llm_model=req.llm_model,
        system_prompt=req.system_prompt,
        tools=req.tools,
        config=req.config,
        tags=req.tags,
        icon=req.icon,
        category=req.category,
        workflow_id=req.workflow_id,
    )
    return {"status": "deployed", "agent": result}


@app.get("/platform/agents")
async def list_deployable_agents(
    category: Optional[str] = None,
    agent_type: Optional[str] = None,
    search: Optional[str] = None,
    mine_only: bool = False,
    limit: int = 50,
    user=Depends(get_current_user),
):
    """List agents: public marketplace + user's own private agents."""
    agents = await list_agents_for_user(
        user_id=user["sub"],
        include_public=not mine_only,
        category=category,
        agent_type=agent_type,
        search=search,
        limit=limit,
    )
    return {"agents": agents, "count": len(agents)}


@app.get("/platform/agents/public")
async def list_public_agents(
    category: Optional[str] = None,
    search: Optional[str] = None,
    limit: int = 50,
):
    """List all public agents (no auth required for browsing)."""
    agents = await list_agents_for_user(
        user_id="__public__",
        include_public=True,
        category=category,
        search=search,
        limit=limit,
    )
    # Filter to only public
    public = [a for a in agents if a["visibility"] == "public"]
    return {"agents": public, "count": len(public)}


@app.get("/platform/agents/{agent_id}")
async def get_single_deployable_agent(agent_id: str):
    """Get details of a single agent."""
    agent = await get_deployable_agent(agent_id)
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")
    return {"agent": agent}


@app.put("/platform/agents/{agent_id}")
async def update_single_deployable_agent(
    agent_id: str,
    req: DeployAgentUpdateRequest,
    user=Depends(get_current_user),
):
    """Update an agent (owner only)."""
    updates = req.model_dump(exclude_none=True)
    result = await update_deployable_agent(agent_id, user["sub"], **updates)
    if not result:
        raise HTTPException(status_code=404, detail="Agent not found or access denied")
    return {"status": "updated", "agent": result}


@app.delete("/platform/agents/{agent_id}")
async def delete_single_deployable_agent(agent_id: str, user=Depends(get_current_user)):
    """Delete an agent (owner only, soft delete)."""
    deleted = await delete_deployable_agent(agent_id, user["sub"])
    if not deleted:
        raise HTTPException(status_code=404, detail="Agent not found or access denied")
    return {"status": "deleted"}


@app.post("/platform/agents/{agent_id}/execute")
async def execute_deployable_agent(
    agent_id: str,
    req: AgentExecuteRequest,
    user=Depends(get_current_user),
):
    """Execute an agent with real ML + LLM tools. Returns full run results."""
    if not req.input.strip():
        raise HTTPException(status_code=400, detail="Input cannot be empty")
    result = await execute_agent(
        agent_id=agent_id,
        user_id=user["sub"],
        input_text=req.input.strip(),
    )
    if result.get("error") == "Agent not found":
        raise HTTPException(status_code=404, detail="Agent not found")
    if result.get("error") and "Access denied" in result["error"]:
        raise HTTPException(status_code=403, detail=result["error"])
    return result


@app.get("/platform/runs")
async def list_user_agent_runs(
    agent_id: Optional[str] = None,
    limit: int = 20,
    user=Depends(get_current_user),
):
    """List agent execution runs for the current user."""
    runs = await list_agent_runs(user_id=user["sub"], agent_id=agent_id, limit=limit)
    return {"runs": runs, "count": len(runs)}


@app.get("/platform/runs/{run_id}")
async def get_single_agent_run(run_id: str, user=Depends(get_current_user)):
    """Get a single agent run with full details."""
    run = await get_agent_run(run_id)
    if not run:
        raise HTTPException(status_code=404, detail="Run not found")
    if run["user_id"] != user["sub"]:
        raise HTTPException(status_code=403, detail="Access denied")
    return {"run": run}


@app.get("/platform/ml-tools")
async def list_ml_tools():
    """List all available ML tools and their schemas."""
    tools = [
        {
            "name": name,
            "description": info["description"],
            "input_schema": info["input_schema"],
        }
        for name, info in ML_TOOLS.items()
    ]
    return {"tools": tools, "count": len(tools)}


# ===========================================================================
# Playground — Tool Testing & Task History
# ===========================================================================

class ToolRunRequest(BaseModel):
    tool_name: str
    input: str


@app.post("/tools/run")
async def run_tool(req: ToolRunRequest, user=Depends(get_current_user)):
    """Run a single tool directly (for Playground tool testing panel)."""
    from app.agents.dynamic_orchestrator import _run_agent_step

    tool_name = req.tool_name.strip()
    tool_input = req.input.strip()

    if not tool_name or not tool_input:
        raise HTTPException(status_code=400, detail="Tool name and input are required")

    valid_tools = ["web_search", "data_extraction", "reasoning", "comparison", "result_generator"]
    if tool_name not in valid_tools:
        raise HTTPException(status_code=400, detail=f"Invalid tool. Must be one of: {', '.join(valid_tools)}")

    try:
        result = await _run_agent_step(
            agent_type=tool_name,
            task_input=tool_input,
            task_id=f"tool-test-{uuid.uuid4().hex[:8]}",
            step_index=0,
            key_queries=[tool_input[:120]],
            intermediate_results={},
        )
        return {"tool": tool_name, "input": tool_input, "output": result, "status": "success"}
    except Exception as exc:
        log.error("Tool run failed for %s: %s", tool_name, exc)
        return {"tool": tool_name, "input": tool_input, "output": str(exc)[:500], "status": "error"}


@app.get("/tasks/history")
async def get_task_history(
    limit: int = 50,
    user=Depends(get_current_user),
):
    """Get full task history for multi-run comparison in Playground."""
    user_id = user["sub"]
    async with async_session() as session:
        result = await session.execute(
            select(Task)
            .where(Task.user_id == user_id)
            .order_by(Task.created_at.desc())
            .limit(min(limit, 100))
        )
        tasks = result.scalars().all()

    return {
        "runs": [_serialize_real_task(t) for t in tasks],
        "count": len(tasks),
    }
