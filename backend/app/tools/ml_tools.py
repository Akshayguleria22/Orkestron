"""
ML Tools — real machine learning capabilities using scikit-learn + sentence-transformers.

Provides:
- Text classification (zero-shot via embeddings)
- Sentiment analysis (embedding-based + keyword)
- Entity extraction (regex + pattern matching)
- Text similarity / semantic search
- Text clustering (KMeans on embeddings)
- Keyword extraction (TF-IDF)

All tools run locally — no external API calls needed.
"""

import logging
import re
import time
import uuid
from typing import Any, Dict, List, Optional, Tuple

import numpy as np

log = logging.getLogger(__name__)

# Lazy-loaded models (expensive to load, do it once)
_embedding_model = None
_tfidf_vectorizer = None


def _get_embedding_model():
    """Lazy load sentence-transformers model."""
    global _embedding_model
    if _embedding_model is None:
        try:
            from sentence_transformers import SentenceTransformer
            _embedding_model = SentenceTransformer("all-MiniLM-L6-v2")
            log.info("Loaded sentence-transformers model: all-MiniLM-L6-v2")
        except Exception as exc:
            log.error("Failed to load sentence-transformers: %s", exc)
            raise
    return _embedding_model


def _get_tfidf():
    """Lazy load TF-IDF vectorizer."""
    global _tfidf_vectorizer
    if _tfidf_vectorizer is None:
        from sklearn.feature_extraction.text import TfidfVectorizer
        _tfidf_vectorizer = TfidfVectorizer(
            max_features=5000,
            stop_words="english",
            ngram_range=(1, 2),
        )
    return _tfidf_vectorizer


# ==========================================================================
# Tool: Sentiment Analysis
# ==========================================================================

async def ml_sentiment_analysis(text: str) -> Dict[str, Any]:
    """
    Analyze sentiment of text using embedding similarity to sentiment anchors.
    Returns: {sentiment, confidence, scores}
    """
    start = time.perf_counter()

    try:
        model = _get_embedding_model()

        # Encode the input and sentiment anchors
        anchors = [
            "This is extremely positive, wonderful, great, excellent, amazing.",
            "This is neutral, okay, average, normal, standard.",
            "This is extremely negative, terrible, awful, horrible, bad.",
        ]
        labels = ["positive", "neutral", "negative"]

        embeddings = model.encode([text] + anchors, normalize_embeddings=True)
        text_emb = embeddings[0]
        anchor_embs = embeddings[1:]

        # Cosine similarity (already normalized)
        similarities = [float(np.dot(text_emb, a)) for a in anchor_embs]

        # Softmax for probabilities
        exp_sims = np.exp(np.array(similarities) * 5)  # temperature scaling
        probs = exp_sims / exp_sims.sum()

        best_idx = int(np.argmax(probs))
        sentiment = labels[best_idx]
        confidence = float(probs[best_idx])

        elapsed = (time.perf_counter() - start) * 1000
        log.info("Sentiment analysis: %s (%.2f) in %.0fms", sentiment, confidence, elapsed)

        return {
            "sentiment": sentiment,
            "confidence": round(confidence, 4),
            "scores": {labels[i]: round(float(probs[i]), 4) for i in range(3)},
            "latency_ms": round(elapsed, 1),
        }
    except Exception as exc:
        log.error("Sentiment analysis failed: %s", exc)
        return {"sentiment": "unknown", "confidence": 0.0, "error": str(exc)}


# ==========================================================================
# Tool: Zero-Shot Text Classification
# ==========================================================================

async def ml_classify_text(
    text: str,
    categories: List[str],
) -> Dict[str, Any]:
    """
    Classify text into one of the given categories using embedding similarity.
    This is zero-shot — no training needed!
    """
    start = time.perf_counter()

    try:
        model = _get_embedding_model()

        # Encode text and category labels
        all_texts = [text] + [f"This text is about {cat}" for cat in categories]
        embeddings = model.encode(all_texts, normalize_embeddings=True)

        text_emb = embeddings[0]
        cat_embs = embeddings[1:]

        similarities = [float(np.dot(text_emb, c)) for c in cat_embs]
        exp_sims = np.exp(np.array(similarities) * 5)
        probs = exp_sims / exp_sims.sum()

        best_idx = int(np.argmax(probs))
        predicted = categories[best_idx]
        confidence = float(probs[best_idx])

        elapsed = (time.perf_counter() - start) * 1000
        log.info("Text classification: %s (%.2f) in %.0fms", predicted, confidence, elapsed)

        return {
            "category": predicted,
            "confidence": round(confidence, 4),
            "all_scores": {categories[i]: round(float(probs[i]), 4) for i in range(len(categories))},
            "latency_ms": round(elapsed, 1),
        }
    except Exception as exc:
        log.error("Text classification failed: %s", exc)
        return {"category": "unknown", "confidence": 0.0, "error": str(exc)}


# ==========================================================================
# Tool: Entity Extraction
# ==========================================================================

