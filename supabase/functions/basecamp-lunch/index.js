// basecamp-lunch — the Command URL behind the Basecamp "!lunch" chatbot.
//
// Commands (also works via single-word bots using ?do=in / ?do=out):
//   !lunch in       → books you for the NEXT lunch day — works ONLY
//                     during the order window, 5:00–6:30 PM (Sun–Thu)
//   !lunch out      → cancels that booking — same window only
//   !lunch          → today's + next day's count + window status
//   !lunch menu     → a funny non-answer (the chef keeps secrets)
//   !lunch thanks / hi / anything else → the bot has jokes
//
// ORDER WINDOW: 5:00–6:30 PM IST the evening before, Sun–Thu.
// Sunday's window orders for Monday. Outside the window everything
// is closed — no joins, no cancels (cancel attempts get the lecture).
//
// DEPLOY: config.toml entry with verify_jwt = false, then
//         supabase functions deploy basecamp-lunch
import { admin, todayIST, tomorrowIST, nextLunchDateIST, isWeekendIST, orderWindowOpen, claimSend } from '../_shared/lib.js'

const say = (html) =>
  new Response(html, {
    status: 200,
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  })

const pick = (arr) => arr[Math.floor(Math.random() * arr.length)]

/* ---------------- the bot's personality ---------------- */

const WINDOW_CLOSED_LINES = [
  "Window's shut. Orders: <b>5:00–6:30 PM</b>. ⏰",
  "Not order time. <b>5:00–6:30 PM</b> only. 😴",
  "Register naps outside <b>5:00–6:30 PM</b>. See you then. 🍛",
  "Closed. Set a 5 PM alarm, champion. ⏰",
]

const NO_CANCEL_SPEECH = [
  "Too late ⏰ The vessels are ON. Non-cancellable. Eat healthy, bye. 🍛",
  "Cancel? The kitchen already counted your plate. Denied. 👋",
  "No food waste here. Your plate is happening. Be grateful. 🍛",
]

const SLEEPY_LINES = [
  "Same answer. Sleeping now. 😴",
  "Scroll up. Nothing changed. 💻",
  "The plate stays. Bot off duty. 🛌",
  "Bro. Same answer. Bye again. 👋",
]

const THANKS_LINES = [
  "Happy to help. Lunch plans stay on track.",
  "You're welcome. One less thing to worry about today.",
  "Glad I could help. Enjoy your meal.",
  "Thanks received. Lunch operations continue as normal.",
  "Appreciate it. The lunch count remains accurate.",
  "Always here for the important things. Like food.",
  "You're all set. Time to think about lunch.",
  "Pleasure. Keeping lunch organized is what I do.",
  "Thank you. The kitchen would approve.",
  "Message received. Hunger management in progress.",
  "Glad to help. Now go enjoy your break.",
  "You're welcome. Another successful lunch update.",
  "Thanks noted. Team lunch harmony preserved.",
  "Happy to assist. Lunch logistics are serious business.",
  "Appreciate the kindness. Food waits for no one."
]

const MENU_LINES = [
  "Classified. Historically 100% edible. 🍛",
  "Menu is a surprise mechanic. Sambar odds unknown.",
  "Whatever the chef's heart decided. Never once wrong.",
  "I count plates, not curries.",
]

const HELLO_LINES = [
  "Hello! <b>!lunch in</b> (5:00–6:30 PM) books tomorrow. <b>!lunch</b> = count.",
  "Vanakkam 🙏 in / out / count. Window: 5:00–6:30 PM.",
]

