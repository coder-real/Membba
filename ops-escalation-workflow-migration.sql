-- ============================================
-- MEMBBA — Ops Escalation Workflow Columns
-- Run in Supabase SQL Editor
-- ============================================

alter table ai_escalations
  add column if not exists assigned_to_email text,
  add column if not exists priority text not null default 'normal';

do $$ begin
  alter table ai_escalations add constraint ai_escalations_priority_check
    check (priority in ('low', 'normal', 'high', 'urgent'));
exception when duplicate_object then null;
end $$;

create index if not exists idx_ai_escalations_assignee_status
  on ai_escalations(assigned_to_email, status, created_at desc);
