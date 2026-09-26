from hmac import compare_digest
import secrets
from urllib.parse import urlencode

import httpx
from fastapi import APIRouter, HTTPException, Query, Request, Response
from fastapi.responses import RedirectResponse

from app.config import settings
from app.github_client import (
	SESSION_COOKIE,
	STATE_COOKIE,
	GitHubUser,
	clear_session_cookie,
	create_session,
	get_session,
	set_session_cookie,
)
from app.models.schemas import GitHubAuthorizationResponse, GitHubOAuthCallbackRequest, GitHubSessionResponse, GitHubUserResponse

router = APIRouter(prefix="/auth", tags=["auth"])


def _require_oauth_config() -> tuple[str, str]:
	if not settings.github_client_id or not settings.github_client_secret:
		raise HTTPException(status_code=503, detail="github_oauth_not_configured")
	return settings.github_client_id, settings.github_client_secret


def _authorization_url(client_id: str, state: str) -> str:
	query = urlencode({"client_id": client_id, "redirect_uri": settings.github_callback_url, "scope": "read:user", "state": state})
	return f"https://github.com/login/oauth/authorize?{query}"


def _set_state_cookie(response: Response, state: str) -> None:
	response.set_cookie(STATE_COOKIE, state, max_age=600, httponly=True, secure=settings.github_session_cookie_secure, samesite="lax", path="/")


async def _complete_oauth(request: Request, code: str, state: str) -> tuple[str, GitHubUser]:
	client_id, client_secret = _require_oauth_config()
	expected_state = request.cookies.get(STATE_COOKIE, "")
	if not expected_state or not compare_digest(expected_state, state):
		raise HTTPException(status_code=400, detail="invalid_oauth_state")

	try:
		async with httpx.AsyncClient(timeout=15) as client:
			token_response = await client.post(
				"https://github.com/login/oauth/access_token",
				data={
					"client_id": client_id,
					"client_secret": client_secret,
					"code": code,
					"redirect_uri": settings.github_callback_url,
					"state": state,
				},
				headers={"Accept": "application/json"},
			)
			token_response.raise_for_status()
			token = token_response.json().get("access_token")
			if not token:
				raise HTTPException(status_code=401, detail="github_token_exchange_failed")

			user_response = await client.get(
				"https://api.github.com/user",
				headers={"Accept": "application/vnd.github+json", "Authorization": f"Bearer {token}"},
			)
			user_response.raise_for_status()
			user_data = user_response.json()
	except HTTPException:
		raise
	except httpx.HTTPError as error:
		raise HTTPException(status_code=502, detail="github_oauth_unavailable") from error

	user = GitHubUser(login=user_data["login"], avatar_url=user_data.get("avatar_url", ""))
	return create_session(token, user), user


@router.get("/github/authorize", response_model=GitHubAuthorizationResponse)
async def github_oauth_authorize(response: Response) -> GitHubAuthorizationResponse:
	client_id, _ = _require_oauth_config()
	state = secrets.token_urlsafe(32)
	_set_state_cookie(response, state)
	return GitHubAuthorizationResponse(authorization_url=_authorization_url(client_id, state))


@router.get("/github/start")
async def github_oauth_start(response: Response) -> Response:
	client_id, _ = _require_oauth_config()
	state = secrets.token_urlsafe(32)
	response = RedirectResponse(_authorization_url(client_id, state), status_code=302)
	_set_state_cookie(response, state)
	return response


@router.get("/github/callback")
async def github_oauth_callback(
	request: Request,
	code: str | None = Query(None, min_length=1),
	state: str | None = Query(None, min_length=1),
	error: str | None = Query(None),
) -> Response:
	if error is not None:
		expected_state = request.cookies.get(STATE_COOKIE, "")
		if not state or not expected_state or not compare_digest(expected_state, state):
			raise HTTPException(status_code=400, detail="invalid_oauth_state")
		response = RedirectResponse(f"{settings.frontend_url.rstrip('/')}/connect?github_error=authorization_cancelled", status_code=303)
		response.delete_cookie(STATE_COOKIE, path="/")
		return response
	if code is None or state is None:
		raise HTTPException(status_code=400, detail="oauth_code_required")
	session_id, user = await _complete_oauth(request, code, state)
	response = RedirectResponse(f"{settings.frontend_url.rstrip('/')}/connect?github=connected", status_code=303)
	set_session_cookie(response, session_id)
	response.delete_cookie(STATE_COOKIE, path="/")
	return response


@router.post("/github/callback", response_model=GitHubSessionResponse)
async def github_oauth_callback_api(payload: GitHubOAuthCallbackRequest, request: Request, response: Response) -> GitHubSessionResponse:
	session_id, user = await _complete_oauth(request, payload.code, payload.state)
	set_session_cookie(response, session_id)
	response.delete_cookie(STATE_COOKIE, path="/")
	return GitHubSessionResponse(user=GitHubUserResponse(login=user.login, avatar_url=user.avatar_url))


@router.get("/github/session", response_model=GitHubSessionResponse)
async def github_session(request: Request) -> GitHubSessionResponse:
	session = get_session(request)
	if session is None:
		raise HTTPException(status_code=401, detail="github_auth_required")
	user = session[1].user
	return GitHubSessionResponse(user=GitHubUserResponse(login=user.login, avatar_url=user.avatar_url))


@router.post("/github/logout", status_code=204)
async def github_logout(request: Request, response: Response) -> Response:
	session = get_session(request)
	if session is not None:
		from app.github_client import revoke_session
		revoke_session(session[0])
	clear_session_cookie(response)
	response.status_code = 204
	return response