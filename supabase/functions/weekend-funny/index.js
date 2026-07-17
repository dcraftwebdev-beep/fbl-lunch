// weekend-funny — scheduled at 17:00 IST (11:30 UTC), FRIDAY only.
// No lunch on Saturday & Sunday, so instead of an order invite the
// team gets one short funny "kitchen is off, see you Monday" message —
// posted in Basecamp Campfire and mailed to every active member.
// Sunday 5 PM the normal evening-invite takes over and asks about
// Monday's food.
// Deduped via email_log (kinds: weekend_funny / bc_weekend).
//
// DEPLOY:   supabase functions deploy weekend-funny
// SCHEDULE: cron `30 11 * * 5`  (11:30 UTC = 17:00 IST, Friday)
import {
  admin,
  cors,
  json,
  sendEmail,
  shell,
  todayIST,
  dayOfYear,
  claimSend,
  postToBasecamp,
} from '../_shared/lib.js'

const WEEKEND_LINES = [
  "Kitchen's off for the weekend. 😎 See you Monday. 🍛",
  "No plates Sat/Sun — the fridge is your problem now. Back Monday. 🏖️",
  "Bot's sleeping for 48 hours. 😴 Monday's roll call: Sunday 5 PM.",
  "The chef has left the building. 🎭 Lunch resumes Monday.",
  "Weekend mode: ON. Rice returns Monday. 🍚",
]

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })

  try {
    const db = admin()
    const date = todayIST() // Friday — used only for dedupe
    const line = WEEKEND_LINES[dayOfYear() % WEEKEND_LINES.length]

    // Basecamp Campfire, once
    if (await claimSend(db, 'bc_weekend', date)) {
      await postToBasecamp(`🌴 ${line}`)
    }

    // One short funny mail to every active member, once each
    const { data: members } = await db
      .from('members')
      .select('id, name, email')
      .eq('active', true)

    let sent = 0
    for (const m of members ?? []) {
      if (!m.email) continue
      const fresh = await claimSend(db, 'weekend_funny', date, m.id)
      if (!fresh) continue

      const html = shell(
        'See you Monday 🍛',
        `<p>Hi ${m.name},</p>
         <p>${line}</p>
         <p style="color:#5a645c;font-size:13px">Sunday 5 PM: one-click invite for Monday's plate.</p>`
      )
      await sendEmail(m.email, 'Kitchen closed for the weekend 🍛', html)
      sent++
    }

    return json({ ok: true, date, mailed: sent })
  } catch (err) {
    console.error(err)
    return json({ error: String(err) }, 500)
  }
})