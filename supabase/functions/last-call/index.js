// last-call — the 5:00 PM CLOSE / finalise post (Sun to Thu). Ordering for
// tomorrow closes now. This posts tomorrow's final lunch list into the
// Basecamp Campfire so everyone can see the count going to the kitchen.
// The chef's list is emailed separately by send-chef-list at the same time.
// Deduped once per lunch date via email_log (kind: bc_finalise).
//
// SCHEDULE: cron `30 11 * * 0-4`  (11:30 UTC = 5:00 PM IST, Sun to Thu)
import {
  admin,
  cors,
  json,
  fmtDate,
  claimSend,
  postToBasecamp,
  lunchRoster,
  rosterNamesHtml,
  isNoCookingDay,
  nextLunchDateIST,
} from '../_shared/lib.js'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })

  try {
    const db = admin()
    const date = nextLunchDateIST() // tomorrow

    if (await isNoCookingDay(db, date)) {
      return json({ ok: true, date, skipped: 'no_cooking' })
    }
    if (!(await claimSend(db, 'bc_finalise', date))) {
      return json({ ok: true, date, skipped: 'already posted' })
    }

    const roster = await lunchRoster(db, date)
    await postToBasecamp(
      `🔒 <b>Tomorrow's lunch list (${fmtDate(date)}) is final.</b><br>` +
      `${rosterNamesHtml(roster)}<br><br>` +
      `<b>${roster.length}</b> plates going to the kitchen. Ordering reopens at 4:00 PM tomorrow. 🍛`
    )

    return json({ ok: true, date, plates: roster.length })
  } catch (err) {
    console.error(err)
    return json({ error: String(err) }, 500)
  }
})
