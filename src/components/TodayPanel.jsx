import { useEffect, useMemo, useRef, useState } from 'react'
import styles from './TodayPanel.module.css'

/**
 * The daily roll-call. Type @ once — the roster stays open so you can
 * add several people in a row. "Add everyone remaining" fills the rest.
 * Click outside or press Escape to close.
 *
 * ORDER CUTOFF — 11:15 AM IST: the order window opens each lunch
 * morning (defaults auto-added ~10:00 AM) and closes 11:15 AM the
 * same day. After 11:15 AM BOTH directions lock. Adding (composer,
 * add-all, copy-yesterday, guest +) gets a "window closed" quip;
 * removing (chips, guest −) gets a "food will go to waste" quip.
 * Corrections after 11:15 AM go through the register table below.
 */

const CUTOFF_MIN = 11 * 60 + 15 // 11:15 AM IST

const CLOSED_LINES = [
  'Order time over ⏰ Window closed at 11:15 AM.',
  'Register closed. Opens again tomorrow ~10:00 AM.',
  'Locked at 11:15 AM. Be quicker next time!',
  'Closed. The rice has a no-refunds policy. 🍚',
]

const NO_REMOVE_LINES = [
  "Can't remove — plate's being cooked. No food waste. 🍛",
  'Too late to pull a plate. It stays.',
  'Locked since 11:15 AM. No removals.',
  'Genuine mistake? Fix it in the register table below.',
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

  // Re-render once a minute so the panel flips to "closed" at 11:15 AM
  // even if the tab has been open all day.
  useEffect(() => {
    const t = setInterval(() => forceTick((n) => n + 1), 60 * 1000)
    return () => clearInterval(t)
  }, [])

  // Show a rotating quip near the composer, auto-hide after 4s.
  // Pass a pool: CLOSED_LINES for blocked adds, NO_REMOVE_LINES for
  // blocked removals.
  const showClosed = (pool = CLOSED_LINES) => {
    setClosedMsg(pool[Math.floor(Math.random() * pool.length)])
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

  // Removing a plate is blocked after cutoff — the kitchen already
  // has the list, so a removed plate is cooked food gone to waste.
  const tryRemove = (m) => {
    if (nowISTMinutes() >= CUTOFF_MIN) { showClosed(NO_REMOVE_LINES); return }
    toggleEntry(m.id, today, m.name)
  }

  const bumpGuests = (delta) => {
    // Both directions are orders once the kitchen has the list:
    // + after cutoff = uncounted plate, − after cutoff = wasted plate.
    if (delta > 0 && nowISTMinutes() >= CUTOFF_MIN) { showClosed(); return }
    if (delta < 0 && nowISTMinutes() >= CUTOFF_MIN) { showClosed(NO_REMOVE_LINES); return }
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
              ? 'Orders closed (11:15 AM) — opens again tomorrow ~10:00 AM'
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
            onClick={() => tryRemove(m)}
            title={
              ordersClosed
                ? `List is with the kitchen — ${m.name}'s plate can't be removed now`
                : `Remove ${m.name} from today`
            }
          >
            <span className={m.food_pref === 'veg' ? styles.dotVeg : styles.dotNonveg} aria-hidden="true" />
            {m.name}
            <span className={styles.chipX} aria-hidden="true">{ordersClosed ? '🔒' : '×'}</span>
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