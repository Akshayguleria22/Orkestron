"""
Agent Discovery Engine — dynamically finds agents that support
a given capability at runtime.

Phase 6: Instead of hardcoded routing tables, the supervisor and
orchestrator query this module to discover which agent can handle
a capability. Discovery checks:
  1. The capability registry (DB-backed, supports third-party agents)
  2. Loaded plugins (in-memory, for dynamically loaded agents)

The discovery engine returns the best-matching agent, preferring
agents with higher reputation scores when multiple agents support
the same capability.
"""

import asyncio
import concurrent.futures
import logging
from typing import Any, Dict, List, Optional

from app.agents.capability_registry import find_capabilities_by_name
from app.agents.plugin_loader import get_plugin
from app.identity.agent_registry import get_agent

log = logging.getLogger(__name__)


def _run_async(coro):
    """Run an async coroutine from a sync context."""
    try:
        asyncio.get_running_loop()
    except RuntimeError:
        return asyncio.run(coro)
    with concurrent.futures.ThreadPoolExecutor() as pool:
        return pool.submit(asyncio.run, coro).result()


# ---------------------------------------------------------------------------
# Capability → intent mapping for router integration
# ---------------------------------------------------------------------------
_CAPABILITY_INTENT_MAP: Dict[str, str] = {
    "product_search": "information",
    "vendor_search": "information",
    "price_negotiation": "negotiation",
    "compliance_check": "compliance",
    "transaction_execution": "execution",
}

# Intent → required capability for dynamic supervisor routing
_INTENT_CAPABILITY_MAP: Dict[str, str] = {
    "purchase": "price_negotiation",
    "negotiation": "price_negotiation",
    "information": "product_search",
    "compliance": "compliance_check",
    "execution": "transaction_execution",
}


async def find_agent_for_capability(
    capability_name: str,
) -> Optional[Dict[str, Any]]:
    """
    Find the best agent that supports a given capability.

    Checks:
      1. Capability registry (DB) — returns agents ordered by reputation
      2. Plugin registry (in-memory) — checks loaded plugins

    Returns dict with agent_id, agent_name, capability, endpoint, source.
    Returns None if no agent is found.
    """
    # 1. Query capability registry
    capabilities = await find_capabilities_by_name(capability_name)

    if capabilities:
        # Fetch reputation scores for ranking
        ranked: List[Dict[str, Any]] = []
        for cap in capabilities:
            agent = await get_agent(cap["agent_id"])
            reputation = agent["reputation_score"] if agent else 0.0
            ranked.append({
                "agent_id": cap["agent_id"],
                "agent_name": agent["name"] if agent else cap["agent_id"],
                "capability": cap["capability_name"],
                "capability_id": cap["capability_id"],
                "endpoint": cap.get("endpoint"),
                "version": cap["version"],
                "reputation": reputation,
                "source": "registry",
            })

        # Sort by reputation descending — highest reputation wins
        ranked.sort(key=lambda x: x["reputation"], reverse=True)
        best = ranked[0]
        log.info(
            "Discovered agent '%s' for capability '%s' (reputation=%.2f, source=%s)",
            best["agent_id"], capability_name, best["reputation"], best["source"],
        )
        return best

    # 2. Check loaded plugins
    from app.agents.plugin_loader import list_plugins
    for plugin in list_plugins():
        if capability_name in plugin.get("capabilities", []):
            log.info(
                "Discovered plugin '%s' for capability '%s'",
                plugin["agent_name"], capability_name,
            )
            return {
                "agent_id": plugin["agent_name"],
                "agent_name": plugin["agent_name"],
                "capability": capability_name,
                "capability_id": None,
                "endpoint": plugin.get("endpoint"),
                "version": plugin.get("version", "1.0.0"),
                "reputation": 0.5,  # default for plugins
                "source": "plugin",
            }

    log.warning("No agent found for capability '%s'", capability_name)
    return None


async def discover_agents_for_intent(
    intent: str,
) -> Optional[Dict[str, Any]]:
    """
    Map an intent to a capability and discover the best agent.
    Convenience wrapper used by the supervisor node.
    """
    capability = _INTENT_CAPABILITY_MAP.get(intent)
    if not capability:
        return None
    return await find_agent_for_capability(capability)


def find_agent_for_capability_sync(capability_name: str) -> Optional[Dict[str, Any]]:
    """Synchronous wrapper for use in LangGraph nodes."""
    return _run_async(find_agent_for_capability(capability_name))


def discover_agents_for_intent_sync(intent: str) -> Optional[Dict[str, Any]]:
    """Synchronous wrapper for use in LangGraph nodes."""
    return _run_async(discover_agents_for_intent(intent))
