from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import get_current_user_id
from app.core.database import get_db
from app.models import Activity, ActivityCategory, ActivityLog
from app.schemas.schemas import ActivityCreate, ActivityOut, ActivityUpdate, PresetActivityOut
from app.services.presets import PRESET_ACTIVITIES
from app.services.stats import recompute_daily_stat

router = APIRouter(prefix="/activities", tags=["activities"])

ALLOWED_UNITS = {"minutes", "reps", "km", "pages", "liters", "count", "boolean"}


async def _check_category(db: AsyncSession, category_id: UUID, uid: UUID) -> None:
    ok = (
        await db.execute(
            select(ActivityCategory.id).where(
                ActivityCategory.id == category_id,
                (ActivityCategory.is_system == True) | (ActivityCategory.user_id == uid),  # noqa: E712
            )
        )
    ).scalar_one_or_none()
    if ok is None:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_CONTENT, detail="Unknown category")


def _check_unit(unit: str | None) -> None:
    if unit is not None and unit not in ALLOWED_UNITS:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail=f"unit must be one of {sorted(ALLOWED_UNITS)}",
        )


async def _get_owned(db: AsyncSession, activity_id: UUID, uid: UUID) -> Activity:
    activity = (
        await db.execute(select(Activity).where(Activity.id == activity_id, Activity.user_id == uid))
    ).scalar_one_or_none()
    if not activity:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Activity not found")
    return activity


@router.get("", response_model=list[ActivityOut])
async def list_activities(
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    stmt = (
        select(Activity)
        .where(Activity.user_id == UUID(user_id))
        .order_by(Activity.sort_order, Activity.name)
    )
    result = await db.execute(stmt)
    return result.scalars().all()


@router.get("/presets", response_model=list[PresetActivityOut])
async def list_presets(
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    cats = (
        await db.execute(select(ActivityCategory.slug, ActivityCategory.id).where(ActivityCategory.is_system == True))  # noqa: E712
    ).all()
    by_slug = {slug: cid for slug, cid in cats}
    return [
        PresetActivityOut(
            category_id=by_slug[p["category"]],
            category_slug=p["category"],
            name=p["name"],
            icon=p["icon"],
            color=p["color"],
            unit=p["unit"],
            daily_target=p["daily_target"],
        )
        for p in PRESET_ACTIVITIES
        if p["category"] in by_slug
    ]


@router.post("", response_model=ActivityOut, status_code=201)
async def create_activity(
    data: ActivityCreate,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    uid = UUID(user_id)
    await _check_category(db, data.category_id, uid)
    _check_unit(data.unit)

    next_order = (
        await db.execute(select(func.coalesce(func.max(Activity.sort_order), -1)).where(Activity.user_id == uid))
    ).scalar_one()

    activity = Activity(user_id=uid, sort_order=next_order + 1, **data.model_dump())
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
    uid = UUID(user_id)
    activity = await _get_owned(db, activity_id, uid)

    update_data = data.model_dump(exclude_unset=True)
    _check_unit(update_data.get("unit"))
    for key in ("name", "icon", "color", "unit", "is_active", "sort_order"):
        if key in update_data and update_data[key] is None:
            update_data.pop(key)  # these columns aren't nullable
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
    uid = UUID(user_id)
    activity = await _get_owned(db, activity_id, uid)

    affected_days = (
        await db.execute(
            select(func.distinct(ActivityLog.logged_date)).where(ActivityLog.activity_id == activity_id)
        )
    ).scalars().all()

    # Logs, streaks and personal records cascade at the database level.
    await db.delete(activity)
    await db.flush()
    for day in affected_days:
        await recompute_daily_stat(db, uid, day)
    await db.commit()
    return Response(status_code=204)
