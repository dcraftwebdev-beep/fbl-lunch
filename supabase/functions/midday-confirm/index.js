// midday-confirm — repurposed to the 11:00 AM IST REMINDER post (Mon–Fri).
// 15 minutes before the window closes it posts today's current list into
// the Basecamp Campfire: "last chance, closes 11:15, type !lunch in".
// Deduped once per lunch date via email_log (kind: bc_reminder).
//
// DEPLOY:   supabase functions deploy midday-confirm
// SCHEDULE: cron `30 5 * * 1-5`  (05:30 UTC = 11:00 IST, Mon–Fri)
import {
  admin,
  cors,
  json,
  todayIST,
  claimSend,
  postToBasecamp,
  lunchRoster,
  rosterNamesHtml,
} from '../_shared/lib.js'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })

  try {
    const db = admin()
    const date = todayIST()

    if (!(await claimSend(db, 'bc_reminder', date))) {
      return json({ ok: true, date, skipped: 'already posted' })
    }

    const roster = await lunchRoster(db, date)
    await postToBasecamp(
      `⏰ <b>15 minutes left!</b> Lunch closes at <b>11:15 AM</b> today (${date}).<br>` +
      `${rosterNamesHtml(roster)}<br><br>` +
      `Not on the list yet? Type <b>!lunch in</b> now. Current count: <b>${roster.length}</b> plates. 🍛`
    )

    return json({ ok: true, date, plates: roster.length })
  } catch (err) {
    console.error(err)
    return json({ error: String(err) }, 500)
  }
})
