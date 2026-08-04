-- ============================================
-- MEMBBA — Automation Run Logs
-- Run in Supabase SQL Editor
-- ============================================

create table if not exists automation_runs (
  id bigint generated always as identity primary key,
  creator_id uuid references auth.users(id) on delete set null,
  type text not null,
  status text not null default 'success',
  message text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

do $$ begin
  alter table automation_runs add constraint automation_runs_type_check
    check (type in ('ai_responder', 'daily_digest', 'scheduler', 'scheduled_broadcast', 'test'));
exception when duplicate_object then null;
end $$;

do $$ begin
  alter table automation_runs add constraint automation_runs_status_check
    check (status in ('success', 'failed', 'skipped'));
exception when duplicate_object then null;
end $$;

alter table automation_runs enable row level security;

-- Creators can read their own run logs.
drop policy if exists "creator reads own automation runs" on automation_runs;
create policy "creator reads own automation runs"
  on automation_runs for select
  using (creator_id = auth.uid() or creator_id is null);

-- Backend service role bypasses RLS for inserts.

create index if not exists idx_automation_runs_creator_created_at
  on automation_runs(creator_id, created_at desc);

create index if not exists idx_automation_runs_type_status_created_at
  on automation_runs(type, status, created_at desc);
