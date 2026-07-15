import { useState } from 'react'
import { format, subDays, startOfMonth } from 'date-fns'
import { exportExcel } from '../lib/exportExcel'
import styles from './ExportPanel.module.css'

const iso = (d) => format(d, 'yyyy-MM-dd')

export default function ExportPanel({ data, notify }) {
  const todayIso = iso(new Date())
  const [from, setFrom] = useState(iso(subDays(new Date(), 9)))
  const [to, setTo] = useState(todayIso)
  const [busy, setBusy] = useState(false)

  const presets = [
    { label: 'Last 10 days', from: iso(subDays(new Date(), 9)), to: todayIso },
    { label: 'Last 30 days', from: iso(subDays(new Date(), 29)), to: todayIso },
    { label: 'This month', from: iso(startOfMonth(new Date())), to: todayIso },
  ]

  const download = async () => {
    if (from > to) {
      notify('The From date must be before the To date', 'error')
      return
    }
    setBusy(true)
    try {
      const fname = await exportExcel({ from, to, members: data.members })
      notify(`Downloaded ${fname}`)
    } catch (err) {
      console.error(err)
      notify('Export failed — try again', 'error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className={styles.panel} aria-label="Download the register">
      <h2 className={styles.heading}>Download the register</h2>
      <p className={styles.sub}>
        Excel workbook with the full member × date register and a daily summary sheet
        (headcount, veg / non-veg split, guest plates, notes).
      </p>

      <div className={styles.presets}>
        {presets.map((p) => (
          <button
            key={p.label}
            className={`${styles.preset} ${from === p.from && to === p.to ? styles.presetActive : ''}`}
            onClick={() => { setFrom(p.from); setTo(p.to) }}
          >
            {p.label}
          </button>
        ))}
      </div>

      <div className={styles.rangeRow}>
        <label className={styles.field}>
          <span>From</span>
          <input type="date" value={from} max={to} onChange={(e) => setFrom(e.target.value)} />
        </label>
        <label className={styles.field}>
          <span>To</span>
          <input type="date" value={to} min={from} max={todayIso} onChange={(e) => setTo(e.target.value)} />
        </label>
      </div>

      <button className={styles.downloadBtn} onClick={download} disabled={busy}>
        {busy ? 'Preparing…' : 'Download Excel (.xlsx)'}
      </button>
    </section>
  )
}
