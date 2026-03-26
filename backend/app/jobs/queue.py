"""Redis-backed task queue setup for asynchronous task execution."""

from redis import Redis
from rq import Queue

from app.config import settings

TASK_QUEUE_NAME = "orkestron-tasks"


def get_redis_connection() -> Redis:
    """Create a Redis connection from configured URL."""
    return Redis.from_url(settings.redis_url)


def get_task_queue() -> Queue:
    """Return the queue used for async task execution jobs."""
    return Queue(name=TASK_QUEUE_NAME, connection=get_redis_connection(), default_timeout=1800)


def enqueue_real_task_job(task_id: str, user_id: str, task_input: str) -> str:
    """Enqueue a real task for worker-side execution and return queue job id."""
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
