import { useEffect, useRef } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * "Sign in with Google" via Google Identity Services, entirely on our own origin.
 *
 * The usual Supabase OAuth redirect makes Google's consent screen say
 * "to continue to <project-ref>.supabase.co". Here Google hands the browser an
 * ID token directly (popup / One Tap), so Google shows momentum.praveendhra.com
 * instead, and we pass the token to Supabase with signInWithIdToken.
 */

const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined
const GSI_SRC = 'https://accounts.google.com/gsi/client'

interface GsiCredentialResponse { credential: string }
interface Gsi {
  accounts: {
    id: {
      initialize: (o: Record<string, unknown>) => void
      renderButton: (el: HTMLElement, o: Record<string, unknown>) => void
    }
  }
}
declare global { interface Window { google?: Gsi } }

let gsiPromise: Promise<Gsi> | null = null
function loadGsi(): Promise<Gsi> {
  if (window.google?.accounts?.id) return Promise.resolve(window.google)
  gsiPromise ??= new Promise((resolve, reject) => {
    const s = document.createElement('script')
    s.src = GSI_SRC
    s.async = true
    s.onload = () => (window.google ? resolve(window.google) : reject(new Error('Google sign-in failed to load')))
    s.onerror = () => {
      gsiPromise = null
      reject(new Error('Google sign-in failed to load'))
    }
    document.head.appendChild(s)
  })
  return gsiPromise
}

async function sha256Hex(text: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

export const googleIdentityAvailable = !!CLIENT_ID

interface Props {
  supabase: SupabaseClient
  theme: 'light' | 'dark'
  text: 'signin_with' | 'signup_with' | 'continue_with'
  onError: (message: string) => void
  /** Called when GIS can't load (blocked script etc.) so the caller can fall back to the redirect flow. */
  onUnavailable: () => void
}

export default function GoogleSignIn({ supabase, theme, text, onError, onUnavailable }: Props) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!CLIENT_ID || !ref.current) return
    let cancelled = false
    const el = ref.current
    ;(async () => {
      try {
        const gsi = await loadGsi()
        // Google embeds the hashed nonce in the ID token; Supabase checks it against the raw one.
        const raw = crypto.randomUUID()
        const hashed = await sha256Hex(raw)
        if (cancelled) return
        gsi.accounts.id.initialize({
          client_id: CLIENT_ID,
          nonce: hashed,
          ux_mode: 'popup',
          use_fedcm_for_prompt: true,
          callback: async (res: GsiCredentialResponse) => {
            const { error } = await supabase.auth.signInWithIdToken({ provider: 'google', token: res.credential, nonce: raw })
            if (error) onError(error.message)
          },
        })
        gsi.accounts.id.renderButton(el, {
          type: 'standard',
          theme: theme === 'dark' ? 'filled_black' : 'outline',
          size: 'large',
          shape: 'rectangular',
          text,
          logo_alignment: 'center',
          width: Math.min(400, Math.max(200, el.offsetWidth || 320)),
        })
      } catch {
        if (!cancelled) onUnavailable()
      }
    })()
    return () => {
      cancelled = true
    }
  }, [supabase, theme, text, onError, onUnavailable])

  // Fixed height avoids a layout jump while Google's iframe loads.
  return <div ref={ref} className="w-full h-10 flex justify-center [color-scheme:normal]" />
}
