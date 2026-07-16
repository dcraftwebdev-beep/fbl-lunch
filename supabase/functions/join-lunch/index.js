// join-lunch — the public link behind the 10:00 invite button.
// GET ?m=<member_id>&d=<date>&s=<hmac>  → verifies the signed link,
// inserts today's lunch entry (idempotent), tells the chef (+1) if the
// 11:00 list already went out, and shows a friendly HTML page.
//
// DEPLOY WITH:  supabase functions deploy join-lunch --no-verify-jwt
// (the button opens in a plain browser with no auth header — without
//  this flag Supabase's gateway blocks it before your code runs)
import {
  admin,
  sendEmail,
  shell,
  todayIST,
  htmlPage,
  verifyJoin,
  chefListSent,
} from '../_shared/lib.js'

Deno.serve(async (req) => {
  // Email scanners often prefetch links with HEAD — answer empty,
  // change nothing, so a scanner can't register anyone.
  if (req.method === 'HEAD') return new Response(null, { status: 200 })

  try {
    const url = new URL(req.url)
    const memberId = url.searchParams.get('m')
    const date = url.searchParams.get('d')
    const sig = url.searchParams.get('s')

    if (!memberId || !date || !sig) {
      return htmlPage('Broken link', 'This lunch link is incomplete. Open the button from your email again.', false)
    }
    if (!(await verifyJoin(memberId, date, sig))) {
      return htmlPage('Invalid link', 'This lunch link is not valid. Use the button from today\'s email.', false)
    }
    if (date !== todayIST()) {
      return htmlPage('Link expired', 'This button was for a previous day. Wait for today\'s 10 AM email, or ask the register admin to add you.', false)
    }

    const db = admin()

    const { data: member } = await db
      .from('members')
      .select('id, name, email, food_pref, active')
      .eq('id', memberId)
      .maybeSingle()

    if (!member || !member.active) {
      return htmlPage('Not on the roster', 'This account is not on the active roster. Ask the register admin to add you back.', false)
    }

    // Already in? Say so warmly, change nothing.
    const { data: existing } = await db
      .from('lunch_entries')
      .select('id')
      .eq('member_id', member.id)
      .eq('lunch_date', date)
      .maybeSingle()

    if (existing) {
      return htmlPage(
        `Already on the list, ${member.name}`,
        'Your plate for today was already marked. The kitchen has you covered — nothing more to do.'
      )
    }

    const { error: insErr } = await db
      .from('lunch_entries')
      .insert({ member_id: member.id, lunch_date: date })
    if (insErr) throw insErr

    // If the 11:00 chef list already went out (late click), send a +1.
    const { data: settings } = await db.from('app_settings').select('chef_email').eq('id', 1).single()
    if (settings?.chef_email && (await chefListSent(db, date))) {
      const { count } = await db
        .from('lunch_entries')
        .select('*', { count: 'exact', head: true })
        .eq('lunch_date', date)
      await sendEmail(
        settings.chef_email,
        `Lunch +1: ${member.name} — now ${count} plates`,
        shell('Lunch update: +1', `<p><b>${member.name}</b> (${member.food_pref === 'veg' ? '🟢 veg' : '🔴 non-veg'}) joined via the email button after the 11:00 list.</p>
          <p style="font-size:17px">New team count: <b>${count ?? '?'} plates</b>.</p>`)
      )
    }

    return htmlPage(
      `You're in, ${member.name} 🍛`,
      `Your ${member.food_pref === 'veg' ? 'veg' : 'non-veg'} plate for today is on the register. A confirmation with a cancel button lands in your inbox at 11 — plans change, no stress.`
    )
  } catch (err) {
    console.error(err)
    return htmlPage('Something went wrong', 'That click did not go through. Try the button once more, or tell the register admin.', false)
  }
})