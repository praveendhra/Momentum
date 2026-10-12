import { useState, type FormEvent } from 'react'
import { Navigate } from 'react-router-dom'
import type { Provider } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { btnGhost, btnPrimary, ErrorNote, inputCls } from '../components/ui'

// Social providers must also be enabled in Supabase → Authentication → Providers.
// Set VITE_AUTH_PROVIDERS=google,github once they are.
const PROVIDERS = ((import.meta.env.VITE_AUTH_PROVIDERS as string | undefined) ?? '')
  .split(',')
  .map((p) => p.trim())
  .filter(Boolean) as Provider[]

// Where Supabase sends people back to after email confirmation / OAuth / reset.
const REDIRECT = `${window.location.origin}${import.meta.env.BASE_URL}`

type Mode = 'sign_in' | 'sign_up' | 'reset'

const TITLES: Record<Mode, string> = { sign_in: 'Sign in', sign_up: 'Create account', reset: 'Reset password' }

export default function AuthPage() {
  const { user } = useAuth()
  const [mode, setMode] = useState<Mode>('sign_in')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  if (user || !supabase) return <Navigate to="/" replace />
  const sb = supabase

  async function submit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    setNotice(null)
    try {
      if (mode === 'sign_in') {
        const { error } = await sb.auth.signInWithPassword({ email, password })
        if (error) throw error
      } else if (mode === 'sign_up') {
        const { data, error } = await sb.auth.signUp({ email, password, options: { emailRedirectTo: REDIRECT } })
        if (error) throw error
        if (!data.session) setNotice('Check your inbox for a confirmation link, then come back and sign in.')
      } else {
        const { error } = await sb.auth.resetPasswordForEmail(email, { redirectTo: REDIRECT })
        if (error) throw error
        setNotice('If that email has an account, a reset link is on its way.')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  async function oauth(provider: Provider) {
    setError(null)
    const { error } = await sb.auth.signInWithOAuth({ provider, options: { redirectTo: REDIRECT } })
    if (error) setError(error.message)
  }

  const switchTo = (m: Mode) => {
    setMode(m)
    setError(null)
    setNotice(null)
  }

  return (
    <div className="flex items-center justify-center min-h-screen bg-slate-900 px-4 text-white">
      <div className="w-full max-w-sm py-10">
        <div className="flex justify-center mb-4">
          <img src={`${import.meta.env.BASE_URL}favicon.svg`} alt="" className="h-12 w-12" />
        </div>
        <h1 className="text-3xl font-bold text-center mb-1">Momentum</h1>
        <p className="text-slate-400 text-center mb-8">Small daily wins, made visible.</p>

        <div className="bg-slate-800 rounded-2xl p-6 shadow-lg border border-slate-700/50">
          <h2 className="text-lg font-semibold mb-4">{TITLES[mode]}</h2>

          {PROVIDERS.length > 0 && mode !== 'reset' && (
            <>
              <div className="space-y-2">
                {PROVIDERS.map((p) => (
                  <button key={p} type="button" className={`${btnGhost} w-full capitalize`} onClick={() => oauth(p)}>
                    Continue with {p}
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-3 my-4 text-xs text-slate-500">
                <span className="h-px flex-1 bg-slate-700" /> or <span className="h-px flex-1 bg-slate-700" />
              </div>
            </>
          )}

          <form onSubmit={submit} className="space-y-3">
            <label className="block">
              <span className="block text-sm text-slate-300 mb-1">Email</span>
              <input type="email" required autoComplete="email" className={inputCls} value={email} onChange={(e) => setEmail(e.target.value)} />
            </label>
            {mode !== 'reset' && (
              <label className="block">
                <span className="block text-sm text-slate-300 mb-1">Password</span>
                <input type="password" required minLength={6} className={inputCls} value={password}
                  autoComplete={mode === 'sign_up' ? 'new-password' : 'current-password'}
                  onChange={(e) => setPassword(e.target.value)} />
              </label>
            )}
            <ErrorNote error={error} />
            {notice && <p className="text-sm text-emerald-300" role="status">{notice}</p>}
            <button type="submit" className={`${btnPrimary} w-full`} disabled={busy}>
              {busy ? 'Please wait…' : mode === 'sign_in' ? 'Sign in' : mode === 'sign_up' ? 'Create account' : 'Send reset link'}
            </button>
          </form>

          <div className="mt-4 text-sm text-slate-400 space-y-1 text-center">
            {mode === 'sign_in' ? (
              <>
                <p>New here? <button className="text-emerald-400 hover:underline" onClick={() => switchTo('sign_up')}>Create an account</button></p>
                <p><button className="hover:text-white" onClick={() => switchTo('reset')}>Forgot your password?</button></p>
              </>
            ) : (
              <p>Already have an account? <button className="text-emerald-400 hover:underline" onClick={() => switchTo('sign_in')}>Sign in</button></p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
