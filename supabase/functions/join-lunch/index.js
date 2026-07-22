// join-lunch — the public "add me to today's lunch" action.
//
// DUAL-MODE, so the email button works no matter how it's opened:
//   • GET  ?m=<id>&d=<date>&s=<hmac>   (button opens directly in a
//          browser) → verifies, inserts, returns a friendly HTML page.
//   • POST { m, d, s } (the /join React page fetches it) → same logic,
//          returns JSON { ok, status, name, message } for the page.
// Inserts today's entry (idempotent) and tells the chef (+1) if the
// 11:15 list already went out.
//
// DEPLOY WITH:  supabase functions deploy join-lunch --no-verify-jwt
// (the button opens in a plain browser with no auth header — without
//  this flag Supabase's gateway blocks it before your code runs)
import {
  admin,
  cors,
  json,
  sendEmail,
  shell,
  todayIST,
  orderWindowOpen,
  htmlPage,
  verifyJoin,
  chefListSent,
} from '../_shared/lib.js'

Deno.serve(async (req) => {
  // Email scanners often prefetch links with HEAD — answer empty,
  // change nothing, so a scanner can't register anyone.
  if (req.method === 'HEAD') return new Response(null, { status: 200 })
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })

  // Params come from the query (GET link) or the JSON body (POST fetch).
  const isPost = req.method === 'POST'
  let m, d, s
  if (isPost) {
    const body = await req.json().catch(() => ({}))
    ;({ m, d, s } = body)
  } else {
    const url = new URL(req.url)
    m = url.searchParams.get('m')
    d = url.searchParams.get('d')
    s = url.searchParams.get('s')
  }

  // Reply in the caller's language: JSON for the app fetch, HTML for a browser.
  const reply = (ok, title, msg, extra = {}) =>
    isPost ? json({ ok, message: msg, ...extra }) : htmlPage(title, msg, ok)

  try {
    if (!m || !d || !s) {
      return reply(false, 'Broken link', "Open the button from today's email again.")
    }
    if (!(await verifyJoin(m, d, s))) {
      return reply(false, 'Invalid link', 'Use the button from the latest email.')
    }
    // The link is only valid for TODAY's lunch (same-day ordering).
    if (d !== todayIST()) {
      return reply(false, 'Link expired', 'Old link — it was only good for its own lunch day.')
    }
    if (!orderWindowOpen()) {
      return reply(false, 'Ordering closed', 'The window closes at 11:15 AM. Come back tomorrow morning.')
    }

    const db = admin()

    const { data: member } = await db
      .from('members')
      .select('id, name, email, food_pref, active')
      .eq('id', m)
      .maybeSingle()

    if (!member || !member.active) {
      return reply(false, 'Not on the roster', 'Ask the register admin to add you back.')
    }

    // Already in? Say so warmly, change nothing.
    const { data: existing } = await db
      .from('lunch_entries')
      .select('id')
      .eq('member_id', member.id)
      .eq('lunch_date', d)
      .maybeSingle()

    if (existing) {
      return reply(
        true,
        `Already on the list, ${member.name}`,
        `Your plate for today (${d}) is already marked. 🍛`,
        { status: 'already', name: member.name }
      )
    }

    const { error: insErr } = await db
      .from('lunch_entries')
      .insert({ member_id: member.id, lunch_date: d })
    if (insErr) throw insErr

    // If the 11:15 chef list already went out (late click), send a +1.
    const { data: settings } = await db.from('app_settings').select('chef_email').eq('id', 1).single()
    if (settings?.chef_email && (await chefListSent(db, d))) {
      const { count } = await db
        .from('lunch_entries')
        .select('*', { count: 'exact', head: true })
        .eq('lunch_date', d)
      await sendEmail(
        settings.chef_email,
        `Lunch +1: ${member.name} — now ${count} plates`,
        shell('Lunch update: +1', `<p><b>${member.name}</b> (${member.food_pref === 'veg' ? '🟢 veg' : '🔴 non-veg'}) joined via the email button after the 11:15 list.</p>
          <p style="font-size:17px">New team count: <b>${count ?? '?'} plates</b>.</p>`)
      )
    }

    return reply(
      true,
      `You're in, ${member.name} 🍛`,
      `${member.food_pref === 'veg' ? 'Veg' : 'Non-veg'} plate booked for today (${d}).`,
      { status: 'added', name: member.name }
    )
  } catch (err) {
    console.error(err)
    return reply(false, 'Something went wrong', 'Try the button once more.')
  }
})
