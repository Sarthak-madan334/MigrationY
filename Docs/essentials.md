# essentials.md — Quick Reference

## Setup

```bash
# Backend
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp ../.env.example .env      # fill in GITHUB_CLIENT_ID / SECRET, DATABASE_URL
uvicorn app.main:app --reload --port 8000

# Frontend
cd frontend
npm install
npm run dev                   # http://localhost:3000

# Shadow DB (local dev)
docker compose -f infra/docker-compose.yml up -d
```

## Required environment variables (`.env`)

| Var | Purpose |
|---|---|
| `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET` | OAuth app for repo connection |
| `DATABASE_URL` | Run-history persistence (SQLite path or Postgres URL) |
| `SHADOW_DB_PROVIDER` | `docker` (local) or `fly` / `railway` (hosted demo) |
| `SHADOW_DB_ADMIN_URL` | Connection string with rights to create/drop ephemeral databases |
| `NEXT_PUBLIC_API_BASE_URL` | Frontend → backend API base URL |

## Suggested seed scenario for a reliable demo regression

Pick a migration/query pair known to interact badly, rather than hoping corruption randomly produces one:

- **Migration:** adds a new index on `orders(status)`, assumes `status` is always non-null going forward.
- **Corruption profile:** legacy-format rate high enough that ~2% of rows retain a pre-migration NULL `status` from before the column was backfilled.
- **Query:** `SELECT * FROM orders WHERE status IS NULL` — the new index doesn't help this predicate the way the team assumed, planner falls back to a sequential scan over the full (large) table.

This gives a reliable, *genuine* regression without hardcoding the bisector's output — the corruption profile just makes the failure condition likely to exist in the generated data.

## Common pitfalls

- **Shadow DB cold starts are slow on hosted free tiers.** Rehearse the demo against the deployed instance, not just localhost — see `implementation_plan.md` Phase 5.
- **`EXPLAIN ANALYZE` actually executes the query.** Run it only once per before/after measurement in the harness, or you'll double-count latency.
- **Bisection can be slow if it re-seeds the full dataset each iteration.** Bisect over row *subsets already present* in the shadow DB rather than regenerating data per iteration.
- **Don't let corruption rates make every query regress.** Tune profiles so the "1 of 7 regressed" story is legible — an all-red results table is a worse demo than one clear standout failure.
- **Keep the sample query manifest and sample repo in the repo itself** so the demo never depends on live GitHub OAuth working perfectly in front of judges.

## Key files to check first when debugging

| Symptom | Check |
|---|---|
| Run stuck at "provisioning" | `shadow_db/provision.py`, container platform quota/cold-start |
| No regression ever found | corruption rates in `generator/corrupt.py`, regression threshold in `harness/query_runner.py` |
| Bisector doesn't converge | `bisector/delta_debug.py` subset-selection logic |
| Frontend shows stale progress | SSE connection in `lib/sse.ts`, or fall back to polling `/rehearsal/:id/status` |
