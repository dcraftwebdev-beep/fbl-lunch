import { useState } from 'react'
import { format, parseISO, subDays } from 'date-fns'
import styles from './RegisterTable.module.css'
import { ChevronLeft, ChevronRight } from 'lucide-react'
/**
 * The mess register: a 10-day window, one row per member.
 * Every cell is a toggle — click to mark someone in or out on any day,
 * including corrections to past days. Today's column is highlighted
 * (when today falls inside the visible window).
 *
 * Pager (top right): ◀ steps back 10 days, ▶ steps forward. The
 * forward arrow disables on the latest window. Totals and the
 * plates/day footer always reflect the visible window only.
 */

const NO_LUNCH_LINES = [
  'No lunch — home tiffin day?',
  'No plate. Suspicious.',
  'Skipped. Living on coffee?',
  'Missed the biryani. Tragic.',
  'Fasting, or feasting elsewhere?',
  'Lunch is a social construct, apparently.',
  'Ran on vibes that day.',
]

// Stable pick per member+date, so the joke doesn't change on re-render
const noLunchLine = (memberId, date) => {
  let hash = 0
  const key = `${memberId}${date}`
  for (let i = 0; i < key.length; i++) hash = (hash * 31 + key.charCodeAt(i)) % 997
  return NO_LUNCH_LINES[hash % NO_LUNCH_LINES.length]
}

const WINDOW = 10

