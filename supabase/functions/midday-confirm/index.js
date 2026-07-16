// midday-confirm — scheduled at 11:00 IST (05:30 UTC).
// Emails every member ON today's register: "You're in for lunch today"
// with the day's rotating ORDERED_LINES quip and the cancel button.
//
// Dedupe: uses the same email_log kind as notify-change's confirmation
// ('member_confirm'), so anyone who ALREADY got a confirmation today
// (added manually via the dashboard) is skipped — nobody gets doubles.
// Members who joined via the 10 AM button get their confirmation here.
//
// Your existing 11:00 not-ordered nudges / chef list stay as they are.
//
// DEPLOY:   supabase functions deploy midday-confirm
// SCHEDULE: cron `30 5 * * *`  (05:30 UTC = 11:00 IST)
import {
  admin,
  cors,
  json,
  sendEmail,
  shell,
  todayIST,
  dayOfYear,
  claimSend,
  ORDERED_LINES,
} from '../_shared/lib.js'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })

  try {
    const db = admin()
    const date = todayIST()
    const quip = ORDERED_LINES[dayOfYear() % ORDERED_LINES.length]

    const { data: entries } = await db
      .from('lunch_entries')
      .select('id, member_id, cancel_token, members ( id, name, email, food_pref )')
      .eq('lunch_date', date)

    let sent = 0
    for (const entry of entries ?? []) {
      const m = entry.members
      if (!m?.email) continue

      // Skip anyone already confirmed today (dashboard add / re-run)
      const fresh = await claimSend(db, 'member_confirm', date, m.id)
      if (!fresh) continue

      const cancelUrl = `${Deno.env.get('SUPABASE_URL')}/functions/v1/cancel-lunch?token=${entry.cancel_token}`
      const html = shell(
        "You're in for lunch today 🍛",
        `<p>Hi ${m.name},</p>
         <p>Confirmed — the office kitchen is cooking your
            <b>${m.food_pref === 'veg' ? '🟢 veg' : '🔴 non-veg'}</b> plate today (${date}).</p>
         <p style="background:#f6f7f2;border-left:3px solid #1f5c38;padding:10px 14px;border-radius:0 8px 8px 0;color:#1c221d">${quip}</p>
         <p>Plans changed? Cancel before the cooking starts — one click, no questions:</p>
         <p style="margin:20px 0">
           <a href="${cancelUrl}"
              style="background:#c03b2b;color:#fff;text-decoration:none;padding:12px 22px;border-radius:8px;font-weight:bold">
              Cancel my lunch today</a></p>
         <p style="color:#5a645c;font-size:13px">The link works for today only. If you do nothing, your plate will be cooked.</p>`
      )

      await sendEmail(m.email, `You're in for lunch today (${date})`, html)
      sent++
    }

    return json({ ok: true, date, confirmed: sent, on_register: entries?.length ?? 0 })
  } catch (err) {
    console.error(err)
    return json({ error: String(err) }, 500)
  }
})