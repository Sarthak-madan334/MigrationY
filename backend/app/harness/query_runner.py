from dataclasses import dataclass
from time import perf_counter

import psycopg


@dataclass(frozen=True)
class QueryMeasurement:
    sql: str
    latency_ms: float
    row_count: int


def explain_query(connection: psycopg.Connection, sql: str) -> str:
    with connection.cursor() as cursor:
        cursor.execute(f"EXPLAIN (FORMAT TEXT) {sql}")
        return "\n".join(row[0] for row in cursor.fetchall())


def run_query(connection: psycopg.Connection, sql: str) -> QueryMeasurement:
    started = perf_counter()
    with connection.cursor() as cursor:
        cursor.execute(sql)
        rows = cursor.fetchall()
    return QueryMeasurement(sql=sql, latency_ms=(perf_counter() - started) * 1000, row_count=len(rows))