"""
Configuration module — loads all environment variables via pydantic-settings.
Single source of truth for connection strings and API keys.
"""

from pathlib import Path
from urllib.parse import urlencode

from pydantic_settings import BaseSettings

# Resolve .env files: load backend/.env first, then project root .env.
# When both exist, root values can override backend defaults.
_BACKEND_DIR = Path(__file__).resolve().parent.parent
_BACKEND_ENV_FILE = _BACKEND_DIR / ".env"
_ROOT_ENV_FILE = _BACKEND_DIR.parent / ".env"

_ENV_FILES: list[str] = []
if _BACKEND_ENV_FILE.exists():
    _ENV_FILES.append(str(_BACKEND_ENV_FILE))
if _ROOT_ENV_FILE.exists():
    _ENV_FILES.append(str(_ROOT_ENV_FILE))

# Keep a sensible default path for local dev when files are missing.
if not _ENV_FILES:
    _ENV_FILES.append(str(_BACKEND_ENV_FILE))


class Settings(BaseSettings):
    # --- Groq (LLM provider) ---
    groq_api_key: str = ""
    groq_model: str = "openai/gpt-oss-120b"

    # --- PostgreSQL ---
    postgres_user: str = "orkestron"
    postgres_password: str = "orkestron_secret"
    postgres_host: str = "localhost"
    postgres_port: int = 5432
    postgres_db: str = "orkestron"
    postgres_sslmode: str = ""
    postgres_channel_binding: str = ""
    database_url_override: str = ""
    database_url_sync_override: str = ""

    def _postgres_query_string_async(self) -> str:
        params = {}
        if self.postgres_sslmode:
            # asyncpg expects `ssl` (not `sslmode`).
            if self.postgres_sslmode.lower() in {"disable", "allow", "prefer", "require", "verify-ca", "verify-full"}:
                params["ssl"] = self.postgres_sslmode.lower()
            else:
                params["ssl"] = self.postgres_sslmode
        if not params:
            return ""
        return f"?{urlencode(params)}"

    def _postgres_query_string_sync(self) -> str:
        params = {}
        if self.postgres_sslmode:
            params["sslmode"] = self.postgres_sslmode
        if self.postgres_channel_binding:
            params["channel_binding"] = self.postgres_channel_binding
        if not params:
            return ""
        return f"?{urlencode(params)}"

    @property
    def database_url(self) -> str:
        if self.database_url_override:
            return self.database_url_override
        return (
            f"postgresql+asyncpg://{self.postgres_user}:{self.postgres_password}"
            f"@{self.postgres_host}:{self.postgres_port}/{self.postgres_db}"
            f"{self._postgres_query_string_async()}"
        )

    @property
    def database_url_sync(self) -> str:
        if self.database_url_sync_override:
            return self.database_url_sync_override
        return (
            f"postgresql+psycopg2://{self.postgres_user}:{self.postgres_password}"
            f"@{self.postgres_host}:{self.postgres_port}/{self.postgres_db}"
            f"{self._postgres_query_string_sync()}"
        )

    # --- Redis ---
    redis_url: str = "redis://localhost:6379/0"

    # --- Qdrant ---
    qdrant_host: str = "localhost"
    qdrant_port: int = 6333
    qdrant_api_key: str = ""
    qdrant_endpoint: str = ""

    # --- Semantic cache ---
    cache_similarity_threshold: float = 0.9

    # --- Embedding model (runs locally via SentenceTransformers) ---
    embedding_model: str = "all-MiniLM-L6-v2"

    # --- JWT / Security ---
    jwt_secret: str = "orkestron-dev-secret-change-in-prod"
    jwt_algorithm: str = "HS256"
    jwt_expiry_minutes: int = 60
    delegation_token_expiry_minutes: int = 15
    refresh_token_expiry_days: int = 30

    # --- OAuth2 Providers ---
    google_client_id: str = ""
    google_client_secret: str = ""
    github_client_id: str = ""
    github_client_secret: str = ""
    oauth_redirect_base: str = "http://localhost:3000"

    # --- Rate Limiting ---
    rate_limit_per_minute: int = 60

    # --- CORS ---
    cors_origins: str = "http://localhost:3000,http://localhost:8000"
    cors_origin_regex: str = ""

    # --- WebSocket ---
    ws_heartbeat_interval: int = 30

    # --- Startup behavior ---
    startup_step_timeout_seconds: int = 25
    startup_strict: bool = False

    # --- Real Tool Layer ---
    serper_api_key: str = ""  # serper.dev for web search
    serpapi_api_key: str = ""  # serpapi.com alternative

    # --- Email (SMTP or SendGrid) ---
    smtp_host: str = ""
    smtp_port: int = 587
    smtp_user: str = ""
    smtp_password: str = ""
    smtp_from_email: str = "noreply@orkestron.ai"
    sendgrid_api_key: str = ""

    model_config = {"env_file": tuple(_ENV_FILES), "env_file_encoding": "utf-8"}


settings = Settings()
