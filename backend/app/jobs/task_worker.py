"""Worker job handlers for queued task execution."""

import asyncio
import logging
from datetime import datetime, timezone
from typing import Any, Dict, Optional

from sqlalchemy import select

from app.agents.dynamic_orchestrator import execute_real_task
from app.models.db import Task, async_session

log = logging.getLogger(__name__)


def run_real_task_job(
    task_id: str,
    user_id: str,
    task_input: str,
    selected_steps: Optional[list[str]] = None,
) -> Dict[str, Any]:
    """RQ entrypoint to execute a queued real task."""
    return asyncio.run(
        _run_real_task_job_async(
            task_id=task_id,
            user_id=user_id,
            task_input=task_input,
            selected_steps=selected_steps,
        )
    )


async def _run_real_task_job_async(
    task_id: str,
    user_id: str,
    task_input: str,
    selected_steps: Optional[list[str]] = None,
) -> Dict[str, Any]:
    if await _is_task_cancelled(task_id=task_id):
        log.info("worker_task_skipped_cancelled task_id=%s", task_id)
        return {
            "task_id": task_id,
            "status": "cancelled",
            "message": "Task was cancelled before execution",
        }

    await _set_task_status(task_id=task_id, status="running")
    log.info("worker_task_start task_id=%s user_id=%s", task_id, user_id)

    try:
        result = await execute_real_task(
            task_id=task_id,
            user_id=user_id,
            task_input=task_input,
            selected_steps=selected_steps,
        )
        final_status = str(result.get("status") or "completed")
        log.info("worker_task_done task_id=%s status=%s", task_id, final_status)
        return {
            "task_id": task_id,
            "status": final_status,
            "result_text_length": len(str(result.get("text", ""))),
        }
    except Exception as exc:
        log.exception("worker_task_failed task_id=%s error=%s", task_id, exc)
        await _set_task_status(
            task_id=task_id,
            status="failed",
            error_message=str(exc)[:500],
            completed=True,
        )
        return {
            "task_id": task_id,
            "status": "failed",
            "error": str(exc)[:500],
        }


async def _set_task_status(
    task_id: str,
    status: str,
    error_message: Optional[str] = None,
    completed: bool = False,
) -> None:
    """Update task status from worker lifecycle transitions."""
    try:
        async with async_session() as session:
            result = await session.execute(select(Task).where(Task.task_id == task_id))
            task = result.scalar_one_or_none()
            if not task:
                return
            if task.status == "cancelled" and status != "cancelled":
                return
            task.status = status
            if error_message:
                task.error_message = error_message
            if completed:
                task.completed_at = datetime.now(timezone.utc)
            await session.commit()
    except Exception as exc:
        log.warning(
            "worker_status_update_failed task_id=%s status=%s error=%s",
            task_id,
            status,
            exc,
        )


async def _is_task_cancelled(task_id: str) -> bool:
    try:
        async with async_session() as session:
            result = await session.execute(select(Task.status).where(Task.task_id == task_id))
            status = result.scalar_one_or_none()
            return str(status or "").lower() == "cancelled"
    except Exception:
        return False
