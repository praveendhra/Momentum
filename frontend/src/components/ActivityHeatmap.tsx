import { cloneElement, useEffect, useMemo, useRef, useState } from 'react'
import { ActivityCalendar } from 'react-activity-calendar'
import 'react-activity-calendar/tooltips.css'
import { useActivities, useActivityGraph, useCategories, useDayBreakdown } from '../hooks/queries'
import { usePreferences } from '../hooks/usePreferences'
import { ErrorNote, inputCls } from './ui'
import DayDetailModal from './DayDetailModal'
import { heatInsights, heatScale, LEVEL_LABELS, padRange, rangeBounds, type HeatRange } from '../lib/heatmap'
import { localDate, prettyDate } from '../lib/format'
import type { DayActivity } from '../types'

const DEFAULT_ACCENT = '#10b981'

function tooltipText(date: string, count: number, activities: string[]): string {
  const [y, m, d] = date.split('-').map(Number)
  const day = new Date(y, m - 1, d).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })
  if (!count) return `${day}\nNothing logged`
  const shown = activities.slice(0, 4)
  const more = activities.length - shown.length
  return [`${day} · ${count} ${count === 1 ? 'session' : 'sessions'}`, ...shown, ...(more > 0 ? [`+${more} more`] : [])].join('\n')
}

function Insight({ value, label, hint }: { value: string; label: string; hint?: string }) {
  return (
    <div className="min-w-0 rounded-xl bg-slate-900/60 border border-slate-700/50 px-3 py-2.5" title={hint}>
      <p className="text-lg font-bold leading-tight truncate">{value}</p>
      <p className="text-xs text-slate-400 truncate">{label}</p>
    </div>
  )
}

/** Measure the container so the grid fills the card at any screen width. */
function useWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null)
  const [width, setWidth] = useState(0)
  useEffect(() => {
    if (!ref.current) return
    const ro = new ResizeObserver(([e]) => setWidth(e.contentRect.width))
    ro.observe(ref.current)
    return () => ro.disconnect()
  }, [])
  return [ref, width] as const
}

