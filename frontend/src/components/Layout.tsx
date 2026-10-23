import { NavLink, Outlet } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import ReminderSync from './ReminderSync'

const NAV = [
  { to: '/', label: 'Dashboard', icon: '▦', end: true },
  { to: '/history', label: 'History', icon: '☰', end: false },
  { to: '/activities', label: 'Activities', icon: '✦', end: false },
  { to: '/settings', label: 'Settings', icon: '⚙', end: false },
]

export default function Layout() {
  const { user, signOut, mode } = useAuth()

  return (
    <div className="min-h-screen bg-slate-900 text-white pb-[calc(5rem+env(safe-area-inset-bottom))] sm:pb-0">
      {mode === 'local' && (
        <div className="bg-amber-500/10 border-b border-amber-500/20 text-amber-300 text-xs text-center py-1.5 px-4">
          Local mode: data is saved in this browser only. Configure Supabase to sync across devices.
        </div>
      )}
      <header className="border-b border-slate-800 px-4 sm:px-6 py-3 flex items-center justify-between gap-4 sticky top-0 z-30 bg-slate-900/90 backdrop-blur">
        <div className="flex items-center gap-8">
          <span className="flex items-center gap-2">
            <img src={`${import.meta.env.BASE_URL}favicon.svg`} alt="" className="h-8 w-8" />
            <span className="text-xl font-bold text-emerald-400 tracking-tight">Momentum</span>
          </span>
          <nav className="hidden sm:flex gap-1">
            {NAV.map((n) => (
              <NavLink
                key={n.to}
                to={n.to}
                end={n.end}
                className={({ isActive }) =>
                  `px-3 py-1.5 rounded-lg text-sm transition ${isActive ? 'bg-slate-800 text-white' : 'text-slate-400 hover:text-white'}`
                }
              >
                {n.label}
              </NavLink>
            ))}
          </nav>
        </div>
        <div className="flex items-center gap-3 min-w-0">
          <span className="text-sm text-slate-400 truncate hidden md:inline">{user?.email}</span>
          {mode === 'supabase' && (
            <button onClick={signOut} className="text-sm text-slate-400 hover:text-white transition whitespace-nowrap">
              Sign out
            </button>
          )}
        </div>
      </header>

      <ReminderSync />
      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        <Outlet />
      </main>

      <nav className="sm:hidden fixed bottom-0 inset-x-0 z-40 bg-slate-900/95 backdrop-blur border-t border-slate-800 grid grid-cols-4 pb-[env(safe-area-inset-bottom)]">
        {NAV.map((n) => (
          <NavLink
            key={n.to}
            to={n.to}
            end={n.end}
            className={({ isActive }) =>
              `flex flex-col items-center gap-0.5 py-2.5 text-xs ${isActive ? 'text-emerald-400' : 'text-slate-400'}`
            }
          >
            <span className="text-lg leading-none" aria-hidden>{n.icon}</span>
            {n.label}
          </NavLink>
        ))}
      </nav>
    </div>
  )
}
