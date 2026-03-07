"""
Tests for the auth service (JWT).
"""

from app.auth.auth_service import create_user_token, verify_user_token, AuthenticationError
import pytest


def test_create_and_verify_token():
    """Create a JWT and verify it returns correct claims."""
    token = create_user_token(
        user_id="test-user",
        tenant_id="test-tenant",
        roles=["admin"],
        permissions=["submit_task"],
    )
    assert isinstance(token, str)
    assert len(token) > 0

    claims = verify_user_token(token)
    assert claims["sub"] == "test-user"
    assert claims["tenant_id"] == "test-tenant"
    assert "admin" in claims["roles"]


def test_invalid_token_raises():
    """Invalid token raises AuthenticationError."""
    with pytest.raises(AuthenticationError):
        verify_user_token("invalid.token.here")


def test_empty_token_raises():
    """Empty token raises AuthenticationError."""
    with pytest.raises(AuthenticationError):
        verify_user_token("")
