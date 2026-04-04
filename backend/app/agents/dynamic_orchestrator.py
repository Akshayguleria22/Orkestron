"""
Dynamic Task Orchestrator — executes real user tasks with AI agents.

Unlike the static procurement workflow (orchestrator.py), this orchestrator:
1. Takes a natural language task from the user
2. Uses the planner agent to decompose it into steps
3. Executes each step sequentially using the appropriate agent
4. Streams progress via WebSocket
5. Stores results in the Task and log tables

This coexists with the original static orchestrator for backward compatibility.
"""

import logging
import time
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from sqlalchemy import select

from app.agents.planner import plan_task
from app.agents.web_search_agent import run_web_search
from app.agents.data_extraction import run_data_extraction
from app.agents.reasoning_agent import run_reasoning
from app.agents.comparison_agent import run_comparison
from app.agents.result_generator import run_result_generator
from app.models.db import Task, ExecutionTrace, async_session
from app.services.websocket_manager import manager as ws_manager

log = logging.getLogger(__name__)


# Agent dispatch table
AGENT_RUNNERS = {
    "web_search": run_web_search,
    "data_extraction": run_data_extraction,
    "reasoning": run_reasoning,
    "comparison": run_comparison,
    "result_generator": run_result_generator,
}

MAX_AGENT_ATTEMPTS = 2  # one retry after first failure


