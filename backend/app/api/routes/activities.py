from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import get_current_user_id
from app.core.database import get_db
from app.models import Activity
from app.schemas.schemas import ActivityOut, ActivityCreate, ActivityUpdate

router = APIRouter(prefix="/activities", tags=["activities"])


@router.get("", response_model=list[ActivityOut])
async def list_activities(
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    stmt = select(Activity).where(Activity.user_id == UUID(user_id)).order_by(Activity.sort_order)
    result = await db.execute(stmt)
    return result.scalars().all()


@router.post("", response_model=ActivityOut, status_code=201)
async def create_activity(
    data: ActivityCreate,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    activity = Activity(
        user_id=UUID(user_id),
        category_id=data.category_id,
        name=data.name,
        icon=data.icon,
        color=data.color,
        unit=data.unit,
        daily_target=data.daily_target,
    )
    db.add(activity)
    await db.commit()
    await db.refresh(activity)
    return activity


@router.patch("/{activity_id}", response_model=ActivityOut)
async def update_activity(
    activity_id: UUID,
    data: ActivityUpdate,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    stmt = select(Activity).where(Activity.id == activity_id, Activity.user_id == UUID(user_id))
    result = await db.execute(stmt)
    activity = result.scalar_one_or_none()
    if not activity:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Activity not found")

    update_data = data.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(activity, key, value)

    await db.commit()
    await db.refresh(activity)
    return activity


@router.delete("/{activity_id}", status_code=204)
async def delete_activity(
    activity_id: UUID,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    stmt = select(Activity).where(Activity.id == activity_id, Activity.user_id == UUID(user_id))
    result = await db.execute(stmt)
    activity = result.scalar_one_or_none()
    if not activity:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Activity not found")

    await db.delete(activity)
    await db.commit()
