-- ============================================
-- MEMBBA — WhatsApp Platform Migration (v3)
-- Run this in Supabase SQL Editor
-- NON-DESTRUCTIVE: uses ALTER TABLE ADD COLUMN
-- Existing Telegram communities are untouched
-- ============================================

-- Add platform selection to communities
ALTER TABLE communities
  ADD COLUMN IF NOT EXISTS platform text NOT NULL DEFAULT 'telegram'
    CHECK (platform IN ('telegram', 'whatsapp')),
  ADD COLUMN IF NOT EXISTS whatsapp_group_invite_link text,
  ADD COLUMN IF NOT EXISTS whatsapp_group_id text;

-- Add WhatsApp phone to payments
ALTER TABLE payments
  ADD COLUMN IF NOT EXISTS whatsapp_phone text;

-- Add WhatsApp phone to subscriptions  
ALTER TABLE subscriptions
  ADD COLUMN IF NOT EXISTS whatsapp_phone text;

-- Performance indexes
CREATE INDEX IF NOT EXISTS idx_communities_platform ON communities(platform);
CREATE INDEX IF NOT EXISTS idx_subscriptions_whatsapp_phone ON subscriptions(whatsapp_phone);
CREATE INDEX IF NOT EXISTS idx_payments_whatsapp_phone ON payments(whatsapp_phone);
