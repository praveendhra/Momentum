/** Per-activity stats and motivational copy for the Activities page. */
import type { Activity, ActivityLog, PersonalRecord } from '../types'
import type { Preferences } from './preferences'
import { addDays, localDate } from './format'
import { computeStreak } from './stats'
import { fmt, toDisplay, unitLabel, measureOf } from './units'

export const MILESTONES = [5, 10, 25, 50, 100, 250, 500, 1000, 2500, 5000]

export interface ActivityInsight {
  activity: Activity
  sessions: number
  lastDate: string | null
  daysSinceLast: number | null
  loggedToday: boolean
  currentStreak: number
  longestStreak: number
  /** Consecutive 7-day blocks (ending today) with at least one session. */
  weekStreak: number
  daysThisWeek: number
  last30: number
  prev30: number
  /** Sessions per week for the last 12 weeks, oldest first. */
  weekly: number[]
  totalMinutes: number
  totalQuantity: number
  nextMilestone: number | null
  prevMilestone: number
  topRecord: PersonalRecord | null
}

function daysBetween(a: string, b: string): number {
  const [y1, m1, d1] = a.split('-').map(Number)
  const [y2, m2, d2] = b.split('-').map(Number)
  return Math.round((Date.UTC(y2, m2 - 1, d2) - Date.UTC(y1, m1 - 1, d1)) / 86_400_000)
}

const RECORD_PRIORITY: PersonalRecord['record_type'][] = ['e1rm', 'weight', 'distance', 'volume', 'duration', 'reps']

export function activityInsights(
  activities: Activity[],
  logs: ActivityLog[],
  prs: PersonalRecord[],
  today = localDate(),
): ActivityInsight[] {
  const byActivity = new Map<string, ActivityLog[]>()
  for (const l of logs) byActivity.set(l.activity_id, [...(byActivity.get(l.activity_id) ?? []), l])

  return activities.map((activity) => {
    const own = byActivity.get(activity.id) ?? []
    const days = [...new Set(own.map((l) => l.logged_date))].sort()
    const lastDate = days.at(-1) ?? null
    const streak = computeStreak(days, today)
    const daySet = new Set(days)

    let daysThisWeek = 0
    for (let i = 0; i < 7; i++) if (daySet.has(addDays(today, -i))) daysThisWeek++

    const inRange = (from: number, to: number) =>
      own.filter((l) => {
        const ago = daysBetween(l.logged_date, today)
        return ago >= from && ago <= to
      }).length

    const weekly = Array.from({ length: 12 }, (_, w) => inRange((11 - w) * 7, (11 - w) * 7 + 6))

    // Weeks in a row with at least one session (this week may still be in progress).
    let weekStreak = 0
    for (let w = 0; ; w++) {
      const has = days.some((d) => {
        const ago = daysBetween(d, today)
        return ago >= w * 7 && ago <= w * 7 + 6
      })
      if (has) weekStreak++
      else if (w > 0) break
      if (w > 520) break
    }

    const sessions = own.length
    const nextMilestone = MILESTONES.find((m) => m > sessions) ?? null
    const prevMilestone = [...MILESTONES].reverse().find((m) => m <= sessions) ?? 0

    const mine = prs.filter((p) => p.activity_id === activity.id)
    const topRecord = RECORD_PRIORITY.map((t) => mine.find((p) => p.record_type === t)).find(Boolean) ?? null

    return {
      activity,
      sessions,
      lastDate,
      daysSinceLast: lastDate ? daysBetween(lastDate, today) : null,
      loggedToday: lastDate === today,
      currentStreak: streak.current,
      longestStreak: streak.longest,
      weekStreak,
      daysThisWeek,
      last30: inRange(0, 29),
      prev30: inRange(30, 59),
      weekly,
      totalMinutes: own.reduce((a, l) => a + (l.duration_minutes ?? 0), 0),
      totalQuantity: own.reduce((a, l) => a + (l.quantity ?? 0), 0),
      nextMilestone,
      prevMilestone,
      topRecord,
    }
  })
}

const ordinal = (n: number) => {
  const s = ['th', 'st', 'nd', 'rd']
  const v = n % 100
  return `${n}${s[(v - 20) % 10] || s[v] || s[0]}`
}

export type Tone = 'fire' | 'goal' | 'up' | 'nudge' | 'start' | 'calm'

