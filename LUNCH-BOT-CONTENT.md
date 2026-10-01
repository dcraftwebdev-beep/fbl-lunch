# Firebrand Lunch Bot, Content to Rewrite

Hand this to the content writer. Every message the system shows or sends is
below, title by title, with the current text under each title.

Rules for the writer:
- Keep the placeholders in curly braces exactly: {name}, {date}, {count},
  {pref} (veg or non-veg), {names}, {reason}, {holiday}, {from}, {to}.
- Please avoid the long dash and the short dash. Use commas, periods or colons.
- Keep each list the same number of lines.

How the flow works: ordering opens at 4:00 PM the evening before, for the next
working day. Last call is 4:30 PM. It closes 5:00 PM. Lunch runs Monday to
Friday.

---

## A. Group chat posts (automatic, in Basecamp)

### A1. Open post, 4:00 PM
🍛 Lunch list for tomorrow ({date})
{names}
Want in? Type !lunch in. Not coming? Type !lunch out.
Ordering closes at 5:00 PM today. Current count: {count} plates.

### A2. Last call, 4:30 PM
⏰ Last call! Lunch ordering for tomorrow ({date}) closes at 5:00 PM.
{names}
Not on the list yet? Type !lunch in now. Current count: {count} plates. 🍛

### A3. Close and final list, 5:00 PM
🔒 Tomorrow's lunch list ({date}) is final.
{names}
{count} plates going to the kitchen. Ordering reopens at 4:00 PM tomorrow. 🍛

### A4. Kitchen closed (no cooking)
🙅 No office lunch on {date}.
Reason: {reason}.
The kitchen is closed that day, please plan to eat outside. 🙏

### A5. Kitchen reopened
🍛 Kitchen is back on for {date}. Order with !lunch in during the 4:00 to 5:00 PM window.

### A6. Holiday greeting, 9:00 AM on a holiday
🎉 Happy {holiday}!
Wishing everyone at Firebrand Labs a wonderful {holiday} ({date}). The office kitchen is closed today, enjoy the holiday. 🙏

---

## B. Bot chat replies (when a member types a command)

### B1. !lunch in, success
{name} IN for tomorrow ({date}) ({pref}). {count} plates. 🍛

### B2. !lunch in, already in
{name}, already in for tomorrow ({date}) ({pref}). 🍛

### B3. !lunch out, success
{name} OUT for tomorrow ({date}). {count} plates.

### B4. !lunch out, nothing to cancel
{name}, not on tomorrow ({date})'s list, nothing to cancel.

### B5. !lunch, status
Tomorrow ({date}): {count} plates. You're in or not in, {name}. Window OPEN till 5:00 PM.
When closed: Closed. Opens 4:00 PM, Sun to Thu.

### B6. No cooking day reply
🙅 No office food on {date}. The kitchen is closed that day, please plan to eat outside. 🙏

### B7. Not on the roster
Sorry {name}, not on the roster. Ask the admin to match your email.

---

## C. Member emails

### C1. Open invite, member already in (4:00 PM)
Subject: You're in for lunch tomorrow ({date})
Heading: You're in for lunch tomorrow 🍛
Body: Hi {name}, you're booked for a {pref} plate tomorrow. Not coming? Take yourself off the list in one click.
Buttons: [Cancel my lunch] [Message the lunch group]
Footer line: Ordering for tomorrow closes at 5:00 PM today.

### C2. Open invite, member not in yet (4:00 PM)
Subject: Lunch tomorrow? One click to order ({date})
Heading: Want lunch tomorrow? 🍛
Body: Hi {name}, the kitchen is cooking tomorrow. Want a fresh {pref} plate?
Buttons: [Yes, add me for tomorrow] [Message the lunch group]
Footer line: Ordering closes at 5:00 PM today. Prefer chat? Type !lunch in in the group.

