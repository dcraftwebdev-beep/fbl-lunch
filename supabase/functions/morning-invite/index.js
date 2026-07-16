// morning-invite — scheduled at 10:00 IST (04:30 UTC).
// Emails every ACTIVE member who is NOT yet on today's register:
// "Want lunch today?" with ONE button that opens the app's /join page,
// where a single click adds them to today's register.
// Deduped per member per day via email_log (kind: morning_invite).
//
// REQUIRES SECRET:  supabase secrets set APP_URL=https://your-app.vercel.app
// DEPLOY:   supabase functions deploy morning-invite
// SCHEDULE: cron `30 4 * * *`  (04:30 UTC = 10:00 IST)
import {
  admin,
  cors,
  json,
  sendEmail,
  shell,
  todayIST,
  claimSend,
  signJoin,
  postToBasecamp,
} from '../_shared/lib.js'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })

  try {
    const app = Deno.env.get('APP_URL')
    if (!app) return json({ error: 'APP_URL secret is not set' }, 500)

    const db = admin()
    const date = todayIST()

    const [{ data: members }, { data: entries }] = await Promise.all([
      db.from('members').select('id, name, email, food_pref').eq('active', true),
      db.from('lunch_entries').select('member_id').eq('lunch_date', date),
    ])

    const alreadyIn = new Set((entries ?? []).map((e) => e.member_id))
    const pending = (members ?? []).filter((m) => m.email && !alreadyIn.has(m.id))

    let sent = 0
    for (const m of pending) {
      // once per member per day, even if the cron fires twice
      const fresh = await claimSend(db, 'morning_invite', date, m.id)
      if (!fresh) continue

      const sig = await signJoin(m.id, date)
      const joinUrl = `${app}/join?m=${m.id}&d=${date}&s=${sig}`

      const html = shell(
        'Lunch today? 🍛',
        `<p>Hi ${m.name},</p>
         <p>The office kitchen starts cooking soon. Want a fresh
            <b>${m.food_pref === 'veg' ? '🟢 veg' : '🔴 non-veg'}</b> plate today (${date})?</p>
         <p>One click and you're on the register — nothing else to do:</p>
         <p style="margin:22px 0">
           <a href="${joinUrl}"
              style="background:#1f5c38;color:#fff;text-decoration:none;padding:13px 26px;border-radius:8px;font-weight:bold;font-size:15px">
              Yes, I'm in for lunch today</a></p>
         <p style="color:#5a645c;font-size:13px">This button works for today only.
            Do nothing and no plate will be made for you.</p>`
      )

      await sendEmail(m.email, `Lunch today? One click to get on the register (${date})`, html)
      sent++
    }

    // Announce in Basecamp Campfire, once per day
    if (await claimSend(db, 'bc_morning', date)) {
      await postToBasecamp(
        `🍛 <b>Lunch register is open for today (${date}).</b> ` +
        `Type <b>!lunch in</b> right here to grab a plate, or use the button in your email. ` +
        `Kitchen list locks at 11:00.`
      )
    }

    return json({ ok: true, date, invited: sent, skipped: pending.length - sent })
  } catch (err) {
    console.error(err)
    return json({ error: String(err) }, 500)
  }
})
