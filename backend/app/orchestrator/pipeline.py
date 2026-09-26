from dataclasses import dataclass
from pathlib import Path
import re
from threading import Lock
from statistics import median
from typing import Final

import psycopg
from psycopg import sql as psycopg_sql

from app.bisector.delta_debug import minimize_failing_subset
from app.config import settings
from app.generator.corrupt import OrderRow, generate_orders
from app.generator.schema_introspect import get_phase0_schema
from app.harness.manifest_parser import load_manifest, parse_manifest
from app.harness.query_runner import QueryMeasurement, explain_query, run_query
from app.shadow_db.provision import provision
from app.shadow_db.teardown import teardown


PHASE0_MIGRATION: Final[str] = "CREATE INDEX orders_status_idx ON orders (status)"
PHASE1_MIGRATION: Final[str] = "DROP INDEX orders_created_at_idx; CREATE INDEX orders_status_idx ON orders (status)"
PHASE0_QUERY: Final[str] = "SELECT COUNT(*) FROM orders WHERE status IS NULL"
_SHADOW_DB_LOCK = Lock()


@dataclass(frozen=True)
class BisectionOutcome:
    minimal_condition: str
    minimal_row_count: int
    bisection_trail: tuple[int, ...]
    repro_script: str


def seed_orders(connection: psycopg.Connection, rows: list[OrderRow]) -> None:
    with connection.cursor() as cursor:
        cursor.executemany(
            "INSERT INTO orders (customer_email, status, total_cents, created_at, legacy_format) VALUES (%s, %s, %s, %s, %s)",
            [(row.customer_email, row.status, row.total_cents, row.created_at, row.legacy_format) for row in rows],
        )
    connection.commit()


def run_phase0(repo_root: Path, row_count: int = 50_000) -> tuple[QueryMeasurement, QueryMeasurement]:
    compose_file = repo_root / "infra" / "docker-compose.yml"
    connection = provision(settings, compose_file)
    try:
        with connection.cursor() as cursor:
            cursor.execute(get_phase0_schema())
        connection.commit()

        rows = list(generate_orders(row_count=row_count, null_pressure=0.15))
        seed_orders(connection, rows)
        before = run_query(connection, PHASE0_QUERY)

        with connection.cursor() as cursor:
            cursor.execute(PHASE0_MIGRATION)
        connection.commit()
        connection.execute("ANALYZE orders")
        after = run_query(connection, PHASE0_QUERY)
        return before, after
    finally:
        connection.close()
        teardown(compose_file)


def sample_manifest_path(repo_root: Path) -> Path:
    return repo_root / "backend" / "sample_manifests" / "sample_query_manifest.yaml"


def validate_sample_manifest(repo_root: Path) -> None:
    load_manifest(sample_manifest_path(repo_root))


