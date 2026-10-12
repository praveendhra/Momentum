# Momentum

Daily self-improvement tracker: log workouts, habits, skill practice and mood, and watch progress build up on a GitHub-style heatmap. Weekly consistency instead of punishing streaks, automatic personal records, and mood insights once you have two weeks of data.

**Live:** https://momentum.praveendhra.com

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
npm run dev
```

Without Supabase values the app runs in **local mode**: no sign-in, data saved in that browser's localStorage. Handy for UI work.

## Settings

Theme (light / dark / system), units (kg/lb, km/mi, L/fl oz), week start, time zone and email notifications live under **Settings** and are saved to `profiles.preferences`, so they follow you across devices. Everything is stored in metric; units only change what you see and type.

## Email notifications

- `supabase/functions/send-notifications`: Edge Function that sends a daily reminder (at your chosen hour, only if nothing was logged that day) and a Sunday 7 pm weekly summary, via [Resend](https://resend.com). `notification_log` makes every email send at most once.
- `supabase/cron.sql`: hourly `pg_cron` job that calls the function.
- Secrets (Supabase → Edge Functions → Secrets): `RESEND_API_KEY` and `RESEND_FROM` (currently `Momentum <momentum@mail.praveendhra.com>`).
- Sending domain: `mail.praveendhra.com`, verified in Resend via a DKIM TXT record and two `CNAME`s (`rsend.mail`, `send.mail`, DNS only) in Cloudflare. Nothing on the root domain's email was changed.
- The function's "Verify JWT with legacy secret" setting must be **off** (the function authenticates test-email requests itself).
- Redeploy after editing: paste `index.ts` into the function's Code tab in the dashboard, or `supabase functions deploy send-notifications --no-verify-jwt`.

## Database changes

`supabase/schema.sql` is the source of truth and is safe to re-run. Paste it into Supabase → SQL Editor → Run after editing it.

## Enabling Google / GitHub sign-in

1. Supabase → Authentication → Providers → enable Google and/or GitHub (each needs an OAuth app client ID/secret from that provider; the callback URL is shown on the Supabase page).
2. GitHub repo → Settings → Secrets and variables → Actions → Variables → add `VITE_AUTH_PROVIDERS` = `google,github`.
3. Re-run the "Deploy frontend to GitHub Pages" workflow.

## `backend/` (optional)

The original FastAPI service is still here (`docker compose up`, then `alembic upgrade head`). It's a working, self-hostable alternative API with the same logic, but the GitHub Pages deployment doesn't use it.
