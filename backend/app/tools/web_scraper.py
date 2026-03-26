"""
Web Scraper Tool — extracts content from web pages.

Uses httpx + BeautifulSoup for HTML parsing.
Extracts text content, headings, and structured data.
"""

import logging
import re
import time
import uuid
from typing import Any, Dict, List, Optional
from urllib.parse import urlparse

import httpx
from bs4 import BeautifulSoup

from app.models.db import ToolCallLog, async_session

log = logging.getLogger(__name__)

# Safety: block private/internal IPs to prevent SSRF
_BLOCKED_HOSTS = {"localhost", "127.0.0.1", "0.0.0.0", "::1", "169.254.169.254"}


def _is_safe_url(url: str) -> bool:
    """Check that the URL is a public HTTP(S) URL (SSRF prevention)."""
    try:
        parsed = urlparse(url)
        if parsed.scheme not in ("http", "https"):
            return False
        hostname = parsed.hostname or ""
        if hostname in _BLOCKED_HOSTS:
            return False
        # Block private IP ranges
        if hostname.startswith(("10.", "192.168.", "172.")):
            return False
        return True
    except Exception:
        return False


async def _log_tool_call(
    task_id: str,
    agent_log_id: str,
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
        tool_name="web_scrape",
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


async def web_scrape(
    url: str,
    max_chars: int = 8000,
    task_id: str = "",
    agent_log_id: str = "",
) -> Dict[str, Any]:
    """
    Scrape a web page and extract structured text content.
    Returns title, text content, headings, and metadata.
    """
    start = time.perf_counter()

    if not _is_safe_url(url):
        error_msg = f"URL blocked for security: {url}"
        if task_id:
            await _log_tool_call(task_id, agent_log_id, {"url": url}, {}, "error", 0, error_msg)
        return {"url": url, "error": error_msg, "content": ""}

    try:
        headers = {
            "User-Agent": "Mozilla/5.0 (compatible; Orkestron/1.0; +https://orkestron.ai)",
            "Accept": "text/html,application/xhtml+xml",
        }

        async with httpx.AsyncClient(timeout=15.0, follow_redirects=True, max_redirects=3) as client:
            resp = await client.get(url, headers=headers)
            resp.raise_for_status()

        soup = BeautifulSoup(resp.text, "lxml")

        # Remove script, style, nav, footer elements
        for tag in soup(["script", "style", "nav", "footer", "header", "aside", "noscript"]):
            tag.decompose()

        title = soup.title.string.strip() if soup.title and soup.title.string else ""

        # Extract headings
        headings: List[str] = []
        for h in soup.find_all(["h1", "h2", "h3"]):
            text = h.get_text(strip=True)
            if text:
                headings.append(text)

        # Extract main text content
        # Try to find main content area first
        main_content = soup.find("main") or soup.find("article") or soup.find("body")
        if main_content:
            paragraphs = main_content.find_all(["p", "li", "td", "th", "div"])
        else:
            paragraphs = soup.find_all(["p", "li"])

        text_parts: List[str] = []
        seen: set = set()
        for p in paragraphs:
            text = p.get_text(strip=True)
            # Filter noise
            if text and len(text) > 20 and text not in seen:
                seen.add(text)
                text_parts.append(text)

        full_text = "\n\n".join(text_parts)
        if len(full_text) > max_chars:
            full_text = full_text[:max_chars] + "..."

        # Extract meta description
        meta_desc = ""
        meta_tag = soup.find("meta", attrs={"name": "description"})
        if meta_tag and meta_tag.get("content"):
            meta_desc = meta_tag["content"]

        output = {
            "url": url,
            "title": title,
            "description": meta_desc,
            "headings": headings[:20],
            "content": full_text,
            "content_length": len(full_text),
        }

        elapsed = (time.perf_counter() - start) * 1000
        if task_id:
            await _log_tool_call(task_id, agent_log_id, {"url": url}, {"title": title, "length": len(full_text)}, "success", elapsed)

        log.info("Scraped %s: %d chars in %.0fms", url, len(full_text), elapsed)
        return output

    except Exception as exc:
        elapsed = (time.perf_counter() - start) * 1000
        error_msg = str(exc)
        if task_id:
            await _log_tool_call(task_id, agent_log_id, {"url": url}, {}, "error", elapsed, error_msg)
        log.error("Scrape failed for %s: %s", url, exc)
        return {"url": url, "error": error_msg, "content": ""}
