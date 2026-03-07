"""
Orkestron — FastAPI API Gateway

Single entry point for all task orchestration requests.
Phase 7: Production Readiness — Observability, Metrics, Structured Logging.
Flow: authenticate → delegate → cache check → LangGraph workflow
      (vendor discovery → negotiation → compliance → execution → outcome → billing) → response.
"""

from contextlib import asynccontextmanager
from typing import Any, Dict, List, Optional

from fastapi import Depends, FastAPI, HTTPException, Header
from pydantic import BaseModel

from app.agents.orchestrator import run_workflow
from app.audit.logger import log_action
from app.auth.auth_service import AuthenticationError, create_user_token, verify_user_token
from app.auth.token_service import create_delegation_token
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
    log.info("Orkestron ready")
    yield
    log.info("Orkestron shutting down")


app = FastAPI(
    title="Orkestron",
    description="Autonomous Infrastructure Orchestrator — Phase 7 Production Ready",
    version="0.7.0",
    lifespan=lifespan,
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
# GET /agents/{agent_id} — look up an agent
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
# Phase 6: Developer & Capability Marketplace schemas
# ---------------------------------------------------------------------------
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


# ---------------------------------------------------------------------------
# Phase 6: Developer API-key auth dependency
# ---------------------------------------------------------------------------
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
# POST /developers/register — register a third-party developer
# ---------------------------------------------------------------------------
@app.post("/developers/register")
async def register_developer_endpoint(req: DeveloperRegisterRequest):
    result = await register_developer(name=req.name, email=req.email)
    return {"status": "registered", "developer": result}


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
    return {"status": "healthy"}
