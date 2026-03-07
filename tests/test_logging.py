"""
Tests for the structured logging module.
"""

import json
import logging

from app.observability.logger import (
    StructuredFormatter,
    get_logger,
    log_workflow_event,
    setup_logging,
)


def test_structured_formatter_basic():
    """Formatter produces valid JSON with expected base fields."""
    formatter = StructuredFormatter()
    record = logging.LogRecord(
        name="test",
        level=logging.INFO,
        pathname="test.py",
        lineno=1,
        msg="Hello world",
        args=(),
        exc_info=None,
    )
    output = formatter.format(record)
    data = json.loads(output)
    assert data["message"] == "Hello world"
    assert data["level"] == "INFO"
    assert data["logger"] == "test"
    assert "timestamp" in data


def test_structured_formatter_with_context():
    """Formatter includes Orkestron context fields when present."""
    formatter = StructuredFormatter()
    record = logging.LogRecord(
        name="test",
        level=logging.INFO,
        pathname="test.py",
        lineno=1,
        msg="Task started",
        args=(),
        exc_info=None,
    )
    record.user_id = "user-1"
    record.agent_id = "agent-executor"
    record.workflow_id = "wf-123"
    record.task_type = "purchase"
    record.status = "ok"

    output = formatter.format(record)
    data = json.loads(output)
    assert data["user_id"] == "user-1"
    assert data["agent_id"] == "agent-executor"
    assert data["workflow_id"] == "wf-123"
    assert data["task_type"] == "purchase"
    assert data["status"] == "ok"


def test_get_logger():
    """get_logger returns a named logger."""
    logger = get_logger("test.module")
    assert logger.name == "test.module"


def test_log_workflow_event_returns_workflow_id():
    """log_workflow_event generates a workflow_id if not provided."""
    setup_logging()
    logger = get_logger("test.workflow")
    wf_id = log_workflow_event(
        logger,
        "Test event",
        user_id="u1",
        task_type="info",
        status="ok",
    )
    assert wf_id  # non-empty string
    assert len(wf_id) > 10  # UUID-length


def test_log_workflow_event_preserves_workflow_id():
    """log_workflow_event uses provided workflow_id."""
    setup_logging()
    logger = get_logger("test.workflow2")
    wf_id = log_workflow_event(
        logger,
        "Custom id",
        workflow_id="my-custom-id",
    )
    assert wf_id == "my-custom-id"


def test_setup_logging_no_crash():
    """setup_logging can be called multiple times without error."""
    setup_logging("DEBUG")
    setup_logging("INFO")
    setup_logging("WARNING")
