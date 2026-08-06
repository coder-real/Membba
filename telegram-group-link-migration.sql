-- ============================================
-- MEMBBA — Telegram Group Auto-Link Tokens
-- Run in Supabase SQL Editor
-- ============================================

create table if not exists telegram_group_link_tokens (
  token text primary key,
  creator_id uuid references auth.users(id) on delete cascade not null,
  community_id uuid references communities(id) on delete cascade,
  chat_id bigint,
  chat_title text,
  status text not null default 'pending',
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  connected_at timestamptz
);

do $$ begin
  alter table telegram_group_link_tokens add constraint telegram_group_link_tokens_status_check
    check (status in ('pending', 'connected', 'expired'));
exception when duplicate_object then null;
end $$;

alter table telegram_group_link_tokens enable row level security;

drop policy if exists "creator reads own telegram group link tokens" on telegram_group_link_tokens;
create policy "creator reads own telegram group link tokens"
  on telegram_group_link_tokens for select
  using (creator_id = auth.uid());

-- Backend service role inserts/updates tokens.

create index if not exists idx_telegram_group_link_tokens_creator_created_at
  on telegram_group_link_tokens(creator_id, created_at desc);

create index if not exists idx_telegram_group_link_tokens_status_expires_at
  on telegram_group_link_tokens(status, expires_at);
