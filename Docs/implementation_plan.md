# implementation_plan.md — Phased Build Plan

**Golden rule: the product must be demo-safe at the end of every phase.** Each phase below ends with something that works end-to-end, even if narrower in scope than the final version. Never leave the build in a state where nothing runs.

## Phase 0 — Foundations (scaffold + one hardcoded path)

- Generate the folder structure in `scaffold.md`.
- Backend: FastAPI app boots, one hardcoded schema (e.g. an `orders` table DDL checked into the repo, not yet pulled from GitHub), one hardcoded migration, one hardcoded query manifest.
- Data generator: produce 50k rows with basic corruption (null pressure only) against the hardcoded schema — prove the pipeline shape works before adding realism.
- Shadow DB: local Docker Postgres, provision/teardown scripted.
- **Checkpoint:** a CLI script that generates data, applies the migration, runs one query before/after, and prints latency. No UI yet. This is your proof the core idea works at all.

## Phase 1 — Real orchestration + API

- Wire Phase 0's script into the orchestrator state machine (`queued → provisioning → seeding → migrating → querying → analyzing → done`).
- Expose `/rehearsal/run`, `/rehearsal/:id/status`, `/rehearsal/:id/result` per `api_spec.md`.
- Expand the corruption profiles: duplication, legacy-format drift, skew — not just null pressure.
- Expand the query manifest to the full sample set (5–8 queries) so at least one reliably regresses (this may mean deliberately choosing a migration/query pair known to interact badly — see `essentials.md` for a suggested seed scenario).
- **Checkpoint:** hitting the API end-to-end (e.g. via `curl` or a simple test script) returns a real, non-hardcoded regression result.

## Phase 2 — Root-cause bisection

- Implement `delta_debug.py`: iterative subset re-execution against the shadow DB to isolate the minimal condition triggering a regression.
- Expose `/rehearsal/:id/bisect` and the repro-script download endpoint.
- **Checkpoint:** for the known-regressing query from Phase 1, the bisector converges to a minimal condition and row count, and a runnable repro script downloads successfully.

## Phase 3 — Frontend, in UX-priority order (see `ui_ux.md` §8)

Build in this exact order so the highest-scoring screens exist first, even if later ones get cut:

1. Live Rehearsal Run screen (`ui_ux.md` §4.3) — pipeline animation + live log panel, wired to the SSE/status endpoint.
2. Results Dashboard (§4.4) — verdict banner + query table.
3. Root-Cause Drill-down (§4.5) — bisection trail + plan diff + repro export.
4. Connect flow (§4.2) — can start as repo-picker + "use sample manifest" shortcut; full GitHub OAuth can follow if time allows.
5. Landing (§4.1) and History (§4.6) — lowest risk, build last, cut first if needed.

- **Checkpoint:** a full click-through from Connect → Live Run → Results → Root-Cause works against the real backend, using the sample manifest path (GitHub OAuth optional at this checkpoint).

## Phase 4 — GitHub integration

- Add real OAuth connect (`/auth/github/callback`, `/repos`, `/repos/:id/migrations`).
- Migration auto-detection across common migration directory conventions.
- **Checkpoint:** a real, previously-unseen repo can be connected and its migrations listed and selected — this is what proves "Feasibility & Scalability" rather than a canned example.

## Phase 5 — Deploy + polish pass

- Containerize backend (`Dockerfile`), deploy shadow-provisioning target to Fly.io/Railway free tier.
- Deploy frontend (Vercel free tier or similar).
- Apply the design-token pass from `ui_ux.md` §2 everywhere if not already consistent (cheap, high-visibility fix).
- Rehearse the actual demo script (`product.md` §7) against the deployed instance, not localhost — catch latency/cold-start surprises before judges do.
- **Checkpoint:** the exact demo script runs successfully against the deployed URL, twice in a row, from a cold start.

## Definition of done (submission-ready)

- [ ] Deployed URL loads and the Connect → Run → Report → Drill-down flow completes without manual intervention.
- [ ] At least one real (non-hardcoded) migration + query pair reliably produces a regression and a bisected root cause.
- [ ] The Live Run screen shows the pipeline + live log, not a bare spinner.
- [ ] The Results Dashboard states a plain-language verdict before showing detail.
- [ ] A repro script downloads successfully from the drill-down screen.
- [ ] Demo has been rehearsed end-to-end against the deployed instance at least twice.
