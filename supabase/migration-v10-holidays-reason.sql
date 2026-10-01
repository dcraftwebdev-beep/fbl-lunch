-- ============================================================
-- migration-v10-holidays-reason.sql
-- 1. Adds a reason for a closed kitchen (shown on the dashboard).
-- 2. Creates a holidays table and seeds the 2026 company holidays.
-- 3. Auto-closes the kitchen (day_meta.no_cooking) on every holiday date,
--    with the holiday name as the reason.
-- Safe to re-run. Run in: Supabase Dashboard -> SQL Editor -> New query.
-- ============================================================

-- 1. Reason for a no-cooking day.
alter table day_meta add column if not exists no_cooking_reason text;

-- 2. Holidays table.
create table if not exists holidays (
  holiday_date date primary key,
  name         text not null
);

alter table holidays enable row level security;
drop policy if exists "holidays read" on holidays;
create policy "holidays read" on holidays for select using (true);

insert into holidays (holiday_date, name) values
  ('2026-01-01', 'New Year''s Day'),
  ('2026-01-15', 'Pongal / Makara Sankaranthi'),
  ('2026-01-26', 'Republic Day'),
  ('2026-04-14', 'Tamil New Year''s Day'),
  ('2026-05-01', 'May Day'),
  ('2026-08-15', 'Independence Day'),
  ('2026-09-14', 'Vinayagar Chathurthi'),
  ('2026-10-02', 'Gandhi Jayanthi'),
  ('2026-10-19', 'Ayudha Pooja'),
  ('2026-11-08', 'Deepavali'),
  ('2026-11-09', 'Deepavali (additional day)'),
  ('2026-12-25', 'Christmas')
on conflict (holiday_date) do update set name = excluded.name;

-- 3. Close the kitchen on every holiday date, reason = holiday name.
--    Keeps any existing guest_count / note on those rows.
insert into day_meta (lunch_date, no_cooking, no_cooking_reason)
select holiday_date, true, name from holidays
on conflict (lunch_date) do update
  set no_cooking = true,
      no_cooking_reason = excluded.no_cooking_reason;
