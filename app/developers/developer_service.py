"""
Developer Service — manages third-party developer registration,
API key generation, and authentication.

Phase 6: Developers must register before they can publish agents
and capabilities into the Orkestron marketplace. Each developer
receives a unique API key used to authenticate capability and
plugin management requests.
"""

import hashlib
import logging
import secrets
import uuid
from typing import Any, Dict, Optional

from sqlalchemy import select

from app.models.db import Developer, async_session

log = logging.getLogger(__name__)

_API_KEY_PREFIX = "ork_"
_API_KEY_BYTES = 32  # 256-bit entropy


def generate_api_key() -> str:
    """Generate a cryptographically secure API key with an 'ork_' prefix."""
    return _API_KEY_PREFIX + secrets.token_urlsafe(_API_KEY_BYTES)


def _hash_api_key(api_key: str) -> str:
    """SHA-256 hash of an API key for safe storage comparison."""
    return hashlib.sha256(api_key.encode()).hexdigest()


async def register_developer(
    name: str,
    email: str,
) -> Dict[str, Any]:
    """
    Register a new developer.
    Returns developer record including the plaintext API key (shown once).
    """
    developer_id = f"dev-{uuid.uuid4().hex[:12]}"
    api_key = generate_api_key()

    dev = Developer(
        developer_id=developer_id,
        name=name,
        email=email,
        api_key=_hash_api_key(api_key),
    )

    async with async_session() as session:
        # Ensure email is unique
        existing = await session.execute(
            select(Developer).where(Developer.email == email)
        )
        if existing.scalar_one_or_none():
            raise ValueError(f"Developer with email '{email}' already exists")

        session.add(dev)
        await session.commit()
        await session.refresh(dev)

    log.info("Registered developer '%s' (id=%s)", name, developer_id)

    return {
        "developer_id": dev.developer_id,
        "name": dev.name,
        "email": dev.email,
        "api_key": api_key,  # plaintext — shown only at registration time
        "status": dev.status,
        "created_at": dev.created_at.isoformat(),
    }


async def verify_api_key(api_key: str) -> Optional[Dict[str, Any]]:
    """
    Verify a developer API key.
    Returns the developer record if valid, None otherwise.
    """
    key_hash = _hash_api_key(api_key)

    async with async_session() as session:
        result = await session.execute(
            select(Developer).where(
                Developer.api_key == key_hash,
                Developer.status == "active",
            )
        )
        dev = result.scalar_one_or_none()
        if dev is None:
            return None

        return {
            "developer_id": dev.developer_id,
            "name": dev.name,
            "email": dev.email,
            "status": dev.status,
            "created_at": dev.created_at.isoformat(),
        }


async def get_developer(developer_id: str) -> Optional[Dict[str, Any]]:
    """Fetch developer by developer_id."""
    async with async_session() as session:
        result = await session.execute(
            select(Developer).where(Developer.developer_id == developer_id)
        )
        dev = result.scalar_one_or_none()
        if dev is None:
            return None
        return {
            "developer_id": dev.developer_id,
            "name": dev.name,
            "email": dev.email,
            "status": dev.status,
            "created_at": dev.created_at.isoformat(),
        }


async def seed_core_developer() -> None:
    """Register the built-in Orkestron core developer account on startup."""
    async with async_session() as session:
        result = await session.execute(
            select(Developer).where(Developer.developer_id == "orkestron-core")
        )
        if result.scalar_one_or_none():
            return  # already exists

    core_key = generate_api_key()
    dev = Developer(
        developer_id="orkestron-core",
        name="Orkestron Core",
        email="core@orkestron.internal",
        api_key=_hash_api_key(core_key),
        status="active",
    )

    async with async_session() as session:
        session.add(dev)
        await session.commit()

    log.info("Seeded core developer account (orkestron-core)")