const CONFUSED_LINES = [
  "Not in my vocabulary. Try <b>!lunch in</b> / <b>out</b> / <b>!lunch</b>.",
  "Error 404. Found: hunger. <b>!lunch in</b>.",
  "I know in, out, counting. That's the résumé.",
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
      return say('<b>in</b> = book tomorrow · <b>out</b> = cancel · <b>!lunch</b> = count. Window: <b>5:00–6:30 PM</b>, Sun–Thu.')
    }

    const db = admin()
    const date = todayIST()
    const weekend = isWeekendIST()
    const windowOpen = orderWindowOpen()
    // Orders always target the NEXT working lunch day (never Sat/Sun).
    // Sun–Thu window → tomorrow; Fri/Sat → Monday.
    const nextDate = nextLunchDateIST()
    const nextWord = nextDate === tomorrowIST() ? `tomorrow (${nextDate})` : `Monday (${nextDate})`

    const { data: members } = await db
      .from('members')
      .select('id, name, email, food_pref, active')
      .eq('active', true)

    const member = matchMember(members ?? [], creator)
    if (!member) {
      return say(`Sorry ${creator.name || 'there'} — not on the roster. Ask the admin to match your email.`)
    }

    // Entry on the ordering target: the next working lunch day
    const { data: existing } = await db
      .from('lunch_entries')
      .select('id')
      .eq('member_id', member.id)
      .eq('lunch_date', nextDate)
      .maybeSingle()

    const pref = member.food_pref === 'veg' ? '🟢 veg' : '🔴 non-veg'
    const wantsIn = /\b(in|yes|add|me)\b/.test(cmd)
    const wantsOut = /\b(out|no|cancel|remove)\b/.test(cmd)

    /* ---------- in ---------- */
    if (wantsIn && !wantsOut) {
      if (!windowOpen) {
        return say(pick(WINDOW_CLOSED_LINES) + (weekend ? ' Monday orders: <b>Sunday 5 PM</b>.' : ''))
      }
      if (existing) return say(`<b>${member.name}</b>, already in for ${nextWord} (${pref}). 🍛`)

      const { error } = await db
        .from('lunch_entries')
        .insert({ member_id: member.id, lunch_date: nextDate })
      if (error) throw error

      const { count } = await db
        .from('lunch_entries')
        .select('*', { count: 'exact', head: true })
        .eq('lunch_date', nextDate)

      return say(`<b>${member.name}</b> IN for ${nextWord} (${pref}). <b>${count}</b> plates. 🍛`)
    }

    /* ---------- out ---------- */
    if (wantsOut) {
      if (windowOpen) {
        if (!existing) return say(`<b>${member.name}</b>, not on ${nextWord}'s list — nothing to cancel.`)

        await db.from('lunch_entries').delete().eq('id', existing.id)

        const { count } = await db
          .from('lunch_entries')
          .select('*', { count: 'exact', head: true })
          .eq('lunch_date', nextDate)

        return say(`<b>${member.name}</b> OUT for ${nextWord}. <b>${count}</b> plates.`)
      }

      // Window closed — nothing can be cancelled anymore.
      if (existing) {
        // Booked for the next lunch day and trying to back out late →
        // first attempt gets the full lecture, then sleepy replies.
        const firstDeny = await claimSend(db, 'bc_cancel_deny', nextDate, member.id)
        return say(firstDeny ? pick(NO_CANCEL_SPEECH) : pick(SLEEPY_LINES))
      }
      const { data: todayEntry } = await db
        .from('lunch_entries')
        .select('id')
        .eq('member_id', member.id)
        .eq('lunch_date', date)
        .maybeSingle()
      if (todayEntry) {
        // Today's plate is already cooking — same lecture applies.
        const firstDeny = await claimSend(db, 'bc_cancel_deny', date, member.id)
        return say(firstDeny ? pick(NO_CANCEL_SPEECH) : pick(SLEEPY_LINES))
      }
      return say(pick(WINDOW_CLOSED_LINES))
    }

    /* ---------- bare !lunch → status ---------- */
    if (cmd === '' || /^(status|count|list|today|tomorrow)$/.test(cmd)) {
      const [{ count: todayCount }, { count: nextCount }] = await Promise.all([
        db.from('lunch_entries').select('*', { count: 'exact', head: true }).eq('lunch_date', date),
        db.from('lunch_entries').select('*', { count: 'exact', head: true }).eq('lunch_date', nextDate),
      ])

      return say(
        (weekend ? `Weekend — no lunch. 🌴 ` : `Today: <b>${todayCount}</b> plates. `) +
        `${nextWord}: <b>${nextCount}</b>. You're <b>${existing ? 'in' : 'not in'}</b>, ${member.name}. ` +
        (windowOpen ? `Window <b>OPEN</b> till 6:30 PM.` : `Window: <b>5:00–6:30 PM</b>${weekend ? ' Sunday' : ''}.`)
      )
    }

    /* ---------- anything else ---------- */
    return say(pick(CONFUSED_LINES))
  } catch (err) {
    console.error(err)
    return say('Something broke on the register side. Try again in a minute, or use the dashboard.')
  }
})
// (Chef +1/−1 mails removed: the order window closes at 6:30 PM the
// evening before, so the 11:00 chef list is always final.)