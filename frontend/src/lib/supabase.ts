import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

function looksConfigured(url?: string, key?: string): boolean {
  return Boolean(url && key && !url.includes('your-') && !key.endsWith('_xxx') && !key.startsWith('your-'))
}

/**
 * Supabase client, or null when the app runs in local mode
 * (no VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY configured).
 */
export const supabase: SupabaseClient | null = looksConfigured(supabaseUrl, supabaseAnonKey)
  ? createClient(supabaseUrl!, supabaseAnonKey!)
  : null

export const authMode: 'supabase' | 'local' = supabase ? 'supabase' : 'local'
