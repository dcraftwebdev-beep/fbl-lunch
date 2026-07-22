// morning-invite — scheduled at 10:00 IST (04:30 UTC), Monday–Friday.
// Opens the order window for TODAY:
//   1. auto-adds the DEFAULT members (Dinesh, Jey, Ajey, Dipak, Lazzo)
//      to today's register,
//   2. emails every active member NOT yet on the list a one-click
//      "Order lunch" button (+ an "Open the register" button),
//   3. posts today's list into the Basecamp Campfire with the
//      !lunch in / !lunch out instructions.
// The window stays open until it closes at 11:15 AM today.
// Deduped per member per day (kind: morning_invite) and per lunch date
// for the Basecamp post (kind: bc_morning).
//
// OPTIONAL SECRET:  APP_URL=https://your-app.vercel.app  → the buttons
// open the branded /join page + dashboard. Without it the order button
// falls back to the join-lunch edge function (still fully works) and the
// register button is omitted.
//
// DEPLOY:   supabase functions deploy morning-invite
// SCHEDULE: cron `30 4 * * 1-5`  (04:30 UTC = 10:00 IST, Mon–Fri)
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
  ensureDefaultMembers,
  lunchRoster,
  rosterNamesHtml,
} from '../_shared/lib.js'

const BTN_PRIMARY =
  'background:#1f5c38;color:#fff;text-decoration:none;padding:13px 26px;border-radius:8px;font-weight:bold;font-size:15px;display:inline-block'
const BTN_SECONDARY =
  'background:#fff;color:#1f5c38;text-decoration:none;padding:12px 24px;border:1px solid #1f5c38;border-radius:8px;font-weight:bold;font-size:15px;display:inline-block'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })

  try {
    const db = admin()
    const date = todayIST()
    const app = Deno.env.get('APP_URL') // optional
    const fnBase = `${Deno.env.get('SUPABASE_URL')}/functions/v1`

    // 1. Default members are IN by default for today.
    const added = await ensureDefaultMembers(db, date)

    // 2. Email everyone NOT yet on today's list a one-click order button.
    const [{ data: members }, { data: entries }] = await Promise.all([
      db.from('members').select('id, name, email, food_pref').eq('active', true),
      db.from('lunch_entries').select('member_id').eq('lunch_date', date),
    ])
    const inSet = new Set((entries ?? []).map((e) => e.member_id))
    const pending = (members ?? []).filter((m) => m.email && !inSet.has(m.id))

    let mailed = 0
    for (const m of pending) {
      // once per member per day, even if the cron fires twice
      if (!(await claimSend(db, 'morning_invite', date, m.id))) continue

      const sig = await signJoin(m.id, date)
      // Order button → the branded /join page if APP_URL is set, else
      // straight to the join-lunch edge function (both fully work).
      const orderUrl = app
        ? `${app}/join?m=${m.id}&d=${date}&s=${sig}`
        : `${fnBase}/join-lunch?m=${m.id}&d=${date}&s=${sig}`
      const registerBtn = app
        ? `<a href="${app}" style="${BTN_SECONDARY}">Open the lunch register</a>`
        : ''

      const html = shell(
        'Lunch today? 🍛',
        `<p>Hi ${m.name},</p>
         <p>The office kitchen is cooking. Want a fresh
            <b>${m.food_pref === 'veg' ? '🟢 veg' : '🔴 non-veg'}</b> plate today (${date})?</p>
         <p style="margin:22px 0">
           <a href="${orderUrl}" style="${BTN_PRIMARY}">🍛 Order lunch — I'm in</a>
           ${registerBtn ? `&nbsp;&nbsp;${registerBtn}` : ''}
         </p>
         <p style="color:#5a645c;font-size:13px">Works till <b>11:15 AM</b> today.
            Prefer chat? Type <b>!lunch in</b> in Basecamp. Do nothing and no plate is made for you.</p>`
      )

      try {
        await sendEmail(m.email, `Lunch today? One click to order (${date})`, html)
        mailed++
      } catch (err) {
        console.error(`morning-invite → ${m.email}:`, err)
      }
    }

    // 3. Announce today's list in Basecamp — once per lunch date.
    let posted = false
    if (await claimSend(db, 'bc_morning', date)) {
      const roster = await lunchRoster(db, date)
      await postToBasecamp(
        `🍛 <b>Lunch list for today (${date})</b><br>` +
        `${rosterNamesHtml(roster)}<br><br>` +
        `Want in? Type <b>!lunch in</b>. Not coming? Type <b>!lunch out</b>.<br>` +
        `Open till <b>11:15 AM</b>. Current count: <b>${roster.length}</b> plates.`
      )
      posted = true
    }

    return json({ ok: true, date, defaults_added: added.map((m) => m.name), mailed, basecamp: posted })
  } catch (err) {
    console.error(err)
    return json({ error: String(err) }, 500)
  }
})
