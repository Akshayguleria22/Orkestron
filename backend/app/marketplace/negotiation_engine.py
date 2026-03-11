"""
Negotiation Engine — deterministic weighted scoring for offer selection.

Scoring formula:
    score = (price_weight × normalized_price)
          + (rating_weight × normalized_rating)
          + (delivery_weight × normalized_delivery)

Lower price and fewer delivery days yield higher scores (inverted).
Higher rating yields a higher score (direct).

All logic is deterministic — no LLM randomness.
"""

import logging
from typing import Any, Dict, List, Optional

log = logging.getLogger(__name__)

# Scoring weights — tunable without code changes
PRICE_WEIGHT = 0.5
RATING_WEIGHT = 0.3
DELIVERY_WEIGHT = 0.2


def score_offer(
    offer: Dict[str, Any],
    max_price: float,
    max_delivery: int,
) -> float:
    """
    Compute a deterministic score for a single offer.
    Requires global max_price and max_delivery for normalization.
    Returns score in [0.0, 1.0].
    """
    # Invert: lower price → higher score
    norm_price = 1.0 - (offer["price"] / max_price) if max_price > 0 else 0.0
    # Direct: higher rating → higher score
    norm_rating = offer["rating"] / 5.0
    # Invert: fewer days → higher score
    norm_delivery = 1.0 - (offer["delivery_days"] / max_delivery) if max_delivery > 0 else 0.0

    return (
        PRICE_WEIGHT * norm_price
        + RATING_WEIGHT * norm_rating
        + DELIVERY_WEIGHT * norm_delivery
    )


def select_best_offer(
    offers: List[Dict[str, Any]],
) -> Dict[str, Any]:
    """
    Score all offers and select the best one.

    Returns:
        {
            "best_offer": { vendor_id, vendor_name, product, price, delivery_days, rating, score },
            "negotiation_trace": [
                { vendor_id, product, price, score },
                ...
            ],
            "all_scores": [ ... ]
        }

    If no offers are provided, returns best_offer=None.
    """
    if not offers:
        return {
            "best_offer": None,
            "negotiation_trace": [],
            "all_scores": [],
        }

    max_price = max(o["price"] for o in offers)
    max_delivery = max(o["delivery_days"] for o in offers)

    scored: List[Dict[str, Any]] = []
    for offer in offers:
        s = score_offer(offer, max_price, max_delivery)
        scored.append({**offer, "score": round(s, 4)})

    # Sort descending by score (deterministic — stable sort on equal scores)
    scored.sort(key=lambda x: x["score"], reverse=True)

    best = scored[0]
    negotiation_trace = [
        {
            "vendor_id": s["vendor_id"],
            "vendor_name": s["vendor_name"],
            "product": s["product"],
            "price": s["price"],
            "score": s["score"],
        }
        for s in scored
    ]

    log.info(
        "Best offer: vendor=%s product=%s price=%.0f score=%.4f",
        best["vendor_name"], best["product"], best["price"], best["score"],
    )

    return {
        "best_offer": best,
        "negotiation_trace": negotiation_trace,
        "all_scores": scored,
    }
