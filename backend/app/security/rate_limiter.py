"""
Rate Limiting Middleware — per-IP and per-user request throttling.

Uses a sliding window counter pattern (in-memory for dev, Redis for production).
"""

import time
from collections import defaultdict
from typing import Dict, Tuple

from fastapi import HTTPException, Request
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import JSONResponse

from app.config import settings


class RateLimiter:
    """Sliding window rate limiter."""

    def __init__(self, max_requests: int = 60, window_seconds: int = 60):
        self.max_requests = max_requests
        self.window_seconds = window_seconds
        # key → list of timestamps
        self._requests: Dict[str, list] = defaultdict(list)

    def is_allowed(self, key: str) -> Tuple[bool, int]:
        """
        Check if a request is allowed for the given key.
        Returns (allowed: bool, remaining: int).
        """
        now = time.time()
        cutoff = now - self.window_seconds

        # Clean old entries
        self._requests[key] = [t for t in self._requests[key] if t > cutoff]

        if len(self._requests[key]) >= self.max_requests:
            return False, 0

        self._requests[key].append(now)
        remaining = self.max_requests - len(self._requests[key])
        return True, remaining

    def get_retry_after(self, key: str) -> int:
        """Get seconds until the next request is allowed."""
        if not self._requests[key]:
            return 0
        oldest = min(self._requests[key])
        retry_after = int(self.window_seconds - (time.time() - oldest)) + 1
        return max(retry_after, 1)


# Global limiter instance
_limiter = RateLimiter(
    max_requests=settings.rate_limit_per_minute,
    window_seconds=60,
)


class RateLimitMiddleware(BaseHTTPMiddleware):
    """FastAPI middleware for rate limiting by IP address."""

    async def dispatch(self, request: Request, call_next):
        # Skip rate limiting for health and metrics endpoints
        if request.url.path in ("/health", "/metrics", "/docs", "/openapi.json"):
            return await call_next(request)

        # Use client IP as rate limit key
        client_ip = request.client.host if request.client else "unknown"
        key = f"ip:{client_ip}"

        allowed, remaining = _limiter.is_allowed(key)

        if not allowed:
            retry_after = _limiter.get_retry_after(key)
            return JSONResponse(
                status_code=429,
                content={
                    "detail": "Rate limit exceeded. Try again later.",
                    "retry_after": retry_after,
                },
                headers={
                    "Retry-After": str(retry_after),
                    "X-RateLimit-Limit": str(_limiter.max_requests),
                    "X-RateLimit-Remaining": "0",
                },
            )

        response = await call_next(request)
        response.headers["X-RateLimit-Limit"] = str(_limiter.max_requests)
        response.headers["X-RateLimit-Remaining"] = str(remaining)
        return response
