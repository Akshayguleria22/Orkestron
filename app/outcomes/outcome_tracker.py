"""
Outcome Tracker — records and queries transaction outcomes.

Every completed purchase is logged with the savings metric:
    value_generated = budget_limit - purchase_price

Persisted in the PostgreSQL `outcomes` table for historical analysis.
"""

import logging
import uuid
from typing import Any, Dict, List

from sqlalchemy import select

from app.models.db import Outcome, async_session

log = logging.getLogger(__name__)


async def record_outcome(
    user_id: str,
    agent_id: str,
    task_type: str,
    result: str,
    value_generated: float,
) -> Dict[str, Any]:
    """
    Persist a transaction outcome and return the record as dict.
    """
    outcome_id = f"out-{uuid.uuid4().hex[:12]}"

    record = Outcome(
        outcome_id=outcome_id,
        user_id=user_id,
        agent_id=agent_id,
        task_type=task_type,
        result=result,
        value_generated=value_generated,
    )

    async with async_session() as session:
        session.add(record)
        await session.commit()
        await session.refresh(record)

    log.info(
        "Recorded outcome %s: user=%s task=%s savings=%.0f",
        outcome_id, user_id, task_type, value_generated,
    )

    return {
        "outcome_id": record.outcome_id,
        "user_id": record.user_id,
        "agent_id": record.agent_id,
        "task_type": record.task_type,
        "result": record.result,
        "value_generated": record.value_generated,
        "timestamp": record.timestamp.isoformat(),
    }


async def get_user_outcomes(user_id: str) -> List[Dict[str, Any]]:
    """Return all outcomes for a given user, newest first."""
    async with async_session() as session:
        result = await session.execute(
            select(Outcome)
            .where(Outcome.user_id == user_id)
            .order_by(Outcome.timestamp.desc())
        )
        rows = result.scalars().all()
        return [
            {
                "outcome_id": r.outcome_id,
                "user_id": r.user_id,
                "agent_id": r.agent_id,
                "task_type": r.task_type,
                "result": r.result,
                "value_generated": r.value_generated,
                "timestamp": r.timestamp.isoformat(),
            }
            for r in rows
        ]
