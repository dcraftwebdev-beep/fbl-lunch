// notify-change — called by the dashboard when someone is added to or
// removed from TODAY's lunch.
//   body: { member_id, action: 'added' | 'removed' }
// added   → member gets a confirmation mail with a "Cancel my lunch" link
// both    → if the chef's 11:00 list already went out, the chef gets a +1 / −1 update
import { admin, cors, json, sendEmail, shell, todayIST, claimSend, chefListSent } from '../_shared/lib.js'

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
            'You have lunch today 🍛',
            `<p>Hi ${member.name},</p>
             <p>The office kitchen is cooking for you today
                (<b>${member.food_pref === 'veg' ? '🟢 veg' : '🔴 non-veg'}</b>, ${date}).</p>
             <p>Plans changed? Cancel before the cooking starts — one click, no questions:</p>
             <p style="margin:20px 0">
               <a href="${cancelUrl}"
                  style="background:#c03b2b;color:#fff;text-decoration:none;padding:12px 22px;border-radius:8px;font-weight:bold">
                  Cancel my lunch today</a></p>
             <p style="color:#5a645c;font-size:13px">The link works for today only. If you do nothing, your plate will be cooked.</p>`
          )
          await sendEmail(member.email, `You're in for lunch today (${date})`, html)
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
        `<p><b>${member.name}</b> (${member.food_pref === 'veg' ? '🟢 veg' : '🔴 non-veg'})
            ${action === 'added' ? 'joined' : 'cancelled'} after the 11:00 list.</p>
         <p style="font-size:17px">New team count: <b>${count ?? '?'} plates</b> (guests extra, if any).</p>`
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