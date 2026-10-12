import { useState } from 'react'
import { usePreferences } from '../hooks/usePreferences'
import { fmtRecord, RECORD_LABELS } from '../lib/format'
import { headline, lastDoneLabel, lifetime, type ActivityInsight, type Tone } from '../lib/activityStats'
import { fmtAmount } from '../lib/units'
import type { ActivityCategory } from '../types'

const TONE: Record<Tone, string> = {
  fire: 'text-amber-300 bg-amber-500/10 border-amber-500/25',
  goal: 'text-emerald-300 bg-emerald-500/10 border-emerald-500/25',
  up: 'text-emerald-300 bg-emerald-500/10 border-emerald-500/25',
  nudge: 'text-sky-300 bg-sky-500/10 border-sky-500/25',
  start: 'text-slate-300 bg-slate-700/40 border-slate-600/50',
  calm: 'text-slate-300 bg-slate-700/40 border-slate-600/50',
}

function Sparkline({ weeks, color }: { weeks: number[]; color: string }) {
  const max = Math.max(1, ...weeks)
  return (
    <div className="flex items-end gap-1 h-10" role="img" aria-label={`Sessions per week, last 12 weeks: ${weeks.join(', ')}`}>
      {weeks.map((n, i) => (
        <div key={i} className="flex-1 rounded-sm bg-slate-700/60 relative overflow-hidden" style={{ height: '100%' }} title={`${n} session${n === 1 ? '' : 's'}`}>
          <div
            className="absolute bottom-0 inset-x-0 rounded-sm"
            style={{ height: `${n ? Math.max(12, (n / max) * 100) : 0}%`, backgroundColor: color, opacity: i === weeks.length - 1 ? 1 : 0.75 }}
          />
        </div>
      ))}
    </div>
  )
}

function Stat({ value, label, accent }: { value: string; label: string; accent?: boolean }) {
  return (
    <div className="min-w-0">
      <p className={`text-xl font-bold leading-tight ${accent ? 'text-amber-300' : ''}`}>{value}</p>
      <p className="text-xs text-slate-400 truncate">{label}</p>
    </div>
  )
}

interface Props {
  insight: ActivityInsight
  category?: ActivityCategory
  onLog: () => void
  onEdit: () => void
  onArchive: () => void
  onDelete: () => void
}

