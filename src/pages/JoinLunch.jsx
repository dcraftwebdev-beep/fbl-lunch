import { useState } from 'react'
import styles from './EmailAction.module.css'

/**
 * /join?m=<member_id>&d=<date>&s=<sig>
 * Landing page for the 10 AM invite email. Shows one button;
 * clicking POSTs to the join-lunch edge function (with anon auth,
 * so JWT verification at the gateway is never a problem).
 */

const FN_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/join-lunch`
const ANON = import.meta.env.VITE_SUPABASE_ANON_KEY

export default function JoinLunch() {
  const params = new URLSearchParams(window.location.search)
  const m = params.get('m')
  const d = params.get('d')
  const s = params.get('s')

  const [state, setState] = useState(m && d && s ? 'idle' : 'badlink')
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
        body: JSON.stringify({ m, d, s }),
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
            <h1 className={styles.title}>Broken link</h1>
            <p className={styles.msg}>This lunch link is incomplete. Open the button from today's email again.</p>
          </>
        )}

        {(state === 'idle' || state === 'working') && (
          <>
            <div className={styles.emoji} aria-hidden="true">🍛</div>
            <h1 className={styles.title}>Lunch today?</h1>
            <p className={styles.msg}>
              The office kitchen is cooking on <b className={styles.mono}>{d}</b>.
              One click and your plate is on the register.
            </p>
            <button
              className={styles.primaryBtn}
              onClick={confirm}
              disabled={state === 'working'}
              type="button"
            >
              {state === 'working' ? 'Adding you…' : 'Add me to today\u2019s register'}
            </button>
            <p className={styles.fine}>Valid for today only. Do nothing and no plate will be made.</p>
          </>
        )}

        {state === 'done' && (
          <>
            <div className={`${styles.badge} ${styles.badgeOk}`} aria-hidden="true" />
            <h1 className={styles.title}>
              {result?.status === 'already'
                ? `Already on the list${result?.name ? `, ${result.name}` : ''}`
                : `You're in${result?.name ? `, ${result.name}` : ''} 🍛`}
            </h1>
            <p className={styles.msg}>
              {result?.status === 'already'
                ? 'Your plate for today was already marked. The kitchen has you covered.'
                : 'Your plate for today is on the register. Changed your mind? Type !lunch out in Basecamp before 11:15 AM.'}
            </p>
          </>
        )}

        {state === 'failed' && (
          <>
            <div className={`${styles.badge} ${styles.badgeBad}`} aria-hidden="true" />
            <h1 className={styles.title}>That didn't go through</h1>
            <p className={styles.msg}>
              {result?.message || 'Link expired? The window is open till 11:15 AM today. Or type !lunch in on Basecamp.'}
            </p>
            <button className={styles.ghostBtn} onClick={confirm} type="button">Try again</button>
          </>
        )}
      </div>
    </main>
  )
}