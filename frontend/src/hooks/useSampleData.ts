import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { store } from '../lib/store'
import { generateSampleLogs, samplePresets } from '../lib/sampleData'

export function useSampleData() {
  const qc = useQueryClient()
  const [busy, setBusy] = useState<null | 'load' | 'remove'>(null)
  const [error, setError] = useState<unknown>(null)
  const [message, setMessage] = useState<string | null>(null)

  const refresh = () => Promise.all([qc.invalidateQueries({ queryKey: ['activities'] }), qc.invalidateQueries({ queryKey: ['logs'] })])

  async function load() {
    setBusy('load')
    setError(null)
    setMessage(null)
    try {
      await store.deleteSampleLogs() // re-loading replaces rather than duplicates
      const existing = await store.listActivities()
      const names = new Set(existing.map((a) => a.name.toLowerCase()))
      for (const p of samplePresets()) {
        if (!names.has(p.name.toLowerCase())) {
          await store.createActivity({ category_id: p.category_id, name: p.name, icon: p.icon, color: p.color, unit: p.unit, daily_target: p.daily_target })
        }
      }
      const logs = generateSampleLogs(await store.listActivities())
      const n = await store.createLogs(logs)
      await refresh()
      setMessage(`Added ${n} sample logs covering the last 4 months.`)
    } catch (e) {
      setError(e)
    } finally {
      setBusy(null)
    }
  }

  async function remove() {
    setBusy('remove')
    setError(null)
    setMessage(null)
    try {
      const n = await store.deleteSampleLogs()
      await refresh()
      setMessage(n ? `Removed ${n} sample logs. Your own logs are untouched.` : 'No sample logs to remove.')
    } catch (e) {
      setError(e)
    } finally {
      setBusy(null)
    }
  }

  return { load, remove, busy, error, message }
}
