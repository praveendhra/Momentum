from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import get_current_user_id, issue_dev_token
from app.core.config import get_settings
from app.core.database import get_db
from app.models import Profile
from app.schemas.schemas import AuthConfigOut, DevLoginIn, DevLoginOut, ProfileOut, ProfileUpdate

router = APIRouter(tags=["auth"])


@router.get("/auth/config", response_model=AuthConfigOut)
async def auth_config():
    """Lets the frontend confirm which auth mode the backend expects."""
    return AuthConfigOut(mode="dev" if get_settings().dev_auth else "supabase")


@router.post("/auth/dev-login", response_model=DevLoginOut)
async def dev_login(data: DevLoginIn):
    """Local development only: sign in with just an email. Disabled unless AUTH_MODE=dev."""
    if not get_settings().dev_auth:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Not found")
    email = data.email.strip().lower()
    token, user_id = issue_dev_token(email)
    return DevLoginOut(access_token=token, user_id=UUID(user_id), email=email)


@router.get("/me", response_model=ProfileOut)
async def get_me(
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    return (await db.execute(select(Profile).where(Profile.id == UUID(user_id)))).scalar_one()


@router.patch("/me", response_model=ProfileOut)
async def update_me(
    data: ProfileUpdate,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    profile = (await db.execute(select(Profile).where(Profile.id == UUID(user_id)))).scalar_one()
    for key, value in data.model_dump(exclude_unset=True).items():
        if value is not None:
            setattr(profile, key, value)
    await db.commit()
    await db.refresh(profile)
    return profile
