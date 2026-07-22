// dashboard-auth — verifies the dashboard username + password server-side.
//
// The credentials live in the app_auth table, which the public anon key
// cannot read (RLS on, no policies). This function uses the service-role
// key to check them, so the hash never reaches the browser.
//
// Actions (POST JSON):
//   { action: 'status' }                     → { configured: bool }
//   { action: 'login', username, password }  → { ok: bool }
//   { action: 'reset', current, next }       → { ok: bool, error? }
//
// DEFAULT CREDENTIALS (see migration-v8):  admin / firebrand2026
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
    const { action = 'login', username, password, current, next } = await req.json().catch(() => ({}))
    const db = admin()

    // select('*') so this never breaks if the username column isn't there yet
    const { data: row } = await db.from('app_auth').select('*').eq('id', 1).maybeSingle()
    const stored = row?.password_hash || null

    if (action === 'status') {
      return json({ configured: Boolean(stored) })
    }

    // Change password: needs the current one, keeps the username.
    if (action === 'reset') {
      if (!next || String(next).length < 4) {
        return json({ ok: false, error: 'New password must be at least 4 characters.' }, 400)
      }
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
      return json({ ok: false, error: 'No dashboard password is set. Run migration-v8.sql.' }, 409)
    }
    // Username is enforced only when the row has one AND the client sends one,
    // so an older frontend that only sends a password still works.
    const sentUser = String(username ?? '').trim()
    const userOk = !row.username || !sentUser
      || sentUser.toLowerCase() === String(row.username).trim().toLowerCase()
    const passOk = (await sha256Hex(password)) === stored
    return json({ ok: userOk && passOk })
  } catch (err) {
    console.error(err)
    const msg = err?.message || err?.hint || JSON.stringify(err)
    return json({ ok: false, error: msg }, 500)
  }
})
