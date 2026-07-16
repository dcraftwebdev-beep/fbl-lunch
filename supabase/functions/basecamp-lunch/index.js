// basecamp-lunch — the Command URL behind the Basecamp "!lunch" chatbot.
//
// Commands (also works via single-word bots using ?do=in / ?do=out):
//   !lunch in       → adds you to TODAY's register (before 11:30 IST)
//   !lunch out      → cancels your plate (before 11:30 IST)
//   !lunch          → today's count + whether you're in
//   !lunch menu     → a funny non-answer (the chef keeps secrets)
//   !lunch thanks / hi / anything else → the bot has jokes
//
// ORDER CUTOFF: 11:30 IST. After that, in/out are refused with a
// funny "time's up" line — the kitchen has already committed.
// Between 11:00 (chef list) and 11:30, joins/cancels still send the
// chef a +1/−1 mail as before.
//
// DEPLOY: config.toml entry with verify_jwt = false, then
//         supabase functions deploy basecamp-lunch
import { admin, sendEmail, shell, todayIST, chefListSent } from '../_shared/lib.js'

const CUTOFF_MIN = 11 * 60 + 30 // 11:30 IST

const say = (html) =>
  new Response(html, {
    status: 200,
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  })

const pick = (arr) => arr[Math.floor(Math.random() * arr.length)]

const nowISTMinutes = () => {
  const ist = new Date(Date.now() + 5.5 * 3600 * 1000)
  return ist.getUTCHours() * 60 + ist.getUTCMinutes()
}

/* ---------------- the bot's personality ---------------- */

const TIMES_UP_LINES = [
  "Time's up buddy ⏰ The kitchen closed the gates at 11:30. Today you're on your own — tomorrow, type faster.",
  "Nope. 11:30 came and went. The rice has already made its life decisions. See you tomorrow at 10.",
  "The register is closed tighter than the office AC remote drawer. Cutoff was 11:30 — tomorrow, be early.",
  "Kitchen says no. It's past 11:30 and the vessels are already on fire (the good kind). Tomorrow, champ.",
  "Too late da. The chef counts plates, not feelings. Order window closed at 11:30 sharp.",
]

const NO_CANCEL_LINES = [
  "Can't cancel now — it's past 11:30 and your plate is already becoming food. Eat it with pride. 🍛",
  "The kitchen has already committed to your plate. Cancelling now would break the chef's heart AND the count.",
  "Past 11:30, cancellations go straight to /dev/null. Your lunch is happening. Enjoy it.",
]

const THANKS_LINES = [
  "Anytime! I work for compliments and exactly zero plates. 🍛",
  "You're welcome. Tell the chef, not me — the chef does the hard part.",
  "No mention da. Now go drink water also.",
  "My pleasure. I'm a bot, this register is literally my whole life.",
]

const MENU_LINES = [
  "The menu is the chef's classified document. Historically: 100% edible, 0% predictable, occasionally legendary.",
  "Menu? It's a surprise mechanic. Like a loot box, but with sambar odds.",
  "Today's menu: whatever the chef's heart decided this morning. It has never once been wrong.",
  "I don't get menu access — I just count plates. But the smell reports from the kitchen are promising.",
]

const HELLO_LINES = [
  "Hello hello! Type <b>!lunch in</b> for a plate, <b>!lunch out</b> to cancel, or just <b>!lunch</b> for today's count.",
  "Vanakkam 🙏 I do three things: <b>in</b>, <b>out</b>, and counting plates. Pick one.",
]

const CONFUSED_LINES = [
  "I understood exactly none of that, but I respect the energy. Try <b>!lunch in</b>, <b>!lunch out</b>, or <b>!lunch</b>.",
  "That's above my pay grade (my pay is zero). I know <b>in</b>, <b>out</b>, and counting. That's the whole résumé.",
  "Hmm, not in my vocabulary. I'm a lunch bot, not ChatGPT. <b>!lunch in</b> / <b>!lunch out</b> / <b>!lunch</b>.",
  "Error 404: command not found. Found instead: hunger. Type <b>!lunch in</b>.",
]

/* ---------------- member matching ---------------- */

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

/* ---------------- handler ---------------- */

Deno.serve(async (req) => {
  if (req.method !== 'POST') return say('The lunch bot only answers in Campfire. Type <b>!lunch in</b> there.')

  try {
    const payload = await req.json().catch(() => ({}))
    // Single-word bots (!in, !out) carry their action in the Command
    // URL as ?do=in / ?do=out. The !lunch bot passes the typed words.
    const forced = (new URL(req.url).searchParams.get('do') || '').trim().toLowerCase()
    const cmd = forced || (payload.command || '').trim().toLowerCase()
    const creator = payload.creator || {}

    /* ---- small talk first: no roster lookup needed ---- */
    if (/\b(thank|thanks|thankyou|thx|nandri|ok|okay|super|nice)\b/.test(cmd) && !/\b(in|out)\b/.test(cmd)) {
      return say(pick(THANKS_LINES))
    }
    if (/\bmenu\b|what.*(cook|food|eat)/.test(cmd)) {
      return say(pick(MENU_LINES))
    }
    if (/^(hi|hello|hey|vanakkam|yo)\b/.test(cmd)) {
      return say(pick(HELLO_LINES))
    }
    if (/^help$/.test(cmd)) {
      return say('Commands: <b>!lunch in</b> (grab a plate), <b>!lunch out</b> (cancel), <b>!lunch</b> (today\'s count). Orders close at <b>11:30</b>.')
    }

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
    const wantsIn = /\b(in|yes|add|me)\b/.test(cmd)
    const wantsOut = /\b(out|no|cancel|remove)\b/.test(cmd)
    const pastCutoff = nowISTMinutes() >= CUTOFF_MIN

    /* ---------- in ---------- */
    if (wantsIn && !wantsOut) {
      if (pastCutoff) return say(pick(TIMES_UP_LINES))
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

    /* ---------- out ---------- */
    if (wantsOut) {
      if (pastCutoff) return say(pick(NO_CANCEL_LINES))
      if (!existing) return say(`<b>${member.name}</b>, you weren't on today's list — nothing to cancel.`)

      await db.from('lunch_entries').delete().eq('id', existing.id)

      const { count } = await db
        .from('lunch_entries')
        .select('*', { count: 'exact', head: true })
        .eq('lunch_date', date)

      await notifyChefIfLate(db, date, member, 'removed', count)
      return say(`<b>${member.name}</b> is OUT for today. Down to <b>${count}</b> plates.`)
    }

    /* ---------- bare !lunch → status ---------- */
    if (cmd === '' || /^(status|count|list|today)$/.test(cmd)) {
      const { count } = await db
        .from('lunch_entries')
        .select('*', { count: 'exact', head: true })
        .eq('lunch_date', date)

      const cutoffNote = pastCutoff ? ' Orders are closed for today (11:30 passed).' : ' Orders close at 11:30.'
      return say(
        `Today (${date}): <b>${count}</b> plates.` +
        (existing
          ? ` You're <b>in</b>, ${member.name}.`
          : ` You're <b>not in</b> yet, ${member.name}.${pastCutoff ? '' : ' Type <b>!lunch in</b> to grab a plate.'}`) +
        cutoffNote
      )
    }

    /* ---------- anything else ---------- */
    return say(pick(CONFUSED_LINES))
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