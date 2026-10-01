import { useState } from 'react'
import styles from './ChefCard.module.css'
import { isLive } from '../lib/store'

/**
 * Admin card (Mani). Mirrors the chef card: a manual "Send today's list"
 * button that emails today's list to the admin on demand. The weekly
 * Excel report still goes to the admin automatically every Friday 6 PM.
 */
const ADMIN = { name: 'Mani', email: 'mani@firebrandlabs.in', role: 'Admin' }

export default function AdminCard({ data }) {
  const { sendChefList } = data
  const [sending, setSending] = useState(false)

  const send = async () => {
    setSending(true)
    await sendChefList('admin')
    setSending(false)
  }

  const initial = ADMIN.name.charAt(0).toUpperCase()

  return (
    <section className={styles.card} aria-label="Admin">
      <div className={styles.top}>
        <div className={styles.photoFallback} aria-hidden="true">{initial}</div>
        <div className={styles.who}>
          <p className={styles.role}>Admin</p>
          <h2 className={styles.name}>{ADMIN.name}</h2>
          <p className={styles.email}>{ADMIN.email}</p>
        </div>
      </div>

      <div className={styles.sendRow}>
        <button className={styles.sendBtn} onClick={send} disabled={sending}>
          {sending ? 'Sending…' : "Send today's list now"}
        </button>
        <p className={styles.sendHint}>
          {isLive
            ? 'Sends today’s list to Mani on demand. The weekly Excel report is emailed to Mani automatically every Friday at 6:00 PM.'
            : 'Demo mode, emails switch on once Supabase and Resend are connected.'}
        </p>
      </div>
    </section>
  )
}
