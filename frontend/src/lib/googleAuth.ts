/**
 * "Continue with Google" without going through <ref>.supabase.co.
 *
 * Standard Supabase OAuth makes Google's screen say "to continue to
 * <ref>.supabase.co" because Google redirects to Supabase's callback. Instead we
 * ask Google (OpenID Connect, response_type=id_token) to redirect straight back
 * to this app, so Google's screen names momentum.praveendhra.com. We then hand
 * the ID token to Supabase with signInWithIdToken. A hashed nonce ties the token
 * to this browser and a random `state` guards against CSRF.
 */
import { supabase } from './supabase'

export const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined
const KEY = 'momentum.google-oidc'
const ERROR_KEY = 'momentum.google-oidc-error'

const redirectUri = () => `${window.location.origin}${import.meta.env.BASE_URL}`

function store(key: string, value: string | null) {
  try {
    if (value === null) sessionStorage.removeItem(key)
    else sessionStorage.setItem(key, value)
  } catch { /* storage unavailable: sign-in just won't complete */ }
}
function load(key: string): string | null {
  try { return sessionStorage.getItem(key) } catch { return null }
}

async function sha256Hex(text: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

export async function startGoogleSignIn(): Promise<void> {
  if (!GOOGLE_CLIENT_ID) throw new Error('Google sign-in is not configured')
  const state = crypto.randomUUID()
  const nonce = crypto.randomUUID()
  store(KEY, JSON.stringify({ state, nonce }))
  const params = new URLSearchParams({
    client_id: GOOGLE_CLIENT_ID,
    redirect_uri: redirectUri(),
    response_type: 'id_token',
    scope: 'openid email profile',
    nonce: await sha256Hex(nonce),
    state,
    prompt: 'select_account',
  })
  window.location.assign(`https://accounts.google.com/o/oauth2/v2/auth?${params}`)
}

/** Error from the last Google round trip, shown once on the sign-in page. */
export function takeGoogleError(): string | null {
  const e = load(ERROR_KEY)
  store(ERROR_KEY, null)
  return e
}

/**
 * Call before the router mounts. If the URL fragment carries Google's response
 * (#state=…&id_token=… or #error=…), clean it up so HashRouter never sees it,
 * and exchange the token for a Supabase session.
 */
export function consumeGoogleRedirect(): void {
  const hash = window.location.hash.slice(1)
  if (!hash.includes('state=') || (!hash.includes('id_token=') && !hash.includes('error='))) return
  const params = new URLSearchParams(hash)
  history.replaceState(null, '', `${window.location.pathname}#/`)

  const saved = load(KEY)
  store(KEY, null)
  const { state, nonce } = saved ? (JSON.parse(saved) as { state: string; nonce: string }) : { state: '', nonce: '' }
  const fail = (msg: string) => {
    store(ERROR_KEY, msg)
    history.replaceState(null, '', `${window.location.pathname}#/auth`)
  }

  if (params.get('error')) {
    if (params.get('error') !== 'access_denied') fail(`Google sign-in failed: ${params.get('error')}`)
    else history.replaceState(null, '', `${window.location.pathname}#/auth`)
    return
  }
  const token = params.get('id_token')
  if (!token || !state || params.get('state') !== state || !supabase) {
    fail('Google sign-in could not be verified. Please try again.')
    return
  }
  void supabase.auth.signInWithIdToken({ provider: 'google', token, nonce }).then(({ error }) => {
    if (error) {
      fail(error.message)
      window.location.reload()
    }
  })
}
