import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ActivityCalendar } from 'react-activity-calendar'
import 'react-activity-calendar/tooltips.css'
import {
  useActivities,
  useActivityGraph,
  useCategories,
  useCorrelations,
  useCreateLog,
  useDayBreakdown,
  useLogs,
  usePersonalRecords,
  useStreaks,
  useSummary,
} from '../hooks/queries'
import { Card, ErrorNote, Spinner, inputCls } from '../components/ui'
import LogModal from '../components/LogModal'
import { fmtNum, localDate, RECORD_LABELS, UNIT_LABELS } from '../lib/format'
import type { Activity, CategorySlug, DayActivity, LogCreated } from '../types'

const HEAT_THEME = { dark: ['#1e293b', '#065f46', '#047857', '#10b981', '#6ee7b7'] }

function StatCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="bg-slate-800/70 border border-slate-700/50 rounded-2xl p-4 sm:p-5 min-w-0">
      <p className="text-xs sm:text-sm text-slate-400">{label}</p>
      <p className="text-xl sm:text-2xl font-bold mt-1 truncate">{value}</p>
      {sub && <p className="text-xs text-slate-500 mt-0.5">{sub}</p>}
    </div>
  )
}

function tooltipText(date: string, count: number, activities: string[]): string {
  const [y, m, d] = date.split('-').map(Number)
  const day = new Date(y, m - 1, d).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })
  if (!count) return `${day}\nNothing logged`
  const shown = activities.slice(0, 4)
  const more = activities.length - shown.length
  return [`${day} · ${count} ${count === 1 ? 'session' : 'sessions'}`, ...shown, ...(more > 0 ? [`+${more} more`] : [])].join('\n')
}

/** Pad the year so the calendar always spans Jan 1 → today (or Dec 31). */
function padYear(year: number, data: DayActivity[]): DayActivity[] {
  const today = localDate()
  const start = `${year}-01-01`
  const end = String(year) === today.slice(0, 4) ? today : `${year}-12-31`
  const out = data.filter((d) => d.date >= start && d.date <= end)
  if (!out.length || out[0].date !== start) out.unshift({ date: start, count: 0, level: 0 })
  if (out[out.length - 1].date !== end) out.push({ date: end, count: 0, level: 0 })
  return out
}

