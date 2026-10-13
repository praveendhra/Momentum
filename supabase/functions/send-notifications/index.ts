// Momentum email notifications (Supabase Edge Function, Deno).
//
// Two ways it runs:
//   • Hourly, from pg_cron (no auth, body {}). For every opted-in user whose
//     local time matches, it sends the daily reminder (only if nothing has been
//     logged today) and, on Sunday at 19:00, the weekly summary. Each email is
//     "claimed" in notification_log first, so a repeated or concurrent run can
//     never send the same email twice. Calling it without auth is therefore
//     harmless: it can only do what the schedule would do anyway.
//   • From the app's Settings → "Send me a test email" (signed-in user's JWT,
//     body {"test": true}). Sends both emails to that user right away.
//
// Secrets: RESEND_API_KEY (required), RESEND_FROM (optional; defaults to
// Resend's shared test sender, which can only deliver to your own address).
// SUPABASE_URL and the service key are provided by Supabase automatically.

import { createClient } from 'npm:@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
// Newer projects expose secret keys as JSON in SUPABASE_SECRET_KEYS; older ones as SUPABASE_SERVICE_ROLE_KEY.
function serviceKey(): string {
  const legacy = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (legacy) return legacy
  try {
    const keys = JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS') ?? '{}') as Record<string, string>
    const first = keys.default ?? Object.values(keys)[0]
    if (first) return first
  } catch {
    /* fall through */
  }
  throw new Error('No Supabase service key available to the function')
}
const SERVICE_KEY = serviceKey()
const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY') ?? ''
const FROM = Deno.env.get('RESEND_FROM') ?? 'Momentum <onboarding@resend.dev>'
const APP_URL = Deno.env.get('APP_URL') ?? 'https://momentum.praveendhra.com'
const WEEKLY_HOUR = 19 // Sunday, local time

const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } })

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface Target {
  user_id: string
  email: string
  display_name: string | null
  timezone: string | null
  preferences: {
    notifications?: { dailyReminder?: boolean; reminderHour?: number; weeklySummary?: boolean }
  } | null
}

/** Local date (YYYY-MM-DD), hour and weekday (0 = Sunday) in a time zone. */
function localParts(tz: string, at = new Date()) {
  let zone = tz
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: zone })
  } catch {
    zone = 'UTC'
  }
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', {
      timeZone: zone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      hourCycle: 'h23',
      weekday: 'short',
    })
      .formatToParts(at)
      .map((p) => [p.type, p.value]),
  )
  const weekday = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(parts.weekday)
  return { date: `${parts.year}-${parts.month}-${parts.day}`, hour: Number(parts.hour), weekday }
}

function addDays(iso: string, n: number): string {
  const d = new Date(`${iso}T12:00:00Z`)
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!)

function layout(title: string, body: string): string {
  return `<!doctype html><html><body style="margin:0;background:#f4f6f9;font-family:-apple-system,Segoe UI,Roboto,sans-serif;color:#1e293b">
  <div style="max-width:520px;margin:0 auto;padding:32px 20px">
    <table role="presentation" cellpadding="0" cellspacing="0" style="margin-bottom:20px"><tr>
      <td style="vertical-align:middle"><img src="${APP_URL}/pwa-192x192.png" width="36" height="36" alt="" style="display:block;border-radius:9px" /></td>
      <td style="vertical-align:middle;padding-left:10px;font-size:20px;font-weight:700;color:#059669">Momentum</td>
    </tr></table>
    <div style="background:#fff;border:1px solid #e2e8f0;border-radius:16px;padding:24px">
      <h1 style="font-size:20px;margin:0 0 12px">${title}</h1>
      ${body}
      <p style="margin:24px 0 0"><a href="${APP_URL}" style="display:inline-block;background:#10b981;color:#052e1f;text-decoration:none;font-weight:600;padding:10px 18px;border-radius:10px">Open Momentum</a></p>
    </div>
    <p style="font-size:12px;color:#64748b;margin-top:16px">You're getting this because you turned on email notifications. Change them in <a href="${APP_URL}/#/settings" style="color:#059669">Settings</a>.</p>
  </div></body></html>`
}

async function sendEmail(to: string, subject: string, html: string) {
  if (!RESEND_API_KEY) throw new Error('RESEND_API_KEY secret is not set')
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: FROM, to: [to], subject, html }),
  })
  if (!res.ok) throw new Error(`Resend ${res.status}: ${await res.text()}`)
}

/** Insert the dedupe row; false if this email was already sent (or claimed) for that date. */
async function claim(userId: string, kind: 'daily_reminder' | 'weekly_summary', day: string): Promise<boolean> {
  const { data, error } = await admin
    .from('notification_log')
    .upsert({ user_id: userId, kind, sent_on: day }, { onConflict: 'user_id,kind,sent_on', ignoreDuplicates: true })
    .select('user_id')
  if (error) throw error
  return (data ?? []).length > 0
}

async function unclaim(userId: string, kind: string, day: string) {
  await admin.from('notification_log').delete().match({ user_id: userId, kind, sent_on: day })
}

async function loggedOn(userId: string, day: string): Promise<number> {
  const { count, error } = await admin
    .from('activity_logs')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('logged_date', day)
  if (error) throw error
  return count ?? 0
}

