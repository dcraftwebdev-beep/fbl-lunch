import { eachDayOfInterval, format, parseISO } from 'date-fns'
import { store } from './store'

/**
 * Builds and downloads a styled .xlsx workbook (via ExcelJS) for the range.
 *   Sheet 1 — Register: members × dates matrix, ● marks, per-member and
 *             per-day totals, brand header, borders, row banding.
 *   Sheet 2 — Daily summary: date, weekday, headcount, veg/non-veg,
 *             guests, total, note.
 */

// Brand palette (ARGB)
const GREEN = 'FF17452B'      // header / title fill
const GREEN_SOFT = 'FFE4EEE7' // present-cell fill
const VEG = 'FF1F5C38'
const NONVEG = 'FFC03B2B'
const BAND = 'FFF6F7F2'       // zebra row
const TOTALS = 'FFEDE7D9'     // totals rows
const AMBER = 'FFFCF3E0'      // today column
const GRID = 'FFDDE0D8'
const WHITE = 'FFFFFFFF'

const thin = { style: 'thin', color: { argb: GRID } }
const allBorders = { top: thin, left: thin, bottom: thin, right: thin }

export async function exportExcel({ from, to, members }) {
  const mod = await import('exceljs/dist/exceljs.min.js')
  const ExcelJS = mod.default ?? mod.ExcelJS ?? mod

  const [entries, dayMeta] = await Promise.all([
    store.getEntries(from, to),
    store.getDayMeta(from, to),
  ])

  const today = format(new Date(), 'yyyy-MM-dd')
  const days = eachDayOfInterval({ start: parseISO(from), end: parseISO(to) }).map((d) =>
    format(d, 'yyyy-MM-dd')
  )
  const has = new Set(entries.map((e) => `${e.member_id}|${e.lunch_date}`))
  const metaByDate = Object.fromEntries(dayMeta.map((m) => [m.lunch_date, m]))
  const prefById = Object.fromEntries(members.map((m) => [m.id, m.food_pref]))
  const roster = members.filter((m) => m.active || entries.some((e) => e.member_id === m.id))

  const wb = new ExcelJS.Workbook()
  wb.creator = 'Firebrand Lunch Register'
  wb.created = new Date()

  const rangeLabel = `${format(parseISO(from), 'dd MMM yyyy')} – ${format(parseISO(to), 'dd MMM yyyy')}`

  /* ============ Sheet 1: Register ============ */
  const ws = wb.addWorksheet('Register', {
    views: [{ state: 'frozen', xSplit: 2, ySplit: 4 }],
  })
  const NCOLS = 2 + days.length + 1

  // widths
  ws.getColumn(1).width = 22
  ws.getColumn(2).width = 10
  days.forEach((_, i) => (ws.getColumn(3 + i).width = 7))
  ws.getColumn(NCOLS).width = 8

  // Title + subtitle
  ws.mergeCells(1, 1, 1, NCOLS)
  const title = ws.getCell(1, 1)
  title.value = 'Firebrand Labs  ·  Lunch Register'
  title.font = { name: 'Calibri', size: 16, bold: true, color: { argb: WHITE } }
  title.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 }
  title.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: GREEN } }
  ws.getRow(1).height = 30

  ws.mergeCells(2, 1, 2, NCOLS)
  const sub = ws.getCell(2, 1)
  sub.value = `Register  ·  ${rangeLabel}`
  sub.font = { name: 'Calibri', size: 10, italic: true, color: { argb: 'FF5A645C' } }
  sub.alignment = { horizontal: 'left', indent: 1 }
  ws.getRow(3).height = 4 // slim spacer

  // Header row (row 4)
  const headRow = ws.getRow(4)
  const headers = ['Member', 'Pref', ...days.map((d) => `${format(parseISO(d), 'EEE')}\n${format(parseISO(d), 'dd MMM')}`), 'Total']
  headers.forEach((h, i) => {
    const c = headRow.getCell(i + 1)
    c.value = h
    c.font = { bold: true, size: 10.5, color: { argb: WHITE } }
    c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: GREEN } }
    c.alignment = { vertical: 'middle', horizontal: i < 2 ? 'left' : 'center', wrapText: true, indent: i < 2 ? 1 : 0 }
    c.border = allBorders
  })
  headRow.height = 30

  // Member rows
  roster.forEach((m, ri) => {
    const r = ws.getRow(5 + ri)
    const band = ri % 2 === 1 ? { type: 'pattern', pattern: 'solid', fgColor: { argb: BAND } } : null

    const nameCell = r.getCell(1)
    nameCell.value = m.name + (m.active ? '' : '  (left)')
    nameCell.font = { size: 11, color: { argb: 'FF1C221D' } }
    nameCell.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 }

    const prefCell = r.getCell(2)
    prefCell.value = m.food_pref === 'veg' ? 'Veg' : 'Non-veg'
    prefCell.font = { size: 10, bold: true, color: { argb: m.food_pref === 'veg' ? VEG : NONVEG } }
    prefCell.alignment = { vertical: 'middle', horizontal: 'center' }

    days.forEach((d, di) => {
      const cell = r.getCell(3 + di)
      const on = has.has(`${m.id}|${d}`)
      cell.value = on ? '●' : ''
      cell.alignment = { vertical: 'middle', horizontal: 'center' }
      cell.font = { size: 11, color: { argb: VEG } }
      if (on) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: GREEN_SOFT } }
      else if (d === today) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: AMBER } }
      else if (band) cell.fill = band
    })

    const totalCell = r.getCell(NCOLS)
    totalCell.value = days.filter((d) => has.has(`${m.id}|${d}`)).length
    totalCell.font = { size: 11, bold: true, color: { argb: 'FF1C221D' } }
    totalCell.alignment = { vertical: 'middle', horizontal: 'center' }

    if (band) {
      nameCell.fill = band; prefCell.fill = band; totalCell.fill = band
    }
    r.eachCell({ includeEmpty: true }, (c) => (c.border = allBorders))
    r.height = 19
  })

  // Totals rows
  const firstTotalRow = 5 + roster.length
  const addTotalsRow = (rowIdx, label, valueFor, grand) => {
    const r = ws.getRow(rowIdx)
    r.getCell(1).value = label
    r.getCell(2).value = ''
    days.forEach((d, di) => (r.getCell(3 + di).value = valueFor(d)))
    r.getCell(NCOLS).value = grand
    r.eachCell({ includeEmpty: true }, (c, col) => {
      c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: TOTALS } }
      c.font = { bold: true, size: 10.5, color: { argb: 'FF1C221D' } }
      c.alignment = { vertical: 'middle', horizontal: col <= 2 ? 'left' : 'center', indent: col === 1 ? 1 : 0 }
      c.border = allBorders
    })
    r.height = 20
  }
  addTotalsRow(
    firstTotalRow, 'Plates / day',
    (d) => entries.filter((e) => e.lunch_date === d).length,
    entries.length
  )
  addTotalsRow(
    firstTotalRow + 1, 'Guest plates',
    (d) => metaByDate[d]?.guest_count || 0,
    days.reduce((s, d) => s + (metaByDate[d]?.guest_count || 0), 0)
  )

  /* ============ Sheet 2: Daily summary ============ */
  const ws2 = wb.addWorksheet('Daily summary', { views: [{ state: 'frozen', ySplit: 4 }] })
  const S = ['Date', 'Day', 'Team plates', 'Veg', 'Non-veg', 'Guest plates', 'Total plates', 'Note']
  const widths2 = [14, 11, 12, 7, 9, 12, 12, 34]
  widths2.forEach((w, i) => (ws2.getColumn(i + 1).width = w))

  ws2.mergeCells(1, 1, 1, S.length)
  const t2 = ws2.getCell(1, 1)
  t2.value = 'Daily summary'
  t2.font = { size: 16, bold: true, color: { argb: WHITE } }
  t2.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 }
  t2.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: GREEN } }
  ws2.getRow(1).height = 30
  ws2.mergeCells(2, 1, 2, S.length)
  const s2 = ws2.getCell(2, 1)
  s2.value = rangeLabel
  s2.font = { size: 10, italic: true, color: { argb: 'FF5A645C' } }
  s2.alignment = { horizontal: 'left', indent: 1 }
  ws2.getRow(3).height = 4

  const h2 = ws2.getRow(4)
  S.forEach((h, i) => {
    const c = h2.getCell(i + 1)
    c.value = h
    c.font = { bold: true, size: 10.5, color: { argb: WHITE } }
    c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: GREEN } }
    c.alignment = { vertical: 'middle', horizontal: i === 7 ? 'left' : (i < 2 ? 'left' : 'center'), indent: i < 2 || i === 7 ? 1 : 0 }
    c.border = allBorders
  })
  h2.height = 22

  days.forEach((d, ri) => {
    const dayEntries = entries.filter((e) => e.lunch_date === d)
    const veg = dayEntries.filter((e) => prefById[e.member_id] === 'veg').length
    const guests = metaByDate[d]?.guest_count || 0
    const weekday = format(parseISO(d), 'EEEE')
    const isWeekend = weekday === 'Saturday' || weekday === 'Sunday'
    const r = ws2.getRow(5 + ri)
    const vals = [
      format(parseISO(d), 'dd MMM yyyy'), weekday, dayEntries.length, veg,
      dayEntries.length - veg, guests, dayEntries.length + guests, metaByDate[d]?.note || '',
    ]
    const band = ri % 2 === 1
    vals.forEach((v, i) => {
      const c = r.getCell(i + 1)
      c.value = v
      c.font = { size: 10.5, color: { argb: 'FF1C221D' } }
      c.alignment = { vertical: 'middle', horizontal: i === 7 ? 'left' : (i < 2 ? 'left' : 'center'), indent: i < 2 || i === 7 ? 1 : 0, wrapText: i === 7 }
      if (isWeekend) c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF0EEE6' } }
      else if (band) c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: BAND } }
      c.border = allBorders
    })
    if (d === today) r.getCell(1).font = { size: 10.5, bold: true, color: { argb: GREEN } }
    r.getCell(7).font = { size: 10.5, bold: true, color: { argb: VEG } }
    r.height = 18
  })

  /* ============ download ============ */
  const buf = await wb.xlsx.writeBuffer()
  const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `Firebrand-Lunch_${from}_to_${to}.xlsx`
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
  return a.download
}
