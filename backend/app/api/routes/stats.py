from datetime import date as date_type, timedelta
from statistics import mean
from uuid import UUID
from fastapi import APIRouter, Depends, Query
from sqlalchemy import select, func, extract
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import get_current_user_id
from app.core.database import get_db
from app.models import ActivityCategory, DailyStat, Streak, PersonalRecord, Activity, ActivityLog
from app.schemas.schemas import (
    CorrelationInsightOut,
    CorrelationsOut,
    DayActivityOut,
    StreakOut,
    PersonalRecordOut,
    DashboardSummaryOut,
)
from app.services.stats import graph_level_for, recompute_streak

CORRELATION_MIN_DAYS = 14
CORRELATION_MIN_GROUP = 3
FACTOR_PHRASES = {
    "workout": "a workout",
    "habit": "keeping up your habits",
    "skill": "skill practice",
    "custom": "your custom activities",
}

router = APIRouter(prefix="/stats", tags=["stats"])


async def _refresh_streaks(db: AsyncSession, uid: UUID) -> None:
    """Streaks depend on today's date, so recompute them when they're read."""
    activity_ids = (
        await db.execute(select(func.distinct(ActivityLog.activity_id)).where(ActivityLog.user_id == uid))
    ).scalars().all()
    for aid in activity_ids:
        await recompute_streak(db, uid, aid)
    await db.commit()


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
        return [
            DayActivityOut(date=r.logged_date.isoformat(), count=r.count, level=graph_level_for(r.count))
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
    await _refresh_streaks(db, UUID(user_id))
    stmt = (
        select(Streak, Activity.name)
        .join(Activity, Streak.activity_id == Activity.id)
        .where(Streak.user_id == UUID(user_id))
    )
    stmt = stmt.order_by(Streak.weekly_consistency_score.desc(), Activity.name)
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

    # Current longest streak (refreshed so a lapsed chain reads as 0, not stale)
    await _refresh_streaks(db, uid)
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


@router.get("/correlations", response_model=CorrelationsOut)
async def correlations(
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """Lag-1 insights: is mood higher on days after doing X?

    Compares average mood on days that follow a day with a given category
    logged vs. days that follow a day without it. Only surfaced once there are
    enough mood days for the comparison to mean something.
    """
    uid = UUID(user_id)
    rows = (
        await db.execute(
            select(DailyStat.date, DailyStat.mood_avg, DailyStat.categories_logged).where(DailyStat.user_id == uid)
        )
    ).all()
    mood_by_day = {d: m for d, m, _ in rows if m is not None}
    cats_by_day = {d: set(c or []) for d, _, c in rows}

    if len(mood_by_day) < CORRELATION_MIN_DAYS:
        return CorrelationsOut(mood_days=len(mood_by_day), required_days=CORRELATION_MIN_DAYS, insights=[])

    names = dict(
        (
            await db.execute(select(ActivityCategory.slug, ActivityCategory.name).where(ActivityCategory.is_system == True))  # noqa: E712
        ).all()
    )

    insights: list[CorrelationInsightOut] = []
    for slug, name in names.items():
        if slug == "mood":
            continue
        after, not_after = [], []
        for day, mood in mood_by_day.items():
            (after if slug in cats_by_day.get(day - timedelta(days=1), set()) else not_after).append(mood)
        if len(after) < CORRELATION_MIN_GROUP or len(not_after) < CORRELATION_MIN_GROUP:
            continue
        delta = round(mean(after) - mean(not_after), 1)
        if abs(delta) < 0.3:
            continue
        direction = "higher" if delta > 0 else "lower"
        insights.append(
            CorrelationInsightOut(
                factor=slug,
                metric="mood",
                delta=delta,
                description=f"On days after {FACTOR_PHRASES.get(slug, name.lower())}, your mood is {abs(delta):.1f} pts {direction}.",
            )
        )
    insights.sort(key=lambda i: abs(i.delta), reverse=True)
    return CorrelationsOut(mood_days=len(mood_by_day), required_days=CORRELATION_MIN_DAYS, insights=insights)
