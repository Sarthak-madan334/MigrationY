from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
import secrets
from threading import RLock

from fastapi import Request, Response
import httpx

from app.config import settings


GITHUB_API = "https://api.github.com"
SESSION_COOKIE = "mra_github_session"
STATE_COOKIE = "mra_github_oauth_state"


@dataclass(frozen=True)
class GitHubUser:
    login: str
    avatar_url: str


@dataclass(frozen=True)
class GitHubSession:
    token: str
    user: GitHubUser
    expires_at: datetime


_sessions: dict[str, GitHubSession] = {}
_sessions_lock = RLock()


def create_session(token: str, user: GitHubUser) -> str:
    session_id = secrets.token_urlsafe(32)
    expires_at = datetime.now(timezone.utc) + timedelta(seconds=settings.github_session_ttl_seconds)
    with _sessions_lock:
        _purge_expired_sessions()
        _sessions[session_id] = GitHubSession(token=token, user=user, expires_at=expires_at)
    return session_id


def get_session(request: Request) -> tuple[str, GitHubSession] | None:
    session_id = request.cookies.get(SESSION_COOKIE)
    if not session_id:
        return None
    with _sessions_lock:
        _purge_expired_sessions()
        session = _sessions.get(session_id)
        return (session_id, session) if session else None


def revoke_session(session_id: str) -> None:
    with _sessions_lock:
        _sessions.pop(session_id, None)


def _purge_expired_sessions() -> None:
    now = datetime.now(timezone.utc)
    for session_id in [key for key, value in _sessions.items() if value.expires_at <= now]:
        _sessions.pop(session_id, None)


def set_session_cookie(response: Response, session_id: str) -> None:
    response.set_cookie(
        SESSION_COOKIE,
        session_id,
        max_age=settings.github_session_ttl_seconds,
        httponly=True,
        secure=settings.github_session_cookie_secure,
        samesite="lax",
        path="/",
    )


def clear_session_cookie(response: Response) -> None:
    response.delete_cookie(SESSION_COOKIE, path="/")


async def github_get(client: httpx.AsyncClient, path: str, token: str, **kwargs) -> httpx.Response:
    request_headers = {
        "Accept": "application/vnd.github+json",
        "Authorization": f"Bearer {token}",
        "X-GitHub-Api-Version": "2022-11-28",
    }
    request_headers.update(kwargs.pop("headers", {}))
    url = path if path.startswith("https://") else f"{GITHUB_API}{path}"
    return await client.get(
        url,
        headers=request_headers,
        **kwargs,
    )