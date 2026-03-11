"""
Refresh Token Service — long-lived tokens for session renewal.

Refresh tokens are opaque strings stored server-side (Redis or in-memory).
They allow the frontend to obtain new access tokens without re-authentication.
"""

import secrets
import hashlib
from datetime import datetime, timedelta, timezone
from typing import Dict, Optional, Any

from app.config import settings

# In-memory store — production should use Redis
_refresh_store: Dict[str, Dict[str, Any]] = {}


def create_refresh_token(user_id: str) -> str:
    """Generate a cryptographically secure refresh token."""
    return secrets.token_urlsafe(48)


def _hash_token(token: str) -> str:
    """Hash a refresh token for storage (don't store plaintext)."""
    return hashlib.sha256(token.encode()).hexdigest()


async def store_refresh_token(user_id: str, token: str) -> None:
    """Store a hashed refresh token with metadata."""
    token_hash = _hash_token(token)
    _refresh_store[token_hash] = {
        "user_id": user_id,
        "created_at": datetime.now(timezone.utc),
        "expires_at": datetime.now(timezone.utc) + timedelta(days=settings.refresh_token_expiry_days),
        "revoked": False,
    }


async def validate_refresh_token(token: str) -> Optional[Dict[str, Any]]:
    """
    Validate a refresh token. Returns user metadata if valid, None otherwise.
    Token is single-use — it's revoked after validation (rotation).
    """
    token_hash = _hash_token(token)
    entry = _refresh_store.get(token_hash)

    if not entry:
        return None

    if entry["revoked"]:
        # Possible token reuse attack — revoke all tokens for this user
        await revoke_all_user_tokens(entry["user_id"])
        return None

    if datetime.now(timezone.utc) > entry["expires_at"]:
        _refresh_store.pop(token_hash, None)
        return None

    # Rotate: revoke old token (caller should issue new one)
    entry["revoked"] = True

    return {"user_id": entry["user_id"]}


async def revoke_refresh_token(token: str) -> bool:
    """Explicitly revoke a refresh token (e.g., on logout)."""
    token_hash = _hash_token(token)
    entry = _refresh_store.get(token_hash)
    if entry:
        entry["revoked"] = True
        return True
    return False


async def revoke_all_user_tokens(user_id: str) -> int:
    """Revoke all refresh tokens for a user (security measure)."""
    count = 0
    for entry in _refresh_store.values():
        if entry["user_id"] == user_id and not entry["revoked"]:
            entry["revoked"] = True
            count += 1
    return count
