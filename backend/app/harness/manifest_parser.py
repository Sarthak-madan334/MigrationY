from pathlib import Path

import yaml

from app.models.schemas import QueryManifest


def load_manifest(path: Path) -> QueryManifest:
    with path.open(encoding="utf-8") as manifest_file:
        return parse_manifest(yaml.safe_load(manifest_file))


def parse_manifest(raw_manifest: str | dict[str, object]) -> QueryManifest:
    data = yaml.safe_load(raw_manifest) if isinstance(raw_manifest, str) else raw_manifest
    return QueryManifest.model_validate(data)