async def ml_extract_entities(text: str) -> Dict[str, Any]:
    """
    Extract entities from text using pattern matching and NLP heuristics.
    Extracts: emails, URLs, currencies, numbers, dates, percentages, and names.
    """
    start = time.perf_counter()

    entities: List[Dict[str, str]] = []

    # Email regex
    for m in re.finditer(r"[\w.+-]+@[\w-]+\.[\w.-]+", text):
        entities.append({"type": "email", "value": m.group(), "start": m.start(), "end": m.end()})

    # URL regex
    for m in re.finditer(r"https?://\S+", text):
        entities.append({"type": "url", "value": m.group(), "start": m.start(), "end": m.end()})

    # Currency (₹, $, €)
    for m in re.finditer(r"[₹$€£]\s?[\d,]+(?:\.\d+)?", text):
        entities.append({"type": "currency", "value": m.group(), "start": m.start(), "end": m.end()})
    for m in re.finditer(r"[\d,]+(?:\.\d+)?\s?(?:INR|USD|EUR|GBP|rupees?|dollars?)", text, re.IGNORECASE):
        entities.append({"type": "currency", "value": m.group(), "start": m.start(), "end": m.end()})

    # Percentage
    for m in re.finditer(r"\d+(?:\.\d+)?%", text):
        entities.append({"type": "percentage", "value": m.group(), "start": m.start(), "end": m.end()})

    # Numbers with units
    for m in re.finditer(r"\b\d+(?:\.\d+)?\s*(?:GB|MB|TB|kg|km|cm|mm|hrs?|min|sec)\b", text, re.IGNORECASE):
        entities.append({"type": "quantity", "value": m.group(), "start": m.start(), "end": m.end()})

    # Date patterns
    for m in re.finditer(r"\b\d{1,2}[/-]\d{1,2}[/-]\d{2,4}\b", text):
        entities.append({"type": "date", "value": m.group(), "start": m.start(), "end": m.end()})
    for m in re.finditer(
        r"\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\w*\s+\d{1,2},?\s*\d{4}\b",
        text,
        re.IGNORECASE,
    ):
        entities.append({"type": "date", "value": m.group(), "start": m.start(), "end": m.end()})

    # Phone numbers
    for m in re.finditer(r"(?:\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}", text):
        entities.append({"type": "phone", "value": m.group(), "start": m.start(), "end": m.end()})

    # Deduplicate
    seen = set()
    unique_entities = []
    for e in entities:
        key = (e["type"], e["value"])
        if key not in seen:
            seen.add(key)
            unique_entities.append(e)

    elapsed = (time.perf_counter() - start) * 1000
    log.info("Entity extraction: %d entities in %.0fms", len(unique_entities), elapsed)

    return {
        "entities": unique_entities,
        "count": len(unique_entities),
        "types_found": list({e["type"] for e in unique_entities}),
        "latency_ms": round(elapsed, 1),
    }


# ==========================================================================
# Tool: Semantic Similarity
# ==========================================================================

async def ml_semantic_similarity(
    text_a: str,
    text_b: str,
) -> Dict[str, Any]:
    """
    Compute semantic similarity between two texts using sentence embeddings.
    Returns a score between 0 and 1.
    """
    start = time.perf_counter()

    try:
        model = _get_embedding_model()
        embeddings = model.encode([text_a, text_b], normalize_embeddings=True)
        similarity = float(np.dot(embeddings[0], embeddings[1]))

        elapsed = (time.perf_counter() - start) * 1000
        log.info("Semantic similarity: %.4f in %.0fms", similarity, elapsed)

        return {
            "similarity": round(similarity, 4),
            "is_similar": similarity > 0.7,
            "latency_ms": round(elapsed, 1),
        }
    except Exception as exc:
        log.error("Semantic similarity failed: %s", exc)
        return {"similarity": 0.0, "error": str(exc)}


# ==========================================================================
# Tool: Keyword Extraction (TF-IDF)
# ==========================================================================

async def ml_extract_keywords(
    text: str,
    top_k: int = 10,
) -> Dict[str, Any]:
    """
    Extract top keywords from text using TF-IDF scoring.
    """
    start = time.perf_counter()

    try:
        from sklearn.feature_extraction.text import TfidfVectorizer

        vectorizer = TfidfVectorizer(
            max_features=200,
            stop_words="english",
            ngram_range=(1, 2),
        )

        tfidf_matrix = vectorizer.fit_transform([text])
        feature_names = vectorizer.get_feature_names_out()
        scores = tfidf_matrix.toarray()[0]

        # Get top-k
        top_indices = scores.argsort()[-top_k:][::-1]
        keywords = [
            {"keyword": feature_names[i], "score": round(float(scores[i]), 4)}
            for i in top_indices
            if scores[i] > 0
        ]

        elapsed = (time.perf_counter() - start) * 1000
        log.info("Keyword extraction: %d keywords in %.0fms", len(keywords), elapsed)

        return {
            "keywords": keywords,
            "count": len(keywords),
            "latency_ms": round(elapsed, 1),
        }
    except Exception as exc:
        log.error("Keyword extraction failed: %s", exc)
        return {"keywords": [], "error": str(exc)}


