-- ============================================================
-- migration-v8-username-auth.sql
-- Username + password login for the dashboard. Sets the DEFAULT
-- credentials and removes the old forgot-password columns. Safe to
-- re-run. Run in: Supabase Dashboard → SQL Editor → New query.
--
-- ┌───────────────────────────────────────────────┐
-- │  DEFAULT LOGIN AFTER RUNNING THIS:             │
-- │     username:  admin                           │
-- │     password:  firebrand2026                   │
-- └───────────────────────────────────────────────┘
-- Change the password anytime from the dashboard (Change password).
-- ============================================================

create extension if not exists pgcrypto;

-- 1. Username column (defaults to 'admin')
alter table app_auth add column if not exists username text not null default 'admin';

-- 2. Set the default credentials — admin / firebrand2026
update app_auth
   set username      = 'admin',
       password_hash = encode(digest('firebrand2026', 'sha256'), 'hex'),
       updated_at    = now()
 where id = 1;

-- Make sure a row exists even on a fresh project
insert into app_auth (id, username, password_hash)
values (1, 'admin', encode(digest('firebrand2026', 'sha256'), 'hex'))
on conflict (id) do nothing;

-- 3. Remove the forgot-password machinery (no longer used)
alter table app_auth     drop column if exists reset_code_hash;
alter table app_auth     drop column if exists reset_expires_at;
alter table app_settings drop column if exists admin_email;
