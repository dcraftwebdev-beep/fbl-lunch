// midday-confirm — the 4:30 PM LAST CALL post (Sun to Thu). 30 minutes
// before ordering closes it posts tomorrow's current list into the
// Basecamp Campfire: "last call, closes 5:00 PM, type !lunch in".
// Deduped once per lunch date via email_log (kind: bc_lastcall).
//
// SCHEDULE: cron `0 11 * * 0-4`  (11:00 UTC = 4:30 PM IST, Sun to Thu)
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
    if (!(await claimSend(db, 'bc_lastcall', date))) {
      return json({ ok: true, date, skipped: 'already posted' })
    }

    const roster = await lunchRoster(db, date)
    await postToBasecamp(
      `⏰ <b>Last call!</b> Lunch ordering for tomorrow (${fmtDate(date)}) closes at <b>5:00 PM</b>.<br>` +
      `${rosterNamesHtml(roster)}<br><br>` +
      `Not on the list yet? Type <b>!lunch in</b> now. Current count: <b>${roster.length}</b> plates. 🍛`
    )

    return json({ ok: true, date, plates: roster.length })
  } catch (err) {
    console.error(err)
    return json({ error: String(err) }, 500)
  }
})
