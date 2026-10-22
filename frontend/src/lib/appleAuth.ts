/**
 * "Sign in with Apple" for the iOS app and the website.
 *
 * iOS shows Apple's native sheet (Face ID / passcode); the website opens
 * Apple's popup (Sign in with Apple JS). Either way we get an identity token
 * and exchange it with Supabase via signInWithIdToken, so no Apple client
 * secret (which expires every 6 months) is needed. Apple embeds the hashed
 * nonce in the token; Supabase hashes the raw nonce and compares.
 */
import { SignInWithApple } from '@capacitor-community/apple-sign-in'
import { supabase } from './supabase'
import { isNative } from './native'

// The app uses its bundle ID; the website uses the Services ID registered for momentum.praveendhra.com.
export const APPLE_CLIENT_ID = isNative ? 'com.praveendhra.momentum' : 'com.praveendhra.momentum.web'
const REDIRECT_URI = 'https://momentum.praveendhra.com/'

// Apple's web popup only works on the registered domain, once the Services ID exists (VITE_APPLE_WEB=1).
export const appleSignInAvailable =
  isNative || (import.meta.env.VITE_APPLE_WEB === '1' && window.location.hostname === 'momentum.praveendhra.com')

/** Apple's web SDK rejects with plain objects like { error: 'popup_closed_by_user' }. */
function describe(err: unknown): string {
  if (err instanceof Error) return err.message
  if (err && typeof err === 'object' && 'error' in err) return String((err as { error: unknown }).error)
  return String(err)
}
const cancelled = (msg: string) => /1001|cancel|popup_closed|user_trigger/i.test(msg)

async function sha256Hex(text: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

/** Returns null on success, or a message to show. Cancelling returns null silently. */
export async function signInWithApple(): Promise<string | null> {
  if (!supabase) return 'Sign-in is not configured'
  const nonce = crypto.randomUUID()
  let res
  try {
    res = await SignInWithApple.authorize({
      clientId: APPLE_CLIENT_ID,
      redirectURI: REDIRECT_URI,
      scopes: 'email name',
      nonce: await sha256Hex(nonce),
    })
  } catch (err) {
    const msg = describe(err)
    // 1001 (iOS) / popup_closed_by_user (web) = the user closed Apple's sheet.
    return cancelled(msg) ? null : `Sign in with Apple failed: ${msg}`
  }
  const { identityToken, givenName, familyName } = res.response
  const { error } = await supabase.auth.signInWithIdToken({ provider: 'apple', token: identityToken, nonce })
  if (error) return error.message
  // Apple only shares the name on the very first sign-in, so keep it.
  const fullName = [givenName, familyName].filter(Boolean).join(' ')
  if (fullName) void supabase.auth.updateUser({ data: { full_name: fullName } })
  return null
}

/**
 * Ask Apple for a fresh authorization code (Face ID / passcode) so the server
 * can revoke this app's Sign in with Apple tokens when the account is deleted.
 * Returns null if the user cancels or it isn't available.
 */
export async function appleAuthorizationCode(): Promise<string | null> {
  if (!appleSignInAvailable) return null
  try {
    const res = await SignInWithApple.authorize({ clientId: APPLE_CLIENT_ID, redirectURI: REDIRECT_URI })
    return res.response.authorizationCode || null
  } catch {
    return null
  }
}
