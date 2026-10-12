# Momentum

Daily self-improvement tracker: log workouts, habits, skill practice and mood, and watch progress build up on a GitHub-style heatmap. Weekly consistency instead of punishing streaks, automatic personal records, and mood insights once you have two weeks of data.

**Live:** https://praveendhra.github.io/Momentum/

## How it's hosted (all free tier)

| Piece | Service |
|---|---|
| Frontend (React PWA) | GitHub Pages, deployed by `.github/workflows/deploy-pages.yml` on every push to `main` |
| Database + auth | Supabase (Postgres + Supabase Auth), project `qcyijvnkgdznekbzccgj` |

There is no server to run. The browser talks to Supabase directly with the **publishable** key, and row-level security (`supabase/schema.sql`) makes sure each user can only read and write their own rows. Stats (heatmap, streaks, PRs, correlations) are computed in the browser from the user's logs.

## Run locally

```bash
cd frontend
npm install
cp .env.example .env.local   # fill in the Supabase URL + publishable key, or leave blank
BASE_PATH=/ npm run dev
```

Without Supabase values the app runs in **local mode**: no sign-in, data saved in that browser's localStorage. Handy for UI work.

## Database changes

`supabase/schema.sql` is the source of truth and is safe to re-run. Paste it into Supabase → SQL Editor → Run after editing it.

## Enabling Google / GitHub sign-in

1. Supabase → Authentication → Providers → enable Google and/or GitHub (each needs an OAuth app client ID/secret from that provider; the callback URL is shown on the Supabase page).
2. GitHub repo → Settings → Secrets and variables → Actions → Variables → add `VITE_AUTH_PROVIDERS` = `google,github`.
3. Re-run the "Deploy frontend to GitHub Pages" workflow.

## `backend/` (optional)

The original FastAPI service is still here (`docker compose up`, then `alembic upgrade head`). It's a working, self-hostable alternative API with the same logic, but the GitHub Pages deployment doesn't use it.
