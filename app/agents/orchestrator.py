"""
LangGraph Orchestrator — stateful, cyclic multi-agent workflow engine.

Phase 4 graph topology:
    supervisor → retrieval → route_after_retrieval
                                ├─ (purchase/negotiation) → negotiation → compliance → route_after_compliance
                                │                                                          ├─ passed  → executor → outcome_tracker → billing → END
                                │                                                          └─ failed  → negotiation (loop, max 3)
                                ├─ (compliance)            → compliance_standalone → executor → outcome_tracker → billing → END
                                └─ (information/execution) → executor              → outcome_tracker → billing → END

    retrieval_error? → supervisor (retry, max 3)

Cycle guard: `iteration_count` is incremented on every compliance→negotiation
loop. After MAX_CYCLES the graph forces execution to avoid infinite loops.

Phase 4 additions:
  - outcome_tracker_node: records transaction outcome + savings after executor
Phase 5 additions:
  - billing_node: calculates fee based on pricing model and creates ledger entry
Phase 6 additions:
  - supervisor now writes discovered_agent to state via Agent Discovery Engine
  - discovered_agent metadata is propagated through the graph for audit
"""

import asyncio
import concurrent.futures
import logging
from typing import Any, Dict

from langgraph.graph import END, StateGraph

from app.agents.state import GraphState
from app.agents import supervisor, retrieval, negotiation, compliance, executor
from app.outcomes.outcome_tracker import record_outcome
from app.billing.billing_engine import process_outcome as process_billing

log = logging.getLogger(__name__)

MAX_CYCLES = 3  # max compliance→negotiation loops before forced execution


def _run_async(coro):
    """Run an async coroutine from a sync LangGraph node."""
    try:
        asyncio.get_running_loop()
    except RuntimeError:
        return asyncio.run(coro)
    with concurrent.futures.ThreadPoolExecutor() as pool:
        return pool.submit(asyncio.run, coro).result()


# ---------------------------------------------------------------------------
# Edge routers (pure functions — no side effects)
# ---------------------------------------------------------------------------

def _route_after_supervisor(state: Dict[str, Any]) -> str:
    """After supervisor classifies intent, always go to retrieval first."""
    return "retrieval_node"


def _route_after_retrieval(state: Dict[str, Any]) -> str:
    """
    After retrieval:
    - If retrieval errored and we haven't retried too much → back to supervisor
    - Otherwise route based on intent
    """
    if state.get("retrieval_error") and state.get("iteration_count", 0) < MAX_CYCLES:
        return "supervisor_node"  # retry

    intent = state.get("intent", "information")
    if intent in ("purchase", "negotiation"):
        return "negotiation_node"
    if intent == "compliance":
        return "compliance_standalone_node"
    # information / execution / fallback
    return "executor_node"


def _route_after_compliance(state: Dict[str, Any]) -> str:
    """
    After compliance check:
    - passed → executor
    - failed + cycles left → negotiation (re-negotiate)
    - failed + no cycles left → executor (force)
    """
    if state.get("compliance_status") == "passed":
        return "executor_node"

    if state.get("iteration_count", 0) < MAX_CYCLES:
        return "negotiation_node"  # loop back

    log.warning("Max compliance cycles reached — forcing execution")
    return "executor_node"


# ---------------------------------------------------------------------------
# Thin wrapper nodes that increment iteration_count on loops
# ---------------------------------------------------------------------------

def _compliance_node_with_counter(state: Dict[str, Any]) -> Dict[str, Any]:
    """Run compliance check and bump iteration_count."""
    result = compliance.node(state)
    result["iteration_count"] = state.get("iteration_count", 0) + 1
    return result


def _compliance_standalone_node(state: Dict[str, Any]) -> Dict[str, Any]:
    """Compliance as the primary task (not part of purchase loop)."""
    return compliance.node(state)


# ---------------------------------------------------------------------------
# Phase 4: Outcome tracker node
# ---------------------------------------------------------------------------

