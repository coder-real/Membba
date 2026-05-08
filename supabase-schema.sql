-- ============================================
-- MEMBBA — Supabase Database Schema (v2)
-- Run this in your Supabase SQL editor
-- WARNING: Drops existing tables — deletes all data!
-- ============================================

-- Enable UUID generation
create extension if not exists "uuid-ossp";


-- ============================================
-- DROP OLD TABLES (safe reset)
-- ============================================
drop table if exists memberships cascade;
drop table if exists payments cascade;
drop table if exists subscriptions cascade;
drop table if exists plans cascade;
drop table if exists communities cascade;


-- ============================================
-- COMMUNITIES
-- Represents a creator's paid Telegram group
-- ============================================
create table communities (
  id            uuid primary key default uuid_generate_v4(),
  creator_id    uuid references auth.users(id) on delete cascade not null,
  name          text not null,
  description   text,
  slug          text unique not null,
  -- Numeric Telegram group ID. Creator gets this via @userinfobot.
  -- Bot must be admin of this group with Add/Remove Members permissions.
  telegram_chat_id  bigint,
  is_active     boolean default true,
  created_at    timestamptz default now()
);

-- RLS
alter table communities enable row level security;

create policy "Creators can manage their own communities"
  on communities for all
  using (auth.uid() = creator_id)
  with check (auth.uid() = creator_id);

create policy "Anyone can read active communities by slug"
  on communities for select
  using (is_active = true);


-- ============================================
-- PLANS
-- Subscription tiers within a community
-- e.g. "2 Minutes - ₦200", "Monthly - ₦2,000"
-- ============================================
create table plans (
  id              uuid primary key default uuid_generate_v4(),
  community_id    uuid references communities(id) on delete cascade not null,
  name            text not null,              -- e.g. "Monthly Plan"
  description     text,
  price           numeric(10, 2) not null,    -- amount in kobo-base currency
  currency        text not null default 'NGN',
  -- Duration stored in MINUTES for precision (supports short plans like 2 min)
  -- Examples: 2 min = 2, 7 days = 10080, 30 days = 43200
  duration_minutes integer not null,
  is_active       boolean default true,
  created_at      timestamptz default now()
);

-- RLS
alter table plans enable row level security;

create policy "Creators can manage their own plans"
  on plans for all
  using (
    community_id in (
      select id from communities where creator_id = auth.uid()
    )
  )
  with check (
    community_id in (
      select id from communities where creator_id = auth.uid()
    )
  );

create policy "Anyone can read active plans"
  on plans for select
  using (is_active = true);


-- ============================================
-- PAYMENTS
-- One record per Paystack transaction attempt
-- Created on initialize, updated on webhook/verify
-- ============================================
create table payments (
  id                  uuid primary key default uuid_generate_v4(),
  community_id        uuid references communities(id) on delete cascade not null,
  plan_id             uuid references plans(id) not null,
  email               text not null,
  telegram_user_id    bigint,                 -- NULL if subscriber skipped it
  paystack_reference  text unique not null,
  amount              numeric(10, 2) not null, -- in NGN (not kobo)
  status              text check (status in ('pending', 'success', 'failed')) default 'pending',
  created_at          timestamptz default now()
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

-- Backend (service role) manages payments — bypassed by service key
create policy "Service role can manage payments"
  on payments for all
  using (true)
  with check (true);


-- ============================================
-- SUBSCRIPTIONS
-- Active/expired membership records
-- Created after payment confirmed
-- ============================================
create table subscriptions (
  id                  uuid primary key default uuid_generate_v4(),
  community_id        uuid references communities(id) on delete cascade not null,
  plan_id             uuid references plans(id) not null,
  email               text not null,
  telegram_user_id    bigint,                 -- used by bot to kick expired members
  paystack_reference  text,                   -- links back to the payment record
  status              text check (status in ('active', 'expired', 'cancelled')) default 'active',
  started_at          timestamptz not null default now(),
  expires_at          timestamptz not null,   -- started_at + plan.duration_minutes
  created_at          timestamptz default now()
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

-- Backend (service role) manages subscriptions
create policy "Service role can manage subscriptions"
  on subscriptions for all
  using (true)
  with check (true);


-- ============================================
-- INDEXES for performance
-- ============================================

-- Communities
create index on communities(creator_id);
create index on communities(slug);

-- Plans
create index on plans(community_id);

-- Payments
create index on payments(community_id);
create index on payments(paystack_reference);
create index on payments(telegram_user_id);

-- Subscriptions
create index on subscriptions(community_id);
create index on subscriptions(status);
create index on subscriptions(expires_at);   -- cron job queries this
create index on subscriptions(telegram_user_id);
create index on subscriptions(paystack_reference);
