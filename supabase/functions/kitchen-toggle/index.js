// kitchen-toggle — the dashboard "No cooking" switch.
//
// POST { closed: true|false, reason?: string, date?: 'yyyy-mm-dd' }
//   date   defaults to the next working day (the day being ordered).
//   closed=true  → day_meta.no_cooking = true + reason, announce in Basecamp
//                  ("no office lunch on <date>, reason ..., eat outside").
//   closed=false → clears the flag + reason, announces the kitchen is back.
// Each state change announces once; flipping back re-announces.
//
// DEPLOY: supabase functions deploy kitchen-toggle
import { admin, cors, json, fmtDate, nextLunchDateIST, claimSend, postToBasecamp } from '../_shared/lib.js'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })

  try {
    const { closed, reason, date: bodyDate } = await req.json().catch(() => ({}))
    const on = !!closed
    const db = admin()
    const date = bodyDate || nextLunchDateIST()
    const why = (reason || '').toString().trim()

    const { error } = await db
      .from('day_meta')
      .upsert(
        { lunch_date: date, no_cooking: on, no_cooking_reason: on ? (why || null) : null },
        { onConflict: 'lunch_date' }
      )
    if (error) throw error

    let posted = false
    if (on) {
      await db.from('email_log').delete().eq('kind', 'bc_nocook_off').eq('lunch_date', date)
      if (await claimSend(db, 'bc_nocook_on', date)) {
        await postToBasecamp(
          `🙅 <b>No office lunch on ${fmtDate(date)}.</b><br>` +
          (why ? `Reason: ${why}.<br>` : '') +
          `The kitchen is closed that day, please plan to eat outside. 🙏`
        )
        posted = true
      }
    } else {
      await db.from('email_log').delete().eq('kind', 'bc_nocook_on').eq('lunch_date', date)
      if (await claimSend(db, 'bc_nocook_off', date)) {
        await postToBasecamp(
          `🍛 <b>Kitchen is back on for ${fmtDate(date)}.</b> ` +
          `Order with <b>!lunch in</b> during the 4:00 to 5:00 PM window.`
        )
        posted = true
      }
    }

    return json({ ok: true, date, closed: on, reason: why || null, announced: posted })
  } catch (err) {
    console.error(err)
    return json({ ok: false, error: err?.message || String(err) }, 500)
  }
})
