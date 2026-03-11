"""
Retrieval Agent — queries multi-tenant vector memory and discovers vendors.

Phase 4: for purchase/negotiation intents, the agent also queries the
marketplace offer engine to discover matching vendor offers.

Graph node: reads `input` and `tenant_id` from state, writes
`retrieved_context`, `marketplace_offers`, and `marketplace_budget`.
"""

import asyncio
import concurrent.futures
import logging
from typing import Dict, Any

from app.marketplace.offer_engine import generate_offers
from app.memory.vector_store import search_vector

log = logging.getLogger(__name__)


def _run_async(coro):
    """Run an async coroutine from a sync LangGraph node."""
    try:
        asyncio.get_running_loop()
    except RuntimeError:
        return asyncio.run(coro)
    with concurrent.futures.ThreadPoolExecutor() as pool:
        return pool.submit(asyncio.run, coro).result()


async def run(user_id: str, tenant_id: str, task_input: str) -> str:
    """Legacy interface kept for backward compatibility."""
    results = search_vector(query=task_input, tenant_id=tenant_id, top_k=5)
    if results:
        return f"[RetrievalAgent] Found {len(results)} results for tenant '{tenant_id}'"
    return f"[RetrievalAgent] No prior context for tenant '{tenant_id}'"


def node(state: Dict[str, Any]) -> Dict[str, Any]:
    """
    LangGraph node — retrieve context from Qdrant + discover vendor offers.
    Writes: retrieved_context, retrieval_error, marketplace_offers,
            marketplace_budget, agent_path.
    """
    path = list(state.get("agent_path", []))
    path.append("retrieval")

    # 1. Vector memory retrieval (always)
    try:
        results = search_vector(
            query=state["input"],
            tenant_id=state["tenant_id"],
            top_k=5,
        )
        retrieval_error = None
    except Exception as exc:
        log.error("Retrieval failed: %s", exc)
        results = []
        retrieval_error = str(exc)

    # 2. Marketplace vendor discovery (for purchase/negotiation intents)
    intent = state.get("intent", "")
    offers: list = []
    budget: float = 0.0

    if intent in ("purchase", "negotiation"):
        try:
            offer_data = _run_async(generate_offers(state["input"]))
            offers = offer_data.get("offers", [])
            budget = offer_data.get("budget", 0.0)
            log.info("Vendor discovery: %d offers, budget=%.0f", len(offers), budget)
        except Exception as exc:
            log.error("Vendor discovery failed: %s", exc)

    return {
        "retrieved_context": results,
        "retrieval_error": retrieval_error,
        "marketplace_offers": offers,
        "marketplace_budget": budget,
        "agent_path": path,
    }
