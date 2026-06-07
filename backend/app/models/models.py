import uuid
from datetime import date, datetime
from sqlalchemy import (
    Boolean,
    Date,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    String,
    Text,
    func,
)
from sqlalchemy.dialects.postgresql import ARRAY, JSONB, UUID
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship


class Base(DeclarativeBase):
    pass


class Profile(Base):
    __tablename__ = "profiles"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True)
    display_name: Mapped[str | None] = mapped_column(String(100))
    username: Mapped[str | None] = mapped_column(String(50), unique=True)
    avatar_url: Mapped[str | None] = mapped_column(String(500))
    timezone: Mapped[str] = mapped_column(String(50), default="UTC")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class ActivityCategory(Base):
    __tablename__ = "activity_categories"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String(50), nullable=False)
    slug: Mapped[str] = mapped_column(String(50), nullable=False)
    icon: Mapped[str] = mapped_column(String(50), default="📋")
    color: Mapped[str] = mapped_column(String(7), default="#10b981")
    is_system: Mapped[bool] = mapped_column(Boolean, default=False)
    user_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("profiles.id"))

    activities: Mapped[list["Activity"]] = relationship(back_populates="category")


class Activity(Base):
    __tablename__ = "activities"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("profiles.id"), nullable=False)
    category_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("activity_categories.id"), nullable=False)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    icon: Mapped[str] = mapped_column(String(50), default="📋")
    color: Mapped[str] = mapped_column(String(7), default="#10b981")
    unit: Mapped[str] = mapped_column(String(20), default="minutes")  # minutes, reps, km, pages, liters, count, boolean
    daily_target: Mapped[float | None] = mapped_column(Float)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    sort_order: Mapped[int] = mapped_column(Integer, default=0)

    category: Mapped[ActivityCategory] = relationship(back_populates="activities")
    logs: Mapped[list["ActivityLog"]] = relationship(back_populates="activity")


class ActivityLog(Base):
    __tablename__ = "activity_logs"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("profiles.id"), nullable=False, index=True)
    activity_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("activities.id"), nullable=False, index=True)
    logged_date: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    duration_minutes: Mapped[float | None] = mapped_column(Float)
    quantity: Mapped[float | None] = mapped_column(Float)
    intensity: Mapped[int | None] = mapped_column(Integer)  # 1–10
    quality: Mapped[int | None] = mapped_column(Integer)  # 1–5
    difficulty: Mapped[int | None] = mapped_column(Integer)  # 1–10
    mood_score: Mapped[int | None] = mapped_column(Integer)  # 1–10
    notes: Mapped[str | None] = mapped_column(Text)
    extra_data: Mapped[dict | None] = mapped_column(JSONB)  # flexible: sets/reps/weight, factors, etc.
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    activity: Mapped[Activity] = relationship(back_populates="logs")


class DailyStat(Base):
    __tablename__ = "daily_stats"

    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("profiles.id"), primary_key=True)
    date: Mapped[date] = mapped_column(Date, primary_key=True)
    total_logs: Mapped[int] = mapped_column(Integer, default=0)
    total_duration_minutes: Mapped[float] = mapped_column(Float, default=0)
    categories_logged: Mapped[list[str] | None] = mapped_column(ARRAY(String))
    graph_level: Mapped[int] = mapped_column(Integer, default=0)  # 0–4
    mood_avg: Mapped[float | None] = mapped_column(Float)


class Streak(Base):
    __tablename__ = "streaks"

    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("profiles.id"), primary_key=True)
    activity_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("activities.id"), primary_key=True)
    current_streak: Mapped[int] = mapped_column(Integer, default=0)
    longest_streak: Mapped[int] = mapped_column(Integer, default=0)
    last_logged_date: Mapped[date | None] = mapped_column(Date)
    weekly_consistency_score: Mapped[float] = mapped_column(Float, default=0)  # 0–100


class PersonalRecord(Base):
    __tablename__ = "personal_records"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("profiles.id"), nullable=False, index=True)
    activity_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("activities.id"), nullable=False)
    record_type: Mapped[str] = mapped_column(String(20), nullable=False)  # weight, reps, volume, duration
    value: Mapped[float] = mapped_column(Float, nullable=False)
    logged_date: Mapped[date] = mapped_column(Date, nullable=False)
    log_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("activity_logs.id"))
