"""Comprehensive Phase 4 verification script."""
import asyncio
import sys


async def main():
    print("=== COMPREHENSIVE PHASE 4 VERIFICATION ===\n")

    # 1. All modules import
    from app.agents import supervisor, retrieval, negotiation, compliance, executor
    from app.agents.orchestrator import workflow, run_workflow, build_graph
    from app.agents.state import GraphState
    from app.marketplace.vendor_registry import seed_vendors, list_vendors, register_vendor
    from app.marketplace.offer_engine import generate_offers
    from app.marketplace.negotiation_engine import select_best_offer
    from app.outcomes.outcome_tracker import record_outcome, get_user_outcomes
    from app.billing.pricing_models import (
        calculate_outcome_fee, calculate_savings_fee,
        calculate_flat_fee, default_model_for_task,
    )
    from app.billing.billing_engine import process_outcome
    from app.billing.invoice_service import generate_invoice
    from app.billing.ledger import record_billing_entry, get_user_ledger
    from app.models.db import AuditLog, Agent, Vendor, Outcome, BillingLedgerEntry, Invoice, Base
    from app.main import app
    print("1. All modules import: OK")

    # 2. Graph structure
    nodes = list(workflow.get_graph().nodes.keys())
    expected = [
        "__start__", "supervisor_node", "retrieval_node",
        "negotiation_node", "compliance_node",
        "compliance_standalone_node", "executor_node",
        "outcome_tracker_node", "billing_node", "__end__",
    ]
    assert set(nodes) == set(expected), f"Nodes mismatch: {nodes}"
    print(f"2. Graph nodes ({len(nodes)}): OK")

    # 3. DB tables
    tables = sorted(Base.metadata.tables.keys())
    assert tables == ["agents", "audit_logs", "billing_ledger", "invoices", "outcomes", "vendors"], f"Tables: {tables}"
    print(f"3. DB tables ({len(tables)}): OK")

    # 4. API routes
    routes = [r.path for r in app.routes if hasattr(r, "path")]
    for expected_route in ["/task", "/vendors", "/outcomes/{user_id}", "/billing/ledger/{user_id}", "/health"]:
        assert expected_route in routes, f"Missing route: {expected_route}"
    print(f"4. API routes ({len(routes)}): OK")

    # 5. Vendor registry (requires DB — test seed data availability)
    from app.marketplace.vendor_registry import _SEED_VENDORS
    assert len(_SEED_VENDORS) == 4, f"Expected 4 seed vendors, got {len(_SEED_VENDORS)}"
    print(f"5. Vendor seed data ({len(_SEED_VENDORS)} vendors): OK")

    # 6. Offer engine (requires DB — test sync helpers)
    from app.marketplace.offer_engine import _normalize_product, _extract_budget
    keys = _normalize_product("buy 16GB RAM for 5000")
    assert "ram_16gb_ddr4" in keys, f"Product normalization failed: {keys}"
    budget = _extract_budget("buy laptop under 5000")
    assert budget == 5000.0, f"Budget extraction failed: {budget}"
    print(f"6. Offer engine (normalization={keys}, budget={budget}): OK")

    # 7. Negotiation scoring (use pre-built offers)
    test_offers = [
        {"vendor_id": "v1", "vendor_name": "A", "product": "ram_16gb_ddr4", "price": 4300, "delivery_days": 2, "rating": 4.6},
        {"vendor_id": "v2", "vendor_name": "B", "product": "ram_16gb_ddr4", "price": 4100, "delivery_days": 3, "rating": 4.3},
        {"vendor_id": "v3", "vendor_name": "C", "product": "ram_16gb_ddr4", "price": 4500, "delivery_days": 4, "rating": 4.8},
    ]
    scored = select_best_offer(test_offers)
    best = scored["best_offer"]
    trace_count = len(scored["negotiation_trace"])
    print(f"7. Negotiation engine (best: {best['vendor_name']} at {best['price']}, score={best['score']}): OK")

    # 8. Pricing models
    assert calculate_outcome_fee(4300) == 86.0
    assert calculate_savings_fee(700) == 140.0
    assert calculate_flat_fee() == 10.0
    assert default_model_for_task("purchase") == "outcome_fee"
    assert default_model_for_task("information") == "flat_fee"
    print("8. Pricing models: OK")

    # 9. Executor - info path
    info_result = executor.node({
        "input": "test query",
        "intent": "information",
        "user_id": "u1",
        "tenant_id": "t1",
        "negotiation_result": None,
        "retrieved_context": [{"text": "answer here", "score": 0.9}],
    })
    assert info_result["transaction"] is None
    assert info_result["savings"] == 0.0
    assert "answer here" in info_result["final_result"]
    print("9. Executor info path: OK")

    # 10. Executor - purchase path
    purch_result = executor.node({
        "input": "buy laptop",
        "intent": "purchase",
        "user_id": "u2",
        "tenant_id": "t1",
        "negotiation_result": {
            "vendor": "TestVendor",
            "vendor_id": "v1",
            "product": "laptop",
            "breakdown": {"price_per_unit": 4300},
        },
        "marketplace_budget": 5000.0,
        "retrieved_context": [],
    })
    assert purch_result["transaction"] is not None
    assert purch_result["transaction"]["vendor_name"] == "TestVendor"
    assert purch_result["savings"] == 700.0
    txn_id = purch_result["transaction"]["transaction_id"]
    print(f"10. Executor purchase path (txn={txn_id}): OK")

    # 11. GraphState fields
    fields = list(GraphState.__annotations__.keys())
    for f in ["billing_entry", "transaction", "outcome", "savings"]:
        assert f in fields, f"Missing field: {f}"
    print(f"11. GraphState ({len(fields)} fields): OK")

    # 12. Version
    assert app.version == "0.5.0"
    print(f"12. App version: {app.version}: OK")

    print("\n=== ALL PHASE 4 VERIFICATIONS PASSED ===")
    return 0


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
