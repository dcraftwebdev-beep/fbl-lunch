// Shared helpers for the Lunch Register edge functions (Deno runtime, plain JS).
import { createClient } from 'npm:@supabase/supabase-js@2'

export const FROM = 'Firebrand Lunch <lunch@firebrandlabs.in>'

export const admin = () =>
  createClient(
    Deno.env.get('SUPABASE_URL'),
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  )

export const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

export const json = (body, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' },
  })

export async function sendEmail(to, subject, html) {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${Deno.env.get('RESEND_API_KEY')}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ from: FROM, to, subject, html }),
  })
  if (!res.ok) throw new Error(`Resend ${res.status}: ${await res.text()}`)
}

// Today's date in IST (server runs in UTC)
export const todayIST = () =>
  new Date(Date.now() + 5.5 * 3600 * 1000).toISOString().slice(0, 10)

export const dayOfYear = () => {
  const now = new Date(Date.now() + 5.5 * 3600 * 1000)
  return Math.floor(
    (now.getTime() - Date.UTC(now.getUTCFullYear(), 0, 0)) / 86400000
  )
}

// Try to insert into email_log; returns false if this exact email already went out.
export async function claimSend(db, kind, lunch_date, member_id = null) {
  const { error } = await db.from('email_log').insert({ kind, lunch_date, member_id })
  if (error) {
    if (error.code === '23505') return false // duplicate — already sent
    throw error
  }
  return true
}

export async function chefListSent(db, date) {
  const { data } = await db
    .from('email_log')
    .select('id')
    .eq('kind', 'chef_list')
    .eq('lunch_date', date)
    .limit(1)
  return (data?.length ?? 0) > 0
}

/* ---------------- email shell ---------------- */
 
export const shell = (title, body) => `
<div style="font-family:Arial,Helvetica,sans-serif;background:#f6f7f2;padding:24px">
  <div style="max-width:520px;margin:0 auto;background:#ffffff;border:1px solid #e3e7de;border-radius:12px;overflow:hidden">
    <div style="background:#17452b;color:#f6f7f2;padding:16px 22px">
      <div style="font-size:11px;letter-spacing:2px;text-transform:uppercase;color:#a8c5b2">Firebrand Labs</div>
      <div style="font-size:19px;font-weight:bold">${title}</div>
    </div>
    <div style="padding:22px;color:#1c221d;font-size:15px;line-height:1.55">${body}</div>
    <div style="padding:12px 22px;border-top:1px solid #e3e7de;color:#5a645c;font-size:12px">
      firebrand labs · internal lunch register
    </div>
  </div>
</div>`
 
/* ---------------- rotating daily messages ---------------- */
 
// For members who did NOT order — one line per day, cycles through the pool.
export const NOT_ORDERED_LINES = [
  "Don't eat outside bro, your stomach is going to burn. Fresh food is cooking right here in the office. 🔥",
  'No lunch marked. Are you planning to photosynthesize today?',
  "Roadside kaara saapadu when there's a kitchen INSIDE the office? Your gut has filed a complaint with HR.",
  'The office kitchen cooked without you today. The rasam asked about you.',
  "You skipped the register. Coffee is a beverage, not a meal plan.",
  'Outside food today? Bold. Your stomach lining says otherwise.',
  'Hot lunch was made a few steps from your desk. You chose chaos instead.',
  "No plate marked. Even your keyboard gets charged daily — feed yourself too.",
  'Eating out daily is a lifestyle. So is antacid. Choose wisely.',
  "The register waited till 11. You ghosted it. It's not angry, just disappointed.",
  'Street food roulette when home-style food is cooking in the office? The house always wins, and the house is your stomach.',
  "No lunch entry found. Initiating rescue mission: type @ tomorrow.",
  'Skipping fresh office-kitchen food to "grab something" — we both know that means chips.',
  "Your tummy called. It said the outside oil is doing renovations it never approved.",
  'One @ a day keeps the gastroenterologist away. Just saying.',
]
 
// For members who DID order — motivation / light praise, one per day.
export const ORDERED_LINES = [
  'Lunch marked like a responsible adult. Your plate is on the stove. ✅',
  "Good one — the kitchen is counting you in today. Health conscious and deadline conscious. Rare combo.",
  "Plate confirmed. Fresh from the office kitchen, not some mystery cloud kitchen.",
  "You marked lunch before 11. Discipline level: filter coffee without sugar.",
  'On the list, on time. The kitchen knows exactly how much to cook because of people like you.',
  "Hot office-kitchen lunch today — your gut microbiome is throwing a small party.",
  'Marked your plate like a pro. Client servicing could learn from this follow-through.',
  "Good call. Fresh-cooked office food beats mystery oil, 10 matches out of 10.",
  'You chose the kitchen over roadside risk. Character development.',
  "Lunch secured, cooked fresh in the office. Go win the afternoon — carbs are on your side.",
  'Consistent lunch marker spotted. Promote this person (to the front of the serving line).',
  "Plate marked. That's what we call a high-conviction, low-risk decision.",
  'Your stomach saw the confirmation mail and did a little flip. Of joy, this time.',
  "On the list again. At this rate you'll be Most Regular on the dashboard.",
  "Smart. Fed people ship better work — it's basically science.",
]
 