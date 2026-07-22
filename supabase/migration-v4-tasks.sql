-- ============================================================
-- Migration V4: Add Daily Tasks Module
-- ============================================================

create table if not exists daily_tasks (
  id              uuid primary key default gen_random_uuid(),
  client          text not null default '',
  account_manager text not null default '',
  task_name       text not null default '',
  task_type       text not null default '',
  assigned_to     text not null default '',
  assigned_on     date,
  priority        text not null default 'Medium',
  deadline_date   date,
  deadline_time   text not null default '',
  status          text not null default 'Not Started',
  remarks         text not null default '',
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- Index for sorting and filtering
create index if not exists idx_daily_tasks_deadline on daily_tasks (deadline_date);
create index if not exists idx_daily_tasks_status on daily_tasks (status);

-- Enable RLS
alter table daily_tasks enable row level security;

-- Allow completely public access (anyone can read/write without login)
create policy "daily_tasks full access" on daily_tasks for all using (true) with check (true);
