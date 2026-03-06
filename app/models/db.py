"""
Database engine, session, and ORM models.
Uses async SQLAlchemy with asyncpg for PostgreSQL.

Phase 4: adds Vendor and Outcome tables for agentic marketplace.
Phase 5: adds BillingLedgerEntry and Invoice tables for outcome-based billing.
"""

from datetime import datetime, timezone

from sqlalchemy import Column, DateTime, Float, Integer, String, Text
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
# DB initialization — must be after ALL models so metadata includes everything
# ---------------------------------------------------------------------------

async def init_db() -> None:
    """Create all tables if they don't exist yet."""
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
