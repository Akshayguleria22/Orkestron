"""
Result Generator Agent — produces the final structured output for the user.

Takes all intermediate results from the pipeline and generates a clean,
formatted final response with key findings and structured data.
"""

import json
import logging
import time
import uuid
from typing import Any, Dict, List

from app.models.db import AgentExecutionLog, async_session
from app.tools.text_analyzer import llm_analyze

log = logging.getLogger(__name__)

RESULT_SYSTEM_PROMPT = """You are a result generation agent. Your job is to produce a clean, 
well-structured final response for the user based on all the analysis done by previous agents.

Format your response as:
1. **Summary** - A brief 2-3 sentence answer to the user's question
2. **Key Findings** - Bullet points of the most important discoveries
3. **Details** - Any relevant supporting information
4. **Recommendation** (if applicable) - A clear actionable recommendation

Be concise, factual, and directly address the user's original request.
Use markdown formatting for readability."""


async def run_result_generator(
    task_input: str,
    intermediate_results: Dict[str, Any],
    task_id: str = "",
    step_index: int = 0,
) -> Dict[str, Any]:
    """
    Generate the final structured response from all pipeline results.
    intermediate_results: dict with keys like 'search', 'extraction', 'reasoning', 'comparison'
    """
    start = time.perf_counter()
    agent_log_id = f"al-{uuid.uuid4().hex[:12]}"

    # Build context from all intermediate results
    context_parts: List[str] = []

    # Search results
    search_data = intermediate_results.get("web_search", intermediate_results.get("search", {}))
    if search_data.get("results"):
        search_summary = []
        for r in search_data["results"][:8]:
            title = r.get("title", "")
            snippet = r.get("snippet", "")
            if title:
                search_summary.append(f"- {title}: {snippet[:200]}")
        if search_summary:
            context_parts.append("## Search Results\n" + "\n".join(search_summary))

    # Extracted data
    extraction_data = intermediate_results.get("data_extraction", intermediate_results.get("extraction", {}))
    if extraction_data.get("extracted"):
        for ext in extraction_data["extracted"][:3]:
            if ext.get("content"):
                context_parts.append(f"## Extracted from {ext.get('title', ext.get('url', 'page'))}\n{ext['content'][:1500]}")

    # Reasoning analysis
    reasoning_data = intermediate_results.get("reasoning", {})
    if reasoning_data.get("analysis"):
        context_parts.append(f"## Analysis\n{reasoning_data['analysis']}")

    # Comparison data
    comparison_data = intermediate_results.get("comparison", {})
    if comparison_data.get("comparison"):
        comp = comparison_data["comparison"]
        if isinstance(comp, dict):
            if comp.get("recommendation"):
                context_parts.append(f"## Comparison Result\n{comp['recommendation']}")
            if comp.get("comparison_summary"):
                context_parts.append(f"Summary: {comp['comparison_summary']}")

    context_text = "\n\n".join(context_parts) if context_parts else "No intermediate data available."

    prompt = f"""User's original request: {task_input}

All gathered information and analysis:
{context_text}

Generate a complete, well-structured final response that directly answers the user's request.
Include all relevant findings and a clear recommendation if applicable."""

    try:
        result = await llm_analyze(
            prompt=prompt,
            system_prompt=RESULT_SYSTEM_PROMPT,
            max_tokens=2048,
            temperature=0.3,
            task_id=task_id,
            agent_log_id=agent_log_id,
        )

        elapsed_ms = (time.perf_counter() - start) * 1000

        final_text = result.get("content", "")

        if not final_text.strip():
            final_text = _fallback_result_text(task_input=task_input, intermediate_results=intermediate_results)

        # Build structured result
        output = {
            "result_text": final_text,
            "tokens_used": result.get("tokens_used", 0),
            "sources_used": len(context_parts),
            "has_error": bool(result.get("error")),
        }

        if result.get("error"):
            output["error"] = result["error"]
            output["result_text"] = _fallback_result_text(task_input=task_input, intermediate_results=intermediate_results)

        log_entry = AgentExecutionLog(
            log_id=agent_log_id,
            task_id=task_id,
            agent_name="result_generator",
            agent_type="result_generator",
            step_index=step_index,
            input_data={"task": task_input[:200], "sources": len(context_parts)},
            output_data={"result_length": len(final_text), "tokens": output["tokens_used"]},
            status="success" if not result.get("error") else "error",
            latency_ms=elapsed_ms,
            tools_used=["llm_analyze"],
        )
        try:
            async with async_session() as session:
                session.add(log_entry)
                await session.commit()
        except Exception as exc:
            log.warning("Failed to log result generator: %s", exc)

        log.info("Result generator: %d chars from %d sources in %.0fms",
                 len(final_text), len(context_parts), elapsed_ms)

        return output

    except Exception as exc:
        elapsed_ms = (time.perf_counter() - start) * 1000
        log.error("Result generator failed: %s", exc)
        fallback = _fallback_result_text(task_input=task_input, intermediate_results=intermediate_results)
        return {"result_text": fallback, "error": str(exc), "sources_used": 0}


def _fallback_result_text(task_input: str, intermediate_results: Dict[str, Any]) -> str:
    """Build a deterministic non-empty fallback result from available intermediate outputs."""
    reasoning_data = intermediate_results.get("reasoning", {})
    reasoning_text = str(reasoning_data.get("analysis", "")).strip()
    if reasoning_text:
        return reasoning_text

    search_data = intermediate_results.get("web_search", intermediate_results.get("search", {}))
    results = search_data.get("results", []) if isinstance(search_data, dict) else []
    if isinstance(results, list) and results:
        lines: List[str] = ["Summary from available search results:"]
        for item in results[:5]:
            if isinstance(item, dict):
                title = str(item.get("title", "")).strip()
                snippet = str(item.get("snippet", "")).strip()
                if title or snippet:
                    lines.append(f"- {title}: {snippet[:220]}")
        if len(lines) > 1:
            return "\n".join(lines)

    return (
        "Partial execution completed, but a complete final summary could not be generated. "
        "Please retry with a more specific task prompt."
    )
