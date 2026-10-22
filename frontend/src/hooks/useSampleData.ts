import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { store } from '../lib/store'

export function useSampleData() {
  const qc = useQueryClient()
  const [busy, setBusy] = useState<null | 'remove'>(null)
  const [error, setError] = useState<unknown>(null)
  const [message, setMessage] = useState<string | null>(null)

  const refresh = () => Promise.all([qc.invalidateQueries({ queryKey: ['activities'] }), qc.invalidateQueries({ queryKey: ['logs'] })])

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

  return { remove, busy, error, message }
}
