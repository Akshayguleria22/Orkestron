"""
Database engine, session, and ORM models.
Uses async SQLAlchemy with asyncpg for PostgreSQL.

Phase 4: adds Vendor and Outcome tables for agentic marketplace.
Phase 5: adds BillingLedgerEntry and Invoice tables for outcome-based billing.
"""

from datetime import datetime, timezone

from sqlalchemy import Boolean, Column, DateTime, Float, Integer, String, Text
from sqlalchemy.dialects.postgresql import ARRAY, JSON
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.orm import DeclarativeBase, sessionmaker

from app.config import settings

# Async engine — connection pool to PostgreSQL
engine = create_async_engine(settings.database_url, echo=False, future=True)

# Session factory bound to the async engine
async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


class Base(DeclarativeBase):
    pass


class AuditLog(Base):
    """
    Immutable audit trail for every agent action.
    The `hash` column stores a SHA-256 proof-of-action digest.
    Extended with agent_id, delegation_token_id, tool_used, execution_status.
    """

    __tablename__ = "audit_logs"

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(String(128), nullable=False, index=True)
    agent = Column(String(64), nullable=False)
    action = Column(Text, nullable=False)
    hash = Column(String(64), nullable=False, unique=True)
    timestamp = Column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
    )
    # --- Phase 3 security fields ---
    agent_id = Column(String(128), nullable=True, index=True)
    delegation_token_id = Column(String(128), nullable=True)
    tool_used = Column(String(64), nullable=True)
    execution_status = Column(String(32), nullable=True)  # success | error | denied


class Agent(Base):
    """
    Agent Identity Registry.
    Each agent must register before it can participate in orchestration.
    """

    __tablename__ = "agents"

    id = Column(Integer, primary_key=True, autoincrement=True)
    agent_id = Column(String(128), nullable=False, unique=True, index=True)
    name = Column(String(128), nullable=False)
    public_key = Column(Text, nullable=False)
    capabilities = Column(ARRAY(String), nullable=False, default=list)
    reputation_score = Column(Float, nullable=False, default=1.0)
    created_at = Column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
    )


# ---------------------------------------------------------------------------
# Phase 4 — Marketplace models
# ---------------------------------------------------------------------------

class Vendor(Base):
    """
    Vendor in the agentic commerce marketplace.
    inventory is a JSON dict mapping product keys to prices, e.g.
    {"ram_16gb_ddr4": 4300, "ram_16gb_ddr5": 5200}
    """

    __tablename__ = "vendors"

    id = Column(Integer, primary_key=True, autoincrement=True)
    vendor_id = Column(String(128), nullable=False, unique=True, index=True)
    vendor_name = Column(String(256), nullable=False)
    rating = Column(Float, nullable=False, default=4.0)
    delivery_speed = Column(Integer, nullable=False, default=3)  # days
    inventory = Column(JSON, nullable=False, default=dict)
    pricing_model = Column(String(64), nullable=False, default="fixed")
    created_at = Column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
    )


class Outcome(Base):
    """
    Tracks the outcome of every agentic commerce transaction.
    value_generated = budget_limit - purchase_price (savings metric).
    """

    __tablename__ = "outcomes"

    id = Column(Integer, primary_key=True, autoincrement=True)
    outcome_id = Column(String(128), nullable=False, unique=True, index=True)
    user_id = Column(String(128), nullable=False, index=True)
    agent_id = Column(String(128), nullable=False)
    task_type = Column(String(64), nullable=False)
    result = Column(Text, nullable=False)
    value_generated = Column(Float, nullable=False, default=0.0)
    timestamp = Column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
    )


# ---------------------------------------------------------------------------
# Phase 5 — Billing models
# ---------------------------------------------------------------------------

class BillingLedgerEntry(Base):
    """
    Individual billing entry created after each billable outcome.
    pricing_model: outcome_fee | savings_fee | flat_fee
    """

    __tablename__ = "billing_ledger"

    id = Column(Integer, primary_key=True, autoincrement=True)
    entry_id = Column(String(128), nullable=False, unique=True, index=True)
    user_id = Column(String(128), nullable=False, index=True)
    outcome_id = Column(String(128), nullable=False, index=True)
    agent_id = Column(String(128), nullable=False)
    transaction_id = Column(String(128), nullable=True)
    pricing_model = Column(String(64), nullable=False)
    transaction_value = Column(Float, nullable=False, default=0.0)
    savings_value = Column(Float, nullable=False, default=0.0)
    fee = Column(Float, nullable=False, default=0.0)
    currency = Column(String(8), nullable=False, default="INR")
    payment_status = Column(String(32), nullable=False, default="pending")  # pending | paid | waived
    proof_hash = Column(String(64), nullable=True)
    created_at = Column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
    )


class Invoice(Base):
    """
    Aggregated invoice for a user over a billing period.
    """

    __tablename__ = "invoices"

    id = Column(Integer, primary_key=True, autoincrement=True)
    invoice_id = Column(String(128), nullable=False, unique=True, index=True)
    user_id = Column(String(128), nullable=False, index=True)
    total_fee = Column(Float, nullable=False, default=0.0)
    total_transactions = Column(Integer, nullable=False, default=0)
    total_savings = Column(Float, nullable=False, default=0.0)
    currency = Column(String(8), nullable=False, default="INR")
    status = Column(String(32), nullable=False, default="draft")  # draft | issued | paid
    period_start = Column(DateTime(timezone=True), nullable=True)
    period_end = Column(DateTime(timezone=True), nullable=True)
    line_items = Column(JSON, nullable=False, default=list)
    created_at = Column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
    )


