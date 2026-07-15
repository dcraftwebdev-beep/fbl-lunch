import { eachDayOfInterval, format, parseISO } from 'date-fns'
import { store } from './store'

/**
 * Builds and downloads an .xlsx workbook for the given date range.
 * Sheet 1 — Register: members x dates matrix, ✓ marks, per-member and per-day totals.
 * Sheet 2 — Daily summary: date, headcount, veg/non-veg split, guest plates, note.
 */
export async function exportExcel({ from, to, members }) {
  const XLSX = await import('xlsx')
  const [entries, dayMeta] = await Promise.all([
    store.getEntries(from, to),
    store.getDayMeta(from, to),
  ])

  const days = eachDayOfInterval({ start: parseISO(from), end: parseISO(to) }).map((d) =>
    format(d, 'yyyy-MM-dd')
  )

  const has = new Set(entries.map((e) => `${e.member_id}|${e.lunch_date}`))
  const metaByDate = Object.fromEntries(dayMeta.map((m) => [m.lunch_date, m]))
  const roster = members.filter(
    (m) => m.active || entries.some((e) => e.member_id === m.id)
  )

  /* -------- Sheet 1: Register -------- */
  const header = ['Member', 'Pref', ...days.map((d) => format(parseISO(d), 'dd MMM')), 'Total']
  const rows = roster.map((m) => {
    const marks = days.map((d) => (has.has(`${m.id}|${d}`) ? '✓' : ''))
    const total = marks.filter(Boolean).length
    return [m.name, m.food_pref === 'veg' ? 'Veg' : 'Non-veg', ...marks, total]
  })
  const dayTotals = days.map((d) => entries.filter((e) => e.lunch_date === d).length)
  rows.push(['Plates / day', '', ...dayTotals, entries.length])
  rows.push([
    'Guest plates', '',
    ...days.map((d) => metaByDate[d]?.guest_count || 0),
    days.reduce((s, d) => s + (metaByDate[d]?.guest_count || 0), 0),
  ])

  const ws1 = XLSX.utils.aoa_to_sheet([header, ...rows])
  ws1['!cols'] = [{ wch: 20 }, { wch: 9 }, ...days.map(() => ({ wch: 8 })), { wch: 7 }]

  /* -------- Sheet 2: Daily summary -------- */
  const summaryHeader = ['Date', 'Day', 'Team plates', 'Veg', 'Non-veg', 'Guest plates', 'Total plates', 'Note']
  const prefById = Object.fromEntries(members.map((m) => [m.id, m.food_pref]))
  const summaryRows = days.map((d) => {
    const dayEntries = entries.filter((e) => e.lunch_date === d)
    const veg = dayEntries.filter((e) => prefById[e.member_id] === 'veg').length
    const guests = metaByDate[d]?.guest_count || 0
    return [
      format(parseISO(d), 'dd MMM yyyy'),
      format(parseISO(d), 'EEEE'),
      dayEntries.length,
      veg,
      dayEntries.length - veg,
      guests,
      dayEntries.length + guests,
      metaByDate[d]?.note || '',
    ]
  })
  const ws2 = XLSX.utils.aoa_to_sheet([summaryHeader, ...summaryRows])
  ws2['!cols'] = [{ wch: 12 }, { wch: 10 }, { wch: 11 }, { wch: 6 }, { wch: 8 }, { wch: 11 }, { wch: 11 }, { wch: 32 }]

  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws1, 'Register')
  XLSX.utils.book_append_sheet(wb, ws2, 'Daily summary')

  const fname = `Firebrand-Lunch_${from}_to_${to}.xlsx`
  XLSX.writeFile(wb, fname)
  return fname
}
