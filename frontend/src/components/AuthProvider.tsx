import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { AuthContext, type AuthUser } from '../hooks/useAuth'
import { authMode, supabase } from '../lib/supabase'
import { LOCAL_USER_ID } from '../lib/store'
import { Modal, ErrorNote, btnPrimary, inputCls } from './ui'
import { cancelReminders } from '../lib/reminders'

const LOCAL_USER: AuthUser = { id: LOCAL_USER_ID, email: null }

export default function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient()
  const [user, setUser] = useState<AuthUser | null>(supabase ? null : LOCAL_USER)
  const [loading, setLoading] = useState(Boolean(supabase))
  const [recovering, setRecovering] = useState(false)

  useEffect(() => {
    if (!supabase) return
    // INITIAL_SESSION fires once the stored session has been restored (and, if
    // needed, refreshed). Treating auth as "loading" until then avoids briefly
    // showing the sign-in page to someone who is actually signed in.
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY') setRecovering(true)
      setUser((prev) => {
        const next = session ? { id: session.user.id, email: session.user.email ?? null } : null
        return prev?.id === next?.id ? prev : next
      })
      if (event === 'INITIAL_SESSION') setLoading(false)
    })
    return () => data.subscription.unsubscribe()
  }, [])

  // Never show one account's cached data to the next. Switching accounts always
  // passes through "signed out", and nothing data-bound is mounted then, so
  // clearing at that moment is safe. (Clearing on sign-in would wipe queries
  // the dashboard has just started and leave it loading forever.)
  useEffect(() => {
    if (!user) queryClient.clear()
  }, [user, queryClient])

  const value = useMemo(
    () => ({
      user,
      loading,
      mode: authMode,
      signOut: async () => {
        await cancelReminders().catch(() => {})
        if (supabase) await supabase.auth.signOut()
        setUser(supabase ? null : LOCAL_USER)
      },
    }),
    [user, loading],
  )

  return (
    <AuthContext.Provider value={value}>
      {children}
      {recovering && <SetPassword onDone={() => setRecovering(false)} />}
    </AuthContext.Provider>
  )
}

function SetPassword({ onDone }: { onDone: () => void }) {
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function submit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    const { error } = await supabase!.auth.updateUser({ password })
    setBusy(false)
    if (error) setError(error.message)
    else onDone()
  }

  return (
    <Modal open onClose={onDone} title="Choose a new password">
      <form onSubmit={submit} className="space-y-3">
        <input type="password" required minLength={6} autoComplete="new-password" className={inputCls}
          value={password} onChange={(e) => setPassword(e.target.value)} aria-label="New password" />
        <ErrorNote error={error} />
        <button className={`${btnPrimary} w-full`} disabled={busy}>{busy ? 'Saving…' : 'Save password'}</button>
      </form>
    </Modal>
  )
}
