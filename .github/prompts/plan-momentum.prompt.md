# Plan: Momentum — Daily Self-Improvement Tracker

**What**: Full-stack PWA for logging daily self-improvement activities (workouts, habits, skills, mood) with a GitHub-style progress graph and research-backed tracking mechanics. Account-based with email + social auth.

**Stack**: React PWA (Vite + TypeScript + Tailwind) + FastAPI (Python) + Supabase (PostgreSQL + Auth). No React Native — PWA gives iOS/Android/Desktop from one codebase with zero app store friction.

---

## Decisions (locked)

- **App name**: Momentum
- **Cold start**: Free tier + graceful branded splash screen on backend wake-up (~30s)
- **Auth**: Email/password + Google OAuth + GitHub OAuth (Supabase Auth)
- **Streaks**: Weekly consistency model (e.g. 5/7 days) — no punishing chain-breaks
- **Gamification**: Personal Records + rare milestones (25/100/365 sessions) — no XP, no leaderboards

---

## Deployment Architecture (Free → Scalable)

| Layer | Free Tier | Paid Upgrade |
|---|---|---|
| Frontend | **Cloudflare Pages** — custom domain: `momentum.praveendhra.com` | Cloudflare Pro $20/mo |
| Backend | **Render** free (spins down after 15min) | Render Starter $7/mo — always on |
| Database + Auth | **Supabase** free (500MB, 50k MAU) | Supabase Pro $25/mo — one-click, no downtime |

**Cost: $0/mo on free tier.** All upgrades are dashboard plan changes — zero code changes required.

> Domain `praveendhra.com` is already on Cloudflare DNS. Add a `CNAME` record: `momentum` → `<pages-project>.pages.dev` and set `momentum.praveendhra.com` as the custom domain in Cloudflare Pages settings. SSL is automatic.

---

## Activity Tracking Model (research-backed)

### Workout / Exercise

**Strength Training**
- Primary metric: **volume load** = `sets × reps × weight` (scientifically validated progress indicator)
- Fields: exercise name, sets/reps/weight (JSONB array), RPE (1–10), rest time, notes
- Auto-calculated: estimated 1RM (Epley formula), session volume load, PR detection
- Tracks: personal records per exercise (weight PR, reps PR, volume PR)

**Cardio**
- Fields: type (run/cycle/swim/row), duration, distance, pace, heart rate zone (1–5), perceived effort
- Auto-calculated: average pace, effort score, pace progression over time

**Yoga / Flexibility / HIIT**
- Fields: style, duration, instructor/video (optional), quality (1–5), notes

**Sports / Recreation**
- Fields: sport type, duration, intensity (1–10), result (win/loss/fun), notes

### Habits *(Weekly Consistency Model)*

> Research: weekly consistency (5/7 days) drives 34% better long-term retention than hard chain streaks. Partial credit for quantity targets (1.5L / 2L goal = 75%).

- **Completion scoring**: boolean done, count (pages read), or quantity with partial credit
- **Examples**: Meditation (duration + type), Reading (pages/minutes + book), Sleep (hours + quality), Water (liters vs daily target), Cold shower (boolean + notes), Journaling (word count)

### Skill Practice *(Deliberate Practice Model)*

> Tracks difficulty trend (are you challenging yourself?) and milestone-based progression rather than just hours logged.

- Fields: duration, difficulty (1–10), what was practiced, milestone achieved, platform/resource, goal
- Auto-calculated: difficulty trend, progression level (beginner → intermediate → advanced based on session count + avg difficulty)

### Mood & Mental Health

> 1–10 valence scale + contributing factors. Lag-1 correlations surfaced after 14+ days of data.

- Fields: mood (1–10), energy (1–10), stress (1–10), contributing factors (multi-select: workout, sleep, social, work, diet, illness), gratitude text, journal notes
- Insights surfaced: "On days after a workout, your mood is +0.8 pts higher"

### Custom Activities
- User-defined name, icon, color, unit (minutes / reps / km / pages / boolean / count), daily target
- Flexible `metadata` JSONB for any extra fields