export default function ActivityCard({ insight: i, category, onLog, onEdit, onArchive, onDelete }: Props) {
  const { prefs } = usePreferences()
  const [menu, setMenu] = useState(false)
  const a = i.activity
  const h = headline(i)
  const life = lifetime(i, prefs)
  const toNext = i.nextMilestone ? i.nextMilestone - i.sessions : 0
  const pct = i.nextMilestone ? ((i.sessions - i.prevMilestone) / (i.nextMilestone - i.prevMilestone)) * 100 : 100

  return (
    <article className={`relative rounded-2xl border border-slate-700/50 bg-slate-800/70 p-5 flex flex-col gap-4 ${a.is_active ? '' : 'opacity-60'}`}>
      <span className="absolute inset-x-0 top-0 h-1 rounded-t-2xl" style={{ backgroundColor: a.color }} aria-hidden />

      <header className="flex items-start gap-3">
        <span className="h-11 w-11 shrink-0 rounded-xl flex items-center justify-center text-2xl" style={{ backgroundColor: `${a.color}26` }} aria-hidden>
          {a.icon}
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="font-semibold text-lg leading-tight truncate">{a.name}</h3>
          <p className="text-xs text-slate-400">
            {category?.name ?? 'Custom'} · {lastDoneLabel(i)}
            {a.daily_target != null && ` · goal ${fmtAmount(a.daily_target, a.unit, prefs)}`}
          </p>
        </div>
        <div className="relative">
          <button className="h-8 w-8 rounded-full text-slate-400 hover:bg-slate-700 hover:text-white" aria-label={`More actions for ${a.name}`}
            aria-expanded={menu} onClick={() => setMenu((m) => !m)}>⋯</button>
          {menu && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setMenu(false)} aria-hidden />
              <div className="absolute right-0 z-20 mt-1 w-36 rounded-xl border border-slate-700 bg-slate-800 py-1 shadow-xl text-sm" role="menu">
                <button role="menuitem" className="block w-full text-left px-3 py-2 hover:bg-slate-700" onClick={() => { setMenu(false); onEdit() }}>Edit</button>
                <button role="menuitem" className="block w-full text-left px-3 py-2 hover:bg-slate-700" onClick={() => { setMenu(false); onArchive() }}>
                  {a.is_active ? 'Archive' : 'Restore'}
                </button>
                <button role="menuitem" className="block w-full text-left px-3 py-2 text-rose-400 hover:bg-rose-500/10" onClick={() => { setMenu(false); onDelete() }}>Delete…</button>
              </div>
            </>
          )}
        </div>
      </header>

      <p className={`text-sm rounded-xl border px-3 py-2 ${TONE[h.tone]}`}>{h.text}</p>

      <div className="grid grid-cols-3 gap-3">
        <Stat value={String(i.sessions)} label="sessions" />
        {i.currentStreak >= 2 || i.weekStreak < 2 ? (
          <Stat value={`${i.currentStreak}d`} label={`day streak · best ${i.longestStreak}d`} accent={i.currentStreak >= 3} />
        ) : (
          <Stat value={`${i.weekStreak} wk`} label="weeks in a row" accent={i.weekStreak >= 4} />
        )}
        <Stat value={`${i.daysThisWeek}/7`} label="days this week" />
      </div>

      <div>
        <div className="flex justify-between text-xs text-slate-400 mb-1.5">
          <span>Last 12 weeks</span>
          <span>{i.last30} in the last 30 days</span>
        </div>
        <Sparkline weeks={i.weekly} color={a.color} />
      </div>

      {(life || i.topRecord) && (
        <div className="grid sm:grid-cols-2 gap-3">
          {life && (
            <div className="rounded-xl bg-slate-900/60 border border-slate-700/50 px-3 py-2.5">
              <p className="font-semibold">{life.value} <span className="text-xs font-normal text-slate-400">{life.label}</span></p>
              {life.fun && <p className="text-xs text-emerald-300 mt-0.5">{life.fun}</p>}
            </div>
          )}
          {i.topRecord && (
            <div className="rounded-xl bg-slate-900/60 border border-slate-700/50 px-3 py-2.5">
              <p className="font-semibold">🏆 {fmtRecord(i.topRecord, prefs)}</p>
              <p className="text-xs text-slate-400 mt-0.5">{RECORD_LABELS[i.topRecord.record_type].label} · {i.topRecord.logged_date}</p>
            </div>
          )}
        </div>
      )}

      <div className="mt-auto flex items-end gap-4">
        <div className="flex-1 min-w-0">
          {i.nextMilestone ? (
            <>
              <div className="flex justify-between text-xs text-slate-400 mb-1">
                <span>Next milestone: {i.nextMilestone} sessions</span>
                <span>{toNext} to go</span>
              </div>
              <div className="h-2 rounded-full bg-slate-900 overflow-hidden">
                <div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${Math.max(3, pct)}%` }} />
              </div>
            </>
          ) : (
            <p className="text-xs text-emerald-300">Every milestone unlocked. Legendary.</p>
          )}
        </div>
        {a.is_active && (
          <button onClick={onLog}
            className={`shrink-0 rounded-lg px-4 py-2 text-sm font-medium transition ${
              i.loggedToday ? 'border border-emerald-600/60 text-emerald-300 hover:bg-emerald-500/10' : 'bg-emerald-500 text-slate-950 hover:bg-emerald-400'
            }`}>
            {i.loggedToday ? '+ Log again' : 'Log today'}
          </button>
        )}
      </div>
    </article>
  )
}