async def execute_real_task(
    task_id: str,
    user_id: str,
    task_input: str,
    selected_steps: Optional[List[str]] = None,
) -> Dict[str, Any]:
    """
    Main entry point for executing a real user task.
    Returns the final result dict.
    """
    start = time.perf_counter()
    agent_path: List[str] = []
    intermediate_results: Dict[str, Any] = {}
    error_message: Optional[str] = None
    trace_nodes: List[Dict[str, Any]] = []
    step_errors: List[Dict[str, Any]] = []
    warnings: List[str] = []

    log.info(
        "task_start task_id=%s user_id=%s input_len=%d",
        task_id,
        user_id,
        len(task_input or ""),
    )

    # Create execution trace for observatory
    trace_id = f"trace-{uuid.uuid4().hex[:12]}"
    try:
        async with async_session() as session:
            session.add(ExecutionTrace(
                trace_id=trace_id,
                task_id=task_id,
                user_id=user_id,
                status="running",
                nodes=[],
            ))
            await session.commit()
    except Exception:
        log.warning("Failed to create execution trace for task %s", task_id)

    try:
        # ── Step 1: Plan the task ──
        await _notify(user_id, task_id, "planning", "Analyzing your task...")
        plan = _normalize_plan(await plan_task(task_input, task_id), task_input)
        if selected_steps:
            plan = _apply_selected_steps_to_plan(
                plan=plan,
                selected_steps=selected_steps,
                task_input=task_input,
            )
        agent_path.append("planner")

        log.info(
            "task_plan task_id=%s task_type=%s step_count=%d queries=%d",
            task_id,
            plan.get("task_type", "general"),
            len(plan.get("steps", [])),
            len(plan.get("key_queries", [])),
        )

        await _notify(user_id, task_id, "planned", f"Plan: {plan.get('task_type', 'general')} ({len(plan.get('steps', []))} steps)")

        # Update task with plan
        await _update_task(task_id, status="running", plan=plan, task_type=plan.get("task_type", "general"))

        steps = plan.get("steps", [])
        key_queries = plan.get("key_queries", [task_input[:120]])

        # ── Step 2: Execute each step ──
        for i, step in enumerate(steps):
            agent_type = step.get("agent", "")
            step_action = step.get("action", "")
            step_index = step.get("step", i + 1)
            step_start = time.perf_counter()

            log.info(
                "step_start task_id=%s step=%s agent=%s action=%s",
                task_id,
                step_index,
                agent_type,
                step_action[:200],
            )

            await _notify(user_id, task_id, "step_started", f"Step {step_index}: {agent_type} — {step_action}", {
                "step": step_index,
                "agent": agent_type,
                "total_steps": len(steps),
            })

            try:
                result, step_error = await _run_agent_step_with_retry(
                    agent_type=agent_type,
                    task_input=task_input,
                    task_id=task_id,
                    step_index=step_index,
                    key_queries=key_queries,
                    intermediate_results=intermediate_results,
                )

                step_duration = round(time.perf_counter() - step_start, 3)

                # Store intermediate result
                intermediate_results[agent_type] = result
                agent_path.append(agent_type)

                output_summary = _summarize_agent_output(agent_type, result)
                log.info(
                    "step_output task_id=%s step=%s agent=%s duration_s=%.3f summary=%s",
                    task_id,
                    step_index,
                    agent_type,
                    step_duration,
                    output_summary,
                )

                if step_error:
                    step_errors.append({
                        "step": step_index,
                        "agent": agent_type,
                        "error": step_error,
                    })
                    warnings.append(f"{agent_type}: {step_error}")

                # Record trace node
                trace_nodes.append({
                    "agent": agent_type,
                    "status": "completed" if not step_error else "partial",
                    "duration": step_duration,
                    "step": step_index,
                    "output_summary": output_summary,
                    "error": step_error,
                })

                await _notify(user_id, task_id, "step_completed", f"Step {step_index} completed", {
                    "step": step_index,
                    "agent": agent_type,
                    "warning": step_error,
                })

            except Exception as exc:
                log.error("Step %d (%s) failed: %s", step_index, agent_type, exc)
                trace_nodes.append({
                    "agent": agent_type,
                    "status": "error",
                    "duration": round(time.perf_counter() - step_start, 3),
                    "step": step_index,
                    "error": str(exc)[:200],
                })
                step_errors.append({
                    "step": step_index,
                    "agent": agent_type,
                    "error": str(exc)[:200],
                })
                warnings.append(f"{agent_type}: {str(exc)[:200]}")
                await _notify(user_id, task_id, "step_error", f"Step {step_index} error: {str(exc)[:100]}", {
                    "step": step_index,
                    "agent": agent_type,
                })
                # Continue to next step (graceful degradation)

        # ── Step 3: Build final result ──
        total_duration = time.perf_counter() - start

        # Get the final result text
        result_gen = intermediate_results.get("result_generator", {})
        result_text = result_gen.get("result_text", "")

        # If no result generator output, try reasoning
        if not result_text:
            reasoning = intermediate_results.get("reasoning", {})
            result_text = reasoning.get("analysis", "")

        # If still nothing, summarize search results
        if not result_text:
            search = intermediate_results.get("web_search", {})
            if search.get("results"):
                parts = []
                for r in search["results"][:5]:
                    parts.append(f"• {r.get('title', '')}: {r.get('snippet', '')}")
                result_text = "Search Results:\n" + "\n".join(parts)

        if not result_text:
            result_text = "Task completed but no results could be generated. Please try a more specific request."

        log.info(
            "task_final_result task_id=%s result_len=%d intermediate_keys=%s warnings=%d",
            task_id,
            len(result_text),
            sorted(list(intermediate_results.keys())),
            len(warnings),
        )

        # Build structured result
        final_result = {
            "text": result_text,
            "task_type": plan.get("task_type", "general"),
            "steps_completed": len(agent_path) - 1,  # Minus planner
            "total_steps": len(steps),
            "duration_seconds": round(total_duration, 2),
            "agent_path": agent_path,
            "sources": _extract_sources(intermediate_results),
            "intermediate_keys": sorted(list(intermediate_results.keys())),
            "warnings": warnings,
            "step_errors": step_errors,
        }

        completion_error = "; ".join(warnings[:3])[:500] if warnings else None

        # Update task as completed
        await _update_task(
            task_id,
            status="completed",
            result=final_result,
            result_text=result_text,
            agent_path=agent_path,
            total_duration=round(total_duration, 2),
            error_message=completion_error,
        )

        # ── Trigger Real Billing ──
        try:
            from app.billing.ledger import record_billing_entry
            fee = 0.15 if len(agent_path) > 3 else 0.05
            await record_billing_entry(
                user_id=user_id,
                outcome_id=f"out-{uuid.uuid4().hex[:12]}",
                agent_id="orkestron_core",
                pricing_model="flat_fee",
                fee=fee,
            )
        except Exception as e:
            log.warning("Failed to record billing entry: %s", e)

        # Notify final
        await _notify(user_id, task_id, "task_completed", "Task results ready", {
            "duration": round(total_duration, 2),
            "agents_used": agent_path,
            "warnings": warnings,
        })
        # Finalize execution trace
        await _update_trace(trace_id, "completed", trace_nodes, round(total_duration, 2))

        await _notify(user_id, task_id, "completed", "Task completed!", {
            "duration": round(total_duration, 2),
            "steps_completed": len(agent_path) - 1,
        })

        log.info("Task %s completed: %s in %.1fs (%d agents)",
                 task_id, plan.get("task_type"), total_duration, len(agent_path))

        return final_result

    except Exception as exc:
        total_duration = time.perf_counter() - start
        error_message = str(exc)
        log.exception("Task %s failed: %s", task_id, exc)

        await _update_task(task_id, status="failed", error_message=error_message)
        await _update_trace(trace_id, "failed", trace_nodes, round(total_duration, 2))
        await _notify(user_id, task_id, "failed", f"Task failed: {error_message[:200]}")

        return {
            "text": f"Task failed: {error_message}",
            "task_type": "error",
            "error": error_message,
            "agent_path": agent_path,
            "duration_seconds": round(total_duration, 2),
        }


