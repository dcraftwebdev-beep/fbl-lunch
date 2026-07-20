// send-chef-list — emails the final lunch list to the chef.
//
// Two callers:
//   • pg_cron at 18:30 IST (window just closed), body { target: 'next' }
//     → sends the NEXT working day's list — the plates just ordered in
//       the 5:00–6:30 PM window (Sunday's send = Monday).
//   • dashboard "Send today's list now" button, body { force: true }
//     → sends TODAY's list on demand (default target = today).
import { admin, cors, json, sendEmail, shell, todayIST, nextLunchDateIST, claimSend } from '../_shared/lib.js'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })

  try {
    const { force = false, target = 'today' } = await req.json().catch(() => ({}))
    const db = admin()
    // Evening cron targets the next working lunch day; the manual
    // dashboard button targets today.
    const date = target === 'next' ? nextLunchDateIST() : todayIST()

    const [{ data: settings }, { data: members }, { data: entries }, { data: meta }] =
      await Promise.all([
        db.from('app_settings').select('*').eq('id', 1).single(),
        db.from('members').select('*'),
        db.from('lunch_entries').select('member_id').eq('lunch_date', date),
        db.from('day_meta').select('*').eq('lunch_date', date).maybeSingle(),
      ])

    if (!settings?.chef_email) return json({ error: 'No chef email set. Add it on the dashboard.' }, 400)

    // Cron path: only send once per day. Button path (force): always send an updated list.
    if (!force) {
      const fresh = await claimSend(db, 'chef_list', date)
      if (!fresh) return json({ skipped: 'Chef list already sent today' })
    } else {
      await claimSend(db, 'chef_list', date) // mark as sent if it wasn't already
    }

    const byId = Object.fromEntries((members ?? []).map((m) => [m.id, m]))
    const list = (entries ?? []).map((e) => byId[e.member_id]).filter(Boolean)
    const veg = list.filter((m) => m.food_pref === 'veg')
    const nonveg = list.filter((m) => m.food_pref !== 'veg')
    const guests = meta?.guest_count ?? 0
    const total = list.length + guests

    const nameLi = (arr) =>
      arr.length
        ? `<ul style="margin:6px 0 14px;padding-left:20px">${arr.map((m) => `<li>${m.name}</li>`).join('')}</ul>`
        : '<p style="color:#5a645c;margin:6px 0 14px">— none —</p>'

    const when = target === 'next' ? 'tomorrow' : 'today'

    const html = shell(
      `Lunch list · ${date}`,
      `<p style="font-size:17px"><b>${total} plate${total === 1 ? '' : 's'} to cook ${when}</b>
        (${veg.length} veg · ${nonveg.length} non-veg${guests ? ` · ${guests} guest` : ''})</p>
       <p style="margin-bottom:2px"><b style="color:#1f5c38">🟢 Veg — ${veg.length}</b></p>${nameLi(veg)}
       <p style="margin-bottom:2px"><b style="color:#c03b2b">🔴 Non-veg — ${nonveg.length}</b></p>${nameLi(nonveg)}
       ${meta?.note ? `<p><b>Note:</b> ${meta.note}</p>` : ''}
       <p style="color:#5a645c;font-size:13px">The order window is closed, so this list is final. 🍛</p>`
    )

    await sendEmail(settings.chef_email, `Lunch ${when} (${date}): ${total} plates (${veg.length}V / ${nonveg.length}NV)`, html)
    return json({ sent: true, total })
  } catch (err) {
    console.error(err)
    return json({ error: String(err) }, 500)
  }
})