export default function RegisterTable({ data }) {
  const { members, days, today, isIn, toggleEntry, entries, dayMeta, rangeStart } = data

  // How many 10-day pages we've stepped back. 0 = the latest window.
  const [pageBack, setPageBack] = useState(0)

  // Anchor on the last day of the incoming window (normally today),
  // then slide back in whole 10-day steps.
  const anchorEnd = parseISO(days[days.length - 1])
  const windowEnd = subDays(anchorEnd, pageBack * WINDOW)
  const visibleDays = Array.from({ length: WINDOW }, (_, i) =>
    format(subDays(windowEnd, WINDOW - 1 - i), 'yyyy-MM-dd')
  )

  const rangeLabel = `${format(subDays(windowEnd, WINDOW - 1), 'dd/MM/yyyy')} – ${format(
    windowEnd,
    'dd/MM/yyyy'
  )}`

  // Only page back as far as the loaded history (rangeStart). Once the
  // window's first day reaches it, disable ◀ so we don't show empty months.
  const canGoBack = !rangeStart || visibleDays[0] > rangeStart

  // Only entries inside the visible window count toward totals here —
  // and NO-COOKING days count as zero plates for everyone (any leftover
  // entries on a closed day are excluded so the totals match the ✕ cells).
  const inWindow = (e) => visibleDays.includes(e.lunch_date)
  const notClosed = (e) => !dayMeta[e.lunch_date]?.no_cooking
  const windowEntries = entries.filter((e) => inWindow(e) && notClosed(e))

  const roster = members.filter(
    (m) => m.active || entries.some((e) => e.member_id === m.id)
  )

  const dayTotal = (d) => entries.filter((e) => e.lunch_date === d).length
  const memberTotal = (id) =>
    windowEntries.filter((e) => e.member_id === id).length

  return (
    <section className={styles.wrap} aria-label="Lunch register, 10 days at a time">
      <div className={styles.headRow}>
        <h2 className={styles.heading}>The register</h2>
        <div className={styles.pager}>
          <span className={styles.hint}>Click any cell to correct a day.</span>
          <button className={styles.pagerBtn} onClick={() => setPageBack((p) => p + 1)} disabled={!canGoBack} aria-label="Previous 10 days" title={canGoBack ? 'Previous 10 days' : 'No older records loaded'} type="button">
  <ChevronLeft size={16} strokeWidth={2.5} aria-hidden="true" />
</button>

          <span className={styles.rangeLabel}>{rangeLabel}</span>
          <button className={styles.pagerBtn} onClick={() => setPageBack((p) => Math.max(p - 1, 0))} disabled={pageBack === 0} aria-label="Next 10 days" title={pageBack === 0 ? 'Already at the latest 10 days' : 'Next 10 days'} type="button">
  <ChevronRight size={16} strokeWidth={2.5} aria-hidden="true" />
</button>
        </div>
      </div>

      <div className={styles.scroller}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th className={styles.nameHead}>Member</th>
              {visibleDays.map((d) => {
                const closed = !!dayMeta[d]?.no_cooking
                const reason = dayMeta[d]?.no_cooking_reason
                return (
                  <th key={d} className={`${d === today ? styles.todayHead : styles.dayHead} ${closed ? styles.closedHead : ''}`} scope="col">
                    <span className={styles.dayName}>{format(parseISO(d), 'EEE')}</span>
                    <span className={styles.dayNum}>{format(parseISO(d), 'dd/MM')}</span>
                    {d === today && !closed && <span className={styles.todayTag}>today</span>}
                    {closed && <span className={styles.closedTag} title={reason ? `No lunch: ${reason}` : 'No office lunch, kitchen closed'}>no lunch</span>}
                  </th>
                )
              })}
              <th className={styles.totalHead} scope="col">Total</th>
            </tr>
          </thead>

          <tbody>
            {roster.length === 0 && (
              <tr>
                <td className={styles.emptyRow} colSpan={visibleDays.length + 2}>
                  The roster is empty. Add your team in the Team roster panel below to start the register.
                </td>
              </tr>
            )}
            {roster.map((m) => {
              const total = memberTotal(m.id)
              return (
                <tr key={m.id} className={!m.active ? styles.inactiveRow : ''}>
                  <th className={styles.nameCell} scope="row">
                    <span className={styles.nameInner}>
                      <span className={m.food_pref === 'veg' ? styles.dotVeg : styles.dotNonveg} aria-hidden="true" />
                      {m.name}
                      {!m.active && <span className={styles.inactiveTag}>left</span>}
                    </span>
                  </th>
                  {visibleDays.map((d) => {
                    const closed = !!dayMeta[d]?.no_cooking
                    // Kitchen closed → no office lunch for anyone. Static ✕, not clickable.
                    if (closed) {
                      return (
                        <td key={d} className={`${d === today ? styles.todayCell : styles.cell} ${styles.closedCell}`}
                          title="No office lunch — kitchen closed, eat outside">
                          <span className={styles.markClosed} aria-label={`${m.name}, ${format(parseISO(d), 'dd MMM')}: no office lunch`}>✕</span>
                        </td>
                      )
                    }
                    const on = isIn(m.id, d)
                    return (
                      <td key={d} className={d === today ? styles.todayCell : styles.cell}>
                        <button
                          className={`${styles.mark} ${on ? styles.markOn : styles.markOff}`}
                          onClick={() => toggleEntry(m.id, d, m.name)}
                          aria-pressed={on}
                          title={on ? undefined : noLunchLine(m.id, d)}
                          aria-label={`${m.name}, ${format(parseISO(d), 'dd MMM')}: ${on ? 'in — click to remove' : 'no lunch — click to add'}`}
                        >
                          <span className={styles.markOnGlyph} aria-hidden="true">{on ? '●' : ''}</span>
                          {!on && (
                            <>
                              <span className={styles.offGlyph} aria-hidden="true">–</span>
                              <span className={styles.addGlyph} aria-hidden="true">+</span>
                            </>
                          )}
                        </button>
                      </td>
                    )
                  })}
                  <td
                    className={`${styles.totalCell} ${total === 0 ? styles.totalZero : ''}`}
                    title={total === 0 ? 'Zero lunches in these 10 days. Living on coffee?' : undefined}
                  >
                    {total}
                  </td>
                </tr>
              )
            })}
          </tbody>

          <tfoot>
            <tr>
              <th className={styles.footLabel} scope="row">Plates / day</th>
              {visibleDays.map((d) => {
                const guests = dayMeta[d]?.guest_count || 0
                const closed = !!dayMeta[d]?.no_cooking
                const plates = dayTotal(d) + guests
                return (
                  <td
                    key={d}
                    className={`${d === today ? styles.todayFoot : styles.footCell} ${closed ? styles.closedFoot : ''}`}
                    title={closed ? (dayMeta[d]?.no_cooking_reason ? `No lunch: ${dayMeta[d].no_cooking_reason}` : 'No office lunch, kitchen closed') : (plates === 0 ? 'Kitchen had the day off, it seems.' : undefined)}
                  >
                    {closed
                      ? <span className={styles.closedDay}>🙅</span>
                      : (plates === 0 ? <span className={styles.zeroDay}>–</span> : plates)}
                    {!closed && guests > 0 && <span className={styles.guestSup}>+{guests}g</span>}
                  </td>
                )
              })}
              <td className={styles.footTotal}>{windowEntries.length}</td>
            </tr>
          </tfoot>
        </table>
      </div>

      {visibleDays.some((d) => dayMeta[d]?.no_cooking) && (
        <ul className={styles.closedNotes} aria-label="Closed days">
          {visibleDays.filter((d) => dayMeta[d]?.no_cooking).map((d) => (
            <li key={d}>
              <span className={styles.closedNoteDot} aria-hidden="true">🙅</span>
              <b>{format(parseISO(d), 'dd/MM/yyyy')}</b>
              {dayMeta[d]?.no_cooking_reason ? `: ${dayMeta[d].no_cooking_reason}` : ': kitchen closed, eat outside'}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}