async def _run_agent_step(
    agent_type: str,
    task_input: str,
    task_id: str,
    step_index: int,
    key_queries: List[str],
    intermediate_results: Dict[str, Any],
) -> Dict[str, Any]:
    """Execute a single agent step based on type."""

    if agent_type == "web_search":
        return await run_web_search(
            queries=key_queries,
            num_results=5,
            task_id=task_id,
            step_index=step_index,
        )

    elif agent_type == "data_extraction":
        # Get URLs from search results
        search_data = intermediate_results.get("web_search", {})
        urls = search_data.get("urls", [])[:5]
        if not urls:
            # Extract URLs from search results
            for r in search_data.get("results", []):
                link = r.get("link", r.get("url", ""))
                if link and link.startswith("http"):
                    urls.append(link)
                if len(urls) >= 3:
                    break

        return await run_data_extraction(
            urls=urls,
            task_context=task_input,
            task_id=task_id,
            step_index=step_index,
        )

    elif agent_type == "reasoning":
        # Gather all context data
        context_data: List[Dict[str, Any]] = []
        search = intermediate_results.get("web_search", {})
        if search.get("results"):
            context_data.extend(search["results"][:8])

        extraction = intermediate_results.get("data_extraction", {})
        if extraction.get("extracted"):
            context_data.extend(extraction["extracted"][:3])

        return await run_reasoning(
            context_data=context_data,
            task_input=task_input,
            task_id=task_id,
            step_index=step_index,
        )

    elif agent_type == "comparison":
        # Gather items to compare
        items: List[Dict[str, Any]] = []
        search = intermediate_results.get("web_search", {})
        if search.get("results"):
            items.extend(search["results"][:8])

        extraction = intermediate_results.get("data_extraction", {})
        if extraction.get("extracted"):
            items.extend(extraction["extracted"])

        return await run_comparison(
            items_data=items,
            task_input=task_input,
            task_id=task_id,
            step_index=step_index,
        )

    elif agent_type == "result_generator":
        return await run_result_generator(
            task_input=task_input,
            intermediate_results=intermediate_results,
            task_id=task_id,
            step_index=step_index,
        )

    else:
        log.warning("Unknown agent type: %s, skipping", agent_type)
        return {"skipped": True, "agent": agent_type}


async def _run_agent_step_with_retry(
    agent_type: str,
    task_input: str,
    task_id: str,
    step_index: int,
    key_queries: List[str],
    intermediate_results: Dict[str, Any],
) -> tuple[Dict[str, Any], Optional[str]]:
    """
    Run one step with a single retry on exception or invalid output.
    Returns (result, warning_or_error).
    """
    last_error: Optional[str] = None

    for attempt in range(1, MAX_AGENT_ATTEMPTS + 1):
        try:
            result = await _run_agent_step(
                agent_type=agent_type,
                task_input=task_input,
                task_id=task_id,
                step_index=step_index,
                key_queries=key_queries,
                intermediate_results=intermediate_results,
            )
        except Exception as exc:
            last_error = f"exception on attempt {attempt}: {str(exc)[:200]}"
            log.warning(
                "step_retry task_id=%s step=%s agent=%s attempt=%d reason=%s",
                task_id,
                step_index,
                agent_type,
                attempt,
                str(exc)[:200],
            )
            if attempt < MAX_AGENT_ATTEMPTS:
                continue
            return _fallback_agent_output(agent_type, last_error), last_error

        valid, validation_error = _validate_agent_output(agent_type, result)
        if valid:
            if attempt > 1:
                log.info(
                    "step_recovered task_id=%s step=%s agent=%s attempt=%d",
                    task_id,
                    step_index,
                    agent_type,
                    attempt,
                )
            return result, None

        last_error = f"invalid output on attempt {attempt}: {validation_error}"
        log.warning(
            "step_invalid_output task_id=%s step=%s agent=%s attempt=%d reason=%s",
            task_id,
            step_index,
            agent_type,
            attempt,
            validation_error,
        )
        if attempt < MAX_AGENT_ATTEMPTS:
            continue

    return _fallback_agent_output(agent_type, last_error or "unknown step failure"), last_error


