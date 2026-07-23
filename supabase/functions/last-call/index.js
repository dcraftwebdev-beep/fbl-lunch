// last-call — repurposed to the 11:15 AM IST FINALISE post (Mon–Fri).
// At 11:15 the order window closes. This posts TODAY's final lunch list
// into the Basecamp Campfire so everyone can see the count that's going
// to the kitchen. The chef's final list is emailed separately by the
// send-chef-list cron at the same time.
// Deduped once per lunch date via email_log (kind: bc_finalise).
//
// DEPLOY:   supabase functions deploy last-call
// SCHEDULE: cron `45 5 * * 1-5`  (05:45 UTC = 11:15 IST, Mon–Fri)
import {
  admin,
  cors,
  json,
  todayIST,
  fmtDate,
  claimSend,
  postToBasecamp,
  lunchRoster,
  rosterNamesHtml,
  isNoCookingDay,
} from '../_shared/lib.js'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })

  try {
    const db = admin()
    const date = todayIST()

    if (await isNoCookingDay(db, date)) {
      return json({ ok: true, date, skipped: 'no_cooking' })
    }
    if (!(await claimSend(db, 'bc_finalise', date))) {
      return json({ ok: true, date, skipped: 'already posted' })
    }

    const roster = await lunchRoster(db, date)
    await postToBasecamp(
      `🔒 <b>Today's lunch list (${fmtDate(date)}) — final</b><br>` +
      `${rosterNamesHtml(roster)}<br><br>` +
      `<b>${roster.length}</b> plates going to the kitchen. Window reopens tomorrow morning. 🍛`
    )

    return json({ ok: true, date, plates: roster.length })
  } catch (err) {
    console.error(err)
    return json({ error: String(err) }, 500)
  }
})