# ---------------------------------------------------------------------------
# Phase 6 — Agent Capability Marketplace models
# ---------------------------------------------------------------------------

class Developer(Base):
    """
    Third-party developer account.
    Developers register agents and publish capabilities into the marketplace.
    """

    __tablename__ = "developers"

    id = Column(Integer, primary_key=True, autoincrement=True)
    developer_id = Column(String(128), nullable=False, unique=True, index=True)
    name = Column(String(256), nullable=False)
    email = Column(String(256), nullable=False, unique=True, index=True)
    api_key = Column(String(128), nullable=False, unique=True, index=True)
    status = Column(String(32), nullable=False, default="active")  # active | suspended | revoked
    created_at = Column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
    )


class AgentCapability(Base):
    """
    Published capability that an agent exposes.
    Links an agent_id to a named capability with schema and endpoint metadata.
    Developers register capabilities; the orchestrator discovers them at runtime.
    """

    __tablename__ = "agent_capabilities"

    id = Column(Integer, primary_key=True, autoincrement=True)
    capability_id = Column(String(128), nullable=False, unique=True, index=True)
    agent_id = Column(String(128), nullable=False, index=True)
    developer_id = Column(String(128), nullable=False, index=True)
    capability_name = Column(String(128), nullable=False, index=True)
    description = Column(Text, nullable=False, default="")
    input_schema = Column(JSON, nullable=False, default=dict)
    output_schema = Column(JSON, nullable=False, default=dict)
    endpoint = Column(String(512), nullable=True)
    version = Column(String(32), nullable=False, default="1.0.0")
    created_at = Column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
    )


# ---------------------------------------------------------------------------
# Phase 8 — User accounts (OAuth2 + local)
# ---------------------------------------------------------------------------

class User(Base):
    """
    User account — supports OAuth2 (Google, GitHub) and local login.
    """

    __tablename__ = "users"

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(String(256), nullable=False, unique=True, index=True)
    email = Column(String(256), nullable=True, index=True)
    name = Column(String(256), nullable=True)
    avatar_url = Column(String(512), nullable=True)
    provider = Column(String(32), nullable=False, default="local")  # google | github | local
    password_hash = Column(String(256), nullable=True)  # for local accounts
    role = Column(String(32), nullable=False, default="user")  # user | admin
    is_active = Column(Boolean, nullable=False, default=True)
    last_login = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
    )


# ---------------------------------------------------------------------------
# Phase 8 — Saved Workflows
# ---------------------------------------------------------------------------

class SavedWorkflow(Base):
    """
    User-created workflow definitions (from the n8n-style builder).
    Stores the full React Flow graph as JSON.
    """

    __tablename__ = "saved_workflows"

    id = Column(Integer, primary_key=True, autoincrement=True)
    workflow_id = Column(String(128), nullable=False, unique=True, index=True)
    user_id = Column(String(256), nullable=False, index=True)
    name = Column(String(256), nullable=False)
    description = Column(Text, nullable=True)
    graph_json = Column(JSON, nullable=False, default=dict)  # {nodes, edges}
    status = Column(String(32), nullable=False, default="draft")  # draft | active | archived
    version = Column(Integer, nullable=False, default=1)
    last_run_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
    )
    updated_at = Column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
    )


# ---------------------------------------------------------------------------
# Phase 8 — Workflow Execution Runs
# ---------------------------------------------------------------------------

class WorkflowRun(Base):
    """
    Records of workflow executions with per-node results.
    """

    __tablename__ = "workflow_runs"

    id = Column(Integer, primary_key=True, autoincrement=True)
    run_id = Column(String(128), nullable=False, unique=True, index=True)
    workflow_id = Column(String(128), nullable=False, index=True)
    user_id = Column(String(256), nullable=False, index=True)
    status = Column(String(32), nullable=False, default="pending")  # pending | running | completed | failed
    node_results = Column(JSON, nullable=False, default=dict)  # {node_id: {status, output, duration}}
    total_duration = Column(Float, nullable=True)
    error_message = Column(Text, nullable=True)
    started_at = Column(DateTime(timezone=True), nullable=True)
    completed_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
    )


# ---------------------------------------------------------------------------
# Phase 8 — Product / Vendor Inventory (Real Data)
# ---------------------------------------------------------------------------

class Product(Base):
    """
    Individual product in vendor inventory for real data queries.
    """

    __tablename__ = "products"

    id = Column(Integer, primary_key=True, autoincrement=True)
    product_id = Column(String(128), nullable=False, unique=True, index=True)
    vendor_id = Column(String(128), nullable=False, index=True)
    name = Column(String(256), nullable=False)
    category = Column(String(128), nullable=False, index=True)
    price = Column(Float, nullable=False)
    currency = Column(String(8), nullable=False, default="INR")
    specs = Column(JSON, nullable=False, default=dict)
    stock = Column(Integer, nullable=False, default=0)
    rating = Column(Float, nullable=False, default=0.0)
    is_available = Column(Boolean, nullable=False, default=True)
    created_at = Column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
    )


# ---------------------------------------------------------------------------
# DB initialization — must be after ALL models so metadata includes everything
# ---------------------------------------------------------------------------

async def init_db() -> None:
    """Create all tables if they don't exist yet."""
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
