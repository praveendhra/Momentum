"""Initial schema

Revision ID: 001
Revises:
Create Date: 2026-06-03

"""
from typing import Sequence, Union
import uuid

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID, JSONB, ARRAY

revision: str = "001"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

# System categories to seed
SYSTEM_CATEGORIES = [
    {"id": "a0000000-0000-0000-0000-000000000001", "name": "Workout", "slug": "workout", "icon": "💪", "color": "#ef4444"},
    {"id": "a0000000-0000-0000-0000-000000000002", "name": "Habits", "slug": "habit", "icon": "🔄", "color": "#3b82f6"},
    {"id": "a0000000-0000-0000-0000-000000000003", "name": "Skill Practice", "slug": "skill", "icon": "🎯", "color": "#a855f7"},
    {"id": "a0000000-0000-0000-0000-000000000004", "name": "Mood & Journal", "slug": "mood", "icon": "😊", "color": "#f59e0b"},
    {"id": "a0000000-0000-0000-0000-000000000005", "name": "Custom", "slug": "custom", "icon": "⚡", "color": "#10b981"},
]


def upgrade() -> None:
    # profiles
    op.create_table(
        "profiles",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("display_name", sa.String(100)),
        sa.Column("username", sa.String(50), unique=True),
        sa.Column("avatar_url", sa.String(500)),
        sa.Column("timezone", sa.String(50), server_default="UTC"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    # activity_categories
    op.create_table(
        "activity_categories",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("name", sa.String(50), nullable=False),
        sa.Column("slug", sa.String(50), nullable=False),
        sa.Column("icon", sa.String(50), server_default="📋"),
        sa.Column("color", sa.String(7), server_default="#10b981"),
        sa.Column("is_system", sa.Boolean, server_default="false"),
        sa.Column("user_id", UUID(as_uuid=True), sa.ForeignKey("profiles.id")),
    )

    # activities
    op.create_table(
        "activities",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("user_id", UUID(as_uuid=True), sa.ForeignKey("profiles.id"), nullable=False),
        sa.Column("category_id", UUID(as_uuid=True), sa.ForeignKey("activity_categories.id"), nullable=False),
        sa.Column("name", sa.String(100), nullable=False),
        sa.Column("icon", sa.String(50), server_default="📋"),
        sa.Column("color", sa.String(7), server_default="#10b981"),
        sa.Column("unit", sa.String(20), server_default="minutes"),
        sa.Column("daily_target", sa.Float, nullable=True),
        sa.Column("is_active", sa.Boolean, server_default="true"),
        sa.Column("sort_order", sa.Integer, server_default="0"),
    )

    # activity_logs
    op.create_table(
        "activity_logs",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("user_id", UUID(as_uuid=True), sa.ForeignKey("profiles.id"), nullable=False, index=True),
        sa.Column("activity_id", UUID(as_uuid=True), sa.ForeignKey("activities.id"), nullable=False, index=True),
        sa.Column("logged_date", sa.Date, nullable=False, index=True),
        sa.Column("duration_minutes", sa.Float),
        sa.Column("quantity", sa.Float),
        sa.Column("intensity", sa.Integer),
        sa.Column("quality", sa.Integer),
        sa.Column("difficulty", sa.Integer),
        sa.Column("mood_score", sa.Integer),
        sa.Column("notes", sa.Text),
        sa.Column("extra_data", JSONB),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    # daily_stats
    op.create_table(
        "daily_stats",
        sa.Column("user_id", UUID(as_uuid=True), sa.ForeignKey("profiles.id"), primary_key=True),
        sa.Column("date", sa.Date, primary_key=True),
        sa.Column("total_logs", sa.Integer, server_default="0"),
        sa.Column("total_duration_minutes", sa.Float, server_default="0"),
        sa.Column("categories_logged", ARRAY(sa.String)),
        sa.Column("graph_level", sa.Integer, server_default="0"),
        sa.Column("mood_avg", sa.Float),
    )

    # streaks
    op.create_table(
        "streaks",
        sa.Column("user_id", UUID(as_uuid=True), sa.ForeignKey("profiles.id"), primary_key=True),
        sa.Column("activity_id", UUID(as_uuid=True), sa.ForeignKey("activities.id"), primary_key=True),
        sa.Column("current_streak", sa.Integer, server_default="0"),
        sa.Column("longest_streak", sa.Integer, server_default="0"),
        sa.Column("last_logged_date", sa.Date),
        sa.Column("weekly_consistency_score", sa.Float, server_default="0"),
    )

    # personal_records
    op.create_table(
        "personal_records",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("user_id", UUID(as_uuid=True), sa.ForeignKey("profiles.id"), nullable=False, index=True),
        sa.Column("activity_id", UUID(as_uuid=True), sa.ForeignKey("activities.id"), nullable=False),
        sa.Column("record_type", sa.String(20), nullable=False),
        sa.Column("value", sa.Float, nullable=False),
        sa.Column("logged_date", sa.Date, nullable=False),
        sa.Column("log_id", UUID(as_uuid=True), sa.ForeignKey("activity_logs.id")),
    )

    # Seed system categories
    categories_table = sa.table(
        "activity_categories",
        sa.column("id", UUID(as_uuid=True)),
        sa.column("name", sa.String),
        sa.column("slug", sa.String),
        sa.column("icon", sa.String),
        sa.column("color", sa.String),
        sa.column("is_system", sa.Boolean),
        sa.column("user_id", UUID(as_uuid=True)),
    )
    op.bulk_insert(
        categories_table,
        [
            {
                "id": uuid.UUID(c["id"]),
                "name": c["name"],
                "slug": c["slug"],
                "icon": c["icon"],
                "color": c["color"],
                "is_system": True,
                "user_id": None,
            }
            for c in SYSTEM_CATEGORIES
        ],
    )


def downgrade() -> None:
    op.drop_table("personal_records")
    op.drop_table("streaks")
    op.drop_table("daily_stats")
    op.drop_table("activity_logs")
    op.drop_table("activities")
    op.drop_table("activity_categories")
    op.drop_table("profiles")
