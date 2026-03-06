"""
Offer Engine — generates offers from all vendors that match a product query.

Given a natural-language product query, the engine:
  1. Normalizes the query into a product key (e.g. "16GB RAM" → "ram_16gb_ddr4")
  2. Scans every vendor's inventory for matching products
  3. Returns a list of concrete offers (vendor, product, price, delivery, rating)

All logic is deterministic — no LLM calls.
"""

import logging
import re
from typing import Any, Dict, List

from app.marketplace.vendor_registry import list_vendors

log = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Product key normalization — maps common query fragments to inventory keys
# ---------------------------------------------------------------------------
_PRODUCT_PATTERNS: List[tuple[str, str]] = [
    # (regex pattern, inventory key prefix)
    (r"16\s*gb.*ddr5.*ram|ram.*16\s*gb.*ddr5", "ram_16gb_ddr5"),
    (r"16\s*gb.*ram|ram.*16\s*gb|16\s*gb.*ddr4.*ram|ram.*16\s*gb.*ddr4", "ram_16gb_ddr4"),
    (r"1\s*tb.*ssd|ssd.*1\s*tb", "ssd_1tb"),
    (r"512\s*gb.*ssd|ssd.*512\s*gb", "ssd_512gb"),
]


def _normalize_product(query: str) -> List[str]:
    """
    Extract inventory keys from a natural-language query.
    Returns all matching product keys, most specific first.
    """
    lowered = query.lower()
    matches: List[str] = []
    for pattern, key in _PRODUCT_PATTERNS:
        if re.search(pattern, lowered):
            matches.append(key)
    # Deduplicate while preserving order
    seen: set[str] = set()
    unique: List[str] = []
    for m in matches:
        if m not in seen:
            seen.add(m)
            unique.append(m)
    return unique


def _extract_budget(query: str) -> float:
    """
    Pull a budget number from the query (e.g. "under 5000" → 5000.0).
    Returns 0.0 if no budget constraint is found.
    """
    # Match patterns like "under ₹5000", "below 5000", "< 5000", "within 5000"
    m = re.search(r"(?:under|below|within|<|<=|max|upto|up\s*to)\s*[₹$]?\s*([\d,]+)", query.lower())
    if m:
        return float(m.group(1).replace(",", ""))
    return 0.0


async def generate_offers(product_query: str) -> Dict[str, Any]:
    """
    Scan all vendors and produce a list of offers matching the query.

    Returns:
        {
            "product_keys": [...],
            "budget": float,
            "offers": [
                {
                    "vendor_id": str,
                    "vendor_name": str,
                    "product": str,
                    "price": float,
                    "delivery_days": int,
                    "rating": float,
                },
                ...
            ]
        }
    """
    product_keys = _normalize_product(product_query)
    budget = _extract_budget(product_query)
    vendors = await list_vendors()

    offers: List[Dict[str, Any]] = []

    for vendor in vendors:
        inventory: Dict[str, float] = vendor.get("inventory", {})
        for key in product_keys:
            if key in inventory:
                price = inventory[key]
                # If a budget is specified, only include offers within budget
                if budget > 0 and price > budget:
                    continue
                offers.append({
                    "vendor_id": vendor["vendor_id"],
                    "vendor_name": vendor["vendor_name"],
                    "product": key,
                    "price": price,
                    "delivery_days": vendor["delivery_speed"],
                    "rating": vendor["rating"],
                })

    log.info(
        "Generated %d offers for query='%s' (keys=%s, budget=%.0f)",
        len(offers), product_query[:80], product_keys, budget,
    )
    return {
        "product_keys": product_keys,
        "budget": budget,
        "offers": offers,
    }
