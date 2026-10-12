import type { ActivityLog, ActivityUnit, PersonalRecord } from '../types'

/** YYYY-MM-DD in the user's local timezone (toISOString would use UTC). */
export function localDate(d: Date = new Date()): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function addDays(iso: string, days: number): string {
  const [y, m, d] = iso.split('-').map(Number)
  return localDate(new Date(y, m - 1, d + days))
}

export function prettyDate(iso: string): string {
  const today = localDate()
  if (iso === today) return 'Today'
  if (iso === addDays(today, -1)) return 'Yesterday'
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: y === new Date().getFullYear() ? undefined : 'numeric',
  })
}

export const UNIT_LABELS: Record<ActivityUnit, string> = {
  minutes: 'min',
  reps: 'reps',
  km: 'km',
  pages: 'pages',
  liters: 'L',
  count: '',
  boolean: '',
}

export function fmtNum(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(1).replace(/\.0$/, '')
}

export function summarizeLog(log: ActivityLog, unit: ActivityUnit): string {
  const parts: string[] = []
  const sets = (log.extra_data?.sets as { reps: number; weight: number }[] | undefined) ?? []
  if (sets.length) {
    parts.push(sets.map((s) => `${s.reps}×${fmtNum(s.weight)}`).join(', '))
  }
  if (log.quantity != null && unit !== 'minutes') parts.push(`${fmtNum(log.quantity)} ${UNIT_LABELS[unit]}`.trim())
  if (log.duration_minutes != null) parts.push(`${fmtNum(log.duration_minutes)} min`)
  if (log.mood_score != null) parts.push(`mood ${log.mood_score}/10`)
  if (log.intensity != null) parts.push(`intensity ${log.intensity}/10`)
  if (log.difficulty != null) parts.push(`difficulty ${log.difficulty}/10`)
  if (log.quality != null) parts.push(`quality ${log.quality}/5`)
  if (!parts.length) parts.push('Done')
  return parts.join(' · ')
}

export const RECORD_LABELS: Record<PersonalRecord['record_type'], { label: string; unit: string }> = {
  weight: { label: 'Heaviest set', unit: 'kg' },
  reps: { label: 'Most reps', unit: 'reps' },
  volume: { label: 'Session volume', unit: 'kg' },
  e1rm: { label: 'Est. 1RM', unit: 'kg' },
  duration: { label: 'Longest session', unit: 'min' },
  distance: { label: 'Longest distance', unit: 'km' },
}
