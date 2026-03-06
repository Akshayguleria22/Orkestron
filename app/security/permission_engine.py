"""
Permission Engine — validates agent capabilities, delegation scope,
and tenant isolation before any tool execution.

Three checks run in sequence:
  1. Agent capability — is this agent registered and capable?
  2. Delegation scope — does the OBO token grant the required scope?
  3. Tenant isolation — does the token tenant match the request tenant?

If any check fails, an AuthorizationError is raised and the tool
call is blocked.
"""

import logging
from typing import Any, Dict

from app.auth.token_service import DelegationError, check_scope, verify_delegation_token
from app.identity.agent_registry import verify_agent_capability

log = logging.getLogger(__name__)


class AuthorizationError(Exception):
    """Raised when a permission check fails."""


async def validate_execution(
    delegation_token: str,
    agent_id: str,
    required_capability: str,
    required_scope: str,
    tenant_id: str,
) -> Dict[str, Any]:
    """
    Run all three authorization checks.
    Returns the validated delegation token payload on success.
    Raises AuthorizationError on any failure.
    """
    # 1. Verify delegation token is valid and not expired
    try:
        token_payload = verify_delegation_token(delegation_token)
    except DelegationError as exc:
        raise AuthorizationError(f"Delegation token invalid: {exc}")

    # 2. Tenant isolation — token tenant must match request tenant
    if token_payload.get("tenant_id") != tenant_id:
        raise AuthorizationError(
            f"Tenant mismatch: token tenant '{token_payload.get('tenant_id')}' "
            f"!= request tenant '{tenant_id}'"
        )

    # 3. Agent must be registered and have the required capability
    has_capability = await verify_agent_capability(agent_id, required_capability)
    if not has_capability:
        raise AuthorizationError(
            f"Agent '{agent_id}' lacks capability '{required_capability}'"
        )

    # 4. Delegation scope must include the required action
    if not check_scope(token_payload, required_scope):
        raise AuthorizationError(
            f"Delegation token does not grant scope '{required_scope}'. "
            f"Granted: {token_payload.get('scope', [])}"
        )

    log.info(
        "Authorization passed: user=%s agent=%s scope=%s tenant=%s",
        token_payload.get("sub"),
        agent_id,
        required_scope,
        tenant_id,
    )
    return token_payload
