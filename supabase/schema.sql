-- ============================================================
-- Firebrand Labs · Lunch Register — Supabase schema
-- Run this once in: Supabase Dashboard -> SQL Editor -> New query
-- ============================================================

-- Team roster
create table if not exists members (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  email       text not null default '',
  food_pref   text not null default 'veg' check (food_pref in ('veg', 'nonveg')),
  active      boolean not null default true,
  created_at  timestamptz not null default now()
);

-- One row per member per day they are in for lunch
create table if not exists lunch_entries (
  id           uuid primary key default gen_random_uuid(),
  member_id    uuid not null references members(id) on delete cascade,
  lunch_date   date not null,
  cancel_token uuid not null default gen_random_uuid(),
  created_at   timestamptz not null default now(),
  unique (member_id, lunch_date)
);

-- Per-day extras: guest plates and a menu / note line
create table if not exists day_meta (
  lunch_date  date primary key,
  guest_count int  not null default 0,
  note        text not null default ''
);

create index if not exists idx_lunch_entries_date on lunch_entries (lunch_date);

-- Single-row settings: chef profile + cutoff time (IST, HH:MM)
create table if not exists app_settings (
  id          int primary key default 1 check (id = 1),
  chef_name   text not null default '',
  chef_email  text not null default '',
  chef_photo  text not null default '',
  cutoff      text not null default '11:00'
);
insert into app_settings (id) values (1) on conflict do nothing;

-- Log of sent emails: idempotency for crons + "was the chef list sent yet?"
create table if not exists email_log (
  id         uuid primary key default gen_random_uuid(),
  kind       text not null,          -- 'chef_list' | 'chef_update' | 'member_confirm' | 'daily_funny'
  lunch_date date not null,
  member_id  uuid,
  sent_at    timestamptz not null default now()
);
create unique index if not exists uq_email_once
  on email_log (kind, lunch_date, coalesce(member_id, '00000000-0000-0000-0000-000000000000'::uuid));


-- ------------------------------------------------------------
-- Row Level Security
-- This is an internal tool used with the anon key, so the
-- policies below allow full read/write to anyone with the key.
-- If you later add Supabase Auth, replace `true` with
-- `auth.role() = 'authenticated'`.
-- ------------------------------------------------------------
alter table members       enable row level security;
alter table lunch_entries enable row level security;
alter table day_meta      enable row level security;
alter table app_settings  enable row level security;
alter table email_log     enable row level security;

create policy "members full access"       on members       for all using (true) with check (true);
create policy "lunch_entries full access" on lunch_entries for all using (true) with check (true);
create policy "day_meta full access"      on day_meta      for all using (true) with check (true);
create policy "app_settings full access"   on app_settings  for all using (true) with check (true);
create policy "email_log full access"      on email_log     for all using (true) with check (true);

-- ------------------------------------------------------------
-- Optional: seed your team roster (edit names, then run)
-- ------------------------------------------------------------
-- insert into members (name, food_pref) values
--   ('Arjun',   'nonveg'),
--   ('Priya',   'veg'),
--   ('Karthik', 'nonveg'),
--   ('Divya',   'veg');
