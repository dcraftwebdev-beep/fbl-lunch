-- ============================================================
-- Migration v3 — dashboard login password, stored in Supabase.
-- Run this in the SQL Editor.
--
-- The password hash lives in its own table (app_auth) with RLS
-- ENABLED and NO policies — so the public anon key can NEVER read
-- it. Only the service-role key (used by the dashboard-auth edge
-- function) bypasses RLS and can check / update it. The browser
-- never sees the hash: it only sends a password to the function and
-- gets back yes / no.
-- ============================================================

create extension if not exists pgcrypto;

create table if not exists app_auth (
  id            int primary key default 1 check (id = 1),
  password_hash text not null,
  updated_at    timestamptz not null default now()
);

-- Lock it down: RLS on, and we add NO policies. anon + authenticated
-- get nothing; the edge function's service-role key bypasses RLS.
alter table app_auth enable row level security;

-- ---- SET YOUR INITIAL PASSWORD HERE ----
-- Change 'firebrand2026' to your team password, then run the file.
-- (SHA-256 hex — matches how the edge function hashes the attempt.)
insert into app_auth (id, password_hash)
values (1, encode(digest('firebrand2026', 'sha256'), 'hex'))
on conflict (id) do nothing;

-- To reset the password later straight from SQL (e.g. if it's
-- forgotten and no one is logged in to use the in-app reset):
--   update app_auth
--      set password_hash = encode(digest('new-password', 'sha256'), 'hex'),
--          updated_at = now()
--    where id = 1;