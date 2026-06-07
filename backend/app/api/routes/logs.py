from datetime import date as date_type
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import get_current_user_id
from app.core.database import get_db
from app.models import ActivityLog
from app.schemas.schemas import LogOut, LogCreate, LogUpdate

router = APIRouter(prefix="/logs", tags=["logs"])


@router.get("", response_model=list[LogOut])
async def list_logs(
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
    activity_id: UUID | None = Query(default=None),
    date_from: date_type | None = Query(default=None),
    date_to: date_type | None = Query(default=None),
    limit: int = Query(default=50, le=200),
    offset: int = Query(default=0, ge=0),
):
    stmt = select(ActivityLog).where(ActivityLog.user_id == UUID(user_id))

    if activity_id:
        stmt = stmt.where(ActivityLog.activity_id == activity_id)
    if date_from:
        stmt = stmt.where(ActivityLog.logged_date >= date_from)
    if date_to:
        stmt = stmt.where(ActivityLog.logged_date <= date_to)

    stmt = stmt.order_by(ActivityLog.logged_date.desc(), ActivityLog.created_at.desc())
    stmt = stmt.limit(limit).offset(offset)

    result = await db.execute(stmt)
    return result.scalars().all()


@router.post("", response_model=LogOut, status_code=201)
async def create_log(
    data: LogCreate,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    log = ActivityLog(
        user_id=UUID(user_id),
        activity_id=data.activity_id,
        logged_date=data.logged_date,
        duration_minutes=data.duration_minutes,
        quantity=data.quantity,
        intensity=data.intensity,
        quality=data.quality,
        difficulty=data.difficulty,
        mood_score=data.mood_score,
        notes=data.notes,
        extra_data=data.extra_data,
    )
    db.add(log)
    await db.commit()
    await db.refresh(log)
    # TODO: trigger daily_stats update + PR detection
    return log


@router.patch("/{log_id}", response_model=LogOut)
async def update_log(
    log_id: UUID,
    data: LogUpdate,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    stmt = select(ActivityLog).where(ActivityLog.id == log_id, ActivityLog.user_id == UUID(user_id))
    result = await db.execute(stmt)
    log = result.scalar_one_or_none()
    if not log:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Log not found")

    update_data = data.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(log, key, value)

    await db.commit()
    await db.refresh(log)
    return log


@router.delete("/{log_id}", status_code=204)
async def delete_log(
    log_id: UUID,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    stmt = select(ActivityLog).where(ActivityLog.id == log_id, ActivityLog.user_id == UUID(user_id))
    result = await db.execute(stmt)
    log = result.scalar_one_or_none()
    if not log:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Log not found")

    await db.delete(log)
    await db.commit()
