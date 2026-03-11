"""
Executor Agent — runs tool calls with security validation, triggers audit
logging, and produces the final result.

Phase 4: for marketplace purchases, the executor simulates the purchase
and generates a transaction record with transaction_id, status, vendor_id,
and price. It also computes savings (budget - price).

Before any tool execution:
  1. Validate delegation token
  2. Validate agent capabilities via the permission engine
  3. Pass security context to tools for per-call audit logging
"""

import asyncio
import concurrent.futures
import logging
import uuid
from typing import Any, Dict

from app.audit.logger import log_action
from app.memory.vector_store import store_vector
from app.security.permission_engine import AuthorizationError, validate_execution
from app.services.tools import inventory_api, payment_api

log = logging.getLogger(__name__)

_EXECUTOR_AGENT_ID = "agent-executor"


def _run_async(coro):
    """Run an async coroutine from within a sync LangGraph node."""
    try:
        asyncio.get_running_loop()
    except RuntimeError:
        return asyncio.run(coro)
    with concurrent.futures.ThreadPoolExecutor() as pool:
        return pool.submit(asyncio.run, coro).result()


async def run(user_id: str, tenant_id: str, task_input: str) -> str:
    """Legacy interface."""
    return f"[ExecutorAgent] Executed action for tenant '{tenant_id}'"


def node(state: Dict[str, Any]) -> Dict[str, Any]:
    """
    LangGraph node — validate authorization, execute tools, audit, produce result.

    Two execution paths:

    Transactional (purchase / negotiation intent with marketplace offers):
        - Reads negotiation_result vendor/price
        - Simulates payment via mock payment_api
        - Reserves inventory via mock inventory_api
        - Generates transaction record
        - Computes savings = marketplace_budget - price

    Non-transactional (information / compliance / execution):
        - Produces a summary from retrieved context
        - No payment or inventory tools invoked
        - No transaction record generated
    """
    path = list(state.get("agent_path", []))
    path.append("executor")
    tool_outputs = list(state.get("tool_outputs", []))

    intent = state.get("intent", "information")
    tenant_id = state["tenant_id"]
    user_id = state["user_id"]
    delegation_token = state.get("delegation_token", "")
    delegation_token_id = state.get("delegation_token_id", "")
    agent_id = _EXECUTOR_AGENT_ID
    marketplace_budget = state.get("marketplace_budget", 0.0)

    neg = state.get("negotiation_result") or {}
    is_transactional = intent in ("purchase", "negotiation") and neg.get("vendor")

    if is_transactional:
        # --- Transactional flow: payment + inventory + transaction record ---
        vendor = neg.get("vendor", "unknown")
        vendor_id = neg.get("vendor_id", "")
        product = neg.get("product", "")
        price = neg.get("breakdown", {}).get("price_per_unit", 0)

        # Pre-execution authorization check
        if delegation_token:
            try:
                _run_async(validate_execution(
                    delegation_token=delegation_token,
                    agent_id=agent_id,
                    required_capability="execute_transaction",
                    required_scope="purchase_item",
                    tenant_id=tenant_id,
                ))
            except AuthorizationError as exc:
                log.warning("Executor authorization failed: %s", exc)
                try:
                    deny_hash = _run_async(log_action(
                        user_id=user_id,
                        agent_name=agent_id,
                        action_summary=f"Execution denied: {exc}",
                        agent_id=agent_id,
                        delegation_token_id=delegation_token_id,
                        execution_status="denied",
                    ))
                except Exception:
                    deny_hash = "audit-error"

                return {
                    "final_result": f"Execution denied: {exc}",
                    "tool_outputs": tool_outputs,
                    "audit_hash": deny_hash,
                    "agent_path": path,
                    "execution_error": str(exc),
                    "authorization_error": str(exc),
                }

        # Payment tool
        try:
            pay_result = _run_async(payment_api(
                vendor=vendor, amount=price, tenant_id=tenant_id,
                delegation_token=delegation_token, agent_id=agent_id,
                user_id=user_id,
            ))
            tool_outputs.append(pay_result)
        except AuthorizationError as exc:
            log.warning("Payment tool authorization failed: %s", exc)
            pay_result = {"tool": "payment_api", "status": "denied", "detail": str(exc)}
            tool_outputs.append(pay_result)
        except Exception as exc:
            log.error("Payment tool failed: %s", exc)
            pay_result = {"tool": "payment_api", "status": "error", "detail": str(exc)}
            tool_outputs.append(pay_result)

        # Inventory reservation tool
        try:
            inv_result = _run_async(inventory_api(
                item=product or state["input"], quantity=1, tenant_id=tenant_id,
                delegation_token=delegation_token, agent_id=agent_id,
                user_id=user_id,
            ))
            tool_outputs.append(inv_result)
        except AuthorizationError as exc:
            log.warning("Inventory tool authorization failed: %s", exc)
            inv_result = {"tool": "inventory_api", "status": "denied", "detail": str(exc)}
            tool_outputs.append(inv_result)
        except Exception as exc:
            log.error("Inventory tool failed: %s", exc)
            inv_result = {"tool": "inventory_api", "status": "error", "detail": str(exc)}
            tool_outputs.append(inv_result)

        # Transaction record
        transaction_id = f"txn_{uuid.uuid4().hex[:8]}"
        transaction = {
            "transaction_id": transaction_id,
            "status": pay_result.get("status", "error"),
            "vendor_id": vendor_id or vendor,
            "vendor_name": vendor,
            "product": product,
            "price": price,
        }

        savings = max(marketplace_budget - price, 0.0) if marketplace_budget > 0 else 0.0

        summary = (
            f"Purchased {product} from {vendor} for ₹{price:.0f}. "
            f"Transaction: {transaction_id}. "
            f"Savings: ₹{savings:.0f}."
        )

    else:
        # --- Non-transactional flow: summarize retrieved context ---
        transaction = None
        savings = 0.0

        context = state.get("retrieved_context", [])
        if context:
            snippets = "; ".join(
                c.get("text", "")[:120] for c in context[:3]
            )
            summary = f"[Information] Retrieved context for '{state['input'][:80]}': {snippets}"
        else:
            summary = f"[Information] Processed request for tenant '{tenant_id}': {state['input'][:200]}"

    # -- Store in vector memory --
    try:
        store_vector(text=summary, tenant_id=tenant_id)
    except Exception as exc:
        log.error("Vector store failed: %s", exc)

    # -- Audit log --
    try:
        audit_hash = _run_async(log_action(
            user_id=user_id,
            agent_name="executor",
            action_summary=summary[:500],
            agent_id=agent_id,
            delegation_token_id=delegation_token_id,
            execution_status="success",
        ))
    except Exception as exc:
        log.error("Audit log failed: %s", exc)
        audit_hash = "audit-error"

    return {
        "final_result": summary,
        "tool_outputs": tool_outputs,
        "audit_hash": audit_hash,
        "agent_path": path,
        "execution_error": None,
        "authorization_error": None,
        "transaction": transaction,
        "savings": savings,
    }
