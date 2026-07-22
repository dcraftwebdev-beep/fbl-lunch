// cancel-lunch — the public "take me off today's lunch" action.
//
// DUAL-MODE, so the cancel button works no matter how it's opened:
//   • GET  ?token=<cancel_token>  (button opens directly in a browser)
//          → deletes today's entry, returns a friendly HTML page.
//   • POST { token }  (the /cancel React page fetches it) → same logic,
//          returns JSON { ok, status, name, message } for the page.
// Notifies the chef (−1) if the main list already went out.
//
// DEPLOY WITH:  supabase functions deploy cancel-lunch --no-verify-jwt
// ─────────────────────────────────────────────────────────────────────
// THE FLAG IS THE FIX. The email button opens in a plain browser with
// no Authorization header. If the function is deployed WITHOUT
// --no-verify-jwt (or "Verify JWT" is ON in the dashboard), Supabase's
// gateway rejects the request before this code ever runs — the browser
// shows the gateway's raw error/code instead of the styled page below.
// After deploying with the flag, confirm in Dashboard → Edge Functions
// → cancel-lunch → Details that "Verify JWT" shows OFF.
// ─────────────────────────────────────────────────────────────────────
import { admin, cors, json, sendEmail, shell, todayIST, orderWindowOpen, htmlPage, chefListSent } from '../_shared/lib.js'

Deno.serve(async (req) => {
  // Email scanners prefetch links with HEAD — answer empty, cancel
  // nothing, so a scanner can't silently remove someone's plate.
  if (req.method === 'HEAD') return new Response(null, { status: 200 })
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })

  // Token comes from the query (GET link) or the JSON body (POST fetch).
  const isPost = req.method === 'POST'
  let token
  if (isPost) {
    const body = await req.json().catch(() => ({}))
    token = body.token
  } else {
    token = new URL(req.url).searchParams.get('token')
  }

  // Reply in the caller's language: JSON for the app fetch, HTML for a browser.
  const reply = (ok, title, msg, extra = {}) =>
    isPost ? json({ ok, message: msg, ...extra }) : htmlPage(title, msg, ok)

  try {
    if (!token) {
      return reply(false, 'Missing link', 'Open the button from your email again.')
    }

    const db = admin()
    const date = todayIST()

    const { data: entry } = await db
      .from('lunch_entries')
      .select('id, member_id, lunch_date')
      .eq('cancel_token', token)
      .maybeSingle()

    if (!entry) {
      return reply(true, 'Already cancelled', 'Nothing more to do.', { status: 'already' })
    }
    // Cancelling is allowed while today's window is open (till 11:15 AM).
    if (!(entry.lunch_date === date && orderWindowOpen())) {
      return reply(false, 'Too late to cancel', 'Window closed (shuts 11:15 AM) — plate is locked and will be cooked. 🍛')
    }

    const { data: member } = await db.from('members').select('name, food_pref').eq('id', entry.member_id).single()
    await db.from('lunch_entries').delete().eq('id', entry.id)

    // Tell the chef, but only if the 11:15 list already went out
    const { data: settings } = await db.from('app_settings').select('chef_email').eq('id', 1).single()
    if (settings?.chef_email && (await chefListSent(db, date))) {
      const { count } = await db
        .from('lunch_entries')
        .select('*', { count: 'exact', head: true })
        .eq('lunch_date', date)
      await sendEmail(
        settings.chef_email,
        `Lunch −1: ${member?.name ?? 'A member'} — now ${count} plates`,
        shell('Lunch update: −1', `<p><b>${member?.name ?? 'A member'}</b> cancelled via email link.</p>
          <p style="font-size:17px">New team count: <b>${count ?? '?'} plates</b>.</p>`)
      )
    }

    return reply(
      true,
      `Lunch cancelled, ${member?.name ?? 'done'}`,
      'Plate is off the list. Rebook via the email button or !lunch in — open till 11:15 AM.',
      { status: 'cancelled', name: member?.name ?? null }
    )
  } catch (err) {
    console.error(err)
    return reply(false, 'Something went wrong', 'Try the link once more.')
  }
})
