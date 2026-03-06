"""
Multi-Tenant Vector Memory backed by Qdrant.

Every vector is stored with a `tenant_id` payload field.
Searches are always filtered to the requesting tenant — hard tenant isolation.
"""

import uuid
from typing import List, Dict, Any

from qdrant_client import QdrantClient
from qdrant_client.models import (
    Distance,
    FieldCondition,
    Filter,
    MatchValue,
    PointStruct,
    VectorParams,
)
from sentence_transformers import SentenceTransformer

from app.config import settings

COLLECTION_NAME = "orkestron_memory"

# Lazy singletons — initialised on first call
_client: QdrantClient | None = None
_embedder: SentenceTransformer | None = None


def _get_client() -> QdrantClient:
    global _client
    if _client is None:
        _client = QdrantClient(host=settings.qdrant_host, port=settings.qdrant_port)
    return _client


def _get_embedder() -> SentenceTransformer:
    global _embedder
    if _embedder is None:
        _embedder = SentenceTransformer(settings.embedding_model)
    return _embedder


def _ensure_collection() -> None:
    """Create the Qdrant collection if it doesn't already exist."""
    client = _get_client()
    collections = [c.name for c in client.get_collections().collections]
    if COLLECTION_NAME not in collections:
        dim = _get_embedder().get_sentence_embedding_dimension()
        client.create_collection(
            collection_name=COLLECTION_NAME,
            vectors_config=VectorParams(size=dim, distance=Distance.COSINE),
        )


def store_vector(text: str, tenant_id: str) -> str:
    """Embed `text` and upsert into Qdrant with tenant isolation. Returns point id."""
    _ensure_collection()
    embedder = _get_embedder()
    vector = embedder.encode(text).tolist()
    point_id = str(uuid.uuid4())

    _get_client().upsert(
        collection_name=COLLECTION_NAME,
        points=[
            PointStruct(
                id=point_id,
                vector=vector,
                payload={"tenant_id": tenant_id, "text": text},
            )
        ],
    )
    return point_id


def search_vector(query: str, tenant_id: str, top_k: int = 5) -> List[Dict[str, Any]]:
    """
    Semantic search scoped to a single tenant.
    Returns list of {text, score} dicts.
    """
    _ensure_collection()
    embedder = _get_embedder()
    query_vector = embedder.encode(query).tolist()

    results = _get_client().search(
        collection_name=COLLECTION_NAME,
        query_vector=query_vector,
        query_filter=Filter(
            must=[FieldCondition(key="tenant_id", match=MatchValue(value=tenant_id))]
        ),
        limit=top_k,
    )

    return [{"text": hit.payload["text"], "score": hit.score} for hit in results]
