// evening-invite — scheduled at 17:00 IST (11:30 UTC), Sunday–Thursday.
// REPLACES the old 10 AM morning-invite: lunch is now ordered the
// EVENING BEFORE. Emails every ACTIVE member who is NOT yet on
// TOMORROW's register: "Lunch tomorrow?" with ONE button that opens
// the app's /join page for tomorrow's date.
// Sunday's run asks about MONDAY. Friday runs weekend-funny instead
// (no lunch Sat/Sun); Saturday nothing is sent.
// Also announces in Basecamp Campfire that tomorrow's register is open.
// Deduped per member per day via email_log (kind: evening_invite).
//
// REQUIRES SECRET:  supabase secrets set APP_URL=https://your-app.vercel.app
// DEPLOY:   supabase functions deploy evening-invite
// SCHEDULE: cron `30 11 * * 0-4`  (11:30 UTC = 17:00 IST, Sun–Thu →
//           covers lunches Mon–Fri)
import {
  admin,
  cors,
  json,
  sendEmail,
  shell,
  nextLunchDateIST,
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
    // Next working lunch day: Sun–Thu → tomorrow; if ever run on
    // Fri/Sat it safely targets Monday instead of a weekend date.
    const date = nextLunchDateIST()

    const [{ data: members }, { data: entries }] = await Promise.all([
      db.from('members').select('id, name, email, food_pref').eq('active', true),
      db.from('lunch_entries').select('member_id').eq('lunch_date', date),
    ])

    const alreadyIn = new Set((entries ?? []).map((e) => e.member_id))
    const pending = (members ?? []).filter((m) => m.email && !alreadyIn.has(m.id))

    let sent = 0
    for (const m of pending) {
      // once per member per lunch date, even if the cron fires twice
      const fresh = await claimSend(db, 'evening_invite', date, m.id)
      if (!fresh) continue

      const sig = await signJoin(m.id, date)
      const joinUrl = `${app}/join?m=${m.id}&d=${date}&s=${sig}`

      const html = shell(
        'Lunch tomorrow? 🍛',
        `<p>Hi ${m.name} — ${m.food_pref === 'veg' ? '🟢 veg' : '🔴 non-veg'} plate tomorrow (${date})? One click:</p>
         <p style="margin:22px 0">
           <a href="${joinUrl}"
              style="background:#1f5c38;color:#fff;text-decoration:none;padding:13px 26px;border-radius:8px;font-weight:bold;font-size:15px">
              Yes, I'm in 🍛</a></p>
         <p style="color:#5a645c;font-size:13px">Or type <b>!lunch in</b> in Basecamp. Closes <b>6:30 PM today</b>.</p>`
      )

      await sendEmail(m.email, `Lunch tomorrow? (${date})`, html)
      sent++
    }

    // Announce in Basecamp Campfire, once per lunch date
    if (await claimSend(db, 'bc_evening', date)) {
      await postToBasecamp(
        `🍛 <b>Register open for tomorrow (${date}).</b> Type <b>!lunch in</b>. Closes <b>6:30 PM</b>.`
      )
    }

    return json({ ok: true, date, invited: sent, skipped: pending.length - sent })
  } catch (err) {
    console.error(err)
    return json({ error: String(err) }, 500)
  }
})