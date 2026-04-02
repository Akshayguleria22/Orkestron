"""
Database engine, session, and ORM models.
Uses async SQLAlchemy with asyncpg for PostgreSQL.

Phase 4: adds Vendor and Outcome tables for agentic marketplace.
Phase 5: adds BillingLedgerEntry and Invoice tables for outcome-based billing.
"""

from datetime import datetime, timezone

from sqlalchemy import Boolean, Column, DateTime, Float, Integer, String, Text, text
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
# Phase 9 — Real AI Task Execution Platform
# ---------------------------------------------------------------------------

class Task(Base):
    """
    User-submitted task — the core entity of the AI execution platform.
    Each task is decomposed by the planner and executed by agents.
    """

    __tablename__ = "tasks"

    id = Column(Integer, primary_key=True, autoincrement=True)
    task_id = Column(String(128), nullable=False, unique=True, index=True)
    user_id = Column(String(256), nullable=False, index=True)
    input_text = Column(Text, nullable=False)
    task_type = Column(String(64), nullable=True)  # search | analysis | comparison | research | execution
    status = Column(String(32), nullable=False, default="pending")  # pending | queued | planning | running | completed | failed
    plan = Column(JSON, nullable=True)  # planner output: list of steps
    result = Column(JSON, nullable=True)  # structured final result
    result_text = Column(Text, nullable=True)  # human-readable summary
    agent_path = Column(JSON, nullable=False, default=list)  # agents that ran
    total_duration = Column(Float, nullable=True)
    error_message = Column(Text, nullable=True)
    task_metadata = Column(JSON, nullable=False, default=dict)
    created_at = Column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
    )
    completed_at = Column(DateTime(timezone=True), nullable=True)


class AgentExecutionLog(Base):
    """
    Per-agent execution log — records input, output, latency, and tool usage
    for every agent invocation within a task.
    """

    __tablename__ = "agent_logs"

    id = Column(Integer, primary_key=True, autoincrement=True)
    log_id = Column(String(128), nullable=False, unique=True, index=True)
    task_id = Column(String(128), nullable=False, index=True)
    agent_name = Column(String(128), nullable=False, index=True)
    agent_type = Column(String(64), nullable=False)  # planner | search | extraction | reasoning | comparison | result
    step_index = Column(Integer, nullable=False, default=0)
    input_data = Column(JSON, nullable=False, default=dict)
    output_data = Column(JSON, nullable=True)
    status = Column(String(32), nullable=False, default="pending")  # pending | running | completed | error
    latency_ms = Column(Float, nullable=True)
    tools_used = Column(JSON, nullable=False, default=list)  # list of tool names invoked
    error_message = Column(Text, nullable=True)
    created_at = Column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
    )


class ToolCallLog(Base):
    """
    Records every external tool invocation — web search, scrape, API call, etc.
    Linked to the agent_log that triggered it.
    """

    __tablename__ = "tool_calls"

    id = Column(Integer, primary_key=True, autoincrement=True)
    call_id = Column(String(128), nullable=False, unique=True, index=True)
    task_id = Column(String(128), nullable=False, index=True)
    agent_log_id = Column(String(128), nullable=False, index=True)
    tool_name = Column(String(128), nullable=False)  # web_search | web_scrape | api_call | email | db_query | vector_search
    input_params = Column(JSON, nullable=False, default=dict)
    output_data = Column(JSON, nullable=True)
    status = Column(String(32), nullable=False, default="pending")  # pending | success | error
    latency_ms = Column(Float, nullable=True)
    error_message = Column(Text, nullable=True)
    created_at = Column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
    )


# ---------------------------------------------------------------------------
# Refresh Tokens — DB-backed (replaces in-memory storage)
# ---------------------------------------------------------------------------

class RefreshToken(Base):
    """
    Stores hashed refresh tokens in the database.
    Supports token rotation and reuse detection.
    """

    __tablename__ = "refresh_tokens"

    id = Column(Integer, primary_key=True, autoincrement=True)
    token_hash = Column(String(64), nullable=False, unique=True, index=True)
    user_id = Column(String(256), nullable=False, index=True)
    revoked = Column(Boolean, nullable=False, default=False)
    expires_at = Column(DateTime(timezone=True), nullable=False)
    created_at = Column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
    )


# ---------------------------------------------------------------------------
# Marketplace Deployed Agents — user-deployable agents from marketplace
# ---------------------------------------------------------------------------

class MarketplaceDeployedAgent(Base):
    """
    Tracks agents deployed by a user from the marketplace.
    """

    __tablename__ = "marketplace_deployed_agents"

    id = Column(Integer, primary_key=True, autoincrement=True)
    deployment_id = Column(String(128), nullable=False, unique=True, index=True)
    user_id = Column(String(256), nullable=False, index=True)
    agent_id = Column(String(128), nullable=False, index=True)
    agent_name = Column(String(256), nullable=False)
    status = Column(String(32), nullable=False, default="active")  # active | paused | removed
    config = Column(JSON, nullable=False, default=dict)
    deployed_at = Column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
    )


# ---------------------------------------------------------------------------
# Phase 10 — Deployable Agent Marketplace (Real Agent Platform)
# ---------------------------------------------------------------------------

