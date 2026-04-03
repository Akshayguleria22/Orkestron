"""Redis-backed task queue setup for asynchronous task execution."""

import logging
import sys

from app.config import settings

log = logging.getLogger(__name__)

TASK_QUEUE_NAME = "orkestron-tasks"

# On Windows, force multiprocessing to use 'spawn' context to avoid fork errors
if sys.platform == "win32":
    import multiprocessing
    try:
        multiprocessing.set_start_method("spawn", force=True)
    except RuntimeError:
        pass  # Already set


def get_redis_connection():
    """Create a Redis connection from configured URL."""
    from redis import Redis
    return Redis.from_url(settings.redis_url)


def get_task_queue():
    """Return the queue used for async task execution jobs."""
    from rq import Queue
    return Queue(name=TASK_QUEUE_NAME, connection=get_redis_connection(), default_timeout=1800)


def has_active_task_worker() -> bool:
    """Return True when at least one healthy worker is listening on the task queue."""
    try:
        from rq import Worker

        workers = Worker.all(connection=get_redis_connection())
        for worker in workers:
            queue_names: set[str] = set()

            try:
                queue_names = set(worker.queue_names())
            except Exception:
                queue_names = {
                    q.name
                    for q in getattr(worker, "queues", [])
                    if getattr(q, "name", "")
                }

            if TASK_QUEUE_NAME not in queue_names:
                continue

            try:
                state = (worker.get_state() or "").lower()
            except Exception:
                state = str(getattr(worker, "state", "")).lower()

            if state in {"idle", "busy"}:
                return True

    except Exception as exc:
        log.warning("Failed to inspect RQ workers: %s", exc)

    return False


def enqueue_real_task_job(task_id: str, user_id: str, task_input: str) -> str:
    """Enqueue a real task for worker-side execution and return queue job id."""
    if not has_active_task_worker():
        raise RuntimeError(f"No active RQ worker found for queue '{TASK_QUEUE_NAME}'")

    queue = get_task_queue()
    job = queue.enqueue(
        "app.jobs.task_worker.run_real_task_job",
        task_id=task_id,
        user_id=user_id,
        task_input=task_input,
        job_id=f"real-task-{task_id}",
        result_ttl=3600,
        failure_ttl=86400,
    )
    return job.id
