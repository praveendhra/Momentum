import { Auth } from '@supabase/auth-ui-react'
import { ThemeSupa } from '@supabase/auth-ui-shared'
import { useNavigate } from 'react-router-dom'
import { useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'

export default function AuthPage() {
  const { user } = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    if (user) navigate('/', { replace: true })
  }, [user, navigate])

  return (
    <div className="flex items-center justify-center min-h-screen bg-slate-900">
      <div className="w-full max-w-md p-8">
        <h1 className="text-3xl font-bold text-white text-center mb-2">Momentum</h1>
        <p className="text-slate-400 text-center mb-8">Track your daily progress</p>
        <div className="bg-slate-800 rounded-xl p-6 shadow-lg">
          <Auth
            supabaseClient={supabase}
            appearance={{
              theme: ThemeSupa,
              variables: {
                default: {
                  colors: {
                    brand: '#10b981',
                    brandAccent: '#059669',
                  },
                },
              },
            }}
            providers={['google', 'github']}
            redirectTo={window.location.origin}
            theme="dark"
          />
        </div>
      </div>
    </div>
  )
}
