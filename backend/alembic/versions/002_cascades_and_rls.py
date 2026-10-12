"""Cascading deletes, query index, and row-level security

Revision ID: 002
Revises: 001
Create Date: 2026-10-11

* Deleting an activity removes its logs, streak and personal records.
* Deleting a log that holds a personal record nulls the PR's log_id
  (PRs are rebuilt by the API right after).
* Deleting a profile removes all of that user's data.
* RLS is enabled on every table. The FastAPI backend connects as the table
  owner (bypassing RLS) and scopes queries by the JWT's user id itself; RLS
  protects the data if anything talks to Supabase's auto-generated REST API
  directly with the anon key.
"""

from typing import Sequence, Union

from alembic import op

revision: str = "002"
down_revision: Union[str, None] = "001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

# (table, column, referenced table, ondelete)
FOREIGN_KEYS = [
    ("activity_categories", "user_id", "profiles", "CASCADE"),
    ("activities", "user_id", "profiles", "CASCADE"),
    ("activities", "category_id", "activity_categories", None),
    ("activity_logs", "user_id", "profiles", "CASCADE"),
    ("activity_logs", "activity_id", "activities", "CASCADE"),
    ("daily_stats", "user_id", "profiles", "CASCADE"),
    ("streaks", "user_id", "profiles", "CASCADE"),
    ("streaks", "activity_id", "activities", "CASCADE"),
    ("personal_records", "user_id", "profiles", "CASCADE"),
    ("personal_records", "activity_id", "activities", "CASCADE"),
    ("personal_records", "log_id", "activity_logs", "SET NULL"),
]

# table -> SQL expression identifying the row's owner
RLS_TABLES = {
    "profiles": "id",
    "activities": "user_id",
    "activity_logs": "user_id",
    "daily_stats": "user_id",
    "streaks": "user_id",
    "personal_records": "user_id",
}


def _fk_name(table: str, column: str) -> str:
    return f"{table}_{column}_fkey"


def _replace_fks(with_ondelete: bool) -> None:
    for table, column, ref, ondelete in FOREIGN_KEYS:
        name = _fk_name(table, column)
        op.execute(f'ALTER TABLE {table} DROP CONSTRAINT IF EXISTS "{name}"')
        op.create_foreign_key(
            name, table, ref, [column], ["id"], ondelete=ondelete if with_ondelete else None
        )


def _supabase_auth_available() -> bool:
    bind = op.get_bind()
    return bool(
        bind.exec_driver_sql(
            "SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace "
            "WHERE n.nspname = 'auth' AND p.proname = 'uid'"
        ).scalar()
    )


def upgrade() -> None:
    _replace_fks(with_ondelete=True)

    op.create_index(
        "ix_activity_logs_user_date", "activity_logs", ["user_id", "logged_date"], if_not_exists=True
    )
    op.create_index(
        "ix_personal_records_activity", "personal_records", ["user_id", "activity_id"], if_not_exists=True
    )

    for table in [*RLS_TABLES, "activity_categories"]:
        op.execute(f"ALTER TABLE {table} ENABLE ROW LEVEL SECURITY")

    # Owner-only policies only make sense where Supabase's auth.uid() exists.
    if _supabase_auth_available():
        for table, owner_col in RLS_TABLES.items():
            op.execute(
                f'CREATE POLICY "{table}_owner_all" ON {table} FOR ALL '
                f"USING (auth.uid() = {owner_col}) WITH CHECK (auth.uid() = {owner_col})"
            )
        op.execute(
            'CREATE POLICY "activity_categories_read" ON activity_categories FOR SELECT '
            "USING (is_system OR auth.uid() = user_id)"
        )
        op.execute(
            'CREATE POLICY "activity_categories_owner_write" ON activity_categories FOR ALL '
            "USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id)"
        )


def downgrade() -> None:
    for table in RLS_TABLES:
        op.execute(f'DROP POLICY IF EXISTS "{table}_owner_all" ON {table}')
    op.execute('DROP POLICY IF EXISTS "activity_categories_read" ON activity_categories')
    op.execute('DROP POLICY IF EXISTS "activity_categories_owner_write" ON activity_categories')
    for table in [*RLS_TABLES, "activity_categories"]:
        op.execute(f"ALTER TABLE {table} DISABLE ROW LEVEL SECURITY")

    op.drop_index("ix_personal_records_activity", table_name="personal_records")
    op.drop_index("ix_activity_logs_user_date", table_name="activity_logs")
    _replace_fks(with_ondelete=False)
