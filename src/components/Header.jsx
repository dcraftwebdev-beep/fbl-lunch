import { format } from 'date-fns'
import styles from './Header.module.css'

export default function Header({ live }) {
  return (
    <header className={styles.header}>
      <div className={styles.inner}>
        <div className={styles.brand}>
          <span className={styles.mark} aria-hidden="true">
            <span className={styles.markDot} />
          </span>
          <div>
            <p className={styles.company}>firebrand labs</p>
            <h1 className={styles.title}>Lunch Register</h1>
          </div>
        </div>

        <div className={styles.right}>
          <p className={styles.date}>{format(new Date(), 'EEEE, dd MMM yyyy')}</p>
          <span className={live ? styles.pillLive : styles.pillDemo}>
            {live ? 'Supabase · live' : 'Demo mode'}
          </span>
        </div>
      </div>
    </header>
  )
}
