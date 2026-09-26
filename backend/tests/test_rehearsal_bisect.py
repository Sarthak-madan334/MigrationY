import asyncio
from pathlib import Path
from types import SimpleNamespace
from uuid import uuid4

import pytest
from fastapi import FastAPI, HTTPException
from fastapi.testclient import TestClient

from app.models.schemas import (
	BisectRequest,
	BisectResponse,
	QueryResult,
	RunRequest,
	RunResultResponse,
)
from app.orchestrator.pipeline import BisectionOutcome, _query_regressed
from app.routers import rehearsal


def test_query_plan_change_is_a_regression() -> None:
	assert _query_regressed(0.75, "Index Scan (cost=1)", "Seq Scan (cost=2)")
	assert _query_regressed(3.1, "Index Scan (cost=1)", "Index Scan (cost=2)")
	assert not _query_regressed(1.2, "Index Scan (cost=1)", "Index Scan (cost=2)")


def _run_record(query_verdict: str = "regressed") -> tuple[object, SimpleNamespace]:
	run_id = uuid4()
	query = QueryResult(
		id="q6",
		sql="SELECT id FROM orders ORDER BY created_at DESC LIMIT 25",
		latency_before_ms=1,
		latency_after_ms=5,
		regression_factor=5,
		verdict=query_verdict,
		plan_before="Index Scan",
		plan_after="Seq Scan",
	)
	record = SimpleNamespace(
		request=RunRequest(),
		result=RunResultResponse(run_id=run_id, verdict="regressed", queries=[query]),
	)
	return run_id, record


def test_bisect_endpoint_returns_and_caches_artifact(monkeypatch: pytest.MonkeyPatch) -> None:
	run_id, record = _run_record()
	outcome = BisectionOutcome(
		minimal_condition="The query regression persists with 3 generated orders.",
		minimal_row_count=3,
		bisection_trail=(12, 6, 3),
		repro_script="SELECT 1;\n",
	)
	stored: list[tuple[object, ...]] = []
	monkeypatch.setattr(rehearsal.manager, "get", lambda _: record)
	monkeypatch.setattr(rehearsal.manager, "get_bisection", lambda *_: None)
	monkeypatch.setattr(rehearsal.manager, "store_bisection", lambda *args: stored.append(args))
	monkeypatch.setattr(rehearsal.manager, "publish", lambda *args, **kwargs: None)
	monkeypatch.setattr(rehearsal.manager, "repo_root", Path("."))
	monkeypatch.setattr(rehearsal, "run_bisection", lambda *args: outcome)

	response = asyncio.run(rehearsal.bisect_rehearsal(run_id, BisectRequest(query_id="q6")))

	assert response.minimal_row_count == 3
	assert response.bisection_trail == [12, 6, 3]
	assert response.repro_script_url == f"/api/rehearsal/{run_id}/cause/q6/repro.sql"
	assert stored[0][0:2] == (run_id, "q6")
	assert stored[0][3] == "SELECT 1;\n"


def test_bisect_endpoint_rejects_non_regressed_query(monkeypatch: pytest.MonkeyPatch) -> None:
	run_id, record = _run_record(query_verdict="passed")
	monkeypatch.setattr(rehearsal.manager, "get", lambda _: record)

	with pytest.raises(HTTPException) as error:
		asyncio.run(rehearsal.bisect_rehearsal(run_id, BisectRequest(query_id="q6")))

	assert error.value.status_code == 409
	assert error.value.detail == "query_not_regressed"


def test_repro_endpoint_returns_downloadable_sql(monkeypatch: pytest.MonkeyPatch) -> None:
	run_id, record = _run_record()
	response = BisectResponse(
		query_id="q6",
		minimal_condition="3 rows reproduce the regression",
		minimal_row_count=3,
		bisection_trail=[12, 6, 3],
		repro_script_url=f"/api/rehearsal/{run_id}/cause/q6/repro.sql",
	)
	monkeypatch.setattr(rehearsal.manager, "get", lambda _: record)
	monkeypatch.setattr(rehearsal.manager, "get_bisection", lambda *_: (response, "SELECT 1;\n"))

	download = asyncio.run(rehearsal.repro_script(run_id, "q6"))

	assert download.body == b"SELECT 1;\n"
	assert download.media_type == "application/sql"
	assert download.headers["content-disposition"] == 'attachment; filename="repro.sql"'


def test_bisect_and_repro_http_routes(monkeypatch: pytest.MonkeyPatch) -> None:
	run_id, record = _run_record()
	outcome = BisectionOutcome(
		minimal_condition="The query regression persists with 3 generated orders.",
		minimal_row_count=3,
		bisection_trail=(12, 6, 3),
		repro_script="SELECT 1;\n",
	)
	artifacts: dict[str, tuple[BisectResponse, str]] = {}
	monkeypatch.setattr(rehearsal.manager, "get", lambda _: record)
	monkeypatch.setattr(rehearsal.manager, "get_bisection", lambda _, query_id: artifacts.get(query_id))
	monkeypatch.setattr(rehearsal.manager, "store_bisection", lambda _, query_id, result, script: artifacts.__setitem__(query_id, (result, script)))
	monkeypatch.setattr(rehearsal.manager, "publish", lambda *args, **kwargs: None)
	monkeypatch.setattr(rehearsal.manager, "repo_root", Path("."))
	monkeypatch.setattr(rehearsal, "run_bisection", lambda *args: outcome)
	app = FastAPI()
	app.include_router(rehearsal.router, prefix="/api")

	with TestClient(app) as client:
		response = client.post(f"/api/rehearsal/{run_id}/bisect", json={"query_id": "q6"})
		repro = client.get(response.json()["repro_script_url"])

	assert response.status_code == 200
	assert response.json()["minimal_row_count"] == 3
	assert response.json()["bisection_trail"] == [12, 6, 3]
	assert repro.status_code == 200
	assert repro.headers["content-type"].startswith("application/sql")
	assert repro.content == b"SELECT 1;\n"