// Momentum: delete the signed-in user's account (Supabase Edge Function, Deno).
//
// POST with the user's access token (Authorization: Bearer <jwt>) and an
// optional JSON body { appleAuthorizationCode }. When the user signed in with
// Apple, the app first asks Apple for a fresh authorization code and sends it
// here, so we can revoke the app's Sign in with Apple tokens as App Store
// Review Guideline 5.1.1(v) requires. Then the auth user is deleted, which
// cascades to all of their rows.
//
// Secrets (Supabase → Edge Functions → Secrets), needed only for Apple users:
//   APPLE_TEAM_ID       10-character Apple Team ID
//   APPLE_KEY_ID        Key ID of a "Sign in with Apple" key
//   APPLE_PRIVATE_KEY   Contents of that key's AuthKey_XXXX.p8 file
//   APPLE_CLIENT_ID     Optional, defaults to the app's bundle ID

import { createClient } from 'npm:@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
function serviceKey(): string {
  const legacy = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (legacy) return legacy
  try {
    const keys = JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS') ?? '{}') as Record<string, string>
    const first = keys.default ?? Object.values(keys)[0]
    if (first) return first
  } catch {
    /* fall through */
  }
  throw new Error('No Supabase service key available to the function')
}
const admin = createClient(SUPABASE_URL, serviceKey(), { auth: { persistSession: false } })

const APPLE_TEAM_ID = Deno.env.get('APPLE_TEAM_ID') ?? ''
const APPLE_KEY_ID = Deno.env.get('APPLE_KEY_ID') ?? ''
const APPLE_PRIVATE_KEY = Deno.env.get('APPLE_PRIVATE_KEY') ?? ''
const APPLE_CLIENT_ID = Deno.env.get('APPLE_CLIENT_ID') ?? 'com.praveendhra.momentum'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}
const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } })

// ─── Apple client secret: an ES256 JWT signed with the Sign in with Apple key ───

const b64url = (bytes: Uint8Array) =>
  btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
const b64urlJson = (o: unknown) => b64url(new TextEncoder().encode(JSON.stringify(o)))

async function appleClientSecret(): Promise<string> {
  const pem = APPLE_PRIVATE_KEY.replace(/-----[^-]+-----/g, '').replace(/\\n/g, '').replace(/\s+/g, '')
  const der = Uint8Array.from(atob(pem), (c) => c.charCodeAt(0))
  const key = await crypto.subtle.importKey('pkcs8', der, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign'])
  const now = Math.floor(Date.now() / 1000)
  const header = b64urlJson({ alg: 'ES256', kid: APPLE_KEY_ID })
  const payload = b64urlJson({ iss: APPLE_TEAM_ID, iat: now, exp: now + 300, aud: 'https://appleid.apple.com', sub: APPLE_CLIENT_ID })
  // WebCrypto returns the raw r||s signature JWS expects.
  const sig = new Uint8Array(await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, key, new TextEncoder().encode(`${header}.${payload}`)))
  return `${header}.${payload}.${b64url(sig)}`
}

async function appleForm(path: string, fields: Record<string, string>) {
  const res = await fetch(`https://appleid.apple.com/auth/${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(fields),
  })
  const text = await res.text()
  if (!res.ok) throw new Error(`Apple ${path} ${res.status}: ${text.slice(0, 200)}`)
  return text ? JSON.parse(text) : {}
}

/** Exchange a fresh authorization code for a refresh token, then revoke it. */
async function revokeApple(code: string) {
  if (!APPLE_TEAM_ID || !APPLE_KEY_ID || !APPLE_PRIVATE_KEY) {
    throw new Error('Sign in with Apple revocation is not configured (APPLE_TEAM_ID / APPLE_KEY_ID / APPLE_PRIVATE_KEY)')
  }
  const client_secret = await appleClientSecret()
  const tokens = await appleForm('token', { client_id: APPLE_CLIENT_ID, client_secret, code, grant_type: 'authorization_code' })
  const token = tokens.refresh_token ?? tokens.access_token
  if (!token) throw new Error('Apple returned no token to revoke')
  await appleForm('revoke', {
    client_id: APPLE_CLIENT_ID,
    client_secret,
    token,
    token_type_hint: tokens.refresh_token ? 'refresh_token' : 'access_token',
  })
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return json(405, { error: 'Use POST' })
  try {
    const jwt = req.headers.get('Authorization')?.replace(/^Bearer\s+/i, '')
    if (!jwt) return json(401, { error: 'Sign in first' })
    const { data: auth, error } = await admin.auth.getUser(jwt)
    if (error || !auth.user) return json(401, { error: 'Sign in first' })
    const user = auth.user

    const body = await req.json().catch(() => ({})) as { appleAuthorizationCode?: string }
    const providers: string[] = (user.app_metadata?.providers as string[] | undefined) ?? []
    const usesApple = providers.includes('apple') || user.identities?.some((i) => i.provider === 'apple')

    // A failed revocation must never stop someone deleting their account; it's logged instead.
    let appleRevoked = false
    if (usesApple && body.appleAuthorizationCode) {
      try {
        await revokeApple(body.appleAuthorizationCode)
        appleRevoked = true
      } catch (err) {
        console.error(`apple revoke for ${user.id}:`, err)
      }
    }

    const { error: delErr } = await admin.auth.admin.deleteUser(user.id)
    if (delErr) throw delErr
    return json(200, { deleted: true, appleRevoked })
  } catch (err) {
    console.error(err)
    return json(500, { error: String((err as Error)?.message ?? err) })
  }
})
