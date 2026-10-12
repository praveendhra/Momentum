/**
 * Progress stats, computed from the user's logs in the browser.
 * (Ported from the original FastAPI services so behaviour is unchanged.)
 */
import type {
  Activity,
  ActivityLog,
  CategorySlug,
  Correlations,
  CorrelationInsight,
  DashboardSummary,
  DayActivity,
  PersonalRecord,
  Streak,
} from '../types'
import { CATEGORIES } from './catalog'
import { addDays, localDate } from './format'

export function graphLevel(n: number): DayActivity['level'] {
  if (n <= 0) return 0
  if (n === 1) return 1
  if (n === 2) return 2
  if (n <= 4) return 3
  return 4
}

const slugOf = (a: Activity | undefined): CategorySlug =>
  (CATEGORIES.find((c) => c.id === a?.category_id)?.slug ?? 'custom') as CategorySlug

export function activityGraph(
  logs: ActivityLog[],
  activities: Activity[],
  f: { year?: number; activity_id?: string; category_id?: string },
): DayActivity[] {
  const byId = new Map(activities.map((a) => [a.id, a]))
  const counts = new Map<string, number>()
  for (const l of logs) {
    if (f.year && !l.logged_date.startsWith(String(f.year))) continue
    if (f.activity_id && l.activity_id !== f.activity_id) continue
    if (f.category_id && byId.get(l.activity_id)?.category_id !== f.category_id) continue
    counts.set(l.logged_date, (counts.get(l.logged_date) ?? 0) + 1)
  }
  return [...counts.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, count]) => ({ date, count, level: graphLevel(count) }))
}

/** date → activities logged that day (icon + name, de-duplicated), with the same filters as the graph. */
export function dayBreakdown(
  logs: ActivityLog[],
  activities: Activity[],
  f: { year?: number; activity_id?: string; category_id?: string },
): Record<string, string[]> {
  const byId = new Map(activities.map((a) => [a.id, a]))
  const out: Record<string, string[]> = {}
  for (const l of logs) {
    const a = byId.get(l.activity_id)
    if (!a) continue
    if (f.year && !l.logged_date.startsWith(String(f.year))) continue
    if (f.activity_id && l.activity_id !== f.activity_id) continue
    if (f.category_id && a.category_id !== f.category_id) continue
    const label = `${a.icon} ${a.name}`
    const list = (out[l.logged_date] ??= [])
    if (!list.includes(label)) list.push(label)
  }
  return out
}

/** Daily chain + weekly consistency (days logged in the last 7 / 7). */
export function computeStreak(days: string[], today = localDate()): { current: number; longest: number; weekly: number } {
  const uniq = [...new Set(days)].sort()
  if (!uniq.length) return { current: 0, longest: 0, weekly: 0 }
  const ref = uniq[uniq.length - 1] > today ? uniq[uniq.length - 1] : today
  let longest = 1
  let run = 1
  for (let i = 1; i < uniq.length; i++) {
    run = addDays(uniq[i - 1], 1) === uniq[i] ? run + 1 : 1
    longest = Math.max(longest, run)
  }
  const set = new Set(uniq)
  let d = set.has(ref) ? ref : addDays(ref, -1)
  let current = 0
  while (set.has(d)) {
    current++
    d = addDays(d, -1)
  }
  let inWeek = 0
  for (let i = 0; i < 7; i++) if (set.has(addDays(ref, -i))) inWeek++
  return { current, longest, weekly: Math.round((inWeek / 7) * 1000) / 10 }
}

export function streaks(logs: ActivityLog[], activities: Activity[]): Streak[] {
  const days = new Map<string, string[]>()
  for (const l of logs) days.set(l.activity_id, [...(days.get(l.activity_id) ?? []), l.logged_date])
  return activities
    .filter((a) => days.has(a.id))
    .map((a) => {
      const s = computeStreak(days.get(a.id)!)
      return {
        activity_id: a.id,
        activity_name: a.name,
        current_streak: s.current,
        longest_streak: s.longest,
        weekly_consistency_score: s.weekly,
      }
    })
    .sort((x, y) => y.weekly_consistency_score - x.weekly_consistency_score || x.activity_name.localeCompare(y.activity_name))
}

function num(v: unknown): number {
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}

export function logMetrics(log: ActivityLog, activity: Activity): Partial<Record<PersonalRecord['record_type'], number>> {
  const m: Partial<Record<PersonalRecord['record_type'], number>> = {}
  const sets = log.extra_data?.sets
  if (Array.isArray(sets) && sets.length) {
    let w = 0, r = 0, e = 0, vol = 0
    for (const s of sets as Record<string, unknown>[]) {
      const reps = num(s?.reps)
      const weight = num(s?.weight)
      if (reps <= 0) continue
      r = Math.max(r, reps)
      if (weight > 0) {
        w = Math.max(w, weight)
        vol += reps * weight
        e = Math.max(e, weight * (1 + reps / 30)) // Epley
      }
    }
    if (w) m.weight = w
    if (r) m.reps = r
    if (vol) m.volume = Math.round(vol * 100) / 100
    if (e) m.e1rm = Math.round(e * 10) / 10
  }
  if (slugOf(activity) === 'workout' && log.duration_minutes) m.duration = log.duration_minutes
  if (activity.unit === 'km' && log.quantity) m.distance = log.quantity
  return m
}