function Heatmap() {
  const { data: activities } = useActivities()
  const { data: categories } = useCategories()
  const thisYear = new Date().getFullYear()
  const [year, setYear] = useState(thisYear)
  const [filter, setFilter] = useState('')
  const [kind, id] = filter.split(':')
  const graphFilter = { year, activity_id: kind === 'a' ? id : undefined, category_id: kind === 'c' ? id : undefined }
  const { data, isLoading, error } = useActivityGraph(graphFilter)
  const { data: breakdown } = useDayBreakdown(graphFilter)
  const padded = useMemo(() => padYear(year, data ?? []), [year, data])

  return (
    <Card
      title="Activity"
      action={
        <div className="flex gap-2">
          <select aria-label="Filter heatmap" className={`${inputCls} !py-1 text-sm max-w-44`} value={filter} onChange={(e) => setFilter(e.target.value)}>
            <option value="">Everything</option>
            <optgroup label="Categories">
              {categories?.map((c) => <option key={c.id} value={`c:${c.id}`}>{c.icon} {c.name}</option>)}
            </optgroup>
            <optgroup label="Activities">
              {activities?.map((a) => <option key={a.id} value={`a:${a.id}`}>{a.icon} {a.name}</option>)}
            </optgroup>
          </select>
          <select aria-label="Year" className={`${inputCls} !py-1 text-sm w-24`} value={year} onChange={(e) => setYear(Number(e.target.value))}>
            {[thisYear, thisYear - 1, thisYear - 2].map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
      }
    >
      <ErrorNote error={error} />
      <div className="overflow-x-auto">
        <ActivityCalendar
          data={padded}
          loading={isLoading}
          colorScheme="dark"
          theme={HEAT_THEME}
          blockSize={12}
          blockMargin={3}
          fontSize={12}
          labels={{ totalCount: `{{count}} sessions in ${year}` }}
          tooltips={{
            activity: {
              text: (a) => tooltipText(a.date, a.count, breakdown?.[a.date] ?? []),
              placement: 'top',
              withArrow: true,
              hoverRestMs: 60,
            },
          }}
          style={{ color: '#94a3b8' }}
        />
      </div>
    </Card>
  )
}

function QuickLog({ onLogged }: { onLogged: (log: LogCreated, a: Activity) => void }) {
  const { data: activities, isLoading } = useActivities()
  const { data: categories } = useCategories()
  const today = localDate()
  const { data: todayLogs } = useLogs({ date_from: today, date_to: today, limit: 200 })
  const create = useCreateLog()
  const [open, setOpen] = useState<Activity | null>(null)

  const slug = (a: Activity) => (categories?.find((c) => c.id === a.category_id)?.slug ?? 'custom') as CategorySlug
  const progress = (a: Activity) => {
    const logs = (todayLogs ?? []).filter((l) => l.activity_id === a.id)
    const total = logs.reduce((acc, l) => acc + (a.unit === 'minutes' ? l.duration_minutes ?? 0 : l.quantity ?? 0), 0)
    return { done: logs.length > 0, count: logs.length, total }
  }

  return (
    <Card title="Today" action={<Link to="/activities" className="text-sm text-emerald-400 hover:text-emerald-300">Manage</Link>}>
      {isLoading && <Spinner />}
      <ErrorNote error={create.error} />
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
        {activities?.filter((a) => a.is_active).map((a) => {
          const p = progress(a)
          const pct = a.daily_target ? Math.min(100, (p.total / a.daily_target) * 100) : p.done ? 100 : 0
          const oneTap = a.unit === 'boolean'
          return (
            <button
              key={a.id}
              disabled={create.isPending}
              onClick={async () => {
                if (oneTap && !p.done) {
                  const log = await create.mutateAsync({ activity_id: a.id, logged_date: today })
                  onLogged(log, a)
                } else setOpen(a)
              }}
              className={`relative overflow-hidden rounded-xl border p-3 text-left transition ${
                p.done ? 'border-emerald-600/60 bg-emerald-500/10' : 'border-slate-700 bg-slate-900/50 hover:border-slate-500'
              }`}
            >
              <span className="absolute inset-x-0 bottom-0 h-1 bg-emerald-500/80 transition-all" style={{ width: `${pct}%` }} />
              <div className="flex items-center gap-2">
                <span className="text-xl" aria-hidden>{a.icon}</span>
                <span className="font-medium text-sm truncate">{a.name}</span>
                {p.done && <span className="ml-auto text-emerald-400 text-sm" aria-label="done today">✓</span>}
              </div>
              <p className="text-xs text-slate-400 mt-1">
                {a.daily_target
                  ? `${fmtNum(p.total)} / ${fmtNum(a.daily_target)} ${UNIT_LABELS[a.unit]}`
                  : p.done
                    ? `Logged${p.count > 1 ? ` ×${p.count}` : ''}`
                    : oneTap ? 'Tap to mark done' : 'Tap to log'}
              </p>
            </button>
          )
        })}
      </div>
      {open && (
        <LogModal activity={open} categorySlug={slug(open)} onClose={() => setOpen(null)} onLogged={(log) => onLogged(log, open)} />
      )}
    </Card>
  )
}

function Streaks() {
  const { data, isLoading } = useStreaks()
  return (
    <Card title="Consistency" action={<span className="text-xs text-slate-500">last 7 days</span>}>
      {isLoading && <Spinner />}
      {data && !data.length && <p className="text-sm text-slate-400">Log something to start building consistency.</p>}
      <ul className="space-y-3">
        {data?.map((s) => (
          <li key={s.activity_id}>
            <div className="flex justify-between text-sm mb-1">
              <span className="truncate">{s.activity_name}</span>
              <span className="text-slate-400 whitespace-nowrap">
                {Math.round((s.weekly_consistency_score / 100) * 7)}/7
                {s.current_streak > 1 && <span className="text-amber-400"> · 🔥 {s.current_streak}d</span>}
              </span>
            </div>
            <div className="h-2 rounded-full bg-slate-900 overflow-hidden">
              <div className="h-full rounded-full bg-emerald-500" style={{ width: `${s.weekly_consistency_score}%` }} />
            </div>
          </li>
        ))}
      </ul>
    </Card>
  )
}

function Records() {
  const { data, isLoading } = usePersonalRecords()
  const top = data?.slice(0, 8)
  return (
    <Card title="Personal records">
      {isLoading && <Spinner />}
      {data && !data.length && <p className="text-sm text-slate-400">PRs show up here once you log workouts with sets, distance or duration.</p>}
      <ul className="divide-y divide-slate-700/60">
        {top?.map((pr) => {
          const meta = RECORD_LABELS[pr.record_type]
          return (
            <li key={pr.id} className="flex items-center justify-between py-2 text-sm gap-3">
              <div className="min-w-0">
                <p className="truncate">{pr.activity_name}</p>
                <p className="text-xs text-slate-500">{meta.label} · {pr.logged_date}</p>
              </div>
              <span className="font-semibold text-emerald-300 whitespace-nowrap">{fmtNum(pr.value)} {meta.unit}</span>
            </li>
          )
        })}
      </ul>
    </Card>
  )
}

function Insights() {
  const { data } = useCorrelations()
  if (!data) return null
  return (
    <Card title="Mood insights">
      {data.insights.length ? (
        <ul className="space-y-2">
          {data.insights.map((i) => (
            <li key={i.factor} className="text-sm flex gap-2">
              <span aria-hidden>{i.delta > 0 ? '📈' : '📉'}</span>
              {i.description}
            </li>
          ))}
        </ul>
      ) : data.mood_days < data.required_days ? (
        <>
          <p className="text-sm text-slate-400">
            Log your mood on {data.required_days - data.mood_days} more {data.required_days - data.mood_days === 1 ? 'day' : 'days'} to unlock patterns like "your mood is higher after workouts".
          </p>
          <div className="h-2 mt-3 rounded-full bg-slate-900 overflow-hidden">
            <div className="h-full bg-amber-400" style={{ width: `${(data.mood_days / data.required_days) * 100}%` }} />
          </div>
        </>
      ) : (
        <p className="text-sm text-slate-400">No clear patterns yet. Keep logging and they'll surface here.</p>
      )}
    </Card>
  )
}

export default function DashboardPage() {
  const { data: summary } = useSummary()
  const [toast, setToast] = useState<string | null>(null)

  const onLogged = (log: LogCreated, a: Activity) => {
    const msg = log.new_records.length
      ? `🏆 New PR on ${a.name}: ${log.new_records.map((r) => RECORD_LABELS[r as keyof typeof RECORD_LABELS]?.label ?? r).join(', ')}!`
      : `${a.icon} ${a.name} logged`
    setToast(msg)
    setTimeout(() => setToast((t) => (t === msg ? null : t)), 3500)
  }

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard label="Active days" value={summary?.active_days_this_month ?? '—'} sub="this month" />
        <StatCard label="Sessions" value={summary?.total_sessions ?? '—'} sub="all time" />
        <StatCard label="Best current streak" value={summary ? `${summary.current_longest_streak}d` : '—'} />
        <StatCard label="Top activity" value={summary?.top_activity ?? '—'} />
      </div>

      <QuickLog onLogged={onLogged} />
      <Heatmap />

      <div className="grid md:grid-cols-2 gap-5">
        <Streaks />
        <Records />
      </div>
      <Insights />

      {toast && (
        <div role="status" className="fixed bottom-24 sm:bottom-6 left-1/2 -translate-x-1/2 z-50 rounded-full bg-slate-100 text-slate-900 px-5 py-2.5 text-sm font-medium shadow-xl">
          {toast}
        </div>
      )}
    </div>
  )
}
