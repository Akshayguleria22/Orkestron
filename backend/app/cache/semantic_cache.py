"""
Semantic Cache — meaning-based deduplication using Redis.

Instead of exact-string matching, incoming queries are embedded and compared
via cosine similarity against cached embeddings. If similarity exceeds the
configured threshold (default 0.9), the cached response is returned.

Storage layout in Redis (per entry):
  cache:embedding:<key>  → JSON-serialised embedding vector
  cache:response:<key>   → the cached response string
  cache:keys             → Redis SET of all cache keys
"""

import json
import uuid
from typing import Optional, TYPE_CHECKING, Any

import numpy as np
import redis

if TYPE_CHECKING:
    from sentence_transformers import SentenceTransformer

from app.config import settings

_redis: redis.Redis | None = None
_embedder: Any = None

CACHE_KEYS_SET = "cache:keys"


def _get_redis() -> redis.Redis:
    global _redis
    if _redis is None:
        _redis = redis.from_url(settings.redis_url, decode_responses=True)
    return _redis


def _get_embedder():
    global _embedder
    if _embedder is None:
        from sentence_transformers import SentenceTransformer
        _embedder = SentenceTransformer(settings.embedding_model)
    return _embedder


def _cosine_similarity(a: np.ndarray, b: np.ndarray) -> float:
    denom = np.linalg.norm(a) * np.linalg.norm(b)
    if denom == 0:
        return 0.0
    return float(np.dot(a, b) / denom)


def check_cache(query: str) -> Optional[str]:
    """
    Return cached response if a semantically similar query was seen before.
    Similarity threshold is controlled by settings.cache_similarity_threshold.
    """
    r = _get_redis()
    embedder = _get_embedder()
    query_vec = embedder.encode(query)

    cached_keys = r.smembers(CACHE_KEYS_SET)
    best_score = 0.0
    best_key: Optional[str] = None

    for key in cached_keys:
        raw = r.get(f"cache:embedding:{key}")
        if raw is None:
            continue
        cached_vec = np.array(json.loads(raw), dtype=np.float32)
        score = _cosine_similarity(query_vec, cached_vec)
        if score > best_score:
            best_score = score
            best_key = key

    if best_score >= settings.cache_similarity_threshold and best_key is not None:
        return r.get(f"cache:response:{best_key}")

    return None


def store_cache(query: str, response: str) -> None:
    """Embed the query and store both embedding + response in Redis."""
    r = _get_redis()
    embedder = _get_embedder()
    vec = embedder.encode(query).tolist()

    key = str(uuid.uuid4())
    r.set(f"cache:embedding:{key}", json.dumps(vec))
    r.set(f"cache:response:{key}", response)
    r.sadd(CACHE_KEYS_SET, key)
