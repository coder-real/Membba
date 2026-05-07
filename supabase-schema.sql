-- ============================================
-- MEMBBA — Supabase Database Schema
-- Run this in your Supabase SQL editor
-- ============================================

-- Enable UUID generation
create extension if not exists "uuid-ossp";


-- ============================================
-- COMMUNITIES
-- ============================================
create table communities (
  id uuid primary key default uuid_generate_v4(),
  creator_id uuid references auth.users(id) on delete cascade not null,
  name text not null,
  description text,
  price numeric(10, 2) not null,
  billing_cycle text check (billing_cycle in ('weekly', 'monthly')) default 'monthly',
  slug text unique not null,
  telegram_group_id text,
  telegram_invite_link text,
  is_active boolean default true,
  created_at timestamptz default now()
);

-- RLS
alter table communities enable row level security;

create policy "Creators can manage their own communities"
  on communities for all
  using (auth.uid() = creator_id);

create policy "Anyone can read active communities by slug"
  on communities for select
  using (is_active = true);


-- ============================================
-- SUBSCRIPTIONS
-- ============================================
create table subscriptions (
  id uuid primary key default uuid_generate_v4(),
  community_id uuid references communities(id) on delete cascade not null,
  subscriber_email text not null,
  subscriber_name text,
  telegram_username text,
  start_date timestamptz not null default now(),
  expiry_date timestamptz not null,
  status text check (status in ('active', 'expired', 'pending')) default 'pending',
  created_at timestamptz default now()
);

-- RLS
alter table subscriptions enable row level security;

create policy "Creators can read subscriptions for their communities"
  on subscriptions for select
  using (
    community_id in (
      select id from communities where creator_id = auth.uid()
    )
  );

-- Allow service role to insert/update (for webhook processing)
create policy "Service role can manage subscriptions"
  on subscriptions for all
  using (true)
  with check (true);


-- ============================================
-- PAYMENTS
-- ============================================
create table payments (
  id uuid primary key default uuid_generate_v4(),
  community_id uuid references communities(id) on delete cascade not null,
  subscription_id uuid references subscriptions(id),
  subscriber_email text not null,
  amount numeric(10, 2) not null,
  payment_reference text unique not null,
  status text check (status in ('pending', 'success', 'failed')) default 'pending',
  paid_at timestamptz,
  created_at timestamptz default now()
);

-- RLS
alter table payments enable row level security;

create policy "Creators can read payments for their communities"
  on payments for select
  using (
    community_id in (
      select id from communities where creator_id = auth.uid()
    )
  );

create policy "Service role can manage payments"
  on payments for all
  using (true)
  with check (true);


-- ============================================
-- MEMBERSHIPS (Telegram access tracking)
-- ============================================
create table memberships (
  id uuid primary key default uuid_generate_v4(),
  subscription_id uuid references subscriptions(id) on delete cascade not null,
  community_id uuid references communities(id) on delete cascade not null,
  telegram_username text not null,
  telegram_user_id text,
  is_active boolean default false,
  added_at timestamptz,
  removed_at timestamptz,
  created_at timestamptz default now()
);

-- RLS
alter table memberships enable row level security;

create policy "Creators can read memberships for their communities"
  on memberships for select
  using (
    community_id in (
      select id from communities where creator_id = auth.uid()
    )
  );

create policy "Service role can manage memberships"
  on memberships for all
  using (true)
  with check (true);


-- ============================================
-- INDEXES for performance
-- ============================================
create index on communities(creator_id);
create index on communities(slug);
create index on subscriptions(community_id);
create index on subscriptions(status);
create index on subscriptions(expiry_date);
create index on payments(community_id);
create index on payments(payment_reference);
create index on memberships(community_id);
create index on memberships(telegram_username);
