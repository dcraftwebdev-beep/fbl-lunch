-- ============================================================
-- migration-v9-no-cooking.sql
-- "No cooking today" flag. When the dashboard toggle is on for a date,
-- day_meta.no_cooking = true → the bot announces "eat outside today" and
-- turns away !lunch in/out, and the daily auto-posts/emails are skipped.
-- Safe to re-run. Run in: Supabase Dashboard → SQL Editor → New query.
-- ============================================================

alter table day_meta add column if not exists no_cooking boolean not null default false;
