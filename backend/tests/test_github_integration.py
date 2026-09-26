import base64
from types import SimpleNamespace
from urllib.parse import parse_qs, urlsplit

from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.routers import auth, repos
from app.routers.repos import _detect_dialect, _is_migration_path


def test_migration_path_detection_covers_common_layouts() -> None:
	for path in (
		"migrations/001_add_index.sql",
		"db/migrate/20260926_add_index.rb",
		"alembic/versions/abc_add_index.py",
		"prisma/migrations/20260926000000_add_index/migration.sql",
		"services/billing/migrations/004_add_column.sql",
		"db/changelog/changeset_12.sql",
		"V12__add_index.sql",
	):
		assert _is_migration_path(path), path

	for path in ("database/README.sql", "src/query.sql", "README.md"):
		assert not _is_migration_path(path), path

	assert _detect_dialect("db/migrate/change.php", "") == "php/laravel"
	assert _detect_dialect("src/migrations/change.ts", "") == "javascript/typescript"
	assert _detect_dialect("src/migrations/change.py", "") == "python"


class FakeResponse:
	def __init__(self, data: object, links: dict[str, object] | None = None) -> None:
		self.data = data
		self.links = links or {}

	def json(self) -> object:
		return self.data

	def raise_for_status(self) -> None:
		return None


class FakeGitHubClient:
	def __init__(self, **_kwargs: object) -> None:
		pass

	async def __aenter__(self):
		return self

	async def __aexit__(self, *_args: object) -> None:
		return None

	async def post(self, url: str, **_kwargs: object) -> FakeResponse:
		assert url == "https://github.com/login/oauth/access_token"
		return FakeResponse({"access_token": "test-github-token"})

	async def get(self, url: str, **_kwargs: object) -> FakeResponse:
		if url == "https://api.github.com/user":
			return FakeResponse({"login": "octocat", "avatar_url": "https://example.test/avatar.png"})
		if url == "https://api.github.com/users/octocat/repos":
			return FakeResponse([{"id": 42, "full_name": "octocat/sample", "default_branch": "main"}])
		if url == "https://api.github.com/repositories/42":
			return FakeResponse({"full_name": "octocat/sample", "default_branch": "main"})
		if url == "https://api.github.com/repos/octocat/sample/git/trees/main":
			return FakeResponse({"tree": [
				{"path": "migrations/001_index.sql", "type": "blob", "size": 60, "sha": "sql"},
				{"path": "db/migrate/20260101_add_index.rb", "type": "blob", "size": 40, "sha": "ruby"},
				{"path": "alembic/versions/abc_add_index.py", "type": "blob", "size": 35, "sha": "python"},
				{"path": "README.md", "type": "blob", "size": 20, "sha": "readme"},
			]})
		contents = {
			"https://api.github.com/repos/octocat/sample/git/blobs/sql": "CREATE INDEX events_created_at_idx ON events (created_at);",
			"https://api.github.com/repos/octocat/sample/git/blobs/ruby": "add_index :events, :created_at",
			"https://api.github.com/repos/octocat/sample/git/blobs/python": "op.create_index('events_created_at_idx', 'events', ['created_at'])",
			"https://api.github.com/repos/octocat/sample/git/blobs/readme": "not a migration",
		}
		if url in contents:
			return FakeResponse({"content": base64.b64encode(contents[url].encode()).decode()})
		raise AssertionError(f"Unexpected GitHub URL: {url}")


def test_oauth_state_and_migration_discovery(monkeypatch) -> None:
	monkeypatch.setattr(auth, "settings", SimpleNamespace(
		github_client_id="client-id",
		github_client_secret="client-secret",
		github_callback_url="http://localhost:8000/api/auth/github/callback",
		frontend_url="http://localhost:3000",
		github_session_cookie_secure=False,
	))
	monkeypatch.setattr(auth.httpx, "AsyncClient", FakeGitHubClient)
	app = FastAPI()
	app.include_router(auth.router, prefix="/api")
	app.include_router(repos.router, prefix="/api")

	with TestClient(app) as client:
		start = client.get("/api/auth/github/authorize")
		assert start.status_code == 200
		authorization = parse_qs(urlsplit(start.json()["authorization_url"]).query)
		state = authorization["state"][0]
		assert authorization["scope"] == ["read:user"]
		assert "mra_github_oauth_state" in start.headers["set-cookie"]

		callback = client.get(f"/api/auth/github/callback?code=test-code&state={state}", follow_redirects=False)
		assert callback.status_code == 303
		assert callback.headers["location"] == "http://localhost:3000/connect?github=connected"
		assert "mra_github_session" in callback.headers["set-cookie"]
		assert "httponly" in callback.headers["set-cookie"].lower()

		session = client.get("/api/auth/github/session")
		repository_list = client.get("/api/repos")
		migrations = client.get("/api/repos/42/migrations")
		invalid_state = client.get("/api/auth/github/callback?code=test-code&state=wrong", follow_redirects=False)
		cancel_start = client.get("/api/auth/github/authorize")
		cancel_state = parse_qs(urlsplit(cancel_start.json()["authorization_url"]).query)["state"][0]
		cancelled = client.get(f"/api/auth/github/callback?error=access_denied&state={cancel_state}", follow_redirects=False)
		logout = client.post("/api/auth/github/logout")
		session_after_logout = client.get("/api/auth/github/session")

	assert session.json() == {"user": {"login": "octocat", "avatar_url": "https://example.test/avatar.png"}}
	assert repository_list.json()["repos"] == [{"id": "42", "full_name": "octocat/sample", "default_branch": "main"}]
	items = migrations.json()["migrations"]
	assert [item["path"] for item in items] == [
		"alembic/versions/abc_add_index.py",
		"db/migrate/20260101_add_index.rb",
		"migrations/001_index.sql",
	]
	assert items[0]["detected_dialect"] == "python/alembic"
	assert items[1]["detected_dialect"] == "ruby/activerecord"
	assert items[2]["detected_dialect"] == "postgres"
	assert items[2]["diff_preview"].startswith("CREATE INDEX")
	assert invalid_state.status_code == 400
	assert cancelled.status_code == 303
	assert cancelled.headers["location"].endswith("/connect?github_error=authorization_cancelled")
	assert logout.status_code == 204
	assert session_after_logout.status_code == 401


def test_repository_listing_requires_session() -> None:
	app = FastAPI()
	app.include_router(repos.router, prefix="/api")
	with TestClient(app) as client:
		response = client.get("/api/repos")
	assert response.status_code == 401
