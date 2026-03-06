"""
Delegation Token Service — On-Behalf-Of (OBO) token model.

A delegation token authorises a specific agent to act on behalf of a user
within a bounded scope and time window. Agents must present a valid
delegation token before any tool execution.

Token payload:
    user_id, agent_id, scope (list), tenant_id, token_id, exp
"""

import uuid
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List

import jwt

from app.config import settings


class DelegationError(Exception):
    """Raised when a delegation token is invalid, expired, or scope-violated."""


def create_delegation_token(
    user_id: str,
    agent_id: str,
    tenant_id: str,
    scope: List[str],
) -> Dict[str, str]:
    """
    Mint a short-lived delegation token.
    Returns dict with 'token' and 'token_id'.
    """
    now = datetime.now(timezone.utc)
    token_id = str(uuid.uuid4())

    payload: Dict[str, Any] = {
        "sub": user_id,
        "agent_id": agent_id,
        "tenant_id": tenant_id,
        "scope": scope,
        "token_id": token_id,
        "iat": now,
        "exp": now + timedelta(minutes=settings.delegation_token_expiry_minutes),
        "type": "delegation",
    }

    token = jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algorithm)
    return {"token": token, "token_id": token_id}


def verify_delegation_token(token: str) -> Dict[str, Any]:
    """
    Decode and validate a delegation token.
    Returns the full payload on success.
    Raises DelegationError on failure.
    """
    try:
        payload = jwt.decode(
            token,
            settings.jwt_secret,
            algorithms=[settings.jwt_algorithm],
        )
    except jwt.ExpiredSignatureError:
        raise DelegationError("Delegation token has expired")
    except jwt.InvalidTokenError as exc:
        raise DelegationError(f"Invalid delegation token: {exc}")

    if payload.get("type") != "delegation":
        raise DelegationError("Token is not a delegation token")

    return payload


def check_scope(token_payload: Dict[str, Any], required_scope: str) -> bool:
    """Return True if the delegation token grants the required scope."""
    granted = token_payload.get("scope", [])
    return required_scope in granted
