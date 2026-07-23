import { useCallback, useEffect, useMemo, useState } from 'react'
import { format, subDays } from 'date-fns'
import { store } from '../lib/store'

export const DAYS_SHOWN = 10

const iso = (d) => format(d, 'yyyy-MM-dd')

export function useLunchData(notify) {
  const today = iso(new Date())
  const rangeStart = iso(subDays(new Date(), DAYS_SHOWN - 1))

  const [members, setMembers] = useState([])
  const [entries, setEntries] = useState([]) // { member_id, lunch_date } within range
  const [dayMeta, setDayMeta] = useState({}) // { [date]: { guest_count, note } }
  const [settings, setSettings] = useState({ chef_name: '', chef_email: '', chef_photo: '', cutoff: '11:00' })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const refresh = useCallback(async () => {
    try {
      const [m, e, dm, s] = await Promise.all([
        store.listMembers(),
        store.getEntries(rangeStart, today),
        store.getDayMeta(rangeStart, today),
        store.getSettings(),
      ])
      setMembers(m)
      setEntries(e)
      setDayMeta(Object.fromEntries(dm.map((d) => [d.lunch_date, d])))
      setSettings(s)
      setError(null)
    } catch (err) {
      console.error(err)
      setError('Could not reach the database. Check your .env keys and Supabase project, then reload.')
    } finally {
      setLoading(false)
    }
  }, [rangeStart, today])

  useEffect(() => { refresh() }, [refresh])

  /* ------------ derived ------------ */

  const days = useMemo(
    () => Array.from({ length: DAYS_SHOWN }, (_, i) => iso(subDays(new Date(), DAYS_SHOWN - 1 - i))),
    [today] // eslint-disable-line react-hooks/exhaustive-deps
  )

  const entrySet = useMemo(() => new Set(entries.map((e) => `${e.member_id}|${e.lunch_date}`)), [entries])
  const isIn = useCallback((memberId, date) => entrySet.has(`${memberId}|${date}`), [entrySet])

  const todayMemberIds = useMemo(
    () => entries.filter((e) => e.lunch_date === today).map((e) => e.member_id),
    [entries, today]
  )

  /* ------------ actions (optimistic) ------------ */

  const toggleEntry = useCallback(async (memberId, date, name) => {
    const on = entrySet.has(`${memberId}|${date}`)
    setEntries((prev) =>
      on
        ? prev.filter((e) => !(e.member_id === memberId && e.lunch_date === date))
        : [...prev, { member_id: memberId, lunch_date: date }]
    )
    try {
      if (on) await store.removeEntry(memberId, date)
      else await store.addEntry(memberId, date)
      if (name) notify(on ? `${name} removed` : `${name} added`)
      // Emails (confirmation + chef +1/-1) only apply to changes to TODAY
      if (date === today) {
        store.notifyChange(memberId, on ? 'removed' : 'added').catch((e) => console.warn('notify-change:', e))
      }
    } catch (err) {
      console.error(err)
      notify('Save failed — change rolled back', 'error')
      refresh()
    }
  }, [entrySet, notify, refresh])

  const addToday = useCallback((memberId, name) => {
    if (!entrySet.has(`${memberId}|${today}`)) toggleEntry(memberId, today, name)
  }, [entrySet, today, toggleEntry])

  const copyYesterday = useCallback(async () => {
    const yesterday = iso(subDays(new Date(), 1))
    const ids = entries.filter((e) => e.lunch_date === yesterday).map((e) => e.member_id)
    const activeIds = new Set(members.filter((m) => m.active).map((m) => m.id))
    const toAdd = ids.filter((id) => activeIds.has(id) && !entrySet.has(`${id}|${today}`))
    if (toAdd.length === 0) {
      notify('Nothing new to copy from yesterday')
      return
    }
    setEntries((prev) => [...prev, ...toAdd.map((id) => ({ member_id: id, lunch_date: today }))])
    try {
      await Promise.all(toAdd.map((id) => store.addEntry(id, today)))
      toAdd.forEach((id) => store.notifyChange(id, 'added').catch((e) => console.warn('notify-change:', e)))
      notify(`Copied ${toAdd.length} from yesterday`)
    } catch (err) {
      console.error(err)
      notify('Copy failed — reloading', 'error')
      refresh()
    }
  }, [entries, entrySet, members, today, notify, refresh])

  const setMeta = useCallback(async (date, fields) => {
    setDayMeta((prev) => ({ ...prev, [date]: { lunch_date: date, guest_count: 0, note: '', ...prev[date], ...fields } }))
    try {
      await store.setDayMeta(date, fields)
    } catch (err) {
      console.error(err)
      notify('Could not save — try again', 'error')
    }
  }, [notify])

  const addMember = useCallback(async (name, pref, email = '') => {
    try {
      const m = await store.addMember(name, pref, email)
      setMembers((prev) => [...prev, m])
      notify(`${name} joined the roster`)
      return m
    } catch (err) {
      console.error(err)
      notify('Could not add member', 'error')
    }
  }, [notify])

  const updateMember = useCallback(async (id, fields) => {
    setMembers((prev) => prev.map((m) => (m.id === id ? { ...m, ...fields } : m)))
    try {
      await store.updateMember(id, fields)
    } catch (err) {
      console.error(err)
      notify('Could not save member', 'error')
      refresh()
    }
  }, [notify, refresh])

  const deleteMember = useCallback(async (id, name) => {
    // Optimistic: drop the member and every entry of theirs from state
    setMembers((prev) => prev.filter((m) => m.id !== id))
    setEntries((prev) => prev.filter((e) => e.member_id !== id))
    try {
      await store.deleteMember(id)
      notify(`${name} removed from the roster`)
    } catch (err) {
      console.error(err)
      notify('Could not remove member — reloading', 'error')
      refresh()
    }
  }, [notify, refresh])

  const updateSettings = useCallback(async (fields) => {
    setSettings((prev) => ({ ...prev, ...fields }))
    try {
      await store.updateSettings(fields)
      notify('Chef details saved')
    } catch (err) {
      console.error(err)
      notify('Could not save chef details', 'error')
      refresh()
    }
  }, [notify, refresh])

  const sendChefList = useCallback(async () => {
    try {
      const res = await store.sendChefList()
      notify(res?.sent ? `List sent to the chef — ${res.total} plates` : 'List already sent today')
    } catch (err) {
      console.error(err)
      notify(err.message || 'Could not send — check chef email and Resend setup', 'error')
    }
  }, [notify])

  // "No cooking today" toggle — optimistic flag + server announce to the group.
  const setKitchenClosed = useCallback(async (closed) => {
    setDayMeta((prev) => ({
      ...prev,
      [today]: { lunch_date: today, guest_count: 0, note: '', ...prev[today], no_cooking: closed },
    }))
    try {
      await store.setKitchenClosed(closed)
      notify(closed ? 'Kitchen closed — team told to eat outside 🙏' : 'Kitchen reopened for today 🍛')
    } catch (err) {
      console.error(err)
      notify('Could not update kitchen status — try again', 'error')
      refresh()
    }
  }, [today, notify, refresh])

  return {
    today, days, members, entries, dayMeta, loading, error, settings,
    isIn, todayMemberIds,
    toggleEntry, addToday, copyYesterday, setMeta, addMember, updateMember, deleteMember,
    updateSettings, sendChefList, setKitchenClosed,
  }
}
