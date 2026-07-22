import { format } from 'date-fns'
import styles from './Header.module.css'
import Logo from './Logo'

export default function Header({ live, onLogout, activeModule, onSwitchModule, authed }) {
  return (
    <header className={styles.header}>
      <div className={styles.inner}>
        <a className={styles.brand} href="/" aria-label="Firebrand Labs — internal portal">
          <Logo className={styles.logo} width={148} />
          <span className={styles.divider} aria-hidden="true" />
          <span className={styles.portalTag}>internal portal</span>
        </a>

        <nav className={styles.nav}>
          <button
            className={`${styles.tab} ${activeModule === 'tasks' ? styles.activeTab : ''}`}
            onClick={() => onSwitchModule('tasks')}
            type="button"
          >
            Daily Tasks
          </button>
          <button
            className={`${styles.tab} ${activeModule === 'lunch' ? styles.activeTab : ''}`}
            onClick={() => onSwitchModule('lunch')}
            type="button"
          >
            Lunch Register
          </button>
        </nav>

        <div className={styles.right}>
          <p className={styles.date}>{format(new Date(), 'EEEE, dd MMM yyyy')}</p>
          <div className={styles.rightRow}>
            {/* <span className={live ? styles.pillLive : styles.pillDemo}>
              {live ? 'Supabase · live' : 'Demo mode'}
            </span> */}
            {authed && activeModule === 'lunch' && onLogout && (
              <button className={styles.logout} onClick={onLogout} type="button">
                Log out
              </button>
            )}
          </div>
        </div>
      </div>
    </header>
  )
}
