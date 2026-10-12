/**
 * Realistic demo history for exploring the dashboard.
 *
 * Every generated log carries extra_data.sample = true so it can be removed
 * later without touching anything the user logged themselves.
 */
import { PRESETS } from './catalog'
import { addDays, localDate } from './format'
import type { Activity, LogInput } from '../types'

export const SAMPLE_ACTIVITY_NAMES = [
  'Strength Training',
  'Running',
  'Yoga',
  'Meditation',
  'Reading',
  'Water',
  'Coding Practice',
  'Mood Check-in',
] as const

/** Small deterministic PRNG so the demo looks the same every time. */
function mulberry32(seed: number) {
  return () => {
    seed |= 0
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n))
const round1 = (n: number) => Math.round(n * 10) / 10

export const samplePresets = () => PRESETS.filter((p) => (SAMPLE_ACTIVITY_NAMES as readonly string[]).includes(p.name))

export function generateSampleLogs(activities: Activity[], days = 120, today = localDate()): LogInput[] {
  const rnd = mulberry32(20261011)
  const pick = <T,>(xs: T[]) => xs[Math.floor(rnd() * xs.length)]
  const byName = new Map(activities.map((a) => [a.name, a]))
  const out: LogInput[] = []
  const add = (name: string, logged_date: string, fields: Omit<LogInput, 'activity_id' | 'logged_date'>) => {
    const a = byName.get(name)
    if (!a) return
    out.push({ activity_id: a.id, logged_date, ...fields, extra_data: { ...(fields.extra_data ?? {}), sample: true } })
  }

  let squat = 60 // kg, progressive overload
  let runKm = 3
  const workedOut = new Set<string>()

  for (let i = days - 1; i >= 0; i--) {
    const date = addDays(today, -i)
    const [y, m, d] = date.split('-').map(Number)
    const dow = new Date(y, m - 1, d).getDay() // 0 = Sun
    const weekend = dow === 0 || dow === 6
    // A "rough patch" a few weeks back makes the heatmap look human.
    const slump = i >= 45 && i <= 52
    const p = (base: number) => (slump ? base * 0.35 : base)
    // Some days nothing gets logged at all; the heatmap should have gaps.
    if (rnd() < (slump ? 0.45 : 0.1)) continue

    if ([1, 3, 5].includes(dow) && rnd() < p(0.85)) {
      const deload = rnd() < 0.1
      if (!deload) squat += pick([0, 0, 1.25, 1.25, 2.5])
      const w = deload ? squat * 0.85 : squat
      const sets = Array.from({ length: pick([3, 4, 5]) }, (_, k) => ({ reps: k === 0 && rnd() < 0.3 ? 6 : 5, weight: round1(w) }))
      add('Strength Training', date, {
        duration_minutes: Math.round(40 + rnd() * 25),
        intensity: Math.round(clamp(6 + rnd() * 3.5, 1, 10)),
        notes: deload ? 'Deload week, kept it light' : pick([null, null, 'Squats felt strong', 'Paused reps on the last set']),
        extra_data: { sets },
      })
      workedOut.add(date)
    }

    if ([2, 4, 6].includes(dow) && rnd() < p(0.75)) {
      runKm = clamp(runKm + (rnd() - 0.35) * 0.6, 3, 12)
      const km = round1(dow === 6 ? runKm * 1.6 : runKm)
      add('Running', date, {
        quantity: km,
        duration_minutes: Math.round(km * (5.3 + rnd() * 0.9)),
        intensity: Math.round(clamp(5 + rnd() * 4, 1, 10)),
      })
      workedOut.add(date)
    }

    if (dow === 0 && rnd() < p(0.7)) {
      add('Yoga', date, { duration_minutes: pick([20, 30, 30, 45]), intensity: pick([3, 4, 5]) })
      workedOut.add(date)
    }

    if (rnd() < p(weekend ? 0.55 : 0.8)) {
      add('Meditation', date, { duration_minutes: pick([10, 10, 12, 15, 20]), quality: pick([3, 4, 4, 5]) })
    }

    if (rnd() < p(0.55)) {
      add('Reading', date, { quantity: Math.round(12 + rnd() * 30), duration_minutes: Math.round(20 + rnd() * 30) })
    }

    if (rnd() < 0.55) {
      add('Water', date, { quantity: round1(1.3 + rnd() * 1.4) })
    }

    if (!weekend && rnd() < p(0.65)) {
      add('Coding Practice', date, {
        duration_minutes: pick([30, 45, 60, 90]),
        difficulty: Math.round(clamp(4 + (days - i) / days * 3 + rnd() * 2, 1, 10)),
        quality: pick([3, 4, 4, 5]),
        notes: pick(['LeetCode mediums', 'Side project: Momentum', 'Terraform modules', 'GitHub Actions workflows', 'Python asyncio']),
      })
    }

    if (rnd() < (slump ? 0.5 : 0.8)) {
      const afterWorkout = workedOut.has(addDays(date, -1))
      const mood = Math.round(clamp(5.6 + (afterWorkout ? 1.6 : 0) + (weekend ? 0.4 : 0) - (slump ? 1.5 : 0) + (rnd() - 0.5) * 2.4, 1, 10))
      const factors = [
        ...(afterWorkout ? ['workout'] : []),
        ...(rnd() < 0.4 ? ['sleep'] : []),
        ...(weekend && rnd() < 0.6 ? ['social'] : []),
        ...(!weekend && rnd() < 0.45 ? ['work'] : []),
      ]
      add('Mood Check-in', date, {
        quantity: 1,
        mood_score: mood,
        notes: rnd() < 0.3 ? pick(['Grateful for a slow morning coffee', 'Good call with family', 'Nice walk outside', 'Shipped something at work']) : null,
        extra_data: {
          energy: Math.round(clamp(mood + (rnd() - 0.5) * 3, 1, 10)),
          stress: Math.round(clamp(10 - mood + (rnd() - 0.5) * 3, 1, 10)),
          factors,
        },
      })
    }
  }
  return out
}
