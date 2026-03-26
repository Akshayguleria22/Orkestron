"""
Data Extraction Agent — scrapes web pages and extracts structured content.

Uses the web_scraper tool to fetch pages and pull out relevant information.
"""

import logging
import time
import uuid
from typing import Any, Dict, List

from app.models.db import AgentExecutionLog, async_session
from app.tools.web_scraper import web_scrape

log = logging.getLogger(__name__)


async def run_data_extraction(
    urls: List[str],
    task_context: str = "",
    task_id: str = "",
    step_index: int = 0,
) -> Dict[str, Any]:
    """
    Scrape multiple URLs and extract structured content.
    Returns combined extracted data.
    """
    start = time.perf_counter()
    agent_log_id = f"al-{uuid.uuid4().hex[:12]}"
    extracted: List[Dict[str, Any]] = []

    for url in urls[:5]:  # Max 5 URLs
        try:
            page_data = await web_scrape(
                url=url,
                max_chars=6000,
                task_id=task_id,
                agent_log_id=agent_log_id,
            )

            if not page_data.get("error"):
                extracted.append({
                    "url": url,
                    "title": page_data.get("title", ""),
                    "description": page_data.get("description", ""),
                    "content": page_data.get("content", ""),
                    "headings": page_data.get("headings", []),
                    "content_length": page_data.get("content_length", 0),
                })
            else:
                extracted.append({
                    "url": url,
                    "error": page_data["error"],
                    "content": "",
                })

        except Exception as exc:
            log.warning("Extraction failed for %s: %s", url, exc)
            extracted.append({
                "url": url,
                "error": str(exc),
                "content": "",
            })

    elapsed_ms = (time.perf_counter() - start) * 1000
    successful = [e for e in extracted if not e.get("error")]

    output = {
        "extracted": extracted,
        "successful_count": len(successful),
        "total_content_length": sum(e.get("content_length", 0) for e in successful),
    }

    log_entry = AgentExecutionLog(
        log_id=agent_log_id,
        task_id=task_id,
        agent_name="data_extraction_agent",
        agent_type="data_extraction",
        step_index=step_index,
        input_data={"urls": urls[:5], "context": task_context[:200]},
        output_data={"extracted_count": len(successful), "total_urls": len(urls[:5])},
        status="success" if successful else "error",
        latency_ms=elapsed_ms,
        tools_used=["web_scrape"],
    )
    try:
        async with async_session() as session:
            session.add(log_entry)
            await session.commit()
    except Exception as exc:
        log.warning("Failed to log data extraction agent: %s", exc)

    log.info("Data extraction: %d/%d pages scraped in %.0fms",
             len(successful), len(urls[:5]), elapsed_ms)

    return output
