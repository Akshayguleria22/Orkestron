"""
Supervisor Agent — intent classifier and graph entry point.

Phase 2: uses Groq LLM for intent classification, with a deterministic
keyword fallback. Acts as the first node in the LangGraph orchestration
graph — it classifies user intent and sets the `intent` field in state
which downstream edges use for routing.

Valid intents: purchase, information, negotiation, compliance, execution
"""

import logging
from typing import Any, Callable, Awaitable, Dict, List, Tuple

from groq import Groq

from app.agents import retrieval, negotiation, compliance, executor
from app.config import settings

log = logging.getLogger(__name__)

# ---- Legacy routing table (kept for backward-compatible `route()`) ----
_ROUTING_TABLE: List[Tuple[List[str], str, Callable[..., Awaitable[str]]]] = [
    (["buy", "purchase", "find", "search", "retrieve"], "retrieval", retrieval.run),
    (["negotiate", "deal", "bargain", "offer"], "negotiation", negotiation.run),
    (["comply", "compliance", "policy", "audit", "regulation"], "compliance", compliance.run),
    (["execute", "run", "deploy", "launch"], "executor", executor.run),
]

# ---- Intent classification ----
_VALID_INTENTS = {"purchase", "information", "negotiation", "compliance", "execution"}

_KEYWORD_INTENT_MAP: List[Tuple[List[str], str]] = [
    (["buy", "purchase", "order", "procure"], "purchase"),
    (["find", "search", "retrieve", "lookup", "info", "what", "how"], "information"),
    (["negotiate", "deal", "bargain", "offer", "counter"], "negotiation"),
    (["comply", "compliance", "policy", "regulation", "check"], "compliance"),
    (["execute", "run", "deploy", "launch", "do"], "execution"),
]

_INTENT_PROMPT = (
    "You are an intent classifier for a procurement orchestration system.\n"
    "Classify the user message into exactly ONE of these intents:\n"
    "  purchase, information, negotiation, compliance, execution\n"
    "Reply with ONLY the intent word, nothing else.\n\n"
    "User message: {input}"
)


def _classify_intent_keywords(text: str) -> str:
    """Deterministic keyword-based intent fallback."""
    lowered = text.lower()
    for keywords, intent in _KEYWORD_INTENT_MAP:
        if any(kw in lowered for kw in keywords):
            return intent
    return "information"  # safe default


def _classify_intent_llm(text: str) -> str:
    """Use Groq LLM for intent classification. Returns validated intent string."""
    if not settings.groq_api_key:
        return _classify_intent_keywords(text)

    try:
        client = Groq(api_key=settings.groq_api_key)
        response = client.chat.completions.create(
            model="llama-3.1-8b-instant",
            messages=[{"role": "user", "content": _INTENT_PROMPT.format(input=text)}],
            temperature=0,
            max_tokens=10,
        )
        intent = response.choices[0].message.content.strip().lower()
        if intent in _VALID_INTENTS:
            return intent
        log.warning("LLM returned invalid intent '%s', falling back to keywords", intent)
    except Exception as exc:
        log.warning("LLM classification failed (%s), falling back to keywords", exc)

    return _classify_intent_keywords(text)


# ---- Legacy interface (Phase 1 backward compat) ----
async def route(user_id: str, tenant_id: str, task_input: str) -> Dict[str, str]:
    """Keyword-based routing kept for callers that don't use the graph."""
    lowered = task_input.lower()
    for keywords, agent_name, handler in _ROUTING_TABLE:
        if any(kw in lowered for kw in keywords):
            response = await handler(user_id, tenant_id, task_input)
            return {"agent": agent_name, "response": response}
    response = await retrieval.run(user_id, tenant_id, task_input)
    return {"agent": "retrieval", "response": response}


# ---- LangGraph node ----
def node(state: Dict[str, Any]) -> Dict[str, Any]:
    """
    Graph entry node — classify intent and initialise workflow metadata.
    Writes: intent, agent_path, iteration_count.
    """
    intent = _classify_intent_llm(state["input"])

    path = list(state.get("agent_path", []))
    path.append("supervisor")

    return {
        "intent": intent,
        "agent_path": path,
        "iteration_count": state.get("iteration_count", 0),
    }
