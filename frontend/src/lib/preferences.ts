export type ThemePref = 'system' | 'light' | 'dark'
export type WeightUnit = 'kg' | 'lb'
export type DistanceUnit = 'km' | 'mi'
export type VolumeUnit = 'L' | 'floz'

export interface NotificationPrefs {
  dailyReminder: boolean
  /** Local hour (0–23) to send the reminder if nothing has been logged yet. */
  reminderHour: number
  weeklySummary: boolean
}

export interface Preferences {
  theme: ThemePref
  weightUnit: WeightUnit
  distanceUnit: DistanceUnit
  volumeUnit: VolumeUnit
  /** 0 = Sunday, 1 = Monday. Used by the heatmap. */
  weekStart: 0 | 1
  notifications: NotificationPrefs
}

export interface Settings {
  preferences: Preferences
  timezone: string
}

export const DEFAULT_PREFERENCES: Preferences = {
  theme: 'system',
  weightUnit: 'kg',
  distanceUnit: 'km',
  volumeUnit: 'L',
  weekStart: 0,
  notifications: { dailyReminder: false, reminderHour: 20, weeklySummary: false },
}

export const browserTimezone = (): string => {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
  } catch {
    return 'UTC'
  }
}

/** Fill in anything missing (older rows, new settings added later) with defaults. */
export function withDefaults(raw: unknown): Preferences {
  const p = (raw && typeof raw === 'object' ? raw : {}) as Partial<Preferences>
  return {
    ...DEFAULT_PREFERENCES,
    ...p,
    notifications: { ...DEFAULT_PREFERENCES.notifications, ...(p.notifications ?? {}) },
  }
}

// ─── Theme ───

const THEME_KEY = 'momentum.theme'

export function resolveTheme(pref: ThemePref): 'light' | 'dark' {
  if (pref !== 'system') return pref
  return typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: light)').matches ? 'light' : 'dark'
}

/** Apply to <html> and remember locally so the next load paints in the right theme immediately. */
export function applyTheme(pref: ThemePref) {
  const resolved = resolveTheme(pref)
  document.documentElement.dataset.theme = resolved
  document.documentElement.style.colorScheme = resolved
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', resolved === 'light' ? '#f8fafc' : '#0f172a')
  try {
    localStorage.setItem(THEME_KEY, pref)
  } catch {
    /* storage unavailable */
  }
}

export function cachedThemePref(): ThemePref {
  try {
    const v = localStorage.getItem(THEME_KEY)
    if (v === 'light' || v === 'dark' || v === 'system') return v
  } catch {
    /* storage unavailable */
  }
  return 'system'
}
