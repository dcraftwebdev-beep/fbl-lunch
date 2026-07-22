import { useState } from 'react'
import styles from './EmailAction.module.css'

/**
 * /cancel?token=<cancel_token>
 * Landing page for the "Cancel my lunch" email button. Shows a
 * confirm button; clicking POSTs to the cancel-lunch edge function
 * (with anon auth, so gateway JWT verification never blocks it).
 */

const FN_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/cancel-lunch`
const ANON = import.meta.env.VITE_SUPABASE_ANON_KEY

export default function CancelLunch() {
  const token = new URLSearchParams(window.location.search).get('token')

  const [state, setState] = useState(token ? 'idle' : 'badlink')
  const [result, setResult] = useState(null)

  const confirm = async () => {
    setState('working')
    try {
      const res = await fetch(FN_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: ANON,
          Authorization: `Bearer ${ANON}`,
        },
        body: JSON.stringify({ token }),
      })
      const body = await res.json()
      setResult(body)
      setState(body.ok ? 'done' : 'failed')
    } catch {
      setResult({ message: 'Could not reach the register. Check your connection and try once more.' })
      setState('failed')
    }
  }

  return (
    <main className={styles.page}>
      <div className={styles.card}>
        <div className={styles.brand}>Firebrand Labs · Lunch Register</div>

        {state === 'badlink' && (
          <>
            <div className={`${styles.badge} ${styles.badgeBad}`} aria-hidden="true" />
            <h1 className={styles.title}>Missing link</h1>
            <p className={styles.msg}>This cancel link is incomplete. Open the button from your email again.</p>
          </>
        )}

        {(state === 'idle' || state === 'working') && (
          <>
            <div className={styles.emoji} aria-hidden="true">🍽️</div>
            <h1 className={styles.title}>Cancel today's lunch?</h1>
            <p className={styles.msg}>
              Your plate comes off today's register and the kitchen is told before cooking starts.
            </p>
            <button
              className={`${styles.primaryBtn} ${styles.dangerBtn}`}
              onClick={confirm}
              disabled={state === 'working'}
              type="button"
            >
              {state === 'working' ? 'Cancelling…' : 'Yes, cancel my plate'}
            </button>
            <p className={styles.fine}>Changed your mind? Just close this page — nothing happens until you click.</p>
          </>
        )}

        {state === 'done' && (
          <>
            <div className={`${styles.badge} ${styles.badgeOk}`} aria-hidden="true" />
            <h1 className={styles.title}>
              {result?.status === 'already'
                ? 'Already cancelled'
                : `Lunch cancelled${result?.name ? `, ${result.name}` : ''}`}
            </h1>
            <p className={styles.msg}>
              {result?.status === 'already'
                ? 'Already cancelled. Nothing more to do.'
                : 'Plate is off the list. Rebook with !lunch in on Basecamp before 11:15 AM.'}
            </p>
          </>
        )}

        {state === 'failed' && (
          <>
            <div className={`${styles.badge} ${styles.badgeBad}`} aria-hidden="true" />
            <h1 className={styles.title}>That didn't go through</h1>
            <p className={styles.msg}>
              {result?.message || 'This link may have been for a past day. Today\u2019s lunch is managed on the dashboard.'}
            </p>
            <button className={styles.ghostBtn} onClick={confirm} type="button">Try again</button>
          </>
        )}
      </div>
    </main>
  )
}