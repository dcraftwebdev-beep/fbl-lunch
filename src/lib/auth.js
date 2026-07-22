// ============================================================
// Dashboard login gate.
//
// LIVE (Supabase connected): the password is checked in Supabase by
// the `dashboard-auth` edge function against a hash stored in the
// private app_auth table. The browser never sees the hash — it sends
// the typed password and gets back yes / no. The password can be
// changed in-app (reset) or from SQL; no redeploy needed.
//
// DEMO (no Supabase): falls back to a local password so the app still
// runs out of the zip. Set it with VITE_APP_PASSWORD, else a default.
//
// Either way a small "remembered" flag in localStorage keeps you
// logged in on this browser until you press Log out. The public email
// pages (/join, /cancel) are never gated.
// ============================================================

import { isLive, supabaseClient } from './store'

const AUTH_KEY = 'fbl-lunch-auth-v1'
const REMEMBER_TOKEN = 'authed'

// ---- demo-mode fallback credentials ----
const DEMO_USERNAME = import.meta.env.VITE_APP_USERNAME || 'admin'
const DEMO_PASSWORD = import.meta.env.VITE_APP_PASSWORD || 'firebrand-lunch'
export const USING_DEFAULT_PASSWORD = isLive ? false : !import.meta.env.VITE_APP_PASSWORD

// Was this browser already logged in?
export const isAuthed = () => {
  try {
    return localStorage.getItem(AUTH_KEY) === REMEMBER_TOKEN
  } catch {
    return false
  }
}

const remember = () => {
  try { localStorage.setItem(AUTH_KEY, REMEMBER_TOKEN) } catch { /* private mode */ }
}

export const logout = () => {
  try { localStorage.removeItem(AUTH_KEY) } catch { /* ignore */ }
}

const authFn = (body) => supabaseClient.functions.invoke('dashboard-auth', { body })

// Verify username + password. Returns { ok, error? }.
export const login = async (username, attempt) => {
  if (!isLive) {
    const ok =
      (username ?? '').trim().toLowerCase() === DEMO_USERNAME.toLowerCase() &&
      (attempt ?? '') === DEMO_PASSWORD
    if (ok) remember()
    return { ok, error: ok ? undefined : 'Wrong username or password.' }
  }
  try {
    const { data, error } = await authFn({ action: 'login', username, password: attempt })
    if (error) return { ok: false, error: 'Could not reach the server. Try again.' }
    if (data?.ok) { remember(); return { ok: true } }
    return { ok: false, error: data?.error || 'Wrong username or password.' }
  } catch {
    return { ok: false, error: 'Could not reach the server. Try again.' }
  }
}

// Change the password. Requires the current one. Returns { ok, error? }.
export const resetPassword = async (current, next) => {
  if (!isLive) {
    return { ok: false, error: 'Password reset needs Supabase — not available in demo mode.' }
  }
  try {
    const { data, error } = await authFn({ action: 'reset', current, next })
    if (error) return { ok: false, error: 'Could not reach the server. Try again.' }
    if (data?.ok) return { ok: true }
    return { ok: false, error: data?.error || 'Could not update the password.' }
  } catch {
    return { ok: false, error: 'Could not reach the server. Try again.' }
  }
}
