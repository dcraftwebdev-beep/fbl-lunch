import { useEffect, useMemo, useRef, useState } from 'react'
import styles from './TodayPanel.module.css'

/**
 * The daily roll-call. Type @ once — the roster stays open so you can
 * add several people in a row. "Add everyone remaining" fills the rest.
 * Click outside or press Escape to close.
 *
 * ORDER CUTOFF — 11:15 IST: after that, adding people (composer,
 * add-all, copy-yesterday, guest +) is blocked with a rotating
 * "see you tomorrow" quip. Removing people stays allowed, so the
 * admin can still correct the list if someone leaves early.
 */

const CUTOFF_MIN = 11 * 60 + 15 // 11:15 IST

const CLOSED_LINES = [
  "Today's order time is over ⏰ The kitchen has locked the count. See you tomorrow at 10!",
  'Register closed for today. The rice has entered its no-refunds phase. Tomorrow, be quick!',
  "Too late for today — the chef is already mid-tadka. Fresh chances open tomorrow morning.",
  'Orders closed at 11:15. Time flies, plates get counted. Catch the register tomorrow!',
  "The 11:15 gate has shut. Today's lunch is destiny now. See you tomorrow, early bird.",
]

// Minutes since midnight in IST, regardless of the device's timezone
const nowISTMinutes = () => {
  const ist = new Date(Date.now() + 5.5 * 3600 * 1000)
  return ist.getUTCHours() * 60 + ist.getUTCMinutes()
}

