"""Streaming support for the backend service."""

from __future__ import annotations

import asyncio
from collections import deque
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any, Deque, Dict, List
import threading


@dataclass(slots=True)
class _Subscriber:
    loop: asyncio.AbstractEventLoop
    queue: asyncio.Queue


class EventStreamBroker:
    """Manage per-run event subscriptions and history buffers."""

    def __init__(self, history_limit: int = 200) -> None:
        self._history_limit = history_limit
        self._history: Dict[str, Deque[dict[str, Any]]] = {}
        self._subscribers: Dict[str, List[_Subscriber]] = {}
        self._lock = threading.Lock()

    def publish(self, run_id: str, event: dict[str, Any]) -> None:
        payload = dict(event)
        with self._lock:
            history = self._history.setdefault(run_id, deque(maxlen=self._history_limit))
            history.append(payload)
            subscribers = list(self._subscribers.get(run_id, ()))

        for subscriber in subscribers:
            subscriber.loop.call_soon_threadsafe(subscriber.queue.put_nowait, payload)

    def subscribe(self, run_id: str, loop: asyncio.AbstractEventLoop) -> tuple[asyncio.Queue, List[dict[str, Any]]]:
        queue: asyncio.Queue = asyncio.Queue()
        subscriber = _Subscriber(loop=loop, queue=queue)
        with self._lock:
            self._subscribers.setdefault(run_id, []).append(subscriber)
            history = list(self._history.get(run_id, ()))
        return queue, history

    def unsubscribe(self, run_id: str, queue: asyncio.Queue) -> None:
        with self._lock:
            subscribers = self._subscribers.get(run_id)
            if not subscribers:
                return
            self._subscribers[run_id] = [s for s in subscribers if s.queue is not queue]
            if not self._subscribers[run_id]:
                del self._subscribers[run_id]

    def has_history(self, run_id: str) -> bool:
        with self._lock:
            history = self._history.get(run_id)
            return bool(history)

    def seed_history(self, run_id: str, events: List[dict[str, Any]]) -> None:
        trimmed = events[-self._history_limit :]
        with self._lock:
            history = self._history.setdefault(run_id, deque(maxlen=self._history_limit))
            history.clear()
            for event in trimmed:
                history.append(dict(event))


class StreamingReporter:
    """Reporter implementation that forwards events to the event broker."""

    def __init__(self, run_id: str, broker: EventStreamBroker) -> None:
        self.run_id = run_id
        self._broker = broker

    def _emit(self, kind: str, data: dict[str, Any]) -> None:
        event = {
            "type": kind,
            "data": data,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }
        self._broker.publish(self.run_id, event)

    # Reporter API methods -------------------------------------------------

    def main_agent(self, step: int, text: str) -> None:
        self._emit("main_agent", {"step": step, "text": text})

    def supervisor(self, step: int, text: str) -> None:
        self._emit("supervisor", {"step": step, "text": text})

    def tool_calls(self, step: int, calls) -> None:
        safe_calls = []
        for call in calls or []:
            safe_calls.append(
                {
                    "id": getattr(call, "id", None),
                    "function": getattr(getattr(call, "function", None), "name", None),
                    "arguments": getattr(getattr(call, "function", None), "arguments", None),
                }
            )
        self._emit("tool_calls", {"step": step, "calls": safe_calls})

    def tool_result(self, call_id: str, result: str) -> None:
        self._emit("tool_result", {"call_id": call_id, "result": result})

    def reset_r(self) -> None:
        self._emit("reset_r", {})

    def terminated(self) -> None:
        self._emit("terminated", {})

    def log(self, kind: str, **data: Any) -> None:
        self._emit(kind, data)

    def close(self) -> None:
        self._emit("close", {})


event_broker = EventStreamBroker()
