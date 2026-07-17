# Firebrand Labs · Lunch Register

An internal dashboard for the daily lunch roll call. Type `@` to call the roster,
mark who's in, track guest plates, review the last 10 days in a single register
table, and download an Excel report for any date range.

Built with React + Vite, CSS Modules, and Supabase. No Tailwind, no Next.js.

---

## Run it right now (demo mode)

The app works straight out of the zip — no Supabase needed. Without keys it runs
on localStorage with a seeded demo roster so you can try every feature.

```bash
npm install
npm run dev
```

Opens at http://localhost:5173

---

## Go live with Supabase (5 minutes)

1. **Create a project** at [supabase.com](https://supabase.com) (free tier is enough).

2. **Create the tables.** In the Supabase dashboard, open **SQL Editor → New query**,
   paste the contents of `supabase/schema.sql`, and click **Run**. This creates
   three tables — `members`, `lunch_entries`, `day_meta` — with the right
   constraints and open RLS policies for internal use.

3. **Add your keys.** Copy `.env.example` to `.env` and fill in both values from
   **Project Settings → API**:

   ```
   VITE_SUPABASE_URL=https://your-project-ref.supabase.co
   VITE_SUPABASE_ANON_KEY=your-anon-public-key
   ```

4. **Restart the dev server.** The header badge switches from "Demo mode" to
   "Supabase · live". Everyone on the team who opens the app now shares the
   same register.

5. **Seed the roster** either from the Team roster panel in the app, or by
   uncommenting and editing the `insert into members` block at the bottom of
   `schema.sql`.

> Demo-mode data lives only in your browser's localStorage. It does not migrate
> to Supabase — add your real roster after going live.

---

## Email system (Resend + Edge Functions)

All mail goes out as **Firebrand Lunch <lunch@firebrandlabs.in>** via Resend.

**EVENING ORDERING FLOW (lunch days: Mon–Fri):** lunch is ordered the evening
before, inside a strict **order window: 5:00–6:30 PM IST, Sun–Thu**. The 5 PM
invite opens tomorrow's register (email button + Basecamp `!lunch in`) —
Sunday's window orders for Monday. At 6:15 PM a last call fires; at 6:30 PM
the window closes and no joins or cancels are possible anywhere (email links,
Basecamp bot, everything). Friday 5 PM sends only a funny "kitchen closed,
see you Monday" message; Saturday nothing goes out. The dashboard's today
panel locks at 6:30 PM.

| Flow | Function | When |
|---|---|---|
| Evening invite — "Lunch tomorrow?" one-click button + Basecamp announcement | `evening-invite` | Cron 17:00 IST Sun–Thu (window opens) |
| Last-call reminder in Basecamp — 15 minutes to close | `last-call` | Cron 18:15 IST Sun–Thu |
| Weekend funny — "kitchen closed, see you Monday" mail + Basecamp post | `weekend-funny` | Cron 17:00 IST Friday |
| Chef gets the day's list (count, names, veg/non-veg, guests, note) | `send-chef-list` | Cron 11:00 IST Mon–Fri, or the dashboard button any time |
| Member confirmations for everyone on today's register (plate locked) | `midday-confirm` | Cron 11:01 IST Mon–Fri |
| Member confirmation with a one-click **Cancel my lunch** button (valid till 6:30 PM) | `notify-change` | The moment they're marked in |
| Daily funny mail — banter for skippers, motivation for orderers, rotating lines | `daily-funny` | Cron 11:15 IST Mon–Fri |

> `morning-invite` (10 AM same-day invite) is retired — replaced by `evening-invite`.

### Deploy steps (one time, ~15 minutes)

1. **Resend**: sign up at resend.com, verify the `firebrandlabs.in` domain
   (Domains → Add → add the DNS records they show), then create an API key.

2. **Database**: existing projects run `supabase/migration-v2.sql` in the SQL
   Editor (fresh installs: `schema.sql` already contains everything).

3. **Install the Supabase CLI** and link the project:
   ```bash
   npm i -g supabase
   supabase login
   supabase link --project-ref YOUR-PROJECT-REF
   ```

4. **Set the Resend key as a function secret**:
   ```bash
   supabase secrets set RESEND_API_KEY=re_xxxxxxxxx
   ```

5. **Deploy the functions** — they're plain JavaScript (`index.js` entrypoints,
   supported by the current Supabase CLI; run `npm i -g supabase` to update if
   yours is old). `cancel-lunch` must skip JWT checks so the email link works
   without login:
   ```bash
   supabase functions deploy send-chef-list
   supabase functions deploy notify-change
   supabase functions deploy daily-funny
   supabase functions deploy cancel-lunch --no-verify-jwt
   ```

6. **Schedule the crons**: open `supabase/cron.sql`, replace
   `YOUR-PROJECT-REF` and `YOUR-SERVICE-ROLE-KEY` (Project Settings → API →
   service_role), and run it in the SQL Editor.

7. **On the dashboard**: fill the chef's name, email and photo URL in the
   kitchen card, and add each member's email in the Team roster panel.
   Members without an email simply don't get mails — everything else works.

Test it: mark yourself in, and you should receive the confirmation mail with
the cancel button within seconds. Click "Send today's list now" to test the
chef mail without waiting for 11:00.

---

## What's inside

| Feature | Where |
|---|---|
| `@` roll-call with autocomplete, arrow keys, Enter to add | Today panel |
| Chips of today's members — click a chip to remove | Today panel |
| Guest plates counter + note for the caterer | Today panel |
| Copy yesterday's list in one click | Today panel |
| Plates to order today, veg / non-veg split, 10-day average, most regular | Stats card |
| 10-day register, every cell click-to-toggle (past-day corrections included) | Register table |
| Veg / non-veg FSSAI-style marks on every member everywhere | Throughout |
| Excel download with From/To date filters + presets | Download panel |
| Two sheets per export: full Register matrix + Daily summary | `src/lib/exportExcel.js` |
| Roster management: add with email, edit email inline, switch veg/non-veg, mark as left, remove with confirm | Team roster panel |
| Optimistic updates with rollback + toasts | `src/hooks/useLunchData.js` |
| Chef card: photo, name, email, manual send button | Kitchen card |
| Demo mode fallback when no Supabase keys are present (emails disabled) | `src/lib/store.js` |

## Production build

```bash
npm run build     # outputs to dist/
npm run preview   # test the production build locally
```

Deploy `dist/` anywhere static (Vercel, Netlify). On Vercel, add the two
`VITE_SUPABASE_*` variables under Project → Settings → Environment Variables.

## Stack

- React 18 + Vite 5, JSX
- CSS Modules with a token system in `src/styles/global.css`
- `@supabase/supabase-js` for data
- `xlsx` (SheetJS) for Excel export
- `date-fns` for dates
