"""
Agent Identity Registry — manages agent registration, lookup, and
capability verification.

Agents must be registered before participating in orchestration.
Each agent has a set of declared capabilities that the permission
engine checks before allowing tool execution.

Valid capabilities: retrieve_data, negotiate, execute_transaction,
                    compliance_check, query_inventory, negotiate_price
"""

import logging
from typing import Any, Dict, List, Optional

from sqlalchemy import select

from app.models.db import Agent, async_session

log = logging.getLogger(__name__)

# Map agent names used in the graph to their canonical agent_id and capabilities.
# On startup, register_default_agents() upserts these into PostgreSQL.
_DEFAULT_AGENTS: List[Dict[str, Any]] = [
    {
        "agent_id": "agent-supervisor",
        "name": "Supervisor Agent",
        "public_key": "supervisor-pub-key-placeholder",
        "capabilities": ["retrieve_data", "negotiate", "execute_transaction", "compliance_check"],
    },
    {
        "agent_id": "agent-retrieval",
        "name": "Retrieval Agent",
        "public_key": "retrieval-pub-key-placeholder",
        "capabilities": ["retrieve_data", "query_inventory"],
    },
    {
        "agent_id": "agent-negotiation",
        "name": "Negotiation Agent",
        "public_key": "negotiation-pub-key-placeholder",
        "capabilities": ["negotiate", "negotiate_price"],
    },
    {
        "agent_id": "agent-compliance",
        "name": "Compliance Agent",
        "public_key": "compliance-pub-key-placeholder",
        "capabilities": ["compliance_check"],
    },
    {
        "agent_id": "agent-executor",
        "name": "Executor Agent",
        "public_key": "executor-pub-key-placeholder",
        "capabilities": ["execute_transaction", "query_inventory", "negotiate_price"],
    },
]


async def register_agent(
    agent_id: str,
    name: str,
    public_key: str,
    capabilities: List[str],
    reputation_score: float = 1.0,
) -> Dict[str, Any]:
    """
    Register a new agent or update an existing one.
    Returns the agent record as a dict.
    """
    async with async_session() as session:
        result = await session.execute(
            select(Agent).where(Agent.agent_id == agent_id)
        )
        existing = result.scalar_one_or_none()

        if existing:
            existing.name = name
            existing.public_key = public_key
            existing.capabilities = capabilities
            existing.reputation_score = reputation_score
            await session.commit()
            await session.refresh(existing)
            agent = existing
        else:
            agent = Agent(
                agent_id=agent_id,
                name=name,
                public_key=public_key,
                capabilities=capabilities,
                reputation_score=reputation_score,
            )
            session.add(agent)
            await session.commit()
            await session.refresh(agent)

        return {
            "agent_id": agent.agent_id,
            "name": agent.name,
            "capabilities": agent.capabilities,
            "reputation_score": agent.reputation_score,
        }


async def get_agent(agent_id: str) -> Optional[Dict[str, Any]]:
    """Fetch agent by agent_id. Returns None if not found."""
    async with async_session() as session:
        result = await session.execute(
            select(Agent).where(Agent.agent_id == agent_id)
        )
        agent = result.scalar_one_or_none()
        if agent is None:
            return None
        return {
            "agent_id": agent.agent_id,
            "name": agent.name,
            "capabilities": list(agent.capabilities),
            "reputation_score": agent.reputation_score,
        }


async def list_agents() -> List[Dict[str, Any]]:
    """List all registered agents."""
    async with async_session() as session:
        result = await session.execute(select(Agent).order_by(Agent.name.asc()))
        agents = result.scalars().all()

    return [
        {
            "agent_id": agent.agent_id,
            "name": agent.name,
            "capabilities": list(agent.capabilities),
            "reputation_score": agent.reputation_score,
            "status": "active",
            "type": "worker",
            "description": f"Registered agent with {len(agent.capabilities or [])} capabilities",
        }
        for agent in agents
    ]


async def verify_agent_capability(agent_id: str, capability: str) -> bool:
    """Return True if the agent is registered and has the given capability."""
    agent = await get_agent(agent_id)
    if agent is None:
        return False
    return capability in agent["capabilities"]


async def register_default_agents() -> None:
    """Upsert all built-in agents on startup."""
    for spec in _DEFAULT_AGENTS:
        await register_agent(**spec)
    log.info("Default agents registered: %d", len(_DEFAULT_AGENTS))
