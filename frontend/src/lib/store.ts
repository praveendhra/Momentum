/**
 * Data access. Two backends with one interface:
 *   - Supabase (Postgres + Auth), protected by row-level security
 *   - Local mode: browser localStorage, used when Supabase isn't configured
 */
import { supabase } from './supabase'
import type { Activity, ActivityLog, LogInput } from '../types'
import { browserTimezone, withDefaults, type Settings } from './preferences'

export interface LogFilters {
  activity_id?: string
  activity_ids?: string[]
  date_from?: string
  date_to?: string
  limit?: number
}

export type ActivityInput = Pick<Activity, 'category_id' | 'name' | 'icon' | 'color' | 'unit' | 'daily_target'>
export type ActivityPatch = Partial<Omit<Activity, 'id' | 'user_id'>>
export type LogPatch = Partial<Omit<LogInput, 'activity_id'>>

export interface Store {
  listActivities(): Promise<Activity[]>
  createActivity(data: ActivityInput): Promise<Activity>
  updateActivity(id: string, patch: ActivityPatch): Promise<Activity>
  deleteActivity(id: string): Promise<void>
  listLogs(f: LogFilters): Promise<ActivityLog[]>
  allLogs(): Promise<ActivityLog[]>
  createLog(data: LogInput): Promise<ActivityLog>
  updateLog(id: string, patch: LogPatch): Promise<ActivityLog>
  deleteLog(id: string): Promise<void>
  /** Insert many logs at once (used by the sample-data loader). */
  createLogs(data: LogInput[]): Promise<number>
  /** Delete every log tagged extra_data.sample = true. Returns how many were removed. */
  deleteSampleLogs(): Promise<number>
  getSettings(): Promise<Settings>
  saveSettings(s: Settings): Promise<void>
}

const ACTIVITY_COLS = 'id,user_id,category_id,name,icon,color,unit,daily_target,is_active,sort_order'
const LOG_COLS =
  'id,user_id,activity_id,logged_date,duration_minutes,quantity,intensity,quality,difficulty,mood_score,notes,extra_data,created_at'

function check<T>(res: { data: T | null; error: { message: string } | null }): T {
  if (res.error) throw new Error(res.error.message)
  return res.data as T
}

function supabaseStore(): Store {
  const sb = supabase!
  return {
    async listActivities() {
      return check(await sb.from('activities').select(ACTIVITY_COLS).order('sort_order').order('name')) as Activity[]
    },
    async createActivity(data) {
      const existing = check(await sb.from('activities').select('sort_order').order('sort_order', { ascending: false }).limit(1)) as { sort_order: number }[]
      const sort_order = (existing[0]?.sort_order ?? -1) + 1
      return check(await sb.from('activities').insert({ ...data, sort_order }).select(ACTIVITY_COLS).single()) as Activity
    },
    async updateActivity(id, patch) {
      return check(await sb.from('activities').update(patch).eq('id', id).select(ACTIVITY_COLS).single()) as Activity
    },
    async deleteActivity(id) {
      check(await sb.from('activities').delete().eq('id', id))
    },
    async listLogs(f) {
      let q = sb.from('activity_logs').select(LOG_COLS)
      if (f.activity_id) q = q.eq('activity_id', f.activity_id)
      if (f.activity_ids) q = q.in('activity_id', f.activity_ids)
      if (f.date_from) q = q.gte('logged_date', f.date_from)
      if (f.date_to) q = q.lte('logged_date', f.date_to)
      q = q.order('logged_date', { ascending: false }).order('created_at', { ascending: false }).limit(f.limit ?? 50)
      return check(await q) as ActivityLog[]
    },
    async allLogs() {
      const page = 1000
      const out: ActivityLog[] = []
      for (let from = 0; ; from += page) {
        const rows = check(
          await sb.from('activity_logs').select(LOG_COLS).order('logged_date').order('id').range(from, from + page - 1),
        ) as ActivityLog[]
        out.push(...rows)
        if (rows.length < page) return out
      }
    },
    async createLog(data) {
      return check(await sb.from('activity_logs').insert(data).select(LOG_COLS).single()) as ActivityLog
    },
    async updateLog(id, patch) {
      return check(await sb.from('activity_logs').update(patch).eq('id', id).select(LOG_COLS).single()) as ActivityLog
    },
    async deleteLog(id) {
      check(await sb.from('activity_logs').delete().eq('id', id))
    },
    async createLogs(data) {
      const chunk = 500
      for (let i = 0; i < data.length; i += chunk) {
        check(await sb.from('activity_logs').insert(data.slice(i, i + chunk)))
      }
      return data.length
    },
    async getSettings() {
      const { data: auth } = await sb.auth.getUser()
      const uid = auth.user?.id
      if (!uid) throw new Error('Not signed in')
      const row = check(
        await sb.from('profiles').select('preferences,timezone').eq('id', uid).maybeSingle(),
      ) as { preferences: unknown; timezone: string | null } | null
      return { preferences: withDefaults(row?.preferences), timezone: row?.timezone && row.timezone !== 'UTC' ? row.timezone : browserTimezone() }
    },
    async saveSettings(settings) {
      const { data: auth } = await sb.auth.getUser()
      const uid = auth.user?.id
      if (!uid) throw new Error('Not signed in')
      check(
        await sb
          .from('profiles')
          .upsert({ id: uid, preferences: settings.preferences, timezone: settings.timezone }, { onConflict: 'id' }),
      )
    },
    async deleteSampleLogs() {
      const rows = check(
        await sb.from('activity_logs').delete().eq('extra_data->>sample', 'true').select('id'),
      ) as { id: string }[]
      return rows.length
    },
  }
}

