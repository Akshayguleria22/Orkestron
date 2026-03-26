"""
JWT Authentication Service — issues and verifies user access tokens.

Tokens carry user_id, tenant_id, roles, and permissions so every
downstream component can make authorization decisions without a
database round-trip.

Phase 9: adds user signup/login with email + password (bcrypt hashing).
"""

import uuid
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional

import bcrypt
import jwt
from sqlalchemy import select

from app.config import settings
from app.models.db import User, async_session


class AuthenticationError(Exception):
    """Raised when a JWT is missing, expired, or tampered with."""


def _hash_password(password: str) -> str:
    """Hash a password with bcrypt and return a UTF-8 string."""
    password_bytes = password.encode("utf-8")
    salt = bcrypt.gensalt()
    return bcrypt.hashpw(password_bytes, salt).decode("utf-8")


def _verify_password(password: str, password_hash: str) -> bool:
    """Verify a plaintext password against a bcrypt hash."""
    return bcrypt.checkpw(password.encode("utf-8"), password_hash.encode("utf-8"))


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


# ---------------------------------------------------------------------------
# Phase 9: Email + Password Signup / Login
# ---------------------------------------------------------------------------

async def signup_user(
    email: str,
    password: str,
    name: str = "",
) -> Dict[str, Any]:
    """
    Create a new local user account with bcrypt-hashed password.
    Returns user info dict. Raises AuthenticationError if email exists.
    """
    async with async_session() as session:
        existing = await session.execute(
            select(User).where(User.email == email)
        )
        if existing.scalar_one_or_none():
            raise AuthenticationError("An account with this email already exists")

    user_id = f"user-{uuid.uuid4().hex[:12]}"
    password_hash = _hash_password(password)

    user = User(
        user_id=user_id,
        email=email,
        name=name or email.split("@")[0],
        provider="local",
        password_hash=password_hash,
        role="user",
        is_active=True,
        last_login=datetime.now(timezone.utc),
    )

    async with async_session() as session:
        session.add(user)
        await session.commit()

    return {
        "user_id": user_id,
        "email": email,
        "name": user.name,
        "provider": "local",
    }


async def login_user(email: str, password: str) -> Dict[str, Any]:
    """
    Authenticate a local user by email + password.
    Returns user info dict with JWT tokens.
    Raises AuthenticationError on invalid credentials.
    """
    async with async_session() as session:
        result = await session.execute(
            select(User).where(User.email == email, User.provider == "local")
        )
        user = result.scalar_one_or_none()

    if not user:
        raise AuthenticationError("Invalid email or password")

    if not user.password_hash or not _verify_password(password, user.password_hash):
        raise AuthenticationError("Invalid email or password")

    if not user.is_active:
        raise AuthenticationError("Account is deactivated")

    # Update last_login
    async with async_session() as session:
        user_row = await session.get(User, user.id)
        if user_row:
            user_row.last_login = datetime.now(timezone.utc)
            await session.commit()

    access_token = create_user_token(
        user_id=user.user_id,
        tenant_id="default",
        roles=[user.role],
        permissions=["submit_task", "view_workflows", "view_billing"],
    )

    return {
        "access_token": access_token,
        "user": {
            "id": user.user_id,
            "email": user.email,
            "name": user.name or user.email.split("@")[0],
            "avatar": user.avatar_url or "",
            "provider": "local",
        },
    }
