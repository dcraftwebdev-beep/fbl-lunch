// weekly-report — Friday 6:00 PM IST. Builds an .xlsx of this week's lunch
// register (Monday to Friday) and emails it to the admin (Mani) as an
// attachment. No-cooking days show "Closed" and do not count.
//
// SCHEDULE: cron `30 12 * * 5`  (12:30 UTC = 6:00 PM IST, Friday)
import { admin, cors, json, fmtDate, ADMIN_EMAIL, sendEmail, shell } from '../_shared/lib.js'
import * as XLSX from 'https://esm.sh/xlsx@0.18.5'

const istNow = () => new Date(Date.now() + 5.5 * 3600 * 1000)
const iso = (d) => d.toISOString().slice(0, 10)

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })

  try {
    const db = admin()

    // Monday to Friday of the current IST week.
    const now = istNow()
    const dow = now.getUTCDay() // 0 Sun .. 6 Sat
    const offsetToMon = dow === 0 ? -6 : 1 - dow
    const monday = new Date(now)
    monday.setUTCDate(now.getUTCDate() + offsetToMon)
    const days = Array.from({ length: 5 }, (_, i) => {
      const d = new Date(monday)
      d.setUTCDate(monday.getUTCDate() + i)
      return iso(d)
    })
    const from = days[0], to = days[4]

    const [{ data: members }, { data: entries }, { data: metas }] = await Promise.all([
      db.from('members').select('id, name, food_pref, active').order('name'),
      db.from('lunch_entries').select('member_id, lunch_date').gte('lunch_date', from).lte('lunch_date', to),
      db.from('day_meta').select('lunch_date, guest_count, no_cooking, no_cooking_reason').gte('lunch_date', from).lte('lunch_date', to),
    ])

    const metaByDate = Object.fromEntries((metas ?? []).map((m) => [m.lunch_date, m]))
    const has = new Set((entries ?? []).map((e) => `${e.member_id}|${e.lunch_date}`))
    const closed = (d) => !!metaByDate[d]?.no_cooking
    const roster = (members ?? []).filter((m) => m.active || (entries ?? []).some((e) => e.member_id === m.id))

    const dayCols = days.map((d) => fmtDate(d))

    // Sheet 1: Register
    const header = ['Member', 'Pref', ...dayCols, 'Total']
    const rows = roster.map((m) => {
      const marks = days.map((d) => (closed(d) ? 'Closed' : (has.has(`${m.id}|${d}`) ? 'Yes' : '-')))
      const total = days.filter((d) => !closed(d) && has.has(`${m.id}|${d}`)).length
      return [m.name, m.food_pref === 'veg' ? 'Veg' : 'Non-veg', ...marks, total]
    })
    const platesRow = ['Plates / day', '', ...days.map((d) =>
      closed(d) ? 'Closed' : (entries ?? []).filter((e) => e.lunch_date === d).length
    ), (entries ?? []).filter((e) => !closed(e.lunch_date)).length]
    const legend = ['Key:  Yes = had lunch     -  = did not     Closed = kitchen closed']
    const ws1 = XLSX.utils.aoa_to_sheet([legend, [], header, ...rows, [], platesRow])
    ws1['!cols'] = [{ wch: 22 }, { wch: 10 }, ...dayCols.map(() => ({ wch: 12 })), { wch: 8 }]

    // Sheet 2: Daily summary
    const sHeader = ['Date', 'Day', 'Plates', 'Veg', 'Non-veg', 'Guests', 'Status / reason']
    const prefById = Object.fromEntries((members ?? []).map((m) => [m.id, m.food_pref]))
    const sRows = days.map((d) => {
      const de = (entries ?? []).filter((e) => e.lunch_date === d)
      const veg = de.filter((e) => prefById[e.member_id] === 'veg').length
      const guests = metaByDate[d]?.guest_count || 0
      const weekday = new Date(d + 'T00:00:00Z').toLocaleDateString('en-US', { weekday: 'long', timeZone: 'UTC' })
      if (closed(d)) return [fmtDate(d), weekday, 'Closed', '-', '-', guests, metaByDate[d]?.no_cooking_reason || 'Kitchen closed']
      return [fmtDate(d), weekday, de.length, veg, de.length - veg, guests, 'Open']
    })
    const ws2 = XLSX.utils.aoa_to_sheet([sHeader, ...sRows])
    ws2['!cols'] = [{ wch: 14 }, { wch: 11 }, { wch: 8 }, { wch: 6 }, { wch: 9 }, { wch: 8 }, { wch: 30 }]

    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws1, 'Register')
    XLSX.utils.book_append_sheet(wb, ws2, 'Daily summary')
    const b64 = XLSX.write(wb, { type: 'base64', bookType: 'xlsx' })

    const totalPlates = (entries ?? []).filter((e) => !closed(e.lunch_date)).length
    const html = shell(
      'Weekly lunch report',
      `<p style="margin:0 0 12px;">Hi Mani, here is this week's lunch register.</p>
       <p style="margin:0 0 6px;"><b>Week:</b> ${fmtDate(from)} to ${fmtDate(to)}</p>
       <p style="margin:0 0 6px;"><b>Total plates served:</b> ${totalPlates}</p>
       <p style="margin:14px 0 0;color:#9aa295;font-size:13px;">The full register and daily summary are attached as an Excel file.</p>`,
      `${fmtDate(from)} to ${fmtDate(to)}`
    )

    await sendEmail(
      ADMIN_EMAIL,
      `Weekly lunch report (${fmtDate(from)} to ${fmtDate(to)})`,
      html,
      [{ filename: `Lunch-report-${from}-to-${to}.xlsx`, content: b64 }]
    )

    return json({ ok: true, from, to, plates: totalPlates })
  } catch (err) {
    console.error(err)
    return json({ ok: false, error: err?.message || String(err) }, 500)
  }
})
