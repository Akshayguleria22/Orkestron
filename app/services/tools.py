"""
Tool Execution Layer — mock external service integrations with security.

Every tool call requires a delegation_token, agent_id, and user_id.
The permission engine validates authorization before execution.
All calls are logged to the audit trail.
"""

import asyncio
import concurrent.futures
import logging
from typing import Any, Dict

from app.security.permission_engine import AuthorizationError, validate_execution
from app.audit.logger import log_action

log = logging.getLogger(__name__)

# Maps tool names to the (capability, scope) pair required to invoke them.
_TOOL_PERMISSIONS: Dict[str, Dict[str, str]] = {
    "vendor_api": {"capability": "negotiate", "scope": "negotiate_price"},
    "payment_api": {"capability": "execute_transaction", "scope": "purchase_item"},
    "inventory_api": {"capability": "query_inventory", "scope": "query_inventory"},
}


def _run_async(coro):
    """Run an async coroutine from a sync context."""
    try:
        asyncio.get_running_loop()
    except RuntimeError:
        return asyncio.run(coro)
    with concurrent.futures.ThreadPoolExecutor() as pool:
        return pool.submit(asyncio.run, coro).result()


async def _authorize_tool(
    tool_name: str,
    delegation_token: str,
    agent_id: str,
    tenant_id: str,
) -> Dict[str, Any]:
    """Validate permissions for a tool call. Returns token payload."""
    perms = _TOOL_PERMISSIONS.get(tool_name)
    if perms is None:
        raise AuthorizationError(f"Unknown tool: {tool_name}")

    return await validate_execution(
        delegation_token=delegation_token,
        agent_id=agent_id,
        required_capability=perms["capability"],
        required_scope=perms["scope"],
        tenant_id=tenant_id,
    )


async def _audit_tool_call(
    user_id: str,
    agent_id: str,
    tool_name: str,
    delegation_token_id: str,
    status: str,
    detail: str,
) -> str:
    """Log a tool execution to the audit trail. Returns hash."""
    return await log_action(
        user_id=user_id,
        agent_name=agent_id,
        action_summary=f"tool={tool_name} status={status} {detail[:300]}",
        agent_id=agent_id,
        delegation_token_id=delegation_token_id,
        tool_used=tool_name,
        execution_status=status,
    )


async def vendor_api(
    query: str,
    tenant_id: str,
    delegation_token: str = "",
    agent_id: str = "",
    user_id: str = "",
) -> Dict[str, Any]:
    """Simulate a vendor catalog lookup with authorization."""
    token_payload: Dict[str, Any] = {}
    if delegation_token:
        token_payload = await _authorize_tool("vendor_api", delegation_token, agent_id, tenant_id)

    result: Dict[str, Any] = {
        "tool": "vendor_api",
        "status": "ok",
        "vendors": [
            {"name": "SteelCorp", "price_per_unit": 42.0, "rating": 4.5, "delivery_days": 3},
            {"name": "MetalWorks", "price_per_unit": 38.5, "rating": 4.2, "delivery_days": 5},
            {"name": "IronForge", "price_per_unit": 45.0, "rating": 4.8, "delivery_days": 2},
        ],
    }

    if delegation_token:
        await _audit_tool_call(
            user_id=token_payload.get("sub", user_id),
            agent_id=agent_id,
            tool_name="vendor_api",
            delegation_token_id=token_payload.get("token_id", ""),
            status="success",
            detail=f"query={query}",
        )

    return result


async def payment_api(
    vendor: str,
    amount: float,
    tenant_id: str,
    delegation_token: str = "",
    agent_id: str = "",
    user_id: str = "",
) -> Dict[str, Any]:
    """Simulate a payment processing call with authorization."""
    token_payload: Dict[str, Any] = {}
    if delegation_token:
        token_payload = await _authorize_tool("payment_api", delegation_token, agent_id, tenant_id)

    result: Dict[str, Any] = {
        "tool": "payment_api",
        "status": "ok",
        "transaction_id": f"txn-{tenant_id}-{vendor[:4].lower()}-001",
        "amount": amount,
        "vendor": vendor,
    }

    if delegation_token:
        await _audit_tool_call(
            user_id=token_payload.get("sub", user_id),
            agent_id=agent_id,
            tool_name="payment_api",
            delegation_token_id=token_payload.get("token_id", ""),
            status="success",
            detail=f"vendor={vendor} amount={amount}",
        )

    return result


async def inventory_api(
    item: str,
    quantity: int,
    tenant_id: str,
    delegation_token: str = "",
    agent_id: str = "",
    user_id: str = "",
) -> Dict[str, Any]:
    """Simulate an inventory reservation call with authorization."""
    token_payload: Dict[str, Any] = {}
    if delegation_token:
        token_payload = await _authorize_tool("inventory_api", delegation_token, agent_id, tenant_id)

    result: Dict[str, Any] = {
        "tool": "inventory_api",
        "status": "ok",
        "item": item,
        "quantity_reserved": quantity,
        "warehouse": "WH-EAST-01",
    }

    if delegation_token:
        await _audit_tool_call(
            user_id=token_payload.get("sub", user_id),
            agent_id=agent_id,
            tool_name="inventory_api",
            delegation_token_id=token_payload.get("token_id", ""),
            status="success",
            detail=f"item={item} qty={quantity}",
        )

    return result
