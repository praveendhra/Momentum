import { useState } from 'react'
import { useActivities, useCategories, useDeleteLog, useLogs, type LogFilters } from '../hooks/queries'
import { Card, ErrorNote, Spinner, inputCls } from '../components/ui'
import LogModal from '../components/LogModal'
import { prettyDate, summarizeLog } from '../lib/format'
import type { ActivityLog } from '../types'

const PAGE = 50

export default function HistoryPage() {
  const { data: activities } = useActivities()
  const { data: categories } = useCategories()
  const [filters, setFilters] = useState<LogFilters>({})
  const [limit, setLimit] = useState(PAGE)
  const [categoryId, setCategoryId] = useState('')
  const categoryActivityIds = categoryId ? (activities ?? []).filter((a) => a.category_id === categoryId).map((a) => a.id) : undefined
  const { data: logs, isLoading, error, isFetching } = useLogs({ ...filters, activity_ids: categoryActivityIds, limit })
  const del = useDeleteLog()
  const [editing, setEditing] = useState<ActivityLog | null>(null)

  const actById = new Map((activities ?? []).map((a) => [a.id, a]))
  const catById = new Map((categories ?? []).map((c) => [c.id, c]))

  const grouped = new Map<string, ActivityLog[]>()
  for (const log of logs ?? []) {
    const list = grouped.get(log.logged_date) ?? []
    list.push(log)
    grouped.set(log.logged_date, list)
  }

  const set = (patch: Partial<LogFilters>) => {
    setFilters((f) => ({ ...f, ...patch }))
    setLimit(PAGE)
  }
  const editingActivity = editing ? actById.get(editing.activity_id) : undefined

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">History</h1>

      <Card>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <select aria-label="Category" className={inputCls} value={categoryId}
            onChange={(e) => { setCategoryId(e.target.value); set({ activity_id: undefined }) }}>
            <option value="">All categories</option>
            {categories?.map((c) => <option key={c.id} value={c.id}>{c.icon} {c.name}</option>)}
          </select>
          <select aria-label="Activity" className={inputCls} value={filters.activity_id ?? ''}
            onChange={(e) => set({ activity_id: e.target.value || undefined })}>
            <option value="">All activities</option>
            {activities
              ?.filter((a) => !categoryId || a.category_id === categoryId)
              .map((a) => <option key={a.id} value={a.id}>{a.icon} {a.name}</option>)}
          </select>
          <input aria-label="From date" type="date" className={inputCls} value={filters.date_from ?? ''}
            onChange={(e) => set({ date_from: e.target.value || undefined })} />
          <input aria-label="To date" type="date" className={inputCls} value={filters.date_to ?? ''}
            onChange={(e) => set({ date_to: e.target.value || undefined })} />
        </div>
      </Card>

      {isLoading && <Spinner />}
      <ErrorNote error={error ?? del.error} />
      {logs && !logs.length && <p className="text-slate-400">No logs match these filters yet.</p>}

      <div className="space-y-5">
        {[...grouped.entries()].map(([day, items]) => (
          <section key={day}>
            <h2 className="text-sm font-medium text-slate-400 mb-2">{prettyDate(day)}</h2>
            <ul className="bg-slate-800/70 border border-slate-700/50 rounded-2xl divide-y divide-slate-700/60">
              {items.map((log) => {
                const a = actById.get(log.activity_id)
                return (
                  <li key={log.id} className="flex items-center gap-3 px-4 py-3">
                    <span className="text-xl" aria-hidden>{a?.icon ?? '•'}</span>
                    <div className="min-w-0 flex-1">
                      <p className="font-medium">{a?.name ?? 'Deleted activity'}</p>
                      <p className="text-sm text-slate-400 truncate">
                        {a ? summarizeLog(log, a.unit) : ''}
                        {log.notes && <span className="text-slate-500"> · “{log.notes}”</span>}
                      </p>
                    </div>
                    <button className="text-sm px-2 py-1 rounded-md text-slate-300 hover:bg-slate-700" onClick={() => setEditing(log)} disabled={!a}>
                      Edit
                    </button>
                    <button className="text-sm px-2 py-1 rounded-md text-rose-400 hover:bg-rose-500/10"
                      onClick={() => { if (confirm('Delete this log?')) del.mutate(log.id) }}>
                      Delete
                    </button>
                  </li>
                )
              })}
            </ul>
          </section>
        ))}
      </div>

      {logs && logs.length >= limit && (
        <button className="w-full py-3 text-sm text-slate-300 hover:text-white" onClick={() => setLimit((l) => Math.min(l + PAGE, 200))}
          disabled={isFetching || limit >= 200}>
          {limit >= 200 ? 'Showing the latest 200 — narrow the dates to see older logs' : isFetching ? 'Loading…' : 'Load more'}
        </button>
      )}

      {editing && editingActivity && (
        <LogModal
          activity={editingActivity}
          categorySlug={catById.get(editingActivity.category_id)?.slug ?? 'custom'}
          existing={editing}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  )
}
