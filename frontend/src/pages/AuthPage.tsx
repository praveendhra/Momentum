import { useCallback, useState, type FormEvent } from 'react'
import { Navigate } from 'react-router-dom'
import type { Provider } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { btnGhost, btnPrimary, ErrorNote, inputCls } from '../components/ui'
import GoogleSignIn, { googleIdentityAvailable } from '../components/GoogleSignIn'
import { usePreferences } from '../hooks/usePreferences'

// Social providers must also be enabled in Supabase → Authentication → Providers.
// Set VITE_AUTH_PROVIDERS=google,github once they are.
const PROVIDERS = ((import.meta.env.VITE_AUTH_PROVIDERS as string | undefined) ?? '')
  .split(',')
  .map((p) => p.trim())
  .filter(Boolean) as Provider[]

const GoogleLogo = () => (
  <svg viewBox="0 0 48 48" className="h-5 w-5" aria-hidden>
    <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
    <path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
    <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
    <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
  </svg>
)

const GitHubLogo = () => (
  <svg viewBox="0 0 16 16" className="h-5 w-5" fill="currentColor" aria-hidden>
    <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0 0 16 8c0-4.42-3.58-8-8-8z" />
  </svg>
)

const PROVIDER_META: Partial<Record<Provider, { label: string; Logo: () => React.JSX.Element }>> = {
  google: { label: 'Google', Logo: GoogleLogo },
  github: { label: 'GitHub', Logo: GitHubLogo },
}

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
  const [gsiFailed, setGsiFailed] = useState(false)
  const { resolvedTheme } = usePreferences()
  const onGsiError = useCallback((m: string) => setError(m), [])
  const onGsiUnavailable = useCallback(() => setGsiFailed(true), [])

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
    setBusy(true)
    const { error } = await sb.auth.signInWithOAuth({ provider, options: { redirectTo: REDIRECT } })
    if (error) {
      setError(error.message)
      setBusy(false)
    }
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
                {PROVIDERS.map((p) => {
                  if (p === 'google' && googleIdentityAvailable && !gsiFailed) {
                    return (
                      <GoogleSignIn key={p} supabase={sb} theme={resolvedTheme}
                        text={mode === 'sign_up' ? 'signup_with' : 'continue_with'}
                        onError={onGsiError} onUnavailable={onGsiUnavailable} />
                    )
                  }
                  const meta = PROVIDER_META[p]
                  return (
                    <button key={p} type="button" disabled={busy} onClick={() => oauth(p)}
                      className={`${btnGhost} w-full inline-flex items-center justify-center gap-3`}>
                      {meta && <meta.Logo />}
                      Continue with {meta?.label ?? p}
                    </button>
                  )
                })}
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
