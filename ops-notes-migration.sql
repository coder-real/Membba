-- ============================================
-- MEMBBA — Ops Notes
-- Run in Supabase SQL Editor
-- ============================================

create table if not exists ops_notes (
  id bigint generated always as identity primary key,
  entity_type text not null,
  entity_id text not null,
  note text not null,
  created_by_email text,
  created_at timestamptz not null default now()
);

alter table ops_notes enable row level security;
-- Internal backend service role inserts/reads for the operations console.

create index if not exists idx_ops_notes_entity_created_at
  on ops_notes(entity_type, entity_id, created_at desc);

create index if not exists idx_ops_notes_created_at
  on ops_notes(created_at desc);
