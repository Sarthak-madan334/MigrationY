# api_spec.md — Backend API Contract

Base URL (local): `http://localhost:8000/api`

All responses are JSON. All timestamps are ISO 8601 UTC.

## 1. Auth / Repo connection

### `GET /auth/github/authorize`
Returns a GitHub authorization URL and sets a short-lived, HttpOnly OAuth state cookie. The app requests only `read:user`; repo metadata and contents are read from public repositories through public GitHub endpoints. Private repository access requires a GitHub App configured with read-only Contents permission.

**Response**
```json
{ "authorization_url": "https://github.com/login/oauth/authorize?..." }
```

The browser navigates to this URL. GitHub returns to `GET /auth/github/callback` with `code` and `state`. The callback exchanges the code server-side, stores the token in a process-local session store, sets an HttpOnly session cookie, and redirects to `/connect?github=connected`. Sessions expire after the configured TTL and are lost on backend restart; use a single backend worker for the MVP.

If the user denies authorization, the callback redirects to `/connect?github_error=authorization_cancelled` after validating state.

### `GET /auth/github/session`
Returns the authenticated GitHub user's public profile. Requires the session cookie.

### `POST /auth/github/callback`
API alternative for exchanging an OAuth code. Requires the `code` and matching `state` cookie; the access token is never returned to the browser.

**Body**
```json
{ "code": "string", "state": "string" }
```
**Response**
```json
{ "user": { "login": "string", "avatar_url": "string" } }
```
The response also sets the HttpOnly session cookie.

### `POST /auth/github/logout`
Revokes the current in-memory session and clears the session cookie.

### `GET /repos`
Lists the authenticated user's public repos. Private-repository support requires a GitHub App installation configured with read-only Contents permission; this OAuth App flow intentionally avoids write-capable repository scopes.

**Response**
```json
{ "repos": [ { "id": "string", "full_name": "org/repo", "default_branch": "main" } ] }
```

### `GET /repos/:id/migrations`
Detects candidate migration files in common migration directories (`migrations/`, `db/migrate/`, `alembic/versions/`, framework-nested directories such as `prisma/migrations/`, and migration folders nested within an application) and flat Flyway-style versioned SQL files on the default branch.

**Response**
```json
{
  "migrations": [
    { "path": "migrations/0042_add_index.sql", "diff_preview": "string", "detected_dialect": "postgres" }
  ]
}
```

## 2. Rehearsal runs

### `POST /rehearsal/run`
Starts a new rehearsal run.

**Body**
```json
{
  "repo_id": "string",
  "migration_path": "migrations/0042_add_index.sql",
  "query_manifest": "string | null",      // raw YAML/SQL; null = use sample manifest
  "corruption_profile": {
    "null_pressure": 0.15,
    "duplication_rate": 0.05,
    "legacy_format_rate": 0.02,
    "row_count_per_table": 500000
  }
}
```
**Response**
```json
{ "run_id": "uuid", "status": "queued" }
```

### `GET /rehearsal/:run_id/status`
Poll or SSE endpoint for live progress (drives the pipeline UI in `ui_ux.md` §4.3).

**Response**
```json
{
  "run_id": "uuid",
  "stage": "provisioning | seeding | migrating | querying | analyzing | done | failed",
  "log": [
    { "ts": "2026-09-25T10:03:11Z", "level": "info", "message": "Seeded 500,000 rows into orders" },
    { "ts": "2026-09-25T10:03:42Z", "level": "warn", "message": "Query 4 latency: 38ms -> 1612ms" }
  ],
  "progress_pct": 62
}
```

`GET /rehearsal/:run_id/stream` sends each changed status as a Server-Sent Event whose `data` is the same JSON object returned by the status endpoint. It sends the current snapshot immediately and closes after `done` or `failed`; clients should fall back to status polling if the stream disconnects.

### `GET /rehearsal/:run_id/result`
Full results once `stage == done`.

**Response**
```json
{
  "run_id": "uuid",
  "verdict": "regressed | clean",
  "queries": [
    {
      "id": "q4",
      "sql": "SELECT * FROM orders WHERE status IS NULL",
      "latency_before_ms": 41,
      "latency_after_ms": 1612,
      "regression_factor": 39.3,
      "verdict": "regressed",
      "plan_before": "string (EXPLAIN output)",
      "plan_after": "string (EXPLAIN output)"
    }
  ]
}
```

### `POST /rehearsal/:run_id/bisect`
Triggers (or re-triggers) root-cause bisection for a specific regressed query. Normally auto-triggered by the orchestrator, exposed here for manual re-run / debugging.

**Body**
```json
{ "query_id": "q4" }
```
**Response**
```json
{
  "query_id": "q4",
  "minimal_condition": "legacy_format = TRUE AND created_at < '2019-03-01'",
  "minimal_row_count": 183,
  "bisection_trail": [500000, 61204, 8010, 1140, 183],
  "repro_script_url": "/api/rehearsal/uuid/cause/q4/repro.sql"
}
```

### `GET /rehearsal/:run_id/cause/:query_id/repro.sql`
Downloads the minimal reproducible SQL script (schema + minimal seed data + the failing query).

### `GET /rehearsal/history`
Lists runs from the current backend process for the History screen. The MVP run manager keeps these records in memory, so a backend restart clears the list.

**Response**
```json
{
  "runs": [
    { "run_id": "uuid", "repo": "org/repo", "migration": "0042_add_index.sql", "verdict": "regressed | clean | running | failed", "created_at": "2026-09-25T10:00:00Z" }
  ]
}
```

## 3. Error format

All errors follow:
```json
{ "error": { "code": "string", "message": "human-readable string" } }
```

Common codes: `repo_not_found`, `migration_not_found`, `provisioning_failed`, `manifest_invalid`, `run_not_found`.

## 4. Query manifest format

A small YAML file the user supplies (or the sample manifest for demo purposes):

```yaml
queries:
  - id: q1
    sql: "SELECT COUNT(*) FROM orders"
  - id: q4
    sql: "SELECT * FROM orders WHERE status IS NULL"
```
