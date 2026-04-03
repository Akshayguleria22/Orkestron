"""
OAuth2 Authentication — Google & GitHub login flows.

Uses authlib for OAuth2 client management and integrates with
the existing JWT system for session tokens.
"""

import secrets
from datetime import datetime, timedelta, timezone
from typing import Optional, Dict, Any

import httpx
import jwt
from jwt import ExpiredSignatureError, InvalidTokenError
from pydantic import BaseModel
from sqlalchemy import select

from app.config import settings
from app.auth.auth_service import create_user_token
from app.auth.refresh_tokens import create_refresh_token, store_refresh_token
from app.models.db import User, async_session


# ---------------------------------------------------------------------------
# OAuth2 Provider Configuration
# ---------------------------------------------------------------------------

class OAuthProvider:
    """Generic OAuth2 provider config."""
    def __init__(
        self,
        name: str,
        client_id: str,
        client_secret: str,
        authorize_url: str,
        token_url: str,
        userinfo_url: str,
        scopes: list[str],
    ):
        self.name = name
        self.client_id = client_id
        self.client_secret = client_secret
        self.authorize_url = authorize_url
        self.token_url = token_url
        self.userinfo_url = userinfo_url
        self.scopes = scopes


_providers: Dict[str, OAuthProvider] = {}
_STATE_TTL_SECONDS = 600


def _is_configured(value: str) -> bool:
    """Treat empty and placeholder values as not configured."""
    cleaned = (value or "").strip()
    return bool(cleaned) and not cleaned.lower().startswith("placeholder_")


def _create_oauth_state(provider_name: str, redirect_uri: str) -> str:
    """Create a signed, short-lived state token to avoid in-memory state loss issues."""
    now = datetime.now(timezone.utc)
    payload = {
        "provider": provider_name,
        "redirect_uri": redirect_uri,
        "iat": int(now.timestamp()),
        "exp": int((now + timedelta(seconds=_STATE_TTL_SECONDS)).timestamp()),
        "nonce": secrets.token_urlsafe(8),
    }
    return jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algorithm)


def _decode_oauth_state(state: str) -> Dict[str, Any]:
    """Decode and validate OAuth state token."""
    try:
        payload = jwt.decode(
            state,
            settings.jwt_secret,
            algorithms=[settings.jwt_algorithm],
        )
    except ExpiredSignatureError as exc:
        raise OAuthError("OAuth state expired") from exc
    except InvalidTokenError as exc:
        raise OAuthError("Invalid OAuth state") from exc

    if not isinstance(payload, dict):
        raise OAuthError("Invalid OAuth state payload")
    return payload


def _init_providers():
    """Initialize OAuth providers from settings (lazy — called on first use)."""
    global _providers
    if _providers:
        return

    if _is_configured(settings.google_client_id) and _is_configured(settings.google_client_secret):
        _providers["google"] = OAuthProvider(
            name="google",
            client_id=settings.google_client_id,
            client_secret=settings.google_client_secret,
            authorize_url="https://accounts.google.com/o/oauth2/v2/auth",
            token_url="https://oauth2.googleapis.com/token",
            userinfo_url="https://www.googleapis.com/oauth2/v2/userinfo",
            scopes=["openid", "email", "profile"],
        )

    if _is_configured(settings.github_client_id) and _is_configured(settings.github_client_secret):
        _providers["github"] = OAuthProvider(
            name="github",
            client_id=settings.github_client_id,
            client_secret=settings.github_client_secret,
            authorize_url="https://github.com/login/oauth/authorize",
            token_url="https://github.com/login/oauth/access_token",
            userinfo_url="https://api.github.com/user",
            scopes=["read:user", "user:email"],
        )


# State tokens — in production use Redis; here we use an in-memory dict
# with expiry cleanup.
_oauth_states: Dict[str, Dict[str, Any]] = {}


class OAuthError(Exception):
    pass


# ---------------------------------------------------------------------------
# Step 1: Generate authorization URL
# ---------------------------------------------------------------------------

def get_authorize_url(provider_name: str, redirect_uri: str) -> str:
    """
    Build the OAuth2 authorization URL the frontend should redirect to.
    Returns the full URL with state parameter.
    """
    _init_providers()
    provider = _providers.get(provider_name)
    if not provider:
        raise OAuthError(
            f"Unknown or unconfigured OAuth provider: {provider_name}. "
            "Set provider client ID and client secret in backend/.env or project .env"
        )

    state = _create_oauth_state(provider_name, redirect_uri)

    params = {
        "client_id": provider.client_id,
        "redirect_uri": redirect_uri,
        "scope": " ".join(provider.scopes),
        "response_type": "code",
        "state": state,
    }

    if provider_name == "google":
        params["access_type"] = "offline"
        params["prompt"] = "consent"

    from urllib.parse import urlencode
    return f"{provider.authorize_url}?{urlencode(params)}"


# ---------------------------------------------------------------------------
# Step 2: Exchange code for tokens + user info
# ---------------------------------------------------------------------------

