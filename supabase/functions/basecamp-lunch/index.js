// basecamp-lunch — the Command URL behind the Basecamp "!lunch" chatbot.
//
// When a teammate types in Campfire:
//   !lunch in       → adds them to TODAY's register (same lunch_entries
//                     table the dashboard reads — dot appears instantly)
//   !lunch out      → cancels their plate for today
//   !lunch          → shows today's count and whether they're in
//
// Basecamp POSTs { command, creator: { name, email_address, ... } } and
// shows whatever HTML this function returns as the bot's chat reply.
//
// Matching Basecamp person → members table: email first (most reliable),
// then exact full name, then unique first-name. If nothing matches, the
// bot says so — make sure members' emails in the register match their
// Basecamp emails.
//
// Chef +1 / −1 mails fire automatically if the 11:00 list already went
// out — same behaviour as every other join/cancel path.
//
// DEPLOY:  add to config.toml with verify_jwt = false (Basecamp sends
// no Supabase auth header), then `supabase functions deploy basecamp-lunch`
import { admin, sendEmail, shell, todayIST, chefListSent } from '../_shared/lib.js'

const say = (html) =>
  new Response(html, {
    status: 200,
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  })

const matchMember = (members, creator) => {
  const email = (creator?.email_address || '').trim().toLowerCase()
  const name = (creator?.name || '').trim().toLowerCase()

  if (email) {
    const byEmail = members.find((m) => (m.email || '').trim().toLowerCase() === email)
    if (byEmail) return byEmail
  }
  if (name) {
    const byName = members.filter((m) => m.name.trim().toLowerCase() === name)
    if (byName.length === 1) return byName[0]

    const first = name.split(/\s+/)[0]
    const byFirst = members.filter(
      (m) => m.name.trim().toLowerCase().split(/\s+/)[0] === first
    )
    if (byFirst.length === 1) return byFirst[0]
  }
  return null
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return say('The lunch bot only answers in Campfire. Type <b>!lunch in</b> there.')

  try {
    const payload = await req.json().catch(() => ({}))
    const cmd = (payload.command || '').trim().toLowerCase()
    const creator = payload.creator || {}

    const db = admin()
    const date = todayIST()

    const { data: members } = await db
      .from('members')
      .select('id, name, email, food_pref, active')
      .eq('active', true)

    const member = matchMember(members ?? [], creator)
    if (!member) {
      return say(
        `Sorry ${creator.name || 'there'} — I couldn't find you on the lunch roster. ` +
        `Ask the register admin to check that your email on the roster matches your Basecamp email.`
      )
    }

    const { data: existing } = await db
      .from('lunch_entries')
      .select('id')
      .eq('member_id', member.id)
      .eq('lunch_date', date)
      .maybeSingle()

    const pref = member.food_pref === 'veg' ? '🟢 veg' : '🔴 non-veg'

    /* ---------- !lunch in ---------- */
    if (['in', 'yes', 'add', 'me'].includes(cmd)) {
      if (existing) return say(`<b>${member.name}</b>, you're already on today's list (${pref}). Relax, the plate is safe. 🍛`)

      const { error } = await db
        .from('lunch_entries')
        .insert({ member_id: member.id, lunch_date: date })
      if (error) throw error

      const { count } = await db
        .from('lunch_entries')
        .select('*', { count: 'exact', head: true })
        .eq('lunch_date', date)

      await notifyChefIfLate(db, date, member, 'added', count)
      return say(`<b>${member.name}</b> is IN for today (${pref}). That's <b>${count}</b> plates so far. 🍛`)
    }

    /* ---------- !lunch out ---------- */
    if (['out', 'no', 'cancel', 'remove'].includes(cmd)) {
      if (!existing) return say(`<b>${member.name}</b>, you weren't on today's list — nothing to cancel.`)

      await db.from('lunch_entries').delete().eq('id', existing.id)

      const { count } = await db
        .from('lunch_entries')
        .select('*', { count: 'exact', head: true })
        .eq('lunch_date', date)

      await notifyChefIfLate(db, date, member, 'removed', count)
      return say(`<b>${member.name}</b> is OUT for today. Down to <b>${count}</b> plates.`)
    }

    /* ---------- !lunch (status) ---------- */
    const { count } = await db
      .from('lunch_entries')
      .select('*', { count: 'exact', head: true })
      .eq('lunch_date', date)

    return say(
      `Today (${date}): <b>${count}</b> plates. ` +
      (existing
        ? `You're <b>in</b>, ${member.name}. Type <b>!lunch out</b> to cancel.`
        : `You're <b>not in</b> yet, ${member.name}. Type <b>!lunch in</b> to grab a plate.`)
    )
  } catch (err) {
    console.error(err)
    return say('Something broke on the register side. Try again in a minute, or use the dashboard.')
  }
})

// +1 / −1 mail to the chef, but only after the 11:00 list already went out
async function notifyChefIfLate(db, date, member, action, count) {
  try {
    const { data: settings } = await db.from('app_settings').select('chef_email').eq('id', 1).single()
    if (!settings?.chef_email || !(await chefListSent(db, date))) return

    const sign = action === 'added' ? '+1' : '−1'
    await sendEmail(
      settings.chef_email,
      `Lunch ${sign}: ${member.name} — now ${count} plates`,
      shell(`Lunch update: ${sign}`, `<p><b>${member.name}</b> (${member.food_pref === 'veg' ? '🟢 veg' : '🔴 non-veg'}) ${action === 'added' ? 'joined' : 'cancelled'} via Basecamp after the 11:00 list.</p>
        <p style="font-size:17px">New team count: <b>${count ?? '?'} plates</b>.</p>`)
    )
  } catch (err) {
    console.error('Chef notify failed:', err)
  }
}
