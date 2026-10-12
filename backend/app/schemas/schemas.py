from datetime import date, datetime
from uuid import UUID
from pydantic import BaseModel, Field


# ─── Categories ───

class CategoryOut(BaseModel):
    id: UUID
    name: str
    slug: str
    icon: str
    color: str
    is_system: bool
    user_id: UUID | None

    model_config = {"from_attributes": True}


class CategoryCreate(BaseModel):
    name: str = Field(max_length=50)
    slug: str = Field(max_length=50)
    icon: str = Field(default="📋", max_length=50)
    color: str = Field(default="#10b981", max_length=7)


# ─── Activities ───

class ActivityOut(BaseModel):
    id: UUID
    user_id: UUID
    category_id: UUID
    name: str
    icon: str
    color: str
    unit: str
    daily_target: float | None
    is_active: bool
    sort_order: int

    model_config = {"from_attributes": True}


class ActivityCreate(BaseModel):
    category_id: UUID
    name: str = Field(max_length=100)
    icon: str = Field(default="📋", max_length=50)
    color: str = Field(default="#10b981", max_length=7)
    unit: str = Field(default="minutes", max_length=20)
    daily_target: float | None = None


class ActivityUpdate(BaseModel):
    name: str | None = Field(default=None, max_length=100)
    icon: str | None = Field(default=None, max_length=50)
    color: str | None = Field(default=None, max_length=7)
    unit: str | None = Field(default=None, max_length=20)
    daily_target: float | None = None
    is_active: bool | None = None
    sort_order: int | None = None


# ─── Activity Logs ───

class LogOut(BaseModel):
    id: UUID
    user_id: UUID
    activity_id: UUID
    logged_date: date
    duration_minutes: float | None
    quantity: float | None
    intensity: int | None
    quality: int | None
    difficulty: int | None
    mood_score: int | None
    notes: str | None
    extra_data: dict | None
    created_at: datetime

    model_config = {"from_attributes": True}


class LogCreatedOut(LogOut):
    # Record types (weight, reps, volume, e1rm, duration, distance) this log just set.
    new_records: list[str] = []


class LogCreate(BaseModel):
    activity_id: UUID
    logged_date: date
    duration_minutes: float | None = None
    quantity: float | None = None
    intensity: int | None = Field(default=None, ge=1, le=10)
    quality: int | None = Field(default=None, ge=1, le=5)
    difficulty: int | None = Field(default=None, ge=1, le=10)
    mood_score: int | None = Field(default=None, ge=1, le=10)
    notes: str | None = None
    extra_data: dict | None = None


class LogUpdate(BaseModel):
    logged_date: date | None = None
    duration_minutes: float | None = None
    quantity: float | None = None
    intensity: int | None = Field(default=None, ge=1, le=10)
    quality: int | None = Field(default=None, ge=1, le=5)
    difficulty: int | None = Field(default=None, ge=1, le=10)
    mood_score: int | None = Field(default=None, ge=1, le=10)
    notes: str | None = None
    extra_data: dict | None = None


# ─── Stats ───

class DayActivityOut(BaseModel):
    date: str
    count: int
    level: int


class StreakOut(BaseModel):
    activity_id: UUID
    activity_name: str
    current_streak: int
    longest_streak: int
    weekly_consistency_score: float


class PersonalRecordOut(BaseModel):
    id: UUID
    activity_id: UUID
    activity_name: str
    record_type: str
    value: float
    logged_date: date

    model_config = {"from_attributes": True}


class DashboardSummaryOut(BaseModel):
    active_days_this_month: int
    total_sessions: int
    top_activity: str | None
    current_longest_streak: int


class CorrelationInsightOut(BaseModel):
    factor: str
    metric: str
    delta: float
    description: str


class CorrelationsOut(BaseModel):
    mood_days: int
    required_days: int
    insights: list[CorrelationInsightOut]


# ─── Presets ───

class PresetActivityOut(BaseModel):
    category_id: UUID
    category_slug: str
    name: str
    icon: str
    color: str
    unit: str
    daily_target: float | None


# ─── Profile / auth ───

class ProfileOut(BaseModel):
    id: UUID
    display_name: str | None
    username: str | None
    avatar_url: str | None
    timezone: str

    model_config = {"from_attributes": True}


class ProfileUpdate(BaseModel):
    display_name: str | None = Field(default=None, max_length=100)
    timezone: str | None = Field(default=None, max_length=50)


class AuthConfigOut(BaseModel):
    mode: str


class DevLoginIn(BaseModel):
    email: str = Field(min_length=3, max_length=254, pattern=r"^[^@\s]+@[^@\s]+$")


class DevLoginOut(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user_id: UUID
    email: str
