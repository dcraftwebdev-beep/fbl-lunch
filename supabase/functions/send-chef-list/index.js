// send-chef-list — emails the chef the plate list for a lunch day.
//   body: { target: 'today' | 'next' }   (default 'today')
//     today → today's final list (11:15 AM finalise + dashboard button)
//     next  → next working day's preview list (on-demand only)
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
  nextLunchDateIST,
  claimSend,
  lunchRoster,
} from '../_shared/lib.js'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })

  try {
    const body = await req.json().catch(() => ({}))
    const target = body.target === 'next' ? 'next' : 'today'
    const date = target === 'next' ? nextLunchDateIST() : todayIST()

    const db = admin()

    const { data: settings } = await db.from('app_settings').select('chef_email, chef_name').eq('id', 1).single()
    if (!settings?.chef_email) return json({ error: 'Chef email not set' }, 400)

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
      `<p>Hi ${settings.chef_name || 'Chef'} — here's the list for <b>${date}</b>.</p>
       <p style="font-size:17px;margin:14px 0">
         <b>${total}</b> plates &nbsp;·&nbsp; 🟢 ${veg.length} veg &nbsp;·&nbsp; 🔴 ${nonveg.length} non-veg
         ${guests ? `&nbsp;·&nbsp; 👥 ${guests} guest${guests > 1 ? 's' : ''}` : ''}
       </p>
       <table style="width:100%;border-collapse:collapse;margin:8px 0 4px">${roster.map(nameRow).join('')}</table>
       ${meta?.note ? `<p style="margin-top:14px;color:#5a645c"><b>Note:</b> ${meta.note}</p>` : ''}
       <p style="color:#5a645c;font-size:13px;margin-top:16px">${target === 'next' ? 'Preview — final list arrives at 11:15 AM.' : 'Final list. Any change after this comes as a +1 / −1 update.'}</p>`
    )

    await sendEmail(settings.chef_email, `${label}'s lunch: ${total} plates (${date})`, html)

    return json({ ok: true, target, date, plates: total, veg: veg.length, nonveg: nonveg.length, guests })
  } catch (err) {
    console.error(err)
    return json({ error: String(err) }, 500)
  }
})
