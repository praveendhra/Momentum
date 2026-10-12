from datetime import date as date_type
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import get_current_user_id
from app.core.database import get_db
from app.models import Activity, ActivityLog, PersonalRecord
from app.schemas.schemas import LogCreate, LogCreatedOut, LogOut, LogUpdate
from app.services.stats import refresh_after_log_change

router = APIRouter(prefix="/logs", tags=["logs"])


async def _get_owned_log(db: AsyncSession, log_id: UUID, uid: UUID) -> ActivityLog:
    log = (
        await db.execute(select(ActivityLog).where(ActivityLog.id == log_id, ActivityLog.user_id == uid))
    ).scalar_one_or_none()
    if not log:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Log not found")
    return log


@router.get("", response_model=list[LogOut])
async def list_logs(
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
    activity_id: UUID | None = Query(default=None),
    category_id: UUID | None = Query(default=None),
    date_from: date_type | None = Query(default=None),
    date_to: date_type | None = Query(default=None),
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
):
    stmt = select(ActivityLog).where(ActivityLog.user_id == UUID(user_id))

    if activity_id:
        stmt = stmt.where(ActivityLog.activity_id == activity_id)
    if category_id:
        stmt = stmt.join(Activity, ActivityLog.activity_id == Activity.id).where(Activity.category_id == category_id)
    if date_from:
        stmt = stmt.where(ActivityLog.logged_date >= date_from)
    if date_to:
        stmt = stmt.where(ActivityLog.logged_date <= date_to)

    stmt = stmt.order_by(ActivityLog.logged_date.desc(), ActivityLog.created_at.desc())
    stmt = stmt.limit(limit).offset(offset)

    result = await db.execute(stmt)
    return result.scalars().all()


@router.post("", response_model=LogCreatedOut, status_code=201)
async def create_log(
    data: LogCreate,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    uid = UUID(user_id)
    owned = (
        await db.execute(select(Activity.id).where(Activity.id == data.activity_id, Activity.user_id == uid))
    ).scalar_one_or_none()
    if owned is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Activity not found")

    previous_best = {
        rtype: value
        for rtype, value in (
            await db.execute(
                select(PersonalRecord.record_type, PersonalRecord.value).where(
                    PersonalRecord.user_id == uid, PersonalRecord.activity_id == data.activity_id
                )
            )
        ).all()
    }

    log = ActivityLog(user_id=uid, **data.model_dump())
    db.add(log)
    await db.flush()

    await refresh_after_log_change(db, uid, {log.activity_id}, {log.logged_date})

    held = (
        await db.execute(
            select(PersonalRecord.record_type, PersonalRecord.value).where(
                PersonalRecord.user_id == uid, PersonalRecord.log_id == log.id
            )
        )
    ).all()
    # A "new" record beats a previous best; the very first log of an activity
    # trivially holds every record, so it isn't celebrated as a PR.
    new_records = sorted(rt for rt, v in held if rt in previous_best and v > previous_best[rt])

    await db.commit()
    await db.refresh(log)
    out = LogCreatedOut.model_validate(log)
    out.new_records = new_records
    return out


@router.patch("/{log_id}", response_model=LogOut)
async def update_log(
    log_id: UUID,
    data: LogUpdate,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    uid = UUID(user_id)
    log = await _get_owned_log(db, log_id, uid)
    old_date = log.logged_date

    update_data = data.model_dump(exclude_unset=True)
    if update_data.get("logged_date", old_date) is None:
        update_data.pop("logged_date")
    for key, value in update_data.items():
        setattr(log, key, value)
    await db.flush()

    await refresh_after_log_change(db, uid, {log.activity_id}, {old_date, log.logged_date})
    await db.commit()
    await db.refresh(log)
    return log


@router.delete("/{log_id}", status_code=204)
async def delete_log(
    log_id: UUID,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    uid = UUID(user_id)
    log = await _get_owned_log(db, log_id, uid)
    activity_id, day = log.activity_id, log.logged_date

    await db.delete(log)
    await db.flush()
    await refresh_after_log_change(db, uid, {activity_id}, {day})
    await db.commit()
    return Response(status_code=204)
