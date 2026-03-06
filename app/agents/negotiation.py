"""
Negotiation Agent — deterministic vendor scoring and selection.

Phase 4: for marketplace flows (purchase intent), the agent uses the
negotiation engine to score offers from the marketplace offer engine.
Falls back to the legacy tool-based scoring for non-marketplace flows.

Scoring formula (marketplace):
  score = (0.5 × norm_price) + (0.3 × norm_rating) + (0.2 × norm_delivery)

All logic is deterministic — no LLM randomness.
"""

import asyncio
import concurrent.futures
import logging
from typing import Any, Dict, List

from app.marketplace.negotiation_engine import select_best_offer
from app.services.tools import vendor_api

log = logging.getLogger(__name__)

# Legacy scoring weights (kept for backward compat with non-marketplace flows)
_PRICE_W = 0.4
_RATING_W = 0.35
_DELIVERY_W = 0.25


def _run_async(coro):
    """Run an async coroutine from a sync LangGraph node."""
    try:
        asyncio.get_running_loop()
    except RuntimeError:
        return asyncio.run(coro)
    with concurrent.futures.ThreadPoolExecutor() as pool:
        return pool.submit(asyncio.run, coro).result()


def _score_vendors(vendors: List[Dict[str, Any]]) -> Dict[str, Any]:
    """Legacy scoring — rank vendors using weighted formula. Higher is better."""
    if not vendors:
        return {"vendor": None, "score": 0.0, "breakdown": {}}

    max_price = max(v["price_per_unit"] for v in vendors) or 1
    max_delivery = max(v["delivery_days"] for v in vendors) or 1

    best: Dict[str, Any] = {}
    best_score = -1.0

    for v in vendors:
        norm_price = 1 - (v["price_per_unit"] / max_price)
        norm_delivery = 1 - (v["delivery_days"] / max_delivery)
        rating_norm = v["rating"] / 5.0

        score = (_PRICE_W * norm_price) + (_RATING_W * rating_norm) + (_DELIVERY_W * norm_delivery)

        if score > best_score:
            best_score = score
            best = {
                "vendor": v["name"],
                "score": round(score, 4),
                "breakdown": {
                    "price_per_unit": v["price_per_unit"],
                    "rating": v["rating"],
                    "delivery_days": v["delivery_days"],
                },
            }

    return best


async def run(user_id: str, tenant_id: str, task_input: str) -> str:
    """Legacy interface kept for backward compatibility."""
    data = await vendor_api(query=task_input, tenant_id=tenant_id)
    result = _score_vendors(data["vendors"])
    return f"[NegotiationAgent] Best vendor: {result['vendor']} (score {result['score']})"


def node(state: Dict[str, Any]) -> Dict[str, Any]:
    """
    LangGraph node — score offers and choose the best.

    Phase 4 marketplace path:
        Uses marketplace_offers from state → negotiation_engine.select_best_offer()

    Legacy path (no marketplace offers):
        Fetches via vendor_api tool → _score_vendors()

    Writes: negotiation_result, tool_outputs, agent_path.
    """
    path = list(state.get("agent_path", []))
    path.append("negotiation")
    tool_outputs = list(state.get("tool_outputs", []))

    marketplace_offers = state.get("marketplace_offers", [])

    # --- Phase 4: Marketplace negotiation path ---
    if marketplace_offers:
        neg_result = select_best_offer(marketplace_offers)
        best = neg_result.get("best_offer")

        # Convert to the negotiation_result format expected by compliance/executor
        if best:
            negotiation_result = {
                "vendor": best["vendor_name"],
                "vendor_id": best["vendor_id"],
                "product": best["product"],
                "score": best["score"],
                "breakdown": {
                    "price_per_unit": best["price"],
                    "rating": best["rating"],
                    "delivery_days": best["delivery_days"],
                },
                "negotiation_trace": neg_result.get("negotiation_trace", []),
            }
        else:
            negotiation_result = {
                "vendor": None,
                "score": 0.0,
                "breakdown": {},
                "negotiation_trace": [],
            }

        tool_outputs.append({
            "tool": "negotiation_engine",
            "status": "ok",
            "offers_scored": len(marketplace_offers),
        })

        return {
            "negotiation_result": negotiation_result,
            "tool_outputs": tool_outputs,
            "agent_path": path,
        }

    # --- Legacy path: fetch vendors via tool ---
    delegation_token = state.get("delegation_token", "")
    agent_id = "agent-negotiation"

    try:
        data = _run_async(
            vendor_api(
                query=state["input"], tenant_id=state["tenant_id"],
                delegation_token=delegation_token, agent_id=agent_id,
                user_id=state.get("user_id", ""),
            )
        )
    except Exception as exc:
        log.error("Vendor API failed: %s", exc)
        data = {"vendors": []}

    tool_outputs.append(data)
    result = _score_vendors(data.get("vendors", []))

    return {
        "negotiation_result": result,
        "tool_outputs": tool_outputs,
        "agent_path": path,
    }
