import { createContext, useContext } from 'react'

export interface AuthUser {
  id: string
  email: string | null
}

export interface AuthContextValue {
  user: AuthUser | null
  loading: boolean
  mode: 'supabase' | 'local'
  signOut: () => Promise<void>
}

export const AuthContext = createContext<AuthContextValue | null>(null)

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>')
  return ctx
}