export default function ActivityHeatmap() {
  const { data: activities } = useActivities()
  const { data: categories } = useCategories()
  const { prefs, resolvedTheme } = usePreferences()
  const today = localDate()

  const [range, setRange] = useState<HeatRange>('last12')
  const [categoryId, setCategoryId] = useState('')
  const [activityId, setActivityId] = useState('')
  const [openDay, setOpenDay] = useState<string | null>(null)
  const [wrapRef, width] = useWidth<HTMLDivElement>()

  const filter = { activity_id: activityId || undefined, category_id: activityId ? undefined : categoryId || undefined }
  const { data: all, isLoading, error } = useActivityGraph(filter)
  const { data: everything } = useActivityGraph({})
  const { data: breakdown } = useDayBreakdown(filter)

  const { start, end } = rangeBounds(range, today)
  // For a single activity, any session is a "full" day; doing it twice is the darkest shade.
  const shaded = useMemo<DayActivity[]>(
    () =>
      activityId
        ? (all ?? []).map((d) => ({ ...d, level: (d.count >= 2 ? 4 : d.count === 1 ? 3 : 0) as DayActivity['level'] }))
        : (all ?? []),
    [all, activityId],
  )
  const padded = useMemo(() => padRange(shaded, start, end), [shaded, start, end])
  const ins = useMemo(() => heatInsights(all ?? [], start, end, today), [all, start, end, today])

  // Years that actually have data (for the range switcher), newest first.
  const years = useMemo(() => {
    const ys = new Set((everything ?? []).map((d) => Number(d.date.slice(0, 4))))
    ys.add(Number(today.slice(0, 4)))
    return [...ys].sort((a, b) => b - a)
  }, [everything, today])

  // Only offer categories the user actually tracks.
  const usedCategories = (categories ?? []).filter((c) => activities?.some((a) => a.category_id === c.id))
  const activityOptions = (activities ?? []).filter((a) => !categoryId || a.category_id === categoryId)
  const accent =
    (activityId && activities?.find((a) => a.id === activityId)?.color) ||
    (categoryId && categories?.find((c) => c.id === categoryId)?.color) ||
    DEFAULT_ACCENT
  const scale = heatScale(accent, resolvedTheme)

  // Size squares to fill the width: ~53 week columns plus the weekday label gutter.
  const weeks = Math.ceil(ins.totalDays / 7) + 1
  const margin = 3
  const blockSize = width ? Math.max(8, Math.min(18, Math.floor((width - 34) / weeks) - margin)) : 12

  const chip = (active: boolean) =>
    `shrink-0 inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm transition ${
      active ? 'border-emerald-500 bg-emerald-500/15 text-emerald-300' : 'border-slate-700 text-slate-400 hover:border-slate-500 hover:text-white'
    }`

  const pct = ins.totalDays ? Math.round((ins.activeDays / ins.totalDays) * 100) : 0
  const rangeLabel = range === 'last12' ? 'in the last 12 months' : `in ${range}`

  return (
    <section className="bg-slate-800/70 border border-slate-700/50 rounded-2xl p-5">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div>
          <h3 className="text-base font-semibold">Activity</h3>
          <p className="text-sm text-slate-400">
            {ins.sessions} sessions on {ins.activeDays} days {rangeLabel}
          </p>
        </div>
        <div role="radiogroup" aria-label="Range" className="inline-flex rounded-xl bg-slate-900 border border-slate-700 p-1 gap-1 text-sm">
          {(['last12', ...years.slice(0, 3)] as HeatRange[]).map((r) => (
            <button key={String(r)} role="radio" aria-checked={range === r} onClick={() => setRange(r)}
              className={`px-3 py-1 rounded-lg transition ${range === r ? 'bg-emerald-500 text-slate-950 font-medium' : 'text-slate-400 hover:text-white'}`}>
              {r === 'last12' ? '12 months' : r}
            </button>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-2 mb-4">
        <div className="flex gap-2 overflow-x-auto pb-1 -mb-1 min-w-0 flex-1" role="group" aria-label="Filter by category">
          <button className={chip(!categoryId && !activityId)} onClick={() => { setCategoryId(''); setActivityId('') }}>All</button>
          {usedCategories.map((c) => (
            <button key={c.id} className={chip(categoryId === c.id && !activityId)}
              onClick={() => { setCategoryId(categoryId === c.id ? '' : c.id); setActivityId('') }}>
              <span aria-hidden>{c.icon}</span>{c.name}
            </button>
          ))}
        </div>
        <select aria-label="Filter by activity" className={`${inputCls} !w-auto !py-1 text-sm max-w-44 shrink-0`} value={activityId}
          onChange={(e) => setActivityId(e.target.value)}>
          <option value="">Any activity</option>
          {activityOptions.map((a) => <option key={a.id} value={a.id}>{a.icon} {a.name}</option>)}
        </select>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 mb-5">
        <Insight value={String(ins.sessions)} label="sessions" />
        <Insight value={`${ins.activeDays}`} label={`active days · ${pct}%`} hint={`${ins.activeDays} of ${ins.totalDays} days`} />
        <Insight value={`${ins.currentStreak}d`} label="current streak" />
        <Insight value={`${ins.longestStreak}d`} label="longest streak" />
        <Insight value={ins.bestDay ? String(ins.bestDay.count) : '—'} label={ins.bestDay ? `best day · ${prettyDate(ins.bestDay.date)}` : 'best day'} />
        <Insight value={ins.bestWeekday ?? '—'} label="most consistent" />
      </div>

      <ErrorNote error={error} />
      <div ref={wrapRef} className="overflow-x-auto">
        <ActivityCalendar
          key={`${start}-${blockSize}`}
          data={padded}
          loading={isLoading}
          colorScheme={resolvedTheme}
          theme={{ light: heatScale(accent, 'light'), dark: heatScale(accent, 'dark') }}
          weekStart={prefs.weekStart}
          blockSize={blockSize}
          blockMargin={margin}
          blockRadius={3}
          fontSize={12}
          showWeekdayLabels={['mon', 'wed', 'fri']}
          showColorLegend={false}
          showTotalCount={false}
          tooltips={{
            activity: {
              text: (a) => tooltipText(a.date, a.count, breakdown?.[a.date] ?? []),
              placement: 'top',
              withArrow: true,
              hoverRestMs: 60,
            },
          }}
          style={{ color: resolvedTheme === 'light' ? '#64748b' : '#94a3b8' }}
          renderBlock={(block, activity) =>
            cloneElement(block, {
              onClick: () => setOpenDay(activity.date),
              style: { ...(block.props.style ?? {}), cursor: 'pointer' },
              ...(activity.date === today
                ? { stroke: resolvedTheme === 'light' ? '#0f172a' : '#f8fafc', strokeWidth: 1.5 }
                : {}),
              role: 'button',
              'aria-label': `${activity.count} sessions on ${activity.date}. Show details`,
            })
          }
        />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 mt-3 text-xs text-slate-400">
        <span>Click any day for details. Today is outlined.</span>
        <span className="flex items-center gap-1.5">
          Less
          {scale.map((c, i) => (
            <span key={i} title={LEVEL_LABELS[i]} className="inline-block h-3 w-3 rounded-sm" style={{ backgroundColor: c }} />
          ))}
          More
          <span className="ml-2 hidden sm:inline">{activityId ? '(done · done 2×+)' : '(1 · 2 · 3–4 · 5+ sessions)'}</span>
        </span>
      </div>

      {openDay && <DayDetailModal date={openDay} onClose={() => setOpenDay(null)} onChangeDate={setOpenDay} />}
    </section>
  )
}
