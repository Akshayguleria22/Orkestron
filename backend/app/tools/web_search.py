"""
Web Search Tool — real web search via Serper.dev API.

Falls back to a Groq-LLM-synthesized answer if no API key is configured.
"""

import logging
import uuid
import time
from typing import Any, Dict, List, Optional
from urllib.parse import parse_qs, quote, urlparse, unquote

import httpx
from bs4 import BeautifulSoup

from app.config import settings
from app.models.db import ToolCallLog, async_session

log = logging.getLogger(__name__)

SERPER_URL = "https://google.serper.dev/search"
SERPAPI_URL = "https://serpapi.com/search.json"


def _has_value(value: str) -> bool:
    return bool((value or "").strip())


def _normalize_result(title: str, link: str, snippet: str, position: int) -> Dict[str, Any]:
    return {
        "title": (title or "").strip(),
        "link": (link or "").strip(),
        "snippet": (snippet or "").strip(),
        "position": position,
    }


def _extract_ddg_target(raw_link: str) -> str:
    if not raw_link:
        return ""
    parsed = urlparse(raw_link)
    query = parse_qs(parsed.query)
    if "uddg" in query and query["uddg"]:
        return unquote(query["uddg"][0])
    return raw_link


async def _search_with_serpapi(query: str, num_results: int) -> List[Dict[str, Any]]:
    if not _has_value(settings.serpapi_api_key):
        return []

    async with httpx.AsyncClient(timeout=15.0) as client:
        resp = await client.get(
            SERPAPI_URL,
            params={
                "engine": "google",
                "q": query,
                "num": num_results,
                "api_key": settings.serpapi_api_key,
            },
        )
        resp.raise_for_status()
        data = resp.json()

    organic = data.get("organic_results", [])
    results: List[Dict[str, Any]] = []
    for idx, item in enumerate(organic[:num_results], start=1):
        results.append(
            _normalize_result(
                title=item.get("title", ""),
                link=item.get("link", ""),
                snippet=item.get("snippet", ""),
                position=int(item.get("position") or idx),
            )
        )
    return results


def _search_with_ddg_library(query: str, num_results: int) -> List[Dict[str, Any]]:
    from duckduckgo_search import DDGS

    output: List[Dict[str, Any]] = []
    with DDGS() as ddgs:
        results = list(ddgs.text(query, max_results=num_results))
        for idx, r in enumerate(results, start=1):
            output.append(
                _normalize_result(
                    title=r.get("title", ""),
                    link=r.get("href", ""),
                    snippet=r.get("body", ""),
                    position=idx,
                )
            )
    return output


async def _search_with_ddg_html(query: str, num_results: int) -> List[Dict[str, Any]]:
    async with httpx.AsyncClient(timeout=15.0, follow_redirects=True) as client:
        resp = await client.post(
            "https://duckduckgo.com/html/",
            data={"q": query},
            headers={"User-Agent": "Mozilla/5.0"},
        )
        resp.raise_for_status()

    soup = BeautifulSoup(resp.text, "lxml")
    nodes = soup.select(".result")
    output: List[Dict[str, Any]] = []
    for idx, node in enumerate(nodes[:num_results], start=1):
        link_el = node.select_one(".result__a")
        if link_el is None:
            continue

        raw_link = link_el.get("href", "")
        link = _extract_ddg_target(raw_link)
        title = link_el.get_text(" ", strip=True)

        snippet_el = node.select_one(".result__snippet")
        snippet = snippet_el.get_text(" ", strip=True) if snippet_el else ""
        output.append(_normalize_result(title=title, link=link, snippet=snippet, position=idx))

    return output


async def _search_with_wikipedia(query: str, num_results: int) -> List[Dict[str, Any]]:
    async with httpx.AsyncClient(timeout=10.0) as client:
        url = (
            "https://en.wikipedia.org/w/api.php"
            f"?action=opensearch&search={quote(query)}&limit={num_results}&namespace=0&format=json"
        )
        resp = await client.get(url)
        resp.raise_for_status()
        data = resp.json()

    output: List[Dict[str, Any]] = []
    if isinstance(data, list) and len(data) >= 4:
        titles, snippets, links = data[1], data[2], data[3]
        for idx, (t, s, l) in enumerate(zip(titles, snippets, links), start=1):
            output.append(
                _normalize_result(
                    title=str(t),
                    link=str(l),
                    snippet=str(s) if s else f"Wikipedia article about {t}",
                    position=idx,
                )
            )
    return output


async def _search_with_bing_rss(query: str, num_results: int) -> List[Dict[str, Any]]:
    async with httpx.AsyncClient(timeout=10.0) as client:
        resp = await client.get(
            f"https://www.bing.com/search?q={quote(query)}&format=rss",
            headers={"User-Agent": "Mozilla/5.0"},
        )
        resp.raise_for_status()

    soup = BeautifulSoup(resp.text, "xml")
    items = soup.find_all("item")
    output: List[Dict[str, Any]] = []
    for idx, item in enumerate(items[:num_results], start=1):
        title = item.title.get_text(" ", strip=True) if item.title else ""
        link = item.link.get_text(" ", strip=True) if item.link else ""
        snippet = item.description.get_text(" ", strip=True) if item.description else ""
        output.append(_normalize_result(title=title, link=link, snippet=snippet, position=idx))
    return output


