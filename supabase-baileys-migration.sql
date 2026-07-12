-- ============================================
-- MEMBBA — WhatsApp Session Store (v5 Baileys)
-- Run this in Supabase SQL Editor
-- Stores Baileys WhatsApp JSON keys directly in Supabase
-- to completely bypass Render's ephemeral filesystem.
-- ============================================

CREATE TABLE IF NOT EXISTS baileys_sessions (
  id text PRIMARY KEY,      -- e.g. 'creds' or 'app-state-sync-key-1'
  data jsonb NOT NULL,      -- The serialized JSON data payload from Baileys
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Only the service role (backend) should access this table
ALTER TABLE baileys_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role manages baileys sessions"
  ON baileys_sessions FOR ALL
  USING (true)
  WITH CHECK (true);
