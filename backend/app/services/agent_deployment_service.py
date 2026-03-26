"""
Agent Deployment Service — full CRUD + real execution for deployable agents.

Handles:
- Creating/deploying agents (public or private)
- Listing agents (public marketplace + user's private)
- Executing agents with real ML + LLM tools
- Tracking runs and updating stats
- Seeding default platform agents
"""

import logging
import time
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from sqlalchemy import select, or_, func

from app.config import settings
from app.models.db import DeployableAgent, AgentRun, async_session
from app.tools.ml_tools import (
    ml_sentiment_analysis,
    ml_classify_text,
    ml_extract_entities,
    ml_semantic_similarity,
    ml_extract_keywords,
    ml_cluster_texts,
    ml_extractive_summary,
    ML_TOOLS,
)
from app.tools.text_analyzer import llm_analyze
from app.tools.web_search import web_search
from app.tools.web_scraper import web_scrape
from app.services.websocket_manager import manager as ws_manager
from app.services.workflow_service import get_workflow
from app.agents.dynamic_orchestrator import _run_agent_step as run_orchestrator_step

log = logging.getLogger(__name__)


# ==========================================================================
# CRUD Operations
# ==========================================================================

async def create_agent(
    owner_id: str,
    name: str,
    description: str = "",
    agent_type: str = "llm",
    visibility: str = "public",
    capabilities: List[str] = None,
    ml_models: List[str] = None,
    llm_provider: str = None,
    llm_model: str = None,
    system_prompt: str = None,
    tools: List[str] = None,
    config: Dict[str, Any] = None,
    tags: List[str] = None,
    icon: str = None,
    category: str = None,
    workflow_id: str = None,
) -> Dict[str, Any]:
    """Deploy a new agent (public or private)."""
    agent_id = f"agent-{uuid.uuid4().hex[:12]}"

    agent = DeployableAgent(
        agent_id=agent_id,
        owner_id=owner_id,
        name=name,
        description=description,
        agent_type=agent_type,
        visibility=visibility,
        capabilities=capabilities or [],
        ml_models=ml_models or [],
        llm_provider=llm_provider or "groq",
        llm_model=llm_model or settings.groq_model,
        system_prompt=system_prompt,
        tools=tools or [],
        config=config or {},
        tags=tags or [],
        icon=icon,
        category=category,
        workflow_id=workflow_id,
    )

    async with async_session() as session:
        session.add(agent)
        await session.commit()

    log.info("Agent deployed: %s (%s) by %s [%s]", name, agent_id, owner_id, visibility)
    return _serialize_agent(agent)


async def list_agents_for_user(
    user_id: str,
    include_public: bool = True,
    category: Optional[str] = None,
    agent_type: Optional[str] = None,
    search: Optional[str] = None,
    limit: int = 50,
) -> List[Dict[str, Any]]:
    """List agents visible to a user (their own + public ones)."""
    async with async_session() as session:
        conditions = []
        if include_public:
            conditions.append(
                or_(
                    DeployableAgent.owner_id == user_id,
                    DeployableAgent.visibility == "public",
                )
            )
        else:
            conditions.append(DeployableAgent.owner_id == user_id)

        # Exclude removed
        conditions.append(DeployableAgent.status != "removed")

        if category:
            conditions.append(DeployableAgent.category == category)
        if agent_type:
            conditions.append(DeployableAgent.agent_type == agent_type)

        query = (
            select(DeployableAgent)
            .where(*conditions)
            .order_by(DeployableAgent.total_runs.desc())
            .limit(min(limit, 100))
        )

        result = await session.execute(query)
        agents = result.scalars().all()

    serialized = [_serialize_agent(a) for a in agents]

    # Client-side search filter (for name/description)
    if search:
        search_lower = search.lower()
        serialized = [
            a for a in serialized
            if search_lower in a["name"].lower()
            or search_lower in a["description"].lower()
            or any(search_lower in t.lower() for t in a.get("tags", []))
        ]

    return serialized


async def get_agent_by_id(agent_id: str) -> Optional[Dict[str, Any]]:
    """Get a single agent by ID."""
    async with async_session() as session:
        result = await session.execute(
            select(DeployableAgent).where(DeployableAgent.agent_id == agent_id)
        )
        agent = result.scalar_one_or_none()

    return _serialize_agent(agent) if agent else None


