import argparse
from pathlib import Path
import sys
import json

from app.orchestrator.pipeline import run_rehearsal

def publish(step_name: str, progress: int, message: str) -> None:
    print(f"[{progress:3d}%] {step_name.upper()}: {message}")

def main():
    parser = argparse.ArgumentParser(description="The Migration Rehearsal Agent CLI")
    parser.add_argument("--schema", type=str, help="Path to schema.sql (Currently mocked by pipeline.py)")
    parser.add_argument("--migration", type=str, help="Path to migration.sql (Currently mocked by pipeline.py)")
    parser.add_argument("--models", type=str, help="Path to ORM models (Optional)")
    parser.add_argument("--manifest", type=str, help="Path to queries manifest YAML", default=None)
    parser.add_argument("--rows", type=int, help="Number of rows to generate", default=1000)
    args = parser.parse_args()

    repo_root = Path(__file__).resolve().parent.parent

    print(f"=== Starting Migration Rehearsal ===")
    if args.schema: print(f"Schema: {args.schema}")
    if args.migration: print(f"Migration: {args.migration}")
    
    raw_manifest = None
    if args.manifest:
        try:
            with open(args.manifest, "r") as f:
                raw_manifest = f.read()
        except Exception as e:
            print(f"Failed to read manifest: {e}")
            sys.exit(1)

    corruption_profile = {
        "row_count_per_table": args.rows,
        "null_pressure": 0.15,
        "duplication_rate": 0.05,
        "legacy_format_rate": 0.02
    }

    try:
        results = run_rehearsal(repo_root, corruption_profile, raw_manifest, publish)
        
        print("\n" + "="*40)
        print("          REHEARSAL REPORT")
        print("="*40)
        
        has_regressions = False
        for res in results:
            verdict = res["verdict"]
            if verdict == "regressed":
                has_regressions = True
                
            print(f"Query ID: {res['id']} | Verdict: {verdict.upper()}")
            print(f"  SQL: {res['sql']}")
            print(f"  Latency Before: {res['latency_before_ms']} ms")
            print(f"  Latency After:  {res['latency_after_ms']} ms")
            print(f"  Regression Factor: {res['regression_factor']}x")
            print("-" * 40)
            
        if has_regressions:
            print("\nWARNING: Regressions detected! Check the report above.")
            sys.exit(1)
        else:
            print("\nSUCCESS: No regressions detected.")
            
    except Exception as e:
        print(f"\nPipeline execution failed: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()
