// last-call — scheduled at 18:15 IST (12:45 UTC), Sun–Thu.
// Posts a "15 minutes left!" reminder into the Basecamp Campfire so
// stragglers can type !lunch in before the order window closes at
// 6:30 PM (orders are for the NEXT working lunch day).
// Skips posting when everyone active is already in (no spam).
// Deduped once per lunch date via email_log (kind: bc_lastcall).
//
// DEPLOY:   supabase functions deploy last-call
// SCHEDULE: cron `45 12 * * 0-4`  (12:45 UTC = 18:15 IST, Sun–Thu)
import {
  admin,
  cors,
  json,
  nextLunchDateIST,
  claimSend,
  postToBasecamp,
} from '../_shared/lib.js'

const LAST_CALL_LINES = [
  '🚨 15 min left. <b>!lunch in</b> or starve by choice.',
  '⏳ 6:30 and the window shuts. <b>!lunch in</b> before it does.',
  '🔔 Doors shut at 6:30. <b>!lunch in</b> — no plate, no pity.',
  '⏰ 15 minutes. After that, the bot stops listening. <b>!lunch in</b>.',
  '🍛 Last call for tomorrow\'s rice. <b>!lunch in</b>, now or never.',
]
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })

  try {
    const db = admin()
    // Reminder is about the NEXT lunch day (tomorrow / Monday)
    const date = nextLunchDateIST()

    // Once per day, even if the cron fires twice
    if (!(await claimSend(db, 'bc_lastcall', date))) {
      return json({ ok: true, date, skipped: 'already posted' })
    }

    const [{ data: members }, { data: entries }] = await Promise.all([
      db.from('members').select('id').eq('active', true),
      db.from('lunch_entries').select('member_id').eq('lunch_date', date),
    ])

    const inSet = new Set((entries ?? []).map((e) => e.member_id))
    const notIn = (members ?? []).filter((m) => !inSet.has(m.id)).length

    // Everyone's already in? Stay quiet — nothing to remind.
    if (notIn === 0) {
      return json({ ok: true, date, skipped: 'everyone already in' })
    }

    const line = LAST_CALL_LINES[Math.floor(Math.random() * LAST_CALL_LINES.length)]
    await postToBasecamp(`${line}<br><b>${entries?.length ?? 0}</b> plates · <b>${notIn}</b> undecided. 👀`)

    return json({ ok: true, date, posted: true, plates: entries?.length ?? 0, not_in: notIn })
  } catch (err) {
    console.error(err)
    return json({ error: String(err) }, 500)
  }
})