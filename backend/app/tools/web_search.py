"""
Web Search Tool — real web search via Serper.dev API.

Falls back to a Groq-LLM-synthesized answer if no API key is configured.
"""

import logging
import uuid
import time
from typing import Any, Dict, List, Optional

import httpx

from app.config import settings
from app.models.db import ToolCallLog, async_session

log = logging.getLogger(__name__)

SERPER_URL = "https://google.serper.dev/search"


async def _log_tool_call(
    task_id: str,
    agent_log_id: str,
    tool_name: str,
    input_params: Dict[str, Any],
    output_data: Any,
    status: str,
    latency_ms: float,
    error_message: Optional[str] = None,
) -> str:
    call_id = f"tc-{uuid.uuid4().hex[:12]}"
    entry = ToolCallLog(
        call_id=call_id,
        task_id=task_id,
        agent_log_id=agent_log_id,
        tool_name=tool_name,
        input_params=input_params,
        output_data=output_data if isinstance(output_data, dict) else {"result": str(output_data)[:2000]},
        status=status,
        latency_ms=latency_ms,
        error_message=error_message,
    )
    try:
        async with async_session() as session:
            session.add(entry)
            await session.commit()
    except Exception as exc:
        log.warning("Failed to log tool call: %s", exc)
    return call_id


async def web_search(
    query: str,
    num_results: int = 10,
    task_id: str = "",
    agent_log_id: str = "",
) -> Dict[str, Any]:
    """
    Search the web using Serper.dev API.
    Returns structured search results with titles, links, and snippets.
    """
    start = time.perf_counter()

    if not settings.serper_api_key:
        fallback_results = []
        try:
            # First try DuckDuckGo search library if installed
            from duckduckgo_search import DDGS
            with DDGS() as ddgs:
                results = list(ddgs.text(query, max_results=num_results))
                for idx, r in enumerate(results):
                    fallback_results.append({
                        "title": r.get("title", ""),
                        "link": r.get("href", ""),
                        "snippet": r.get("body", ""),
                        "position": idx + 1
                    })
        except Exception as exc:
            log.warning("DuckDuckGo text search failed: %s", exc)

        if not fallback_results:
            # Fallback to Wikipedia API if DDG returned nothing
            try:
                import urllib.parse
                async with httpx.AsyncClient(timeout=10.0) as client:
                    url = f"https://en.wikipedia.org/w/api.php?action=opensearch&search={urllib.parse.quote(query)}&limit={num_results}&namespace=0&format=json"
                    resp = await client.get(url)
                    data = resp.json()
                    if isinstance(data, list) and len(data) >= 4:
                        titles, snippets, links = data[1], data[2], data[3]
                        for idx, (t, s, l) in enumerate(zip(titles, snippets, links)):
                            fallback_results.append({
                                "title": t,
                                "link": l,
                                "snippet": s if s else f"Wikipedia article about {t}",
                                "position": idx + 1
                            })
            except Exception as exc:
                log.warning("Wikipedia fallback failed: %s", exc)

        result = {
            "query": query,
            "results": fallback_results,
            "source": "duckduckgo_or_wiki_fallback" if fallback_results else "unavailable",
            "message": "Using fallback search because SERPER_API_KEY is missing." if fallback_results else "No SERPER_API_KEY and fallback failed.",
        }
        elapsed = (time.perf_counter() - start) * 1000
        if task_id:
            await _log_tool_call(task_id, agent_log_id, "web_search", {"query": query}, result, "success" if fallback_results else "error", elapsed, None if fallback_results else "Fallback failed")
        return result

    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.post(
                SERPER_URL,
                json={"q": query, "num": num_results},
                headers={
                    "X-API-KEY": settings.serper_api_key,
                    "Content-Type": "application/json",
                },
            )
            resp.raise_for_status()
            data = resp.json()

        organic = data.get("organic", [])
        results: List[Dict[str, str]] = []
        for item in organic[:num_results]:
            results.append({
                "title": item.get("title", ""),
                "link": item.get("link", ""),
                "snippet": item.get("snippet", ""),
                "position": item.get("position", 0),
            })

        # Include knowledge graph if available
        knowledge_graph = data.get("knowledgeGraph", {})
        answer_box = data.get("answerBox", {})

        output = {
            "query": query,
            "results": results,
            "total_results": len(results),
            "source": "serper",
            "knowledge_graph": {
                "title": knowledge_graph.get("title", ""),
                "description": knowledge_graph.get("description", ""),
            } if knowledge_graph else None,
            "answer_box": {
                "title": answer_box.get("title", ""),
                "answer": answer_box.get("answer", ""),
                "snippet": answer_box.get("snippet", ""),
            } if answer_box else None,
        }

        elapsed = (time.perf_counter() - start) * 1000
        if task_id:
            await _log_tool_call(task_id, agent_log_id, "web_search", {"query": query}, output, "success", elapsed)

        log.info("Web search '%s': %d results in %.0fms", query, len(results), elapsed)
        return output

    except Exception as exc:
        elapsed = (time.perf_counter() - start) * 1000
        error_msg = str(exc)
        if task_id:
            await _log_tool_call(task_id, agent_log_id, "web_search", {"query": query}, {}, "error", elapsed, error_msg)
        log.error("Web search failed: %s", exc)
        return {
            "query": query,
            "results": [],
            "source": "serper",
            "error": error_msg,
        }
