"""
Prometheus Metrics — application-level counters and histograms.

Exposes metrics that Prometheus scrapes via GET /metrics.
Import the metric objects from this module and use them in your code.
"""

from prometheus_client import Counter, Histogram, generate_latest, CONTENT_TYPE_LATEST


# ---------------------------------------------------------------------------
# Counters
# ---------------------------------------------------------------------------

AGENT_TASKS_TOTAL = Counter(
    "agent_tasks_total",
    "Total number of agent tasks processed",
    ["intent"],
)

SUCCESSFUL_OUTCOMES_TOTAL = Counter(
    "successful_outcomes_total",
    "Total number of successful workflow outcomes",
)

FAILED_WORKFLOWS_TOTAL = Counter(
    "failed_workflows_total",
    "Total number of failed workflows",
    ["error_type"],
)

BILLING_EVENTS_TOTAL = Counter(
    "billing_events_total",
    "Total number of billing events created",
    ["pricing_model"],
)

PLUGIN_EXECUTIONS_TOTAL = Counter(
    "plugin_executions_total",
    "Total number of plugin executions",
    ["plugin_name", "status"],
)

HTTP_REQUESTS_TOTAL = Counter(
    "http_requests_total",
    "Total HTTP requests",
    ["method", "endpoint", "status"],
)

CACHE_HITS_TOTAL = Counter(
    "cache_hits_total",
    "Total semantic cache hits",
)

CACHE_MISSES_TOTAL = Counter(
    "cache_misses_total",
    "Total semantic cache misses",
)


# ---------------------------------------------------------------------------
# Histograms
# ---------------------------------------------------------------------------

AGENT_EXECUTION_TIME = Histogram(
    "agent_execution_time",
    "Agent workflow execution time in seconds",
    ["intent"],
    buckets=[0.1, 0.25, 0.5, 1.0, 2.5, 5.0, 10.0, 30.0, 60.0],
)

HTTP_REQUEST_DURATION = Histogram(
    "http_request_duration_seconds",
    "HTTP request duration in seconds",
    ["method", "endpoint"],
    buckets=[0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1.0, 2.5, 5.0, 10.0],
)


# ---------------------------------------------------------------------------
# Metrics endpoint helper
# ---------------------------------------------------------------------------

def get_metrics() -> bytes:
    """Return Prometheus-formatted metrics payload."""
    return generate_latest()


def get_metrics_content_type() -> str:
    """Return the correct Content-Type for Prometheus scraping."""
    return CONTENT_TYPE_LATEST