export default function TodayPanel({ data }) {
  const { members, today, todayMemberIds, addToday, toggleEntry, copyYesterday, dayMeta, setMeta } = data

  const [text, setText] = useState('')
  const [highlight, setHighlight] = useState(0)
  const [closedMsg, setClosedMsg] = useState('')
  const [, forceTick] = useState(0)
  const inputRef = useRef(null)
  const composerRef = useRef(null)
  const toastTimer = useRef(null)

  const ordersClosed = nowISTMinutes() >= CUTOFF_MIN

  // Re-render once a minute so the panel flips to "closed" at 11:15
  // even if the tab has been open since morning.
  useEffect(() => {
    const t = setInterval(() => forceTick((n) => n + 1), 60 * 1000)
    return () => clearInterval(t)
  }, [])

  // Show a rotating "closed" quip near the composer, auto-hide after 4s
  const showClosed = () => {
    setClosedMsg(CLOSED_LINES[Math.floor(Math.random() * CLOSED_LINES.length)])
    clearTimeout(toastTimer.current)
    toastTimer.current = setTimeout(() => setClosedMsg(''), 4000)
  }
  useEffect(() => () => clearTimeout(toastTimer.current), [])

  const meta = dayMeta[today] || { guest_count: 0, note: '' }
  const inSet = new Set(todayMemberIds)
  const activeMembers = members.filter((m) => m.active)
  const todayMembers = activeMembers.filter((m) => inSet.has(m.id))

  // Suggestions open when the text contains "@"; the query is what follows it
  const atIndex = text.lastIndexOf('@')
  const open = atIndex !== -1 && !ordersClosed
  const query = open ? text.slice(atIndex + 1).trim().toLowerCase() : ''

  const suggestions = useMemo(() => {
    if (!open) return []
    return activeMembers
      .filter((m) => !inSet.has(m.id))
      .filter((m) => m.name.toLowerCase().includes(query))
  }, [open, query, activeMembers, inSet]) // eslint-disable-line react-hooks/exhaustive-deps

  // Close the dropdown when clicking anywhere outside the composer
  useEffect(() => {
    if (!open) return
    const onDown = (e) => {
      if (composerRef.current && !composerRef.current.contains(e.target)) setText('')
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [open])

  // Pick one member but KEEP the list open for the next pick
  const pick = (member) => {
    if (nowISTMinutes() >= CUTOFF_MIN) { setText(''); showClosed(); return }
    addToday(member.id, member.name)
    setText('@')
    setHighlight(0)
    inputRef.current?.focus()
  }

  const addAllRemaining = () => {
    if (nowISTMinutes() >= CUTOFF_MIN) { setText(''); showClosed(); return }
    suggestions.forEach((m) => addToday(m.id, m.name))
    setText('')
    inputRef.current?.focus()
  }

  const tryCopyYesterday = () => {
    if (nowISTMinutes() >= CUTOFF_MIN) { showClosed(); return }
    copyYesterday()
  }

  const onInputChange = (e) => {
    if (ordersClosed) { showClosed(); return }
    setText(e.target.value)
    setHighlight(0)
  }

  const onKeyDown = (e) => {
    if (e.key === 'Escape') {
      setText('')
      return
    }
    if (!open || suggestions.length === 0) return
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setHighlight((h) => (h + 1) % suggestions.length)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setHighlight((h) => (h - 1 + suggestions.length) % suggestions.length)
    } else if (e.key === 'Enter') {
      e.preventDefault()
      pick(suggestions[Math.min(highlight, suggestions.length - 1)])
    }
  }

  const bumpGuests = (delta) => {
    // Adding guest plates is also an order — blocked after cutoff.
    // Reducing is a correction — always allowed.
    if (delta > 0 && nowISTMinutes() >= CUTOFF_MIN) { showClosed(); return }
    const next = Math.max(0, (meta.guest_count || 0) + delta)
    setMeta(today, { guest_count: next })
  }

  return (
    <section className={styles.panel} aria-label="Today's lunch">
      <div className={styles.headRow}>
        <h2 className={styles.heading}>Who's in for lunch today?</h2>
        <button
          className={styles.copyBtn}
          onClick={tryCopyYesterday}
          disabled={ordersClosed}
          title={ordersClosed ? 'Orders closed for today' : undefined}
        >
          Copy yesterday's list
        </button>
      </div>

      <div className={styles.composer} ref={composerRef}>
        <input
          ref={inputRef}
          className={styles.input}
          value={text}
          onChange={onInputChange}
          onKeyDown={onKeyDown}
          placeholder={
            ordersClosed
              ? 'Orders closed for today (11:15) — register reopens tomorrow'
              : 'Type @ once, then keep picking — e.g. @pri'
          }
          disabled={ordersClosed}
          aria-label="Add members to today's lunch. Type @ to open the roster; it stays open so you can add several people."
          aria-expanded={open}
          autoComplete="off"
        />

        {closedMsg && (
          <div className={styles.closedToast} role="status">{closedMsg}</div>
        )}

        {open && (
          <ul className={styles.dropdown} role="listbox">
            {suggestions.length === 0 && (
              <li className={styles.emptyItem}>
                {activeMembers.length === todayMembers.length
                  ? 'Everyone on the roster is already in.'
                  : 'No match — check the spelling or add them in Team roster below.'}
              </li>
            )}
            {suggestions.length > 1 && query === '' && (
              <li>
                <button type="button" className={styles.addAll} onClick={addAllRemaining}>
                  Add everyone remaining ({suggestions.length})
                </button>
              </li>
            )}
            {suggestions.map((m, i) => (
              <li key={m.id}>
                <button
                  type="button"
                  role="option"
                  aria-selected={i === highlight}
                  className={`${styles.option} ${i === highlight ? styles.optionActive : ''}`}
                  onMouseEnter={() => setHighlight(i)}
                  onClick={() => pick(m)}
                >
                  <span className={m.food_pref === 'veg' ? styles.dotVeg : styles.dotNonveg} aria-hidden="true" />
                  <span className={styles.optionName}>{m.name}</span>
                  <span className={styles.optionPref}>{m.food_pref === 'veg' ? 'veg' : 'non-veg'}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className={styles.chips}>
        {todayMembers.length === 0 && (
          <p className={styles.emptyChips}>
            {ordersClosed
              ? 'No one made it onto the list today. The kitchen rests.'
              : 'No one marked in yet. Type @ above to start the roll call.'}
          </p>
        )}
        {todayMembers.map((m) => (
          <button
            key={m.id}
            className={styles.chip}
            onClick={() => toggleEntry(m.id, today, m.name)}
            title={`Remove ${m.name} from today`}
          >
            <span className={m.food_pref === 'veg' ? styles.dotVeg : styles.dotNonveg} aria-hidden="true" />
            {m.name}
            <span className={styles.chipX} aria-hidden="true">×</span>
          </button>
        ))}
      </div>

      <div className={styles.metaRow}>
        <div className={styles.guests}>
          <span className={styles.metaLabel}>Guest plates</span>
          <div className={styles.stepper}>
            <button onClick={() => bumpGuests(-1)} aria-label="One less guest plate">−</button>
            <span className={styles.guestCount}>{meta.guest_count || 0}</span>
            <button
              onClick={() => bumpGuests(1)}
              aria-label="One more guest plate"
              disabled={ordersClosed}
              title={ordersClosed ? 'Orders closed for today' : undefined}
            >
              +
            </button>
          </div>
        </div>

        <label className={styles.noteWrap}>
          <span className={styles.metaLabel}>Note for the day</span>
          <input
            className={styles.note}
            defaultValue={meta.note || ''}
            key={meta.note || 'empty'}
            placeholder="e.g. Friday biryani · two Jain meals"
            onBlur={(e) => {
              if (e.target.value !== (meta.note || '')) setMeta(today, { note: e.target.value })
            }}
          />
        </label>
      </div>
    </section>
  )
}