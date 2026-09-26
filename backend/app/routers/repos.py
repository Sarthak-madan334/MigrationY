import base64
import re
from urllib.parse import quote

import httpx
from fastapi import APIRouter, HTTPException, Query, Request

from app.github_client import github_get, get_session
from app.models.schemas import GitHubMigration, GitHubMigrationList, GitHubMigrationSource, GitHubRepo, GitHubRepoList

router = APIRouter(prefix="/repos", tags=["repos"])

MIGRATION_DIRECTORY_NAMES = {
	"migration", "migrations", "migrate", "versions", "changesets",
	"changelog", "changelogs", "drizzle",
}
MIGRATION_SUFFIXES = {".sql", ".py", ".rb", ".js", ".ts", ".php"}
PREVIEW_LIMIT = 1800
MIGRATION_LIMIT = 100
MAX_MIGRATION_BYTES = 100_000


def _is_migration_path(path: str) -> bool:
	parts = path.replace("\\", "/").lower().split("/")
	if any(part in MIGRATION_DIRECTORY_NAMES for part in parts[:-1]):
		return path.lower().endswith(tuple(MIGRATION_SUFFIXES))
	# Flyway permits a flat migration directory and identifies versions by filename.
	return bool(re.match(r"^v\d+__.+\.sql$", parts[-1]))


def _validate_sql_migration_path(path: str) -> None:
	normalized = path.replace("\\", "/")
	if normalized.startswith("/") or any(part in {"", ".", ".."} for part in normalized.split("/")):
		raise HTTPException(status_code=400, detail="invalid_migration_path")
	if not _is_migration_path(normalized) or not normalized.lower().endswith(".sql"):
		raise HTTPException(status_code=422, detail="postgres_sql_migration_required")


def _require_token(request: Request) -> str:
	session = get_session(request)
	if session is None:
		raise HTTPException(status_code=401, detail="github_auth_required")
	return session[1].token


def _detect_dialect(path: str, content: str) -> str:
	parts = path.replace("\\", "/").lower().split("/")
	if "versions" in parts and path.lower().endswith(".py"):
		return "python/alembic"
	if path.endswith(".rb"):
		return "ruby/activerecord"
	if path.lower().endswith(".php"):
		return "php/laravel"
	if path.lower().endswith((".js", ".ts")):
		return "javascript/typescript"
	if path.endswith(".sql") or any(marker in content.upper() for marker in ("JSONB", "ILIKE", "SERIAL", "::JSON", "CREATE EXTENSION")):
		return "postgres"
	if path.lower().endswith(".py"):
		return "python"
	return "sql"


async def _request_github(client: httpx.AsyncClient, path: str, token: str, **kwargs) -> httpx.Response:
	try:
		response = await github_get(client, path, token, **kwargs)
		response.raise_for_status()
		return response
	except httpx.HTTPError as error:
		raise HTTPException(status_code=502, detail="github_api_request_failed") from error


@router.get("", response_model=GitHubRepoList)
async def list_repositories(request: Request) -> GitHubRepoList:
	session = get_session(request)
	if session is None:
		raise HTTPException(status_code=401, detail="github_auth_required")
	token = session[1].token
	repositories: list[GitHubRepo] = []
	url = f"/users/{quote(session[1].user.login, safe='')}/repos"
	params = {"per_page": 100, "sort": "updated"}
	try:
		async with httpx.AsyncClient(timeout=20) as client:
			for _ in range(10):
				response = await _request_github(client, url, token, params=params)
				for repo in response.json():
					repositories.append(GitHubRepo(
						id=str(repo["id"]),
						full_name=repo["full_name"],
						default_branch=repo.get("default_branch") or "main",
					))
				next_page = response.links.get("next", {}).get("url")
				if not next_page:
					break
				url = next_page
				params = {}
	except httpx.HTTPError as error:
		raise HTTPException(status_code=502, detail="github_repo_list_failed") from error
	return GitHubRepoList(repos=repositories)


@router.get("/{repo_id}/migrations", response_model=GitHubMigrationList)
async def list_migrations(repo_id: str, request: Request) -> GitHubMigrationList:
	if not repo_id.isdecimal():
		raise HTTPException(status_code=422, detail="repo_id_must_be_numeric")
	token = _require_token(request)
	try:
		async with httpx.AsyncClient(timeout=20) as client:
			repo_response = await _request_github(client, f"/repositories/{repo_id}", token)
			repo = repo_response.json()
			full_name = repo["full_name"]
			branch = repo.get("default_branch") or "main"
			tree_path = f"/repos/{full_name}/git/trees/{quote(branch, safe='')}"
			tree_response = await _request_github(client, tree_path, token, params={"recursive": "1"})
			tree = tree_response.json().get("tree", [])
			candidates = [
				item for item in tree
				if item.get("type") == "blob"
				and _is_migration_path(item.get("path", ""))
			]
			migrations: list[GitHubMigration] = []
			for item in sorted(candidates, key=lambda value: value["path"].casefold())[:MIGRATION_LIMIT]:
				content = ""
				if item.get("size", 0) <= 100_000:
					blob_path = f"/repos/{full_name}/git/blobs/{item['sha']}"
					blob_response = await _request_github(client, blob_path, token)
					blob = blob_response.json()
					content = base64.b64decode(blob.get("content", "")).decode("utf-8", errors="replace")
				preview = "\n".join(content.splitlines()[:16])[:PREVIEW_LIMIT]
				if not content:
					preview = "Preview unavailable for files larger than 100 KB."
				migrations.append(GitHubMigration(
					path=item["path"],
					diff_preview=preview,
					detected_dialect=_detect_dialect(item["path"], content),
				))
	except httpx.HTTPError as error:
		raise HTTPException(status_code=502, detail="github_migration_scan_failed") from error
	return GitHubMigrationList(migrations=migrations)


@router.get("/{repo_id}/migrations/content", response_model=GitHubMigrationSource)
async def get_migration_source(
	repo_id: str,
	request: Request,
	path: str = Query(min_length=1, max_length=1024),
) -> GitHubMigrationSource:
	if not repo_id.isdecimal():
		raise HTTPException(status_code=422, detail="repo_id_must_be_numeric")
	_validate_sql_migration_path(path)
	token = _require_token(request)
	try:
		async with httpx.AsyncClient(timeout=20) as client:
			repo_response = await _request_github(client, f"/repositories/{repo_id}", token)
			repo = repo_response.json()
			full_name = repo["full_name"]
			branch = repo.get("default_branch") or "main"
			file_path = f"/repos/{full_name}/contents/{quote(path, safe='/')}"
			file_response = await _request_github(client, file_path, token, params={"ref": branch})
			file_data = file_response.json()
			if file_data.get("type") != "file":
				raise HTTPException(status_code=404, detail="migration_not_found")
			if int(file_data.get("size", 0)) > MAX_MIGRATION_BYTES:
				raise HTTPException(status_code=413, detail="migration_file_too_large")
			encoded_content = file_data.get("content", "")
			if file_data.get("encoding") != "base64" or not encoded_content.strip():
				raise HTTPException(status_code=422, detail="migration_content_unavailable")
			content = base64.b64decode(encoded_content).decode("utf-8", errors="strict")
			if len(content.encode("utf-8")) > MAX_MIGRATION_BYTES:
				raise HTTPException(status_code=413, detail="migration_file_too_large")
			return GitHubMigrationSource(path=path, sql=content)
	except HTTPException:
		raise
	except (httpx.HTTPError, KeyError, ValueError, UnicodeDecodeError) as error:
		raise HTTPException(status_code=502, detail="github_migration_fetch_failed") from error
