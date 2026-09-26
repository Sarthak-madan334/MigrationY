# product.md — Migration Rehearsal Agent

## 1. The problem

Database migrations are reviewed against clean, small, well-behaved local data — and pass. They are then run against production data that is none of those things: years of accumulated NULLs, duplicate keys from old bugs, inconsistent date formats, tables 1000x larger than the dev fixture, and skewed distributions no one designed for. The migration "succeeds" in the sense that it completes, and then some downstream query that used to take 20ms starts taking 2 seconds, and nobody finds out until an on-call engineer does at 2am.

Code review catches syntax and logic errors. It does not catch **emergent behavior under real data shape**. That gap is the problem.

## 2. The solution

Migration Rehearsal Agent gives every migration a dress rehearsal against data engineered to expose exactly the failure modes production data tends to hide:

1. **Ingests** the migration script and the current schema from a connected GitHub repo.
2. **Generates** a shadow database seeded with adversarial-but-realistic data: NULL-heavy columns, duplicate/near-duplicate rows, huge table sizes, legacy/malformed formats, skewed cardinality.
3. **Executes** the migration against the shadow database.
4. **Runs** the application's real, representative queries (supplied via a lightweight query manifest) against the post-migration shadow database.
5. **Observes** correctness (did the query still return the right shape of result?) and performance (did latency change materially?).
6. **Investigates** any regression automatically: bisects across the synthetic dataset to isolate the smallest subset of rows/condition that triggers it.
7. **Proves** it: outputs the exact offending condition (e.g. "rows where `status IS NULL` and `created_at` predates the 2019 format change"), the query plan before/after, and a reproducible test case.

## 3. Target users

- **Backend/platform engineers** who own schema migrations and are tired of migrations being reviewed but not truly tested.
- **Engineering leads** who want a policy: "no migration merges without a rehearsal pass," similar to how tests gate merges today.
- **Teams running Postgres/MySQL at meaningful scale**, where "it worked in staging" has burned them before.

## 4. Core value proposition

> Code review tells you a migration is syntactically correct. Migration Rehearsal Agent tells you what it actually does to your data and your query performance — and proves it with a reproducible case, not a guess.

## 5. Key features (MVP scope)

- [ ] GitHub repo connection (read-only) to pull migration files and schema.
- [ ] Adversarial synthetic data generator, parameterized by column type/constraints inferred from schema.
- [ ] Shadow database provisioning (ephemeral, torn down after each run).
- [ ] Migration execution against the shadow DB with full logging.
- [ ] Query manifest support — user supplies a small set of representative application queries (SQL or ORM-exported).
- [ ] Before/after performance comparison per query (latency, query plan).
- [ ] Automatic root-cause narrowing (bisection over the synthetic dataset) when a regression is detected.
- [ ] Reproducible case export: the minimal data condition + a runnable script.
- [ ] Pass/fail verdict suitable for gating a CI pipeline (later phase; MVP shows it as a dashboard result).

## 6. Explicitly out of scope for MVP

- Multi-database-vendor support beyond Postgres (MySQL as a stretch goal only).
- Auto-fixing the migration (we diagnose, we don't patch).
- Full CI/CD gate integration (webhook exists conceptually; blocking a real deploy pipeline is a post-hackathon step).
- Arbitrarily large production-scale data volumes — MVP synthetic datasets are large enough to *demonstrate* the effect (thousands–low millions of rows), not to replicate real production scale.

## 7. Demo narrative (the moment that has to land)

1. Presenter connects a sample repo with a migration that adds an index and backfills a column.
2. Clicks "Run Rehearsal."
3. Live progress: shadow DB spins up → adversarial data generation → migration runs → queries run.
4. Result screen shows: 6 queries passed, 1 query regressed — **40x slower**.
5. One click → root-cause view: **"2% of rows where `legacy_format = true` bypass the new index"** — with the exact query plan diff and the 183-row minimal reproduction.
6. Close line: *"This shipped clean in every review. It would not have shipped clean here."*

## 8. Success metrics (mapped to judging rubric)

| Rubric category | How we win it |
|---|---|
| Innovation & Creativity | Adversarial data generation + automatic root-cause bisection is not "another migration linter." |
| Technical Implementation | Real systems work: data synthesis, ephemeral provisioning, query harness, profiling, bisection algorithm. |
| Impact & Relevance | Every backend engineer in the room has a war story this maps to. |
| User Experience & Design | See `ui_ux.md` — this is our highest-scoring category by design. |
| Pitch & Presentation | The "2%/40x/exact cause" line is memorable and concrete, not abstract. |
| Feasibility & Scalability | Architecture generalizes to any Postgres schema/migration without hardcoding the demo case. |

## 9. Vision beyond the hackathon

A GitHub Action / CI check that runs automatically on every PR touching `migrations/`, blocking merge on regression the same way a failing test suite would — turning "we should really load-test our migrations" from an aspiration into a default.