async def update_agent(
    agent_id: str,
    owner_id: str,
    **updates,
) -> Optional[Dict[str, Any]]:
    """Update an agent (only owner can update)."""
    async with async_session() as session:
        result = await session.execute(
            select(DeployableAgent).where(
                DeployableAgent.agent_id == agent_id,
                DeployableAgent.owner_id == owner_id,
            )
        )
        agent = result.scalar_one_or_none()
        if not agent:
            return None

        allowed = {
            "name", "description", "agent_type", "visibility", "capabilities",
            "ml_models", "llm_provider", "llm_model", "system_prompt",
            "tools", "config", "tags", "icon", "category", "status", "workflow_id",
        }
        for key, value in updates.items():
            if key in allowed and value is not None:
                setattr(agent, key, value)

        agent.updated_at = datetime.now(timezone.utc)
        await session.commit()

    return _serialize_agent(agent)


async def delete_agent(agent_id: str, owner_id: str) -> bool:
    """Soft-delete an agent (mark as removed)."""
    async with async_session() as session:
        result = await session.execute(
            select(DeployableAgent).where(
                DeployableAgent.agent_id == agent_id,
                DeployableAgent.owner_id == owner_id,
            )
        )
        agent = result.scalar_one_or_none()
        if not agent:
            return False

        agent.status = "removed"
        agent.updated_at = datetime.now(timezone.utc)
        await session.commit()

    return True


# ==========================================================================
# Agent Execution Engine
# ==========================================================================

