"""
GraphState — shared state schema for the LangGraph orchestration graph.

Every node reads from and writes to this TypedDict.
LangGraph passes the state between nodes automatically.

Phase 4: adds marketplace fields (offers, best_offer, budget,
         transaction, outcome, savings).
Phase 5: adds billing entry for outcome-based billing.
"""

from typing import Any, Dict, List, Optional
from typing_extensions import TypedDict


class GraphState(TypedDict, total=False):
    # --- Identity ---
    user_id: str
    tenant_id: str

    # --- Security context ---
    delegation_token: str      # OBO token for the current workflow
    delegation_token_id: str   # unique id of the delegation token
    agent_id: str              # active agent identity

    # --- Input ---
    input: str

    # --- Supervisor output ---
    intent: str  # purchase | information | negotiation | compliance | execution

    # --- Retrieval output ---
    retrieved_context: List[dict]  # [{text, score}, ...]
    retrieval_error: Optional[str]

    # --- Phase 4: Marketplace offers ---
    marketplace_offers: List[Dict[str, Any]]  # raw offers from offer engine
    marketplace_budget: float                  # extracted budget constraint

    # --- Negotiation output ---
    negotiation_result: Optional[dict]  # {best_offer, negotiation_trace, ...}

    # --- Compliance output ---
    compliance_status: str  # passed | failed
    compliance_violations: List[str]

    # --- Executor output ---
    final_result: Optional[str]
    tool_outputs: List[dict]  # [{tool, result}, ...]
    execution_error: Optional[str]

    # --- Phase 4: Transaction + outcome ---
    transaction: Optional[Dict[str, Any]]  # {transaction_id, status, vendor_id, price}
    outcome: Optional[Dict[str, Any]]      # {outcome_id, value_generated, ...}
    savings: float                         # budget - purchase_price

    # --- Phase 5: Billing ---
    billing_entry: Optional[Dict[str, Any]]  # {entry_id, fee, pricing_model, ...}

    # --- Audit ---
    audit_hash: Optional[str]

    # --- Graph metadata ---
    agent_path: List[str]  # ordered list of nodes visited
    iteration_count: int  # cycle guard
    authorization_error: Optional[str]  # set if permission check fails
