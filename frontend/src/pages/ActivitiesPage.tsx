import { useState } from 'react'
import { useActivities, useCategories, useDeleteActivity, useUpdateActivity } from '../hooks/queries'
import { Card, ErrorNote, Modal, Spinner, btnGhost, btnPrimary } from '../components/ui'
import ActivityForm from '../components/ActivityForm'
import PresetPicker from '../components/PresetPicker'
import SampleDataCard from '../components/SampleDataCard'
import { fmtNum, UNIT_LABELS } from '../lib/format'
import type { Activity } from '../types'

export default function ActivitiesPage() {
  const { data: activities, isLoading, error } = useActivities()
  const { data: categories } = useCategories()
  const update = useUpdateActivity()
  const del = useDeleteActivity()
  const [editing, setEditing] = useState<Activity | null>(null)
  const [creating, setCreating] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState<Activity | null>(null)

  const catById = new Map((categories ?? []).map((c) => [c.id, c]))

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Activities</h1>
        <button className={btnPrimary} onClick={() => setCreating(true)}>+ Custom activity</button>
      </div>

      <Card title="Your activities">
        {isLoading && <Spinner />}
        <ErrorNote error={error ?? update.error ?? del.error} />
        <ul className="divide-y divide-slate-700/60">
          {activities?.map((a) => {
            const cat = catById.get(a.category_id)
            return (
              <li key={a.id} className={`flex items-center gap-3 py-3 ${a.is_active ? '' : 'opacity-50'}`}>
                <span className="h-10 w-10 shrink-0 rounded-xl flex items-center justify-center text-xl" style={{ backgroundColor: `${a.color}26` }} aria-hidden>
                  {a.icon}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="font-medium truncate">{a.name}</p>
                  <p className="text-xs text-slate-400">
                    {cat?.name ?? 'Custom'} · {a.unit === 'boolean' ? 'done / not done' : a.unit}
                    {a.daily_target != null && ` · goal ${fmtNum(a.daily_target)} ${UNIT_LABELS[a.unit]}`}
                    {!a.is_active && ' · archived'}
                  </p>
                </div>
                <div className="flex gap-1 text-sm">
                  <button className="px-2 py-1 rounded-md text-slate-300 hover:bg-slate-700" onClick={() => setEditing(a)}>Edit</button>
                  <button className="px-2 py-1 rounded-md text-slate-300 hover:bg-slate-700"
                    onClick={() => update.mutate({ id: a.id, is_active: !a.is_active })}>
                    {a.is_active ? 'Archive' : 'Restore'}
                  </button>
                  <button className="px-2 py-1 rounded-md text-rose-400 hover:bg-rose-500/10" onClick={() => setConfirmDelete(a)}>Delete</button>
                </div>
              </li>
            )
          })}
        </ul>
      </Card>

      <Card title="Add from presets">
        <PresetPicker />
      </Card>

      <SampleDataCard />

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
