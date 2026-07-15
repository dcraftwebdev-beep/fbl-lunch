-- ============================================================
-- Migration v2 — emails, chef profile, send log, cancel tokens
-- For EXISTING projects: run this in SQL Editor.
-- (Fresh installs: schema.sql now includes all of this already.)
-- ============================================================

-- Member emails
alter table members add column if not exists email text not null default '';

-- Signed cancel link per lunch entry
alter table lunch_entries add column if not exists cancel_token uuid not null default gen_random_uuid();

-- Single-row settings: chef profile + cutoff time (IST, HH:MM)
create table if not exists app_settings (
  id          int primary key default 1 check (id = 1),
  chef_name   text not null default '',
  chef_email  text not null default '',
  chef_photo  text not null default '',
  cutoff      text not null default '11:00'
);
insert into app_settings (id) values (1) on conflict do nothing;

alter table app_settings enable row level security;
create policy "app_settings full access" on app_settings for all using (true) with check (true);

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

alter table email_log enable row level security;
create policy "email_log full access" on email_log for all using (true) with check (true);
