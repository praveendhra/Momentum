import { useState, type FormEvent } from 'react'
import { Modal, Field, Scale, ErrorNote, inputCls, btnPrimary, btnGhost } from './ui'
import { useCreateLog, useUpdateLog } from '../hooks/queries'
import { localDate } from '../lib/format'
import { usePreferences } from '../hooks/usePreferences'
import { fmt, fromDisplay, measureOf, toDisplay, unitLabel as unitLabelFor } from '../lib/units'
import type { Activity, ActivityLog, CategorySlug, LogCreated, LogInput, StrengthSet } from '../types'

const MOOD_FACTORS = ['workout', 'sleep', 'social', 'work', 'diet', 'outdoors', 'illness'] as const
const STRENGTH_RE = /strength|lift|weights?|squat|bench|deadlift|press|row|pull-?up|gym/i

const round3 = (n: number) => Math.round(n * 1000) / 1000
/** Show a stored metric value in the user's unit, without float noise. */
const shown = (n: number) => String(Math.round(n * 100) / 100)

function numOrNull(v: string): number | null {
  if (v.trim() === '') return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

interface Props {
  activity: Activity
  categorySlug: CategorySlug
  existing?: ActivityLog
  /** Pre-fill the date for a new log (e.g. backfilling from the day view). */
  defaultDate?: string
  onClose: () => void
  onLogged?: (log: LogCreated) => void
}

export default function LogModal({ activity, categorySlug, existing, defaultDate, onClose, onLogged }: Props) {
  const { prefs } = usePreferences()
  const qtyMeasure = measureOf(activity.unit)
  const create = useCreateLog()
  const update = useUpdateLog()
  const extra = (existing?.extra_data ?? {}) as Record<string, unknown>

  const isMinutes = activity.unit === 'minutes'
  const isBoolean = activity.unit === 'boolean'
  const strengthLike = categorySlug === 'workout' && (STRENGTH_RE.test(activity.name) || activity.unit === 'reps')

  const [date, setDate] = useState(existing?.logged_date ?? defaultDate ?? localDate())
  const [duration, setDuration] = useState(existing?.duration_minutes != null ? String(existing.duration_minutes) : '')
  const [quantity, setQuantity] = useState(
    existing?.quantity != null ? shown(toDisplay(existing.quantity, qtyMeasure, prefs)) : '',
  )
  const [intensity, setIntensity] = useState<number | null>(existing?.intensity ?? null)
  const [quality, setQuality] = useState<number | null>(existing?.quality ?? null)
  const [difficulty, setDifficulty] = useState<number | null>(existing?.difficulty ?? null)
  const [mood, setMood] = useState<number | null>(existing?.mood_score ?? null)
  const [energy, setEnergy] = useState<number | null>((extra.energy as number) ?? null)
  const [stress, setStress] = useState<number | null>((extra.stress as number) ?? null)
  const [factors, setFactors] = useState<string[]>((extra.factors as string[]) ?? [])
  const [notes, setNotes] = useState(existing?.notes ?? '')
  const [useSets, setUseSets] = useState(strengthLike || Array.isArray(extra.sets))
  const [sets, setSets] = useState<{ reps: string; weight: string }[]>(
    Array.isArray(extra.sets) && (extra.sets as StrengthSet[]).length
      ? (extra.sets as StrengthSet[]).map((s) => ({ reps: String(s.reps), weight: s.weight ? shown(toDisplay(s.weight, 'weight', prefs)) : '' }))
      : [{ reps: '', weight: '' }],
  )

  const mutation = existing ? update : create
  // A mood check-in without a mood score is meaningless, so ask for it explicitly.
  const needsMood = categorySlug === 'mood' && isBoolean && mood == null
  const unitLabel = unitLabelFor(activity.unit, prefs) || activity.unit
  const goal = activity.daily_target != null ? `goal ${fmt(toDisplay(activity.daily_target, qtyMeasure, prefs))}` : undefined

  function buildPayload(): LogInput {
    const extra_data: Record<string, unknown> = {}
    if (useSets) {
      const clean = sets
        .map((s) => ({ reps: numOrNull(s.reps), weight: round3(fromDisplay(numOrNull(s.weight) ?? 0, 'weight', prefs)) }))
        .filter((s): s is StrengthSet => s.reps !== null && s.reps > 0)
      if (clean.length) extra_data.sets = clean
    }
    if (categorySlug === 'mood') {
      if (energy) extra_data.energy = energy
      if (stress) extra_data.stress = stress
      if (factors.length) extra_data.factors = factors
    }
    const typed = isMinutes || isBoolean ? null : numOrNull(quantity)
    const qty = typed == null ? null : round3(fromDisplay(typed, qtyMeasure, prefs))
    return {
      activity_id: activity.id,
      logged_date: date,
      duration_minutes: numOrNull(duration),
      quantity: isBoolean ? 1 : qty,
      intensity,
      quality,
      difficulty,
      mood_score: mood,
      notes: notes.trim() || null,
      extra_data: Object.keys(extra_data).length ? extra_data : null,
    }
  }

  async function submit(e: FormEvent) {
    e.preventDefault()
    const payload = buildPayload()
    if (existing) {
      await update.mutateAsync({ id: existing.id, ...payload })
    } else {
      const created = await create.mutateAsync(payload)
      onLogged?.(created)
    }
    onClose()
  }

  const volume = useSets
    ? sets.reduce((acc, s) => acc + (numOrNull(s.reps) ?? 0) * (numOrNull(s.weight) ?? 0), 0)
    : 0

  return (
    <Modal open onClose={onClose} title={<span>{activity.icon} {existing ? 'Edit' : 'Log'} {activity.name}</span>}>
      <form onSubmit={submit} className="space-y-4">
        <Field label="Date">
          <input type="date" className={inputCls} value={date} max={localDate()} onChange={(e) => setDate(e.target.value)} required />
        </Field>

        {categorySlug === 'workout' && (
          <label className="flex items-center gap-2 text-sm text-slate-300">
            <input type="checkbox" checked={useSets} onChange={(e) => setUseSets(e.target.checked)} className="accent-emerald-500" />
            Track sets (reps × weight)
          </label>
        )}

        {useSets && (
          <div className="space-y-2">
            <div className="grid grid-cols-[2rem_1fr_1fr_2rem] gap-2 text-xs text-slate-500 px-1">
              <span>Set</span><span>Reps</span><span>Weight ({prefs.weightUnit})</span><span />
            </div>
            {sets.map((s, i) => (
              <div key={i} className="grid grid-cols-[2rem_1fr_1fr_2rem] gap-2 items-center">
                <span className="text-sm text-slate-400 text-center">{i + 1}</span>
                <input inputMode="numeric" aria-label={`Set ${i + 1} reps`} className={inputCls} value={s.reps}
                  onChange={(e) => setSets(sets.map((x, j) => (j === i ? { ...x, reps: e.target.value } : x)))} />
                <input inputMode="decimal" aria-label={`Set ${i + 1} weight`} className={inputCls} value={s.weight}
                  onChange={(e) => setSets(sets.map((x, j) => (j === i ? { ...x, weight: e.target.value } : x)))} />
                <button type="button" aria-label={`Remove set ${i + 1}`} disabled={sets.length === 1}
                  className="text-slate-500 hover:text-rose-400 disabled:opacity-30"
                  onClick={() => setSets(sets.filter((_, j) => j !== i))}>✕</button>
              </div>
            ))}
            <div className="flex items-center justify-between">
              <button type="button" className="text-sm text-emerald-400 hover:text-emerald-300"
                onClick={() => setSets([...sets, { ...sets[sets.length - 1] }])}>+ Add set</button>
              {volume > 0 && <span className="text-xs text-slate-400">Volume: {fmt(volume)} {prefs.weightUnit}</span>}
            </div>
          </div>
        )}

        {!isBoolean && (
          <div className="grid grid-cols-2 gap-3">
            {!isMinutes && (
              <Field label={activity.unit === 'count' ? 'Amount' : `Amount (${unitLabel})`}
                hint={goal}>
                <input inputMode="decimal" className={inputCls} value={quantity} onChange={(e) => setQuantity(e.target.value)} />
              </Field>
            )}
            <Field label="Duration (min)" hint={isMinutes ? goal : undefined}>
              <input inputMode="decimal" className={inputCls} value={duration} onChange={(e) => setDuration(e.target.value)} />
            </Field>
          </div>
        )}

        {categorySlug === 'workout' && <Scale label="Intensity / effort" max={10} value={intensity} onChange={setIntensity} />}
        {categorySlug === 'skill' && <Scale label="Difficulty" max={10} value={difficulty} onChange={setDifficulty} />}
        {(categorySlug === 'habit' || categorySlug === 'custom' || categorySlug === 'skill') && (
          <Scale label="Quality" max={5} value={quality} onChange={setQuality} />
        )}

        {categorySlug === 'mood' && (
          <>
            <div>
              <Scale label="How are you feeling? (1 = awful, 10 = great)" max={10} value={mood} onChange={setMood} required={categorySlug === 'mood' && isBoolean} />
              {needsMood && <p className="text-xs text-amber-300 mt-1">Pick a mood score to log this check-in.</p>}
            </div>
            <Scale label="Energy" max={10} value={energy} onChange={setEnergy} />
            <Scale label="Stress" max={10} value={stress} onChange={setStress} />
            <div>
              <span className="block text-sm text-slate-300 mb-1">Contributing factors</span>
              <div className="flex flex-wrap gap-2">
                {MOOD_FACTORS.map((f) => {
                  const on = factors.includes(f)
                  return (
                    <button type="button" key={f} aria-pressed={on}
                      onClick={() => setFactors(on ? factors.filter((x) => x !== f) : [...factors, f])}
                      className={`px-3 py-1 rounded-full text-sm capitalize border transition ${
                        on ? 'bg-emerald-500/20 border-emerald-500 text-emerald-300' : 'border-slate-600 text-slate-400 hover:border-slate-400'
                      }`}>
                      {f}
                    </button>
                  )
                })}
              </div>
            </div>
          </>
        )}

        <Field label={categorySlug === 'mood' ? 'Journal: what are you grateful for today?' : categorySlug === 'skill' ? 'What did you practice?' : 'Notes'}>
          <textarea rows={2} className={inputCls} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </Field>

        <ErrorNote error={mutation.error} />
        <div className="flex gap-3 justify-end pt-1">
          <button type="button" className={btnGhost} onClick={onClose}>Cancel</button>
          <button type="submit" className={btnPrimary} disabled={mutation.isPending || needsMood}>
            {mutation.isPending ? 'Saving…' : existing ? 'Save changes' : 'Log it'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
