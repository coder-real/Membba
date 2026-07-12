-- ============================================
-- MEMBBA — Automations: Settings + Scheduled Posts
-- Run in Supabase SQL Editor
-- ============================================

-- Per-creator global automation feature flags
CREATE TABLE IF NOT EXISTS automation_settings (
  creator_id       uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  ai_responder     boolean NOT NULL DEFAULT true,   -- Feature 1/5: AI DM replies
  daily_digest     boolean NOT NULL DEFAULT true,   -- Feature 4: Morning briefing
  scheduler        boolean NOT NULL DEFAULT true,   -- Feature 3: Scheduled posts
  digest_time      text    NOT NULL DEFAULT '08:00', -- HH:MM WAT
  updated_at       timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE automation_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "creator owns their settings"
  ON automation_settings FOR ALL
  USING (auth.uid() = creator_id)
  WITH CHECK (auth.uid() = creator_id);

-- Scheduled broadcast posts (Feature 3)
CREATE TABLE IF NOT EXISTS scheduled_posts (
  id               bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  creator_id       uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  community_id     uuid NOT NULL REFERENCES communities(id) ON DELETE CASCADE,
  content          text NOT NULL,
  scheduled_time   timestamptz NOT NULL,
  status           text NOT NULL DEFAULT 'pending',   -- pending | sent | cancelled
  personalize_ai   boolean NOT NULL DEFAULT false,    -- whether to vary tone per group via AI
  sent_at          timestamptz,
  created_at       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_scheduled_posts_pending
  ON scheduled_posts (status, scheduled_time)
  WHERE status = 'pending';

ALTER TABLE scheduled_posts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "creator owns their posts"
  ON scheduled_posts FOR ALL
  USING (auth.uid() = creator_id)
  WITH CHECK (auth.uid() = creator_id);
