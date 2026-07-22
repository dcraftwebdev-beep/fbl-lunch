import { useState } from 'react'
import styles from './ChefCard.module.css'
import { isLive } from '../lib/store'

/**
 * The kitchen card: chef's photo, name and email, plus the manual
 * "Send today's list" button. The 11:15 AM IST cron sends today's
 * final list automatically; this button sends/resends today's
 * list any time.
 */
export default function ChefCard({ data }) {
  const { settings, updateSettings, sendChefList } = data
  const [editing, setEditing] = useState(!settings.chef_name && !settings.chef_email)
  const [form, setForm] = useState({
    chef_name: settings.chef_name || '',
    chef_email: settings.chef_email || '',
    chef_photo: settings.chef_photo || '',
  })
  const [sending, setSending] = useState(false)

  const save = () => {
    updateSettings({
      chef_name: form.chef_name.trim(),
      chef_email: form.chef_email.trim(),
      chef_photo: form.chef_photo.trim(),
    })
    setEditing(false)
  }

  const send = async () => {
    setSending(true)
    await sendChefList()
    setSending(false)
  }

  const initial = (settings.chef_name || '?').trim().charAt(0).toUpperCase()

  return (
    <section className={styles.card} aria-label="Kitchen and chef">
      <div className={styles.top}>
        {settings.chef_photo ? (
          <img className={styles.photo} src={settings.chef_photo} alt={settings.chef_name || 'Chef'} />
        ) : (
          <div className={styles.photoFallback} aria-hidden="true">{initial}</div>
        )}

        <div className={styles.who}>
          <p className={styles.role}>Today's kitchen</p>
          <h2 className={styles.name}>{settings.chef_name || 'Add your chef'}</h2>
          <p className={styles.email}>{settings.chef_email || 'chef email not set'}</p>
        </div>

        <button className={styles.editBtn} onClick={() => setEditing((e) => !e)}>
          {editing ? 'Close' : 'Edit'}
        </button>
      </div>

      {editing && (
        <div className={styles.form}>
          <label className={styles.field}>
            <span>Chef's name</span>
            <input
              value={form.chef_name}
              onChange={(e) => setForm({ ...form, chef_name: e.target.value })}
              placeholder="e.g. Murugan Anna"
            />
          </label>
          <label className={styles.field}>
            <span>Chef's email</span>
            <input
              type="email"
              value={form.chef_email}
              onChange={(e) => setForm({ ...form, chef_email: e.target.value })}
              placeholder="chef@example.com"
            />
          </label>
          <label className={styles.field}>
            <span>Photo URL (optional)</span>
            <input
              value={form.chef_photo}
              onChange={(e) => setForm({ ...form, chef_photo: e.target.value })}
              placeholder="https://…/chef.jpg"
            />
          </label>
          <button className={styles.saveBtn} onClick={save}>Save chef details</button>
        </div>
      )}

      <div className={styles.sendRow}>
        <button className={styles.sendBtn} onClick={send} disabled={sending || !settings.chef_email}>
          {sending ? 'Sending…' : "Send today's list now"}
        </button>
        <p className={styles.sendHint}>
          {isLive
            ? 'Auto-sends today’s final list at 11:15 AM IST, when the order window closes. This button sends today’s list on demand.'
            : 'Demo mode — emails switch on once Supabase + Resend are connected.'}
        </p>
      </div>
    </section>
  )
}
