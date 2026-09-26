from pathlib import Path
import subprocess
import time

import psycopg

from app.config import Settings


def provision(settings: Settings, compose_file: Path) -> psycopg.Connection:
    subprocess.run(["docker", "compose", "-f", str(compose_file), "up", "-d", "postgres"], check=True)
    deadline = time.monotonic() + 45
    while time.monotonic() < deadline:
        try:
            return psycopg.connect(settings.postgres_dsn)
        except psycopg.OperationalError:
            time.sleep(1)
    raise RuntimeError("Postgres did not become ready within 45 seconds")