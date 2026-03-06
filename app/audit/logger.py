"""
Proof-of-Action Logger — produces a SHA-256 hash for every agent action
and persists an immutable record in PostgreSQL.

Extended with agent_id, delegation_token_id, tool_used, execution_status
for full security audit trail reconstruction.
"""

import hashlib
from datetime import datetime, timezone
from typing import Optional

from app.models.db import AuditLog, async_session


def _compute_hash(user_id: str, agent_name: str, action_summary: str, ts: str) -> str:
    """Deterministic SHA-256 over the four audit fields."""
    payload = f"{user_id}|{agent_name}|{action_summary}|{ts}"
    return hashlib.sha256(payload.encode("utf-8")).hexdigest()


async def log_action(
    user_id: str,
    agent_name: str,
    action_summary: str,
    agent_id: Optional[str] = None,
    delegation_token_id: Optional[str] = None,
    tool_used: Optional[str] = None,
    execution_status: Optional[str] = None,
) -> str:
    """
    Record one proof-of-action entry.
    Returns the SHA-256 hash so the API can include it in the response.
    """
    now = datetime.now(timezone.utc)
    ts_str = now.isoformat()
    action_hash = _compute_hash(user_id, agent_name, action_summary, ts_str)

    record = AuditLog(
        user_id=user_id,
        agent=agent_name,
        action=action_summary,
        hash=action_hash,
        timestamp=now,
        agent_id=agent_id,
        delegation_token_id=delegation_token_id,
        tool_used=tool_used,
        execution_status=execution_status,
    )

    async with async_session() as session:
        session.add(record)
        await session.commit()

    return action_hash
