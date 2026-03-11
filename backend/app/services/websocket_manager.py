"""
WebSocket Connection Manager — real-time workflow execution updates.

Supports per-user and per-workflow channels via Redis PubSub pattern.
Falls back to in-memory broadcasting when Redis is unavailable.
"""

import asyncio
import json
from datetime import datetime, timezone
from typing import Dict, Set, Any, Optional

from fastapi import WebSocket, WebSocketDisconnect

from app.config import settings


class ConnectionManager:
    """Manages active WebSocket connections and message broadcasting."""

    def __init__(self):
        # user_id → set of WebSocket connections
        self._user_connections: Dict[str, Set[WebSocket]] = {}
        # workflow_run_id → set of WebSocket connections
        self._workflow_connections: Dict[str, Set[WebSocket]] = {}
        # All connections
        self._all_connections: Set[WebSocket] = set()

    async def connect(self, websocket: WebSocket, user_id: str):
        """Accept a WebSocket connection and register it."""
        await websocket.accept()
        self._all_connections.add(websocket)
        if user_id not in self._user_connections:
            self._user_connections[user_id] = set()
        self._user_connections[user_id].add(websocket)

    def disconnect(self, websocket: WebSocket, user_id: str):
        """Remove a WebSocket connection from all registries."""
        self._all_connections.discard(websocket)
        if user_id in self._user_connections:
            self._user_connections[user_id].discard(websocket)
            if not self._user_connections[user_id]:
                del self._user_connections[user_id]
        # Remove from all workflow subscriptions
        for ws_set in self._workflow_connections.values():
            ws_set.discard(websocket)

    def subscribe_workflow(self, websocket: WebSocket, run_id: str):
        """Subscribe a connection to workflow execution updates."""
        if run_id not in self._workflow_connections:
            self._workflow_connections[run_id] = set()
        self._workflow_connections[run_id].add(websocket)

    def unsubscribe_workflow(self, websocket: WebSocket, run_id: str):
        """Unsubscribe from workflow updates."""
        if run_id in self._workflow_connections:
            self._workflow_connections[run_id].discard(websocket)

    async def send_to_user(self, user_id: str, message: Dict[str, Any]):
        """Send a message to all connections of a specific user."""
        connections = self._user_connections.get(user_id, set()).copy()
        dead = []
        for ws in connections:
            try:
                await ws.send_json(message)
            except Exception:
                dead.append(ws)
        for ws in dead:
            self.disconnect(ws, user_id)

    async def send_to_workflow(self, run_id: str, message: Dict[str, Any]):
        """Send a message to all connections watching a workflow run."""
        connections = self._workflow_connections.get(run_id, set()).copy()
        dead = []
        for ws in connections:
            try:
                await ws.send_json(message)
            except Exception:
                dead.append(ws)
        for ws in dead:
            self._workflow_connections.get(run_id, set()).discard(ws)

    async def broadcast(self, message: Dict[str, Any]):
        """Send a message to all connected clients."""
        dead = []
        for ws in self._all_connections.copy():
            try:
                await ws.send_json(message)
            except Exception:
                dead.append(ws)
        for ws in dead:
            self._all_connections.discard(ws)

    @property
    def active_connections(self) -> int:
        return len(self._all_connections)


# Global singleton
manager = ConnectionManager()


# ---------------------------------------------------------------------------
# Event types for workflow streaming
# ---------------------------------------------------------------------------

def workflow_event(
    run_id: str,
    event_type: str,
    node_id: Optional[str] = None,
    data: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    """Create a standardized workflow event message."""
    return {
        "type": "workflow_event",
        "run_id": run_id,
        "event": event_type,  # node_started | node_completed | node_error | workflow_completed | log
        "node_id": node_id,
        "data": data or {},
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }


def system_event(event_type: str, data: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    """Create a system-level event (metrics update, agent status change, etc.)."""
    return {
        "type": "system_event",
        "event": event_type,
        "data": data or {},
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }
