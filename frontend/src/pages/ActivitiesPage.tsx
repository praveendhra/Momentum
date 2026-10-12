import { useState } from 'react'
import { useActivityInsights, useCategories, useDeleteActivity, useUpdateActivity } from '../hooks/queries'
import { Card, ErrorNote, Modal, Spinner, btnGhost, btnPrimary } from '../components/ui'
import ActivityForm from '../components/ActivityForm'
import ActivityCard from '../components/ActivityCard'
import LogModal from '../components/LogModal'
import PresetPicker from '../components/PresetPicker'
import SampleDataCard from '../components/SampleDataCard'
import { fmt } from '../lib/units'
import type { Activity, CategorySlug } from '../types'

function Hero({ sessions, hours, liveStreaks, activeToday, total }: { sessions: number; hours: number; liveStreaks: number; activeToday: number; total: number }) {
  const items = [
    { value: String(sessions), label: 'sessions logged' },
    { value: `${fmt(hours)} h`, label: 'invested in yourself' },
    { value: String(liveStreaks), label: liveStreaks === 1 ? 'streak alive' : 'streaks alive' },
    { value: `${activeToday}/${total}`, label: 'done today' },
  ]
  return (
    <section className="rounded-2xl border border-emerald-500/20 bg-gradient-to-br from-emerald-500/15 via-slate-800/60 to-slate-800/60 p-5 sm:p-6">
      <p className="text-emerald-300 text-sm font-medium">Your progress</p>
      <p className="text-xl sm:text-2xl font-semibold mt-1">
        {sessions === 0
          ? 'Every journey starts with one session. Pick an activity and log it today.'
          : activeToday === total && total > 0
            ? 'Clean sweep today. Every activity done. 🙌'
            : `${sessions} sessions and counting. Keep stacking small wins.`}
      </p>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-5">
        {items.map((it) => (
          <div key={it.label}>
            <p className="text-2xl font-bold">{it.value}</p>
            <p className="text-xs text-slate-400">{it.label}</p>
          </div>
        ))}
      </div>
    </section>
  )
}

export default function ActivitiesPage() {
  const { data: insights, isLoading, error } = useActivityInsights()
  const { data: categories } = useCategories()
  const update = useUpdateActivity()
  const del = useDeleteActivity()
  const [editing, setEditing] = useState<Activity | null>(null)
  const [creating, setCreating] = useState(false)
  const [logging, setLogging] = useState<Activity | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<Activity | null>(null)
  const [showArchived, setShowArchived] = useState(false)

  const catById = new Map((categories ?? []).map((c) => [c.id, c]))
  const active = (insights ?? []).filter((i) => i.activity.is_active)
  const archived = (insights ?? []).filter((i) => !i.activity.is_active)

  const sessions = active.reduce((a, i) => a + i.sessions, 0)
  const hours = active.reduce((a, i) => a + i.totalMinutes, 0) / 60
  const liveStreaks = active.filter((i) => i.currentStreak >= 2).length
  const activeToday = active.filter((i) => i.loggedToday).length

  const card = (i: (typeof active)[number]) => (
    <ActivityCard
      key={i.activity.id}
      insight={i}
      category={catById.get(i.activity.category_id)}
      onLog={() => setLogging(i.activity)}
      onEdit={() => setEditing(i.activity)}
      onArchive={() => update.mutate({ id: i.activity.id, is_active: !i.activity.is_active })}
      onDelete={() => setConfirmDelete(i.activity)}
    />
  )

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">Activities</h1>
        <button className={btnPrimary} onClick={() => setCreating(true)}>+ New activity</button>
      </div>

      {isLoading && <Spinner />}
      <ErrorNote error={error ?? update.error ?? del.error} />

      {insights && (
        <>
          <Hero sessions={sessions} hours={hours} liveStreaks={liveStreaks} activeToday={activeToday} total={active.length} />
          <div className="grid md:grid-cols-2 gap-4">{active.map(card)}</div>

          {archived.length > 0 && (
            <section>
              <button className="text-sm text-slate-400 hover:text-white" onClick={() => setShowArchived((s) => !s)} aria-expanded={showArchived}>
                {showArchived ? '▾' : '▸'} Archived ({archived.length})
              </button>
              {showArchived && <div className="grid md:grid-cols-2 gap-4 mt-3">{archived.map(card)}</div>}
            </section>
          )}
        </>
      )}

      <Card title="Add more activities">
        <PresetPicker />
      </Card>

      <SampleDataCard />

      {logging && (
        <LogModal
          activity={logging}
          categorySlug={(catById.get(logging.category_id)?.slug ?? 'custom') as CategorySlug}
          onClose={() => setLogging(null)}
        />
      )}
      <Modal open={creating} onClose={() => setCreating(false)} title="New activity">
        <ActivityForm onDone={() => setCreating(false)} />
      </Modal>
      <Modal open={!!editing} onClose={() => setEditing(null)} title={`Edit ${editing?.name ?? ''}`}>
        {editing && <ActivityForm existing={editing} onDone={() => setEditing(null)} />}
      </Modal>
      <Modal open={!!confirmDelete} onClose={() => setConfirmDelete(null)} title={`Delete ${confirmDelete?.name ?? ''}?`}>
        <p className="text-slate-300 mb-5">
          This permanently removes the activity and <strong>all of its logged history</strong>. Archive it instead if you just want it out of the way.
        </p>
        <div className="flex justify-end gap-3">
          <button className={btnGhost} onClick={() => setConfirmDelete(null)}>Cancel</button>
          <button
            className="rounded-lg bg-rose-500 px-4 py-2 font-medium text-white hover:bg-rose-400 disabled:opacity-50"
            disabled={del.isPending}
            onClick={async () => {
              if (confirmDelete) await del.mutateAsync(confirmDelete.id)
              setConfirmDelete(null)
            }}
          >
            Delete forever
          </button>
        </div>
      </Modal>
    </div>
  )
}
