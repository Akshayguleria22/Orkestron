"""
Configuration module — loads all environment variables via pydantic-settings.
Single source of truth for connection strings and API keys.
"""

from pathlib import Path

from pydantic_settings import BaseSettings

# Resolve .env: check backend/.env first, then project root .env
_BACKEND_DIR = Path(__file__).resolve().parent.parent
_ENV_FILE = _BACKEND_DIR / ".env"
if not _ENV_FILE.exists():
    _ENV_FILE = _BACKEND_DIR.parent / ".env"


class Settings(BaseSettings):
    # --- Groq (LLM provider) ---
    groq_api_key: str = ""

    # --- PostgreSQL ---
    postgres_user: str = "orkestron"
    postgres_password: str = "orkestron_secret"
    postgres_host: str = "localhost"
    postgres_port: int = 5432
    postgres_db: str = "orkestron"

    @property
    def database_url(self) -> str:
        return (
            f"postgresql+asyncpg://{self.postgres_user}:{self.postgres_password}"
            f"@{self.postgres_host}:{self.postgres_port}/{self.postgres_db}"
        )

    @property
    def database_url_sync(self) -> str:
        return (
            f"postgresql+psycopg2://{self.postgres_user}:{self.postgres_password}"
            f"@{self.postgres_host}:{self.postgres_port}/{self.postgres_db}"
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

    # --- WebSocket ---
    ws_heartbeat_interval: int = 30

    model_config = {"env_file": str(_ENV_FILE), "env_file_encoding": "utf-8"}


settings = Settings()