async def handle_oauth_callback(
    provider_name: str,
    code: str,
    state: str,
) -> Dict[str, Any]:
    """
    Exchange the authorization code for user tokens.
    Returns dict with access_token, refresh_token, user info.
    """
    _init_providers()
    provider = _providers.get(provider_name)
    if not provider:
        raise OAuthError(
            f"Unknown or unconfigured OAuth provider: {provider_name}. "
            "Set provider client ID and client secret in backend/.env or project .env"
        )

    redirect_uri = ""

    # Backward compatibility for any old in-memory state still in flight.
    state_data = _oauth_states.pop(state, None)
    if state_data and state_data.get("provider") == provider_name:
        age = (datetime.now(timezone.utc) - state_data["created_at"]).total_seconds()
        if age > _STATE_TTL_SECONDS:
            raise OAuthError("OAuth state expired")
        redirect_uri = state_data.get("redirect_uri", "")
    else:
        payload = _decode_oauth_state(state)
        if payload.get("provider") != provider_name:
            raise OAuthError("OAuth state provider mismatch")
        redirect_uri = str(payload.get("redirect_uri", "")).strip()

    if not redirect_uri or not redirect_uri.startswith(("http://", "https://")):
        raise OAuthError("Invalid OAuth redirect URI")

    async with httpx.AsyncClient() as client:
        # Exchange code for provider access token
        token_data = {
            "client_id": provider.client_id,
            "client_secret": provider.client_secret,
            "code": code,
            "redirect_uri": redirect_uri,
            "grant_type": "authorization_code",
        }

        headers = {"Accept": "application/json"}
        resp = await client.post(provider.token_url, data=token_data, headers=headers)
        if resp.status_code != 200:
            raise OAuthError(f"Token exchange failed: {resp.text}")

        token_json = resp.json()
        provider_access_token = token_json.get("access_token")
        if not provider_access_token:
            raise OAuthError("No access token in provider response")

        # Fetch user info
        auth_header = {"Authorization": f"Bearer {provider_access_token}"}
        user_resp = await client.get(provider.userinfo_url, headers=auth_header)
        if user_resp.status_code != 200:
            raise OAuthError(f"Failed to fetch user info: {user_resp.text}")

        user_info = user_resp.json()

    # Normalize user data
    if provider_name == "google":
        user_id = f"google_{user_info['id']}"
        email = user_info.get("email", "")
        name = user_info.get("name", "")
        avatar = user_info.get("picture", "")
    elif provider_name == "github":
        user_id = f"github_{user_info['id']}"
        email = user_info.get("email", "")
        name = user_info.get("login", "")
        avatar = user_info.get("avatar_url", "")
        # GitHub may not return email in profile — fetch separately
        if not email:
            async with httpx.AsyncClient() as client:
                email_resp = await client.get(
                    "https://api.github.com/user/emails",
                    headers={"Authorization": f"Bearer {provider_access_token}"},
                )
                if email_resp.status_code == 200:
                    emails = email_resp.json()
                    primary = next((e for e in emails if e.get("primary")), None)
                    if primary:
                        email = primary["email"]
    else:
        user_id = f"{provider_name}_{user_info.get('id', 'unknown')}"
        email = user_info.get("email", "")
        name = user_info.get("name", "")
        avatar = ""

    # Upsert user in database
    async with async_session() as session:
        result = await session.execute(
            select(User).where(User.user_id == user_id)
        )
        existing = result.scalar_one_or_none()
        if existing:
            existing.last_login = datetime.now(timezone.utc)
            if email:
                existing.email = email
            if name:
                existing.name = name
            if avatar:
                existing.avatar_url = avatar
        else:
            session.add(User(
                user_id=user_id,
                email=email or None,
                name=name or user_id,
                avatar_url=avatar or None,
                provider=provider_name,
                role="user",
                is_active=True,
                last_login=datetime.now(timezone.utc),
            ))
        await session.commit()

    # Create JWT access token
    access_token = create_user_token(
        user_id=user_id,
        tenant_id="default",
        roles=["user"],
        permissions=["submit_task", "view_workflows", "view_billing"],
    )

    # Create refresh token
    refresh_token = create_refresh_token(user_id=user_id)
    await store_refresh_token(user_id=user_id, token=refresh_token)

    return {
        "access_token": access_token,
        "refresh_token": refresh_token,
        "token_type": "bearer",
        "user": {
            "id": user_id,
            "email": email,
            "name": name,
            "avatar": avatar,
            "provider": provider_name,
        },
    }


# ---------------------------------------------------------------------------
# Cleanup stale states (call periodically)
# ---------------------------------------------------------------------------

def cleanup_stale_states():
    """Remove legacy in-memory OAuth states older than 10 minutes."""
    cutoff = datetime.now(timezone.utc) - timedelta(minutes=10)
    stale = [k for k, v in _oauth_states.items() if v["created_at"] < cutoff]
    for k in stale:
        _oauth_states.pop(k, None)
