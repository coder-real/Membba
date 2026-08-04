-- ============================================
-- MEMBBA — Payment Event Audit Log
-- Run in Supabase SQL Editor
-- ============================================

create table if not exists payment_events (
  id bigint generated always as identity primary key,
  paystack_reference text,
  event text not null,
  status text not null default 'info',
  message text,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

do $$ begin
  alter table payment_events add constraint payment_events_status_check
    check (status in ('info', 'success', 'failed'));
exception when duplicate_object then null;
end $$;

alter table payment_events enable row level security;
-- Backend service role bypasses RLS for inserts.

create index if not exists idx_payment_events_reference_created_at
  on payment_events(paystack_reference, created_at desc);

create index if not exists idx_payment_events_event_created_at
  on payment_events(event, created_at desc);
