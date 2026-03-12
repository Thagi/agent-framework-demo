import asyncio
import json
from dataclasses import asdict, dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Any
from urllib.parse import quote


def utcnow_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


@dataclass
class AuditEvent:
    event_id: str
    request_id: str
    mode: str
    session_id: str
    model_name: str
    provider: str | None = None
    target: str | None = None
    status: str = "completed"
    created_at: str = field(default_factory=utcnow_iso)
    duration_ms: int | None = None
    planning_duration_ms: int | None = None
    execution_duration_ms: int | None = None
    review_duration_ms: int | None = None
    prompt_tokens: int | None = None
    completion_tokens: int | None = None
    total_tokens: int | None = None
    token_source: str = "unknown"
    estimated_cost: float | None = None
    currency: str | None = None
    tool_names: list[str] = field(default_factory=list)
    trace_count: int = 0
    evidence_count: int = 0
    attachment_count: int = 0
    history_message_count: int = 0
    review_score: int | None = None
    route_mode: str | None = None
    route_confidence: float | None = None
    prompt_excerpt: str = ""
    response_excerpt: str = ""
    error_message: str | None = None
    job_id: str | None = None
    metadata: dict[str, Any] = field(default_factory=dict)


class AuditStore:
    def __init__(self, store_dir: str | None = None) -> None:
        base_dir = Path(__file__).resolve().parent
        configured_dir = Path(store_dir) if store_dir else Path("data/backend_audit")
        if not configured_dir.is_absolute():
            configured_dir = base_dir / configured_dir
        self.store_dir = configured_dir
        self.store_dir.mkdir(parents=True, exist_ok=True)
        self._events: dict[str, AuditEvent] = {}
        self._guard = asyncio.Lock()
        self._load_persisted_events()

    def _event_path(self, event_id: str) -> Path:
        return self.store_dir / f"{quote(event_id, safe='')}.json"

    def _write_payload(self, path: Path, payload: dict[str, Any]) -> None:
        temp_path = path.with_name(f".{path.name}.tmp")
        temp_path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
        temp_path.replace(path)

    def _load_persisted_events(self) -> None:
        for path in sorted(self.store_dir.glob("*.json")):
            try:
                payload = json.loads(path.read_text(encoding="utf-8"))
                event = AuditEvent(**payload)
            except Exception:
                continue
            self._events[event.event_id] = event

    async def record_event(self, event: AuditEvent) -> AuditEvent:
        async with self._guard:
            self._events[event.event_id] = event
            self._write_payload(self._event_path(event.event_id), asdict(event))
        return event

    async def list_events(
        self,
        *,
        session_id: str | None = None,
        mode: str | None = None,
        limit: int = 20,
    ) -> list[AuditEvent]:
        async with self._guard:
            events = list(self._events.values())

        if session_id:
            events = [event for event in events if event.session_id == session_id]
        if mode:
            events = [event for event in events if event.mode == mode]

        events.sort(key=lambda event: event.created_at, reverse=True)
        return events[:limit]

    async def summarize(
        self,
        *,
        session_id: str | None = None,
        mode: str | None = None,
        recent_limit: int = 5,
    ) -> dict[str, Any]:
        async with self._guard:
            events = list(self._events.values())

        if session_id:
            events = [event for event in events if event.session_id == session_id]
        if mode:
            events = [event for event in events if event.mode == mode]

        events.sort(key=lambda event: event.created_at, reverse=True)

        total_runs = len(events)
        completed_runs = sum(1 for event in events if event.status == "completed")
        failed_runs = sum(1 for event in events if event.status == "failed")
        total_duration_ms = sum(event.duration_ms or 0 for event in events)
        total_prompt_tokens = sum(event.prompt_tokens or 0 for event in events)
        total_completion_tokens = sum(event.completion_tokens or 0 for event in events)
        total_tokens = sum(event.total_tokens or 0 for event in events)
        total_estimated_cost = sum(event.estimated_cost or 0.0 for event in events)
        currencies = {event.currency for event in events if event.currency}
        currency = currencies.pop() if len(currencies) == 1 else None

        by_mode: dict[str, int] = {}
        by_model: dict[str, int] = {}
        tool_usage: dict[str, int] = {}
        for event in events:
            by_mode[event.mode] = by_mode.get(event.mode, 0) + 1
            by_model[event.model_name] = by_model.get(event.model_name, 0) + 1
            for tool_name in event.tool_names:
                tool_usage[tool_name] = tool_usage.get(tool_name, 0) + 1

        return {
            "total_runs": total_runs,
            "completed_runs": completed_runs,
            "failed_runs": failed_runs,
            "average_duration_ms": round(total_duration_ms / total_runs) if total_runs else 0,
            "total_duration_ms": total_duration_ms,
            "total_prompt_tokens": total_prompt_tokens,
            "total_completion_tokens": total_completion_tokens,
            "total_tokens": total_tokens,
            "total_estimated_cost": round(total_estimated_cost, 6) if total_runs else 0.0,
            "currency": currency,
            "by_mode": by_mode,
            "by_model": by_model,
            "tool_usage": tool_usage,
            "recent_events": [asdict(event) for event in events[:recent_limit]],
        }
