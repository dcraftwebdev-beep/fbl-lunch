// notify-change — called by the dashboard when someone is added to or
// removed from TODAY's lunch.
//   body: { member_id, action: 'added' | 'removed' }
// added   → member gets a confirmation mail with a "Cancel my lunch" link
// both    → if the chef's 11:00 list already went out, the chef gets a +1 / −1 update
import { admin, cors, json, sendEmail, shell, emailButton, todayIST, fmtDate, claimSend, chefListSent } from '../_shared/lib.js'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })

  try {
    const { member_id, action } = await req.json()
    if (!member_id || !['added', 'removed'].includes(action)) {
      return json({ error: 'member_id and action (added|removed) required' }, 400)
    }

    const db = admin()
    const date = todayIST()

    const [{ data: member }, { data: settings }] = await Promise.all([
      db.from('members').select('*').eq('id', member_id).single(),
      db.from('app_settings').select('*').eq('id', 1).single(),
    ])
    if (!member) return json({ error: 'Member not found' }, 404)

    const results = {}

    /* ---- member confirmation with cancel link (added only, once per day) ---- */
    if (action === 'added' && member.email) {
      const fresh = await claimSend(db, 'member_confirm', date, member.id)
      if (fresh) {
        const { data: entry } = await db
          .from('lunch_entries')
          .select('cancel_token')
          .eq('member_id', member.id)
          .eq('lunch_date', date)
          .maybeSingle()

        if (entry) {
          const cancelUrl = `${Deno.env.get('SUPABASE_URL')}/functions/v1/cancel-lunch?token=${entry.cancel_token}`
          const html = shell(
            'You’re in for lunch today 🍛',
            `<p style="margin:0 0 16px;">Hi ${member.name}, your
               <b>${member.food_pref === 'veg' ? '🟢 veg' : '🔴 non-veg'}</b> plate is booked and headed to the kitchen.</p>
             <p style="margin:0 0 22px;color:#5a645c;font-size:14px;">Changed your mind? Take yourself off today’s list in one click:</p>
             <p style="margin:0 0 20px;">${emailButton(cancelUrl, 'Cancel my lunch', 'danger')}</p>
             <p style="margin:0;color:#8a9384;font-size:13px;">Cancel works until <b>11:15 AM</b>. Do nothing and your plate gets cooked.</p>`,
            `Plate confirmed for ${fmtDate(date)}`
          )
          await sendEmail(member.email, `You're in for lunch (${fmtDate(date)})`, html)
          results.member_mail = true
        }
      }
    }

    /* ---- +1 / −1 update to the chef, only after the main list went out ---- */
    if (settings?.chef_email && (await chefListSent(db, date))) {
      const { count } = await db
        .from('lunch_entries')
        .select('*', { count: 'exact', head: true })
        .eq('lunch_date', date)

      const sign = action === 'added' ? '+1' : '−1'
      const html = shell(
        `Lunch update: ${sign}`,
        `<p><b>${member.name}</b> (${member.food_pref === 'veg' ? '🟢 veg' : '🔴 non-veg'}) ${action === 'added' ? 'joined' : 'cancelled'}. New count: <b>${count ?? '?'} plates</b>.</p>`
      )
      await sendEmail(settings.chef_email, `Lunch ${sign}: ${member.name} — now ${count} plates`, html)
      results.chef_update = true
    }

    return json({ ok: true, ...results })
  } catch (err) {
    console.error(err)
    return json({ error: String(err) }, 500)
  }
})