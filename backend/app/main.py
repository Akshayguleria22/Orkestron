"""
Orkestron — FastAPI API Gateway

Single entry point for all task orchestration requests.
Phase 8: Full Production — OAuth2, WebSocket, Rate Limiting, Real Data, Analytics.
Flow: authenticate → delegate → cache check → LangGraph workflow
      (vendor discovery → negotiation → compliance → execution → outcome → billing) → response.
"""

import asyncio
from contextlib import asynccontextmanager
from typing import Any, Dict, List, Optional

from fastapi import Depends, FastAPI, HTTPException, Header, WebSocket, WebSocketDisconnect, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from app.agents.orchestrator import run_workflow
from app.audit.logger import log_action
from app.auth.auth_service import AuthenticationError, create_user_token, verify_user_token
from app.auth.token_service import create_delegation_token
from app.auth.oauth import get_authorize_url, handle_oauth_callback, OAuthError
from app.auth.refresh_tokens import (
    create_refresh_token,
    store_refresh_token,
    validate_refresh_token,
    revoke_refresh_token,
)
from app.cache.semantic_cache import check_cache, store_cache
from app.identity.agent_registry import get_agent, register_agent, register_default_agents
from app.marketplace.vendor_registry import list_vendors, seed_vendors
from app.models.db import init_db
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
from app.services.websocket_manager import manager as ws_manager, workflow_event, system_event
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

log = get_logger(__name__)


# ---------------------------------------------------------------------------
# Intent → delegation scope mapping
# ---------------------------------------------------------------------------
_INTENT_SCOPES = {
    "purchase": ["purchase_item", "negotiate_price", "query_inventory"],
    "negotiation": ["negotiate_price", "query_inventory"],
    "information": ["query_inventory"],
    "compliance": ["query_inventory"],
    "execution": ["purchase_item", "query_inventory"],
}


# ---------------------------------------------------------------------------
# Lifespan — DB migrations + agent registration + vendor seeding on startup
# ---------------------------------------------------------------------------
@asynccontextmanager
async def lifespan(app: FastAPI):
    setup_logging()
    log.info("Orkestron starting up")
    await init_db()
    await register_default_agents()
    await seed_vendors()
    await seed_core_developer()
    await seed_capabilities()
    await seed_product_data()
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
# CORS — allow frontend origins
# ---------------------------------------------------------------------------
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins.split(","),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---------------------------------------------------------------------------
# Rate limiting middleware
# ---------------------------------------------------------------------------
app.add_middleware(RateLimitMiddleware)


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


class TaskRequest(BaseModel):
    input: str


