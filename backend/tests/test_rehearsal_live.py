import json
from datetime import datetime, timezone
from types import SimpleNamespace
from uuid import uuid4

from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.models.schemas import RunStatusResponse
from app.routers import rehearsal


def test_stream_replays_every_status_transition(monkeypatch) -> None:
	run_id = uuid4()
	stages = ["queued", "provisioning", "seeding", "migrating", "querying", "analyzing", "done"]
	statuses = [
		RunStatusResponse(run_id=run_id, stage=stage, log=[], progress_pct=index * 100 // (len(stages) - 1))
		for index, stage in enumerate(stages)
	]
	monkeypatch.setattr(rehearsal.manager, "get", lambda _: SimpleNamespace(status=statuses[-1]))
	monkeypatch.setattr(
		rehearsal.manager,
		"get_status_events",
		lambda _, offset: (statuses[offset:], len(statuses), True),
	)
	app = FastAPI()
	app.include_router(rehearsal.router, prefix="/api")

	with TestClient(app) as client:
		response = client.get(f"/api/rehearsal/{run_id}/stream")

	data_lines = [line.removeprefix("data: ") for line in response.text.splitlines() if line.startswith("data: ")]
	assert response.status_code == 200
	assert [json.loads(line)["stage"] for line in data_lines] == stages
	assert response.headers["content-type"].startswith("text/event-stream")


def test_history_route_returns_current_run_summaries(monkeypatch) -> None:
	run_id = uuid4()
	created_at = datetime.now(timezone.utc)
	monkeypatch.setattr(
		rehearsal.manager,
		"list_history",
		lambda: [{
			"run_id": run_id,
			"repo": "phase-0-demo",
			"migration": "phase0/add_status_index.sql",
			"verdict": "clean",
			"created_at": created_at,
		}],
	)
	app = FastAPI()
	app.include_router(rehearsal.router, prefix="/api")

	with TestClient(app) as client:
		response = client.get("/api/rehearsal/history")

	assert response.status_code == 200
	assert response.json()["runs"][0]["run_id"] == str(run_id)
	assert response.json()["runs"][0]["verdict"] == "clean"
