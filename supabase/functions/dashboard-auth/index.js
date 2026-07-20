// dashboard-auth — verifies the dashboard login password server-side.
//
// The password hash lives in the app_auth table, which the public anon
// key cannot read (RLS on, no policies). This function uses the
// service-role key to check it, so the hash never reaches the browser.
//
// Actions (POST JSON):
//   { action: 'status' }               → { configured: bool }
//   { action: 'login',  password }     → { ok: bool }
//   { action: 'reset',  current, next} → { ok: bool, error? }
//
// DEPLOY:   supabase functions deploy dashboard-auth
// (config.toml already sets verify_jwt = false — the login page has
//  no Supabase auth token to send.)
import { admin, cors, json } from '../_shared/lib.js'

// SHA-256 hex of a string — same scheme the SQL seed uses
async function sha256Hex(text) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text ?? ''))
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })

  try {
    const { action = 'login', password, current, next } = await req.json().catch(() => ({}))
    const db = admin()

    const { data: row } = await db
      .from('app_auth')
      .select('password_hash')
      .eq('id', 1)
      .maybeSingle()

    const stored = row?.password_hash || null

    if (action === 'status') {
      return json({ configured: Boolean(stored) })
    }

    if (action === 'reset') {
      if (!next || String(next).length < 4) {
        return json({ ok: false, error: 'New password must be at least 4 characters.' }, 400)
      }
      // If a password is already set, the current one must match.
      if (stored && (await sha256Hex(current)) !== stored) {
        return json({ ok: false, error: 'Current password is wrong.' }, 401)
      }
      const password_hash = await sha256Hex(next)
      const { error } = await db
        .from('app_auth')
        .upsert({ id: 1, password_hash, updated_at: new Date().toISOString() })
      if (error) throw error
      return json({ ok: true })
    }

    // default: login
    if (!stored) {
      // No password configured yet — tell the client so it can guide setup.
      return json({ ok: false, error: 'No dashboard password is set. Run migration-v3.sql.' }, 409)
    }
    const ok = (await sha256Hex(password)) === stored
    return json({ ok })
  } catch (err) {
    console.error(err)
    return json({ ok: false, error: String(err) }, 500)
  }
})