// ─── Local (browser) store ───

const LOCAL_KEY = 'momentum.local.v1'
const SETTINGS_KEY = 'momentum.local.settings'
export const LOCAL_USER_ID = '00000000-0000-0000-0000-000000000000'

interface LocalDb {
  activities: Activity[]
  logs: ActivityLog[]
}

function load(): LocalDb {
  try {
    const raw = localStorage.getItem(LOCAL_KEY)
    if (raw) return JSON.parse(raw) as LocalDb
  } catch {
    /* ignore corrupt or unavailable storage */
  }
  return { activities: [], logs: [] }
}

function save(db: LocalDb) {
  localStorage.setItem(LOCAL_KEY, JSON.stringify(db))
}

const uuid = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
        const r = (Math.random() * 16) | 0
        return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16)
      })

function sortLogsDesc(a: ActivityLog, b: ActivityLog) {
  return b.logged_date.localeCompare(a.logged_date) || b.created_at.localeCompare(a.created_at)
}

function localStore(): Store {
  return {
    async listActivities() {
      return load().activities.sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name))
    },
    async createActivity(data) {
      const db = load()
      const a: Activity = {
        ...data,
        id: uuid(),
        user_id: LOCAL_USER_ID,
        is_active: true,
        sort_order: Math.max(-1, ...db.activities.map((x) => x.sort_order)) + 1,
      }
      db.activities.push(a)
      save(db)
      return a
    },
    async updateActivity(id, patch) {
      const db = load()
      const a = db.activities.find((x) => x.id === id)
      if (!a) throw new Error('Activity not found')
      Object.assign(a, patch)
      save(db)
      return a
    },
    async deleteActivity(id) {
      const db = load()
      db.activities = db.activities.filter((x) => x.id !== id)
      db.logs = db.logs.filter((l) => l.activity_id !== id)
      save(db)
    },
    async listLogs(f) {
      return load()
        .logs.filter(
          (l) =>
            (!f.activity_id || l.activity_id === f.activity_id) &&
            (!f.activity_ids || f.activity_ids.includes(l.activity_id)) &&
            (!f.date_from || l.logged_date >= f.date_from) &&
            (!f.date_to || l.logged_date <= f.date_to),
        )
        .sort(sortLogsDesc)
        .slice(0, f.limit ?? 50)
    },
    async allLogs() {
      return load().logs
    },
    async createLog(data) {
      const db = load()
      if (!db.activities.some((a) => a.id === data.activity_id)) throw new Error('Activity not found')
      const log: ActivityLog = {
        duration_minutes: null, quantity: null, intensity: null, quality: null, difficulty: null,
        mood_score: null, notes: null, extra_data: null,
        ...data,
        id: uuid(),
        user_id: LOCAL_USER_ID,
        created_at: new Date().toISOString(),
      }
      db.logs.push(log)
      save(db)
      return log
    },
    async updateLog(id, patch) {
      const db = load()
      const l = db.logs.find((x) => x.id === id)
      if (!l) throw new Error('Log not found')
      Object.assign(l, patch)
      save(db)
      return l
    },
    async deleteLog(id) {
      const db = load()
      db.logs = db.logs.filter((x) => x.id !== id)
      save(db)
    },
    async createLogs(data) {
      const db = load()
      const now = new Date().toISOString()
      for (const d of data) {
        db.logs.push({
          duration_minutes: null, quantity: null, intensity: null, quality: null, difficulty: null,
          mood_score: null, notes: null, extra_data: null,
          ...d,
          id: uuid(),
          user_id: LOCAL_USER_ID,
          created_at: now,
        })
      }
      save(db)
      return data.length
    },
    async getSettings() {
      try {
        const raw = localStorage.getItem(SETTINGS_KEY)
        if (raw) {
          const parsed = JSON.parse(raw) as Partial<Settings>
          return { preferences: withDefaults(parsed.preferences), timezone: parsed.timezone || browserTimezone() }
        }
      } catch {
        /* fall through to defaults */
      }
      return { preferences: withDefaults({}), timezone: browserTimezone() }
    },
    async saveSettings(settings) {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings))
    },
    async deleteSampleLogs() {
      const db = load()
      const before = db.logs.length
      db.logs = db.logs.filter((l) => l.extra_data?.sample !== true)
      save(db)
      return before - db.logs.length
    },
  }
}

export const store: Store = supabase ? supabaseStore() : localStore()

/** Local-mode helpers for the "move my data to my account" / reset flow. */
export function localDataSummary(): { activities: number; logs: number } {
  const db = load()
  return { activities: db.activities.length, logs: db.logs.length }
}

export function clearLocalData() {
  localStorage.removeItem(LOCAL_KEY)
}
