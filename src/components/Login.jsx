import { useState } from 'react'
import styles from './Login.module.css'
import { login, resetPassword, USING_DEFAULT_PASSWORD } from '../lib/auth'
import { isLive } from '../lib/store'

// Inline eye / eye-off icons so we don't pull in an icon lib here.
function EyeIcon({ off }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {off ? (
        <>
          <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 10 8 10 8a18.5 18.5 0 0 1-2.16 3.19M6.61 6.61A18.5 18.5 0 0 0 2 12s3 8 10 8a9.12 9.12 0 0 0 5.39-1.61" />
          <path d="M14.12 14.12A3 3 0 1 1 9.88 9.88" />
          <line x1="2" y1="2" x2="22" y2="22" />
        </>
      ) : (
        <>
          <path d="M2 12s3-8 10-8 10 8 10 8-3 8-10 8-10-8-10-8Z" />
          <circle cx="12" cy="12" r="3" />
        </>
      )}
    </svg>
  )
}

/**
 * Shared-password gate. When Supabase is connected the password is
 * verified server-side (edge function). Includes a show/hide eye
 * toggle and an in-app "change password" (reset) panel.
 */
export default function Login({ onSuccess }) {
  const [pw, setPw] = useState('')
  const [show, setShow] = useState(false)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [mode, setMode] = useState('login') // 'login' | 'reset'

  // reset panel state
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [confirm, setConfirm] = useState('')
  const [resetMsg, setResetMsg] = useState('')

  const submit = async (e) => {
    e.preventDefault()
    setError('')
    setBusy(true)
    const { ok, error } = await login(pw)
    setBusy(false)
    if (ok) { onSuccess() } else { setError(error || 'Wrong password — try again.'); setPw('') }
  }

  const submitReset = async (e) => {
    e.preventDefault()
    setResetMsg('')
    if (next !== confirm) { setResetMsg('New passwords don’t match.'); return }
    setBusy(true)
    const { ok, error } = await resetPassword(current, next)
    setBusy(false)
    if (ok) {
      // Log straight in with the new password.
      const res = await login(next)
      if (res.ok) return onSuccess()
      setMode('login')
      setResetMsg('')
      setError('Password changed — please log in.')
    } else {
      setResetMsg(error || 'Could not change the password.')
    }
  }

  return (
    <div className={styles.screen}>
      <div className={styles.card}>
        <span className={styles.mark} aria-hidden="true">
          <span className={styles.markDot} />
        </span>
        <p className={styles.company}>firebrand labs</p>
        <h1 className={styles.title}>Lunch Register</h1>

        {mode === 'login' ? (
          <form onSubmit={submit} className={styles.form}>
            <p className={styles.subtitle}>Enter the team password to open the dashboard.</p>

            <div className={styles.pwWrap}>
              <input
                className={`${styles.input} ${error ? styles.inputError : ''}`}
                type={show ? 'text' : 'password'}
                value={pw}
                onChange={(e) => { setPw(e.target.value); setError('') }}
                placeholder="Team password"
                aria-label="Team password"
                autoFocus
                autoComplete="current-password"
              />
              <button
                type="button"
                className={styles.eye}
                onClick={() => setShow((s) => !s)}
                aria-label={show ? 'Hide password' : 'Show password'}
                title={show ? 'Hide password' : 'Show password'}
              >
                <EyeIcon off={show} />
              </button>
            </div>

            {error && <p className={styles.errorMsg} role="alert">{error}</p>}

            <button className={styles.button} type="submit" disabled={busy}>
              {busy ? 'Checking…' : 'Open dashboard'}
            </button>

            {isLive && (
              <button type="button" className={styles.linkBtn}
                onClick={() => { setMode('reset'); setError(''); setResetMsg('') }}>
                Change password
              </button>
            )}

            {USING_DEFAULT_PASSWORD && (
              <p className={styles.hint}>
                No password set yet — using the default. Add <code>VITE_APP_PASSWORD</code> to
                your <code>.env</code> and restart before sharing the link.
              </p>
            )}
          </form>
        ) : (
          <form onSubmit={submitReset} className={styles.form}>
            <p className={styles.subtitle}>Change the team password. You’ll need the current one.</p>

            <input className={styles.input} type={show ? 'text' : 'password'} value={current}
              onChange={(e) => setCurrent(e.target.value)} placeholder="Current password"
              aria-label="Current password" autoComplete="current-password" autoFocus />
            <input className={styles.input} type={show ? 'text' : 'password'} value={next}
              onChange={(e) => setNext(e.target.value)} placeholder="New password"
              aria-label="New password" autoComplete="new-password" />
            <div className={styles.pwWrap}>
              <input className={styles.input} type={show ? 'text' : 'password'} value={confirm}
                onChange={(e) => setConfirm(e.target.value)} placeholder="Confirm new password"
                aria-label="Confirm new password" autoComplete="new-password" />
              <button type="button" className={styles.eye} onClick={() => setShow((s) => !s)}
                aria-label={show ? 'Hide passwords' : 'Show passwords'}
                title={show ? 'Hide passwords' : 'Show passwords'}>
                <EyeIcon off={show} />
              </button>
            </div>

            {resetMsg && <p className={styles.errorMsg} role="alert">{resetMsg}</p>}

            <button className={styles.button} type="submit" disabled={busy}>
              {busy ? 'Saving…' : 'Save new password'}
            </button>
            <button type="button" className={styles.linkBtn}
              onClick={() => { setMode('login'); setResetMsg('') }}>
              Back to login
            </button>
            <p className={styles.hint}>
              Forgot it and no one’s logged in? Reset it from the SQL Editor —
              see <code>migration-v3.sql</code>.
            </p>
          </form>
        )}
      </div>
      <p className={styles.foot}>firebrand labs · internal lunch register</p>
    </div>
  )
}
