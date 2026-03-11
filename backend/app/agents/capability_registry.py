"""
Agent Capability Registry — allows agents to publish capabilities
that the orchestrator can discover and route to at runtime.

Phase 6: Third-party developers register agent capabilities (name,
schema, endpoint, version). The supervisor and discovery engine query
this registry instead of relying on hardcoded routing tables.

Built-in capabilities are seeded on startup to bootstrap the system.
"""

import logging
import uuid
from typing import Any, Dict, List, Optional

from sqlalchemy import select

from app.models.db import AgentCapability, async_session

log = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Built-in capabilities — seeded on startup so the existing agents are
# discoverable through the same registry as third-party plugins.
# ---------------------------------------------------------------------------
_SEED_CAPABILITIES: List[Dict[str, Any]] = [
    {
        "agent_id": "agent-retrieval",
        "developer_id": "orkestron-core",
        "capability_name": "product_search",
        "description": "Search and retrieve product information from the knowledge base",
        "input_schema": {"type": "object", "properties": {"query": {"type": "string"}}},
        "output_schema": {"type": "object", "properties": {"results": {"type": "array"}}},
        "version": "1.0.0",
    },
    {
        "agent_id": "agent-negotiation",
        "developer_id": "orkestron-core",
        "capability_name": "price_negotiation",
        "description": "Negotiate product price across vendors using weighted scoring",
        "input_schema": {"type": "object", "properties": {"offers": {"type": "array"}}},
        "output_schema": {"type": "object", "properties": {"best_offer": {"type": "object"}}},
        "version": "1.0.0",
    },
    {
        "agent_id": "agent-compliance",
        "developer_id": "orkestron-core",
        "capability_name": "compliance_check",
        "description": "Validate transactions against procurement policy rules",
        "input_schema": {"type": "object", "properties": {"negotiation_result": {"type": "object"}}},
        "output_schema": {"type": "object", "properties": {"status": {"type": "string"}}},
        "version": "1.0.0",
    },
    {
        "agent_id": "agent-executor",
        "developer_id": "orkestron-core",
        "capability_name": "transaction_execution",
        "description": "Execute purchase transactions with payment and inventory tools",
        "input_schema": {"type": "object", "properties": {"negotiation_result": {"type": "object"}}},
        "output_schema": {"type": "object", "properties": {"transaction": {"type": "object"}}},
        "version": "1.0.0",
    },
    {
        "agent_id": "agent-retrieval",
        "developer_id": "orkestron-core",
        "capability_name": "vendor_search",
        "description": "Search vendor inventory for matching products",
        "input_schema": {"type": "object", "properties": {"query": {"type": "string"}}},
        "output_schema": {"type": "object", "properties": {"offers": {"type": "array"}}},
        "version": "1.0.0",
    },
]


async def register_capability(
    agent_id: str,
    developer_id: str,
    capability_name: str,
    description: str = "",
    input_schema: Optional[Dict[str, Any]] = None,
    output_schema: Optional[Dict[str, Any]] = None,
    endpoint: Optional[str] = None,
    version: str = "1.0.0",
) -> Dict[str, Any]:
    """
    Register or update a capability for an agent.
    Returns the capability record as a dict.
    """
    capability_id = f"cap-{uuid.uuid4().hex[:12]}"

    async with async_session() as session:
        # Check if this agent already has this capability registered
        result = await session.execute(
            select(AgentCapability).where(
                AgentCapability.agent_id == agent_id,
                AgentCapability.capability_name == capability_name,
            )
        )
        existing = result.scalar_one_or_none()

        if existing:
            existing.description = description
            existing.input_schema = input_schema or {}
            existing.output_schema = output_schema or {}
            existing.endpoint = endpoint
            existing.version = version
            existing.developer_id = developer_id
            await session.commit()
            await session.refresh(existing)
            cap = existing
        else:
            cap = AgentCapability(
                capability_id=capability_id,
                agent_id=agent_id,
                developer_id=developer_id,
                capability_name=capability_name,
                description=description,
                input_schema=input_schema or {},
                output_schema=output_schema or {},
                endpoint=endpoint,
                version=version,
            )
            session.add(cap)
            await session.commit()
            await session.refresh(cap)

    log.info(
        "Registered capability '%s' for agent '%s' (developer=%s)",
        capability_name, agent_id, developer_id,
    )
    return _cap_to_dict(cap)


async def list_capabilities(
    agent_id: Optional[str] = None,
) -> List[Dict[str, Any]]:
    """
    List all registered capabilities.
    Optionally filter by agent_id.
    """
    async with async_session() as session:
        stmt = select(AgentCapability)
        if agent_id:
            stmt = stmt.where(AgentCapability.agent_id == agent_id)
        result = await session.execute(stmt.order_by(AgentCapability.capability_name))
        return [_cap_to_dict(c) for c in result.scalars().all()]


async def get_capability(capability_id: str) -> Optional[Dict[str, Any]]:
    """Fetch a single capability by its capability_id."""
    async with async_session() as session:
        result = await session.execute(
            select(AgentCapability).where(
                AgentCapability.capability_id == capability_id
            )
        )
        cap = result.scalar_one_or_none()
        return _cap_to_dict(cap) if cap else None


async def find_capabilities_by_name(
    capability_name: str,
) -> List[Dict[str, Any]]:
    """
    Find all capabilities matching a name.
    Used by the discovery engine to locate agents for a given capability.
    """
    async with async_session() as session:
        result = await session.execute(
            select(AgentCapability).where(
                AgentCapability.capability_name == capability_name
            )
        )
        return [_cap_to_dict(c) for c in result.scalars().all()]


async def seed_capabilities() -> None:
    """Upsert built-in capabilities on startup."""
    for spec in _SEED_CAPABILITIES:
        await register_capability(**spec)
    log.info("Seeded %d built-in capabilities", len(_SEED_CAPABILITIES))


def _cap_to_dict(cap: AgentCapability) -> Dict[str, Any]:
    return {
        "capability_id": cap.capability_id,
        "agent_id": cap.agent_id,
        "developer_id": cap.developer_id,
        "capability_name": cap.capability_name,
        "description": cap.description,
        "input_schema": cap.input_schema,
        "output_schema": cap.output_schema,
        "endpoint": cap.endpoint,
        "version": cap.version,
        "created_at": cap.created_at.isoformat(),
    }
