"""
Configuration module — loads all environment variables via pydantic-settings.
Single source of truth for connection strings and API keys.
"""

from pydantic_settings import BaseSettings


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

    # --- Semantic cache ---
    cache_similarity_threshold: float = 0.9

    # --- Embedding model (runs locally via SentenceTransformers) ---
    embedding_model: str = "all-MiniLM-L6-v2"

    # --- JWT / Security ---
    jwt_secret: str = "orkestron-dev-secret-change-in-prod"
    jwt_algorithm: str = "HS256"
    jwt_expiry_minutes: int = 60
    delegation_token_expiry_minutes: int = 15

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8"}


settings = Settings()
