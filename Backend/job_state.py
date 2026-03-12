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
class JobState:
    job_id: str
    mode: str
    session_id: str
    model_name: str
    prompt: str
    user_id: str = "demo"
    workspace_id: str = "default-space"
    tone: str | None = None
    status: str = "queued"
    progress_stage: str = "queued"
    progress_note: str = ""
    created_at: str = field(default_factory=utcnow_iso)
    updated_at: str = field(default_factory=utcnow_iso)
    started_at: str | None = None
    completed_at: str | None = None
    error_message: str | None = None
    summary_text: str = ""
    review_score: int | None = None
    result: dict[str, Any] | None = None


class JobStore:
    def __init__(self, store_dir: str | None = None) -> None:
        base_dir = Path(__file__).resolve().parent
        configured_dir = Path(store_dir) if store_dir else Path("data/backend_jobs")
        if not configured_dir.is_absolute():
            configured_dir = base_dir / configured_dir
        self.store_dir = configured_dir
        self.store_dir.mkdir(parents=True, exist_ok=True)
        self._jobs: dict[str, JobState] = {}
        self._guard = asyncio.Lock()
        self._load_persisted_jobs()

    def _job_path(self, job_id: str) -> Path:
        return self.store_dir / f"{quote(job_id, safe='')}.json"

    def _write_payload(self, path: Path, payload: dict[str, Any]) -> None:
        temp_path = path.with_name(f".{path.name}.tmp")
        temp_path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
        temp_path.replace(path)

    def _load_persisted_jobs(self) -> None:
        for path in sorted(self.store_dir.glob("*.json")):
            try:
                payload = json.loads(path.read_text(encoding="utf-8"))
                job = JobState(**payload)
            except Exception:
                continue

            if job.status in {"queued", "running"}:
                job.status = "failed"
                job.progress_stage = "failed"
                job.error_message = job.error_message or "Background job was interrupted before completion."
                job.completed_at = job.completed_at or utcnow_iso()
                job.updated_at = utcnow_iso()
                self._write_payload(path, asdict(job))

            self._jobs[job.job_id] = job

    async def create_job(
        self,
        *,
        job_id: str,
        mode: str,
        session_id: str,
        model_name: str,
        prompt: str,
        user_id: str,
        workspace_id: str,
        tone: str | None = None,
    ) -> JobState:
        job = JobState(
            job_id=job_id,
            mode=mode,
            session_id=session_id,
            model_name=model_name,
            prompt=prompt,
            user_id=user_id,
            workspace_id=workspace_id,
            tone=tone,
        )
        async with self._guard:
            self._jobs[job_id] = job
            self._write_payload(self._job_path(job_id), asdict(job))
        return job

    async def get_job(self, job_id: str) -> JobState | None:
        async with self._guard:
            return self._jobs.get(job_id)

    async def list_jobs(
        self,
        session_id: str | None = None,
        *,
        user_id: str | None = None,
        workspace_id: str | None = None,
        limit: int = 50,
    ) -> list[JobState]:
        async with self._guard:
            jobs = list(self._jobs.values())
        if session_id:
            jobs = [job for job in jobs if job.session_id == session_id]
        if user_id:
            jobs = [job for job in jobs if job.user_id == user_id]
        if workspace_id:
            jobs = [job for job in jobs if job.workspace_id == workspace_id]
        jobs.sort(key=lambda job: job.updated_at, reverse=True)
        return jobs[:limit]

    async def update_job(self, job_id: str, **updates: Any) -> JobState | None:
        async with self._guard:
            job = self._jobs.get(job_id)
            if job is None:
                return None

            for key, value in updates.items():
                if hasattr(job, key):
                    setattr(job, key, value)
            job.updated_at = utcnow_iso()
            self._write_payload(self._job_path(job_id), asdict(job))
            return job
