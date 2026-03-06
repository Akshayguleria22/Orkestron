"""
Invoice Service — generates and queries invoices.

An invoice aggregates billing ledger entries for a user over
a billing period (or all un-invoiced entries when no period is given).
"""

import logging
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from sqlalchemy import select

from app.billing.ledger import get_user_ledger
from app.models.db import Invoice, async_session

log = logging.getLogger(__name__)


async def generate_invoice(
    user_id: str,
    period_start: Optional[datetime] = None,
    period_end: Optional[datetime] = None,
) -> Dict[str, Any]:
    """
    Create an invoice from the user's pending billing ledger entries.
    If period_start/period_end are given, only entries within that window
    are included; otherwise all pending entries are aggregated.
    """
    entries = await get_user_ledger(user_id)

    # Filter to pending entries within the billing period
    line_items: List[Dict[str, Any]] = []
    total_fee = 0.0
    total_savings = 0.0

    for entry in entries:
        if entry["payment_status"] != "pending":
            continue

        entry_ts = datetime.fromisoformat(entry["created_at"])
        if period_start and entry_ts < period_start:
            continue
        if period_end and entry_ts > period_end:
            continue

        line_items.append({
            "entry_id": entry["entry_id"],
            "pricing_model": entry["pricing_model"],
            "fee": entry["fee"],
            "transaction_value": entry["transaction_value"],
            "savings_value": entry["savings_value"],
        })
        total_fee += entry["fee"]
        total_savings += entry["savings_value"]

    invoice_id = f"inv-{uuid.uuid4().hex[:12]}"
    now = datetime.now(timezone.utc)

    invoice = Invoice(
        invoice_id=invoice_id,
        user_id=user_id,
        total_fee=round(total_fee, 2),
        total_transactions=len(line_items),
        total_savings=round(total_savings, 2),
        status="issued",
        period_start=period_start or now,
        period_end=period_end or now,
        line_items=line_items,
    )

    async with async_session() as session:
        session.add(invoice)
        await session.commit()
        await session.refresh(invoice)

    log.info(
        "Invoice %s: user=%s items=%d total=%.2f",
        invoice_id, user_id, len(line_items), total_fee,
    )

    return _invoice_to_dict(invoice)


async def list_user_invoices(user_id: str) -> List[Dict[str, Any]]:
    """Return all invoices for a user, newest first."""
    async with async_session() as session:
        result = await session.execute(
            select(Invoice)
            .where(Invoice.user_id == user_id)
            .order_by(Invoice.created_at.desc())
        )
        return [_invoice_to_dict(r) for r in result.scalars().all()]


async def get_invoice_details(invoice_id: str) -> Optional[Dict[str, Any]]:
    """Return a single invoice by its id."""
    async with async_session() as session:
        result = await session.execute(
            select(Invoice).where(Invoice.invoice_id == invoice_id)
        )
        row = result.scalar_one_or_none()
        return _invoice_to_dict(row) if row else None


def _invoice_to_dict(inv: Invoice) -> Dict[str, Any]:
    return {
        "invoice_id": inv.invoice_id,
        "user_id": inv.user_id,
        "total_fee": inv.total_fee,
        "total_transactions": inv.total_transactions,
        "total_savings": inv.total_savings,
        "currency": inv.currency,
        "status": inv.status,
        "period_start": inv.period_start.isoformat() if inv.period_start else None,
        "period_end": inv.period_end.isoformat() if inv.period_end else None,
        "line_items": inv.line_items,
        "created_at": inv.created_at.isoformat(),
    }
