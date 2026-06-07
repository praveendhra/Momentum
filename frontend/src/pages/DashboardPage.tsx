import { useAuth } from '../hooks/useAuth'

export default function DashboardPage() {
  const { user, signOut } = useAuth()

  return (
    <div className="min-h-screen bg-slate-900 text-white">
      {/* Top nav */}
      <header className="border-b border-slate-800 px-6 py-4 flex items-center justify-between">
        <h1 className="text-xl font-bold text-emerald-400">Momentum</h1>
        <div className="flex items-center gap-4">
          <span className="text-sm text-slate-400">{user?.email}</span>
          <button
            onClick={signOut}
            className="text-sm text-slate-400 hover:text-white transition"
          >
            Sign out
          </button>
        </div>
      </header>

      {/* Dashboard content — placeholder */}
      <main className="max-w-5xl mx-auto px-6 py-10">
        <h2 className="text-2xl font-semibold mb-6">Dashboard</h2>

        {/* Stat cards placeholder */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-10">
          {['Active Days', 'Total Sessions', 'Current Streak', 'Top Activity'].map((label) => (
            <div key={label} className="bg-slate-800 rounded-xl p-5">
              <p className="text-sm text-slate-400">{label}</p>
              <p className="text-2xl font-bold mt-1">—</p>
            </div>
          ))}
        </div>

        {/* Activity graph placeholder */}
        <div className="bg-slate-800 rounded-xl p-6 mb-10">
          <h3 className="text-lg font-medium mb-4">Activity Graph</h3>
          <p className="text-slate-500 text-sm">Activity heatmap will appear here once you start logging.</p>
        </div>

        {/* Quick log placeholder */}
        <div className="bg-slate-800 rounded-xl p-6">
          <h3 className="text-lg font-medium mb-4">Quick Log</h3>
          <p className="text-slate-500 text-sm">Your activities will appear here after onboarding.</p>
        </div>
      </main>
    </div>
  )
}
