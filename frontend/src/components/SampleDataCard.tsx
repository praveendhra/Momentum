import { useSampleData } from '../hooks/useSampleData'
import { Card, ErrorNote, btnGhost, btnPrimary } from './ui'

export default function SampleDataCard() {
  const { load, remove, busy, error, message } = useSampleData()
  return (
    <Card title="Sample data">
      <p className="text-sm text-slate-400 mb-4">
        Fill your account with about four months of realistic logs (workouts with progressive overload, runs, habits,
        coding practice and daily mood) to see the dashboard in action. Sample logs are tagged, so removing them never
        touches what you logged yourself.
      </p>
      <div className="flex flex-wrap gap-3">
        <button className={btnPrimary} disabled={!!busy} onClick={load}>
          {busy === 'load' ? 'Loading…' : 'Load sample data'}
        </button>
        <button className={btnGhost} disabled={!!busy} onClick={remove}>
          {busy === 'remove' ? 'Removing…' : 'Remove sample data'}
        </button>
      </div>
      {message && <p className="text-sm text-emerald-300 mt-3" role="status">{message}</p>}
      <div className="mt-3"><ErrorNote error={error} /></div>
    </Card>
  )
}
