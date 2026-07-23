// kitchen-toggle — the dashboard "No cooking today" switch.
//
// POST { closed: true|false }
//   closed=true  → day_meta.no_cooking = true, announce in Basecamp:
//                  "No office food today — eat outside".
//   closed=false → day_meta.no_cooking = false, announce kitchen is back.
// Each state change announces once; flipping back re-announces (we clear
// the opposite day's log so it can fire again).
//
// DEPLOY: supabase functions deploy kitchen-toggle
import { admin, cors, json, todayIST, fmtDate, claimSend, postToBasecamp } from '../_shared/lib.js'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })

  try {
    const { closed } = await req.json().catch(() => ({}))
    const on = !!closed
    const db = admin()
    const date = todayIST()

    // Set (or clear) the flag for today.
    const { error } = await db
      .from('day_meta')
      .upsert({ lunch_date: date, no_cooking: on }, { onConflict: 'lunch_date' })
    if (error) throw error

    let posted = false
    if (on) {
      // allow a later "reopened" post to fire again
      await db.from('email_log').delete().eq('kind', 'bc_nocook_off').eq('lunch_date', date)
      if (await claimSend(db, 'bc_nocook_on', date)) {
        await postToBasecamp(
          `🙅 <b>No office food today (${fmtDate(date)}).</b><br>` +
          `Kavitha akka isn't cooking today — please arrange lunch outside. Thank you! 🙏`
        )
        posted = true
      }
    } else {
      await db.from('email_log').delete().eq('kind', 'bc_nocook_on').eq('lunch_date', date)
      if (await claimSend(db, 'bc_nocook_off', date)) {
        await postToBasecamp(
          `🍛 <b>Kitchen is back on for today (${fmtDate(date)}).</b> ` +
          `Type <b>!lunch in</b> before 11:15 AM to grab a plate.`
        )
        posted = true
      }
    }

    return json({ ok: true, date, closed: on, announced: posted })
  } catch (err) {
    console.error(err)
    return json({ ok: false, error: err?.message || String(err) }, 500)
  }
})
