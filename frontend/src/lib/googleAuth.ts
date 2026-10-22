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
import { registerPlugin } from '@capacitor/core'
import { supabase } from './supabase'
import { isNative, WEB_URL } from './native'

/**
 * In the iOS app Google won't sign in inside the web view, so Google's page
 * opens in a system browser sheet (ASWebAuthenticationSession, see
 * ios/App/App/AppDelegate.swift). Google redirects to the website as usual; the
 * website sees a state starting with "app." and forwards the response to
 * com.praveendhra.momentum://google, which closes the sheet and returns here.
 */
const WebAuth = registerPlugin<{ start(o: { url: string; callbackScheme: string }): Promise<{ url: string }> }>('WebAuth')
const APP_SCHEME = 'com.praveendhra.momentum'
const APP_STATE_PREFIX = 'app.'

export const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined
const KEY = 'momentum.google-oidc'
const ERROR_KEY = 'momentum.google-oidc-error'

const redirectUri = () => (isNative ? WEB_URL : `${window.location.origin}${import.meta.env.BASE_URL}`)

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

/** Returns an error message, or null once signed in (or when the page is leaving for Google). */
export async function startGoogleSignIn(): Promise<string | null> {
  if (!GOOGLE_CLIENT_ID) throw new Error('Google sign-in is not configured')
  const state = (isNative ? APP_STATE_PREFIX : '') + crypto.randomUUID()
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
  const url = `https://accounts.google.com/o/oauth2/v2/auth?${params}`
  if (!isNative) {
    window.location.assign(url)
    return null
  }

  store(KEY, null)
  let callback: string
  try {
    callback = (await WebAuth.start({ url, callbackScheme: APP_SCHEME })).url
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return msg === 'canceled' ? null : `Google sign-in failed: ${msg}`
  }
  const back = new URLSearchParams(callback.split('#')[1] ?? '')
  if (back.get('error')) return back.get('error') === 'access_denied' ? null : `Google sign-in failed: ${back.get('error')}`
  const token = back.get('id_token')
  if (!token || back.get('state') !== state || !supabase) return 'Google sign-in could not be verified. Please try again.'
  const { error } = await supabase.auth.signInWithIdToken({ provider: 'google', token, nonce })
  return error ? error.message : null
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
  // Started in the iOS app: hand the response back to the app's sign-in sheet.
  if (params.get('state')?.startsWith(APP_STATE_PREFIX)) {
    window.location.replace(`${APP_SCHEME}://google#${hash}`)
    return
  }
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
