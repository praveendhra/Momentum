import { useEffect, useState } from 'react'
import { App } from '@capacitor/app'
import { useTodayProgress } from '../hooks/queries'
import { localDate } from '../lib/format'
import { remindersSupported, scheduleReminders } from '../lib/reminders'

const ASKED_KEY = 'momentum.reminders.asked'

/**
 * Keeps the iOS reminders (3 PM, 7 PM, 10 PM) in step with today's logs.
 * Mounted once inside the signed-in layout; renders nothing.
 */
export default function ReminderSync() {
  // Bumped whenever the app returns to the foreground, so a new day (or a
  // reminder that has since fired) is picked up.
  const [wake, setWake] = useState(() => ({ day: localDate(), n: 0 }))
  const today = useTodayProgress(wake.day)
  const done = today?.done
  const total = today?.total

  useEffect(() => {
    if (!remindersSupported) return
    const sub = App.addListener('appStateChange', ({ isActive }) => {
      if (isActive) setWake((w) => ({ day: localDate(), n: w.n + 1 }))
    })
    return () => { void sub.then((s) => s.remove()) }
  }, [])

  useEffect(() => {
    if (!remindersSupported || done === undefined || total === undefined || total === 0) return
    // Ask for notification permission once, the first time there are activities to be reminded about.
    let ask = false
    try {
      ask = !localStorage.getItem(ASKED_KEY)
      if (ask) localStorage.setItem(ASKED_KEY, '1')
    } catch { /* storage unavailable: don't prompt */ }
    void scheduleReminders({ done, total }, ask).catch(() => {})
  }, [done, total, wake])

  return null
}
