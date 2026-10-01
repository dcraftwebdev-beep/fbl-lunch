// morning-invite — the 4:00 PM OPEN (Sun to Thu). Opens ordering for the
// NEXT working day (tomorrow):
//   1. auto-adds the default members to tomorrow's register,
//   2. emails every active member: a confirmation + Cancel button if they
//      are already in, or an Order button if they are not, plus a
//      "message the group" chat button,
//   3. posts tomorrow's list to Basecamp with the !lunch in/out note.
// Deduped per member per day (kind: evening_invite) and per lunch date for
// the Basecamp post (kind: bc_open).
//
// SCHEDULE: cron `30 10 * * 0-4`  (10:30 UTC = 4:00 PM IST, Sun to Thu)
import {
  admin,
  cors,
  json,
  sendEmail,
  shell,
  emailButton,
  fmtDate,
  CHAT_LINK,
  claimSend,
  signJoin,
  postToBasecamp,
  ensureDefaultMembers,
  lunchRoster,
  rosterNamesHtml,
  isNoCookingDay,
  nextLunchDateIST,
} from '../_shared/lib.js'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })

  try {
    const db = admin()
    const date = nextLunchDateIST() // tomorrow (next working day)

    if (await isNoCookingDay(db, date)) {
      return json({ ok: true, date, skipped: 'no_cooking' })
    }

    const app = Deno.env.get('APP_URL') // optional
    const fnBase = `${Deno.env.get('SUPABASE_URL')}/functions/v1`

    // 1. Default members are IN by default for tomorrow.
    const added = await ensureDefaultMembers(db, date)

    // 2. Email every active member the right action for tomorrow.
    const [{ data: members }, { data: entries }] = await Promise.all([
      db.from('members').select('id, name, email, food_pref').eq('active', true),
      db.from('lunch_entries').select('member_id, cancel_token').eq('lunch_date', date),
    ])
    const entryByMember = new Map((entries ?? []).map((e) => [e.member_id, e]))
    const chatBtn = emailButton(CHAT_LINK, 'Message the lunch group', 'outline')

    let mailed = 0
    for (const m of members ?? []) {
      if (!m.email) continue
      if (!(await claimSend(db, 'evening_invite', date, m.id))) continue

      const pref = m.food_pref === 'veg' ? '🟢 veg' : '🔴 non-veg'
      const inEntry = entryByMember.get(m.id)
      let subject, html

      if (inEntry) {
        const cancelUrl = `${fnBase}/cancel-lunch?token=${inEntry.cancel_token}`
        subject = `You're in for lunch tomorrow (${fmtDate(date)})`
        html = shell(
          'You’re in for lunch tomorrow 🍛',
          `<p style="margin:0 0 16px;">Hi ${m.name}, you’re booked for a <b>${pref}</b> plate tomorrow.</p>
           <p style="margin:0 0 18px;color:#6b7266;font-size:14px;">Not coming? Take yourself off the list in one click:</p>
           <p style="margin:0 0 12px;">${emailButton(cancelUrl, 'Cancel my lunch', 'danger')}</p>
           <p style="margin:0 0 20px;">${chatBtn}</p>
           <p style="margin:0;color:#9aa295;font-size:13px;">Ordering for tomorrow closes at <b>5:00 PM</b> today.</p>`,
          `Plate confirmed for ${fmtDate(date)}`
        )
      } else {
        const sig = await signJoin(m.id, date)
        const orderUrl = app
          ? `${app}/join?m=${m.id}&d=${date}&s=${sig}`
          : `${fnBase}/join-lunch?m=${m.id}&d=${date}&s=${sig}`
        subject = `Lunch tomorrow? One click to order (${fmtDate(date)})`
        html = shell(
          'Want lunch tomorrow? 🍛',
          `<p style="margin:0 0 16px;">Hi ${m.name}, the kitchen is cooking tomorrow. Want a fresh <b>${pref}</b> plate?</p>
           <p style="margin:0 0 12px;">${emailButton(orderUrl, 'Yes, add me for tomorrow', 'primary')}</p>
           <p style="margin:0 0 20px;">${chatBtn}</p>
           <p style="margin:0;color:#9aa295;font-size:13px;">Ordering closes at <b>5:00 PM</b> today. Prefer chat? Type <b>!lunch in</b> in the group.</p>`,
          `Ordering for ${fmtDate(date)}`
        )
      }

      try {
        await sendEmail(m.email, subject, html)
        mailed++
      } catch (err) {
        console.error(`evening-invite → ${m.email}:`, err)
      }
    }

    // 3. Announce tomorrow's list in Basecamp — once per lunch date.
    let posted = false
    if (await claimSend(db, 'bc_open', date)) {
      const roster = await lunchRoster(db, date)
      await postToBasecamp(
        `🍛 <b>Lunch list for tomorrow (${fmtDate(date)})</b><br>` +
        `${rosterNamesHtml(roster)}<br><br>` +
        `Want in? Type <b>!lunch in</b>. Not coming? Type <b>!lunch out</b>.<br>` +
        `Ordering closes at <b>5:00 PM today</b>. Current count: <b>${roster.length}</b> plates.`
      )
      posted = true
    }

    return json({ ok: true, date, defaults_added: added.map((m) => m.name), mailed, basecamp: posted })
  } catch (err) {
    console.error(err)
    return json({ error: String(err) }, 500)
  }
})
