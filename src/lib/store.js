// ============================================================
// Data layer for the Lunch Register.
//
// If VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY are set in .env,
// everything reads/writes Supabase (see supabase/schema.sql).
//
// If they are NOT set, the app runs in Demo mode on localStorage
// with a seeded roster — so the project works straight out of
// the zip. Add your .env and restart to go live.
// ============================================================

import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY

export const isLive = Boolean(SUPABASE_URL && SUPABASE_KEY)

/* ----------------------------- Supabase ----------------------------- */

const supabase = isLive ? createClient(SUPABASE_URL, SUPABASE_KEY) : null

// Exposed so the login gate (src/lib/auth.js) can call the
// dashboard-auth edge function. Null in demo mode.
export const supabaseClient = supabase

const supabaseStore = {
  async listMembers() {
    const { data, error } = await supabase
      .from('members')
      .select('*')
      .order('created_at', { ascending: true })
    if (error) throw error
    return data
  },

  async addMember(name, food_pref, email = '') {
    const { data, error } = await supabase
      .from('members')
      .insert({ name, food_pref, email })
      .select()
      .single()
    if (error) throw error
    return data
  },

  async updateMember(id, fields) {
    const { data, error } = await supabase
      .from('members')
      .update(fields)
      .eq('id', id)
      .select()
      .single()
    if (error) throw error
    return data
  },

  async deleteMember(id) {
    // lunch_entries rows cascade-delete via the FK in schema.sql
    const { error } = await supabase.from('members').delete().eq('id', id)
    if (error) throw error
  },

  async getEntries(from, to) {
    const { data, error } = await supabase
      .from('lunch_entries')
      .select('member_id, lunch_date')
      .gte('lunch_date', from)
      .lte('lunch_date', to)
    if (error) throw error
    return data
  },

  async addEntry(member_id, lunch_date) {
    const { error } = await supabase
      .from('lunch_entries')
      .upsert({ member_id, lunch_date }, { onConflict: 'member_id,lunch_date', ignoreDuplicates: true })
    if (error) throw error
  },

  async removeEntry(member_id, lunch_date) {
    const { error } = await supabase
      .from('lunch_entries')
      .delete()
      .eq('member_id', member_id)
      .eq('lunch_date', lunch_date)
    if (error) throw error
  },

  async getDayMeta(from, to) {
    const { data, error } = await supabase
      .from('day_meta')
      .select('*')
      .gte('lunch_date', from)
      .lte('lunch_date', to)
    if (error) throw error
    return data
  },

  async setDayMeta(lunch_date, fields) {
    const { error } = await supabase
      .from('day_meta')
      .upsert({ lunch_date, ...fields }, { onConflict: 'lunch_date' })
    if (error) throw error
  },

  async getSettings() {
    const { data, error } = await supabase.from('app_settings').select('*').eq('id', 1).maybeSingle()
    if (error) throw error
    return data || { chef_name: '', chef_email: '', chef_photo: '', cutoff: '11:00' }
  },

  async updateSettings(fields) {
    const { error } = await supabase.from('app_settings').upsert({ id: 1, ...fields })
    if (error) throw error
  },

  // Fire the +1/-1 + confirmation emails. Fire-and-forget from the UI.
  async notifyChange(member_id, action) {
    const { data, error } = await supabase.functions.invoke('notify-change', { body: { member_id, action } })
    if (error) throw error
    return data
  },

  // Send (or resend, updated) today's list to the chef.
  async sendChefList() {
    const { data, error } = await supabase.functions.invoke('send-chef-list', { body: { force: true } })
    if (error) throw error
    return data
  },
}

/* --------------------------- Demo (local) --------------------------- */

const LS_KEY = 'fbl-lunch-register-v1'

const seedDb = () => {
  const names = [
    ['Arjun', 'nonveg'],
    ['Priya', 'veg'],
    ['Karthik', 'nonveg'],
    ['Divya', 'veg'],
    ['Sanjay', 'veg'],
    ['Meera', 'nonveg'],
  ]
  const members = names.map(([name, food_pref], i) => ({
    id: `demo-${i + 1}`,
    name,
    food_pref,
    email: '',
    active: true,
    created_at: new Date().toISOString(),
  }))

  // A little back-history so the register and export aren't empty
  const entries = []
  const today = new Date()
  for (let d = 1; d <= 9; d++) {
    const date = new Date(today)
    date.setDate(today.getDate() - d)
    const iso = date.toISOString().slice(0, 10)
    members.forEach((m, i) => {
      if ((d + i) % 3 !== 0) entries.push({ member_id: m.id, lunch_date: iso })
    })
  }

  return { members, entries, dayMeta: {} }
}

const readDb = () => {
  try {
    const raw = localStorage.getItem(LS_KEY)
    if (raw) return JSON.parse(raw)
  } catch { /* fall through to reseed */ }
  const db = seedDb()
  localStorage.setItem(LS_KEY, JSON.stringify(db))
  return db
}

const writeDb = (db) => localStorage.setItem(LS_KEY, JSON.stringify(db))

const localStore = {
  async listMembers() {
    return readDb().members
  },

  async addMember(name, food_pref, email = '') {
    const db = readDb()
    const member = {
      id: `local-${Date.now()}`,
      name,
      food_pref,
      email,
      active: true,
      created_at: new Date().toISOString(),
    }
    db.members.push(member)
    writeDb(db)
    return member
  },

  async updateMember(id, fields) {
    const db = readDb()
    const m = db.members.find((x) => x.id === id)
    if (!m) throw new Error('Member not found')
    Object.assign(m, fields)
    writeDb(db)
    return m
  },

  async deleteMember(id) {
    const db = readDb()
    db.members = db.members.filter((m) => m.id !== id)
    db.entries = db.entries.filter((e) => e.member_id !== id)
    writeDb(db)
  },

  async getEntries(from, to) {
    return readDb().entries.filter((e) => e.lunch_date >= from && e.lunch_date <= to)
  },

  async addEntry(member_id, lunch_date) {
    const db = readDb()
    const exists = db.entries.some((e) => e.member_id === member_id && e.lunch_date === lunch_date)
    if (!exists) {
      db.entries.push({ member_id, lunch_date })
      writeDb(db)
    }
  },

  async removeEntry(member_id, lunch_date) {
    const db = readDb()
    db.entries = db.entries.filter((e) => !(e.member_id === member_id && e.lunch_date === lunch_date))
    writeDb(db)
  },

  async getDayMeta(from, to) {
    const db = readDb()
    return Object.values(db.dayMeta).filter((d) => d.lunch_date >= from && d.lunch_date <= to)
  },

  async setDayMeta(lunch_date, fields) {
    const db = readDb()
    db.dayMeta[lunch_date] = { lunch_date, guest_count: 0, note: '', ...db.dayMeta[lunch_date], ...fields }
    writeDb(db)
  },

  async getSettings() {
    const db = readDb()
    return db.settings || { chef_name: '', chef_email: '', chef_photo: '', cutoff: '11:00' }
  },

  async updateSettings(fields) {
    const db = readDb()
    db.settings = { chef_name: '', chef_email: '', chef_photo: '', cutoff: '11:00', ...db.settings, ...fields }
    writeDb(db)
  },

  // Emails need Supabase + Resend — not available in demo mode.
  async notifyChange() {
    return { demo: true }
  },

  async sendChefList() {
    throw new Error('Emails need Supabase — demo mode stores data only in this browser.')
  },
}

export const store = isLive ? supabaseStore : localStore