def _outcome_tracker_node(state: Dict[str, Any]) -> Dict[str, Any]:
    """
    Record transaction outcome in the outcomes table.
    Records for all completed workflows — transactional and non-transactional.
    """
    path = list(state.get("agent_path", []))
    path.append("outcome_tracker")

    user_id = state.get("user_id", "")
    savings = state.get("savings", 0.0)
    intent = state.get("intent", "information")
    final_result = state.get("final_result", "")

    if not final_result:
        # Nothing to track (no result produced)
        return {"agent_path": path}

    try:
        outcome = _run_async(record_outcome(
            user_id=user_id,
            agent_id="agent-executor",
            task_type=intent or "information",
            result=final_result[:500],
            value_generated=savings,
        ))
    except Exception as exc:
        log.error("Outcome tracking failed: %s", exc)
        outcome = {"outcome_id": "error", "value_generated": 0.0}

    return {
        "outcome": outcome,
        "agent_path": path,
    }


# ---------------------------------------------------------------------------
# Phase 5: Billing node
# ---------------------------------------------------------------------------

def _billing_node(state: Dict[str, Any]) -> Dict[str, Any]:
    """
    Calculate the outcome-based fee and persist a billing ledger entry.
    Only bills if an outcome was successfully recorded.
    """
    path = list(state.get("agent_path", []))
    path.append("billing")

    outcome = state.get("outcome")
    if not outcome or outcome.get("outcome_id") == "error":
        return {"agent_path": path}

    transaction = state.get("transaction") or {}
    transaction_value = transaction.get("price", 0.0)

    try:
        billing_entry = _run_async(process_billing(
            user_id=state.get("user_id", ""),
            outcome_id=outcome["outcome_id"],
            agent_id=outcome.get("agent_id", "agent-executor"),
            task_type=state.get("intent", "information"),
            transaction_value=transaction_value,
            savings=state.get("savings", 0.0),
            transaction_id=transaction.get("transaction_id"),
            proof_hash=state.get("audit_hash"),
        ))
    except Exception as exc:
        log.error("Billing failed: %s", exc)
        billing_entry = None

    return {
        "billing_entry": billing_entry,
        "agent_path": path,
    }


# ---------------------------------------------------------------------------
# Graph construction
# ---------------------------------------------------------------------------

def build_graph() -> StateGraph:
    """Construct and compile the orchestration graph."""
    graph = StateGraph(GraphState)

    # -- Add nodes --
    graph.add_node("supervisor_node", supervisor.node)
    graph.add_node("retrieval_node", retrieval.node)
    graph.add_node("negotiation_node", negotiation.node)
    graph.add_node("compliance_node", _compliance_node_with_counter)
    graph.add_node("compliance_standalone_node", _compliance_standalone_node)
    graph.add_node("executor_node", executor.node)
    graph.add_node("outcome_tracker_node", _outcome_tracker_node)
    graph.add_node("billing_node", _billing_node)

    # -- Entry point --
    graph.set_entry_point("supervisor_node")

    # -- Edges --
    graph.add_conditional_edges("supervisor_node", _route_after_supervisor)
    graph.add_conditional_edges("retrieval_node", _route_after_retrieval)
    graph.add_edge("negotiation_node", "compliance_node")
    graph.add_conditional_edges("compliance_node", _route_after_compliance)
    graph.add_edge("compliance_standalone_node", "executor_node")
    graph.add_edge("executor_node", "outcome_tracker_node")
    graph.add_edge("outcome_tracker_node", "billing_node")
    graph.add_edge("billing_node", END)

    return graph


# Module-level compiled graph — import and call `.invoke(state)`
workflow = build_graph().compile()


def run_workflow(
    user_id: str,
    tenant_id: str,
    user_input: str,
    delegation_token: str = "",
    delegation_token_id: str = "",
) -> Dict[str, Any]:
    """
    Public entry point for the orchestration engine.
    Accepts an optional delegation token for secure execution.
    Returns the final GraphState after all nodes have executed.
    """
    initial_state: GraphState = {
        "user_id": user_id,
        "tenant_id": tenant_id,
        "input": user_input,
        "delegation_token": delegation_token,
        "delegation_token_id": delegation_token_id,
        "agent_id": "",
        "intent": "",
        "retrieved_context": [],
        "retrieval_error": None,
        "marketplace_offers": [],
        "marketplace_budget": 0.0,
        "negotiation_result": None,
        "compliance_status": "",
        "compliance_violations": [],
        "final_result": None,
        "tool_outputs": [],
        "execution_error": None,
        "transaction": None,
        "outcome": None,
        "savings": 0.0,
        "billing_entry": None,
        "discovered_agent": None,
        "audit_hash": None,
        "agent_path": [],
        "iteration_count": 0,
        "authorization_error": None,
    }

    result = workflow.invoke(initial_state)
    return dict(result)