def _run_rehearsal(
    repo_root: Path,
    corruption_profile: dict[str, float | int],
    raw_manifest: str | None,
    publish: callable,
    migration_sql: str | None = None,
) -> list[dict[str, object]]:
    """Run one measured rehearsal while publishing state transitions to the API."""
    compose_file = repo_root / "infra" / "docker-compose.yml"
    connection: psycopg.Connection | None = None
    try:
        publish("provisioning", 10, "Provisioning isolated Postgres shadow database")
        connection = provision(settings, compose_file)
        with connection.cursor() as cursor:
            cursor.execute(get_phase0_schema())
        connection.commit()

        row_count = int(corruption_profile.get("row_count_per_table", 50_000))
        publish("seeding", 25, f"Generating and seeding {row_count:,} rows into orders")
        rows = list(generate_orders(
            row_count=row_count,
            null_pressure=float(corruption_profile.get("null_pressure", 0.15)),
            duplication_rate=float(corruption_profile.get("duplication_rate", 0.05)),
            legacy_format_rate=float(corruption_profile.get("legacy_format_rate", 0.02)),
        ))
        seed_orders(connection, rows)

        manifest = parse_manifest(raw_manifest) if raw_manifest else load_manifest(sample_manifest_path(repo_root))
        with connection.cursor() as cursor:
            cursor.execute("CREATE INDEX orders_created_at_idx ON orders (created_at)")
        connection.commit()
        applied_migration = migration_sql or PHASE1_MIGRATION
        publish("migrating", 45, "Applying selected GitHub migration" if migration_sql else "Applying phase0/add_status_index.sql")
        measurements_before = [(item, _median_query_latency(connection, item.sql), explain_query(connection, item.sql)) for item in manifest.queries]
        with connection.cursor() as cursor:
            cursor.execute(applied_migration)
        connection.commit()
        connection.execute("ANALYZE orders")

        publish("querying", 65, f"Running query manifest ({len(manifest.queries)} queries)")
        measurements_after = [(item, _median_query_latency(connection, item.sql), explain_query(connection, item.sql)) for item in manifest.queries]
        publish("analyzing", 85, "Comparing latency and query plans")
        results: list[dict[str, object]] = []
        for (item, before, before_plan), (_, after, after_plan) in zip(measurements_before, measurements_after, strict=True):
            factor = after / max(before, 0.01)
            results.append({
                "id": item.id,
                "sql": item.sql,
                "latency_before_ms": round(before, 2),
                "latency_after_ms": round(after, 2),
                "regression_factor": round(factor, 2),
                "verdict": "regressed" if _query_regressed(factor, before_plan, after_plan) else "passed",
                "plan_before": before_plan,
                "plan_after": after_plan,
            })
        return results
    finally:
        if connection is not None:
            connection.close()
        teardown(compose_file)


def run_rehearsal(
    repo_root: Path,
    corruption_profile: dict[str, float | int],
    raw_manifest: str | None,
    publish: callable,
    migration_sql: str | None = None,
) -> list[dict[str, object]]:
    """Serialize access to the shared local shadow Postgres service."""
    with _SHADOW_DB_LOCK:
        return _run_rehearsal(repo_root, corruption_profile, raw_manifest, publish, migration_sql)


def _plan_signature(plan: str) -> tuple[str, ...]:
    return tuple(re.sub(r"\s+\(cost=.*$", "", line.strip()) for line in plan.splitlines())


def _query_regressed(factor: float, before_plan: str, after_plan: str) -> bool:
	return factor >= 3 or _plan_signature(before_plan) != _plan_signature(after_plan)


def _median_query_latency(connection: psycopg.Connection, query: str) -> float:
    run_query(connection, query)
    return median(run_query(connection, query).latency_ms for _ in range(5))


def _build_repro_script(
    connection: psycopg.Connection,
    rows: tuple[OrderRow, ...],
    row_ids: dict[int, int],
    query: str,
) -> str:
    statements = [
        "-- Minimal generated dataset that preserves the measured plan regression.",
        get_phase0_schema().strip() + ";",
    ]
    if rows:
        values = []
        for row in rows:
            literals = (
                row_ids[id(row)],
                row.customer_email,
                row.status,
                row.total_cents,
                row.created_at,
                row.legacy_format,
            )
            values.append("(" + ", ".join(psycopg_sql.Literal(value).as_string(connection) for value in literals) + ")")
        statements.append(
            "INSERT INTO orders (id, customer_email, status, total_cents, created_at, legacy_format) VALUES\n"
            + ",\n".join(values)
            + ";"
        )

    normalized_query = query.strip().rstrip(";")
    statements.extend((
        "CREATE INDEX orders_created_at_idx ON orders (created_at);",
        "ANALYZE orders;",
        "-- Query plan before the migration.",
        f"EXPLAIN (ANALYZE, BUFFERS) {normalized_query};",
        PHASE1_MIGRATION + ";",
        "ANALYZE orders;",
        "-- Query plan after the migration.",
        f"EXPLAIN (ANALYZE, BUFFERS) {normalized_query};",
    ))
    return "\n\n".join(statements) + "\n"