---

## Database Schema (Supabase PostgreSQL)

| Table | Key columns |
|---|---|
| `profiles` | `id` (FK auth.users), `display_name`, `username`, `avatar_url`, `timezone` |
| `activity_categories` | `id`, `name`, `slug`, `icon`, `color`, `is_system`, `user_id` (null = global preset) |
| `activities` | `id`, `user_id`, `category_id`, `name`, `icon`, `color`, `unit`, `daily_target`, `is_active`, `sort_order` |
| `activity_logs` | `id`, `user_id`, `activity_id`, `logged_date` (DATE), `duration_minutes`, `quantity`, `intensity` (1–10), `quality` (1–5), `difficulty` (1–10), `mood_score` (1–10), `notes`, `metadata` (JSONB) |
| `daily_stats` | `user_id`, `date`, `total_logs`, `total_duration_minutes`, `categories_logged` (array), `graph_level` (0–4), `mood_avg` — *updated by DB trigger on log insert/update/delete* |
| `streaks` | `user_id`, `activity_id`, `current_streak`, `longest_streak`, `last_logged_date`, `weekly_consistency_score` |
| `personal_records` | `user_id`, `activity_id`, `record_type` (weight/reps/volume/duration), `value`, `logged_date`, `log_id` |

**RLS policies** on all tables: users access only their own rows.

---

## Progress Visualization

**Primary**: GitHub-style activity heatmap (`react-activity-calendar`)
- Intensity levels 0–4 from `daily_stats.graph_level`
- Filterable by: all activities, category, single activity
- Dark/light mode, SSR-compatible

**Supporting views on dashboard**:
- Weekly consistency score (X/7 days) per habit
- 7-day rolling average trend
- Streak widget: current + longest (weekly-based for habits)
- PR board: personal records per exercise
- Stat cards: active days this month, total sessions, top activity
- Correlation insight card (appears after 14+ days of mood data)

---

## Implementation Phases

### Phase 1 — Foundation *(parallel)*
1. Monorepo scaffold: `frontend/` (Vite + React + TS + Tailwind + `vite-plugin-pwa`) and `backend/` (FastAPI + SQLAlchemy async + Alembic)
2. Supabase project: run Alembic migrations, enable RLS policies, seed 5 system categories + ~20 preset activities
3. `docker-compose.yml` for local dev

### Phase 2 — Auth *(depends on Phase 1)*
4. Supabase Auth: configure email/password, Google, GitHub OAuth providers
5. Frontend: sign in/up pages (`@supabase/auth-ui-react`), protected route wrapper, auto-create `profiles` row on first sign-in
6. Backend: `python-jose` JWT middleware verifying Supabase tokens
7. Cold start splash: frontend detects first-request delay, shows branded loading screen until `/health` responds

### Phase 3 — Activity Management *(depends on Phase 2)*
8. Backend CRUD: `/api/v1/categories`, `/api/v1/activities`
9. Frontend: activity manager page (browse presets, add/edit/delete custom activities)
10. Onboarding flow: first-time users pick/create activities before seeing dashboard

### Phase 4 — Daily Logging *(depends on Phase 3)*
11. Backend: `POST/PATCH/DELETE /api/v1/logs`, DB trigger updates `daily_stats`, PR detection service (compares vs `personal_records` on each strength log save)
12. Frontend: quick-log bottom sheet (minimal fields, one-tap) + detailed log drawer (all fields, category-aware form)
13. Log history page: filterable by activity, category, date range

### Phase 5 — Progress Visualization *(depends on Phase 4)*
14. Backend: `GET /api/v1/stats/activity-graph` (reads `daily_stats` — fast), `/stats/streaks`, `/stats/summary`, `/stats/prs`, `/stats/correlations`
15. Frontend dashboard: `react-activity-calendar` heatmap + filter, streak widget, PR board, stat cards, correlation insight card