class DeployableAgent(Base):
    """
    A user-deployed AI agent that can be public or private.
    Supports LLM, ML, and hybrid agent types.
    Anyone can deploy; public agents are available to all users.
    """

    __tablename__ = "deployable_agents"

    id = Column(Integer, primary_key=True, autoincrement=True)
    agent_id = Column(String(128), nullable=False, unique=True, index=True)
    owner_id = Column(String(256), nullable=False, index=True)  # user who deployed
    name = Column(String(256), nullable=False)
    description = Column(Text, nullable=False, default="")
    agent_type = Column(String(32), nullable=False, default="llm")  # llm | ml | hybrid
    visibility = Column(String(16), nullable=False, default="public")  # public | private
    status = Column(String(32), nullable=False, default="active")  # active | paused | error | removed

    # Capabilities this agent exposes
    capabilities = Column(ARRAY(String), nullable=False, default=list)
    # ML models this agent uses (e.g. ["sentiment", "ner", "similarity"])
    ml_models = Column(ARRAY(String), nullable=False, default=list)
    # LLM config
    llm_provider = Column(String(64), nullable=True)  # groq | openai | local
    llm_model = Column(String(128), nullable=True)  # e.g. openai/gpt-oss-120b
    # System prompt for LLM-based agents
    system_prompt = Column(Text, nullable=True)
    # Tools this agent can use
    tools = Column(ARRAY(String), nullable=False, default=list)  # web_search | scraper | ml_classify | ...
    # Runtime config
    config = Column(JSON, nullable=False, default=dict)  # temperature, max_tokens, etc.
    # Associated workflow (optional)
    workflow_id = Column(String(128), nullable=True, index=True)

    # Usage stats (updated after each execution)
    total_runs = Column(Integer, nullable=False, default=0)
    successful_runs = Column(Integer, nullable=False, default=0)
    failed_runs = Column(Integer, nullable=False, default=0)
    avg_latency_ms = Column(Float, nullable=False, default=0.0)
    total_tokens_used = Column(Integer, nullable=False, default=0)

    # Metadata
    tags = Column(ARRAY(String), nullable=False, default=list)
    icon = Column(String(64), nullable=True)  # emoji or icon name
    category = Column(String(64), nullable=True)  # research | analysis | coding | creative | ...

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


class AgentRun(Base):
    """
    Records every execution of a deployable agent.
    Tracks input, output, tools used, latency, and token usage.
    """

    __tablename__ = "agent_runs"

    id = Column(Integer, primary_key=True, autoincrement=True)
    run_id = Column(String(128), nullable=False, unique=True, index=True)
    agent_id = Column(String(128), nullable=False, index=True)
    user_id = Column(String(256), nullable=False, index=True)  # user who triggered
    task_id = Column(String(128), nullable=True, index=True)  # linked task (optional)

    input_text = Column(Text, nullable=False)
    status = Column(String(32), nullable=False, default="pending")  # pending | running | completed | failed
    result = Column(JSON, nullable=True)
    result_text = Column(Text, nullable=True)
    error_message = Column(Text, nullable=True)

    # Execution details
    steps = Column(JSON, nullable=False, default=list)  # [{tool, input, output, duration, status}]
    tools_used = Column(ARRAY(String), nullable=False, default=list)
    ml_models_used = Column(ARRAY(String), nullable=False, default=list)
    tokens_used = Column(Integer, nullable=False, default=0)
    total_duration = Column(Float, nullable=True)

    created_at = Column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
    )
    completed_at = Column(DateTime(timezone=True), nullable=True)


# ---------------------------------------------------------------------------
# Execution Trace — real traces for observatory (replaces mock workflow data)
# ---------------------------------------------------------------------------

class ExecutionTrace(Base):
    """
    Records full execution traces for the observatory.
    Each trace represents one task's full agent execution pipeline.
    """

    __tablename__ = "execution_traces"

    id = Column(Integer, primary_key=True, autoincrement=True)
    trace_id = Column(String(128), nullable=False, unique=True, index=True)
    task_id = Column(String(128), nullable=False, index=True)
    user_id = Column(String(256), nullable=False, index=True)
    status = Column(String(32), nullable=False, default="running")  # running | completed | failed
    nodes = Column(JSON, nullable=False, default=list)  # [{agent, status, duration, input, output}]
    total_duration = Column(Float, nullable=True)
    started_at = Column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
    )
    completed_at = Column(DateTime(timezone=True), nullable=True)


# ---------------------------------------------------------------------------
# DB initialization — must be after ALL models so metadata includes everything
# ---------------------------------------------------------------------------

async def init_db() -> None:
    """Create all tables if they don't exist yet."""
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        # Keep old databases compatible when new columns are introduced.
        await conn.execute(
            text(
                "ALTER TABLE deployable_agents "
                "ADD COLUMN IF NOT EXISTS workflow_id VARCHAR(128)"
            )
        )
        await conn.execute(
            text(
                "CREATE INDEX IF NOT EXISTS ix_deployable_agents_workflow_id "
                "ON deployable_agents (workflow_id)"
            )
        )
