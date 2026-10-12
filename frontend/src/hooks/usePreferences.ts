import { createContext, useContext } from 'react'
import { DEFAULT_PREFERENCES, browserTimezone, type Preferences, type Settings } from '../lib/preferences'

export interface PreferencesContextValue {
  prefs: Preferences
  timezone: string
  /** Theme actually in use right now (system resolved). */
  resolvedTheme: 'light' | 'dark'
  loaded: boolean
  save: (next: Settings) => Promise<void>
}

export const PreferencesContext = createContext<PreferencesContextValue>({
  prefs: DEFAULT_PREFERENCES,
  timezone: browserTimezone(),
  resolvedTheme: 'dark',
  loaded: false,
  save: async () => {},
})

export const usePreferences = () => useContext(PreferencesContext)
