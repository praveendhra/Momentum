import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { AuthContext, type AuthUser } from '../hooks/useAuth'
import { authMode, supabase } from '../lib/supabase'
import { LOCAL_USER_ID } from '../lib/store'

const LOCAL_USER: AuthUser = { id: LOCAL_USER_ID, email: null }

export default function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient()
  const [user, setUser] = useState<AuthUser | null>(supabase ? null : LOCAL_USER)
  const [loading, setLoading] = useState(Boolean(supabase))

  useEffect(() => {
    if (!supabase) return
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session ? { id: session.user.id, email: session.user.email ?? null } : null)
      setLoading(false)
    })
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser((prev) => {
        const next = session ? { id: session.user.id, email: session.user.email ?? null } : null
        return prev?.id === next?.id ? prev : next
      })
    })
    return () => data.subscription.unsubscribe()
  }, [])

  // Never show one account's cached data to the next.
  useEffect(() => {
    queryClient.clear()
  }, [user?.id, queryClient])

  const value = useMemo(
    () => ({
      user,
      loading,
      mode: authMode,
      signOut: async () => {
        if (supabase) await supabase.auth.signOut()
        setUser(supabase ? null : LOCAL_USER)
      },
    }),
    [user, loading],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
