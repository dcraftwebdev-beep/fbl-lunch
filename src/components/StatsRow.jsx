import { useMemo } from 'react'
import styles from './StatsRow.module.css'

export default function StatsRow({ data }) {
  const { members, entries, today, todayMemberIds, dayMeta, days } = data

  const stats = useMemo(() => {
    const prefById = Object.fromEntries(members.map((m) => [m.id, m.food_pref]))
    const nameById = Object.fromEntries(members.map((m) => [m.id, m.name]))

    const veg = todayMemberIds.filter((id) => prefById[id] === 'veg').length
    const nonveg = todayMemberIds.length - veg
    const guests = dayMeta[today]?.guest_count || 0
    const platesToday = todayMemberIds.length + guests

    const pastDays = days.filter((d) => d < today)
    const pastTotal = entries.filter((e) => e.lunch_date < today).length
    const avg = pastDays.length ? (pastTotal / pastDays.length).toFixed(1) : '0'

    const counts = {}
    entries.forEach((e) => { counts[e.member_id] = (counts[e.member_id] || 0) + 1 })
    const topId = Object.keys(counts).sort((a, b) => counts[b] - counts[a])[0]
    const regular = topId ? { name: nameById[topId] || '—', count: counts[topId] } : null

    return { veg, nonveg, guests, platesToday, avg, regular }
  }, [members, entries, today, todayMemberIds, dayMeta, days])

  return (
    <section className={styles.card} aria-label="Lunch stats">
      <div className={styles.big}>
        <span className={styles.bigNumber}>{stats.platesToday}</span>
        <span className={styles.bigLabel}>
          plates to cook today
          {stats.guests > 0 && <em className={styles.guestsNote}> incl. {stats.guests} guest{stats.guests > 1 ? 's' : ''}</em>}
        </span>
      </div>

      <div className={styles.split}>
        <div className={styles.splitItem}>
          <span className={styles.dotVeg} aria-hidden="true" />
          <span className={styles.splitCount}>{stats.veg}</span> veg
        </div>
        <div className={styles.splitItem}>
          <span className={styles.dotNonveg} aria-hidden="true" />
          <span className={styles.splitCount}>{stats.nonveg}</span> non-veg
        </div>
      </div>

      <dl className={styles.small}>
        <div className={styles.smallItem}>
          <dt>10-day average</dt>
          <dd>{stats.avg} plates</dd>
        </div>
        <div className={styles.smallItem}>
          <dt>Most regular</dt>
          <dd>{stats.regular ? `${stats.regular.name} · ${stats.regular.count}/10` : '—'}</dd>
        </div>
      </dl>
    </section>
  )
}