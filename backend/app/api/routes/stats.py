from datetime import date as date_type
from uuid import UUID
from fastapi import APIRouter, Depends, Query
from sqlalchemy import select, func, extract
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import get_current_user_id
from app.core.database import get_db
from app.models import DailyStat, Streak, PersonalRecord, Activity, ActivityLog
from app.schemas.schemas import (
    DayActivityOut,
    StreakOut,
    PersonalRecordOut,
    DashboardSummaryOut,
)

router = APIRouter(prefix="/stats", tags=["stats"])


@router.get("/activity-graph", response_model=list[DayActivityOut])
async def activity_graph(
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
    year: int | None = Query(default=None),
    activity_id: UUID | None = Query(default=None),
    category_id: UUID | None = Query(default=None),
):
    uid = UUID(user_id)

    # If filtering by specific activity/category, compute from activity_logs directly
    if activity_id or category_id:
        stmt = (
            select(
                ActivityLog.logged_date,
                func.count(ActivityLog.id).label("count"),
            )
            .where(ActivityLog.user_id == uid)
            .group_by(ActivityLog.logged_date)
            .order_by(ActivityLog.logged_date)
        )
        if activity_id:
            stmt = stmt.where(ActivityLog.activity_id == activity_id)
        if category_id:
            stmt = stmt.join(Activity).where(Activity.category_id == category_id)
        if year:
            stmt = stmt.where(extract("year", ActivityLog.logged_date) == year)

        result = await db.execute(stmt)
        rows = result.all()
        max_count = max((r.count for r in rows), default=1)
        return [
            DayActivityOut(
                date=r.logged_date.isoformat(),
                count=r.count,
                level=min(4, int(r.count / max_count * 4)) if max_count > 0 else 0,
            )
            for r in rows
        ]

    # Default: read from denormalized daily_stats
    stmt = select(DailyStat).where(DailyStat.user_id == uid).order_by(DailyStat.date)
    if year:
        stmt = stmt.where(extract("year", DailyStat.date) == year)

    result = await db.execute(stmt)
    stats = result.scalars().all()
    return [
        DayActivityOut(date=s.date.isoformat(), count=s.total_logs, level=s.graph_level)
        for s in stats
    ]


@router.get("/streaks", response_model=list[StreakOut])
async def streaks(
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    stmt = (
        select(Streak, Activity.name)
        .join(Activity, Streak.activity_id == Activity.id)
        .where(Streak.user_id == UUID(user_id))
    )
    result = await db.execute(stmt)
    rows = result.all()
    return [
        StreakOut(
            activity_id=streak.activity_id,
            activity_name=name,
            current_streak=streak.current_streak,
            longest_streak=streak.longest_streak,
            weekly_consistency_score=streak.weekly_consistency_score,
        )
        for streak, name in rows
    ]


@router.get("/prs", response_model=list[PersonalRecordOut])
async def personal_records(
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    stmt = (
        select(PersonalRecord, Activity.name)
        .join(Activity, PersonalRecord.activity_id == Activity.id)
        .where(PersonalRecord.user_id == UUID(user_id))
        .order_by(PersonalRecord.logged_date.desc())
    )
    result = await db.execute(stmt)
    rows = result.all()
    return [
        PersonalRecordOut(
            id=pr.id,
            activity_id=pr.activity_id,
            activity_name=name,
            record_type=pr.record_type,
            value=pr.value,
            logged_date=pr.logged_date,
        )
        for pr, name in rows
    ]


@router.get("/summary", response_model=DashboardSummaryOut)
async def dashboard_summary(
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    uid = UUID(user_id)
    today = date_type.today()

    # Active days this month
    stmt_days = (
        select(func.count(func.distinct(ActivityLog.logged_date)))
        .where(ActivityLog.user_id == uid)
        .where(extract("year", ActivityLog.logged_date) == today.year)
        .where(extract("month", ActivityLog.logged_date) == today.month)
    )
    active_days = (await db.execute(stmt_days)).scalar() or 0

    # Total sessions
    stmt_total = select(func.count(ActivityLog.id)).where(ActivityLog.user_id == uid)
    total_sessions = (await db.execute(stmt_total)).scalar() or 0

    # Top activity
    stmt_top = (
        select(Activity.name, func.count(ActivityLog.id).label("cnt"))
        .join(Activity, ActivityLog.activity_id == Activity.id)
        .where(ActivityLog.user_id == uid)
        .group_by(Activity.name)
        .order_by(func.count(ActivityLog.id).desc())
        .limit(1)
    )
    top_result = (await db.execute(stmt_top)).first()
    top_activity = top_result[0] if top_result else None

    # Current longest streak
    stmt_streak = (
        select(func.max(Streak.current_streak))
        .where(Streak.user_id == uid)
    )
    longest = (await db.execute(stmt_streak)).scalar() or 0

    return DashboardSummaryOut(
        active_days_this_month=active_days,
        total_sessions=total_sessions,
        top_activity=top_activity,
        current_longest_streak=longest,
    )
