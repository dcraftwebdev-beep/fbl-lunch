import { useEffect, useMemo, useRef, useState } from 'react'
import styles from './TodayPanel.module.css'

/**
 * The daily roll-call. Type @ once — the roster stays open so you can
 * add several people in a row. "Add everyone remaining" fills the rest.
 * Click outside or press Escape to close.
 */
export default function TodayPanel({ data }) {
  const { members, today, todayMemberIds, addToday, toggleEntry, copyYesterday, dayMeta, setMeta } = data

  const [text, setText] = useState('')
  const [highlight, setHighlight] = useState(0)
  const inputRef = useRef(null)
  const composerRef = useRef(null)

  const meta = dayMeta[today] || { guest_count: 0, note: '' }
  const inSet = new Set(todayMemberIds)
  const activeMembers = members.filter((m) => m.active)
  const todayMembers = activeMembers.filter((m) => inSet.has(m.id))

  // Suggestions open when the text contains "@"; the query is what follows it
  const atIndex = text.lastIndexOf('@')
  const open = atIndex !== -1
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
    addToday(member.id, member.name)
    setText('@')
    setHighlight(0)
    inputRef.current?.focus()
  }

  const addAllRemaining = () => {
    suggestions.forEach((m) => addToday(m.id, m.name))
    setText('')
    inputRef.current?.focus()
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
    const next = Math.max(0, (meta.guest_count || 0) + delta)
    setMeta(today, { guest_count: next })
  }

  return (
    <section className={styles.panel} aria-label="Today's lunch">
      <div className={styles.headRow}>
        <h2 className={styles.heading}>Who's in for lunch today?</h2>
        <button className={styles.copyBtn} onClick={copyYesterday}>
          Copy yesterday's list
        </button>
      </div>

      <div className={styles.composer} ref={composerRef}>
        <input
          ref={inputRef}
          className={styles.input}
          value={text}
          onChange={(e) => { setText(e.target.value); setHighlight(0) }}
          onKeyDown={onKeyDown}
          placeholder="Type @ once, then keep picking — e.g. @pri"
          aria-label="Add members to today's lunch. Type @ to open the roster; it stays open so you can add several people."
          aria-expanded={open}
          autoComplete="off"
        />

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
          <p className={styles.emptyChips}>No one marked in yet. Type @ above to start the roll call.</p>
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
            <button onClick={() => bumpGuests(1)} aria-label="One more guest plate">+</button>
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
