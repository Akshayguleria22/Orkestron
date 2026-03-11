"""
Billing Ledger — persistence layer for billing entries.

Every billable outcome produces a BillingLedgerEntry row in PostgreSQL.
Supports querying by user, updating payment status, and aggregation.
"""

import logging
import uuid
from typing import Any, Dict, List, Optional

from sqlalchemy import select, update

from app.models.db import BillingLedgerEntry, async_session

log = logging.getLogger(__name__)


async def record_billing_entry(
    user_id: str,
    outcome_id: str,
    agent_id: str,
    pricing_model: str,
    fee: float,
    transaction_value: float = 0.0,
    savings_value: float = 0.0,
    transaction_id: Optional[str] = None,
    proof_hash: Optional[str] = None,
) -> Dict[str, Any]:
    """Create a new billing ledger entry and return it as a dict."""
    entry_id = f"bill-{uuid.uuid4().hex[:12]}"

    entry = BillingLedgerEntry(
        entry_id=entry_id,
        user_id=user_id,
        outcome_id=outcome_id,
        agent_id=agent_id,
        transaction_id=transaction_id,
        pricing_model=pricing_model,
        transaction_value=transaction_value,
        savings_value=savings_value,
        fee=fee,
        proof_hash=proof_hash,
    )

    async with async_session() as session:
        session.add(entry)
        await session.commit()
        await session.refresh(entry)

    log.info(
        "Billing entry %s: user=%s model=%s fee=%.2f",
        entry_id, user_id, pricing_model, fee,
    )

    return _entry_to_dict(entry)


async def get_user_ledger(user_id: str) -> List[Dict[str, Any]]:
    """Return all billing entries for a user, newest first."""
    async with async_session() as session:
        result = await session.execute(
            select(BillingLedgerEntry)
            .where(BillingLedgerEntry.user_id == user_id)
            .order_by(BillingLedgerEntry.created_at.desc())
        )
        return [_entry_to_dict(r) for r in result.scalars().all()]


async def update_payment_status(
    entry_id: str,
    status: str,
) -> bool:
    """Update the payment_status of a billing entry. Returns True on success."""
    async with async_session() as session:
        result = await session.execute(
            update(BillingLedgerEntry)
            .where(BillingLedgerEntry.entry_id == entry_id)
            .values(payment_status=status)
        )
        await session.commit()
        return result.rowcount > 0


def _entry_to_dict(entry: BillingLedgerEntry) -> Dict[str, Any]:
    return {
        "entry_id": entry.entry_id,
        "user_id": entry.user_id,
        "outcome_id": entry.outcome_id,
        "agent_id": entry.agent_id,
        "transaction_id": entry.transaction_id,
        "pricing_model": entry.pricing_model,
        "transaction_value": entry.transaction_value,
        "savings_value": entry.savings_value,
        "fee": entry.fee,
        "currency": entry.currency,
        "payment_status": entry.payment_status,
        "proof_hash": entry.proof_hash,
        "created_at": entry.created_at.isoformat(),
    }
