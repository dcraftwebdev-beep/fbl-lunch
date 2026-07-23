// basecamp-lunch — the Command URL behind the Basecamp "!lunch" chatbot.
//
// Commands (also works via single-word bots using ?do=in / ?do=out):
//   !lunch in       → adds you to TODAY's list — works ONLY during the
//                     order window, up to 11:15 AM (Mon–Fri)
//   !lunch out      → cancels that booking — same window only
//   !lunch          → today's count + window status
//   !lunch menu     → a funny non-answer (the chef keeps secrets)
//   !lunch thanks / hi / anything else → the bot has jokes
//
// ORDER WINDOW: morning-only. Open on a lunch day until 11:15 AM IST
// (Mon–Fri). Outside the window everything is closed — no joins, no
// cancels (cancel attempts get the lecture).
//
// DEPLOY: config.toml entry with verify_jwt = false, then
//         supabase functions deploy basecamp-lunch
import { admin, todayIST, isWeekendIST, orderWindowOpen, orderTargetDate, claimSend, fmtDate, isNoCookingDay } from '../_shared/lib.js'

const say = (html) =>
  new Response(html, {
    status: 200,
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  })

const pick = (arr) => arr[Math.floor(Math.random() * arr.length)]

/* ---------------- the bot's personality ---------------- */

const WINDOW_CLOSED_LINES = [
  "Window's shut. Orders close <b>11:15 AM</b>. ⏰",
  "Not order time. Open <b>till 11:15 AM</b>, Mon–Fri. 😴",
  "Register naps after <b>11:15 AM</b>. Catch it tomorrow morning. 🍛",
  "Closed. Type <b>!lunch in</b> before <b>11:15 AM</b> next time. ⏰",
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
  "Hello! <b>!lunch in</b> (before 11:15 AM) books today's plate. <b>!lunch</b> = count.",
  "Vanakkam 🙏 in / out / count. Open till 11:15 AM, Mon–Fri.",
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
      return say('<b>in</b> = add me today · <b>out</b> = cancel · <b>!lunch</b> = count. Open <b>till 11:15 AM</b>, Mon–Fri.')
    }

    const db = admin()
    const date = todayIST()
    const weekend = isWeekendIST()
    const windowOpen = orderWindowOpen()
    // Everything is same-day now: the window only ever orders for TODAY.
    const nextDate = orderTargetDate()
    const nextWord = `today (${fmtDate(nextDate)})`

    // Kitchen closed today? Turn away all in/out/status with a friendly note.
    if (await isNoCookingDay(db, nextDate)) {
      return say(
        `🙅 <b>No office food today (${fmtDate(nextDate)}).</b> ` +
        `Kavitha akka isn't cooking — please eat outside today. 🙏`
      )
    }

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
        return say(pick(WINDOW_CLOSED_LINES) + (weekend ? ' Lunch is Mon–Fri — see you Monday morning. 🌴' : ''))
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
      const { count: todayCount } = await db
        .from('lunch_entries')
        .select('*', { count: 'exact', head: true })
        .eq('lunch_date', date)

      return say(
        (weekend ? `Weekend — no lunch. 🌴 ` : `Today (${fmtDate(date)}): <b>${todayCount}</b> plates. `) +
        `You're <b>${existing ? 'in' : 'not in'}</b>, ${member.name}. ` +
        (windowOpen ? `Window <b>OPEN</b> till 11:15 AM.` : `Closed. Opens ~10 AM, Mon–Fri.`)
      )
    }

    /* ---------- anything else ---------- */
    return say(pick(CONFUSED_LINES))
  } catch (err) {
    console.error(err)
    return say('Something broke on the register side. Try again in a minute, or use the dashboard.')
  }
})
// (Chef +1/−1 mails still fire from join/cancel if someone changes the
// list after the 11:15 AM chef list has gone out.)