async def execute_agent(
    agent_id: str,
    user_id: str,
    input_text: str,
    task_id: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Execute a deployable agent with real ML + LLM tools.
    Returns run result with execution steps.
    """
    start = time.perf_counter()
    run_id = f"run-{uuid.uuid4().hex[:12]}"

    # Load the agent
    agent_data = await get_agent_by_id(agent_id)
    if not agent_data:
        return {"error": "Agent not found", "run_id": run_id, "status": "failed"}

    # Check access (public or owner)
    if agent_data["visibility"] == "private" and agent_data["owner_id"] != user_id:
        return {"error": "Access denied — this is a private agent", "run_id": run_id, "status": "failed"}

    # Create run record
    run = AgentRun(
        run_id=run_id,
        agent_id=agent_id,
        user_id=user_id,
        task_id=task_id,
        input_text=input_text,
        status="running",
    )
    async with async_session() as session:
        session.add(run)
        await session.commit()

    # Notify via WebSocket
    await _notify_run(user_id, run_id, agent_id, "started", "Agent execution started...")

    steps: List[Dict[str, Any]] = []
    tools_used: List[str] = []
    ml_models_used: List[str] = []
    total_tokens = 0
    result_text = ""
    error_message = None
    final_result = {}

    try:
        agent_type = agent_data.get("agent_type", "llm")
        agent_tools = agent_data.get("tools", [])
        agent_ml = agent_data.get("ml_models", [])
        workflow_id = agent_data.get("workflow_id")

        if workflow_id:
            # ── Step A: Execute attached workflow ──
            wf = await get_workflow(workflow_id)
            if not wf:
                raise ValueError(f"Workflow {workflow_id} not found.")

            graph = wf.get("graph_json", {})
            nodes = graph.get("nodes", [])
            edges = graph.get("edges", [])

            # Topological sort
            in_degree = {n["id"]: 0 for n in nodes}
            adj = {n["id"]: [] for n in nodes}
            for e in edges:
                src, tgt = e.get("source"), e.get("target")
                if src in adj and tgt in in_degree:
                    adj[src].append(tgt)
                    in_degree[tgt] = in_degree.get(tgt, 0) + 1

            queue = [nid for nid, deg in in_degree.items() if deg == 0]
            order = []
            while queue:
                nid = queue.pop(0)
                order.append(nid)
                for neighbor in adj.get(nid, []):
                    in_degree[neighbor] -= 1
                    if in_degree[neighbor] == 0:
                        queue.append(neighbor)

            intermediate_results = {}
            for i, node_id in enumerate(order):
                node_data = next((n for n in nodes if n["id"] == node_id), None)
                if not node_data:
                    continue

                node_agent_type = node_data.get("data", {}).get("type", "unknown")
                if node_agent_type == "unknown":
                    continue

                step_start = time.perf_counter()
                await _notify_run(user_id, run_id, agent_id, "step_started", f"Executing node: {node_agent_type}...")

                # Execute using dynamic orchestrator logic
                try:
                    result = await run_orchestrator_step(
                        agent_type=node_agent_type,
                        task_input=input_text,
                        task_id=run_id,
                        step_index=i + 1,
                        key_queries=[input_text[:120]],
                        intermediate_results=intermediate_results
                    )
                    intermediate_results[node_agent_type] = result
                    final_result[node_agent_type] = result

                    step_duration = round((time.perf_counter() - step_start) * 1000, 1)
                    steps.append({
                        "tool": node_agent_type,
                        "status": "completed",
                        "duration_ms": step_duration,
                        "output_summary": _summarize_ml_output(node_agent_type, result) if "ml_" in node_agent_type else f"{node_agent_type} completed"
                    })
                    tools_used.append(node_agent_type)

                    # Accumulate tokens if LLM was used
                    total_tokens += result.get("tokens_used", 0)

                    await _notify_run(user_id, run_id, agent_id, "step_completed", f"Node {node_agent_type} done", {
                        "tool": node_agent_type,
                        "duration_ms": step_duration,
                    })
                except Exception as exc:
                    step_duration = round((time.perf_counter() - step_start) * 1000, 1)
                    steps.append({
                        "tool": node_agent_type,
                        "status": "failed",
                        "duration_ms": step_duration,
                        "error": str(exc)[:200],
                    })
                    raise ValueError(f"Workflow execution failed at node {node_agent_type}: {str(exc)}")

            # Set result_text based on execution graph
            result_gen = intermediate_results.get("result_generator")
            if result_gen and isinstance(result_gen, dict) and result_gen.get("result_text"):
                result_text = result_gen["result_text"]
            elif intermediate_results.get("reasoning") and isinstance(intermediate_results["reasoning"], dict):
                result_text = intermediate_results["reasoning"].get("analysis", "")
            else:
                result_text = "Workflow executed successfully, but no direct text result was generated."

        else:
            # ── Step B: Standard ML/LLM pipeline ──
            # ── Step B1: ML preprocessing (if agent uses ML tools) ──
            if agent_type in ("ml", "hybrid") or agent_ml:
                ml_results = await _run_ml_steps(
                    input_text, agent_ml, agent_tools, user_id, run_id, agent_id, steps
                )
                ml_models_used = list(ml_results.keys())
                tools_used.extend([f"ml_{m}" for m in ml_models_used])
                final_result["ml_analysis"] = ml_results

            # ── Step B2: Web search (if agent has web_search tool) ──
            if "web_search" in agent_tools:
                search_result = await _run_search_step(
                    input_text, user_id, run_id, agent_id, steps
                )
                tools_used.append("web_search")
                final_result["search_results"] = search_result

            # ── Step B3: Web scraping (if agent has scraper tool) ──
            if "web_scraper" in agent_tools and final_result.get("search_results", {}).get("urls"):
                scrape_result = await _run_scrape_step(
                    final_result["search_results"]["urls"][:3],
                    user_id, run_id, agent_id, steps
                )
                tools_used.append("web_scraper")
                final_result["scraped_data"] = scrape_result

            # ── Step B4: LLM reasoning (if agent uses LLM) ──
            if agent_type in ("llm", "hybrid"):
                llm_result = await _run_llm_step(
                    input_text, agent_data, final_result,
                    user_id, run_id, agent_id, steps
                )
                tools_used.append("llm_analyze")
                total_tokens = llm_result.get("tokens_used", 0)
                result_text = llm_result.get("content", "")
                final_result["llm_response"] = result_text

        # ── Step 5: If ML-only agent, format ML results as text ──
        if agent_type == "ml" and not result_text:
            result_text = _format_ml_results(final_result.get("ml_analysis", {}), input_text)

        if not result_text:
            result_text = "Agent completed but produced no output. Try adjusting the input."

        total_duration = round(time.perf_counter() - start, 2)

        # Update run
        await _update_run(
            run_id,
            status="completed",
            result=final_result,
            result_text=result_text,
            steps=steps,
            tools_used=tools_used,
            ml_models_used=ml_models_used,
            tokens_used=total_tokens,
            total_duration=total_duration,
        )

        # Update agent stats
        await _update_agent_stats(agent_id, success=True, latency_ms=total_duration * 1000, tokens=total_tokens)

        # ── Trigger Real Billing ──
        try:
            from app.billing.ledger import record_billing_entry
            import uuid
            # Deployed agents have a higher fee
            fee = 0.25 if workflow_id else 0.10
            await record_billing_entry(
                user_id=user_id,
                outcome_id=f"out-{uuid.uuid4().hex[:12]}",
                agent_id=agent_id,
                pricing_model="deployed_fee",
                fee=fee,
            )
        except Exception as e:
            log.warning("Failed to record deployed agent billing entry: %s", e)

        await _notify_run(user_id, run_id, agent_id, "completed", "Agent execution completed!", {
            "duration": total_duration,
            "tools_used": tools_used,
        })

        return {
            "run_id": run_id,
            "agent_id": agent_id,
            "status": "completed",
            "result": final_result,
            "result_text": result_text,
            "steps": steps,
            "tools_used": tools_used,
            "ml_models_used": ml_models_used,
            "tokens_used": total_tokens,
            "total_duration": total_duration,
        }

    except Exception as exc:
        total_duration = round(time.perf_counter() - start, 2)
        error_message = str(exc)[:500]
        log.exception("Agent %s execution failed: %s", agent_id, exc)

        await _update_run(
            run_id,
            status="failed",
            error_message=error_message,
            steps=steps,
            tools_used=tools_used,
            total_duration=total_duration,
        )
        await _update_agent_stats(agent_id, success=False, latency_ms=total_duration * 1000)
        await _notify_run(user_id, run_id, agent_id, "failed", f"Agent failed: {error_message[:200]}")

        return {
            "run_id": run_id,
            "agent_id": agent_id,
            "status": "failed",
            "error": error_message,
            "steps": steps,
            "total_duration": total_duration,
        }


# ==========================================================================
# Execution Steps (ML, Search, Scrape, LLM)
# ==========================================================================

async def _run_ml_steps(
    input_text: str,
    ml_models: List[str],
    tools: List[str],
    user_id: str,
    run_id: str,
    agent_id: str,
    steps: List[Dict],
) -> Dict[str, Any]:
    """Run all requested ML tools on the input."""
    results = {}

    # Determine which ML tools to run
    ml_to_run = set(ml_models)
    for tool in tools:
        if tool.startswith("ml_"):
            ml_to_run.add(tool.replace("ml_", ""))

    # If no specific tools requested, run defaults based on type
    if not ml_to_run:
        ml_to_run = {"sentiment_analysis", "entity_extraction", "keyword_extraction"}

    for ml_name in ml_to_run:
        step_start = time.perf_counter()
        await _notify_run(user_id, run_id, agent_id, "step_started", f"Running ML: {ml_name}...")

        try:
            if ml_name == "sentiment_analysis":
                result = await ml_sentiment_analysis(input_text)
            elif ml_name in ("text_classification", "classify"):
                # Default categories
                result = await ml_classify_text(
                    input_text,
                    ["technology", "science", "business", "health", "entertainment", "sports", "politics"]
                )
            elif ml_name == "entity_extraction":
                result = await ml_extract_entities(input_text)
            elif ml_name == "keyword_extraction":
                result = await ml_extract_keywords(input_text)
            elif ml_name == "extractive_summary":
                result = await ml_extractive_summary(input_text)
            else:
                result = {"skipped": True, "reason": f"Unknown ML model: {ml_name}"}

            results[ml_name] = result
            step_duration = round((time.perf_counter() - step_start) * 1000, 1)
            steps.append({
                "tool": f"ml_{ml_name}",
                "status": "completed" if "error" not in result else "partial",
                "duration_ms": step_duration,
                "output_summary": _summarize_ml_output(ml_name, result),
            })

            await _notify_run(user_id, run_id, agent_id, "step_completed", f"ML {ml_name} done", {
                "tool": ml_name,
                "duration_ms": step_duration,
            })

        except Exception as exc:
            step_duration = round((time.perf_counter() - step_start) * 1000, 1)
            results[ml_name] = {"error": str(exc)[:200]}
            steps.append({
                "tool": f"ml_{ml_name}",
                "status": "failed",
                "duration_ms": step_duration,
                "error": str(exc)[:200],
            })

    return results


async def _run_search_step(
    input_text: str,
    user_id: str,
    run_id: str,
    agent_id: str,
    steps: List[Dict],
) -> Dict[str, Any]:
    """Run web search on the input."""
    step_start = time.perf_counter()
    await _notify_run(user_id, run_id, agent_id, "step_started", "Searching the web...")

    try:
        result = await web_search(query=input_text[:200], num_results=8)
        urls = [r.get("link", "") for r in result.get("results", []) if r.get("link")]
        result["urls"] = urls
        step_duration = round((time.perf_counter() - step_start) * 1000, 1)

        steps.append({
            "tool": "web_search",
            "status": "completed",
            "duration_ms": step_duration,
            "output_summary": f"{len(result.get('results', []))} results found",
        })

        await _notify_run(user_id, run_id, agent_id, "step_completed", f"Found {len(urls)} results", {
            "tool": "web_search",
            "result_count": len(urls),
        })

        return result
    except Exception as exc:
        step_duration = round((time.perf_counter() - step_start) * 1000, 1)
        steps.append({
            "tool": "web_search",
            "status": "failed",
            "duration_ms": step_duration,
            "error": str(exc)[:200],
        })
        return {"results": [], "error": str(exc)[:200]}


async def _run_scrape_step(
    urls: List[str],
    user_id: str,
    run_id: str,
    agent_id: str,
    steps: List[Dict],
) -> List[Dict[str, Any]]:
    """Scrape content from URLs."""
    step_start = time.perf_counter()
    await _notify_run(user_id, run_id, agent_id, "step_started", f"Scraping {len(urls)} pages...")

    scraped = []
    for url in urls[:3]:
        try:
            content = await web_scrape(url)
            if content and not content.get("error"):
                scraped.append(content)
        except Exception:
            pass

    step_duration = round((time.perf_counter() - step_start) * 1000, 1)
    steps.append({
        "tool": "web_scraper",
        "status": "completed" if scraped else "partial",
        "duration_ms": step_duration,
        "output_summary": f"Scraped {len(scraped)}/{len(urls)} pages",
    })

    return scraped


async def _run_llm_step(
    input_text: str,
    agent_data: Dict[str, Any],
    context: Dict[str, Any],
    user_id: str,
    run_id: str,
    agent_id: str,
    steps: List[Dict],
) -> Dict[str, Any]:
    """Run LLM analysis with the agent's system prompt and accumulated context."""
    step_start = time.perf_counter()
    await _notify_run(user_id, run_id, agent_id, "step_started", "AI reasoning...")

    # Build context prompt from previous steps
    context_parts = []
    if context.get("ml_analysis"):
        context_parts.append("ML Analysis Results:")
        for ml_name, ml_result in context["ml_analysis"].items():
            if not isinstance(ml_result, dict) or ml_result.get("skipped"):
                continue
            context_parts.append(f"  {ml_name}: {_summarize_ml_output(ml_name, ml_result)}")

    if context.get("search_results", {}).get("results"):
        context_parts.append("\nWeb Search Results:")
        for r in context["search_results"]["results"][:5]:
            context_parts.append(f"  - {r.get('title', '')}: {r.get('snippet', '')}")

    if context.get("scraped_data"):
        context_parts.append("\nScraped Page Content:")
        for s in context["scraped_data"][:2]:
            text = s.get("text", s.get("content", ""))[:500]
            context_parts.append(f"  {text}")

    context_text = "\n".join(context_parts)

    # Build the prompt
    system_prompt = agent_data.get("system_prompt") or "You are a helpful AI assistant. Analyze the provided data and respond clearly and comprehensively."
    config = agent_data.get("config", {})

    full_prompt = f"User Request: {input_text}"
    if context_text:
        full_prompt += f"\n\nAvailable Data:\n{context_text}"
    full_prompt += "\n\nProvide a comprehensive, well-structured response."

    result = await llm_analyze(
        prompt=full_prompt,
        system_prompt=system_prompt,
        max_tokens=config.get("max_tokens", 2048),
        temperature=config.get("temperature", 0.3),
    )

    step_duration = round((time.perf_counter() - step_start) * 1000, 1)
    steps.append({
        "tool": "llm_analyze",
        "status": "completed" if not result.get("error") else "failed",
        "duration_ms": step_duration,
        "output_summary": f"Generated {len(result.get('content', ''))} chars, {result.get('tokens_used', 0)} tokens",
        "error": result.get("error"),
    })

    await _notify_run(user_id, run_id, agent_id, "step_completed", "AI reasoning complete", {
        "tool": "llm_analyze",
        "tokens": result.get("tokens_used", 0),
    })

    return result


# ==========================================================================
# Helpers
# ==========================================================================

def _format_ml_results(ml_analysis: Dict[str, Any], input_text: str) -> str:
    """Format ML analysis results as readable text for ML-only agents."""
    parts = [f"Analysis of: \"{input_text[:100]}...\"\n"]

    if "sentiment_analysis" in ml_analysis:
        sa = ml_analysis["sentiment_analysis"]
        parts.append(f"📊 Sentiment: {sa.get('sentiment', 'unknown')} (confidence: {sa.get('confidence', 0):.1%})")

    if "text_classification" in ml_analysis:
        tc = ml_analysis["text_classification"]
        parts.append(f"🏷️ Category: {tc.get('category', 'unknown')} (confidence: {tc.get('confidence', 0):.1%})")

    if "entity_extraction" in ml_analysis:
        ee = ml_analysis["entity_extraction"]
        entities = ee.get("entities", [])
        if entities:
            parts.append(f"🔍 Entities found ({len(entities)}):")
            for e in entities[:10]:
                parts.append(f"  • {e['type']}: {e['value']}")

    if "keyword_extraction" in ml_analysis:
        ke = ml_analysis["keyword_extraction"]
        keywords = ke.get("keywords", [])
        if keywords:
            parts.append(f"🔑 Keywords: {', '.join(k['keyword'] for k in keywords[:8])}")

    if "extractive_summary" in ml_analysis:
        es = ml_analysis["extractive_summary"]
        if es.get("summary"):
            parts.append(f"📝 Summary: {es['summary']}")

    return "\n".join(parts)


def _summarize_ml_output(ml_name: str, result: Dict[str, Any]) -> str:
    """Create compact summary of ML output."""
    if result.get("error"):
        return f"error: {result['error'][:100]}"
    if ml_name == "sentiment_analysis":
        return f"sentiment={result.get('sentiment')} conf={result.get('confidence', 0):.2f}"
    if ml_name in ("text_classification", "classify"):
        return f"category={result.get('category')} conf={result.get('confidence', 0):.2f}"
    if ml_name == "entity_extraction":
        return f"entities={result.get('count', 0)} types={result.get('types_found', [])}"
    if ml_name == "keyword_extraction":
        kws = result.get("keywords", [])
        return f"keywords={len(kws)}: {', '.join(k['keyword'] for k in kws[:3])}"
    if ml_name == "extractive_summary":
        return f"summary_len={len(result.get('summary', ''))}"
    return f"keys={list(result.keys())[:4]}"


def _serialize_agent(agent: DeployableAgent) -> Dict[str, Any]:
    """Convert agent ORM object to dict."""
    return {
        "agent_id": agent.agent_id,
        "owner_id": agent.owner_id,
        "name": agent.name,
        "description": agent.description,
        "agent_type": agent.agent_type,
        "visibility": agent.visibility,
        "status": agent.status,
        "capabilities": agent.capabilities or [],
        "ml_models": agent.ml_models or [],
        "llm_provider": agent.llm_provider,
        "llm_model": agent.llm_model,
        "system_prompt": agent.system_prompt,
        "tools": agent.tools or [],
        "config": agent.config or {},
        "total_runs": agent.total_runs,
        "successful_runs": agent.successful_runs,
        "failed_runs": agent.failed_runs,
        "avg_latency_ms": agent.avg_latency_ms,
        "total_tokens_used": agent.total_tokens_used,
        "tags": agent.tags or [],
        "icon": agent.icon,
        "category": agent.category,
        "workflow_id": agent.workflow_id,
        "success_rate": round(agent.successful_runs / max(agent.total_runs, 1) * 100, 1),
        "created_at": agent.created_at.isoformat() if agent.created_at else None,
        "updated_at": agent.updated_at.isoformat() if agent.updated_at else None,
    }


async def _update_run(run_id: str, **kwargs) -> None:
    """Update an agent run record."""
    try:
        async with async_session() as session:
            result = await session.execute(
                select(AgentRun).where(AgentRun.run_id == run_id)
            )
            run = result.scalar_one_or_none()
            if run:
                for key, value in kwargs.items():
                    if hasattr(run, key):
                        setattr(run, key, value)
                if kwargs.get("status") in ("completed", "failed"):
                    run.completed_at = datetime.now(timezone.utc)
                await session.commit()
    except Exception as exc:
        log.warning("Failed to update run %s: %s", run_id, exc)


async def _update_agent_stats(agent_id: str, success: bool, latency_ms: float, tokens: int = 0) -> None:
    """Update agent execution stats after a run."""
    try:
        async with async_session() as session:
            result = await session.execute(
                select(DeployableAgent).where(DeployableAgent.agent_id == agent_id)
            )
            agent = result.scalar_one_or_none()
            if agent:
                agent.total_runs += 1
                if success:
                    agent.successful_runs += 1
                else:
                    agent.failed_runs += 1
                # Running average
                old_avg = agent.avg_latency_ms
                n = agent.total_runs
                agent.avg_latency_ms = round(old_avg + (latency_ms - old_avg) / n, 1)
                agent.total_tokens_used += tokens
                agent.updated_at = datetime.now(timezone.utc)
                await session.commit()
    except Exception as exc:
        log.warning("Failed to update agent stats %s: %s", agent_id, exc)


async def _notify_run(
    user_id: str,
    run_id: str,
    agent_id: str,
    event: str,
    message: str,
    data: Optional[Dict] = None,
) -> None:
    """Send WebSocket notification for agent run progress."""
    try:
        payload = {
            "type": "agent_run_update",
            "run_id": run_id,
            "agent_id": agent_id,
            "event": event,
            "message": message,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }
        if data:
            payload["data"] = data
        await ws_manager.send_to_user(user_id, payload)
    except Exception:
        pass


# ==========================================================================
# Agent Runs — list/get
# ==========================================================================

async def list_agent_runs(
    user_id: str,
    agent_id: Optional[str] = None,
    limit: int = 20,
) -> List[Dict[str, Any]]:
    """List runs for a user, optionally filtered by agent."""
    async with async_session() as session:
        query = (
            select(AgentRun)
            .where(AgentRun.user_id == user_id)
            .order_by(AgentRun.created_at.desc())
            .limit(min(limit, 100))
        )
        if agent_id:
            query = query.where(AgentRun.agent_id == agent_id)
        result = await session.execute(query)
        runs = result.scalars().all()

    return [
        {
            "run_id": r.run_id,
            "agent_id": r.agent_id,
            "input": r.input_text[:200],
            "status": r.status,
            "result_text": (r.result_text or "")[:300],
            "steps": r.steps or [],
            "tools_used": r.tools_used or [],
            "ml_models_used": r.ml_models_used or [],
            "tokens_used": r.tokens_used,
            "total_duration": r.total_duration,
            "error_message": r.error_message,
            "created_at": r.created_at.isoformat() if r.created_at else None,
            "completed_at": r.completed_at.isoformat() if r.completed_at else None,
        }
        for r in runs
    ]


async def get_agent_run(run_id: str) -> Optional[Dict[str, Any]]:
    """Get a single run with full details."""
    async with async_session() as session:
        result = await session.execute(
            select(AgentRun).where(AgentRun.run_id == run_id)
        )
        run = result.scalar_one_or_none()

    if not run:
        return None

    return {
        "run_id": run.run_id,
        "agent_id": run.agent_id,
        "user_id": run.user_id,
        "task_id": run.task_id,
        "input": run.input_text,
        "status": run.status,
        "result": run.result,
        "result_text": run.result_text,
        "error_message": run.error_message,
        "steps": run.steps or [],
        "tools_used": run.tools_used or [],
        "ml_models_used": run.ml_models_used or [],
        "tokens_used": run.tokens_used,
        "total_duration": run.total_duration,
        "created_at": run.created_at.isoformat() if run.created_at else None,
        "completed_at": run.completed_at.isoformat() if run.completed_at else None,
    }


# ==========================================================================
# Seed Default Agents
# ==========================================================================

async def seed_default_agents() -> None:
    """Seed the platform with default AI agents."""
    async with async_session() as session:
        result = await session.execute(
            select(func.count()).select_from(DeployableAgent)
        )
        count = result.scalar()
        if count and count > 0:
            return  # Already seeded

    defaults = [
        {
            "name": "Research Assistant",
            "description": "Search the web, analyze data, and produce comprehensive research reports on any topic.",
            "agent_type": "hybrid",
            "capabilities": ["research", "analysis", "summarization"],
            "ml_models": ["sentiment_analysis", "keyword_extraction", "extractive_summary"],
            "tools": ["web_search", "web_scraper", "ml_sentiment_analysis", "ml_keyword_extraction"],
            "system_prompt": "You are an expert research assistant. Analyze all provided data thoroughly and produce well-structured, comprehensive reports with clear sections, key findings, and actionable insights.",
            "tags": ["research", "analysis", "reports"],
            "icon": "🔬",
            "category": "research",
        },
        {
            "name": "Product Finder",
            "description": "Find and compare products across the web. Get the best deals with price comparisons and reviews.",
            "agent_type": "hybrid",
            "capabilities": ["product_search", "price_comparison", "review_analysis"],
            "ml_models": ["sentiment_analysis", "entity_extraction"],
            "tools": ["web_search", "web_scraper", "ml_sentiment_analysis", "ml_entity_extraction"],
            "system_prompt": "You are a product comparison expert. Search for products, compare prices, analyze reviews, and recommend the best options. Always include prices, vendor info, and pros/cons.",
            "tags": ["shopping", "deals", "comparison"],
            "icon": "🛒",
            "category": "commerce",
        },
        {
            "name": "Text Analyzer (ML-Only)",
            "description": "Pure ML analysis — sentiment, entities, keywords, and classification. No LLM, all on-device ML.",
            "agent_type": "ml",
            "capabilities": ["sentiment", "entities", "keywords", "classification"],
            "ml_models": ["sentiment_analysis", "entity_extraction", "keyword_extraction", "text_classification"],
            "tools": ["ml_sentiment_analysis", "ml_entity_extraction", "ml_keyword_extraction", "ml_text_classification"],
            "tags": ["ml", "analysis", "nlp"],
            "icon": "🧪",
            "category": "analysis",
        },
        {
            "name": "Code Explainer",
            "description": "Explain code, debug errors, and suggest improvements. Supports multiple programming languages.",
            "agent_type": "llm",
            "capabilities": ["code_explanation", "debugging", "code_review"],
            "ml_models": [],
            "tools": [],
            "system_prompt": "You are an expert software engineer. Explain code clearly, identify bugs, suggest improvements, and provide best practices. Use code blocks and clear formatting.",
            "tags": ["coding", "development", "debugging"],
            "icon": "💻",
            "category": "coding",
        },
        {
            "name": "News Summarizer",
            "description": "Search for the latest news on any topic and provide concise summaries with key points.",
            "agent_type": "hybrid",
            "capabilities": ["news", "summarization", "trending"],
            "ml_models": ["sentiment_analysis", "keyword_extraction", "extractive_summary"],
            "tools": ["web_search", "ml_sentiment_analysis", "ml_keyword_extraction", "ml_extractive_summary"],
            "system_prompt": "You are a news analyst. Search for the latest news, summarize key developments, analyze sentiment and trends, and present findings in a clear, journalistic style.",
            "tags": ["news", "trending", "summary"],
            "icon": "📰",
            "category": "research",
        },
        {
            "name": "Creative Writer",
            "description": "Generate creative content — stories, poems, marketing copy, blog posts, and more.",
            "agent_type": "llm",
            "capabilities": ["creative_writing", "copywriting", "storytelling"],
            "ml_models": [],
            "tools": [],
            "system_prompt": "You are a talented creative writer. Generate engaging, original content based on the user's request. Match the tone, style, and format they need.",
            "config": {"temperature": 0.8, "max_tokens": 3000},
            "tags": ["creative", "writing", "content"],
            "icon": "✍️",
            "category": "creative",
        },
    ]

    for default in defaults:
        try:
            await create_agent(
                owner_id="system",
                name=default["name"],
                description=default["description"],
                agent_type=default["agent_type"],
                visibility="public",
                capabilities=default.get("capabilities", []),
                ml_models=default.get("ml_models", []),
                tools=default.get("tools", []),
                system_prompt=default.get("system_prompt"),
                config=default.get("config", {}),
                tags=default.get("tags", []),
                icon=default.get("icon"),
                category=default.get("category"),
            )
        except Exception as exc:
            log.warning("Failed to seed agent '%s': %s", default["name"], exc)

    log.info("Seeded %d default agents", len(defaults))
