-- Momentum schema for Supabase.
-- Paste into Supabase → SQL Editor → Run. Safe to re-run.
--
-- The browser talks to these tables directly via supabase-js using the anon
-- key, so row-level security is what keeps each user's data private.

create extension if not exists pgcrypto;

-- ─── Tables ───

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  username text unique,
  avatar_url text,
  timezone text not null default 'UTC',
  created_at timestamptz not null default now()
);

create table if not exists public.activity_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) <= 50),
  slug text not null check (char_length(slug) <= 50),
  icon text not null default '📋',
  color text not null default '#10b981',
  is_system boolean not null default false,
  user_id uuid references auth.users (id) on delete cascade
);

create table if not exists public.activities (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  category_id uuid not null references public.activity_categories (id),
  name text not null check (char_length(name) between 1 and 100),
  icon text not null default '📋' check (char_length(icon) <= 50),
  color text not null default '#10b981' check (color ~ '^#[0-9a-fA-F]{6}$'),
  unit text not null default 'minutes'
    check (unit in ('minutes', 'reps', 'km', 'pages', 'liters', 'count', 'boolean')),
  daily_target double precision,
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.activity_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  activity_id uuid not null references public.activities (id) on delete cascade,
  logged_date date not null,
  duration_minutes double precision check (duration_minutes is null or duration_minutes >= 0),
  quantity double precision,
  intensity smallint check (intensity between 1 and 10),
  quality smallint check (quality between 1 and 5),
  difficulty smallint check (difficulty between 1 and 10),
  mood_score smallint check (mood_score between 1 and 10),
  notes text check (char_length(notes) <= 5000),
  extra_data jsonb,
  created_at timestamptz not null default now()
);

create index if not exists activities_user_idx on public.activities (user_id, sort_order);
create index if not exists activity_logs_user_date_idx on public.activity_logs (user_id, logged_date);
create index if not exists activity_logs_activity_idx on public.activity_logs (activity_id);

-- A log may only reference one of the user's own activities.
create or replace function public.check_log_activity_owner()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from public.activities a where a.id = new.activity_id and a.user_id = new.user_id) then
    raise exception 'Activity not found' using errcode = '23503';
  end if;
  return new;
end $$;

drop trigger if exists activity_logs_owner_check on public.activity_logs;
create trigger activity_logs_owner_check
  before insert or update of activity_id, user_id on public.activity_logs
  for each row execute function public.check_log_activity_owner();

-- ─── Profile row for every new auth user ───

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, display_name, avatar_url)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name', split_part(new.email, '@', 1)),
    new.raw_user_meta_data ->> 'avatar_url'
  )
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Backfill profiles for users who signed up before this script ran.
insert into public.profiles (id, display_name)
select u.id, split_part(u.email, '@', 1) from auth.users u
on conflict (id) do nothing;

-- ─── Row-level security ───

alter table public.profiles enable row level security;
alter table public.activity_categories enable row level security;
alter table public.activities enable row level security;
alter table public.activity_logs enable row level security;

drop policy if exists "profiles: own row" on public.profiles;
create policy "profiles: own row" on public.profiles
  for all to authenticated
  using ((select auth.uid()) = id) with check ((select auth.uid()) = id);

drop policy if exists "categories: read system + own" on public.activity_categories;
create policy "categories: read system + own" on public.activity_categories
  for select to authenticated
  using (is_system or (select auth.uid()) = user_id);

drop policy if exists "categories: write own" on public.activity_categories;
create policy "categories: write own" on public.activity_categories
  for all to authenticated
  using ((select auth.uid()) = user_id and not is_system)
  with check ((select auth.uid()) = user_id and not is_system);

drop policy if exists "activities: own rows" on public.activities;
create policy "activities: own rows" on public.activities
  for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

drop policy if exists "activity_logs: own rows" on public.activity_logs;
create policy "activity_logs: own rows" on public.activity_logs
  for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

-- Anonymous visitors get nothing; signed-in users get CRUD, filtered by RLS.
revoke all on public.profiles, public.activity_categories, public.activities, public.activity_logs from anon;
grant select, insert, update, delete
  on public.profiles, public.activity_categories, public.activities, public.activity_logs
  to authenticated;

-- ─── Seed system categories (IDs match frontend/src/lib/catalog.ts) ───

insert into public.activity_categories (id, name, slug, icon, color, is_system, user_id) values
  ('a0000000-0000-0000-0000-000000000001', 'Workout',        'workout', '💪', '#ef4444', true, null),
  ('a0000000-0000-0000-0000-000000000002', 'Habits',         'habit',   '🔄', '#3b82f6', true, null),
  ('a0000000-0000-0000-0000-000000000003', 'Skill Practice', 'skill',   '🎯', '#a855f7', true, null),
  ('a0000000-0000-0000-0000-000000000004', 'Mood & Journal', 'mood',    '😊', '#f59e0b', true, null),
  ('a0000000-0000-0000-0000-000000000005', 'Custom',         'custom',  '⚡', '#10b981', true, null)
on conflict (id) do update
  set name = excluded.name, slug = excluded.slug, icon = excluded.icon, color = excluded.color, is_system = true;
