"""
Billing Engine — processes outcomes into billing entries.

After each outcome is recorded, the billing engine:
  1. Determines the pricing model from the task_type
  2. Calculates the fee
  3. Persists a billing ledger entry
"""

import logging
from typing import Any, Dict, Optional

from app.billing.pricing_models import calculate_fee, default_model_for_task
from app.billing.ledger import record_billing_entry

log = logging.getLogger(__name__)


async def process_outcome(
    user_id: str,
    outcome_id: str,
    agent_id: str,
    task_type: str,
    transaction_value: float = 0.0,
    savings: float = 0.0,
    transaction_id: Optional[str] = None,
    proof_hash: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Given a completed outcome, calculate the fee and persist a billing entry.
    Returns the billing entry dict.
    """
    pricing_model = default_model_for_task(task_type)
    fee = calculate_fee(
        pricing_model=pricing_model,
        transaction_value=transaction_value,
        savings=savings,
    )

    entry = await record_billing_entry(
        user_id=user_id,
        outcome_id=outcome_id,
        agent_id=agent_id,
        pricing_model=pricing_model,
        fee=fee,
        transaction_value=transaction_value,
        savings_value=savings,
        transaction_id=transaction_id,
        proof_hash=proof_hash,
    )

    log.info(
        "Billed outcome %s: model=%s fee=%.2f",
        outcome_id, pricing_model, fee,
    )

    return entry
