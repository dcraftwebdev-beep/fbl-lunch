# Firebrand Lunch Bot, Content Inventory (for the content writer)

This lists every piece of text the lunch system shows or sends, so you can
rewrite the copy. For each item: where it lives, when it fires, and the
current text. Keep placeholders like `{name}`, `{date}`, `{count}`,
`{pref}`, `{reason}` exactly as they are. Please avoid the dash characters
"long dash" and "short dash" in the copy; use commas, periods or colons.

Flow in one line: ordering opens at 4:00 PM the evening before for the next
working day, last call 4:30 PM, closes 5:00 PM. Lunch runs Monday to Friday.

---

## 1. Basecamp group posts (automatic)

**1.1 Open post, 4:00 PM** (file: functions/morning-invite)
> 🍛 Lunch list for tomorrow ({date})
> {names}
> Want in? Type !lunch in. Not coming? Type !lunch out.
> Ordering closes at 5:00 PM today. Current count: {count} plates.

**1.2 Last call, 4:30 PM** (file: functions/midday-confirm)
> ⏰ Last call! Lunch ordering for tomorrow ({date}) closes at 5:00 PM.
> {names}
> Not on the list yet? Type !lunch in now. Current count: {count} plates. 🍛

**1.3 Close / final list, 5:00 PM** (file: functions/last-call)
> 🔒 Tomorrow's lunch list ({date}) is final.
> {names}
> {count} plates going to the kitchen. Ordering reopens at 4:00 PM tomorrow. 🍛

**1.4 No cooking announced** (file: functions/kitchen-toggle, when closed)
> 🙅 No office lunch on {date}.
> Reason: {reason}.
> The kitchen is closed that day, please plan to eat outside. 🙏

**1.5 Kitchen reopened** (file: functions/kitchen-toggle, when reopened)
> 🍛 Kitchen is back on for {date}. Order with !lunch in during the 4:00 to 5:00 PM window.

**1.6 Holiday greeting, 9:00 AM on holidays** (file: functions/holiday-wish)
> 🎉 Happy {holiday}!
> Wishing everyone at Firebrand Labs a wonderful {holiday} ({date}). The office kitchen is closed today, enjoy the holiday. 🙏

---

## 2. Bot replies in chat (file: functions/basecamp-lunch)

**2.1 !lunch in, success**
> {name} IN for tomorrow ({date}) ({pref}). {count} plates. 🍛

**2.2 !lunch in, already in**
> {name}, already in for tomorrow ({date}) ({pref}). 🍛

**2.3 !lunch out, success**
> {name} OUT for tomorrow ({date}). {count} plates.

**2.4 !lunch out, not on the list**
> {name}, not on tomorrow ({date})'s list, nothing to cancel.

**2.5 bare !lunch, status**
> Tomorrow ({date}): {count} plates. You're in/not in, {name}. Window OPEN till 5:00 PM.  (or)  Closed. Opens 4:00 PM, Sun to Thu.

**2.6 No cooking day reply**
> 🙅 No office food on {date}. The kitchen is closed that day, please plan to eat outside. 🙏

**2.7 Not on roster**
> Sorry {name}, not on the roster. Ask the admin to match your email.

**2.8 Rotating line pools (rewrite each line in the array)**
- WINDOW_CLOSED_LINES (4 lines): shown when someone orders outside 4 to 5 PM.
- NO_CANCEL_SPEECH (3) and SLEEPY_LINES (4): shown when someone tries to cancel after close.
- THANKS_LINES (15): replies to "thanks".
- HELLO_LINES (2): replies to "hi".
- MENU_LINES (4): replies to "menu".
- CONFUSED_LINES (3): replies to anything unrecognised.
- The one-line "help" response.

---

## 3. Member emails

**3.1 Open invite, member already in, 4:00 PM** (file: functions/morning-invite)
- Subject: You're in for lunch tomorrow ({date})
- Title: You're in for lunch tomorrow 🍛
- Body: confirms the {pref} plate, "Cancel my lunch" button, "Message the lunch group" button, note that ordering closes 5:00 PM.

**3.2 Open invite, member not in, 4:00 PM** (file: functions/morning-invite)
- Subject: Lunch tomorrow? One click to order ({date})
- Title: Want lunch tomorrow? 🍛
- Body: "Yes, add me for tomorrow" button, "Message the lunch group" button, note closes 5:00 PM.

**3.3 Confirmation when added on the dashboard** (file: functions/notify-change)
- Subject: You're in for lunch tomorrow ({date})
- Title: You're in for lunch tomorrow 🍛
- Body: "Cancel my lunch" + "Message the lunch group" buttons.

**3.4 Daily "sorted" mail, 5:00 PM** (file: functions/daily-funny, ordered)
- Subject: You're sorted for lunch tomorrow 🍛
- Title: You're sorted for tomorrow ✅
- Body: one rotating line from ORDERED_LINES (15 lines in functions/_shared/lib.js). Rewrite all 15.

**3.5 Daily "missed" mail, 5:00 PM** (file: functions/daily-funny, not ordered)
- Subject: No lunch for tomorrow?? 👀
- Title: No lunch marked for tomorrow 👀
- Body: one rotating line from NOT_ORDERED_LINES (15 lines in functions/_shared/lib.js). Rewrite all 15.

**3.6 One-click result pages** (files: functions/join-lunch, functions/cancel-lunch)
- Short confirmation / error pages shown in the browser after clicking an email button (for example "You're in", "Lunch cancelled", "Too late to cancel", "Link expired").

---

## 4. Chef and admin emails

**4.1 Chef list, 5:00 PM** (file: functions/send-chef-list, goes to chef + Mani)
- Subject: Tomorrow's lunch: {count} plates ({date})
- Body: counts, veg / non-veg split, the names, guests and note.

**4.2 Plus one / minus one updates** (files: functions/join-lunch, cancel-lunch, notify-change)
- Subject: Lunch +1 / Lunch -1: {name}, now {count} plates ({date})
- Short note that someone joined or cancelled after the list went out.

**4.3 Weekly report, Friday 6:00 PM** (file: functions/weekly-report, goes to Mani)
- Subject: Weekly lunch report ({from} to {to})
- Body: week summary, with the full register attached as an Excel file.

---

## 5. Where the long rotating lists live
Open `supabase/functions/_shared/lib.js` and search for `ORDERED_LINES` and
`NOT_ORDERED_LINES` for the two 15 line pools. Open
`supabase/functions/basecamp-lunch/index.js` for the chat reply pools in
section 2.8. Rewrite the lines inside each array, keeping the same number of
lines and any placeholders.
