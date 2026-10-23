/**
 * Daily "log your day" reminders for the iOS app, at 3 PM, 7 PM and 10 PM
 * device time.
 *
 * They're local notifications scheduled on the phone (no push server or
 * APNs key needed), and they're rescheduled whenever the app opens or a log
 * changes, so today's remaining reminders are skipped once every activity is
 * logged and the wording reflects how many are left. Seven days are queued
 * ahead (21 notifications, under iOS's 64 limit), so reminders keep coming
 * for a week even if the app isn't opened.
 *
 * No-ops on the web.
 */
import { LocalNotifications } from '@capacitor/local-notifications'
import { isNative } from './native'

export const REMINDER_HOURS = [15, 19, 22] as const
const DAYS_AHEAD = 7
const ID_BASE = 7000 // ids 7000..7999 belong to these reminders
const PREF_KEY = 'momentum.reminders'

export const remindersSupported = isNative

/** Whether reminders are on for this phone (default on). */
export function remindersEnabled(): boolean {
  try {
    return localStorage.getItem(PREF_KEY) !== 'off'
  } catch {
    return true
  }
}

function setEnabledPref(on: boolean) {
  try {
    localStorage.setItem(PREF_KEY, on ? 'on' : 'off')
  } catch { /* storage unavailable: falls back to default (on) */ }
}

export type ReminderPermission = 'granted' | 'denied' | 'prompt'

export async function reminderPermission(): Promise<ReminderPermission> {
  if (!isNative) return 'denied'
  const { display } = await LocalNotifications.checkPermissions()
  return display === 'granted' ? 'granted' : display === 'denied' ? 'denied' : 'prompt'
}

async function ensurePermission(ask: boolean): Promise<boolean> {
  const current = await reminderPermission()
  if (current === 'granted') return true
  if (current === 'denied' || !ask) return false
  const { display } = await LocalNotifications.requestPermissions()
  return display === 'granted'
}

export async function cancelReminders(): Promise<void> {
  if (!isNative) return
  const { notifications } = await LocalNotifications.getPending()
  const ours = notifications.filter((n) => n.id >= ID_BASE && n.id < ID_BASE + 1000)
  if (ours.length) await LocalNotifications.cancel({ notifications: ours.map((n) => ({ id: n.id })) })
}

/** Today's progress, used to word (or skip) today's reminders. */
export interface TodayProgress {
  done: number
  total: number
}

function message(hour: number, today: TodayProgress | null): { title: string; body: string } {
  const left = today ? today.total - today.done : 0
  if (hour === 15) {
    return {
      title: 'Afternoon check-in',
      body: today && left > 0
        ? `${today.done} of ${today.total} done so far. Log what you've finished in Momentum.`
        : "Log what you've done so far today in Momentum.",
    }
  }
  if (hour === 19) {
    return {
      title: 'Evening check-in',
      body: left > 0 ? `${left} still open today. A quick log keeps your streaks going.` : 'A quick log keeps your streaks going.',
    }
  }
  return {
    title: 'Last call for today',
    body: left > 0 ? `${left} left before midnight. Log it so today counts.` : 'Log today before midnight so it counts.',
  }
}

/**
 * Replace the queued reminders. `today` is the current progress; once every
 * activity is done, the rest of today's reminders are skipped.
 * Only asks for notification permission when `askPermission` is set.
 */
export async function scheduleReminders(today: TodayProgress | null, askPermission = false): Promise<boolean> {
  if (!isNative) return false
  await cancelReminders()
  if (!remindersEnabled()) return false
  if (!(await ensurePermission(askPermission))) return false

  const now = new Date()
  const allDoneToday = !!today && today.total > 0 && today.done >= today.total
  const notifications = []
  for (let d = 0; d < DAYS_AHEAD; d++) {
    if (d === 0 && allDoneToday) continue
    for (const [i, hour] of REMINDER_HOURS.entries()) {
      const at = new Date(now.getFullYear(), now.getMonth(), now.getDate() + d, hour, 0, 0)
      if (at <= now) continue
      const { title, body } = message(hour, d === 0 ? today : null)
      notifications.push({ id: ID_BASE + d * 10 + i, title, body, schedule: { at } })
    }
  }
  if (notifications.length) await LocalNotifications.schedule({ notifications })
  return true
}

/** Turn reminders on or off from Settings. Returns whether they're now active. */
export async function setRemindersEnabled(on: boolean, today: TodayProgress | null): Promise<boolean> {
  setEnabledPref(on)
  if (!on) {
    await cancelReminders()
    return false
  }
  return scheduleReminders(today, true)
}
