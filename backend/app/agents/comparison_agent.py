"""
Comparison Agent — compares multiple options, products, or data points.

Uses LLM analysis with structured output for side-by-side comparison.
"""

import logging
import time
import uuid
from typing import Any, Dict, List

from app.models.db import AgentExecutionLog, async_session
from app.tools.text_analyzer import llm_analyze

log = logging.getLogger(__name__)

COMPARISON_SYSTEM_PROMPT = """You are a comparison analysis agent. Your job is to:
1. Compare the given options/items side by side
2. Identify pros and cons of each option
3. Rank them based on the user's criteria
4. Provide a clear recommendation

Return your analysis in this JSON format:
{
  "items": [
    {
      "name": "Item name",
      "score": 8.5,
      "pros": ["pro 1", "pro 2"],
      "cons": ["con 1"],
      "key_facts": {"price": "$X", "rating": "4.5/5"}
    }
  ],
  "recommendation": "Best option and why",
  "comparison_summary": "Brief overall comparison"
}

If you cannot determine scores, use 0. Always provide at least a recommendation."""


async def run_comparison(
    items_data: List[Dict[str, Any]],
    task_input: str,
    criteria: str = "",
    task_id: str = "",
    step_index: int = 0,
) -> Dict[str, Any]:
    """
    Compare multiple items/options from previous step data.
    Returns structured comparison with scores and recommendation.
    """
    start = time.perf_counter()
    agent_log_id = f"al-{uuid.uuid4().hex[:12]}"

    # Build comparison context from data
    items_text_parts: List[str] = []
    for i, item in enumerate(items_data[:10], 1):
        if isinstance(item, dict):
            title = item.get("title", item.get("name", f"Item {i}"))
            content = item.get("content", item.get("snippet", item.get("analysis", "")))
            entry = f"Option {i}: {title}"
            if content:
                entry += f"\n{str(content)[:1200]}"
            items_text_parts.append(entry)

    items_text = "\n\n---\n\n".join(items_text_parts) if items_text_parts else "No items to compare."

    prompt = f"""Task: {task_input}

{f"Comparison criteria: {criteria}" if criteria else "Compare based on the user's requirements."}

Items to compare:
{items_text}

Provide a structured JSON comparison. Return ONLY valid JSON."""

    try:
        result = await llm_analyze(
            prompt=prompt,
            system_prompt=COMPARISON_SYSTEM_PROMPT,
            max_tokens=2048,
            temperature=0.2,
            task_id=task_id,
            agent_log_id=agent_log_id,
        )

        elapsed_ms = (time.perf_counter() - start) * 1000

        comparison = {}
        if result.get("content"):
            import json
            try:
                content = result["content"].strip()
                if "```json" in content:
                    content = content.split("```json")[1].split("```")[0].strip()
                elif "```" in content:
                    content = content.split("```")[1].split("```")[0].strip()
                comparison = json.loads(content)
            except (json.JSONDecodeError, IndexError):
                comparison = {
                    "items": [],
                    "recommendation": result["content"],
                    "comparison_summary": result["content"][:300],
                }

        output = {
            "comparison": comparison,
            "items_compared": len(items_text_parts),
            "tokens_used": result.get("tokens_used", 0),
            "has_error": bool(result.get("error")),
        }

        if result.get("error"):
            output["error"] = result["error"]

        log_entry = AgentExecutionLog(
            log_id=agent_log_id,
            task_id=task_id,
            agent_name="comparison_agent",
            agent_type="comparison",
            step_index=step_index,
            input_data={"task": task_input[:200], "items_count": len(items_text_parts)},
            output_data={"compared": len(items_text_parts)},
            status="success" if not result.get("error") else "error",
            latency_ms=elapsed_ms,
            tools_used=["llm_analyze"],
        )
        try:
            async with async_session() as session:
                session.add(log_entry)
                await session.commit()
        except Exception as exc:
            log.warning("Failed to log comparison agent: %s", exc)

        log.info("Comparison agent: %d items compared in %.0fms", len(items_text_parts), elapsed_ms)
        return output

    except Exception as exc:
        elapsed_ms = (time.perf_counter() - start) * 1000
        log.error("Comparison agent failed: %s", exc)
        return {"comparison": {}, "error": str(exc), "items_compared": 0}
