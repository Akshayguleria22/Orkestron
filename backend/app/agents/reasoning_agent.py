"""
Reasoning Agent — performs analysis, synthesis, and logical processing.

Uses the LLM to analyze data from previous steps and produce insights.
"""

import logging
import time
import uuid
from typing import Any, Dict, List

from app.models.db import AgentExecutionLog, async_session
from app.tools.text_analyzer import llm_analyze

log = logging.getLogger(__name__)

REASONING_SYSTEM_PROMPT = """You are a reasoning and analysis agent. Your job is to:
1. Analyze the provided data and context
2. Extract key insights and patterns
3. Identify important facts, trends, or conclusions
4. Provide a clear, structured analysis

Be factual, concise, and well-organized. Use bullet points for key findings.
If data is insufficient, say so clearly rather than speculating."""


async def run_reasoning(
    context_data: List[Dict[str, Any]],
    task_input: str,
    analysis_prompt: str = "",
    task_id: str = "",
    step_index: int = 0,
) -> Dict[str, Any]:
    """
    Analyze provided context data and produce structured insights.
    context_data: list of data items from previous agents (search results, extracted content, etc.)
    """
    start = time.perf_counter()
    agent_log_id = f"al-{uuid.uuid4().hex[:12]}"

    # Build context from previous step data
    context_parts: List[str] = []
    for item in context_data[:10]:  # Max 10 context items
        if isinstance(item, dict):
            title = item.get("title", "")
            content = item.get("content", item.get("snippet", ""))
            url = item.get("url", item.get("link", ""))
            if title or content:
                entry = f"Source: {title}"
                if url:
                    entry += f" ({url})"
                if content:
                    entry += f"\n{str(content)[:1500]}"
                context_parts.append(entry)

    context_text = "\n\n---\n\n".join(context_parts) if context_parts else "No context data available."

    prompt = f"""Task: {task_input}

{analysis_prompt or "Analyze the following data and provide key insights:"}

Available Data:
{context_text}

Provide a structured analysis with:
1. Key Findings
2. Important Details
3. Summary"""

    try:
        result = await llm_analyze(
            prompt=prompt,
            system_prompt=REASONING_SYSTEM_PROMPT,
            max_tokens=2048,
            temperature=0.3,
            task_id=task_id,
            agent_log_id=agent_log_id,
        )

        elapsed_ms = (time.perf_counter() - start) * 1000

        output = {
            "analysis": result.get("content", ""),
            "tokens_used": result.get("tokens_used", 0),
            "context_items_used": len(context_parts),
            "has_error": bool(result.get("error")),
        }

        if result.get("error"):
            output["error"] = result["error"]

        log_entry = AgentExecutionLog(
            log_id=agent_log_id,
            task_id=task_id,
            agent_name="reasoning_agent",
            agent_type="reasoning",
            step_index=step_index,
            input_data={"task": task_input[:200], "context_items": len(context_parts)},
            output_data={"analysis_length": len(output["analysis"]), "tokens": output["tokens_used"]},
            status="success" if not result.get("error") else "error",
            latency_ms=elapsed_ms,
            tools_used=["llm_analyze"],
        )
        try:
            async with async_session() as session:
                session.add(log_entry)
                await session.commit()
        except Exception as exc:
            log.warning("Failed to log reasoning agent: %s", exc)

        log.info("Reasoning agent: %d chars analysis from %d context items in %.0fms",
                 len(output["analysis"]), len(context_parts), elapsed_ms)

        return output

    except Exception as exc:
        elapsed_ms = (time.perf_counter() - start) * 1000
        log.error("Reasoning agent failed: %s", exc)
        return {"analysis": "", "error": str(exc), "tokens_used": 0}
