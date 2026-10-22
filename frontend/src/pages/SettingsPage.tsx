import { useState, type ReactNode } from 'react'
import { usePreferences } from '../hooks/usePreferences'
import { useAuth } from '../hooks/useAuth'
import { Card, ErrorNote, inputCls } from '../components/ui'
import { browserTimezone, type Preferences } from '../lib/preferences'
import { supabase } from '../lib/supabase'
import TimezonePicker from '../components/TimezonePicker'
import { zoneLabel } from '../lib/timezones'
import DeleteAccount from '../components/DeleteAccount'

function Segmented<T extends string | number>({
  value,
  options,
  onChange,
  label,
}: {
  value: T
  options: { value: T; label: ReactNode }[]
  onChange: (v: T) => void
  label: string
}) {
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex rounded-xl bg-slate-900 border border-slate-700 p-1 gap-1">
      {options.map((o) => (
        <button
          key={String(o.value)}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
          className={`px-3 py-1.5 rounded-lg text-sm transition ${
            value === o.value ? 'bg-emerald-500 text-slate-950 font-medium' : 'text-slate-400 hover:text-white'
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

function Row({ title, desc, children }: { title: string; desc?: ReactNode; children: ReactNode }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 py-4 first:pt-0 last:pb-0">
      <div className="min-w-0">
        <p className="font-medium">{title}</p>
        {desc && <p className="text-sm text-slate-400 mt-0.5">{desc}</p>}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  )
}

function Toggle({ checked, onChange, label, disabled }: { checked: boolean; onChange: (v: boolean) => void; label: string; disabled?: boolean }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative h-7 w-12 rounded-full transition disabled:opacity-40 ${checked ? 'bg-emerald-500' : 'bg-slate-600'}`}
    >
      <span style={{ background: '#fff' }} className={`absolute top-1 h-5 w-5 rounded-full shadow transition-all ${checked ? 'left-6' : 'left-1'}`} />
    </button>
  )
}

const hourLabel = (h: number) =>
  new Date(2000, 0, 1, h).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })

