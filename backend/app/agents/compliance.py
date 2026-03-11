"""
Compliance Agent — validates negotiation output against policy rules.

Phase 4: extended with marketplace-specific constraints:
  - budget_limit: reject if price exceeds the user's stated budget
  - allowed_vendors: optional vendor allowlist
  - max_delivery_days: reject if delivery exceeds threshold

If compliance fails the graph edge loops back to the negotiation node
(up to MAX_CYCLES times, then forces execution).
"""

import logging
from typing import Any, Dict, List, Optional

log = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Policy rules (can be overridden per-tenant in production)
# ---------------------------------------------------------------------------
_BUDGET_LIMIT: float = 50.0             # legacy per-unit limit (non-marketplace)
_TRANSACTION_LIMIT: float = 100_000     # max total transaction value
_ALLOWED_VENDORS: Optional[List[str]] = None  # None = all allowed
_MAX_DELIVERY_DAYS: int = 7             # maximum acceptable delivery time


def _check(
    negotiation_result: Optional[Dict[str, Any]],
    marketplace_budget: float = 0.0,
) -> tuple[str, List[str]]:
    """
    Return (status, violations) tuple.

    For marketplace flows, marketplace_budget overrides _BUDGET_LIMIT
    so the user's "under ₹5000" constraint is enforced instead of the
    static $50 limit.
    """
    violations: List[str] = []

    if negotiation_result is None:
        return "passed", violations

    breakdown = negotiation_result.get("breakdown", {})
    vendor = negotiation_result.get("vendor", "")
    price = breakdown.get("price_per_unit", 0)
    delivery_days = breakdown.get("delivery_days", 0)

    # Budget check — use marketplace budget if available, else static limit
    effective_budget = marketplace_budget if marketplace_budget > 0 else _BUDGET_LIMIT
    if price > effective_budget:
        violations.append(
            f"price {price} exceeds budget limit {effective_budget}"
        )

    # Transaction value limit
    if price > _TRANSACTION_LIMIT:
        violations.append(
            f"price {price} exceeds max transaction limit {_TRANSACTION_LIMIT}"
        )

    # Vendor allowlist
    if _ALLOWED_VENDORS is not None and vendor and vendor not in _ALLOWED_VENDORS:
        violations.append(f"vendor '{vendor}' not in allowed vendor list")

    # Delivery time
    if delivery_days > _MAX_DELIVERY_DAYS:
        violations.append(
            f"delivery_days {delivery_days} exceeds max {_MAX_DELIVERY_DAYS}"
        )

    status = "failed" if violations else "passed"
    return status, violations


async def run(user_id: str, tenant_id: str, task_input: str) -> str:
    """Legacy interface."""
    return f"[ComplianceAgent] Compliance check passed for tenant '{tenant_id}'"


def node(state: Dict[str, Any]) -> Dict[str, Any]:
    """
    LangGraph node — validate constraints against negotiation_result.
    Reads marketplace_budget from state for Phase 4 budget enforcement.
    Writes: compliance_status, compliance_violations, agent_path.
    """
    path = list(state.get("agent_path", []))
    path.append("compliance")

    marketplace_budget = state.get("marketplace_budget", 0.0)
    status, violations = _check(
        state.get("negotiation_result"),
        marketplace_budget=marketplace_budget,
    )

    if violations:
        log.warning("Compliance violations: %s", violations)

    return {
        "compliance_status": status,
        "compliance_violations": violations,
        "agent_path": path,
    }
