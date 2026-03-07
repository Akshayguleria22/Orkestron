"""
Tests for the GraphState schema.
"""

from app.agents.state import GraphState


def test_graphstate_has_core_fields():
    """GraphState has all required identity and input fields."""
    annotations = GraphState.__annotations__
    assert "user_id" in annotations
    assert "tenant_id" in annotations
    assert "input" in annotations
    assert "intent" in annotations
    assert "agent_id" in annotations


def test_graphstate_has_security_fields():
    """GraphState has delegation token fields."""
    annotations = GraphState.__annotations__
    assert "delegation_token" in annotations
    assert "delegation_token_id" in annotations
    assert "authorization_error" in annotations


def test_graphstate_has_marketplace_fields():
    """GraphState has Phase 4 marketplace fields."""
    annotations = GraphState.__annotations__
    assert "marketplace_offers" in annotations
    assert "marketplace_budget" in annotations
    assert "negotiation_result" in annotations
    assert "transaction" in annotations
    assert "outcome" in annotations
    assert "savings" in annotations


def test_graphstate_has_billing_field():
    """GraphState has Phase 5 billing field."""
    annotations = GraphState.__annotations__
    assert "billing_entry" in annotations


def test_graphstate_has_discovery_field():
    """GraphState has Phase 6 discovered_agent field."""
    annotations = GraphState.__annotations__
    assert "discovered_agent" in annotations


def test_graphstate_has_graph_metadata():
    """GraphState has graph traversal metadata."""
    annotations = GraphState.__annotations__
    assert "agent_path" in annotations
    assert "iteration_count" in annotations
    assert "audit_hash" in annotations


def test_graphstate_total_field_count():
    """GraphState has 26 fields total."""
    annotations = GraphState.__annotations__
    assert len(annotations) == 26, f"Expected 26 fields, got {len(annotations)}: {list(annotations.keys())}"
