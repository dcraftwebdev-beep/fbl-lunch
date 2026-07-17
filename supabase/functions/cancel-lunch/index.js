// cancel-lunch — the public link inside the member's confirmation email.
// GET ?token=<cancel_token>  → deletes today's entry, notifies the chef (−1)
// if the main list already went out, and shows a friendly HTML page.
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
import { admin, sendEmail, shell, todayIST, nextLunchDateIST, orderWindowOpen, htmlPage, chefListSent } from '../_shared/lib.js'

Deno.serve(async (req) => {
  // Email scanners prefetch links with HEAD — answer empty, cancel
  // nothing, so a scanner can't silently remove someone's plate.
  if (req.method === 'HEAD') return new Response(null, { status: 200 })

  try {
    const token = new URL(req.url).searchParams.get('token')
    if (!token) {
      return htmlPage('Missing link', 'Open the button from your email again.', false)
    }

    const db = admin()
    const date = todayIST()

    const { data: entry } = await db
      .from('lunch_entries')
      .select('id, member_id, lunch_date')
      .eq('cancel_token', token)
      .maybeSingle()

    if (!entry) {
      return htmlPage('Already cancelled', 'Nothing more to do.', true)
    }
    // Cancelling is allowed ONLY while the order window is open
    // (5:00–6:30 PM the evening before) and only for the upcoming
    // lunch day. After 6:30 PM the plate is locked.
    if (!(entry.lunch_date === nextLunchDateIST() && orderWindowOpen())) {
      return htmlPage('Too late to cancel', 'Window (5:00–6:30 PM) closed — plate is locked and will be cooked. 🍛', false)
    }

    const { data: member } = await db.from('members').select('name, food_pref').eq('id', entry.member_id).single()
    await db.from('lunch_entries').delete().eq('id', entry.id)

    // Tell the chef, but only if the 11:00 list already went out
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

    return htmlPage(
      `Lunch cancelled, ${member?.name ?? 'done'}`,
      'Plate is off the list. Rebook via the 5 PM email till 6:30 PM.'
    )
  } catch (err) {
    console.error(err)
    return htmlPage('Something went wrong', 'Try the link once more.', false)
  }
})