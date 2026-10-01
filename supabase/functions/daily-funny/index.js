// daily-funny — the daily banter mail. Called by pg_cron shortly after the
// 11:00 chef list (e.g. 11:15 IST). Members who ordered get a light
// motivation line; members who didn't get the "don't eat outside bro" genre.
// Lines rotate by day-of-year so the message changes every day.
import {
  admin, cors, json, sendEmail, shell, dayOfYear, claimSend,
  ORDERED_LINES, NOT_ORDERED_LINES, isNoCookingDay, nextLunchDateIST,
} from '../_shared/lib.js'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })

  try {
    const db = admin()
    const date = nextLunchDateIST() // tomorrow's list, sent at 5 PM close
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
        ordered ? 'You’re sorted for tomorrow ✅' : 'No lunch marked for tomorrow 👀',
        `<p style="margin:0 0 16px;">Hi ${m.name},</p>
         <div style="margin:0 0 18px;padding:16px 18px;border-radius:12px;background:${ordered ? '#eef5ef' : '#fbf1e8'};border-left:4px solid ${ordered ? '#1f5c38' : '#c9852f'};font-size:16px;color:#1c221d;">${line}</div>
         ${ordered
            ? '<p style="margin:0;color:#5a645c;font-size:13px;">You’re on tomorrow’s list. Nothing more to do. 🍛</p>'
            : '<p style="margin:0;color:#5a645c;font-size:13px;">Next time, type <b>!lunch in</b> in Basecamp before <b>5:00 PM</b> to grab a plate.</p>'}`,
        ordered ? 'You’re on the list for tomorrow' : 'You missed tomorrow’s register'
      )

      try {
        await sendEmail(m.email, ordered ? 'You’re sorted for lunch tomorrow 🍛' : 'No lunch for tomorrow?? 👀', html)
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