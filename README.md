# Migration Rehearsal Agent

Phase 0 proves the core rehearsal path locally: generate a hostile dataset, apply a migration, and compare a representative query before and after the migration.

## Run Phase 0
Requirements: Python 3.11+, Docker Desktop, and Docker Compose.

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r backend\requirements.txt
python backend\run_phase0.py
```

The CLI provisions PostgreSQL on port `5433`, seeds 50,000 orders, applies the hardcoded migration, runs the sample query before and after it, prints latency, and tears the database down.