/** One encouraging line, picked from whatever is most motivating right now. */
export function headline(i: ActivityInsight): { text: string; tone: Tone } {
  if (i.sessions === 0) return { text: 'Fresh start. Your first session is the hardest one, and the most important.', tone: 'start' }

  if (i.currentStreak >= 3) {
    return i.loggedToday
      ? { text: `🔥 ${i.currentStreak}-day streak and today's done. Momentum looks good on you.`, tone: 'fire' }
      : { text: `🔥 ${i.currentStreak}-day streak. Log today to make it ${i.currentStreak + 1}.`, tone: 'fire' }
  }

  if (i.weekStreak >= 4 && i.currentStreak < 3) {
    return { text: `🔥 ${i.weekStreak} weeks in a row. That's how habits are built.`, tone: 'fire' }
  }

  if (i.nextMilestone && i.nextMilestone - i.sessions <= 3) {
    const left = i.nextMilestone - i.sessions
    return { text: `🎯 Only ${left} more to your ${ordinal(i.nextMilestone)} session.`, tone: 'goal' }
  }

  if (i.daysSinceLast != null && i.daysSinceLast >= 7) {
    return { text: `👋 It's been ${i.daysSinceLast} days. One short session puts you right back on track.`, tone: 'nudge' }
  }

  if (i.prev30 >= 3 && i.last30 > i.prev30) {
    const pct = Math.round(((i.last30 - i.prev30) / i.prev30) * 100)
    if (pct >= 15) return { text: `📈 Up ${pct}% on last month. You're building real momentum.`, tone: 'up' }
  }

  if (i.daysThisWeek >= 5) return { text: `💪 ${i.daysThisWeek} of the last 7 days. That's elite consistency.`, tone: 'fire' }
  if (i.loggedToday) return { text: '✅ Done for today. Small wins add up.', tone: 'calm' }
  if (i.daysSinceLast === 1) return { text: 'Did it yesterday. Keep the chain going today.', tone: 'calm' }
  return { text: `${i.daysThisWeek}/7 days this week. Every session counts toward your best self.`, tone: 'calm' }
}

/** Lifetime total in the user's units, plus a fun real-world comparison. */
export function lifetime(i: ActivityInsight, prefs: Preferences): { value: string; label: string; fun: string | null } | null {
  const { unit } = i.activity
  const hours = i.totalMinutes / 60

  if (unit === 'km' && i.totalQuantity > 0) {
    const shown = toDisplay(i.totalQuantity, 'distance', prefs)
    const marathons = i.totalQuantity / 42.195
    const fun =
      i.totalQuantity >= 346 ? `≈ ${fmt(i.totalQuantity / 346)}× Boston → New York`
        : marathons >= 1 ? `≈ ${fmt(marathons)} marathons`
          : `≈ ${fmt(i.totalQuantity / 0.4)} laps of a track`
    return { value: `${fmt(shown)} ${unitLabel(unit, prefs)}`, label: 'covered so far', fun }
  }
  if (unit === 'pages' && i.totalQuantity > 0) {
    return { value: `${fmt(i.totalQuantity)} pages`, label: 'read so far', fun: `≈ ${fmt(i.totalQuantity / 300)} books` }
  }
  if (unit === 'liters' && i.totalQuantity > 0) {
    const shown = toDisplay(i.totalQuantity, measureOf(unit), prefs)
    return { value: `${fmt(shown)} ${unitLabel(unit, prefs)}`, label: 'drunk so far', fun: `≈ ${Math.round(i.totalQuantity / 0.5)} water bottles` }
  }
  if (hours >= 1) {
    const fun =
      hours >= 24 ? `≈ ${fmt(hours / 24)} full days of practice`
        : hours >= 2 ? `≈ ${fmt(hours / 2)} feature-length movies`
          : null
    return { value: `${fmt(hours)} h`, label: 'invested so far', fun }
  }
  if (i.totalMinutes > 0) return { value: `${fmt(i.totalMinutes)} min`, label: 'invested so far', fun: null }
  return null
}

export function lastDoneLabel(i: ActivityInsight): string {
  if (i.daysSinceLast == null) return 'Not logged yet'
  if (i.daysSinceLast === 0) return 'Done today'
  if (i.daysSinceLast === 1) return 'Yesterday'
  return `${i.daysSinceLast} days ago`
}
