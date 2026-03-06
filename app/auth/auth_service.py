"""
JWT Authentication Service — issues and verifies user access tokens.

Tokens carry user_id, tenant_id, roles, and permissions so every
downstream component can make authorization decisions without a
database round-trip.
"""

from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List

import jwt

from app.config import settings


class AuthenticationError(Exception):
    """Raised when a JWT is missing, expired, or tampered with."""


def create_user_token(
    user_id: str,
    tenant_id: str,
    roles: List[str],
    permissions: List[str],
) -> str:
    """
    Mint a signed JWT for a user.
    Returns the encoded token string.
    """
    now = datetime.now(timezone.utc)
    payload: Dict[str, Any] = {
        "sub": user_id,
        "tenant_id": tenant_id,
        "roles": roles,
        "permissions": permissions,
        "iat": now,
        "exp": now + timedelta(minutes=settings.jwt_expiry_minutes),
    }
    return jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algorithm)


def verify_user_token(token: str) -> Dict[str, Any]:
    """
    Decode and validate a user JWT.
    Returns the full payload dict on success.
    Raises AuthenticationError on any failure.
    """
    try:
        payload = jwt.decode(
            token,
            settings.jwt_secret,
            algorithms=[settings.jwt_algorithm],
        )
        return payload
    except jwt.ExpiredSignatureError:
        raise AuthenticationError("Token has expired")
    except jwt.InvalidTokenError as exc:
        raise AuthenticationError(f"Invalid token: {exc}")
