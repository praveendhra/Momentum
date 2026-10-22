import { useSampleData } from '../hooks/useSampleData'
import { useAllLogs } from '../hooks/queries'
import { Card, ErrorNote, btnGhost } from './ui'

/** Only shown to accounts that still have sample logs from the old "Load sample data" option, so they can clear them. */
export default function SampleDataCard() {
  const { data: logs } = useAllLogs()
  const { remove, busy, error, message } = useSampleData()
  const hasSample = logs?.some((l) => l.extra_data?.sample === true)
  if (!hasSample && !message) return null
  return (
    <Card title="Sample data">
      <p className="text-sm text-slate-400 mb-4">
        Your account still has sample logs. Removing them never touches what you logged yourself.
      </p>
      <button className={btnGhost} disabled={!!busy} onClick={remove}>
        {busy ? 'Removing…' : 'Remove sample data'}
      </button>
      {message && <p className="text-sm text-emerald-300 mt-3" role="status">{message}</p>}
      <div className="mt-3"><ErrorNote error={error} /></div>
    </Card>
  )
}