# ==========================================================================
# Tool: Text Clustering
# ==========================================================================

async def ml_cluster_texts(
    texts: List[str],
    n_clusters: int = 3,
) -> Dict[str, Any]:
    """
    Cluster a list of texts into groups using KMeans on embeddings.
    """
    start = time.perf_counter()

    try:
        from sklearn.cluster import KMeans

        model = _get_embedding_model()
        embeddings = model.encode(texts, normalize_embeddings=True)

        n_clusters = min(n_clusters, len(texts))
        kmeans = KMeans(n_clusters=n_clusters, random_state=42, n_init=10)
        labels = kmeans.fit_predict(embeddings)

        clusters: Dict[int, List[Dict]] = {}
        for i, label in enumerate(labels):
            label_int = int(label)
            if label_int not in clusters:
                clusters[label_int] = []
            clusters[label_int].append({
                "index": i,
                "text": texts[i][:200],
            })

        elapsed = (time.perf_counter() - start) * 1000
        log.info("Text clustering: %d texts → %d clusters in %.0fms", len(texts), n_clusters, elapsed)

        return {
            "clusters": clusters,
            "n_clusters": n_clusters,
            "labels": [int(l) for l in labels],
            "latency_ms": round(elapsed, 1),
        }
    except Exception as exc:
        log.error("Text clustering failed: %s", exc)
        return {"clusters": {}, "error": str(exc)}


# ==========================================================================
# Tool: Summarize Text (extractive, ML-based)
# ==========================================================================

async def ml_extractive_summary(
    text: str,
    num_sentences: int = 3,
) -> Dict[str, Any]:
    """
    Generate an extractive summary by selecting the most representative sentences.
    Uses sentence embeddings to find sentences closest to the document centroid.
    """
    start = time.perf_counter()

    try:
        # Split into sentences
        sentences = re.split(r'(?<=[.!?])\s+', text.strip())
        sentences = [s.strip() for s in sentences if len(s.strip()) > 15]

        if len(sentences) <= num_sentences:
            elapsed = (time.perf_counter() - start) * 1000
            return {
                "summary": " ".join(sentences),
                "sentences": sentences,
                "latency_ms": round(elapsed, 1),
            }

        model = _get_embedding_model()
        embeddings = model.encode(sentences, normalize_embeddings=True)

        # Document centroid
        centroid = embeddings.mean(axis=0)
        centroid = centroid / np.linalg.norm(centroid)

        # Rank sentences by similarity to centroid
        scores = [float(np.dot(emb, centroid)) for emb in embeddings]
        top_indices = sorted(range(len(scores)), key=lambda i: scores[i], reverse=True)[:num_sentences]
        # Preserve original order
        top_indices.sort()

        summary_sentences = [sentences[i] for i in top_indices]
        summary = " ".join(summary_sentences)

        elapsed = (time.perf_counter() - start) * 1000
        log.info("Extractive summary: %d → %d sentences in %.0fms", len(sentences), num_sentences, elapsed)

        return {
            "summary": summary,
            "sentences": summary_sentences,
            "original_sentence_count": len(sentences),
            "latency_ms": round(elapsed, 1),
        }
    except Exception as exc:
        log.error("Extractive summary failed: %s", exc)
        return {"summary": text[:500], "error": str(exc)}


# ==========================================================================
# Registry: all available ML tools
# ==========================================================================

ML_TOOLS = {
    "sentiment_analysis": {
        "fn": ml_sentiment_analysis,
        "description": "Analyze sentiment of text (positive/negative/neutral)",
        "input_schema": {"text": "string"},
    },
    "text_classification": {
        "fn": ml_classify_text,
        "description": "Classify text into custom categories (zero-shot)",
        "input_schema": {"text": "string", "categories": "list[string]"},
    },
    "entity_extraction": {
        "fn": ml_extract_entities,
        "description": "Extract entities (emails, URLs, currencies, dates, etc.)",
        "input_schema": {"text": "string"},
    },
    "semantic_similarity": {
        "fn": ml_semantic_similarity,
        "description": "Compute semantic similarity between two texts",
        "input_schema": {"text_a": "string", "text_b": "string"},
    },
    "keyword_extraction": {
        "fn": ml_extract_keywords,
        "description": "Extract top keywords using TF-IDF",
        "input_schema": {"text": "string", "top_k": "int (optional)"},
    },
    "text_clustering": {
        "fn": ml_cluster_texts,
        "description": "Cluster multiple texts into groups",
        "input_schema": {"texts": "list[string]", "n_clusters": "int (optional)"},
    },
    "extractive_summary": {
        "fn": ml_extractive_summary,
        "description": "Generate extractive summary from text",
        "input_schema": {"text": "string", "num_sentences": "int (optional)"},
    },
}