async def _search_with_ddg_instant_answer(query: str, num_results: int) -> List[Dict[str, Any]]:
    async with httpx.AsyncClient(timeout=10.0) as client:
        resp = await client.get(
            "https://api.duckduckgo.com/",
            params={
                "q": query,
                "format": "json",
                "no_html": "1",
                "skip_disambig": "1",
            },
            headers={"User-Agent": "Mozilla/5.0"},
        )
        resp.raise_for_status()
        data = resp.json()

    output: List[Dict[str, Any]] = []

    abstract_url = data.get("AbstractURL", "")
    abstract_text = data.get("AbstractText", "")
    heading = data.get("Heading", "")
    if abstract_url and abstract_text:
        output.append(
            _normalize_result(
                title=heading or "DuckDuckGo Instant Answer",
                link=abstract_url,
                snippet=abstract_text,
                position=1,
            )
        )

    for topic in data.get("RelatedTopics", []):
        if len(output) >= num_results:
            break

        if isinstance(topic, dict) and "Topics" in topic:
            for nested in topic.get("Topics", []):
                if len(output) >= num_results:
                    break
                if isinstance(nested, dict) and nested.get("FirstURL"):
                    output.append(
                        _normalize_result(
                            title=nested.get("Text", "DuckDuckGo Result")[:120],
                            link=nested.get("FirstURL", ""),
                            snippet=nested.get("Text", ""),
                            position=len(output) + 1,
                        )
                    )
            continue

        if isinstance(topic, dict) and topic.get("FirstURL"):
            output.append(
                _normalize_result(
                    title=topic.get("Text", "DuckDuckGo Result")[:120],
                    link=topic.get("FirstURL", ""),
                    snippet=topic.get("Text", ""),
                    position=len(output) + 1,
                )
            )

    return output[:num_results]


async def _fallback_search_no_serper(query: str, num_results: int) -> tuple[List[Dict[str, Any]], str, str]:
    """Fallback chain when SERPER is unavailable or fails."""
    try:
        ddg_results = _search_with_ddg_library(query, num_results)
        if ddg_results:
            return ddg_results, "duckduckgo", "Using DuckDuckGo fallback search."
    except Exception as exc:
        log.warning("DuckDuckGo text search failed: %s", exc)

    try:
        ddg_html_results = await _search_with_ddg_html(query, num_results)
        if ddg_html_results:
            return ddg_html_results, "duckduckgo_html", "Using DuckDuckGo HTML fallback search."
    except Exception as exc:
        log.warning("DuckDuckGo HTML search failed: %s", exc)

    try:
        bing_rss_results = await _search_with_bing_rss(query, num_results)
        if bing_rss_results:
            return bing_rss_results, "bing_rss", "Using Bing RSS fallback search."
    except Exception as exc:
        log.warning("Bing RSS fallback failed: %s", exc)

    try:
        ddg_api_results = await _search_with_ddg_instant_answer(query, num_results)
        if ddg_api_results:
            return ddg_api_results, "duckduckgo_instant_answer", "Using DuckDuckGo Instant Answer fallback."
    except Exception as exc:
        log.warning("DuckDuckGo Instant Answer fallback failed: %s", exc)

    try:
        wiki_results = await _search_with_wikipedia(query, num_results)
        if wiki_results:
            return wiki_results, "wikipedia", "Using Wikipedia fallback search."
    except Exception as exc:
        log.warning("Wikipedia fallback failed: %s", exc)

    return [], "unavailable", "No search provider available or all providers failed."


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

    if not _has_value(settings.serper_api_key):
        # If Serper is not configured, try SerpAPI first when available.
        if _has_value(settings.serpapi_api_key):
            try:
                results = await _search_with_serpapi(query, num_results)
                result = {
                    "query": query,
                    "results": results,
                    "total_results": len(results),
                    "source": "serpapi",
                    "message": "Using SerpAPI because SERPER_API_KEY is missing.",
                }
                elapsed = (time.perf_counter() - start) * 1000
                if task_id:
                    await _log_tool_call(task_id, agent_log_id, "web_search", {"query": query}, result, "success", elapsed)
                return result
            except Exception as exc:
                log.warning("SerpAPI fallback failed: %s", exc)

        fallback_results, source, message = await _fallback_search_no_serper(query, num_results)
        result = {
            "query": query,
            "results": fallback_results,
            "total_results": len(fallback_results),
            "source": source,
            "message": message,
        }
        elapsed = (time.perf_counter() - start) * 1000
        if task_id:
            await _log_tool_call(
                task_id,
                agent_log_id,
                "web_search",
                {"query": query},
                result,
                "success" if fallback_results else "error",
                elapsed,
                None if fallback_results else message,
            )
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
        # If Serper request fails (invalid key, quota, network), try secondary providers.
        log.warning("Serper request failed, trying fallback providers: %s", exc)
        if _has_value(settings.serpapi_api_key):
            try:
                results = await _search_with_serpapi(query, num_results)
                output = {
                    "query": query,
                    "results": results,
                    "total_results": len(results),
                    "source": "serpapi",
                    "message": "Serper failed; using SerpAPI fallback.",
                }
                elapsed = (time.perf_counter() - start) * 1000
                if task_id:
                    await _log_tool_call(task_id, agent_log_id, "web_search", {"query": query}, output, "success", elapsed)
                return output
            except Exception as serpapi_exc:
                log.warning("SerpAPI fallback failed after Serper failure: %s", serpapi_exc)

        fallback_results, source, message = await _fallback_search_no_serper(query, num_results)
        elapsed = (time.perf_counter() - start) * 1000
        error_msg = f"serper_error={str(exc)}; fallback={message}"
        output = {
            "query": query,
            "results": fallback_results,
            "total_results": len(fallback_results),
            "source": source,
            "error": str(exc),
            "message": message,
        }
        if task_id:
            await _log_tool_call(
                task_id,
                agent_log_id,
                "web_search",
                {"query": query},
                output,
                "success" if fallback_results else "error",
                elapsed,
                None if fallback_results else error_msg,
            )
        if fallback_results:
            return output

        log.error("Web search failed with no fallback results: %s", error_msg)
        return output
