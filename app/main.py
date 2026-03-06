"""
Orkestron — FastAPI API Gateway

Single entry point for all task orchestration requests.
Phase 5: Outcome-Based Billing Engine.
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
    await init_db()
    await register_default_agents()
    await seed_vendors()
    yield


app = FastAPI(
    title="Orkestron",
    description="Autonomous Infrastructure Orchestrator — Phase 5 Outcome-Based Billing",
    version="0.5.0",
    lifespan=lifespan,
)


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

    # 4. Run the full LangGraph orchestration workflow
    result = run_workflow(
        user_id=user_id,
        tenant_id=tenant_id,
        user_input=req.input,
        delegation_token=delegation["token"],
        delegation_token_id=delegation["token_id"],
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
# Health check
# ---------------------------------------------------------------------------
@app.get("/health")
async def health():
    return {"status": "healthy"}
