"""
Web Search Agent — executes web searches and aggregates results.

Uses the web_search tool (Serper.dev) to find relevant information.
Can run multiple queries and merge results.
"""

import logging
import time
import uuid
from typing import Any, Dict, List

from app.models.db import AgentExecutionLog, async_session
from app.tools.web_search import web_search

log = logging.getLogger(__name__)


async def run_web_search(
    queries: List[str],
    num_results: int = 5,
    task_id: str = "",
    step_index: int = 0,
) -> Dict[str, Any]:
    """
    Execute one or more web search queries and aggregate results.
    Returns combined search results with deduplication.
    """
    start = time.perf_counter()
    agent_log_id = f"al-{uuid.uuid4().hex[:12]}"
    all_results: List[Dict[str, Any]] = []
    seen_urls: set = set()

    for query in queries[:3]:  # Max 3 queries
        try:
            search_result = await web_search(
                query=query,
                num_results=num_results,
                task_id=task_id,
                agent_log_id=agent_log_id,
            )

            for item in search_result.get("results", []):
                url = item.get("link", "")
                if url and url not in seen_urls:
                    seen_urls.add(url)
                    all_results.append(item)

            # Include knowledge graph and answer box if available
            if search_result.get("knowledge_graph"):
                all_results.insert(0, {
                    "type": "knowledge_graph",
                    "title": search_result["knowledge_graph"].get("title", ""),
                    "snippet": search_result["knowledge_graph"].get("description", ""),
                    "data": search_result["knowledge_graph"],
                })

            if search_result.get("answer_box"):
                all_results.insert(0, {
                    "type": "answer_box",
                    "title": "Direct Answer",
                    "snippet": search_result["answer_box"].get("answer", search_result["answer_box"].get("snippet", "")),
                    "data": search_result["answer_box"],
                })

        except Exception as exc:
            log.warning("Search query failed '%s': %s", query, exc)

    elapsed_ms = (time.perf_counter() - start) * 1000

    output = {
        "results": all_results[:15],  # Cap at 15 results
        "total_found": len(all_results),
        "queries_executed": len(queries[:3]),
        "urls": list(seen_urls)[:15],
    }

    # Log agent execution
    log_entry = AgentExecutionLog(
        log_id=agent_log_id,
        task_id=task_id,
        agent_name="web_search_agent",
        agent_type="web_search",
        step_index=step_index,
        input_data={"queries": queries[:3]},
        output_data={"result_count": len(all_results), "queries_run": len(queries[:3])},
        status="success" if all_results else "partial",
        latency_ms=elapsed_ms,
        tools_used=["web_search"],
    )
    try:
        async with async_session() as session:
            session.add(log_entry)
            await session.commit()
    except Exception as exc:
        log.warning("Failed to log web search agent: %s", exc)

    log.info("Web search agent: %d results from %d queries in %.0fms",
             len(all_results), len(queries[:3]), elapsed_ms)

    return output
