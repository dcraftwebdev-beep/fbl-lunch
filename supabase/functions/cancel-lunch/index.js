// cancel-lunch — the public link inside the member's confirmation email.
// GET ?token=<cancel_token>  → deletes today's entry, notifies the chef (−1)
// if the main list already went out, and shows a friendly HTML page.
// DEPLOY WITH:  supabase functions deploy cancel-lunch --no-verify-jwt
import { admin, sendEmail, shell, todayIST, chefListSent } from '../_shared/lib.js'

const page = (title, msg, ok = true) =>
  new Response(
    `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
     <title>${title}</title></head>
     <body style="margin:0;background:#f6f7f2;font-family:Arial,Helvetica,sans-serif;display:grid;place-items:center;min-height:100vh">
       <div style="background:#fff;border:1px solid #e3e7de;border-radius:14px;padding:36px;max-width:420px;text-align:center">
         <div style="width:52px;height:52px;margin:0 auto;border:2px solid ${ok ? '#1f5c38' : '#c03b2b'};border-radius:10px;display:grid;place-items:center">
           <div style="width:20px;height:20px;border-radius:50%;background:${ok ? '#1f5c38' : '#c03b2b'}"></div>
         </div>
         <h1 style="font-size:22px;color:#1c221d;margin:12px 0 8px">${title}</h1>
         <p style="color:#5a645c;font-size:15px;line-height:1.5;margin:0">${msg}</p>
         <p style="color:#a8b5aa;font-size:12px;margin-top:22px">Firebrand Labs · Lunch Register</p>
       </div>
     </body></html>`,
    {
      status: ok ? 200 : 400,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'X-Content-Type-Options': 'nosniff',
        'Cache-Control': 'no-store',
      },
    }
  )

Deno.serve(async (req) => {
  try {
    const token = new URL(req.url).searchParams.get('token')
    if (!token) return page('Missing link', 'This cancel link is incomplete. Open the button from your email again.', false)

    const db = admin()
    const date = todayIST()

    const { data: entry } = await db
      .from('lunch_entries')
      .select('id, member_id, lunch_date')
      .eq('cancel_token', token)
      .maybeSingle()

    if (!entry) {
      return page('Already cancelled', 'This lunch was already cancelled, or the link has expired. Nothing more to do.', true)
    }
    if (entry.lunch_date !== date) {
      return page('Link expired', 'This cancel link was for a past day. Today\'s lunch is managed on the dashboard.', false)
    }

    const { data: member } = await db.from('members').select('name, food_pref').eq('id', entry.member_id).single()
    await db.from('lunch_entries').delete().eq('id', entry.id)

    // Tell the chef, but only if the 11:00 list already went out
    const { data: settings } = await db.from('app_settings').select('chef_email').eq('id', 1).single()
    if (settings?.chef_email && (await chefListSent(db, date))) {
      const { count } = await db
        .from('lunch_entries')
        .select('*', { count: 'exact', head: true })
        .eq('lunch_date', date)
      await sendEmail(
        settings.chef_email,
        `Lunch −1: ${member?.name ?? 'A member'} — now ${count} plates`,
        shell('Lunch update: −1', `<p><b>${member?.name ?? 'A member'}</b> cancelled via email link.</p>
          <p style="font-size:17px">New team count: <b>${count ?? '?'} plates</b>.</p>`)
      )
    }

    return page(
      `Lunch cancelled, ${member?.name ?? 'done'}`,
      'Your plate for today is off the list and the kitchen has been told. Changed your mind? Ask whoever runs the register to add you back.'
    )
  } catch (err) {
    console.error(err)
    return page('Something went wrong', 'The cancel did not go through. Try the link once more, or tell the register admin.', false)
  }
})