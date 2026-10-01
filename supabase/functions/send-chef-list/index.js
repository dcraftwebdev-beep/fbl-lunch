// send-chef-list — emails the plate list for a lunch day to the chef AND
// to the admin (Mani).
//   body: { target: 'today' | 'next' }   (default 'today')
//     next  → tomorrow's final list (5:00 PM close + cron)
//     today → today's list (dashboard "send now" button)
// Includes count, veg / non-veg split, names, guest plates and note.
// Records email_log kind 'chef_list' for that date so later +1 / −1
// updates (notify-change / join / cancel) know the list already went out.
//
// DEPLOY: supabase functions deploy send-chef-list
import {
  admin,
  cors,
  json,
  sendEmail,
  shell,
  todayIST,
  fmtDate,
  nextLunchDateIST,
  claimSend,
  lunchRoster,
  isNoCookingDay,
  chefRecipients,
  ADMIN_EMAIL,
} from '../_shared/lib.js'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })

  try {
    const body = await req.json().catch(() => ({}))
    const target = body.target === 'next' ? 'next' : 'today'
    // recipient: 'chef' (Kavitha only) | 'admin' (Mani only) | 'both' (default)
    const recipient = ['chef', 'admin', 'both'].includes(body.recipient) ? body.recipient : 'both'
    const date = target === 'next' ? nextLunchDateIST() : todayIST()

    const db = admin()

    if (await isNoCookingDay(db, date)) {
      return json({ ok: true, target, date, skipped: 'no_cooking' })
    }

    const { data: settings } = await db.from('app_settings').select('chef_email, chef_name').eq('id', 1).single()
    if (recipient !== 'admin' && !settings?.chef_email) return json({ error: 'Chef email not set' }, 400)

    const to = recipient === 'chef' ? [settings.chef_email]
      : recipient === 'admin' ? [ADMIN_EMAIL]
      : chefRecipients(settings.chef_email)
    const greetName = recipient === 'admin' ? 'Mani' : (settings.chef_name || 'Chef')

    const roster = await lunchRoster(db, date)
    const { data: meta } = await db.from('day_meta').select('guest_count, note').eq('lunch_date', date).maybeSingle()

    const veg = roster.filter((m) => m.food_pref === 'veg')
    const nonveg = roster.filter((m) => m.food_pref !== 'veg')
    const guests = meta?.guest_count ?? 0
    const total = roster.length + guests

    // Mark the list as sent (idempotent per date). If already sent we
    // still resend on demand from the dashboard, but keep one log row.
    await claimSend(db, 'chef_list', date)

    const nameRow = (m) => `<tr><td style="padding:4px 0">${m.food_pref === 'veg' ? '🟢' : '🔴'} ${m.name}</td></tr>`
    const label = target === 'next' ? 'Tomorrow' : "Today"

    const html = shell(
      `${label}'s lunch — ${total} plates`,
      `<p>Hi ${greetName}, here's the lunch list for <b>${fmtDate(date)}</b>.</p>
       <p style="font-size:17px;margin:14px 0">
         <b>${total}</b> plates &nbsp;·&nbsp; 🟢 ${veg.length} veg &nbsp;·&nbsp; 🔴 ${nonveg.length} non-veg
         ${guests ? `&nbsp;·&nbsp; 👥 ${guests} guest${guests > 1 ? 's' : ''}` : ''}
       </p>
       <table style="width:100%;border-collapse:collapse;margin:8px 0 4px">${roster.map(nameRow).join('')}</table>
       ${meta?.note ? `<p style="margin-top:14px;color:#5a645c"><b>Note:</b> ${meta.note}</p>` : ''}
       <p style="color:#5a645c;font-size:13px;margin-top:16px">${target === 'next' ? 'Final list for tomorrow. Any change after this comes as a +1 / −1 update.' : 'Any change after this comes as a +1 / −1 update.'}</p>`,
      `${total} plates for ${fmtDate(date)}`
    )

    await sendEmail(to, `${label}'s lunch: ${total} plates (${fmtDate(date)})`, html)

    return json({ ok: true, target, date, recipient, plates: total, veg: veg.length, nonveg: nonveg.length, guests })
  } catch (err) {
    console.error(err)
    return json({ error: String(err) }, 500)
  }
})