def _normalize_plan(plan: Dict[str, Any], task_input: str) -> Dict[str, Any]:
    """Ensure planner output has required keys and a valid step list."""
    if not isinstance(plan, dict):
        plan = {}

    steps = plan.get("steps")
    if not isinstance(steps, list) or not steps:
        steps = [
            {"step": 1, "agent": "web_search", "action": f"Search for: {task_input[:100]}", "depends_on": []},
            {"step": 2, "agent": "reasoning", "action": "Analyze search results", "depends_on": [1]},
            {"step": 3, "agent": "result_generator", "action": "Format final response", "depends_on": [2]},
        ]

    if not any(isinstance(s, dict) and s.get("agent") == "result_generator" for s in steps):
        steps.append({
            "step": len(steps) + 1,
            "agent": "result_generator",
            "action": "Format final response",
            "depends_on": [len(steps)],
        })

    key_queries = plan.get("key_queries")
    if not isinstance(key_queries, list) or not key_queries:
        key_queries = [task_input[:120]]

    return {
        "task_type": str(plan.get("task_type") or "general"),
        "summary": str(plan.get("summary") or f"Process task: {task_input[:200]}"),
        "steps": steps,
        "requires_web": bool(plan.get("requires_web", True)),
        "key_queries": [str(q) for q in key_queries if str(q).strip()][:3] or [task_input[:120]],
    }


def _apply_selected_steps_to_plan(
    plan: Dict[str, Any],
    selected_steps: List[str],
    task_input: str,
) -> Dict[str, Any]:
    """Project planner output onto a user-selected step sequence."""
    clean_selection: List[str] = []
    for step in selected_steps:
        step_name = str(step or "").strip().lower()
        if not step_name or step_name == "planner":
            continue
        if step_name in AGENT_RUNNERS and step_name not in clean_selection:
            clean_selection.append(step_name)

    if not clean_selection:
        return plan

    base_steps = plan.get("steps", [])
    existing_by_agent: Dict[str, Dict[str, Any]] = {
        str(s.get("agent")): s
        for s in base_steps
        if isinstance(s, dict) and str(s.get("agent"))
    }

    filtered_steps: List[Dict[str, Any]] = []
    for idx, agent in enumerate(clean_selection, start=1):
        base = existing_by_agent.get(agent, {})
        action = str(base.get("action") or _default_action_for_agent(agent, task_input))
        filtered_steps.append(
            {
                "step": idx,
                "agent": agent,
                "action": action,
                "depends_on": [idx - 1] if idx > 1 else [],
            }
        )

    return {
        **plan,
        "summary": f"User-selected execution plan with {len(filtered_steps)} steps",
        "steps": filtered_steps,
    }


def _default_action_for_agent(agent_type: str, task_input: str) -> str:
    if agent_type == "web_search":
        return f"Search for relevant information about: {task_input[:100]}"
    if agent_type == "data_extraction":
        return "Extract structured data from collected sources"
    if agent_type == "reasoning":
        return "Analyze collected evidence and derive conclusions"
    if agent_type == "comparison":
        return "Compare options and rank outcomes"
    if agent_type == "result_generator":
        return "Generate final structured response"
    return f"Execute {agent_type} for this task"


def _validate_agent_output(agent_type: str, output: Dict[str, Any]) -> tuple[bool, str]:
    """Validate critical agent outputs to avoid silent broken pipeline states."""
    if not isinstance(output, dict):
        return False, "output is not a dict"

    if agent_type == "web_search":
        results = output.get("results")
        if not isinstance(results, list):
            return False, "web_search results must be a list"
        return True, ""

    if agent_type == "data_extraction":
        extracted = output.get("extracted")
        if not isinstance(extracted, list):
            return False, "data_extraction missing extracted list"
        if extracted and not all(isinstance(item, dict) for item in extracted):
            return False, "data_extraction extracted items are not structured objects"
        return True, ""

    if agent_type == "reasoning":
        analysis = str(output.get("analysis", "")).strip()
        if not analysis:
            return False, "reasoning returned empty analysis"
        return True, ""

    if agent_type == "result_generator":
        result_text = str(output.get("result_text", "")).strip()
        if not result_text:
            return False, "result_generator returned empty result_text"
        return True, ""

    return True, ""


