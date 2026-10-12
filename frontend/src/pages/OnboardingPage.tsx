import { useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { useActivities } from '../hooks/queries'
import { useAuth } from '../hooks/useAuth'
import PresetPicker from '../components/PresetPicker'
import ActivityForm from '../components/ActivityForm'
import { Spinner, ErrorNote } from '../components/ui'
import { useSampleData } from '../hooks/useSampleData'

export default function OnboardingPage() {
  const navigate = useNavigate()
  const { signOut, mode } = useAuth()
  const { data, isLoading } = useActivities()
  const [custom, setCustom] = useState(false)
  const sample = useSampleData()

  if (isLoading) return <div className="min-h-screen bg-slate-900 flex items-center justify-center"><Spinner /></div>
  if (data?.length) return <Navigate to="/" replace />

  return (
    <div className="min-h-screen bg-slate-900 text-white">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-10">
        <div className="flex justify-between items-start mb-8">
          <div>
            <p className="text-emerald-400 font-semibold mb-1">Welcome to Momentum</p>
            <h1 className="text-3xl font-bold">What do you want to build up?</h1>
            <p className="text-slate-400 mt-2">Pick a few to start. You can change these any time.</p>
          </div>
          {mode === 'supabase' && <button onClick={signOut} className="text-sm text-slate-500 hover:text-white">Sign out</button>}
        </div>
        <div className="bg-slate-800/70 border border-slate-700/50 rounded-2xl p-5 sm:p-6">
          {custom ? (
            <ActivityForm onDone={() => setCustom(false)} />
          ) : (
            <>
              <PresetPicker cta="Start tracking" onAdded={() => navigate('/', { replace: true })} />
              <div className="mt-4 flex flex-wrap gap-x-6 gap-y-2 text-sm">
                <button className="text-slate-400 hover:text-white" onClick={() => setCustom(true)}>
                  Or create your own activity →
                </button>
                <button className="text-emerald-400 hover:text-emerald-300 disabled:opacity-50" disabled={!!sample.busy}
                  onClick={async () => { await sample.load(); navigate('/', { replace: true }) }}>
                  {sample.busy ? 'Loading sample data…' : 'Just exploring? Load sample data →'}
                </button>
              </div>
              <div className="mt-2"><ErrorNote error={sample.error} /></div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
