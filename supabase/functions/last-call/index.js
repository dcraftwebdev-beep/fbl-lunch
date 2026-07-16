// last-call — scheduled at 11:10 IST (05:40 UTC).
// Posts a "5 minutes left!" reminder into the Basecamp Campfire so
// stragglers can type !lunch in before the 11:15 cutoff.
// Skips posting on days when everyone active is already in (no spam).
// Deduped once per day via email_log (kind: bc_lastcall).
//
// DEPLOY:   supabase functions deploy last-call
// SCHEDULE: cron `40 5 * * *`  (05:40 UTC = 11:10 IST)
import {
  admin,
  cors,
  json,
  todayIST,
  claimSend,
  postToBasecamp,
} from '../_shared/lib.js'

const LAST_CALL_LINES = [
  '🚨 LAST CALL! 5 minutes to 11:15. Type <b>!lunch in</b> NOW or spend the afternoon smelling everyone else\'s lunch.',
  '⏳ 5 minutes left on the register! <b>!lunch in</b> — faster than deciding what to order outside, cheaper too.',
  '🏃 T-minus 5 minutes. The kitchen gate closes at 11:15. <b>!lunch in</b> — your stomach is watching this chat.',
  '🔔 Final boarding call for lunch! Doors close 11:15. Type <b>!lunch in</b> — no plate, no pity.',
  '⏰ 5 minutes, people. After 11:15 the bot becomes very funny about saying no. <b>!lunch in</b> while you still can.',
  '🍛 Last 5 minutes! The rice is warming up, the countdown is real. <b>!lunch in</b> before 11:15 or hold your hunger till dinner.',
]

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })

  try {
    const db = admin()
    const date = todayIST()

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
    await postToBasecamp(
      `${line}<br>Current count: <b>${entries?.length ?? 0}</b> plates · <b>${notIn}</b> of you still undecided. 👀`
    )

    return json({ ok: true, date, posted: true, plates: entries?.length ?? 0, not_in: notIn })
  } catch (err) {
    console.error(err)
    return json({ error: String(err) }, 500)
  }
})