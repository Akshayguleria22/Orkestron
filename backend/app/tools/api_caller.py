"""
API Caller Tool — makes external HTTP API requests.

Generic tool for calling REST APIs with structured input/output.
Supports GET, POST with JSON bodies. Includes SSRF protection.
"""

import logging
import time
import uuid
from typing import Any, Dict, Optional
from urllib.parse import urlparse

import httpx

from app.models.db import ToolCallLog, async_session

log = logging.getLogger(__name__)

_BLOCKED_HOSTS = {"localhost", "127.0.0.1", "0.0.0.0", "::1", "169.254.169.254"}


def _is_safe_url(url: str) -> bool:
    try:
        parsed = urlparse(url)
        if parsed.scheme not in ("http", "https"):
            return False
        hostname = parsed.hostname or ""
        if hostname in _BLOCKED_HOSTS:
            return False
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
        tool_name="api_call",
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


async def api_call(
    url: str,
    method: str = "GET",
    headers: Optional[Dict[str, str]] = None,
    body: Optional[Dict[str, Any]] = None,
    timeout: float = 15.0,
    task_id: str = "",
    agent_log_id: str = "",
) -> Dict[str, Any]:
    """
    Make an HTTP request to an external API.
    Returns status code, headers, and parsed JSON body.
    """
    start = time.perf_counter()
    method = method.upper()

    if method not in ("GET", "POST"):
        return {"error": f"Unsupported method: {method}", "status_code": 0}

    if not _is_safe_url(url):
        error_msg = f"URL blocked for security: {url}"
        if task_id:
            await _log_tool_call(task_id, agent_log_id, {"url": url, "method": method}, {}, "error", 0, error_msg)
        return {"error": error_msg, "status_code": 0}

    try:
        req_headers = {
            "User-Agent": "Orkestron/1.0",
            "Accept": "application/json",
        }
        if headers:
            req_headers.update(headers)

        async with httpx.AsyncClient(timeout=timeout, follow_redirects=True, max_redirects=3) as client:
            if method == "GET":
                resp = await client.get(url, headers=req_headers)
            else:
                resp = await client.post(url, headers=req_headers, json=body or {})

        elapsed = (time.perf_counter() - start) * 1000

        # Parse response
        try:
            resp_data = resp.json()
        except Exception:
            resp_data = {"text": resp.text[:3000]}

        output = {
            "status_code": resp.status_code,
            "data": resp_data,
            "content_type": resp.headers.get("content-type", ""),
        }

        if task_id:
            await _log_tool_call(
                task_id, agent_log_id,
                {"url": url, "method": method},
                {"status_code": resp.status_code},
                "success" if resp.status_code < 400 else "error",
                elapsed,
            )

        log.info("API %s %s → %d in %.0fms", method, url, resp.status_code, elapsed)
        return output

    except Exception as exc:
        elapsed = (time.perf_counter() - start) * 1000
        error_msg = str(exc)
        if task_id:
            await _log_tool_call(task_id, agent_log_id, {"url": url, "method": method}, {}, "error", elapsed, error_msg)
        log.error("API call failed %s %s: %s", method, url, exc)
        return {"error": error_msg, "status_code": 0}
