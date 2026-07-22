-- ============================================================
-- Migration V5: Advanced Tasks Module Schema
-- ============================================================

-- Table for predefined team members (Designers, Account Managers)
create table if not exists task_team_members (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  role        text not null check (role in ('Designer', 'Account Manager')),
  avatar_url  text not null default '',
  active      boolean not null default true,
  created_at  timestamptz not null default now()
);

-- Table to allow custom renaming of weekly group titles
create table if not exists task_group_titles (
  week_key     text primary key, -- Format: '2026-W28'
  custom_title text not null,
  updated_at   timestamptz not null default now()
);

-- Enable RLS
alter table task_team_members enable row level security;
alter table task_group_titles enable row level security;

-- Completely public access since the Tasks module doesn't require login
create policy "task_team_members full access" on task_team_members for all using (true) with check (true);
create policy "task_group_titles full access" on task_group_titles for all using (true) with check (true);

-- Seed some initial team members for demo purposes
insert into task_team_members (name, role) values
  ('Ritika', 'Account Manager'),
  ('Dipak', 'Account Manager'),
  ('Dhenuka', 'Account Manager'),
  ('Lazzo', 'Designer'),
  ('Catherine', 'Designer'),
  ('Srinithi', 'Designer'),
  ('Ajay', 'Designer')
on conflict do nothing;
