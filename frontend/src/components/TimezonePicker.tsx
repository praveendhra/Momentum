import { useMemo, useState } from 'react'
import { Modal, inputCls } from './ui'
import { browserTimezone } from '../lib/preferences'
import { ALIASES, ALL_ZONES, POPULAR, describe, type ZoneInfo } from '../lib/timezones'

function Row({ z, value, device, pick }: { z: ZoneInfo; value: string; device: string; pick: (id: string) => void }) {
  return (
    <li>
      <button
        type="button"
        onClick={() => pick(z.id)}
        className={`w-full flex items-center justify-between gap-3 rounded-lg px-3 py-2 text-left hover:bg-slate-700 ${
          z.id === value ? 'bg-emerald-500/10 ring-1 ring-emerald-500/40' : ''
        }`}
      >
        <span className="min-w-0">
          <span className="block truncate">
            {z.city}
            {z.id === device && <span className="ml-2 text-xs text-emerald-400">this device</span>}
          </span>
          <span className="block text-xs text-slate-500 truncate">{z.region || 'Coordinated Universal Time'}</span>
        </span>
        <span className="text-right shrink-0">
          <span className="block text-sm">{z.time}</span>
          <span className="block text-xs text-slate-500">{z.offset}</span>
        </span>
      </button>
    </li>
  )
}

export default function TimezonePicker({ value, onChange }: { value: string; onChange: (tz: string) => void }) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const device = browserTimezone()

  const zones = useMemo(() => {
    if (!open) return { suggested: [], rest: [] }
    const now = new Date()
    const ids = ALL_ZONES.includes(value) ? ALL_ZONES : [value, ...ALL_ZONES]
    const all = ids.map((id) => describe(id, now))
    const q = query.trim().toLowerCase().replace(/\s+/g, ' ')
    const aliased = new Set(Object.entries(ALIASES).filter(([k]) => q && k.includes(q)).map(([, id]) => id))
    const match = (z: ZoneInfo) =>
      !q ||
      aliased.has(z.id) ||
      z.id.toLowerCase().replace(/_/g, ' ').includes(q) ||
      z.offset.toLowerCase().replace('−', '-').includes(q.replace('−', '-'))
    const filtered = all.filter(match)
    const suggestedIds = new Set([value, device, ...POPULAR])
    const suggested = q ? [] : filtered.filter((z) => suggestedIds.has(z.id))
    const rest = filtered
      .filter((z) => q || !suggestedIds.has(z.id))
      .sort((a, b) => a.offsetMinutes - b.offsetMinutes || a.city.localeCompare(b.city))
    return { suggested, rest }
  }, [open, query, value, device])

  const current = describe(value, new Date())
  const pick = (id: string) => {
    onChange(id)
    setOpen(false)
    setQuery('')
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-900 px-3 py-1.5 text-sm hover:border-slate-500"
        aria-haspopup="dialog"
      >
        <span>{current.city}</span>
        <span className="text-slate-500">{current.offset}</span>
        <span className="text-slate-500" aria-hidden>▾</span>
      </button>

      <Modal open={open} onClose={() => setOpen(false)} title="Time zone">
        <input
          autoFocus
          className={inputCls}
          placeholder="Search a city, region or offset (e.g. Boston, India, -5)"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label="Search time zones"
        />
        <div className="mt-3 max-h-[55vh] overflow-y-auto -mx-1 px-1">
          {zones.suggested.length > 0 && (
            <>
              <p className="text-xs uppercase tracking-wider text-slate-500 px-3 mt-1 mb-1">Suggested</p>
              <ul className="space-y-0.5">{zones.suggested.map((z) => <Row key={z.id} z={z} value={value} device={device} pick={pick} />)}</ul>
              <p className="text-xs uppercase tracking-wider text-slate-500 px-3 mt-4 mb-1">All time zones</p>
            </>
          )}
          <ul className="space-y-0.5">{zones.rest.map((z) => <Row key={z.id} z={z} value={value} device={device} pick={pick} />)}</ul>
          {!zones.suggested.length && !zones.rest.length && (
            <p className="text-sm text-slate-400 px-3 py-6 text-center">No time zones match “{query}”.</p>
          )}
        </div>
      </Modal>
    </>
  )
}
