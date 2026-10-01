// holiday-wish — daily at 9:00 AM IST. If today is a company holiday
// (in the `holidays` table), posts a festive greeting to the Basecamp
// group. The kitchen for holiday dates is already closed via day_meta
// (seeded from the holiday list), so this only handles the greeting.
// Deduped per date via email_log (kind: bc_wish).
//
// SCHEDULE: cron `30 3 * * *`  (03:30 UTC = 9:00 AM IST, daily)
import { admin, cors, json, todayIST, fmtDate, claimSend, postToBasecamp } from '../_shared/lib.js'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })

  try {
    const db = admin()
    const date = todayIST()

    const { data: h } = await db
      .from('holidays')
      .select('name')
      .eq('holiday_date', date)
      .maybeSingle()

    if (!h) return json({ ok: true, date, holiday: false })
    if (!(await claimSend(db, 'bc_wish', date))) {
      return json({ ok: true, date, skipped: 'already wished' })
    }

    await postToBasecamp(
      `🎉 <b>Happy ${h.name}!</b><br>` +
      `Wishing everyone at Firebrand Labs a wonderful ${h.name} (${fmtDate(date)}). ` +
      `The office kitchen is closed today, enjoy the holiday. 🙏`
    )

    return json({ ok: true, date, holiday: h.name, wished: true })
  } catch (err) {
    console.error(err)
    return json({ ok: false, error: err?.message || String(err) }, 500)
  }
})