### C3. Confirmation when added on the dashboard
Subject: You're in for lunch tomorrow ({date})
Heading: You're in for lunch tomorrow 🍛
Body: Hi {name}, your {pref} plate is booked for tomorrow. Changed your mind? Take yourself off the list in one click.
Buttons: [Cancel my lunch] [Message the lunch group]
Footer line: Ordering closes at 5:00 PM. Do nothing and your plate gets cooked.

### C4. Daily sorted mail (5:00 PM, for people who are in)
Subject: You're sorted for lunch tomorrow 🍛
Heading: You're sorted for tomorrow ✅
Small line under heading: You're on the list for tomorrow
Body: Hi {name}, then one rotating line from list E1 below, then: You're on tomorrow's list. Nothing more to do. 🍛

### C5. Daily missed mail (5:00 PM, for people not in)
Subject: No lunch for tomorrow?? 👀
Heading: No lunch marked for tomorrow 👀
Small line under heading: You missed tomorrow's register
Body: Hi {name}, then one rotating line from list E2 below, then: Next time, type !lunch in in Basecamp before 5:00 PM to grab a plate.

### C6. One-click result pages (shown in the browser after an email button)
- You're in, {name} 🍛 . Veg or Non-veg plate booked for {date}.
- Already on the list, {name} . Your plate for {date} is already marked. 🍛
- Lunch cancelled, {name} . Your plate is off the list. Rebook with the email button or !lunch in during the 4:00 to 5:00 PM window.
- Too late to cancel . Ordering has closed. Your plate is locked and will be cooked. 🍛
- Link expired . Old link, it was only good for its own lunch day.
- Ordering closed . Ordering runs 4:00 to 5:00 PM the evening before. Please try in that window.

---

## D. Chef and admin emails

### D1. Chef list (5:00 PM, to the chef and to Mani)
Subject: Tomorrow's lunch: {count} plates ({date})
Body: Hi {chef or Mani}, here's the lunch list for {date}. Then the totals (total, veg, non-veg, guests), the list of names, and the day note if there is one.

### D2. Plus one update (someone joined after the list went out)
Subject: Lunch +1: {name}, now {count} plates ({date})
Body: {name} ({pref}) joined for {date} after the list went out. New team count: {count} plates.

### D3. Minus one update (someone cancelled after the list went out)
Subject: Lunch -1: {name}, now {count} plates ({date})
Body: {name} cancelled their plate for {date}. New team count: {count} plates.

### D4. Weekly report (Friday 6:00 PM, to Mani)
Subject: Weekly lunch report ({from} to {to})
Body: Hi Mani, here is this week's lunch register. Week: {from} to {to}. Total plates served: {count}. The full register and daily summary are attached as an Excel file.

---

## E. Rotating line pools (rewrite every line, keep the same count)

### E1. ORDERED_LINES (15 lines, used in the sorted mail C4)
1. Lunch marked like a responsible adult. Your plate is on the stove. ✅
2. Good one, the kitchen is counting you in today. Health conscious and deadline conscious. Rare combo.
3. Plate confirmed. Fresh from the office kitchen, not some mystery cloud kitchen.
4. You marked lunch in time. Discipline level: filter coffee without sugar.
5. On the list, on time. The kitchen knows exactly how much to cook because of people like you.
6. Hot office-kitchen lunch today, your gut microbiome is throwing a small party.
7. Marked your plate like a pro. Client servicing could learn from this follow-through.
8. Good call. Fresh-cooked office food beats mystery oil, 10 matches out of 10.
9. You chose the kitchen over roadside risk. Character development.
10. Lunch secured, cooked fresh in the office. Go win the afternoon, carbs are on your side.
11. Consistent lunch marker spotted. Promote this person (to the front of the serving line).
12. Plate marked. That's what we call a high-conviction, low-risk decision.
13. Your stomach saw the confirmation mail and did a little flip. Of joy, this time.
14. On the list again. At this rate you'll be Most Regular on the dashboard.
15. Smart. Fed people ship better work, it's basically science.

