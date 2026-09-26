# scaffold.md — Project Structure

This is the exact folder/file layout an AI coding agent should generate. Create it in this order: backend skeleton → data generator → frontend skeleton → wiring.

```
migration-rehearsal-agent/
├── README.md
├── docs/                          # this doc set lives here
│   ├── product.md
│   ├── architecture.md
│   ├── ui_ux.md
│   ├── api_spec.md
│   ├── scaffold.md
│   ├── implementation_plan.md
│   ├── agent_instructions.md
│   └── essentials.md
│
├── backend/
│   ├── app/
│   │   ├── main.py                # FastAPI app entrypoint, route registration
│   │   ├── config.py               # env var loading, settings
│   │   ├── routers/
│   │   │   ├── auth.py            # GitHub OAuth endpoints
│   │   │   ├── repos.py           # repo listing, migration detection
│   │   │   └── rehearsal.py       # run lifecycle endpoints (api_spec.md §2)
│   │   ├── orchestrator/
│   │   │   ├── run_state.py       # state machine: queued -> ... -> done/failed
│   │   │   └── pipeline.py        # coordinates generator -> shadow db -> harness -> bisector
│   │   ├── generator/
│   │   │   ├── schema_introspect.py  # reads DDL, infers column types/constraints
│   │   │   ├── corrupt.py            # null-pressure, duplication, legacy-format, skew profiles
│   │   │   └── faker_profiles.py     # Faker-based realistic base value generation
│   │   ├── shadow_db/
│   │   │   ├── provision.py       # spins up ephemeral Postgres (Docker / Fly.io / Railway)
│   │   │   └── teardown.py
│   │   ├── harness/
│   │   │   ├── query_runner.py    # executes query manifest, times it, captures EXPLAIN
│   │   │   └── manifest_parser.py # parses YAML/SQL query manifest
│   │   ├── bisector/
│   │   │   └── delta_debug.py     # ddmin-style bisection over row subsets
│   │   ├── reporting/
│   │   │   └── report_builder.py  # assembles final JSON result + repro script
│   │   └── models/
│   │       └── schemas.py         # Pydantic request/response models (mirrors api_spec.md)
│   ├── tests/
│   │   ├── test_generator.py
│   │   ├── test_harness.py
│   │   └── test_bisector.py
│   ├── sample_manifests/
│   │   └── sample_query_manifest.yaml
│   ├── requirements.txt
│   └── Dockerfile
│
├── frontend/
│   ├── app/
│   │   ├── page.tsx                # Landing (ui_ux.md §4.1)
│   │   ├── connect/page.tsx        # Connect flow (§4.2)
│   │   ├── run/[id]/page.tsx       # Live Rehearsal Run (§4.3)
│   │   ├── run/[id]/report/page.tsx  # Results Dashboard (§4.4)
│   │   ├── run/[id]/cause/page.tsx   # Root-Cause Drill-down (§4.5)
│   │   └── history/page.tsx        # History (§4.6)
│   ├── components/
│   │   ├── PipelineStages.tsx      # the node-sequence pipeline visual
│   │   ├── LiveLogPanel.tsx        # streaming terminal-style log
│   │   ├── VerdictBanner.tsx       # pass/fail banner
│   │   ├── QueryResultsTable.tsx
│   │   ├── PlanDiff.tsx            # before/after EXPLAIN tree diff
│   │   ├── BisectionTrail.tsx      # shrinking-bar-segment visual
│   │   └── ui/                     # buttons, cards, stepper — shared primitives
│   ├── lib/
│   │   ├── api.ts                  # typed fetch wrappers matching api_spec.md
│   │   └── sse.ts                  # SSE client for live run status
│   ├── styles/
│   │   └── tokens.css              # design tokens from ui_ux.md §2.1 as CSS variables
│   ├── package.json
│   └── tailwind.config.ts
│
├── infra/
│   ├── docker-compose.yml          # local shadow Postgres + backend for dev
│   └── fly.toml                    # hosted ephemeral container config (demo deploy)
│
└── .env.example
```

## Build order (maps to implementation_plan.md phases)

1. `backend/app/generator/` + `backend/app/shadow_db/` — prove data generation + provisioning works standalone (script, no API yet).
2. `backend/app/harness/` — prove before/after timing + EXPLAIN capture works against the shadow DB from step 1.
3. `backend/app/orchestrator/` + `backend/app/routers/rehearsal.py` — wire the above into the run lifecycle + API.
4. `backend/app/bisector/` — add root-cause narrowing once regressions can be reliably triggered.
5. `frontend/` — build screens in this order: Connect → Live Run → Results Dashboard → Root-Cause Drill-down → Landing (landing last; it's static and lowest-risk).
6. `infra/` — containerize and deploy last, once the local flow works end-to-end.
