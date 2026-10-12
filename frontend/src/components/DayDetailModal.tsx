import { useState } from 'react'
import { Modal, Spinner, ErrorNote, btnGhost } from './ui'
import LogModal from './LogModal'
import { useActivities, useCategories, useDeleteLog, useLogs, usePersonalRecords } from '../hooks/queries'
import { usePreferences } from '../hooks/usePreferences'
import { addDays, fmtNum, fmtRecord, localDate, prettyDate, RECORD_LABELS, summarizeLog } from '../lib/format'
import type { Activity, ActivityLog, CategorySlug } from '../types'

function longDate(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-slate-900 border border-slate-700/60 px-3 py-2 text-center min-w-0">
      <p className="text-lg font-semibold truncate">{value}</p>
      <p className="text-xs text-slate-400">{label}</p>
    </div>
  )
}

export default function DayDetailModal({ date, onClose, onChangeDate }: { date: string; onClose: () => void; onChangeDate: (d: string) => void }) {
  const { prefs } = usePreferences()
  const { data: activities } = useActivities()
  const { data: categories } = useCategories()
  const { data: logs, isLoading, error } = useLogs({ date_from: date, date_to: date, limit: 200 })
  const { data: prs } = usePersonalRecords()
  const del = useDeleteLog()
  const [editing, setEditing] = useState<ActivityLog | null>(null)
  const [adding, setAdding] = useState<Activity | null>(null)
  const [picking, setPicking] = useState(false)

  const today = localDate()
  const actById = new Map((activities ?? []).map((a) => [a.id, a]))
  const slugOf = (a: Activity) => (categories?.find((c) => c.id === a.category_id)?.slug ?? 'custom') as CategorySlug
  const dayPRs = (prs ?? []).filter((p) => p.logged_date === date)

  const list = logs ?? []
  const minutes = list.reduce((acc, l) => acc + (l.duration_minutes ?? 0), 0)
  const moods = list.map((l) => l.mood_score).filter((m): m is number => m != null)
  const avgMood = moods.length ? fmtNum(moods.reduce((a, b) => a + b, 0) / moods.length) : '—'

  // Group by category, in the category order the app uses everywhere else.
  const groups = (categories ?? [])
    .map((c) => ({ category: c, items: list.filter((l) => actById.get(l.activity_id)?.category_id === c.id) }))
    .filter((g) => g.items.length)

  const nav = (
    <div className="flex items-center gap-1">
      <button className="h-8 w-8 rounded-full text-slate-400 hover:bg-slate-700 hover:text-white" aria-label="Previous day"
        onClick={() => onChangeDate(addDays(date, -1))}>‹</button>
      <button className="h-8 w-8 rounded-full text-slate-400 hover:bg-slate-700 hover:text-white disabled:opacity-30" aria-label="Next day"
        disabled={date >= today} onClick={() => onChangeDate(addDays(date, 1))}>›</button>
    </div>
  )

  return (
    <>
      <Modal open={!editing && !adding} onClose={onClose} title={
        <span className="flex items-center gap-3">
          <span>{prettyDate(date)}</span>
          {nav}
        </span>
      }>
        <p className="text-sm text-slate-400 -mt-3 mb-4">{longDate(date)}</p>

        {isLoading && <Spinner />}
        <ErrorNote error={error ?? del.error} />

        {!isLoading && (
          <>
            <div className="grid grid-cols-3 gap-2 mb-5">
              <Stat label={list.length === 1 ? 'session' : 'sessions'} value={String(list.length)} />
              <Stat label="active minutes" value={minutes ? fmtNum(minutes) : '—'} />
              <Stat label="mood" value={avgMood === '—' ? '—' : `${avgMood}/10`} />
            </div>

            {dayPRs.length > 0 && (
              <div className="mb-5 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3">
                <p className="text-sm font-medium text-amber-300 mb-1">🏆 Personal records set this day</p>
                <ul className="text-sm space-y-0.5">
                  {dayPRs.map((p) => (
                    <li key={p.id}>{p.activity_name}: {RECORD_LABELS[p.record_type].label.toLowerCase()} {fmtRecord(p, prefs)}</li>
                  ))}
                </ul>
              </div>
            )}

            {!list.length && (
              <p className="text-sm text-slate-400 py-6 text-center">
                {date > today ? "This day hasn't happened yet." : 'Nothing logged this day.'}
              </p>
            )}

            <div className="space-y-4">
              {groups.map(({ category, items }) => (
                <section key={category.id}>
                  <h3 className="text-xs uppercase tracking-wider text-slate-500 mb-1.5">{category.icon} {category.name}</h3>
                  <ul className="rounded-xl border border-slate-700/60 divide-y divide-slate-700/60">
                    {items.map((log) => {
                      const a = actById.get(log.activity_id)!
                      return (
                        <li key={log.id} className="flex items-start gap-3 px-3 py-2.5">
                          <span className="text-lg leading-6" aria-hidden>{a.icon}</span>
                          <div className="min-w-0 flex-1">
                            <p className="font-medium">{a.name}</p>
                            <p className="text-sm text-slate-400">{summarizeLog(log, a.unit, prefs)}</p>
                            {log.notes && <p className="text-sm text-slate-300 mt-1 italic">“{log.notes}”</p>}
                            {Array.isArray(log.extra_data?.factors) && (log.extra_data.factors as string[]).length > 0 && (
                              <p className="text-xs text-slate-500 mt-1">Factors: {(log.extra_data.factors as string[]).join(', ')}</p>
                            )}
                          </div>
                          <div className="flex gap-1 shrink-0">
                            <button className="text-xs px-2 py-1 rounded-md text-slate-300 hover:bg-slate-700" onClick={() => setEditing(log)}>Edit</button>
                            <button className="text-xs px-2 py-1 rounded-md text-rose-400 hover:bg-rose-500/10"
                              onClick={() => { if (confirm(`Delete this ${a.name} log?`)) del.mutate(log.id) }}>Delete</button>
                          </div>
                        </li>
                      )
                    })}
                  </ul>
                </section>
              ))}
            </div>

            {date <= today && (
              <div className="mt-5">
                {picking ? (
                  <div>
                    <p className="text-sm text-slate-300 mb-2">What did you do on {prettyDate(date).toLowerCase() === 'today' ? 'today' : prettyDate(date)}?</p>
                    <div className="grid grid-cols-2 gap-2">
                      {activities?.filter((a) => a.is_active).map((a) => (
                        <button key={a.id} onClick={() => { setAdding(a); setPicking(false) }}
                          className="flex items-center gap-2 rounded-lg border border-slate-700 px-3 py-2 text-sm text-left hover:border-slate-500">
                          <span aria-hidden>{a.icon}</span><span className="truncate">{a.name}</span>
                        </button>
                      ))}
                    </div>
                    <button className="mt-2 text-sm text-slate-400 hover:text-white" onClick={() => setPicking(false)}>Cancel</button>
                  </div>
                ) : (
                  <button className={`${btnGhost} w-full`} onClick={() => setPicking(true)}>+ Log something for this day</button>
                )}
              </div>
            )}
          </>
        )}
      </Modal>

      {editing && actById.get(editing.activity_id) && (
        <LogModal
          activity={actById.get(editing.activity_id)!}
          categorySlug={slugOf(actById.get(editing.activity_id)!)}
          existing={editing}
          onClose={() => setEditing(null)}
        />
      )}
      {adding && (
        <LogModal activity={adding} categorySlug={slugOf(adding)} defaultDate={date} onClose={() => setAdding(null)} />
      )}
    </>
  )
}
