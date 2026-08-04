-- ============================================
-- MEMBBA — AI Escalations / Admin Follow-ups
-- Run in Supabase SQL Editor
-- ============================================

create table if not exists ai_escalations (
  id bigint generated always as identity primary key,
  phone text not null,
  intent text not null,
  action text,
  message text not null,
  ai_reply text,
  status text not null default 'open',
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);

alter table ai_escalations enable row level security;

-- Backend service role bypasses RLS and can insert/update rows.
-- Creators/admin UI policies can be added later when we connect this table
-- to a specific creator/community ownership model.

create index if not exists idx_ai_escalations_status_created_at
  on ai_escalations(status, created_at desc);

create index if not exists idx_ai_escalations_phone_created_at
  on ai_escalations(phone, created_at desc);
