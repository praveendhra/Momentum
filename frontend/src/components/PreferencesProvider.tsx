import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { PreferencesContext } from '../hooks/usePreferences'
import { useAuth } from '../hooks/useAuth'
import { store } from '../lib/store'
import {
  applyTheme,
  browserTimezone,
  cachedThemePref,
  DEFAULT_PREFERENCES,
  resolveTheme,
  type Settings,
} from '../lib/preferences'

export default function PreferencesProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const qc = useQueryClient()
  const { data } = useQuery({
    queryKey: ['settings', user?.id],
    queryFn: () => store.getSettings(),
    enabled: Boolean(user),
    staleTime: Infinity,
  })

  // Before settings load (or when signed out), keep whatever theme this device used last.
  const prefs = useMemo(
    () => data?.preferences ?? { ...DEFAULT_PREFERENCES, theme: cachedThemePref() },
    [data],
  )
  const [systemTick, setSystemTick] = useState(0)

  useEffect(() => {
    applyTheme(prefs.theme)
  }, [prefs.theme, systemTick])

  // Follow the OS when the preference is "system".
  useEffect(() => {
    const mq = window.matchMedia?.('(prefers-color-scheme: light)')
    if (!mq) return
    const onChange = () => setSystemTick((t) => t + 1)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])

  const save = useCallback(
    async (next: Settings) => {
      qc.setQueryData(['settings', user?.id], next) // optimistic: theme/units switch instantly
      try {
        await store.saveSettings(next)
      } catch (e) {
        await qc.invalidateQueries({ queryKey: ['settings', user?.id] })
        throw e
      }
    },
    [qc, user?.id],
  )

  const value = useMemo(
    () => ({
      prefs,
      timezone: data?.timezone ?? browserTimezone(),
      // systemTick is read so this recomputes when the OS theme flips.
      resolvedTheme: systemTick >= 0 ? resolveTheme(prefs.theme) : 'dark',
      loaded: Boolean(data),
      save,
    }),
    [prefs, data, save, systemTick],
  )

  return <PreferencesContext.Provider value={value}>{children}</PreferencesContext.Provider>
}
