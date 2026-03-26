"""
Planner Agent — decomposes a natural language task into an execution plan.

Uses the Groq LLM to analyze the user's request and produce a structured plan
with steps, required agent types, and tool requirements.
"""

import json
import logging
import time
import uuid
from typing import Any, Dict, List

from app.models.db import AgentExecutionLog, async_session
from app.tools.text_analyzer import llm_analyze

log = logging.getLogger(__name__)

PLANNING_SYSTEM_PROMPT = """You are a task planning agent for Orkestron AI platform.
Given a user's task, decompose it into a structured execution plan.

Return ONLY valid JSON with this exact structure:
{
  "task_type": "research|comparison|analysis|extraction|general",
  "summary": "Brief description of what the task requires",
  "steps": [
    {
      "step": 1,
      "agent": "web_search|data_extraction|reasoning|comparison|result_generator",
      "action": "Brief description of what this step does",
      "depends_on": []
    }
  ],
  "requires_web": true/false,
  "key_queries": ["search query 1", "search query 2"]
}

Rules:
- Use "web_search" agent for finding information online
- Use "data_extraction" agent for scraping and extracting data from URLs
- Use "reasoning" agent for analysis, synthesis, and logical processing
- Use "comparison" agent for comparing options, products, or data points
- Use "result_generator" agent for formatting the final structured output
- Always end with "result_generator" as the last step
- Generate 1-3 key search queries that would help answer the user's request
- Keep plans practical: 3-6 steps maximum"""


async def plan_task(
    task_input: str,
    task_id: str,
) -> Dict[str, Any]:
    """
    Analyze the user's task and produce an execution plan.
    Returns a dict with task_type, steps, and metadata.
    """
    start = time.perf_counter()
    agent_log_id = f"al-{uuid.uuid4().hex[:12]}"

    try:
        result = await llm_analyze(
            prompt=f"Plan this task: {task_input}",
            system_prompt=PLANNING_SYSTEM_PROMPT,
            max_tokens=1024,
            temperature=0.2,
            task_id=task_id,
            agent_log_id=agent_log_id,
        )

        elapsed_ms = (time.perf_counter() - start) * 1000

        if result.get("error"):
            # Fallback plan for when LLM is unavailable
            plan = _fallback_plan(task_input)
        else:
            try:
                content = result["content"].strip()
                # Extract JSON from potential markdown code blocks
                if "```json" in content:
                    content = content.split("```json")[1].split("```")[0].strip()
                elif "```" in content:
                    content = content.split("```")[1].split("```")[0].strip()
                plan = json.loads(content)
            except (json.JSONDecodeError, IndexError):
                log.warning("Failed to parse planner LLM output, using fallback")
                plan = _fallback_plan(task_input)

        # Log the agent execution
        log_entry = AgentExecutionLog(
            log_id=agent_log_id,
            task_id=task_id,
            agent_name="planner",
            agent_type="planner",
            step_index=0,
            input_data={"task_input": task_input[:500]},
            output_data={"task_type": plan.get("task_type", "general"), "step_count": len(plan.get("steps", []))},
            status="success",
            latency_ms=elapsed_ms,
            tools_used=["llm_analyze"],
        )
        try:
            async with async_session() as session:
                session.add(log_entry)
                await session.commit()
        except Exception as exc:
            log.warning("Failed to log planner execution: %s", exc)

        log.info("Planned task '%s' → %s (%d steps) in %.0fms",
                 task_input[:60], plan.get("task_type"), len(plan.get("steps", [])), elapsed_ms)

        return plan

    except Exception as exc:
        log.error("Planner failed: %s", exc)
        return _fallback_plan(task_input)


def _fallback_plan(task_input: str) -> Dict[str, Any]:
    """Generate a simple default plan when LLM planning fails."""
    lower = task_input.lower()

    # Simple keyword-based classification
    if any(w in lower for w in ["compare", "vs", "versus", "best", "cheapest", "top"]):
        task_type = "comparison"
    elif any(w in lower for w in ["summarize", "summary", "explain", "analyze"]):
        task_type = "analysis"
    elif any(w in lower for w in ["find", "search", "look up", "what is", "who is"]):
        task_type = "research"
    elif any(w in lower for w in ["extract", "scrape", "get data", "pull"]):
        task_type = "extraction"
    else:
        task_type = "general"

    steps: List[Dict[str, Any]] = [
        {"step": 1, "agent": "web_search", "action": f"Search for: {task_input[:100]}", "depends_on": []},
        {"step": 2, "agent": "reasoning", "action": "Analyze search results", "depends_on": [1]},
        {"step": 3, "agent": "result_generator", "action": "Format final response", "depends_on": [2]},
    ]

    if task_type == "comparison":
        steps.insert(2, {"step": 3, "agent": "comparison", "action": "Compare options found", "depends_on": [1, 2]})
        steps[-1]["step"] = 4
        steps[-1]["depends_on"] = [3]

    return {
        "task_type": task_type,
        "summary": f"Process task: {task_input[:200]}",
        "steps": steps,
        "requires_web": True,
        "key_queries": [task_input[:120]],
    }
