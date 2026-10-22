/**
 * Native "Sign in with Apple" for the iOS app.
 *
 * iOS shows Apple's own sheet (Face ID / passcode), returns an identity token,
 * and we exchange it with Supabase via signInWithIdToken. Apple embeds the
 * hashed nonce in the token; Supabase hashes the raw nonce and compares.
 */
import { SignInWithApple } from '@capacitor-community/apple-sign-in'
import { supabase } from './supabase'
import { isNative } from './native'

export const appleSignInAvailable = isNative

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
      clientId: 'com.praveendhra.momentum',
      redirectURI: 'https://momentum.praveendhra.com/',
      scopes: 'email name',
      nonce: await sha256Hex(nonce),
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    // Code 1001 = the user closed Apple's sheet.
    return /1001|cancel/i.test(msg) ? null : `Sign in with Apple failed: ${msg}`
  }
  const { identityToken, givenName, familyName } = res.response
  const { error } = await supabase.auth.signInWithIdToken({ provider: 'apple', token: identityToken, nonce })
  if (error) return error.message
  // Apple only shares the name on the very first sign-in, so keep it.
  const fullName = [givenName, familyName].filter(Boolean).join(' ')
  if (fullName) void supabase.auth.updateUser({ data: { full_name: fullName } })
  return null
}
