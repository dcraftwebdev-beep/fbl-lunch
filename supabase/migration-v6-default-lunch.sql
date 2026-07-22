-- ============================================================
-- migration-v6-default-lunch.sql
-- Per-member "default lunch" flag. Members flagged is_default are
-- auto-added to every lunch day by the morning-invite function and
-- shown in the Basecamp group post. Manage the flags in the dashboard
-- (Team roster → the "default" toggle). Safe to re-run.
-- Run in: Supabase Dashboard → SQL Editor → New query.
-- ============================================================

alter table members
  add column if not exists is_default boolean not null default false;

-- Seed the current default crew by first name (one-time; safe to re-run).
update members set is_default = true
where active
  and lower(split_part(trim(name), ' ', 1)) in ('dinesh', 'jey', 'ajey', 'dipak', 'lazzo');
