// daily-funny — the daily banter mail. Called by pg_cron shortly after the
// 11:00 chef list (e.g. 11:15 IST). Members who ordered get a light
// motivation line; members who didn't get the "don't eat outside bro" genre.
// Lines rotate by day-of-year so the message changes every day.
import {
  admin, cors, json, sendEmail, shell, todayIST, dayOfYear, claimSend,
  ORDERED_LINES, NOT_ORDERED_LINES, isNoCookingDay,
} from '../_shared/lib.js'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })

  try {
    const db = admin()
    const date = todayIST()
    const day = dayOfYear()

    if (await isNoCookingDay(db, date)) {
      return json({ ok: true, date, skipped: 'no_cooking' })
    }

    const [{ data: members }, { data: entries }] = await Promise.all([
      db.from('members').select('*').eq('active', true).neq('email', ''),
      db.from('lunch_entries').select('member_id').eq('lunch_date', date),
    ])

    const inSet = new Set((entries ?? []).map((e) => e.member_id))
    let sent = 0

    for (const m of members ?? []) {
      // once per member per day, even if the cron fires twice
      const fresh = await claimSend(db, 'daily_funny', date, m.id)
      if (!fresh) continue

      const ordered = inSet.has(m.id)
      const pool = ordered ? ORDERED_LINES : NOT_ORDERED_LINES
      // offset by a per-member number so colleagues don't all get the same line
      const line = pool[(day + m.name.length) % pool.length]

      const html = shell(
        ordered ? 'Lunch status: sorted ✅' : 'Lunch status: missing 👀',
        `<p>Hi ${m.name},</p>
         <p style="font-size:16px">${line}</p>
         ${ordered
            ? '<p style="color:#5a645c;font-size:13px">Plate\'s cooking. Carry on. 🍛</p>'
            : '<p style="color:#5a645c;font-size:13px">Next time: type <b>!lunch in</b> before 11:15 AM.</p>'}`
      )

      try {
        await sendEmail(m.email, ordered ? 'Your lunch is sorted 🍛' : 'No lunch today?? 👀', html)
        sent++
      } catch (err) {
        console.error(`daily-funny → ${m.email}:`, err)
      }
    }

    return json({ sent })
  } catch (err) {
    console.error(err)
    return json({ error: String(err) }, 500)
  }
})