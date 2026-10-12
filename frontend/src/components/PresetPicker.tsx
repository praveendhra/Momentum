import { useState } from 'react'
import { useActivities, useCategories, useCreateActivity, usePresets } from '../hooks/queries'
import { btnPrimary, ErrorNote, Spinner } from './ui'
import type { PresetActivity } from '../types'

/** Grid of preset activities; adds the selected ones to the user's list. */
export default function PresetPicker({ onAdded, cta = 'Add selected' }: { onAdded?: () => void; cta?: string }) {
  const { data: presets, isLoading, error } = usePresets()
  const { data: categories } = useCategories()
  const { data: mine } = useActivities()
  const create = useCreateActivity()
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [busy, setBusy] = useState(false)

  if (isLoading) return <Spinner />
  if (error) return <ErrorNote error={error} />

  const owned = new Set((mine ?? []).map((a) => a.name.toLowerCase()))
  const available = (presets ?? []).filter((p) => !owned.has(p.name.toLowerCase()))
  const groups = (categories ?? [])
    .filter((c) => c.is_system)
    .map((c) => ({ category: c, items: available.filter((p) => p.category_id === c.id) }))
    .filter((g) => g.items.length)

  const toggle = (p: PresetActivity) => {
    const next = new Set(selected)
    if (next.has(p.name)) next.delete(p.name)
    else next.add(p.name)
    setSelected(next)
  }

  async function addSelected() {
    setBusy(true)
    try {
      for (const p of available.filter((x) => selected.has(x.name))) {
        await create.mutateAsync({
          category_id: p.category_id, name: p.name, icon: p.icon, color: p.color, unit: p.unit, daily_target: p.daily_target,
        })
      }
      setSelected(new Set())
      onAdded?.()
    } finally {
      setBusy(false)
    }
  }

  if (!groups.length) return <p className="text-sm text-slate-400">You've added every preset. Create a custom activity instead.</p>

  return (
    <div className="space-y-5">
      {groups.map(({ category, items }) => (
        <div key={category.id}>
          <h4 className="text-xs uppercase tracking-wider text-slate-500 mb-2">{category.icon} {category.name}</h4>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
            {items.map((p) => {
              const on = selected.has(p.name)
              return (
                <button key={p.name} type="button" aria-pressed={on} onClick={() => toggle(p)}
                  className={`flex items-center gap-2 rounded-xl border px-3 py-2.5 text-left text-sm transition ${
                    on ? 'border-emerald-500 bg-emerald-500/10 text-white' : 'border-slate-700 bg-slate-900/50 text-slate-300 hover:border-slate-500'
                  }`}>
                  <span className="text-lg" aria-hidden>{p.icon}</span>
                  <span className="truncate">{p.name}</span>
                  {on && <span className="ml-auto text-emerald-400" aria-hidden>✓</span>}
                </button>
              )
            })}
          </div>
        </div>
      ))}
      <ErrorNote error={create.error} />
      <button className={btnPrimary} disabled={!selected.size || busy} onClick={addSelected}>
        {busy ? 'Adding…' : selected.size ? `${cta} (${selected.size})` : cta}
      </button>
    </div>
  )
}
