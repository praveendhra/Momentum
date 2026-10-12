"""Derived data kept in sync with activity_logs.

Everything here is recomputed from the source logs rather than incrementally
patched, so creates, edits and deletes (including date changes) all converge
on the same correct state.
"""

from datetime import date, timedelta
from uuid import UUID

from sqlalchemy import delete, func, select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Activity, ActivityCategory, ActivityLog, DailyStat, PersonalRecord, Streak


# ─── Daily stats (heatmap) ───

def graph_level_for(total_logs: int) -> int:
    """Map number of logged sessions on a day to a 0–4 heatmap level."""
    if total_logs <= 0:
        return 0
    if total_logs == 1:
        return 1
    if total_logs == 2:
        return 2
    if total_logs <= 4:
        return 3
    return 4


async def recompute_daily_stat(db: AsyncSession, user_id: UUID, day: date) -> None:
    row = (
        await db.execute(
            select(
                func.count(ActivityLog.id),
                func.coalesce(func.sum(ActivityLog.duration_minutes), 0.0),
                func.avg(ActivityLog.mood_score),
            ).where(ActivityLog.user_id == user_id, ActivityLog.logged_date == day)
        )
    ).one()
    total_logs, total_duration, mood_avg = int(row[0]), float(row[1]), row[2]

    if total_logs == 0:
        await db.execute(delete(DailyStat).where(DailyStat.user_id == user_id, DailyStat.date == day))
        return

    slugs = (
        await db.execute(
            select(func.distinct(ActivityCategory.slug))
            .select_from(ActivityLog)
            .join(Activity, ActivityLog.activity_id == Activity.id)
            .join(ActivityCategory, Activity.category_id == ActivityCategory.id)
            .where(ActivityLog.user_id == user_id, ActivityLog.logged_date == day)
        )
    ).scalars().all()

    values = dict(
        user_id=user_id,
        date=day,
        total_logs=total_logs,
        total_duration_minutes=total_duration,
        categories_logged=sorted(slugs),
        graph_level=graph_level_for(total_logs),
        mood_avg=float(mood_avg) if mood_avg is not None else None,
    )
    stmt = insert(DailyStat).values(**values)
    stmt = stmt.on_conflict_do_update(
        index_elements=[DailyStat.user_id, DailyStat.date],
        set_={k: stmt.excluded[k] for k in values if k not in ("user_id", "date")},
    )
    await db.execute(stmt)


# ─── Streaks (daily chain + weekly consistency) ───

def compute_streak(days: list[date], today: date) -> tuple[int, int, float]:
    """Return (current_streak, longest_streak, weekly_consistency_pct).

    The current streak counts consecutive days ending today, or yesterday if
    today hasn't been logged yet (so the chain isn't "broken" mid-day).
    Weekly consistency = distinct days logged in the last 7 days / 7.
    """
    if not days:
        return 0, 0, 0.0
    uniq = sorted(set(days))
    # Clients log in their local date, which can be ahead of the server's UTC date.
    ref = max(today, uniq[-1])

    longest = run = 1
    for prev, cur in zip(uniq, uniq[1:]):
        run = run + 1 if (cur - prev).days == 1 else 1
        longest = max(longest, run)

    day_set = set(uniq)
    start = ref if ref in day_set else ref - timedelta(days=1)
    current = 0
    d = start
    while d in day_set:
        current += 1
        d -= timedelta(days=1)

    window = {ref - timedelta(days=i) for i in range(7)}
    weekly = round(len(window & day_set) / 7 * 100, 1)
    return current, longest, weekly


async def recompute_streak(db: AsyncSession, user_id: UUID, activity_id: UUID) -> None:
    days = (
        await db.execute(
            select(func.distinct(ActivityLog.logged_date)).where(
                ActivityLog.user_id == user_id, ActivityLog.activity_id == activity_id
            )
        )
    ).scalars().all()

    if not days:
        await db.execute(delete(Streak).where(Streak.user_id == user_id, Streak.activity_id == activity_id))
        return

    current, longest, weekly = compute_streak(list(days), date.today())
    values = dict(
        user_id=user_id,
        activity_id=activity_id,
        current_streak=current,
        longest_streak=longest,
        last_logged_date=max(days),
        weekly_consistency_score=weekly,
    )
    stmt = insert(Streak).values(**values)
    stmt = stmt.on_conflict_do_update(
        index_elements=[Streak.user_id, Streak.activity_id],
        set_={k: stmt.excluded[k] for k in values if k not in ("user_id", "activity_id")},
    )
    await db.execute(stmt)


