from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, Field


class HealthResponse(BaseModel):
    status: Literal["ok"]
    phase: Literal["0", "1"]


class QueryManifestItem(BaseModel):
    id: str
    sql: str


class QueryManifest(BaseModel):
    queries: list[QueryManifestItem]


class CorruptionProfile(BaseModel):
    null_pressure: float = 0.15
    duplication_rate: float = 0.05
    legacy_format_rate: float = 0.02
    row_count_per_table: int = 50_000


class RunRequest(BaseModel):
    repo_id: str = "phase-0-demo"
    migration_path: str = "phase0/add_status_index.sql"
    query_manifest: str | None = None
    corruption_profile: CorruptionProfile = CorruptionProfile()


class RunResponse(BaseModel):
    run_id: UUID
    status: Literal["queued"]


class LogEntry(BaseModel):
    ts: datetime
    level: Literal["info", "warn", "error"]
    message: str


class RunStatusResponse(BaseModel):
    run_id: UUID
    stage: Literal["queued", "provisioning", "seeding", "migrating", "querying", "analyzing", "bisecting", "done", "failed"]
    log: list[LogEntry]
    progress_pct: int


class RunHistoryItem(BaseModel):
    run_id: UUID
    repo: str
    migration: str
    verdict: Literal["regressed", "clean", "running", "failed"]
    created_at: datetime


class RunHistoryResponse(BaseModel):
    runs: list[RunHistoryItem]


class QueryResult(BaseModel):
    id: str
    sql: str
    latency_before_ms: float
    latency_after_ms: float
    regression_factor: float
    verdict: Literal["regressed", "passed"]
    plan_before: str
    plan_after: str


class RunResultResponse(BaseModel):
    run_id: UUID
    verdict: Literal["regressed", "clean"]
    queries: list[QueryResult]


class BisectRequest(BaseModel):
    query_id: str = Field(min_length=1, max_length=100)


class BisectResponse(BaseModel):
    query_id: str
    minimal_condition: str
    minimal_row_count: int
    bisection_trail: list[int]
    repro_script_url: str


class GitHubUserResponse(BaseModel):
    login: str
    avatar_url: str


class GitHubSessionResponse(BaseModel):
    user: GitHubUserResponse


class GitHubAuthorizationResponse(BaseModel):
    authorization_url: str


class GitHubOAuthCallbackRequest(BaseModel):
    code: str = Field(min_length=1)
    state: str = Field(min_length=1)


class GitHubRepo(BaseModel):
    id: str
    full_name: str
    default_branch: str


class GitHubRepoList(BaseModel):
    repos: list[GitHubRepo]


class GitHubMigration(BaseModel):
    path: str
    diff_preview: str
    detected_dialect: str


class GitHubMigrationList(BaseModel):
    migrations: list[GitHubMigration]


class FaqTurn(BaseModel):
    question: str
    answer: str


class FaqQuestionRequest(BaseModel):
    question: str
    history: list[FaqTurn] = Field(default_factory=list)


class FaqAnswerResponse(BaseModel):
    answer: str
