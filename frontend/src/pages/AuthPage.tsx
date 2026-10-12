import { Navigate } from 'react-router-dom'
import { Auth } from '@supabase/auth-ui-react'
import { ThemeSupa } from '@supabase/auth-ui-shared'
import type { Provider } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'

// Social providers must also be enabled in Supabase → Authentication → Providers.
// Set VITE_AUTH_PROVIDERS=google,github once they are.
const PROVIDERS = ((import.meta.env.VITE_AUTH_PROVIDERS as string | undefined) ?? '')
  .split(',')
  .map((p) => p.trim())
  .filter(Boolean) as Provider[]

// Where Supabase sends people back to after email confirmation / OAuth.
const REDIRECT = `${window.location.origin}${import.meta.env.BASE_URL}`

export default function AuthPage() {
  const { user } = useAuth()
  if (user || !supabase) return <Navigate to="/" replace />

  return (
    <div className="flex items-center justify-center min-h-screen bg-slate-900 px-4">
      <div className="w-full max-w-md py-10">
        <h1 className="text-3xl font-bold text-white text-center mb-2">Momentum</h1>
        <p className="text-slate-400 text-center mb-8">Small daily wins, made visible.</p>
        <div className="bg-slate-800 rounded-2xl p-6 shadow-lg border border-slate-700/50">
          <Auth
            supabaseClient={supabase}
            appearance={{
              theme: ThemeSupa,
              variables: { default: { colors: { brand: '#10b981', brandAccent: '#059669' } } },
            }}
            providers={PROVIDERS}
            redirectTo={REDIRECT}
            theme="dark"
          />
        </div>
      </div>
    </div>
  )
}
