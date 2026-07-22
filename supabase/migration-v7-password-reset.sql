-- ============================================================
-- migration-v7-password-reset.sql
-- Adds "Forgot password" support: a short-lived reset code is emailed
-- to a recovery inbox, then used to set a new password WITHOUT knowing
-- the old one. Safe to re-run.
-- Run in: Supabase Dashboard → SQL Editor → New query.
-- ============================================================

-- Where the reset code is stored (hash + expiry). Never leaves the DB.
alter table app_auth add column if not exists reset_code_hash  text;
alter table app_auth add column if not exists reset_expires_at timestamptz;

-- The recovery inbox that receives reset codes. Change it to whoever
-- should be able to recover the dashboard password.
alter table app_settings add column if not exists admin_email text not null default '';
update app_settings
   set admin_email = 'digital@firebrandlabs.in'
 where id = 1 and admin_email = '';