export function personalRecords(logs: ActivityLog[], activities: Activity[]): PersonalRecord[] {
  const byId = new Map(activities.map((a) => [a.id, a]))
  const best = new Map<string, PersonalRecord>()
  const ordered = [...logs].sort((a, b) => a.logged_date.localeCompare(b.logged_date) || a.created_at.localeCompare(b.created_at))
  for (const log of ordered) {
    const a = byId.get(log.activity_id)
    if (!a) continue
    for (const [type, value] of Object.entries(logMetrics(log, a)) as [PersonalRecord['record_type'], number][]) {
      const key = `${a.id}:${type}`
      const cur = best.get(key)
      if (!cur || value > cur.value) {
        best.set(key, { id: `${log.id}:${type}`, activity_id: a.id, activity_name: a.name, record_type: type, value, logged_date: log.logged_date })
      }
    }
  }
  return [...best.values()].sort((x, y) => y.logged_date.localeCompare(x.logged_date))
}

/** Record types a new log beats (the very first log of an activity isn't a "new" PR). */
export function newRecordsFor(log: ActivityLog, previousLogs: ActivityLog[], activity: Activity): string[] {
  const prev = previousLogs.filter((l) => l.activity_id === activity.id && l.id !== log.id)
  const best: Record<string, number> = {}
  for (const l of prev) for (const [t, v] of Object.entries(logMetrics(l, activity))) best[t] = Math.max(best[t] ?? 0, v)
  return Object.entries(logMetrics(log, activity))
    .filter(([t, v]) => t in best && v > best[t])
    .map(([t]) => t)
    .sort()
}

export function summary(logs: ActivityLog[], activities: Activity[]): DashboardSummary {
  const month = localDate().slice(0, 7)
  const counts = new Map<string, number>()
  for (const l of logs) counts.set(l.activity_id, (counts.get(l.activity_id) ?? 0) + 1)
  const top = [...counts.entries()].sort((a, b) => b[1] - a[1])[0]
  return {
    active_days_this_month: new Set(logs.filter((l) => l.logged_date.startsWith(month)).map((l) => l.logged_date)).size,
    total_sessions: logs.length,
    top_activity: top ? activities.find((a) => a.id === top[0])?.name ?? null : null,
    current_longest_streak: Math.max(0, ...streaks(logs, activities).map((s) => s.current_streak)),
  }
}

export const CORRELATION_MIN_DAYS = 14
const MIN_GROUP = 3
const PHRASES: Record<string, string> = {
  workout: 'a workout',
  habit: 'keeping up your habits',
  skill: 'skill practice',
  custom: 'your custom activities',
}

/** Lag-1: is mood higher on days after a day with category X logged? */
export function correlations(logs: ActivityLog[], activities: Activity[]): Correlations {
  const byId = new Map(activities.map((a) => [a.id, a]))
  const moods = new Map<string, number[]>()
  const cats = new Map<string, Set<string>>()
  for (const l of logs) {
    if (l.mood_score != null) moods.set(l.logged_date, [...(moods.get(l.logged_date) ?? []), l.mood_score])
    const set = cats.get(l.logged_date) ?? new Set<string>()
    set.add(slugOf(byId.get(l.activity_id)))
    cats.set(l.logged_date, set)
  }
  const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length
  const moodByDay = new Map([...moods].map(([d, xs]) => [d, mean(xs)]))
  if (moodByDay.size < CORRELATION_MIN_DAYS) return { mood_days: moodByDay.size, required_days: CORRELATION_MIN_DAYS, insights: [] }

  const insights: CorrelationInsight[] = []
  for (const slug of ['workout', 'habit', 'skill', 'custom']) {
    const after: number[] = []
    const notAfter: number[] = []
    for (const [day, mood] of moodByDay) (cats.get(addDays(day, -1))?.has(slug) ? after : notAfter).push(mood)
    if (after.length < MIN_GROUP || notAfter.length < MIN_GROUP) continue
    const delta = Math.round((mean(after) - mean(notAfter)) * 10) / 10
    if (Math.abs(delta) < 0.3) continue
    insights.push({
      factor: slug,
      metric: 'mood',
      delta,
      description: `On days after ${PHRASES[slug]}, your mood is ${Math.abs(delta).toFixed(1)} pts ${delta > 0 ? 'higher' : 'lower'}.`,
    })
  }
  insights.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))
  return { mood_days: moodByDay.size, required_days: CORRELATION_MIN_DAYS, insights }
}
