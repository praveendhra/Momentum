/** Range, colour and insight helpers for the activity heatmap. */
import type { DayActivity } from '../types'
import { addDays, localDate } from './format'

export type HeatRange = 'last12' | number // number = calendar year

export function rangeBounds(range: HeatRange, today = localDate()): { start: string; end: string } {
  if (range === 'last12') return { start: addDays(today, -364), end: today }
  const end = String(range) === today.slice(0, 4) ? today : `${range}-12-31`
  return { start: `${range}-01-01`, end }
}

/** The calendar only needs its first and last day present; fill those in so the grid spans the range. */
export function padRange(data: DayActivity[], start: string, end: string): DayActivity[] {
  const out = data.filter((d) => d.date >= start && d.date <= end)
  if (!out.length || out[0].date !== start) out.unshift({ date: start, count: 0, level: 0 })
  if (out[out.length - 1].date !== end) out.push({ date: end, count: 0, level: 0 })
  return out
}

const WEEKDAYS = ['Sundays', 'Mondays', 'Tuesdays', 'Wednesdays', 'Thursdays', 'Fridays', 'Saturdays']

export interface HeatInsights {
  sessions: number
  activeDays: number
  totalDays: number
  currentStreak: number
  longestStreak: number
  bestDay: DayActivity | null
  bestWeekday: string | null
}

export function heatInsights(data: DayActivity[], start: string, end: string, today = localDate()): HeatInsights {
  const counts = new Map(data.filter((d) => d.count > 0 && d.date >= start && d.date <= end).map((d) => [d.date, d]))
  let totalDays = 0
  let longest = 0
  let run = 0
  const perWeekday = Array(7).fill(0) as number[]
  const weekdaysSeen = Array(7).fill(0) as number[]
  for (let d = start; d <= end; d = addDays(d, 1)) {
    totalDays++
    const [y, m, dd] = d.split('-').map(Number)
    const wd = new Date(y, m - 1, dd).getDay()
    weekdaysSeen[wd]++
    if (counts.has(d)) {
      run++
      longest = Math.max(longest, run)
      perWeekday[wd]++
    } else run = 0
  }

  // Current streak: ending today, or yesterday if today isn't logged yet.
  let cursor = counts.has(today) ? today : addDays(today, -1)
  let current = 0
  while (counts.has(cursor)) {
    current++
    cursor = addDays(cursor, -1)
  }

  const active = [...counts.values()]
  const bestDay = active.reduce<DayActivity | null>((b, d) => (!b || d.count > b.count ? d : b), null)
  const rates = perWeekday.map((n, i) => (weekdaysSeen[i] ? n / weekdaysSeen[i] : 0))
  const top = rates.indexOf(Math.max(...rates))

  return {
    sessions: active.reduce((a, d) => a + d.count, 0),
    activeDays: active.length,
    totalDays,
    currentStreak: current,
    longestStreak: longest,
    bestDay,
    bestWeekday: active.length >= 7 ? WEEKDAYS[top] : null,
  }
}

// ─── Colours ───

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '')
  const n = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h, 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

function mix(a: string, b: string, t: number): string {
  const [r1, g1, b1] = hexToRgb(a)
  const [r2, g2, b2] = hexToRgb(b)
  const c = (x: number, y: number) => Math.round(x + (y - x) * t).toString(16).padStart(2, '0')
  return `#${c(r1, r2)}${c(g1, g2)}${c(b1, b2)}`
}

/** Five-step scale (empty → full) blending the accent colour into the card background. */
export function heatScale(accent: string, theme: 'light' | 'dark'): string[] {
  const empty = theme === 'dark' ? '#1e293b' : '#e5e9f0'
  const base = theme === 'dark' ? '#0f172a' : '#ffffff'
  return [empty, mix(base, accent, 0.3), mix(base, accent, 0.55), mix(base, accent, 0.8), accent]
}

export const LEVEL_LABELS = ['No sessions', '1 session', '2 sessions', '3–4 sessions', '5+ sessions']
