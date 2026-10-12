import { useState, type FormEvent } from 'react'
import { useCategories, useCreateActivity, useUpdateActivity } from '../hooks/queries'
import { btnGhost, btnPrimary, ErrorNote, Field, inputCls } from './ui'
import type { Activity, ActivityUnit } from '../types'

const UNITS: { value: ActivityUnit; label: string }[] = [
  { value: 'minutes', label: 'Minutes' },
  { value: 'boolean', label: 'Done / not done' },
  { value: 'count', label: 'Count' },
  { value: 'reps', label: 'Reps' },
  { value: 'km', label: 'Kilometres' },
  { value: 'pages', label: 'Pages' },
  { value: 'liters', label: 'Litres' },
]

const COLORS = ['#10b981', '#3b82f6', '#a855f7', '#f59e0b', '#ef4444', '#ec4899', '#06b6d4', '#84cc16']

export default function ActivityForm({ existing, onDone }: { existing?: Activity; onDone: () => void }) {
  const { data: categories } = useCategories()
  const create = useCreateActivity()
  const update = useUpdateActivity()
  const mutation = existing ? update : create

  const [name, setName] = useState(existing?.name ?? '')
  const [icon, setIcon] = useState(existing?.icon ?? '⚡')
  const [color, setColor] = useState(existing?.color ?? COLORS[0])
  const [unit, setUnit] = useState<ActivityUnit>(existing?.unit ?? 'minutes')
  const [target, setTarget] = useState(existing?.daily_target != null ? String(existing.daily_target) : '')
  const [categoryId, setCategoryId] = useState(existing?.category_id ?? '')

  const chosenCategory = categoryId || categories?.find((c) => c.slug === 'custom')?.id || categories?.[0]?.id || ''

  async function submit(e: FormEvent) {
    e.preventDefault()
    const daily_target = target.trim() === '' || unit === 'boolean' ? null : Number(target)
    if (existing) {
      await update.mutateAsync({ id: existing.id, name: name.trim(), icon, color, unit, daily_target })
    } else {
      await create.mutateAsync({ category_id: chosenCategory, name: name.trim(), icon, color, unit, daily_target })
    }
    onDone()
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="grid grid-cols-[4.5rem_1fr] gap-3">
        <Field label="Icon">
          <input className={`${inputCls} text-center text-xl`} value={icon} maxLength={8} onChange={(e) => setIcon(e.target.value)} />
        </Field>
        <Field label="Name">
          <input className={inputCls} required maxLength={100} value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Stretching" />
        </Field>
      </div>
      {!existing && (
        <Field label="Category">
          <select className={inputCls} value={chosenCategory} onChange={(e) => setCategoryId(e.target.value)}>
            {categories?.map((c) => (
              <option key={c.id} value={c.id}>{c.icon} {c.name}</option>
            ))}
          </select>
        </Field>
      )}
      <div className="grid grid-cols-2 gap-3">
        <Field label="Measured in">
          <select className={inputCls} value={unit} onChange={(e) => setUnit(e.target.value as ActivityUnit)}>
            {UNITS.map((u) => <option key={u.value} value={u.value}>{u.label}</option>)}
          </select>
        </Field>
        <Field label="Daily goal" hint="optional">
          <input inputMode="decimal" className={inputCls} disabled={unit === 'boolean'} value={unit === 'boolean' ? '' : target}
            onChange={(e) => setTarget(e.target.value)} />
        </Field>
      </div>
      <div>
        <span className="block text-sm text-slate-300 mb-1">Colour</span>
        <div className="flex gap-2">
          {COLORS.map((c) => (
            <button type="button" key={c} aria-label={`Colour ${c}`} aria-pressed={color === c} onClick={() => setColor(c)}
              className={`h-8 w-8 rounded-full transition ${color === c ? 'ring-2 ring-offset-2 ring-offset-slate-800 ring-white' : ''}`}
              style={{ backgroundColor: c }} />
          ))}
        </div>
      </div>
      <ErrorNote error={mutation.error} />
      <div className="flex gap-3 justify-end">
        <button type="button" className={btnGhost} onClick={onDone}>Cancel</button>
        <button type="submit" className={btnPrimary} disabled={mutation.isPending || !name.trim()}>
          {existing ? 'Save' : 'Add activity'}
        </button>
      </div>
    </form>
  )
}
