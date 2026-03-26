"""RQ worker bootstrap for Orkestron queued task processing."""

from rq import SimpleWorker
from rq.timeouts import TimerDeathPenalty

from app.jobs.queue import TASK_QUEUE_NAME, get_redis_connection
from app.observability.logger import setup_logging


def run_worker() -> None:
    """Start a worker bound to the task queue.

    SimpleWorker is used for Windows compatibility (no os.fork()).
    """
    setup_logging()
    connection = get_redis_connection()
    SimpleWorker.death_penalty_class = TimerDeathPenalty
    worker = SimpleWorker([TASK_QUEUE_NAME], connection=connection)
    worker.work(with_scheduler=True)


if __name__ == "__main__":
    run_worker()