export default function SettingsPage() {
  const { prefs, timezone, save, loaded } = usePreferences()
  const { user, mode, signOut } = useAuth()
  const [error, setError] = useState<unknown>(null)
  const [savedAt, setSavedAt] = useState<number | null>(null)

  async function update(patch: Partial<Preferences>, tz = timezone) {
    setError(null)
    try {
      await save({ preferences: { ...prefs, ...patch }, timezone: tz })
      setSavedAt(Date.now())
    } catch (e) {
      setError(e)
    }
  }
  const updateNotif = (patch: Partial<Preferences['notifications']>) =>
    update({ notifications: { ...prefs.notifications, ...patch } })

  const emailOff = mode !== 'supabase'
  const [testState, setTestState] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle')
  const [testMsg, setTestMsg] = useState('')

  async function sendTest() {
    if (!supabase) return
    setTestState('sending')
    setTestMsg('')
    const { data, error } = await supabase.functions.invoke('send-notifications', { body: { test: true } })
    if (error) {
      let detail = error.message
      try {
        const ctx = (error as { context?: Response }).context
        const body = ctx ? await ctx.json() : null
        if (body?.error) detail = body.error
      } catch {
        /* keep the generic message */
      }
      setTestState('error')
      setTestMsg(detail)
    } else {
      setTestState('sent')
      setTestMsg(`Sent 2 test emails to ${data?.to ?? 'you'}. They can take a minute to arrive.`)
    }
  }
  const deviceTz = browserTimezone()

  return (
    <div className="space-y-5 max-w-3xl">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Settings</h1>
        <span className="text-sm text-slate-500" role="status" aria-live="polite">
          {!loaded && mode === 'supabase' ? 'Loading…' : savedAt ? 'All changes saved' : 'Changes save automatically'}
        </span>
      </div>
      <ErrorNote error={error} />

      <Card title="Appearance">
        <Row title="Theme" desc="System follows your device's light or dark setting.">
          <Segmented
            label="Theme"
            value={prefs.theme}
            onChange={(theme) => update({ theme })}
            options={[
              { value: 'system', label: 'System' },
              { value: 'light', label: '☀️ Light' },
              { value: 'dark', label: '🌙 Dark' },
            ]}
          />
        </Row>
      </Card>

      <Card title="Units & calendar">
        <div className="divide-y divide-slate-700/60">
          <Row title="Weight" desc="Strength sets and personal records.">
            <Segmented label="Weight unit" value={prefs.weightUnit} onChange={(weightUnit) => update({ weightUnit })}
              options={[{ value: 'kg', label: 'kg' }, { value: 'lb', label: 'lb' }]} />
          </Row>
          <Row title="Distance" desc="Running, cycling and other distance activities.">
            <Segmented label="Distance unit" value={prefs.distanceUnit} onChange={(distanceUnit) => update({ distanceUnit })}
              options={[{ value: 'km', label: 'km' }, { value: 'mi', label: 'miles' }]} />
          </Row>
          <Row title="Volume" desc="Water and other drink goals.">
            <Segmented label="Volume unit" value={prefs.volumeUnit} onChange={(volumeUnit) => update({ volumeUnit })}
              options={[{ value: 'L', label: 'litres' }, { value: 'floz', label: 'fl oz' }]} />
          </Row>
          <Row title="Week starts on" desc="First row of the activity heatmap.">
            <Segmented label="Week start" value={prefs.weekStart} onChange={(weekStart) => update({ weekStart })}
              options={[{ value: 0, label: 'Sunday' }, { value: 1, label: 'Monday' }]} />
          </Row>
        </div>
        <p className="text-xs text-slate-500 mt-4">Switching units converts what you see. Your logged history doesn't change.</p>
      </Card>

      <Card title="Email notifications">
        {emailOff && (
          <p className="text-sm text-amber-300 mb-3">Email notifications need an account. They're unavailable in local mode.</p>
        )}
        <div className="divide-y divide-slate-700/60">
          <Row title="Daily reminder" desc="A nudge at your chosen time, only on days you haven't logged anything yet.">
            <div className="flex items-center gap-3">
              <select
                aria-label="Reminder time"
                className={`${inputCls} !w-auto !py-1.5`}
                disabled={emailOff || !prefs.notifications.dailyReminder}
                value={prefs.notifications.reminderHour}
                onChange={(e) => updateNotif({ reminderHour: Number(e.target.value) })}
              >
                {Array.from({ length: 24 }, (_, h) => <option key={h} value={h}>{hourLabel(h)}</option>)}
              </select>
              <Toggle label="Daily reminder" disabled={emailOff} checked={prefs.notifications.dailyReminder}
                onChange={(dailyReminder) => updateNotif({ dailyReminder })} />
            </div>
          </Row>
          <Row title="Weekly summary" desc="Sunday evening: sessions, active days, consistency and new PRs for the week.">
            <Toggle label="Weekly summary" disabled={emailOff} checked={prefs.notifications.weeklySummary}
              onChange={(weeklySummary) => updateNotif({ weeklySummary })} />
          </Row>
          <Row
            title="Time zone"
            desc={timezone !== deviceTz ? (
              <>
                This device is on {zoneLabel(deviceTz)}.{' '}
                <button className="text-emerald-400 hover:underline" onClick={() => update({}, deviceTz)}>Use it</button>
              </>
            ) : 'Used to send emails at your local time.'}
          >
            <TimezonePicker value={timezone} onChange={(tz) => update({}, tz)} />
          </Row>
        </div>
        {!emailOff && (
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <button onClick={sendTest} disabled={testState === 'sending'}
              className="text-sm rounded-lg border border-slate-600 px-3 py-1.5 text-slate-300 hover:bg-slate-700 disabled:opacity-50">
              {testState === 'sending' ? 'Sending…' : 'Send me a test email'}
            </button>
            {user?.email && testState === 'idle' && <span className="text-xs text-slate-500">Emails go to {user.email}.</span>}
            {testMsg && (
              <span role="status" className={`text-sm ${testState === 'error' ? 'text-rose-400' : 'text-emerald-300'}`}>{testMsg}</span>
            )}
          </div>
        )}
      </Card>

      {mode === 'supabase' && (
        <Card title="Account">
          <Row title={user?.email ?? 'Signed in'} desc="Your data is stored in Momentum's Supabase database and only you can read it.">
            <button onClick={signOut} className="text-sm rounded-lg border border-slate-600 px-3 py-1.5 text-slate-300 hover:bg-slate-700">
              Sign out
            </button>
          </Row>
        </Card>
      )}

      {mode === 'supabase' && (
        <section className="rounded-2xl border border-rose-500/30 bg-rose-500/5 p-5">
          <h3 className="text-base font-semibold text-rose-300 mb-4">Danger zone</h3>
          <DeleteAccount />
        </section>
      )}
    </div>
  )
}
