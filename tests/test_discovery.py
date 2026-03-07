"""
Tests for agent capability discovery.
"""

from app.agents.agent_discovery import (
    _INTENT_CAPABILITY_MAP,
    _CAPABILITY_INTENT_MAP,
)


def test_intent_capability_map_has_all_intents():
    """All standard intents have a capability mapping."""
    expected_intents = {"purchase", "negotiation", "information", "compliance", "execution"}
    assert expected_intents == set(_INTENT_CAPABILITY_MAP.keys())


def test_capability_intent_map_inverse():
    """Capability → intent map covers all capabilities."""
    for capability in _INTENT_CAPABILITY_MAP.values():
        assert capability in _CAPABILITY_INTENT_MAP


def test_intent_maps_to_known_capabilities():
    """All mapped capabilities are recognisable names."""
    valid_capabilities = {
        "product_search",
        "price_negotiation",
        "compliance_check",
        "transaction_execution",
        "vendor_search",
    }
    for capability in _INTENT_CAPABILITY_MAP.values():
        assert capability in valid_capabilities
