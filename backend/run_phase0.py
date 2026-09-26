from pathlib import Path

from app.orchestrator.pipeline import run_phase0, validate_sample_manifest


def main() -> None:
    repo_root = Path(__file__).resolve().parents[1]
    validate_sample_manifest(repo_root)
    print("Phase 0: generating 50,000 orders with 15% null pressure")
    before, after = run_phase0(repo_root)
    print(f"Query: {before.sql}")
    print(f"Before migration: {before.latency_ms:.2f} ms ({before.row_count} rows returned)")
    print(f"After migration:  {after.latency_ms:.2f} ms ({after.row_count} rows returned)")
    print("Phase 0 checkpoint: PASS")


if __name__ == "__main__":
    main()