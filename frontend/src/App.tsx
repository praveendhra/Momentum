import { Routes, Route, Navigate, Outlet } from 'react-router-dom'
import { useAuth } from './hooks/useAuth'
import { useActivities } from './hooks/queries'
import Layout from './components/Layout'
import { Spinner, ErrorNote } from './components/ui'
import DashboardPage from './pages/DashboardPage'
import AuthPage from './pages/AuthPage'
import HistoryPage from './pages/HistoryPage'
import ActivitiesPage from './pages/ActivitiesPage'
import OnboardingPage from './pages/OnboardingPage'

function FullScreen({ children }: { children: React.ReactNode }) {
  return <div className="flex items-center justify-center min-h-screen bg-slate-900 px-6">{children}</div>
}

function ProtectedRoute() {
  const { user, loading } = useAuth()
  if (loading) {
    return (
      <FullScreen>
        <div className="text-emerald-400 text-lg animate-pulse">Loading Momentum…</div>
      </FullScreen>
    )
  }
  if (!user) return <Navigate to="/auth" replace />
  return <Outlet />
}

/** First-time users pick activities before they see the dashboard. */
function RequireActivities() {
  const { data, isLoading, error } = useActivities()
  if (isLoading) return <FullScreen><Spinner label="Loading your activities…" /></FullScreen>
  if (error) return <FullScreen><ErrorNote error={error} /></FullScreen>
  if (!data?.length) return <Navigate to="/welcome" replace />
  return <Outlet />
}

export default function App() {
  return (
    <Routes>
      <Route path="/auth" element={<AuthPage />} />
      <Route element={<ProtectedRoute />}>
        <Route path="/welcome" element={<OnboardingPage />} />
        <Route element={<RequireActivities />}>
          <Route element={<Layout />}>
            <Route index element={<DashboardPage />} />
            <Route path="history" element={<HistoryPage />} />
            <Route path="activities" element={<ActivitiesPage />} />
          </Route>
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
