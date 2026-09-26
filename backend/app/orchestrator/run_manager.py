import asyncio
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from threading import RLock
from uuid import UUID, uuid4

from app.models.schemas import BisectResponse, LogEntry, RunRequest, RunResultResponse, RunStatusResponse
from app.orchestrator.pipeline import run_rehearsal


@dataclass
class RunRecord:
    request: RunRequest
    status: RunStatusResponse
    result: RunResultResponse | None = None
    bisections: dict[str, tuple[BisectResponse, str]] = field(default_factory=dict)
    status_events: list[RunStatusResponse] = field(default_factory=list)
    created_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))


class RunManager:
    def __init__(self, repo_root: Path) -> None:
        self.repo_root = repo_root
        self._runs: dict[UUID, RunRecord] = {}
        self._lock = RLock()

    def create(self, request: RunRequest) -> UUID:
        run_id = uuid4()
        now = datetime.now(timezone.utc)
        status = RunStatusResponse(run_id=run_id, stage="queued", log=[], progress_pct=0)
        with self._lock:
            record = RunRecord(request=request, status=status, created_at=now, status_events=[status])
            self._runs[run_id] = record
        asyncio.create_task(self._execute(run_id))
        return run_id

    def get(self, run_id: UUID) -> RunRecord | None:
        with self._lock:
            return self._runs.get(run_id)

    def get_status_events(
        self, run_id: UUID, offset: int
    ) -> tuple[list[RunStatusResponse], int, bool] | None:
        with self._lock:
            record = self._runs.get(run_id)
            if record is None:
                return None
            total = len(record.status_events)
            terminal = record.status.stage in {"done", "failed"}
            return record.status_events[offset:], total, terminal

    def list_history(self) -> list[dict[str, object]]:
        with self._lock:
            records = sorted(self._runs.items(), key=lambda item: item[1].created_at, reverse=True)
            return [
                {
                    "run_id": run_id,
                    "repo": record.request.repo_id,
                    "migration": record.request.migration_path,
                    "verdict": (
                        record.result.verdict
                        if record.result is not None
                        else "failed" if record.status.stage == "failed" else "running"
                    ),
                    "created_at": record.created_at,
                }
                for run_id, record in records
            ]

    def get_bisection(self, run_id: UUID, query_id: str) -> tuple[BisectResponse, str] | None:
        with self._lock:
            record = self._runs.get(run_id)
            return record.bisections.get(query_id) if record is not None else None

    def store_bisection(self, run_id: UUID, query_id: str, response: BisectResponse, repro_script: str) -> None:
        with self._lock:
            record = self._runs.get(run_id)
            if record is not None:
                record.bisections[query_id] = (response, repro_script)

    async def _execute(self, run_id: UUID) -> None:
        record = self.get(run_id)
        if record is None:
            return
        try:
            results = await asyncio.to_thread(
                run_rehearsal,
                self.repo_root,
                record.request.corruption_profile.model_dump(),
                record.request.query_manifest,
                lambda stage, progress, message: self._publish(run_id, stage, progress, message),
                record.request.migration_sql,
            )
            verdict = "regressed" if any(item["verdict"] == "regressed" for item in results) else "clean"
            with self._lock:
                record.result = RunResultResponse(
                    run_id=run_id,
                    verdict=verdict,
                    can_bisect=record.request.migration_sql is None,
                    queries=results,
                )
            self._publish(run_id, "done", 100, f"Rehearsal complete: {verdict} verdict")
        except Exception as exc:
            self._publish(run_id, "failed", 100, f"Rehearsal failed: {exc}", level="error")

    def _publish(self, run_id: UUID, stage: str, progress: int, message: str, level: str = "info") -> None:
        with self._lock:
            record = self._runs[run_id]
            entry = LogEntry(ts=datetime.now(timezone.utc), level=level, message=message)
            record.status = RunStatusResponse(run_id=run_id, stage=stage, log=[*record.status.log, entry], progress_pct=progress)
            record.status_events.append(record.status)

    def publish(self, run_id: UUID, stage: str, progress: int, message: str, level: str = "info") -> None:
        self._publish(run_id, stage, progress, message, level)


manager = RunManager(Path(__file__).resolve().parents[3])
