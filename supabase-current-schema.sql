-- ============================================
-- MEMBBA — Current Consolidated Supabase Schema
-- Last updated: 2026-08-04
--
-- Purpose:
--   Single source of truth for the current Membba app database.
--   Safe for existing projects: uses CREATE TABLE IF NOT EXISTS,
--   ALTER TABLE ADD COLUMN IF NOT EXISTS, CREATE INDEX IF NOT EXISTS,
--   and DROP/CREATE policies where needed.
--
-- Run in Supabase SQL Editor.
-- ============================================

create extension if not exists "uuid-ossp";

-- ============================================
-- COMMUNITIES
-- ============================================
create table if not exists communities (
  id uuid primary key default uuid_generate_v4(),
  creator_id uuid references auth.users(id) on delete cascade not null,
  name text not null,
  description text,
  slug text unique not null,
  telegram_chat_id bigint,
  platform text not null default 'telegram',
  whatsapp_group_invite_link text,
  whatsapp_group_id text,
  welcome_message_enabled boolean not null default true,
  welcome_message text,
  invite_link_ttl_minutes integer not null default 60,
  msg_auto_delete_seconds integer not null default 120,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table communities
  add column if not exists platform text not null default 'telegram',
  add column if not exists whatsapp_group_invite_link text,
  add column if not exists whatsapp_group_id text,
  add column if not exists welcome_message_enabled boolean not null default true,
  add column if not exists welcome_message text,
  add column if not exists invite_link_ttl_minutes integer not null default 60,
  add column if not exists msg_auto_delete_seconds integer not null default 120;

do $$ begin
  alter table communities add constraint communities_platform_check check (platform in ('telegram', 'whatsapp'));
exception when duplicate_object then null;
end $$;

alter table communities enable row level security;

drop policy if exists "Creators can manage their own communities" on communities;
create policy "Creators can manage their own communities"
  on communities for all
  using (auth.uid() = creator_id)
  with check (auth.uid() = creator_id);

drop policy if exists "Anyone can read active communities by slug" on communities;
create policy "Anyone can read active communities by slug"
  on communities for select
  using (is_active = true);

-- ============================================
-- PLANS
-- ============================================
create table if not exists plans (
  id uuid primary key default uuid_generate_v4(),
  community_id uuid references communities(id) on delete cascade not null,
  name text not null,
  description text,
  price numeric(10, 2) not null,
  currency text not null default 'NGN',
  duration_minutes integer not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table plans enable row level security;

drop policy if exists "Creators can manage their own plans" on plans;
create policy "Creators can manage their own plans"
  on plans for all
  using (community_id in (select id from communities where creator_id = auth.uid()))
  with check (community_id in (select id from communities where creator_id = auth.uid()));

drop policy if exists "Anyone can read active plans" on plans;
create policy "Anyone can read active plans"
  on plans for select
  using (is_active = true);

-- ============================================
-- PAYMENTS
-- ============================================
create table if not exists payments (
  id uuid primary key default uuid_generate_v4(),
  community_id uuid references communities(id) on delete cascade not null,
  plan_id uuid references plans(id) not null,
  email text not null,
  telegram_user_id bigint,
  whatsapp_phone text,
  paystack_reference text unique not null,
  amount numeric(10, 2) not null,
  status text not null default 'pending',
  created_at timestamptz not null default now()
);

alter table payments
  add column if not exists whatsapp_phone text;

do $$ begin
  alter table payments add constraint payments_status_check check (status in ('pending', 'success', 'failed'));
exception when duplicate_object then null;
end $$;

alter table payments enable row level security;

drop policy if exists "Creators can read payments for their communities" on payments;
create policy "Creators can read payments for their communities"
  on payments for select
  using (community_id in (select id from communities where creator_id = auth.uid()));

-- Backend service role bypasses RLS for writes.
drop policy if exists "Service role can manage payments" on payments;

-- ============================================
-- PAYMENT EVENT AUDIT LOG
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

alter table payment_events
  add column if not exists paystack_reference text,
  add column if not exists event text,
  add column if not exists status text not null default 'info',
  add column if not exists message text,
  add column if not exists payload jsonb not null default '{}'::jsonb,
  add column if not exists created_at timestamptz not null default now();

do $$ begin
  alter table payment_events add constraint payment_events_status_check check (status in ('info', 'success', 'failed'));
exception when duplicate_object then null;
end $$;

alter table payment_events enable row level security;
-- Backend-only table for now. Service role bypasses RLS.

-- ============================================
-- SUBSCRIPTIONS
-- ============================================
create table if not exists subscriptions (
  id uuid primary key default uuid_generate_v4(),
  community_id uuid references communities(id) on delete cascade not null,
  plan_id uuid references plans(id) not null,
  email text not null,
  telegram_user_id bigint,
  whatsapp_phone text,
  paystack_reference text,
  status text not null default 'active',
  started_at timestamptz not null default now(),
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

alter table subscriptions
  add column if not exists whatsapp_phone text;

do $$ begin
  alter table subscriptions add constraint subscriptions_status_check check (status in ('active', 'expired', 'cancelled'));
exception when duplicate_object then null;
end $$;

alter table subscriptions enable row level security;

drop policy if exists "Creators can read subscriptions for their communities" on subscriptions;
create policy "Creators can read subscriptions for their communities"
  on subscriptions for select
  using (community_id in (select id from communities where creator_id = auth.uid()));

-- Backend service role bypasses RLS for writes.
drop policy if exists "Service role can manage subscriptions" on subscriptions;

-- ============================================
-- TELEGRAM UID CAPTURE TOKENS
-- ============================================
create table if not exists telegram_uid_tokens (
  token text primary key,
  uid bigint,
  created_at timestamptz not null default now()
);

alter table telegram_uid_tokens enable row level security;
-- Backend-only table. Service role bypasses RLS.

-- ============================================
-- WHATSAPP SESSION + PENDING INVITES
-- ============================================
create table if not exists baileys_sessions (
  id text primary key,
  data jsonb not null,
  updated_at timestamptz not null default now()
);

alter table baileys_sessions enable row level security;
-- Backend-only table. Service role bypasses RLS.

create table if not exists whatsapp_sessions (
  id text primary key,
  session text not null,
  updated_at timestamptz not null default now()
);

alter table whatsapp_sessions enable row level security;
-- Legacy/backwards-compat session table. Current code uses baileys_sessions.

create table if not exists whatsapp_pending_invites (
  id bigint generated always as identity primary key,
  phone text not null,
  invite_link text,
  community_name text,
  community_id uuid references communities(id) on delete cascade,
  group_id text,
  custom_message text,
  created_at timestamptz not null default now()
);

alter table whatsapp_pending_invites enable row level security;
-- Backend-only table. Service role bypasses RLS.

-- ============================================
-- AUTOMATIONS
-- ============================================
create table if not exists automation_settings (
  creator_id uuid primary key references auth.users(id) on delete cascade,
  ai_responder boolean not null default true,
  daily_digest boolean not null default true,
  scheduler boolean not null default true,
  digest_time text not null default '08:00',
  updated_at timestamptz not null default now()
);

alter table automation_settings enable row level security;

drop policy if exists "creator owns their settings" on automation_settings;
create policy "creator owns their settings"
  on automation_settings for all
  using (auth.uid() = creator_id)
  with check (auth.uid() = creator_id);

create table if not exists scheduled_posts (
  id bigint generated always as identity primary key,
  creator_id uuid not null references auth.users(id) on delete cascade,
  community_id uuid not null references communities(id) on delete cascade,
  content text not null,
  scheduled_time timestamptz not null,
  status text not null default 'pending',
  personalize_ai boolean not null default false,
  sent_at timestamptz,
  created_at timestamptz not null default now()
);

alter table scheduled_posts enable row level security;

drop policy if exists "creator owns their posts" on scheduled_posts;
create policy "creator owns their posts"
  on scheduled_posts for all
  using (auth.uid() = creator_id)
  with check (auth.uid() = creator_id);

create table if not exists automation_runs (
  id bigint generated always as identity primary key,
  creator_id uuid references auth.users(id) on delete set null,
  type text not null,
  status text not null default 'success',
  message text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table automation_runs
  add column if not exists creator_id uuid references auth.users(id) on delete set null,
  add column if not exists type text,
  add column if not exists status text not null default 'success',
  add column if not exists message text,
  add column if not exists metadata jsonb not null default '{}'::jsonb,
  add column if not exists created_at timestamptz not null default now();

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

drop policy if exists "creator reads own automation runs" on automation_runs;
create policy "creator reads own automation runs"
  on automation_runs for select
  using (creator_id = auth.uid() or creator_id is null);

-- ============================================
-- AI ESCALATIONS / FOLLOW-UPS
-- ============================================
create table if not exists ai_escalations (
  id bigint generated always as identity primary key,
  phone text not null,
  intent text not null,
  action text,
  message text not null,
  ai_reply text,
  status text not null default 'open',
  assigned_to_email text,
  priority text not null default 'normal',
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);

alter table ai_escalations
  add column if not exists phone text,
  add column if not exists intent text,
  add column if not exists action text,
  add column if not exists message text,
  add column if not exists ai_reply text,
  add column if not exists status text not null default 'open',
  add column if not exists assigned_to_email text,
  add column if not exists priority text not null default 'normal',
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists resolved_at timestamptz;

do $$ begin
  alter table ai_escalations add constraint ai_escalations_priority_check
    check (priority in ('low', 'normal', 'high', 'urgent'));
exception when duplicate_object then null;
end $$;

alter table ai_escalations enable row level security;
-- Backend-only table for now. Service role bypasses RLS.

create table if not exists member_conversations (
  id bigint generated always as identity primary key,
  phone text not null,
  role text not null,
  content text not null,
  created_at timestamptz not null default now()
);

alter table member_conversations
  add column if not exists phone text,
  add column if not exists role text,
  add column if not exists content text,
  add column if not exists created_at timestamptz not null default now();

do $$ begin
  alter table member_conversations add constraint member_conversations_role_check check (role in ('user', 'assistant'));
exception when duplicate_object then null;
end $$;

alter table member_conversations enable row level security;
-- Backend-only table. Service role bypasses RLS.

-- ============================================
-- MEMBBA OPS NOTES
-- ============================================
create table if not exists ops_notes (
  id bigint generated always as identity primary key,
  entity_type text not null,
  entity_id text not null,
  note text not null,
  created_by_email text,
  created_at timestamptz not null default now()
);

alter table ops_notes
  add column if not exists entity_type text,
  add column if not exists entity_id text,
  add column if not exists note text,
  add column if not exists created_by_email text,
  add column if not exists created_at timestamptz not null default now();

alter table ops_notes enable row level security;
-- Backend-only table. Service role bypasses RLS.

-- ============================================
-- STORAGE: AVATARS
-- ============================================
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do update set public = true;

drop policy if exists "Authenticated users can upload avatars" on storage.objects;
create policy "Authenticated users can upload avatars"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'avatars');

drop policy if exists "Authenticated users can update avatars" on storage.objects;
create policy "Authenticated users can update avatars"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'avatars')
  with check (bucket_id = 'avatars');

drop policy if exists "Anyone can read public avatars" on storage.objects;
create policy "Anyone can read public avatars"
  on storage.objects for select
  to public
  using (bucket_id = 'avatars');

-- ============================================
-- INDEXES
-- ============================================
create index if not exists idx_communities_creator_id on communities(creator_id);
create index if not exists idx_communities_slug on communities(slug);
create index if not exists idx_communities_platform on communities(platform);
create index if not exists idx_communities_whatsapp_group_id on communities(whatsapp_group_id);

create index if not exists idx_plans_community_id on plans(community_id);

create index if not exists idx_payments_community_id on payments(community_id);
create index if not exists idx_payments_plan_id on payments(plan_id);
create index if not exists idx_payments_reference on payments(paystack_reference);
create index if not exists idx_payments_telegram_user_id on payments(telegram_user_id);
create index if not exists idx_payments_whatsapp_phone on payments(whatsapp_phone);
create index if not exists idx_payments_status on payments(status);

create index if not exists idx_payment_events_reference_created_at on payment_events(paystack_reference, created_at desc);
create index if not exists idx_payment_events_event_created_at on payment_events(event, created_at desc);

create index if not exists idx_subscriptions_community_id on subscriptions(community_id);
create index if not exists idx_subscriptions_plan_id on subscriptions(plan_id);
create index if not exists idx_subscriptions_status on subscriptions(status);
create index if not exists idx_subscriptions_expires_at on subscriptions(expires_at);
create index if not exists idx_subscriptions_telegram_user_id on subscriptions(telegram_user_id);
create index if not exists idx_subscriptions_whatsapp_phone on subscriptions(whatsapp_phone);
create index if not exists idx_subscriptions_paystack_reference on subscriptions(paystack_reference);

create index if not exists idx_telegram_uid_tokens_created_at on telegram_uid_tokens(created_at);

create index if not exists idx_whatsapp_pending_invites_created_at on whatsapp_pending_invites(created_at);
create index if not exists idx_whatsapp_pending_invites_community_id on whatsapp_pending_invites(community_id);

create index if not exists idx_scheduled_posts_creator_id on scheduled_posts(creator_id);
create index if not exists idx_scheduled_posts_community_id on scheduled_posts(community_id);
create index if not exists idx_scheduled_posts_pending on scheduled_posts(status, scheduled_time) where status = 'pending';

create index if not exists idx_automation_runs_creator_created_at on automation_runs(creator_id, created_at desc);
create index if not exists idx_automation_runs_type_status_created_at on automation_runs(type, status, created_at desc);

create index if not exists idx_ai_escalations_status_created_at on ai_escalations(status, created_at desc);
create index if not exists idx_ai_escalations_phone_created_at on ai_escalations(phone, created_at desc);
create index if not exists idx_ai_escalations_assignee_status on ai_escalations(assigned_to_email, status, created_at desc);

create index if not exists idx_member_conversations_phone on member_conversations(phone, created_at desc);

create index if not exists idx_ops_notes_entity_created_at on ops_notes(entity_type, entity_id, created_at desc);
create index if not exists idx_ops_notes_created_at on ops_notes(created_at desc);
