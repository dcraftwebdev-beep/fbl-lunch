// ============================================================
// Shared-password gate for the dashboard.
//
// The register is an internal tool — this keeps "anyone with the
// link" out with a single team password. Set it in .env:
//
//   VITE_APP_PASSWORD=your-team-password
//
// If it is not set, a default is used so the app still runs out of
// the box (change it before sharing the link!). This is a client-side
// gate: good enough to stop casual access to an internal tool, not a
// replacement for real per-user auth. The public one-click email
// pages (/join, /cancel) are intentionally NOT gated.
// ============================================================

const CONFIGURED = import.meta.env.VITE_APP_PASSWORD
export const APP_PASSWORD = CONFIGURED || 'firebrand-lunch'

// True when no password was set in .env — surfaced on the login page
// as a gentle reminder to set one before sharing the dashboard.
export const USING_DEFAULT_PASSWORD = !CONFIGURED

const AUTH_KEY = 'fbl-lunch-auth-v1'

// We store a small token (not the password) so a shared computer
// doesn't leave the password sitting in localStorage.
const token = () => btoa(`ok:${APP_PASSWORD.length}`)

export const isAuthed = () => {
  try {
    return localStorage.getItem(AUTH_KEY) === token()
  } catch {
    return false
  }
}

export const login = (attempt) => {
  if ((attempt ?? '') !== APP_PASSWORD) return false
  try {
    localStorage.setItem(AUTH_KEY, token())
  } catch { /* private mode — session-only, still fine */ }
  return true
}

export const logout = () => {
  try {
    localStorage.removeItem(AUTH_KEY)
  } catch { /* ignore */ }
}
