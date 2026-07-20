import { useState } from 'react'
import styles from './Login.module.css'
import { login, USING_DEFAULT_PASSWORD } from '../lib/auth'

/**
 * Shared-password gate shown before the dashboard. On success it calls
 * onSuccess() so App can re-render into the register. The public email
 * pages (/join, /cancel) never reach this — they render before the gate.
 */
export default function Login({ onSuccess }) {
  const [pw, setPw] = useState('')
  const [error, setError] = useState(false)

  const submit = (e) => {
    e.preventDefault()
    if (login(pw)) {
      onSuccess()
    } else {
      setError(true)
      setPw('')
    }
  }

  return (
    <div className={styles.screen}>
      <form className={styles.card} onSubmit={submit}>
        <span className={styles.mark} aria-hidden="true">
          <span className={styles.markDot} />
        </span>

        <p className={styles.company}>firebrand labs</p>
        <h1 className={styles.title}>Lunch Register</h1>
        <p className={styles.subtitle}>Enter the team password to open the dashboard.</p>

        <input
          className={`${styles.input} ${error ? styles.inputError : ''}`}
          type="password"
          value={pw}
          onChange={(e) => { setPw(e.target.value); setError(false) }}
          placeholder="Team password"
          aria-label="Team password"
          autoFocus
          autoComplete="current-password"
        />

        {error && <p className={styles.errorMsg} role="alert">Wrong password — try again.</p>}

        <button className={styles.button} type="submit">Open dashboard</button>

        {USING_DEFAULT_PASSWORD && (
          <p className={styles.hint}>
            No password set yet — using the default. Add <code>VITE_APP_PASSWORD</code> to
            your <code>.env</code> and restart before sharing the link.
          </p>
        )}
      </form>
      <p className={styles.foot}>firebrand labs · internal lunch register</p>
    </div>
  )
}