# ─── Personal records ───

def _num(v) -> float | None:
    try:
        f = float(v)
    except (TypeError, ValueError):
        return None
    return f if f == f else None  # drop NaN


def log_metrics(log: ActivityLog, category_slug: str, unit: str) -> dict[str, float]:
    """Extract PR-able metrics from a single log."""
    metrics: dict[str, float] = {}
    extra = log.extra_data or {}

    sets = extra.get("sets") if isinstance(extra, dict) else None
    if isinstance(sets, list) and sets:
        best_weight = best_reps = best_e1rm = 0.0
        volume = 0.0
        for s in sets:
            if not isinstance(s, dict):
                continue
            reps = _num(s.get("reps")) or 0.0
            weight = _num(s.get("weight")) or 0.0
            if reps <= 0:
                continue
            best_reps = max(best_reps, reps)
            if weight > 0:
                best_weight = max(best_weight, weight)
                volume += reps * weight
                best_e1rm = max(best_e1rm, weight * (1 + reps / 30))  # Epley
        if best_weight:
            metrics["weight"] = best_weight
        if best_reps:
            metrics["reps"] = best_reps
        if volume:
            metrics["volume"] = round(volume, 2)
        if best_e1rm:
            metrics["e1rm"] = round(best_e1rm, 1)

    if category_slug == "workout" and log.duration_minutes:
        metrics["duration"] = float(log.duration_minutes)
    if unit == "km" and log.quantity:
        metrics["distance"] = float(log.quantity)
    return metrics


async def recompute_personal_records(db: AsyncSession, user_id: UUID, activity_id: UUID) -> set[UUID]:
    """Rebuild PRs for one activity. Returns the log ids that currently hold a PR."""
    info = (
        await db.execute(
            select(ActivityCategory.slug, Activity.unit)
            .join(Activity, Activity.category_id == ActivityCategory.id)
            .where(Activity.id == activity_id)
        )
    ).first()
    if info is None:
        return set()
    slug, unit = info

    logs = (
        await db.execute(
            select(ActivityLog)
            .where(ActivityLog.user_id == user_id, ActivityLog.activity_id == activity_id)
            .order_by(ActivityLog.logged_date, ActivityLog.created_at)
        )
    ).scalars().all()

    best: dict[str, tuple[float, ActivityLog]] = {}
    for log in logs:
        for rtype, value in log_metrics(log, slug, unit).items():
            # Strictly greater: the first log to reach a value keeps the record.
            if rtype not in best or value > best[rtype][0]:
                best[rtype] = (value, log)

    await db.execute(
        delete(PersonalRecord).where(PersonalRecord.user_id == user_id, PersonalRecord.activity_id == activity_id)
    )
    for rtype, (value, log) in best.items():
        db.add(
            PersonalRecord(
                user_id=user_id,
                activity_id=activity_id,
                record_type=rtype,
                value=value,
                logged_date=log.logged_date,
                log_id=log.id,
            )
        )
    await db.flush()
    return {log.id for _, log in best.values()}


async def current_pr_types_for_log(db: AsyncSession, user_id: UUID, log_id: UUID) -> list[str]:
    rows = (
        await db.execute(
            select(PersonalRecord.record_type).where(
                PersonalRecord.user_id == user_id, PersonalRecord.log_id == log_id
            )
        )
    ).scalars().all()
    return sorted(rows)


async def refresh_after_log_change(
    db: AsyncSession, user_id: UUID, activity_ids: set[UUID], days: set[date]
) -> None:
    for d in days:
        await recompute_daily_stat(db, user_id, d)
    for aid in activity_ids:
        await recompute_streak(db, user_id, aid)
        await recompute_personal_records(db, user_id, aid)
