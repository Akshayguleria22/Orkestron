"""
Structured Logging — JSON-formatted log entries for Loki integration.

Provides a pre-configured logger that outputs structured JSON lines
containing user_id, agent_id, workflow_id, task_type, and status fields.
Compatible with Loki + Promtail for centralized log aggregation.
"""

import json
import logging
import sys
import uuid
from datetime import datetime, timezone
from typing import Optional


class StructuredFormatter(logging.Formatter):
    """JSON log formatter with Orkestron context fields."""

    def format(self, record: logging.LogRecord) -> str:
        entry = {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
        }

        # Attach Orkestron context fields if present
        for field in ("user_id", "agent_id", "workflow_id", "task_type", "status"):
            value = getattr(record, field, None)
            if value is not None:
                entry[field] = value

        if record.exc_info and record.exc_info[0] is not None:
            entry["exception"] = self.formatException(record.exc_info)

        return json.dumps(entry, default=str)


def setup_logging(level: str = "INFO") -> None:
    """
    Configure the root logger with structured JSON output.
    Call once at application startup.
    """
    root = logging.getLogger()
    root.setLevel(getattr(logging, level.upper(), logging.INFO))

    # Remove existing handlers to avoid duplicates
    for handler in root.handlers[:]:
        root.removeHandler(handler)

    handler = logging.StreamHandler(sys.stdout)
    handler.setFormatter(StructuredFormatter())
    root.addHandler(handler)

    # Quiet noisy libraries
    logging.getLogger("uvicorn.access").setLevel(logging.WARNING)
    logging.getLogger("httpx").setLevel(logging.WARNING)
    logging.getLogger("httpcore").setLevel(logging.WARNING)


def get_logger(name: str) -> logging.Logger:
    """Return a named logger (uses the structured formatter)."""
    return logging.getLogger(name)


def log_workflow_event(
    logger: logging.Logger,
    message: str,
    *,
    user_id: str = "",
    agent_id: str = "",
    workflow_id: Optional[str] = None,
    task_type: str = "",
    status: str = "",
    level: int = logging.INFO,
) -> str:
    """
    Emit a structured workflow log entry.
    Returns the workflow_id (generated if not provided).
    """
    if workflow_id is None:
        workflow_id = str(uuid.uuid4())

    logger.log(
        level,
        message,
        extra={
            "user_id": user_id,
            "agent_id": agent_id,
            "workflow_id": workflow_id,
            "task_type": task_type,
            "status": status,
        },
    )
    return workflow_id
