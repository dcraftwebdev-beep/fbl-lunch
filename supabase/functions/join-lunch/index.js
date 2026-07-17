// join-lunch — the public link behind the 5 PM evening invite button.
// GET ?m=<member_id>&d=<date>&s=<hmac>  → verifies the signed link,
// inserts the lunch entry for that date — TOMORROW from the evening
// invite, or today for same-day links (idempotent), tells the chef
// (+1) if the 11:00 list already went out, and shows a friendly page.
//
// DEPLOY WITH:  supabase functions deploy join-lunch --no-verify-jwt
// (the button opens in a plain browser with no auth header — without
//  this flag Supabase's gateway blocks it before your code runs)
import {
  admin,
  sendEmail,
  shell,
  nextLunchDateIST,
  orderWindowOpen,
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
      return htmlPage('Broken link', 'Open the button from your email again.', false)
    }
    if (!(await verifyJoin(memberId, date, sig))) {
      return htmlPage('Invalid link', 'Use the button from the latest email.', false)
    }
    if (date !== nextLunchDateIST()) {
      return htmlPage('Link expired', 'Old link. Wait for the next 5 PM email.', false)
    }
    if (!orderWindowOpen()) {
      return htmlPage('Ordering closed', 'Window is 5:00–6:30 PM. Closed for this lunch.', false)
    }
    const dayWord = 'tomorrow'

    const db = admin()

    const { data: member } = await db
      .from('members')
      .select('id, name, email, food_pref, active')
      .eq('id', memberId)
      .maybeSingle()

    if (!member || !member.active) {
      return htmlPage('Not on the roster', 'Ask the register admin to add you back.', false)
    }

    // Already in? Say so warmly, change nothing.
    const { data: existing } = await db
      .from('lunch_entries')
      .select('id')
      .eq('member_id', member.id)
      .eq('lunch_date', date)
      .maybeSingle()

    if (existing) {
      return htmlPage(`Already on the list, ${member.name}`, `Your ${dayWord} plate (${date}) is already marked. 🍛`)
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
      `${member.food_pref === 'veg' ? 'Veg' : 'Non-veg'} plate booked for ${dayWord} (${date}).`
    )
  } catch (err) {
    console.error(err)
    return htmlPage('Something went wrong', 'Try the button once more.', false)
  }
})