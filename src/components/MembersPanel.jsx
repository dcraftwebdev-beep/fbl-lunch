import { useState } from 'react'
import styles from './MembersPanel.module.css'

export default function MembersPanel({ data }) {
  const { members, addMember, updateMember, deleteMember } = data
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [pref, setPref] = useState('veg')
  const [confirmId, setConfirmId] = useState(null)   // member awaiting delete confirmation
  const [emailEditId, setEmailEditId] = useState(null) // member whose email is being edited

  const submit = () => {
    const clean = name.trim()
    if (!clean) return
    const dupe = members.some((m) => m.name.toLowerCase() === clean.toLowerCase())
    if (dupe) return
    addMember(clean, pref, email.trim())
    setName('')
    setEmail('')
  }

  const isDupe = members.some((m) => m.name.toLowerCase() === name.trim().toLowerCase()) && name.trim() !== ''

  const saveEmail = (m, value) => {
    const clean = value.trim()
    if (clean !== (m.email || '')) updateMember(m.id, { email: clean })
    setEmailEditId(null)
  }

  return (
    <section className={styles.panel} aria-label="Team roster">
      <h2 className={styles.heading}>Team roster</h2>
      <p className={styles.sub}>
        Everyone here appears in the @ roll call. Emails power the confirmation,
        cancel-link and daily mails. Mark someone as left to keep their history,
        or remove them to delete their history too.
      </p>

      <div className={styles.addRow}>
        <input
          className={styles.nameInput}
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && submit()}
          placeholder="New member's name"
          aria-label="New member's name"
        />
        <input
          className={styles.emailInput}
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && submit()}
          placeholder="Email (for lunch mails)"
          aria-label="New member's email"
        />
        <div className={styles.prefToggle} role="radiogroup" aria-label="Food preference">
          <button
            role="radio"
            aria-checked={pref === 'veg'}
            className={pref === 'veg' ? styles.prefOnVeg : styles.prefOff}
            onClick={() => setPref('veg')}
          >
            Veg
          </button>
          <button
            role="radio"
            aria-checked={pref === 'nonveg'}
            className={pref === 'nonveg' ? styles.prefOnNonveg : styles.prefOff}
            onClick={() => setPref('nonveg')}
          >
            Non-veg
          </button>
        </div>
        <button className={styles.addBtn} onClick={submit} disabled={!name.trim() || isDupe}>
          Add to roster
        </button>
      </div>
      {isDupe && <p className={styles.dupeNote}>That name is already on the roster.</p>}

      <ul className={styles.list}>
        {members.map((m) => (
          <li key={m.id} className={`${styles.row} ${!m.active ? styles.rowInactive : ''}`}>
            <span className={m.food_pref === 'veg' ? styles.dotVeg : styles.dotNonveg} aria-hidden="true" />

            <span className={styles.rowMain}>
              <span className={styles.rowName}>{m.name}</span>
              {emailEditId === m.id ? (
                <input
                  className={styles.rowEmailInput}
                  type="email"
                  defaultValue={m.email || ''}
                  autoFocus
                  placeholder="name@firebrandlabs.in"
                  onBlur={(e) => saveEmail(m, e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') saveEmail(m, e.target.value)
                    if (e.key === 'Escape') setEmailEditId(null)
                  }}
                />
              ) : (
                <button
                  className={m.email ? styles.rowEmail : styles.rowEmailMissing}
                  onClick={() => setEmailEditId(m.id)}
                  title="Click to edit email"
                >
                  {m.email || 'no email — click to add'}
                </button>
              )}
            </span>

            {confirmId === m.id ? (
              <>
                <span className={styles.confirmText}>Deletes their lunch history too.</span>
                <button
                  className={styles.confirmBtn}
                  onClick={() => { deleteMember(m.id, m.name); setConfirmId(null) }}
                >
                  Yes, remove
                </button>
                <button className={styles.smallBtn} onClick={() => setConfirmId(null)}>
                  Keep
                </button>
              </>
            ) : (
              <>
                <button
                  className={styles.smallBtn}
                  onClick={() => updateMember(m.id, { food_pref: m.food_pref === 'veg' ? 'nonveg' : 'veg' })}
                  title="Switch food preference"
                >
                  {m.food_pref === 'veg' ? 'veg' : 'non-veg'}
                </button>

                <button
                  className={styles.smallBtn}
                  onClick={() => updateMember(m.id, { active: !m.active })}
                >
                  {m.active ? 'Mark as left' : 'Bring back'}
                </button>

                <button
                  className={styles.removeBtn}
                  onClick={() => setConfirmId(m.id)}
                  title={`Remove ${m.name} and their history`}
                >
                  Remove
                </button>
              </>
            )}
          </li>
        ))}
      </ul>
    </section>
  )
}
