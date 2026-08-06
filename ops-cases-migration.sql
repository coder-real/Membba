-- ============================================
-- MEMBBA — Ops Help Desk Case Management
-- Run in Supabase SQL Editor
-- ============================================

create table if not exists ops_staff_roles (
  email text primary key,
  role text not null default 'ops_staff',
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

do $$ begin
  alter table ops_staff_roles add constraint ops_staff_roles_role_check
    check (role in ('ops_staff', 'senior_ops', 'admin', 'developer'));
exception when duplicate_object then null;
end $$;

create table if not exists ops_cases (
  id uuid primary key default uuid_generate_v4(),
  creator_id uuid references auth.users(id) on delete set null,
  creator_email text,
  category text not null default 'general',
  status text not null default 'open',
  priority text not null default 'normal',
  subject text not null,
  description text not null,
  resolution_notes text,
  engineering_summary text,
  assigned_to_email text,
  created_by_email text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  resolved_at timestamptz,
  closed_at timestamptz
);

do $$ begin
  alter table ops_cases add constraint ops_cases_status_check
    check (status in ('open', 'in_progress', 'escalated', 'resolved', 'closed'));
exception when duplicate_object then null;
end $$;

do $$ begin
  alter table ops_cases add constraint ops_cases_priority_check
    check (priority in ('low', 'normal', 'high', 'urgent'));
exception when duplicate_object then null;
end $$;

do $$ begin
  alter table ops_cases add constraint ops_cases_category_check
    check (category in ('payout', 'bot_integration', 'billing', 'account_access', 'payment_issue', 'member_access', 'bug', 'general'));
exception when duplicate_object then null;
end $$;

create table if not exists ops_case_activity (
  id bigint generated always as identity primary key,
  case_id uuid not null references ops_cases(id) on delete cascade,
  actor_email text,
  action text not null,
  message text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table ops_staff_roles enable row level security;
alter table ops_cases enable row level security;
alter table ops_case_activity enable row level security;
-- Internal backend service role handles access control for now.

create index if not exists idx_ops_cases_status_updated_at on ops_cases(status, updated_at desc);
create index if not exists idx_ops_cases_assigned_status on ops_cases(assigned_to_email, status, updated_at desc);
create index if not exists idx_ops_cases_creator_updated_at on ops_cases(creator_id, updated_at desc);
create index if not exists idx_ops_cases_category_status on ops_cases(category, status, updated_at desc);
create index if not exists idx_ops_case_activity_case_created_at on ops_case_activity(case_id, created_at desc);
