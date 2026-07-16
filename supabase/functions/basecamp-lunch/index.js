// basecamp-lunch — the Command URL behind the Basecamp "!lunch" chatbot.
//
// Commands (also works via single-word bots using ?do=in / ?do=out):
//   !lunch in       → adds you to TODAY's register (before 11:15 IST)
//   !lunch out      → cancels your plate (before 11:15 IST)
//   !lunch          → today's count + whether you're in
//   !lunch menu     → a funny non-answer (the chef keeps secrets)
//   !lunch thanks / hi / anything else → the bot has jokes
//
// ORDER CUTOFF: 11:15 IST. After that, in/out are refused with a
// funny "time's up" line — the kitchen has already committed.
// Between 11:00 (chef list) and 11:15, joins/cancels still send the
// chef a +1/−1 mail as before.
//
// DEPLOY: config.toml entry with verify_jwt = false, then
//         supabase functions deploy basecamp-lunch
import { admin, sendEmail, shell, todayIST, chefListSent, claimSend } from '../_shared/lib.js'

const CUTOFF_MIN = 11 * 60 + 15 // 11:15 IST

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
  "Time's up buddy ⏰ The kitchen closed the gates at 11:15. Today you're on your own — tomorrow, type faster.",
  "Nope. 11:15 came and went. The rice has already made its life decisions. See you tomorrow at 10.",
  "The register is closed tighter than the office AC remote drawer. Cutoff was 11:15 — tomorrow, be early.",
  "Kitchen says no. It's past 11:15 and the vessels are already on fire (the good kind). Tomorrow, champ.",
  "Too late da. The chef counts plates, not feelings. Order window closed at 11:15 sharp.",
]

const NO_CANCEL_SPEECH = [
  "Time over buddy ⏰ And wait… why are you even trying to cancel? Fresh, healthy, home-made-style food is cooking for you RIGHT NOW. Let me guess — you changed your mind and want to order outside food, right? 👀 Not happening. Non-cancellable now. Go eat the healthy stuff, thank me later. Bye. 🍛",
  "Cancel? After 11:15? Interesting. The kitchen already counted your plate, the list went to the chef, the vessels are ON. And you want outside oil instead of this home-style goodness? Denied. Eat healthy, live long, bye. 👋",
  "The list already reached the kitchen. If you cancel now, that food goes to WASTE — and this bot does not do food waste. Your plate is happening. It's healthy, it's fresh, it's yours. Go be grateful. Bye. 🍛",
]

const SLEEPY_LINES = [
  "Read my earlier reply again. I already explained everything. I'm sleeping now, don't disturb. 😴",
  "You again? The answer hasn't changed while you were typing. Go and do some work. 💻",
  "Still trying? Respect the persistence, but the plate stays. Bot has gone back to sleep. Do not disturb. 😴",
  "I gave you the full speech already. Scroll up, read it, eat your lunch. This bot is off duty. 🛌",
  "Bro. It's the same answer. Channel this energy into your deadlines instead. Bye again. 👋",
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
      return say('Commands: <b>!lunch in</b> (grab a plate), <b>!lunch out</b> (cancel), <b>!lunch</b> (today\'s count). Orders close at <b>11:15</b>.')
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
      if (pastCutoff) {
        // First attempt today → the full lecture.
        // Every attempt after that → sleepy "don't disturb" replies.
        const firstDeny = await claimSend(db, 'bc_cancel_deny', date, member.id)
        return say(firstDeny ? pick(NO_CANCEL_SPEECH) : pick(SLEEPY_LINES))
      }
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

      const cutoffNote = pastCutoff ? ' Orders are closed for today (11:15 passed).' : ' Orders close at 11:15.'
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