### Phase 6 — PWA & Polish *(parallel with Phase 5)*
16. `vite-plugin-pwa`: web manifest (name, icons, theme color), Workbox service worker (cache-first for assets, network-first for API)
17. Offline log queue: store pending logs in IndexedDB (`idb` library), batch sync on reconnect (last-write-wins by `created_at`)
18. Mobile-responsive UI pass: bottom nav bar, touch-friendly log forms, drawer patterns

### Phase 7 — Deployment
19. Cloudflare Pages: connect GitHub repo, build command `npm run build`, env vars (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_API_URL`); add custom domain `momentum.praveendhra.com` in Pages settings — Cloudflare auto-provisions SSL and adds the `CNAME` record in your existing DNS zone
20. Render: deploy FastAPI via `Dockerfile`, set `SUPABASE_JWT_SECRET` + `DATABASE_URL`, `/health` endpoint for wake probe
21. Supabase: separate production project, Alembic migrations run in CI
22. `.env.example` files in `frontend/` and `backend/`

---

## Project Structure (Monorepo)

```
momentum/
├── frontend/
│   ├── src/
│   │   ├── components/      # shared UI (Button, Card, Modal, etc.)
│   │   ├── features/        # auth/, logs/, dashboard/, activities/
│   │   ├── pages/           # route-level pages
│   │   ├── hooks/           # useAuth, useLogs, useActivityGraph
│   │   ├── lib/             # supabase client, api client, idb helpers
│   │   └── types/           # shared TypeScript types
│   ├── public/              # icons, manifest assets
│   └── package.json
├── backend/
│   ├── app/
│   │   ├── api/routes/      # activities.py, logs.py, stats.py, categories.py
│   │   ├── models/          # SQLAlchemy ORM models
│   │   ├── schemas/         # Pydantic request/response schemas
│   │   ├── services/        # pr_detection.py, streak_calc.py, correlation.py, daily_stats.py
│   │   └── core/            # config, auth middleware, db session
│   ├── alembic/             # DB migrations
│   ├── Dockerfile
│   └── requirements.txt
└── docker-compose.yml
```

---

## Key API Endpoints

| Method | Endpoint | Purpose |
|---|---|---|
| CRUD | `/api/v1/activities` | manage user's activities |
| CRUD | `/api/v1/logs` | create/edit/delete log entries |
| CRUD | `/api/v1/categories` | manage categories |
| GET | `/api/v1/stats/activity-graph` | `?year=&activity_id=&category_id=` → `{date, count, level}[]` |
| GET | `/api/v1/stats/streaks` | current + longest streak per activity |
| GET | `/api/v1/stats/summary` | dashboard stat cards |
| GET | `/api/v1/stats/correlations` | mood/energy correlation insights |
| GET | `/api/v1/stats/prs` | personal records board |
| GET | `/health` | Render health check / wake-up probe |

Auth: All endpoints require `Authorization: Bearer <supabase_jwt>`, verified in FastAPI middleware.

---

## Verification Checklist

1. Auth: email signup, Google OAuth, GitHub OAuth — all complete and create a `profiles` row
2. Cold start: frontend splash shown → API wakes → app loads within 60s
3. Log a strength workout: PR detected and highlighted if previous best beaten
4. Log a habit 5/7 days in a week: consistency shows 71%, no "streak broken" message
5. Activity graph: correct intensity levels for mixed-category days, category filter works
6. Mood correlation insight appears after 14+ days of combined mood + activity data
7. PWA installs from Chrome (Android) and Safari (iOS) — offline log queues and syncs on reconnect
8. RLS: confirm user A's logs are unreachable via user B's JWT (direct API test)

---

## Scope Boundaries

**Included (v1)**: All 5 activity categories, custom activities, email + Google + GitHub auth, heatmap graph, weekly consistency streaks, PR tracking, mood correlations, dashboard, PWA + offline queue, cold start splash, Cloudflare + Render + Supabase deployment

**Excluded (v1)**: Push notifications, social/sharing features, native iOS/Android apps, nutrition macro deep tracking