function reminderEmail(t: Target) {
  const name = t.display_name ? `, ${esc(t.display_name)}` : ''
  return {
    subject: 'A small win for today?',
    html: layout(
      `Nothing logged yet today${name}`,
      `<p style="margin:0;line-height:1.6">A five-minute walk, a few pages, a quick mood check-in: anything counts toward your weekly consistency. Keep the momentum going.</p>`,
    ),
  }
}

async function weeklyEmail(t: Target, today: string) {
  const from = addDays(today, -6)
  const { data: logs, error } = await admin
    .from('activity_logs')
    .select('logged_date, mood_score, activities(name, icon)')
    .eq('user_id', t.user_id)
    .gte('logged_date', from)
    .lte('logged_date', today)
  if (error) throw error
  const rows = (logs ?? []) as { logged_date: string; mood_score: number | null; activities: { name: string; icon: string } | null }[]

  const days = new Set(rows.map((r) => r.logged_date)).size
  const counts = new Map<string, number>()
  for (const r of rows) {
    const key = r.activities ? `${r.activities.icon} ${r.activities.name}` : 'Other'
    counts.set(key, (counts.get(key) ?? 0) + 1)
  }
  const top = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5)
  const moods = rows.map((r) => r.mood_score).filter((m): m is number => m != null)
  const avgMood = moods.length ? (moods.reduce((a, b) => a + b, 0) / moods.length).toFixed(1) : null

  const stat = (label: string, value: string) =>
    `<td style="padding:12px;background:#f4f6f9;border-radius:12px;text-align:center"><div style="font-size:22px;font-weight:700">${value}</div><div style="font-size:12px;color:#64748b">${label}</div></td>`

  const list = top.length
    ? `<table style="width:100%;margin-top:16px;border-collapse:collapse">${top
        .map(([k, n]) => `<tr><td style="padding:6px 0">${esc(k)}</td><td style="padding:6px 0;text-align:right;color:#64748b">${n}×</td></tr>`)
        .join('')}</table>`
    : `<p style="margin:16px 0 0;color:#64748b">No sessions this week. A fresh week starts tomorrow.</p>`

  return {
    subject: rows.length ? `Your week: ${rows.length} sessions across ${days} days` : 'Your Momentum week',
    html: layout(
      'Your week in Momentum',
      `<table style="width:100%;border-collapse:separate;border-spacing:8px 0;margin:0 -8px"><tr>
        ${stat('sessions', String(rows.length))}${stat('active days', `${days}/7`)}${stat('avg mood', avgMood ?? '—')}
      </tr></table>${list}`,
    ),
  }
}

async function runSchedule(now = new Date()) {
  const { data, error } = await admin.rpc('notification_targets')
  if (error) throw error
  const results: Record<string, number> = { reminders: 0, summaries: 0, skipped: 0, failed: 0 }

  for (const t of (data ?? []) as Target[]) {
    const n = t.preferences?.notifications ?? {}
    const local = localParts(t.timezone || 'UTC', now)
    try {
      if (n.dailyReminder && local.hour === (n.reminderHour ?? 20)) {
        if ((await loggedOn(t.user_id, local.date)) > 0) results.skipped++
        else if (await claim(t.user_id, 'daily_reminder', local.date)) {
          const e = reminderEmail(t)
          try {
            await sendEmail(t.email, e.subject, e.html)
            results.reminders++
          } catch (err) {
            await unclaim(t.user_id, 'daily_reminder', local.date)
            throw err
          }
        }
      }
      if (n.weeklySummary && local.weekday === 0 && local.hour === WEEKLY_HOUR) {
        if (await claim(t.user_id, 'weekly_summary', local.date)) {
          const e = await weeklyEmail(t, local.date)
          try {
            await sendEmail(t.email, e.subject, e.html)
            results.summaries++
          } catch (err) {
            await unclaim(t.user_id, 'weekly_summary', local.date)
            throw err
          }
        }
      }
    } catch (err) {
      results.failed++
      console.error(`notify ${t.user_id}:`, err)
    }
  }
  return results
}

async function runTest(req: Request) {
  const token = req.headers.get('Authorization')?.replace(/^Bearer\s+/i, '')
  if (!token) return { status: 401, body: { error: 'Sign in to send a test email' } }
  const { data: auth, error } = await admin.auth.getUser(token)
  if (error || !auth.user?.email) return { status: 401, body: { error: 'Sign in to send a test email' } }

  const { data: profile } = await admin.from('profiles').select('display_name, timezone, preferences').eq('id', auth.user.id).maybeSingle()
  const t: Target = {
    user_id: auth.user.id,
    email: auth.user.email,
    display_name: profile?.display_name ?? null,
    timezone: profile?.timezone ?? 'UTC',
    preferences: profile?.preferences ?? null,
  }
  const today = localParts(t.timezone || 'UTC').date
  const r = reminderEmail(t)
  const w = await weeklyEmail(t, today)
  await sendEmail(t.email, `[Test] ${r.subject}`, r.html)
  await sendEmail(t.email, `[Test] ${w.subject}`, w.html)
  return { status: 200, body: { sent: 2, to: t.email } }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  try {
    const body = await req.json().catch(() => ({}))
    const out = body?.test ? await runTest(req) : { status: 200, body: await runSchedule() }
    return new Response(JSON.stringify(out.body), { status: out.status, headers: { ...cors, 'Content-Type': 'application/json' } })
  } catch (err) {
    console.error(err)
    return new Response(JSON.stringify({ error: String((err as Error)?.message ?? err) }), {
      status: 500,
      headers: { ...cors, 'Content-Type': 'application/json' },
    })
  }
})