def run_bisection(
    repo_root: Path,
    corruption_profile: dict[str, float | int],
    query_id: str,
    query: str,
    baseline_plan_before: str,
    baseline_plan_after: str,
    publish: callable,
) -> BisectionOutcome:
    """Recreate a run's data and minimize rows that preserve its plan regression."""
    with _SHADOW_DB_LOCK:
        return _run_bisection(
            repo_root,
            corruption_profile,
            query_id,
            query,
            baseline_plan_before,
            baseline_plan_after,
            publish,
        )


def _run_bisection(
    repo_root: Path,
    corruption_profile: dict[str, float | int],
    query_id: str,
    query: str,
    baseline_plan_before: str,
    baseline_plan_after: str,
    publish: callable,
) -> BisectionOutcome:
    compose_file = repo_root / "infra" / "docker-compose.yml"
    connection: psycopg.Connection | None = None
    try:
        publish("bisecting", 86, f"Recreating generated rows to bisect {query_id}")
        connection = provision(settings, compose_file)
        with connection.cursor() as cursor:
            cursor.execute(get_phase0_schema())
        connection.commit()

        rows = list(generate_orders(
            row_count=int(corruption_profile.get("row_count_per_table", 50_000)),
            null_pressure=float(corruption_profile.get("null_pressure", 0.15)),
            duplication_rate=float(corruption_profile.get("duplication_rate", 0.05)),
            legacy_format_rate=float(corruption_profile.get("legacy_format_rate", 0.02)),
        ))
        row_ids = {id(row): index for index, row in enumerate(rows, start=1)}
        seed_orders(connection, rows)
        with connection.cursor() as cursor:
            cursor.execute("CREATE INDEX orders_created_at_idx ON orders (created_at)")
        connection.commit()
        connection.execute("ANALYZE orders")
        preserve_plan_change = _plan_signature(baseline_plan_before) != _plan_signature(baseline_plan_after)

        def reproduces(candidate: tuple[OrderRow, ...]) -> bool:
            connection.execute("SAVEPOINT bisection_candidate")
            try:
                candidate_ids = [row_ids[id(row)] for row in candidate]
                with connection.cursor() as cursor:
                    cursor.execute("DELETE FROM orders WHERE NOT (id = ANY(%s))", (candidate_ids,))
                connection.execute("ANALYZE orders")
                before_plan = explain_query(connection, query)
                if not preserve_plan_change:
                    before_latency = _median_query_latency(connection, query)

                with connection.cursor() as cursor:
                    cursor.execute("DROP INDEX orders_created_at_idx")
                    cursor.execute("CREATE INDEX orders_status_idx ON orders (status)")
                connection.execute("ANALYZE orders")
                after_plan = explain_query(connection, query)
                if not preserve_plan_change:
                    after_latency = _median_query_latency(connection, query)

                if preserve_plan_change:
                    return _plan_signature(before_plan) != _plan_signature(after_plan)
                return after_latency >= before_latency * 3
            finally:
                connection.execute("ROLLBACK TO SAVEPOINT bisection_candidate")
                connection.execute("RELEASE SAVEPOINT bisection_candidate")
                connection.commit()

        result = minimize_failing_subset(rows, reproduces)
        minimal_row_count = len(result.subset)
        row_label = "order" if minimal_row_count == 1 else "orders"
        publish("bisecting", 96, f"Found a reproducing subset of {minimal_row_count:,} {row_label}")
        script = _build_repro_script(connection, result.subset, row_ids, query)
        return BisectionOutcome(
            minimal_condition=f"The query regression persists with {minimal_row_count:,} generated {row_label}.",
            minimal_row_count=minimal_row_count,
            bisection_trail=result.trail,
            repro_script=script,
        )
    finally:
        if connection is not None:
            connection.close()
        teardown(compose_file)