def _fallback_agent_output(agent_type: str, error_message: str) -> Dict[str, Any]:
    """Return safe fallback output per agent so the pipeline can continue."""
    if agent_type == "web_search":
        return {
            "results": [],
            "total_found": 0,
            "queries_executed": 0,
            "urls": [],
            "error": error_message,
        }
    if agent_type == "data_extraction":
        return {
            "extracted": [],
            "successful_count": 0,
            "total_content_length": 0,
            "error": error_message,
        }
    if agent_type == "reasoning":
        return {
            "analysis": "Insufficient reliable data was available for full reasoning. Showing partial results.",
            "tokens_used": 0,
            "context_items_used": 0,
            "has_error": True,
            "error": error_message,
        }
    if agent_type == "comparison":
        return {
            "comparison": {
                "items": [],
                "recommendation": "Insufficient reliable data to compare options.",
                "comparison_summary": "Comparison could not be completed successfully.",
            },
            "items_compared": 0,
            "has_error": True,
            "error": error_message,
        }
    if agent_type == "result_generator":
        return {
            "result_text": "Partial execution completed, but final result formatting failed. See available intermediate findings.",
            "tokens_used": 0,
            "sources_used": 0,
            "has_error": True,
            "error": error_message,
        }
    return {"error": error_message, "agent": agent_type}


def _summarize_agent_output(agent_type: str, output: Dict[str, Any]) -> str:
    """Create compact structured summaries for logs and traces."""
    if not isinstance(output, dict):
        return "invalid-output"

    if agent_type == "web_search":
        return f"results={len(output.get('results', []))}"
    if agent_type == "data_extraction":
        return f"extracted={len(output.get('extracted', []))},success={output.get('successful_count', 0)}"
    if agent_type == "reasoning":
        return f"analysis_len={len(str(output.get('analysis', '')))}"
    if agent_type == "comparison":
        cmp = output.get("comparison", {})
        items = cmp.get("items", []) if isinstance(cmp, dict) else []
        return f"items_compared={len(items)}"
    if agent_type == "result_generator":
        return f"result_len={len(str(output.get('result_text', '')))}"
    return f"keys={','.join(sorted(output.keys())[:6])}"


async def _update_task(task_id: str, **kwargs) -> None:
    """Update a task record in the database."""
    try:
        async with async_session() as session:
            result = await session.execute(select(Task).where(Task.task_id == task_id))
            task = result.scalar_one_or_none()
            if task:
                for key, value in kwargs.items():
                    if key == "result" and isinstance(value, dict):
                        task.result = value
                    elif key == "plan" and isinstance(value, dict):
                        task.plan = value
                    elif hasattr(task, key):
                        setattr(task, key, value)
                if kwargs.get("status") == "completed":
                    task.completed_at = datetime.now(timezone.utc)
                await session.commit()
    except Exception as exc:
        log.warning("Failed to update task %s: %s", task_id, exc)


async def _update_trace(trace_id: str, status: str, nodes: List[Dict], total_duration: float) -> None:
    """Finalize an execution trace in the database."""
    try:
        async with async_session() as session:
            result = await session.execute(
                select(ExecutionTrace).where(ExecutionTrace.trace_id == trace_id)
            )
            trace = result.scalar_one_or_none()
            if trace:
                trace.status = status
                trace.nodes = nodes
                trace.total_duration = total_duration
                trace.completed_at = datetime.now(timezone.utc)
                await session.commit()
    except Exception as exc:
        log.warning("Failed to update trace %s: %s", trace_id, exc)


async def _notify(user_id: str, task_id: str, event: str, message: str, data: Optional[Dict] = None) -> None:
    """Send WebSocket notification to the user."""
    try:
        payload = {
            "type": "task_update",
            "task_id": task_id,
            "event": event,
            "message": message,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }
        if data:
            payload["data"] = data
        await ws_manager.send_to_user(user_id, payload)
    except Exception:
        pass  # WebSocket notifications are best-effort


def _extract_sources(intermediate_results: Dict[str, Any]) -> List[Dict[str, str]]:
    """Extract source references from intermediate results."""
    sources: List[Dict[str, str]] = []
    seen_urls: set = set()

    search = intermediate_results.get("web_search", {})
    for r in search.get("results", []):
        url = r.get("link", r.get("url", ""))
        title = r.get("title", "")
        if url and url not in seen_urls and url.startswith("http"):
            seen_urls.add(url)
            sources.append({"url": url, "title": title})
        if len(sources) >= 10:
            break

    return sources
