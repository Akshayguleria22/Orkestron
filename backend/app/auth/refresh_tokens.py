"""
Refresh Token Service — long-lived tokens for session renewal.

Tokens are stored in PostgreSQL (RefreshToken table) with SHA-256 hashing.
Supports token rotation and reuse detection.
"""

import secrets
import hashlib
from datetime import datetime, timedelta, timezone
from typing import Optional, Any, Dict

from sqlalchemy import select, update

from app.config import settings
from app.models.db import RefreshToken, async_session


def create_refresh_token(user_id: str) -> str:
    """Generate a cryptographically secure refresh token."""
    return secrets.token_urlsafe(48)


def _hash_token(token: str) -> str:
    """Hash a refresh token for storage (don't store plaintext)."""
    return hashlib.sha256(token.encode()).hexdigest()


async def store_refresh_token(user_id: str, token: str) -> None:
    """Store a hashed refresh token in the database."""
    token_hash = _hash_token(token)
    expires_at = datetime.now(timezone.utc) + timedelta(days=settings.refresh_token_expiry_days)

    entry = RefreshToken(
        token_hash=token_hash,
        user_id=user_id,
        revoked=False,
        expires_at=expires_at,
    )
    async with async_session() as session:
        session.add(entry)
        await session.commit()


async def validate_refresh_token(token: str) -> Optional[Dict[str, Any]]:
    """
    Validate a refresh token. Returns user metadata if valid, None otherwise.
    Token is single-use — it's revoked after validation (rotation).
    """
    token_hash = _hash_token(token)

    async with async_session() as session:
        result = await session.execute(
            select(RefreshToken).where(RefreshToken.token_hash == token_hash)
        )
        entry = result.scalar_one_or_none()

        if not entry:
            return None

        if entry.revoked:
            # Possible token reuse attack — revoke all tokens for this user
            await revoke_all_user_tokens(entry.user_id)
            return None

        if datetime.now(timezone.utc) > entry.expires_at:
            await session.delete(entry)
            await session.commit()
            return None

        # Rotate: revoke old token (caller should issue new one)
        entry.revoked = True
        await session.commit()

        return {"user_id": entry.user_id}


async def revoke_refresh_token(token: str) -> bool:
    """Explicitly revoke a refresh token (e.g., on logout)."""
    token_hash = _hash_token(token)

    async with async_session() as session:
        result = await session.execute(
            select(RefreshToken).where(RefreshToken.token_hash == token_hash)
        )
        entry = result.scalar_one_or_none()
        if entry:
            entry.revoked = True
            await session.commit()
            return True
    return False


async def revoke_all_user_tokens(user_id: str) -> int:
    """Revoke all refresh tokens for a user (security measure)."""
    async with async_session() as session:
        result = await session.execute(
            update(RefreshToken)
            .where(RefreshToken.user_id == user_id, RefreshToken.revoked == False)
            .values(revoked=True)
        )
        await session.commit()
        return result.rowcount
