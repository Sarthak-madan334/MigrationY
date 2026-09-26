from pathlib import Path
import subprocess

import psycopg

from app.config import settings


def teardown(compose_file: Path, connection: psycopg.Connection | None = None) -> None:
    if settings.database_url:
        if connection is not None:
            try:
                with connection.cursor() as cursor:
                    cursor.execute("DROP SCHEMA IF EXISTS mra_shadow CASCADE")
                connection.commit()
            finally:
                connection.close()
        return
    if connection is not None:
        connection.close()
    subprocess.run(["docker", "compose", "-f", str(compose_file), "down", "-v"], check=True)
