"""Request authentication.

Supports three token sources:
  * Supabase legacy HS256 tokens (SUPABASE_JWT_SECRET)
  * Supabase asymmetric tokens (ES256/RS256), verified via the project's JWKS
  * Local dev tokens (AUTH_MODE=dev) issued by POST /api/v1/auth/dev-login

On every authenticated request we make sure a `profiles` row exists for the
user, because activities/logs reference profiles.id via foreign keys.
"""

import time
import uuid
from datetime import datetime, timedelta, timezone

import httpx
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwt
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.database import get_db
from app.models import Profile

security = HTTPBearer(auto_error=False)

_JWKS_TTL_SECONDS = 600
_jwks_cache: dict = {"keys": None, "fetched_at": 0.0}
_known_profiles: set[uuid.UUID] = set()


def _unauthorized(detail: str) -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail=detail,
        headers={"WWW-Authenticate": "Bearer"},
    )


async def _get_jwks(force: bool = False) -> list[dict]:
    settings = get_settings()
    if not settings.supabase_url:
        return []
    now = time.monotonic()
    if not force and _jwks_cache["keys"] is not None and now - _jwks_cache["fetched_at"] < _JWKS_TTL_SECONDS:
        return _jwks_cache["keys"]
    url = settings.supabase_url.rstrip("/") + "/auth/v1/.well-known/jwks.json"
    async with httpx.AsyncClient(timeout=5) as client:
        resp = await client.get(url)
        resp.raise_for_status()
        keys = resp.json().get("keys", [])
    _jwks_cache.update(keys=keys, fetched_at=now)
    return keys


async def _decode_supabase(token: str) -> dict:
    settings = get_settings()
    try:
        header = jwt.get_unverified_header(token)
    except JWTError as e:
        raise _unauthorized(f"Invalid token: {e}")

    alg = header.get("alg", "")
    if alg == "HS256":
        if not settings.supabase_jwt_secret:
            raise _unauthorized("Server is missing SUPABASE_JWT_SECRET for HS256 tokens")
        key: dict | str = settings.supabase_jwt_secret
    elif alg in ("ES256", "RS256"):
        kid = header.get("kid")
        try:
            keys = await _get_jwks()
            match = next((k for k in keys if k.get("kid") == kid), None)
            if match is None:  # key rotation: refresh once
                keys = await _get_jwks(force=True)
                match = next((k for k in keys if k.get("kid") == kid), None)
        except httpx.HTTPError as e:
            raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, f"Could not fetch Supabase JWKS: {e}")
        if match is None:
            raise _unauthorized("Invalid token: unknown signing key")
        key = match
    else:
        raise _unauthorized(f"Invalid token: unsupported alg {alg!r}")

    try:
        return jwt.decode(token, key, algorithms=[alg], audience="authenticated")
    except JWTError as e:
        raise _unauthorized(f"Invalid token: {e}")


def issue_dev_token(email: str) -> tuple[str, str]:
    """Create a dev-mode token. The user id is derived from the email so it is stable."""
    settings = get_settings()
    user_id = str(uuid.uuid5(uuid.NAMESPACE_URL, f"momentum-dev:{email.lower()}"))
    now = datetime.now(timezone.utc)
    claims = {
        "sub": user_id,
        "email": email,
        "aud": "authenticated",
        "role": "authenticated",
        "iss": "momentum-dev",
        "iat": int(now.timestamp()),
        "exp": int((now + timedelta(days=30)).timestamp()),
    }
    return jwt.encode(claims, settings.dev_jwt_secret, algorithm="HS256"), user_id


def _decode_dev(token: str) -> dict:
    settings = get_settings()
    try:
        return jwt.decode(token, settings.dev_jwt_secret, algorithms=["HS256"], audience="authenticated")
    except JWTError as e:
        raise _unauthorized(f"Invalid token: {e}")


async def _ensure_profile(db: AsyncSession, user_id: uuid.UUID, claims: dict) -> None:
    if user_id in _known_profiles:
        return
    meta = claims.get("user_metadata") or {}
    email = claims.get("email") or ""
    display_name = meta.get("full_name") or meta.get("name") or (email.split("@")[0] if email else None)
    stmt = (
        insert(Profile)
        .values(id=user_id, display_name=display_name, avatar_url=meta.get("avatar_url"))
        .on_conflict_do_nothing(index_elements=[Profile.id])
    )
    await db.execute(stmt)
    await db.commit()
    _known_profiles.add(user_id)


async def get_current_user_id(
    credentials: HTTPAuthorizationCredentials | None = Depends(security),
    db: AsyncSession = Depends(get_db),
) -> str:
    if credentials is None:
        raise _unauthorized("Not authenticated")
    token = credentials.credentials
    settings = get_settings()

    claims = _decode_dev(token) if settings.dev_auth else await _decode_supabase(token)

    sub = claims.get("sub")
    try:
        user_uuid = uuid.UUID(str(sub))
    except (ValueError, TypeError):
        raise _unauthorized("Invalid token: missing or malformed sub")

    await _ensure_profile(db, user_uuid, claims)
    return str(user_uuid)