class TaskResponse(BaseModel):
    status: str
    intent: str
    agent_path: List[str]
    response: Optional[str]
    # Marketplace fields (Phase 4)
    result: Optional[str] = None
    price: Optional[float] = None
    vendor: Optional[str] = None
    transaction_id: Optional[str] = None
    proof_hash: Optional[str] = None
    savings: Optional[float] = None
    # Existing detail fields
    negotiation_result: Optional[dict] = None
    compliance_status: str = ""
    compliance_violations: List[str] = []
    tool_outputs: List[dict] = []
    audit_hash: Optional[str] = None
    delegation_token_id: Optional[str] = None
    outcome: Optional[dict] = None
    billing_entry: Optional[dict] = None
    cached: bool


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
# POST /task — authenticated orchestration endpoint
# ---------------------------------------------------------------------------
@app.post("/task", response_model=TaskResponse)
async def handle_task(req: TaskRequest, user=Depends(get_current_user)):
    user_id: str = user["sub"]
    tenant_id: str = user["tenant_id"]

    # 1. Semantic cache lookup
    cached_response = check_cache(req.input)
    if cached_response is not None:
        CACHE_HITS_TOTAL.inc()
        audit_hash = await log_action(
            user_id=user_id,
            agent_name="cache",
            action_summary=f"Cache hit for input: {req.input[:120]}",
        )
        return TaskResponse(
            status="ok",
            intent="cached",
            agent_path=["cache"],
            response=cached_response,
            result=cached_response,
            audit_hash=audit_hash,
            proof_hash=audit_hash,
            cached=True,
        )

    # 2. Classify intent for scope selection (quick keyword check)
    from app.agents.supervisor import _classify_intent_keywords
    intent_hint = _classify_intent_keywords(req.input)
    scopes = _INTENT_SCOPES.get(intent_hint, ["query_inventory"])

    # 3. Issue a short-lived delegation token for the executor agent
    delegation = create_delegation_token(
        user_id=user_id,
        agent_id="agent-executor",
        tenant_id=tenant_id,
        scope=scopes,
    )

    CACHE_MISSES_TOTAL.inc()

    # 4. Run the full LangGraph orchestration workflow
    _wf_start = time.perf_counter()
    result = run_workflow(
        user_id=user_id,
        tenant_id=tenant_id,
        user_input=req.input,
        delegation_token=delegation["token"],
        delegation_token_id=delegation["token_id"],
    )

    _wf_elapsed = time.perf_counter() - _wf_start
    _wf_intent = result.get("intent", "unknown")
    AGENT_TASKS_TOTAL.labels(intent=_wf_intent).inc()
    AGENT_EXECUTION_TIME.labels(intent=_wf_intent).observe(_wf_elapsed)

    if result.get("execution_error"):
        FAILED_WORKFLOWS_TOTAL.labels(error_type="execution").inc()
    elif result.get("outcome") and result["outcome"].get("outcome_id") != "error":
        SUCCESSFUL_OUTCOMES_TOTAL.inc()

    if result.get("billing_entry"):
        BILLING_EVENTS_TOTAL.labels(
            pricing_model=result["billing_entry"].get("pricing_model", "unknown"),
        ).inc()

    log_workflow_event(
        log, "Workflow completed",
        user_id=user_id,
        task_type=_wf_intent,
        status="error" if result.get("execution_error") else "ok",
    )

    final_response = result.get("final_result", "")

    # 5. Store in semantic cache
    if final_response:
        store_cache(query=req.input, response=final_response)

    # 6. Extract marketplace transaction fields from workflow result
    transaction: Dict[str, Any] = result.get("transaction") or {}
    neg: Dict[str, Any] = result.get("negotiation_result") or {}

    return TaskResponse(
        status="ok",
        intent=result.get("intent", ""),
        agent_path=result.get("agent_path", []),
        response=final_response,
        # Phase 4 marketplace fields
        result=final_response,
        price=transaction.get("price") or neg.get("breakdown", {}).get("price_per_unit"),
        vendor=transaction.get("vendor_name") or neg.get("vendor"),
        transaction_id=transaction.get("transaction_id"),
        proof_hash=result.get("audit_hash"),
        savings=result.get("savings") or 0.0,
        # Detail fields
        negotiation_result=neg or None,
        compliance_status=result.get("compliance_status", ""),
        compliance_violations=result.get("compliance_violations", []),
        tool_outputs=result.get("tool_outputs", []),
        audit_hash=result.get("audit_hash"),
        delegation_token_id=delegation["token_id"],
        outcome=result.get("outcome"),
        billing_entry=result.get("billing_entry"),
        cached=False,
    )


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
    """Execute workflow nodes in topological order with WebSocket streaming."""
    import random

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
    overall_status = "completed"

    for node_id in order:
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

        # Simulate execution (replace with real agent calls)
        start_time = time.perf_counter()
        duration = random.uniform(0.8, 2.5)
        await asyncio.sleep(duration)

        # 95% success rate
        success = random.random() < 0.95
        elapsed = round(time.perf_counter() - start_time, 3)

        if success:
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
        else:
            node_results[node_id] = {
                "status": "error",
                "output": f"{node_label} execution failed",
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