### E2. NOT_ORDERED_LINES (15 lines, used in the missed mail C5)
1. Don't eat outside bro, your stomach is going to burn. Fresh food is cooking right here in the office. 🔥
2. No lunch marked. Are you planning to photosynthesize today?
3. Roadside kaara saapadu when there's a kitchen INSIDE the office? Your gut has filed a complaint with HR.
4. The office kitchen cooked without you today. The rasam asked about you.
5. You skipped the register. Coffee is a beverage, not a meal plan.
6. Outside food today? Bold. Your stomach lining says otherwise.
7. Hot lunch was made a few steps from your desk. You chose chaos instead.
8. No plate marked. Even your keyboard gets charged daily, feed yourself too.
9. Eating out daily is a lifestyle. So is antacid. Choose wisely.
10. The register waited for you. You ghosted it. It's not angry, just disappointed.
11. Street food roulette when home-style food is cooking in the office? The house always wins, and the house is your stomach.
12. No lunch entry found. Initiating rescue mission: order tomorrow.
13. Skipping fresh office-kitchen food to grab something, we both know that means chips.
14. Your tummy called. It said the outside oil is doing renovations it never approved.
15. One order a day keeps the gastroenterologist away. Just saying.

### E3. Chat reply pools (short lines the bot sends in chat)

Window closed (4 lines, when someone orders outside 4 to 5 PM):
1. Window's shut. Ordering opens 4:00 to 5:00 PM (eve before). ⏰
2. Not order time. Open 4:00 to 5:00 PM, Sun to Thu. 😴
3. Register naps outside 4:00 to 5:00 PM. Catch it this evening. 🍛
4. Closed. Type !lunch in between 4 and 5 PM next time. ⏰

No cancel (3 lines, trying to cancel after close):
1. Too late ⏰ The vessels are ON. Non-cancellable. Eat healthy, bye. 🍛
2. Cancel? The kitchen already counted your plate. Denied. 👋
3. No food waste here. Your plate is happening. Be grateful. 🍛

Sleepy (4 lines, repeated cancel attempts):
1. Same answer. Sleeping now. 😴
2. Scroll up. Nothing changed. 💻
3. The plate stays. Bot off duty. 🛌
4. Bro. Same answer. Bye again. 👋

Thanks (15 lines, replies to thanks):
1. Happy to help. Lunch plans stay on track.
2. You're welcome. One less thing to worry about today.
3. Glad I could help. Enjoy your meal.
4. Thanks received. Lunch operations continue as normal.
5. Appreciate it. The lunch count remains accurate.
6. Always here for the important things. Like food.
7. You're all set. Time to think about lunch.
8. Pleasure. Keeping lunch organized is what I do.
9. Thank you. The kitchen would approve.
10. Message received. Hunger management in progress.
11. Glad to help. Now go enjoy your break.
12. You're welcome. Another successful lunch update.
13. Thanks noted. Team lunch harmony preserved.
14. Happy to assist. Lunch logistics are serious business.
15. Appreciate the kindness. Food waits for no one.

Hello (2 lines, replies to hi):
1. Hello! !lunch in (4 to 5 PM, eve before) books tomorrow's plate. !lunch = count.
2. Vanakkam 🙏 in, out, count. Open 4:00 to 5:00 PM, Sun to Thu.

Menu (4 lines, replies to menu):
1. Classified. Historically 100% edible. 🍛
2. Menu is a surprise mechanic. Sambar odds unknown.
3. Whatever the chef's heart decided. Never once wrong.
4. I count plates, not curries.

Confused (3 lines, replies to anything unrecognised):
1. Not in my vocabulary. Try !lunch in, out, or !lunch.
2. Error 404. Found: hunger. !lunch in.
3. I know in, out, counting. That's the resume.

Help line (one line):
in = book tomorrow, out = cancel, !lunch = count. Open 4:00 to 5:00 PM, Sun to Thu.
