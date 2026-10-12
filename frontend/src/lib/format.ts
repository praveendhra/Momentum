import type { ActivityLog, ActivityUnit, PersonalRecord } from '../types'
import type { Preferences } from './preferences'
import { fmt, fmtAmount, fmtWeight, toDisplay, type Measure } from './units'

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

export function fmtNum(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(1).replace(/\.0$/, '')
}

export function summarizeLog(log: ActivityLog, unit: ActivityUnit, prefs: Preferences): string {
  const parts: string[] = []
  const sets = (log.extra_data?.sets as { reps: number; weight: number }[] | undefined) ?? []
  if (sets.length) {
    parts.push(sets.map((s) => (s.weight ? `${s.reps}×${fmt(toDisplay(s.weight, 'weight', prefs))}` : `${s.reps} reps`)).join(', ') + ` ${prefs.weightUnit}`)
  }
  if (log.quantity != null && unit !== 'minutes' && unit !== 'boolean') parts.push(fmtAmount(log.quantity, unit, prefs))
  if (log.duration_minutes != null) parts.push(`${fmtNum(log.duration_minutes)} min`)
  if (log.mood_score != null) parts.push(`mood ${log.mood_score}/10`)
  if (log.intensity != null) parts.push(`intensity ${log.intensity}/10`)
  if (log.difficulty != null) parts.push(`difficulty ${log.difficulty}/10`)
  if (log.quality != null) parts.push(`quality ${log.quality}/5`)
  if (!parts.length) parts.push('Done')
  return parts.join(' · ')
}

export const RECORD_LABELS: Record<PersonalRecord['record_type'], { label: string; measure: Measure; unit?: string }> = {
  weight: { label: 'Heaviest set', measure: 'weight' },
  reps: { label: 'Most reps', measure: 'plain', unit: 'reps' },
  volume: { label: 'Session volume', measure: 'weight' },
  e1rm: { label: 'Est. 1RM', measure: 'weight' },
  duration: { label: 'Longest session', measure: 'plain', unit: 'min' },
  distance: { label: 'Longest distance', measure: 'distance' },
}

export function fmtRecord(pr: Pick<PersonalRecord, 'record_type' | 'value'>, prefs: Preferences): string {
  const meta = RECORD_LABELS[pr.record_type]
  if (meta.measure === 'weight') return fmtWeight(pr.value, prefs)
  if (meta.measure === 'distance') return fmtAmount(pr.value, 'km', prefs)
  return `${fmt(pr.value)} ${meta.unit ?? ''}`.trim()
}
