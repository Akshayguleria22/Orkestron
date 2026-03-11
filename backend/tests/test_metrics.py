"""
Tests for the observability metrics module.
"""

from app.observability.metrics import (
    AGENT_TASKS_TOTAL,
    AGENT_EXECUTION_TIME,
    SUCCESSFUL_OUTCOMES_TOTAL,
    FAILED_WORKFLOWS_TOTAL,
    BILLING_EVENTS_TOTAL,
    PLUGIN_EXECUTIONS_TOTAL,
    CACHE_HITS_TOTAL,
    CACHE_MISSES_TOTAL,
    HTTP_REQUESTS_TOTAL,
    HTTP_REQUEST_DURATION,
    get_metrics,
    get_metrics_content_type,
)


def test_metrics_counters_exist():
    """All expected counters are importable and have correct names."""
    assert "agent_tasks" in AGENT_TASKS_TOTAL._name
    assert "successful_outcomes" in SUCCESSFUL_OUTCOMES_TOTAL._name
    assert "failed_workflows" in FAILED_WORKFLOWS_TOTAL._name
    assert "billing_events" in BILLING_EVENTS_TOTAL._name
    assert "plugin_executions" in PLUGIN_EXECUTIONS_TOTAL._name
    assert "cache_hits" in CACHE_HITS_TOTAL._name
    assert "cache_misses" in CACHE_MISSES_TOTAL._name
    assert "http_requests" in HTTP_REQUESTS_TOTAL._name


def test_metrics_histograms_exist():
    """Histogram metrics are importable and have correct names."""
    assert AGENT_EXECUTION_TIME._name == "agent_execution_time"
    assert HTTP_REQUEST_DURATION._name == "http_request_duration_seconds"


def test_counter_increment():
    """Counters can be incremented without error."""
    AGENT_TASKS_TOTAL.labels(intent="purchase").inc()
    SUCCESSFUL_OUTCOMES_TOTAL.inc()
    FAILED_WORKFLOWS_TOTAL.labels(error_type="execution").inc()
    BILLING_EVENTS_TOTAL.labels(pricing_model="flat").inc()
    PLUGIN_EXECUTIONS_TOTAL.labels(plugin_name="test", status="ok").inc()
    CACHE_HITS_TOTAL.inc()
    CACHE_MISSES_TOTAL.inc()
    HTTP_REQUESTS_TOTAL.labels(method="GET", endpoint="/health", status="200").inc()


def test_histogram_observe():
    """Histograms accept observations without error."""
    AGENT_EXECUTION_TIME.labels(intent="purchase").observe(1.5)
    HTTP_REQUEST_DURATION.labels(method="POST", endpoint="/task").observe(0.25)


def test_get_metrics_returns_bytes():
    """get_metrics() returns a bytes payload."""
    data = get_metrics()
    assert isinstance(data, bytes)
    assert b"agent_tasks_total" in data


def test_get_metrics_content_type():
    """Content type is set for Prometheus scraping."""
    ct = get_metrics_content_type()
    assert "text/plain" in ct or "text/openmetrics" in ct or "application/openmetrics" in ct
