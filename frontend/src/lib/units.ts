/**
 * Everything is stored in metric (kg, km, litres). These helpers convert to and
 * from what the user chose in Settings, for display and for form input.
 */
import type { Preferences } from './preferences'
import type { ActivityUnit } from '../types'

const KG_PER_LB = 0.45359237
const KM_PER_MI = 1.609344
const L_PER_FLOZ = 0.0295735295625

export type Measure = 'weight' | 'distance' | 'volume' | 'plain'

/** Which convertible measure an activity unit is, if any. */
export function measureOf(unit: ActivityUnit): Measure {
  if (unit === 'km') return 'distance'
  if (unit === 'liters') return 'volume'
  return 'plain'
}

function factor(measure: Measure, p: Preferences): number {
  if (measure === 'weight' && p.weightUnit === 'lb') return 1 / KG_PER_LB
  if (measure === 'distance' && p.distanceUnit === 'mi') return 1 / KM_PER_MI
  if (measure === 'volume' && p.volumeUnit === 'floz') return 1 / L_PER_FLOZ
  return 1
}

/** Stored metric value → value in the user's units. */
export function toDisplay(value: number, measure: Measure, p: Preferences): number {
  return value * factor(measure, p)
}

/** Value the user typed in their units → metric for storage. */
export function fromDisplay(value: number, measure: Measure, p: Preferences): number {
  return value / factor(measure, p)
}

export function measureLabel(measure: Measure, p: Preferences): string {
  if (measure === 'weight') return p.weightUnit
  if (measure === 'distance') return p.distanceUnit
  if (measure === 'volume') return p.volumeUnit === 'floz' ? 'fl oz' : 'L'
  return ''
}

const PLAIN_LABELS: Record<ActivityUnit, string> = {
  minutes: 'min',
  reps: 'reps',
  km: 'km',
  pages: 'pages',
  liters: 'L',
  count: '',
  boolean: '',
}

/** Short label for an activity's unit in the user's units ("mi", "fl oz", "pages", …). */
export function unitLabel(unit: ActivityUnit, p: Preferences): string {
  const m = measureOf(unit)
  return m === 'plain' ? PLAIN_LABELS[unit] : measureLabel(m, p)
}

/** Round sensibly for display: whole numbers stay whole, otherwise one decimal. */
export function fmt(n: number): string {
  if (!Number.isFinite(n)) return '—'
  const r = Math.round(n * 10) / 10
  return Number.isInteger(r) ? String(r) : r.toFixed(1)
}

/** Format a stored metric amount for an activity in the user's units, e.g. "3.1 mi". */
export function fmtAmount(value: number, unit: ActivityUnit, p: Preferences): string {
  const m = measureOf(unit)
  const label = unitLabel(unit, p)
  return `${fmt(toDisplay(value, m, p))}${label ? ` ${label}` : ''}`
}

export function fmtWeight(kg: number, p: Preferences): string {
  return `${fmt(toDisplay(kg, 'weight', p))} ${p.weightUnit}`
}
