from pathlib import Path
import subprocess


def teardown(compose_file: Path) -> None:
    subprocess.run(["docker", "compose", "-f", str(compose_file), "down", "-v"], check=True)