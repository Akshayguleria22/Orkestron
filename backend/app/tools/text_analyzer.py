"""
Text Analyzer Tool — uses LLM for text analysis, summarization, and reasoning.

Wraps the Groq API for structured text processing tasks like:
- Summarization
- Key point extraction
- Comparison analysis
- Question answering over provided context
"""

import logging
import time
import uuid
from typing import Any, Dict, Optional

import httpx

from app.config import settings
from app.models.db import ToolCallLog, async_session

log = logging.getLogger(__name__)


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


async def llm_analyze(
    prompt: str,
    system_prompt: str = "You are a helpful AI assistant. Respond concisely and accurately.",
    max_tokens: int = 2048,
    temperature: float = 0.3,
    task_id: str = "",
    agent_log_id: str = "",
) -> Dict[str, Any]:
    """
    Send a prompt to the Groq LLM and return the response.
    Used by reasoning, comparison, and result generation agents.
    """
    start = time.perf_counter()

    if not settings.groq_api_key:
        return {"error": "Groq API key not configured", "content": ""}

    model = getattr(settings, "groq_model", "openai/gpt-oss-120b")

    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.post(
                "https://api.groq.com/openai/v1/chat/completions",
                headers={
                    "Authorization": f"Bearer {settings.groq_api_key}",
                    "Content-Type": "application/json",
                },
                json={
                    "model": model,
                    "messages": [
                        {"role": "system", "content": system_prompt},
                        {"role": "user", "content": prompt},
                    ],
                    "max_tokens": max_tokens,
                    "temperature": temperature,
                },
            )
            resp.raise_for_status()

        data = resp.json()
        content = data["choices"][0]["message"]["content"]
        usage = data.get("usage", {})

        elapsed = (time.perf_counter() - start) * 1000

        output = {
            "content": content,
            "model": model,
            "tokens_used": usage.get("total_tokens", 0),
            "prompt_tokens": usage.get("prompt_tokens", 0),
            "completion_tokens": usage.get("completion_tokens", 0),
        }

        if task_id:
            await _log_tool_call(
                task_id, agent_log_id, "llm_analyze",
                {"prompt_length": len(prompt), "temperature": temperature},
                {"tokens": usage.get("total_tokens", 0)},
                "success", elapsed,
            )

        log.info("LLM analyze: %d tokens in %.0fms", usage.get("total_tokens", 0), elapsed)
        return output

    except Exception as exc:
        elapsed = (time.perf_counter() - start) * 1000
        error_msg = str(exc)
        if task_id:
            await _log_tool_call(
                task_id, agent_log_id, "llm_analyze",
                {"prompt_length": len(prompt)},
                {}, "error", elapsed, error_msg,
            )
        log.error("LLM analyze failed: %s", exc)
        return {"error": error_msg, "content": ""}
